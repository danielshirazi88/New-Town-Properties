/**
 * Where the app keeps everything people type: edits to the rent roll, expenses,
 * and the tax worksheet.
 *
 * Storage sits behind an adapter so the same application code runs against the
 * browser (one machine, no account) or a shared backend (everyone sees the same
 * numbers). Nothing above this file knows which one is in play — swapping them
 * is a config change, not a rewrite.
 */

export interface StoreAdapter {
  readonly kind: 'local' | 'remote'
  /** Human-readable description of where data is going, for the UI to show. */
  readonly label: string
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  /** Remote adapters push changes made elsewhere; local ones return a no-op. */
  subscribe<T>(key: string, onChange: (value: T) => void): () => void
}

const PREFIX = 'ntp.'

/** Browser-only storage. Per machine, per browser, never leaves the device. */
export class LocalAdapter implements StoreAdapter {
  readonly kind = 'local' as const
  readonly label = 'This browser only'

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
      // Other tabs on this machine still get to hear about it.
      window.dispatchEvent(new CustomEvent('ntp:changed', { detail: { key } }))
    } catch (err) {
      console.error('Could not save', key, err)
    }
  }

  subscribe<T>(key: string, onChange: (value: T) => void): () => void {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail
      if (detail?.key !== key) return
      void this.get<T>(key).then((v) => v !== null && onChange(v))
    }
    // `storage` fires for other tabs; the custom event covers this one.
    const storageHandler = (e: StorageEvent) => {
      if (e.key === PREFIX + key && e.newValue) {
        try { onChange(JSON.parse(e.newValue) as T) } catch { /* ignore bad payload */ }
      }
    }
    window.addEventListener('ntp:changed', handler)
    window.addEventListener('storage', storageHandler)
    return () => {
      window.removeEventListener('ntp:changed', handler)
      window.removeEventListener('storage', storageHandler)
    }
  }
}

/**
 * Shared storage over a REST backend, so Chicago and Miami read and write the
 * same records. Activated by setting `window.NTP_BACKEND` before the app boots:
 *
 *   window.NTP_BACKEND = { url: 'https://…', key: '…' }
 *
 * The shape is deliberately plain REST — one table of `{ key, value, updated_at }`
 * rows — so it can sit on Supabase, a small Express server, or anything else that
 * speaks JSON, without the app caring which.
 */
export interface BackendConfig {
  url: string
  key: string
  /** Seconds between polls for changes made elsewhere. */
  pollSeconds?: number
}

export class RemoteAdapter implements StoreAdapter {
  readonly kind = 'remote' as const
  readonly label: string
  private timers = new Map<string, number>()

  constructor(private config: BackendConfig) {
    this.label = `Shared — ${new URL(config.url).host}`
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      apikey: this.config.key,
      Authorization: `Bearer ${this.config.key}`,
      Prefer: 'resolution=merge-duplicates',
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const res = await fetch(
        `${this.config.url}/rest/v1/app_state?key=eq.${encodeURIComponent(key)}&select=value`,
        { headers: this.headers() },
      )
      if (!res.ok) return null
      const rows = (await res.json()) as { value: T }[]
      return rows.length ? rows[0].value : null
    } catch {
      return null
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const res = await fetch(`${this.config.url}/rest/v1/app_state`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
      })
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
    } catch (err) {
      console.error('Could not save to the shared backend', key, err)
      throw err
    }
  }

  subscribe<T>(key: string, onChange: (value: T) => void): () => void {
    const period = (this.config.pollSeconds ?? 20) * 1000
    let last = ''
    const tick = async () => {
      const value = await this.get<T>(key)
      if (value === null) return
      const serialised = JSON.stringify(value)
      if (serialised !== last) {
        last = serialised
        onChange(value)
      }
    }
    void tick()
    const id = window.setInterval(tick, period)
    this.timers.set(key, id)
    return () => {
      window.clearInterval(id)
      this.timers.delete(key)
    }
  }
}

declare global {
  interface Window {
    NTP_BACKEND?: BackendConfig
  }
}

let adapter: StoreAdapter | undefined

/** The adapter in use. Remote when configured, browser storage otherwise. */
export function store(): StoreAdapter {
  if (!adapter) {
    const cfg = window.NTP_BACKEND
    adapter = cfg?.url && cfg?.key ? new RemoteAdapter(cfg) : new LocalAdapter()
  }
  return adapter
}

export const STORE_KEYS = {
  overrides: 'overrides.v1',
  expenses: 'expenses.v1',
  taxes: 'taxes.v1',
} as const
