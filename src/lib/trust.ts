/**
 * The trust's schedule of assets, and the edit layer over it.
 *
 * The schedule as transcribed is immutable — it is a document, and a document
 * does not change because someone corrects a number. Edits are stored as patches
 * against it, exactly as the rent roll's overrides work, so every change can be
 * seen, reversed, and told apart from what the paper actually says.
 */

/** How a holding earns, or doesn't. */
export type HoldingUse = 'rental' | 'personal' | 'resale' | 'note'

export const USE_LABEL: Record<HoldingUse, string> = {
  rental: 'Rental',
  personal: 'Personal',
  resale: 'Held for resale',
  note: 'Seller-financed note',
}

/**
 * A property sold on seller financing.
 *
 * What the trust holds afterwards is not the building — it is the buyer's
 * promise to pay. That is worth the balance outstanding, not whatever the
 * building would capitalise at, and the distinction is the difference between
 * an asset that can go vacant and one that can default.
 */
export interface SellerNote {
  soldDate: string
  buyer?: string
  /** Principal outstanding. */
  balance: number
  monthlyPayment?: number
  /** When the balloon falls due. */
  maturityDate?: string
  note?: string
}

export interface TrustHolding {
  id: string
  /** Row number on the schedule, so the app's order can be traced to the paper. */
  seq: number
  purchaseDate: string
  address: string
  /** The description written on the schedule, kept verbatim. */
  propertyType: string
  purchasePrice?: number
  use: HoldingUse
  /** Links to a portfolio building, where the rent roll has one. */
  propertyId?: string
  note?: string
  /**
   * Set where the handwriting is legible but the figure looks wrong. The value
   * is still recorded as written — this is the reason to check it, shown beside
   * the number rather than resolved silently.
   */
  needsConfirmation?: string
  /** Present once the property has been sold on seller financing. */
  sellerNote?: SellerNote
}

/** A hand edit. Every field the schedule carries can be corrected. */
export interface TrustEdit {
  purchaseDate?: string
  address?: string
  propertyType?: string
  purchasePrice?: number
  use?: HoldingUse
  /** What it is thought to be worth now — the column the schedule asks for. */
  estimatedValue?: number
  /** Debt outstanding against the holding. */
  debt?: number
  note?: string
  updatedAt?: string
}

export interface TrustState {
  /** Patches over the transcribed schedule, by holding id. */
  edits: Record<string, TrustEdit>
  /** Holdings typed in that are not on the schedule. */
  added: TrustHolding[]
  /** Schedule rows struck out — kept as ids so the row can come back. */
  removed: string[]
}

export const EMPTY_TRUST_STATE: TrustState = { edits: {}, added: [], removed: [] }

export const newHoldingId = (): string =>
  `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

/** A holding with its edits applied and its value worked out. */
export interface ResolvedHolding extends TrustHolding {
  estimatedValue?: number
  debt?: number
  /** True when the value came from the portfolio rather than being typed. */
  valueFromPortfolio: boolean
  /** Which fields have been changed by hand. */
  editedFields: (keyof TrustEdit)[]
  /** Not on the transcribed schedule — added afterwards. */
  isAdded: boolean
}

/**
 * Apply the edit layer, then work out what each holding is worth.
 *
 * A rental building's value comes from the portfolio — its own net income
 * capitalised — unless someone has typed a figure over it. A typed value always
 * wins: an owner who has had a building appraised knows more than a cap rate
 * does. Everything else has no value until someone enters one.
 */
export function resolveTrust(
  holdings: TrustHolding[],
  state: TrustState = EMPTY_TRUST_STATE,
  portfolioValue: (propertyId: string) => number | undefined = () => undefined,
): ResolvedHolding[] {
  const removed = new Set(state.removed)
  const rows: { h: TrustHolding; isAdded: boolean }[] = [
    ...holdings.filter((h) => !removed.has(h.id)).map((h) => ({ h, isAdded: false })),
    ...state.added.map((h) => ({ h, isAdded: true })),
  ]

  return rows.map(({ h, isAdded }) => {
    const e = state.edits[h.id] ?? {}
    const editedFields = (Object.keys(e) as (keyof TrustEdit)[])
      .filter((key) => key !== 'updatedAt' && e[key] !== undefined)

    const merged: TrustHolding = {
      ...h,
      purchaseDate: e.purchaseDate ?? h.purchaseDate,
      address: e.address ?? h.address,
      propertyType: e.propertyType ?? h.propertyType,
      purchasePrice: e.purchasePrice ?? h.purchasePrice,
      use: e.use ?? h.use,
      note: e.note ?? h.note,
    }

    // A property sold on seller financing is worth the balance outstanding.
    // Capitalising its old net income would value a building the trust no longer
    // owns, and would double-count against the note it was exchanged for.
    const fromPortfolio = merged.sellerNote || !merged.propertyId
      ? undefined
      : portfolioValue(merged.propertyId)
    const estimatedValue = e.estimatedValue ?? fromPortfolio ?? merged.sellerNote?.balance

    return {
      ...merged,
      estimatedValue,
      debt: e.debt,
      valueFromPortfolio: e.estimatedValue === undefined && fromPortfolio !== undefined,
      editedFields,
      isAdded,
    }
  }).sort((a, b) => a.seq - b.seq)
}

export const editCountFor = (state: TrustState): number =>
  Object.values(state.edits).reduce(
    (a, e) => a + Object.keys(e).filter((k) => k !== 'updatedAt').length, 0,
  ) + state.added.length + state.removed.length

/* ── Totals ──────────────────────────────────────────────────────────────── */

export interface TrustTotals {
  count: number
  purchaseTotal: number
  /** Holdings with no purchase price on the schedule. */
  withoutPrice: number
  valueTotal: number
  /** Holdings with no value from either the portfolio or a typed figure. */
  withoutValue: number
  debt: number
  /** Value less debt. */
  equity: number
  /**
   * Gain against cost, counting only holdings that have both figures. Mixing in
   * a holding with a price but no value would read as a total loss on it.
   */
  comparableCost: number
  comparableValue: number
  byUse: Record<HoldingUse, { count: number; purchase: number; value: number }>
}

export function trustTotals(rows: ResolvedHolding[]): TrustTotals {
  const byUse: TrustTotals['byUse'] = {
    rental: { count: 0, purchase: 0, value: 0 },
    personal: { count: 0, purchase: 0, value: 0 },
    resale: { count: 0, purchase: 0, value: 0 },
    note: { count: 0, purchase: 0, value: 0 },
  }

  let purchaseTotal = 0
  let valueTotal = 0
  let debt = 0
  let withoutPrice = 0
  let withoutValue = 0
  let comparableCost = 0
  let comparableValue = 0

  for (const r of rows) {
    const price = r.purchasePrice ?? 0
    const value = r.estimatedValue ?? 0
    if (r.purchasePrice === undefined) withoutPrice += 1
    if (r.estimatedValue === undefined) withoutValue += 1
    if (r.purchasePrice !== undefined && r.estimatedValue !== undefined) {
      comparableCost += r.purchasePrice
      comparableValue += r.estimatedValue
    }
    purchaseTotal += price
    valueTotal += value
    debt += r.debt ?? 0
    byUse[r.use].count += 1
    byUse[r.use].purchase += price
    byUse[r.use].value += value
  }

  return {
    count: rows.length,
    purchaseTotal,
    withoutPrice,
    valueTotal,
    withoutValue,
    debt,
    equity: valueTotal - debt,
    comparableCost,
    comparableValue,
    byUse,
  }
}

/** Years held, to one decimal. */
export function yearsHeld(h: { purchaseDate: string }, asOf: Date = new Date()): number | undefined {
  const d = new Date(`${h.purchaseDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return undefined
  return (asOf.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000)
}

/**
 * Compound annual growth from purchase price to today's value.
 *
 * Undefined unless both figures exist and the holding has been owned long enough
 * for the number to mean anything — an annualised return over four months is
 * arithmetic, not information.
 */
export function annualisedGrowth(h: ResolvedHolding, asOf: Date = new Date()): number | undefined {
  const years = yearsHeld(h, asOf)
  if (!h.purchasePrice || !h.estimatedValue || years === undefined || years < 1) return undefined
  return ((h.estimatedValue / h.purchasePrice) ** (1 / years) - 1) * 100
}

/** Days until a note's balloon falls due. Negative once it has passed. */
export function daysToBalloon(n: SellerNote, asOf: Date = new Date()): number | undefined {
  if (!n.maturityDate) return undefined
  const due = new Date(`${n.maturityDate}T00:00:00`)
  if (Number.isNaN(due.getTime())) return undefined
  const day = 86_400_000
  const atMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((atMidnight(due).getTime() - atMidnight(asOf).getTime()) / day)
}

/**
 * The rate a note is running at, implied by its payment and balance.
 *
 * Only meaningful as a sanity check on the terms — a payment that does not even
 * cover the interest means the balance is growing, which is worth knowing before
 * the balloon arrives.
 */
export function impliedNoteRate(n: SellerNote): number | undefined {
  if (!n.monthlyPayment || n.balance <= 0) return undefined
  return (n.monthlyPayment * 12 / n.balance) * 100
}
