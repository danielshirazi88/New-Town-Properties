/**
 * Expense ledger.
 *
 * Expense records live in localStorage (small, synchronous, easy to export);
 * receipt and invoice files live in IndexedDB, which has no practical size limit
 * and stores Blobs directly. Both are per-browser and never leave the machine —
 * there is no server in this application.
 *
 * Everything is exportable to CSV and JSON so the ledger is never trapped here.
 */

export const EXPENSE_CATEGORIES = [
  'Appliances',
  'Structural work',
  'Contractor work',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Roofing',
  'Landscaping & snow',
  'Cleaning & janitorial',
  'Pest control',
  'Utilities',
  'Insurance',
  'Property taxes',
  'Management fees',
  'Legal & professional',
  'Leasing & marketing',
  'Permits & licenses',
  'Security',
  'Tenant improvement',
  'Other',
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

/**
 * Operating expenses reduce NOI; capital expenditures do not — they are
 * depreciated against the asset instead. Keeping them apart is what makes the
 * NOI on the Valuation view defensible rather than merely arithmetic.
 */
export type ExpenseKind = 'operating' | 'capital'

/** Categories that are ordinarily capitalised rather than expensed. */
export const CAPITAL_LEANING: ExpenseCategory[] = [
  'Structural work',
  'Roofing',
  'Tenant improvement',
  'Appliances',
]

export interface ReceiptMeta {
  id: string
  name: string
  type: string
  size: number
  addedAt: string
}

export interface Expense {
  id: string
  propertyId: string
  date: string
  category: ExpenseCategory
  kind: ExpenseKind
  vendor: string
  amount: number
  description: string
  /** Unit or suite the work applies to, when it is not building-wide. */
  unit?: string
  receipts: ReceiptMeta[]
  createdAt: string
}

const LS_KEY = 'ntp.expenses.v1'
const DB_NAME = 'ntp-receipts'
const DB_STORE = 'files'

/**
 * Whether this browser will actually persist anything. Safari blocks both
 * localStorage and IndexedDB on a `file://` origin, so a page opened straight
 * from disk can display fine and still silently drop every expense entered.
 * The Expenses view checks this and says so rather than pretending it saved.
 */
export function storageAvailable(): boolean {
  try {
    const probe = '__ntp_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

export function loadExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveExpenses(expenses: Expense[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(expenses))
  } catch (err) {
    console.error('Could not save expenses', err)
  }
}

export const newId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`

/* ── Receipt storage (IndexedDB) ─────────────────────────────────────────── */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function putReceipt(id: string, file: Blob): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).put(file, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function getReceipt(id: string): Promise<Blob | undefined> {
  const db = await openDb()
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly')
    const req = tx.objectStore(DB_STORE).get(id)
    req.onsuccess = () => resolve(req.result as Blob | undefined)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return blob
}

export async function deleteReceipt(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite')
    tx.objectStore(DB_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

/** Open a stored receipt in a new tab. */
export async function openReceipt(meta: ReceiptMeta): Promise<void> {
  const blob = await getReceipt(meta.id)
  if (!blob) {
    alert('That receipt is no longer stored in this browser.')
    return
  }
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export const humanSize = (bytes: number): string =>
  bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : bytes >= 1024 ? `${Math.round(bytes / 1024)} KB`
    : `${bytes} B`

/* ── Rollups ─────────────────────────────────────────────────────────────── */

export interface ExpenseRollup {
  total: number
  operating: number
  capital: number
  count: number
  byCategory: { category: string; amount: number; count: number }[]
  byMonth: number[]
}

export function rollup(expenses: Expense[], year?: number): ExpenseRollup {
  const scoped = year === undefined
    ? expenses
    : expenses.filter((e) => new Date(e.date + 'T00:00:00').getFullYear() === year)

  const byCategory = new Map<string, { amount: number; count: number }>()
  const byMonth = new Array(12).fill(0)

  for (const e of scoped) {
    const cur = byCategory.get(e.category) ?? { amount: 0, count: 0 }
    byCategory.set(e.category, { amount: cur.amount + e.amount, count: cur.count + 1 })
    const m = new Date(e.date + 'T00:00:00').getMonth()
    if (m >= 0 && m < 12) byMonth[m] += e.amount
  }

  return {
    total: scoped.reduce((a, e) => a + e.amount, 0),
    operating: scoped.filter((e) => e.kind === 'operating').reduce((a, e) => a + e.amount, 0),
    capital: scoped.filter((e) => e.kind === 'capital').reduce((a, e) => a + e.amount, 0),
    count: scoped.length,
    byCategory: [...byCategory.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.amount - a.amount),
    byMonth,
  }
}

/* ── Export ──────────────────────────────────────────────────────────────── */

const csvCell = (v: unknown): string => {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function expensesToCsv(expenses: Expense[], propertyName: (id: string) => string): string {
  const header = [
    'Date', 'Property', 'Unit', 'Category', 'Type', 'Vendor', 'Amount', 'Description', 'Receipts',
  ]
  const rows = expenses.map((e) => [
    e.date,
    propertyName(e.propertyId),
    e.unit ?? '',
    e.category,
    e.kind === 'capital' ? 'Capital' : 'Operating',
    e.vendor,
    e.amount.toFixed(2),
    e.description,
    e.receipts.map((r) => r.name).join('; '),
  ])
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
}

interface Saver {
  save(request: { filename: string; data: string }): Promise<unknown>
}

declare global {
  interface Window {
    claude?: { use?: (name: string) => Promise<unknown> }
  }
}

let saverPromise: Promise<Saver | null> | undefined

/**
 * When the page is running as a published Artifact, the viewer sandbox blocks a
 * plain anchor download; files have to go through the host's save prompt instead.
 * Resolve that namespace once if it exists, and fall back to the anchor everywhere
 * else (local dev, a normal static host, an opened file).
 */
function getSaver(): Promise<Saver | null> {
  const use = window.claude?.use
  if (!use) return Promise.resolve(null)
  if (!saverPromise) {
    saverPromise = Promise.resolve(use('downloads'))
      .then((ns) => {
        const s = ns as Saver | null
        return s && typeof s.save === 'function' ? s : null
      })
      .catch(() => null)
  }
  return saverPromise
}

function anchorDownload(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function download(filename: string, content: string, mime = 'text/csv'): Promise<void> {
  const saver = await getSaver()
  if (!saver) {
    anchorDownload(filename, content, mime)
    return
  }

  const code = (err: unknown): string =>
    typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : ''

  try {
    await saver.save({ filename, data: content })
    return
  } catch (err) {
    const c = code(err)
    // The viewer said no — that is an answer, not a failure to route around.
    if (c === 'declined' || c === 'rate_limited') return
    // .csv is not enabled for every viewer; the same text saves fine as .txt.
    if (c === 'extension_not_enabled' || c === 'rejected_extension') {
      try {
        await saver.save({ filename: filename.replace(/\.csv$/i, '.txt'), data: content })
        return
      } catch (retryErr) {
        if (code(retryErr) === 'declined') return
      }
    }
  }
  anchorDownload(filename, content, mime)
}
