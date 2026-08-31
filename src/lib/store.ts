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
 * Shared storage over this application's own API.
 *
 * When the front-end is served by the Node server it talks to `/api/state/...`
 * on the same origin, so there is no key embedded in the page, no CORS, and the
 * database credentials stay on the server where they belong. The adapter is
 * chosen at boot by asking the server whether it is there.
 */
export class ApiAdapter implements StoreAdapter {
  readonly kind = 'remote' as const
  readonly label = 'Shared — everyone sees these numbers'
  private pollSeconds: number

  constructor(pollSeconds = 15) {
    this.pollSeconds = pollSeconds
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const res = await fetch(`/api/state/${encodeURIComponent(key)}`, { credentials: 'same-origin' })
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent('ntp:unauthenticated'))
        return null
      }
      if (!res.ok) return null
      const body = (await res.json()) as { value: T | null }
      return body.value
    } catch {
      return null
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    const res = await fetch(`/api/state/${encodeURIComponent(key)}`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value, by: localStorage.getItem('ntp.editor') ?? undefined }),
    })
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('ntp:unauthenticated'))
      throw new Error('Please sign in again')
    }
    if (!res.ok) throw new Error(`Could not save (${res.status})`)
  }

  subscribe<T>(key: string, onChange: (value: T) => void): () => void {
    // `null` means "we have not looked yet", which is different from "we looked
    // and there was nothing there". Conflating the two loses the very first
    // write: a browser opened before anyone had saved anything would treat the
    // arrival of real data as its baseline and never report it.
    let last: string | null = null
    let stopped = false

    const tick = async () => {
      if (stopped) return
      const value = await this.get<T>(key)
      const serialised = value === null ? '' : JSON.stringify(value)
      if (last !== null && value !== null && serialised !== last) onChange(value)
      last = serialised
    }

    void tick()
    const id = window.setInterval(tick, this.pollSeconds * 1000)
    // Catch up straight away when someone comes back to the tab, rather than
    // making them wait out the remainder of the interval.
    const onVisible = () => { if (!document.hidden) void tick() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      stopped = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }
}

let adapter: StoreAdapter = new LocalAdapter()

export interface ServerInfo {
  present: boolean
  authRequired: boolean
  authenticated: boolean
  name: string | null
}

let serverInfo: ServerInfo = { present: false, authRequired: false, authenticated: false, name: null }

/**
 * Ask the server whether it is there before the app renders. If it answers, the
 * app runs shared; if not — opened as a file, or served as a static bundle — it
 * falls back to this browser's own storage and still works.
 */
export async function initStore(): Promise<ServerInfo> {
  try {
    const res = await fetch('/api/session', { credentials: 'same-origin' })
    if (res.ok) {
      const body = (await res.json()) as Omit<ServerInfo, 'present'>
      serverInfo = { present: true, ...body }
      if (body.authenticated) adapter = new ApiAdapter()
      return serverInfo
    }
  } catch {
    // No server here — browser storage it is.
  }
  return serverInfo
}

/**
 * Called after a successful sign-in to switch storage over without a reload.
 *
 * Anything already subscribed is listening to the old adapter, so this
 * announces the swap and `useStored` re-establishes against the new one.
 * Without that, the app signs in and then quietly keeps reading the browser's
 * own storage.
 */
export function activateSharedStore(name: string | null): void {
  adapter = new ApiAdapter()
  serverInfo = { ...serverInfo, authenticated: true, name }
  window.dispatchEvent(new CustomEvent('ntp:store-changed'))
}

export const server = (): ServerInfo => serverInfo

/** The adapter in use: the shared API when available, browser storage otherwise. */
export function store(): StoreAdapter {
  return adapter
}

export const STORE_KEYS = {
  overrides: 'overrides.v1',
  expenses: 'expenses.v1',
  taxes: 'taxes.v1',
  profiles: 'tenantProfiles.v1',
  payments: 'payments.v1',
  collection: 'collection.v1',
  assets: 'assets.v1',
  trust: 'trust.v1',
} as const
