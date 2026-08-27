import type { Lease, MonthCell, Property } from './types'

export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** The date all "time remaining" figures are measured from. */
export const AS_OF = new Date()

/** Numeric value of a month cell; vacancies and free months collect nothing. */
export const cellAmount = (c: MonthCell): number => (typeof c === 'number' ? c : 0)

export const isVacant = (c: MonthCell): boolean => c === 'V'
export const isFree = (c: MonthCell): boolean => c === 'FREE'
/** A month the sheet does not cover — a part-year rent roll, not a vacancy. */
export const isUnreported = (c: MonthCell): boolean => c === 'NR'
/**
 * A month where nothing was collected, whether from vacancy or a concession.
 * An unreported month is not dark: nobody lost rent, the sheet just stops.
 */
export const isDark = (c: MonthCell): boolean => c === 'V' || c === 'FREE'

/** Sum of the twelve month cells — what the tenant actually paid in 2025. */
export const collected = (l: Lease): number => l.months.reduce<number>((a, m) => a + cellAmount(m), 0)

/**
 * The rent a dark month would have earned, imputed from the nearest month that
 * did collect. Looks forward first (a unit re-let usually resumes at the new
 * rate), then backward. Returns 0 for a lease that never collected anything.
 */
export function imputedRate(l: Lease, index: number): number {
  for (let i = index + 1; i < l.months.length; i++) {
    if (!isDark(l.months[i]) && !isUnreported(l.months[i])) return cellAmount(l.months[i])
  }
  for (let i = index - 1; i >= 0; i--) {
    if (!isDark(l.months[i]) && !isUnreported(l.months[i])) return cellAmount(l.months[i])
  }
  return 0
}

/** Rent forgone across every vacant month, valued at the imputed rate. */
export function vacancyLoss(l: Lease): number {
  return l.months.reduce<number>((a, m, i) => (isVacant(m) ? a + imputedRate(l, i) : a), 0)
}

/** Rent given away as free-rent concessions, valued at the imputed rate. */
export function concessionLoss(l: Lease): number {
  return l.months.reduce<number>((a, m, i) => (isFree(m) ? a + imputedRate(l, i) : a), 0)
}

export const vacantMonths = (l: Lease): number => l.months.filter(isVacant).length
export const freeMonths = (l: Lease): number => l.months.filter(isFree).length
export const darkMonths = (l: Lease): number => l.months.filter(isDark).length

/** Gross potential rent: what the year would have produced with no downtime. */
export function grossPotential(l: Lease): number {
  return collected(l) + vacancyLoss(l) + concessionLoss(l)
}

/** First and last months that actually collected, used to measure the real bump. */
export function firstRate(l: Lease): number {
  const m = l.months.find((c) => !isDark(c) && !isUnreported(c))
  return m === undefined ? 0 : cellAmount(m)
}
export function lastRate(l: Lease): number {
  for (let i = l.months.length - 1; i >= 0; i--) {
    if (!isDark(l.months[i]) && !isUnreported(l.months[i])) return cellAmount(l.months[i])
  }
  return 0
}

/** Months the sheet actually covers — 12 for a full year, fewer part-way through one. */
export const reportedMonths = (l: Lease): number => l.months.filter((m) => !isUnreported(m)).length

/**
 * Rent per square foot per year, the standard way to compare a rent to the
 * market. Annualised from the exit rate so a part-year sheet still compares.
 * Returns undefined where there is no square footage or the income is not rent.
 */
export function rentPerSqFt(l: Lease): number | undefined {
  if (!l.squareFeet || l.squareFeet <= 0) return undefined
  if (l.incomeType && l.incomeType !== 'rent') return undefined
  const annual = lastRate(l) * 12
  return annual > 0 ? annual / l.squareFeet : undefined
}

/**
 * The escalation the landlord actually realised over the year, as a percentage.
 * Compared against `statedEscalationPct` this exposes bumps that were contracted
 * but never taken.
 */
export function realisedEscalationPct(l: Lease): number | undefined {
  const a = firstRate(l)
  const b = lastRate(l)
  if (a <= 0 || b <= 0) return undefined
  return ((b - a) / a) * 100
}

/** Monthly rent as at December — the rate the portfolio carries into next year. */
export const exitRate = (l: Lease): number => lastRate(l)

/** December rate × 12: the forward-looking run rate, versus what 2025 actually billed. */
export const runRate = (l: Lease): number => exitRate(l) * 12

export const parseDate = (iso?: string): Date | undefined => (iso ? new Date(iso + 'T00:00:00') : undefined)

/** Whole months between now and lease expiry. Negative once a lease has run out. */
export function monthsRemaining(l: Lease, asOf: Date = AS_OF): number | undefined {
  const end = parseDate(l.leaseEnd)
  if (!end) return undefined
  return (end.getFullYear() - asOf.getFullYear()) * 12 + (end.getMonth() - asOf.getMonth())
}

export function isExpired(l: Lease, asOf: Date = AS_OF): boolean {
  const end = parseDate(l.leaseEnd)
  return end ? end < asOf : false
}

/** A lease still collecting rent past its stated expiry. */
export function isHoldover(l: Lease, asOf: Date = AS_OF): boolean {
  return isExpired(l, asOf) && collected(l) > 0
}

export const hasNoEndDate = (l: Lease): boolean => !l.leaseEnd
export const isFullyVacant = (l: Lease): boolean => collected(l) === 0

export function leaseTermMonths(l: Lease): number | undefined {
  const s = parseDate(l.leaseStart)
  const e = parseDate(l.leaseEnd)
  if (!s || !e) return undefined
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
}

/** Years the tenant has been in place, measured from lease commencement. */
export function tenancyYears(l: Lease, asOf: Date = AS_OF): number | undefined {
  const s = parseDate(l.leaseStart)
  if (!s) return undefined
  return (asOf.getTime() - s.getTime()) / (365.25 * 24 * 3600 * 1000)
}

/**
 * Weighted average lease term, in years, weighted by each lease's annual rent.
 * Leases with no expiry are excluded from both sides of the ratio.
 */
export function walt(leases: Lease[], asOf: Date = AS_OF): number {
  let weighted = 0
  let weight = 0
  for (const l of leases) {
    const m = monthsRemaining(l, asOf)
    if (m === undefined) continue
    const rent = collected(l)
    if (rent <= 0) continue
    weighted += Math.max(0, m) * rent
    weight += rent
  }
  return weight === 0 ? 0 : weighted / weight / 12
}

/**
 * WALT counting only leases that have not yet run out. Read alongside `walt`,
 * which scores an expired lease as zero term remaining: the gap between the two
 * is a direct measure of how much rent is sitting on holdover.
 */
export function waltActiveOnly(leases: Lease[], asOf: Date = AS_OF): number {
  return walt(leases.filter((l) => !isExpired(l, asOf)), asOf)
}

/** Twelve monthly totals across an arbitrary set of leases. */
export function monthlySeries(leases: Lease[]): number[] {
  const out = new Array(12).fill(0)
  for (const l of leases) {
    l.months.forEach((m, i) => {
      out[i] += cellAmount(m)
    })
  }
  return out
}

export interface PropertyMetrics {
  property: Property
  leases: Lease[]
  unitCount: number
  occupiedUnits: number
  vacantUnits: number
  /** Share of units generating rent. */
  physicalOccupancyPct: number
  /** Collected rent as a share of gross potential rent. */
  economicOccupancyPct: number
  collected: number
  grossPotential: number
  vacancyLoss: number
  concessionLoss: number
  darkMonths: number
  taxBill: number
  netAfterTax: number
  /** Taxes as a share of gross income. */
  taxLoadPct: number
  monthly: number[]
  runRate: number
  exitMonthlyRent: number
  walt: number
  expiredCount: number
  expiringNext12: number
  rentAtRiskNext12: number
  largestTenant?: { tenant: string; rent: number; sharePct: number }
  avgStatedEscalationPct?: number
  avgRealisedEscalationPct?: number
  /** Share of the whole portfolio's collected rent. */
  portfolioSharePct: number

  // ── Square footage ───────────────────────────────────────────────────────
  /** Rentable area recorded across the property's units. */
  squareFeet: number
  /** Area under a paying tenant. */
  leasedSquareFeet: number
  vacantSquareFeet: number
  /** Share of recorded area that is let. The honest occupancy measure. */
  occupancyBySqFtPct: number
  /** Annualised rent divided by leased area — comparable to the market. */
  rentPerSqFt: number
  /** How much of the property's area carries no recorded size. */
  unmeasuredUnits: number
}

export function propertyMetrics(
  property: Property,
  allLeases: Lease[],
  portfolioCollected: number,
  asOf: Date = AS_OF,
): PropertyMetrics {
  const leases = allLeases.filter((l) => l.propertyId === property.id)
  const col = leases.reduce((a, l) => a + collected(l), 0)
  const pot = leases.reduce((a, l) => a + grossPotential(l), 0)
  const vac = leases.reduce((a, l) => a + vacancyLoss(l), 0)
  const con = leases.reduce((a, l) => a + concessionLoss(l), 0)
  const occupied = leases.filter((l) => !isFullyVacant(l)).length

  // Square footage is only meaningful for space that is actually let by area —
  // a billboard ground lease, a parking row and a seller-financing note all
  // carry income but no floor space, and folding them in would distort the rate.
  const measurable = leases.filter((l) => (l.incomeType ?? 'rent') === 'rent')
  const sqFt = measurable.reduce((a, l) => a + (l.squareFeet ?? 0), 0)
  const leasedSqFt = measurable
    .filter((l) => lastRate(l) > 0)
    .reduce((a, l) => a + (l.squareFeet ?? 0), 0)
  const annualisedLeasedRent = measurable
    .filter((l) => l.squareFeet && lastRate(l) > 0)
    .reduce((a, l) => a + lastRate(l) * 12, 0)

  const stated = leases.map((l) => l.statedEscalationPct).filter((n): n is number => n !== undefined)
  const realised = leases.map((l) => realisedEscalationPct(l)).filter((n): n is number => n !== undefined)

  const ranked = [...leases].sort((a, b) => collected(b) - collected(a))
  const top = ranked[0]

  const expiring12 = leases.filter((l) => {
    const m = monthsRemaining(l, asOf)
    return m !== undefined && m >= 0 && m <= 12
  })

  // Apollo reports an annual gross only; spread it evenly so it still charts.
  const isAnnualOnly = leases.length === 0 && property.statedGross > 0
  const collectedFinal = isAnnualOnly ? property.statedGross : col
  const monthly = isAnnualOnly
    ? new Array(12).fill(property.statedGross / 12)
    : monthlySeries(leases)

  return {
    property,
    leases,
    unitCount: leases.length,
    occupiedUnits: occupied,
    vacantUnits: leases.length - occupied,
    physicalOccupancyPct: leases.length ? (occupied / leases.length) * 100 : 100,
    economicOccupancyPct: pot > 0 ? (col / pot) * 100 : 100,
    collected: collectedFinal,
    grossPotential: isAnnualOnly ? property.statedGross : pot,
    vacancyLoss: vac,
    concessionLoss: con,
    darkMonths: leases.reduce((a, l) => a + darkMonths(l), 0),
    taxBill: property.taxBill,
    netAfterTax: collectedFinal - property.taxBill,
    taxLoadPct: collectedFinal > 0 ? (property.taxBill / collectedFinal) * 100 : 0,
    monthly,
    runRate: isAnnualOnly
      ? property.statedGross
      : leases.reduce((a, l) => a + runRate(l), 0),
    exitMonthlyRent: isAnnualOnly
      ? property.statedGross / 12
      : leases.reduce((a, l) => a + exitRate(l), 0),
    walt: walt(leases, asOf),
    expiredCount: leases.filter((l) => isExpired(l, asOf)).length,
    expiringNext12: expiring12.length,
    rentAtRiskNext12: expiring12.reduce((a, l) => a + collected(l), 0),
    largestTenant: top
      ? { tenant: top.tenant, rent: collected(top), sharePct: col > 0 ? (collected(top) / col) * 100 : 0 }
      : undefined,
    avgStatedEscalationPct: stated.length ? stated.reduce((a, b) => a + b, 0) / stated.length : undefined,
    avgRealisedEscalationPct: realised.length ? realised.reduce((a, b) => a + b, 0) / realised.length : undefined,
    portfolioSharePct: portfolioCollected > 0 ? (collectedFinal / portfolioCollected) * 100 : 0,

    squareFeet: sqFt,
    leasedSquareFeet: leasedSqFt,
    vacantSquareFeet: sqFt - leasedSqFt,
    occupancyBySqFtPct: sqFt > 0 ? (leasedSqFt / sqFt) * 100 : 0,
    rentPerSqFt: leasedSqFt > 0 ? annualisedLeasedRent / leasedSqFt : 0,
    unmeasuredUnits: measurable.filter((l) => !l.squareFeet).length,
  }
}

/** Value implied by capitalising net operating income. */
export const valueAtCap = (noi: number, capRatePct: number): number =>
  capRatePct > 0 ? noi / (capRatePct / 100) : 0

/** Herfindahl index over tenant rents — a 0–1 read on concentration risk. */
export function herfindahl(shares: number[]): number {
  const total = shares.reduce((a, b) => a + b, 0)
  if (total <= 0) return 0
  return shares.reduce((a, s) => a + Math.pow(s / total, 2), 0)
}
