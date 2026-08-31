/**
 * The asset register — everything owned, not just the buildings that pay rent.
 *
 * Three kinds of thing sit here, and they are genuinely different: real estate
 * (some of it rented, some of it lived in), interest-bearing deposits with a
 * bank, and vehicles. Each carries the fields that matter for its own kind
 * rather than a lowest common denominator, and each is entered by hand — none of
 * it comes off a rent roll or a tax return.
 *
 * Rental buildings are the exception: those are already in the portfolio, so the
 * register reads their value from there instead of asking anyone to retype it.
 */

export type AssetClass = 'real-estate' | 'investment' | 'vehicle'

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  'real-estate': 'Real estate',
  investment: 'Investments',
  vehicle: 'Vehicles',
}

/* ── Real estate ─────────────────────────────────────────────────────────── */

export type RealEstateUse = 'rental' | 'personal'

export interface RealEstateAsset {
  id: string
  kind: 'real-estate'
  name: string
  address?: string
  use: RealEstateUse
  /**
   * Set when this row is one of the portfolio's own buildings. The value then
   * comes from the valuation model rather than being typed, so the register and
   * the portfolio can never drift apart.
   */
  propertyId?: string
  /** Hand-entered value. Ignored when `propertyId` is set. */
  estimatedValue?: number
  purchasePrice?: number
  purchaseDate?: string
  /** Outstanding mortgage or note, if any. */
  debt?: number
  notes?: string
  updatedAt?: string
}

/* ── Investments ─────────────────────────────────────────────────────────── */

export type InvestmentKind = 'money-market' | 'cd' | 'savings' | 'checking' | 'treasury' | 'brokerage' | 'other'

export const INVESTMENT_KINDS: { id: InvestmentKind; label: string }[] = [
  { id: 'cd', label: 'Certificate of deposit' },
  { id: 'money-market', label: 'Money market' },
  { id: 'savings', label: 'Savings' },
  { id: 'checking', label: 'Checking' },
  { id: 'treasury', label: 'Treasury' },
  { id: 'brokerage', label: 'Brokerage' },
  { id: 'other', label: 'Other' },
]

export const investmentKindLabel = (k?: InvestmentKind): string =>
  INVESTMENT_KINDS.find((x) => x.id === k)?.label ?? 'Other'

/** How often a deposit pays out. */
export type InterestFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'at-maturity'

export const INTEREST_FREQUENCIES: { id: InterestFrequency; label: string; perYear: number }[] = [
  { id: 'monthly', label: 'Monthly', perYear: 12 },
  { id: 'quarterly', label: 'Quarterly', perYear: 4 },
  { id: 'semiannual', label: 'Every six months', perYear: 2 },
  { id: 'annual', label: 'Annually', perYear: 1 },
  { id: 'at-maturity', label: 'At maturity', perYear: 0 },
]

export const frequencyLabel = (f?: InterestFrequency): string =>
  INTEREST_FREQUENCIES.find((x) => x.id === f)?.label ?? '—'

export interface InvestmentAsset {
  id: string
  kind: 'investment'
  /** What the account is called, e.g. "13-month CD". */
  name: string
  /** The bank or brokerage holding it. */
  institution: string
  investmentKind: InvestmentKind
  /** Current balance. */
  balance: number
  /** Annual percentage rate as written on the statement, e.g. 4.85. */
  ratePct?: number
  interestFrequency?: InterestFrequency
  /** When interest was last credited, or the next date it is due. */
  nextInterestDate?: string
  openedDate?: string
  maturityDate?: string
  /** Last four digits only — never the full account number. */
  accountLast4?: string
  notes?: string
  updatedAt?: string
}

/* ── Vehicles ────────────────────────────────────────────────────────────── */

export interface VehicleAsset {
  id: string
  kind: 'vehicle'
  /** Display name, e.g. "2021 Mercedes S580". */
  name: string
  year?: number
  make?: string
  model?: string
  vin?: string
  purchasePrice?: number
  purchaseDate?: string
  /** Dealer or private party the car was bought from. */
  purchasedFrom?: string
  currentMiles?: number
  currentValue?: number
  /** Plate, insurer, where it is kept — whatever is worth remembering. */
  plate?: string
  notes?: string
  updatedAt?: string
}

export type Asset = RealEstateAsset | InvestmentAsset | VehicleAsset

export interface AssetRegister {
  realEstate: RealEstateAsset[]
  investments: InvestmentAsset[]
  vehicles: VehicleAsset[]
}

export const EMPTY_REGISTER: AssetRegister = { realEstate: [], investments: [], vehicles: [] }

export const newAssetId = (): string =>
  `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/* ── Money ───────────────────────────────────────────────────────────────── */

/**
 * What a vehicle is worth today.
 *
 * A car with no stated current value is worth nothing to a net-worth figure
 * until someone says otherwise — guessing depreciation off the purchase price
 * would put an invented number into a total that has to be trustworthy.
 */
export const vehicleValue = (v: VehicleAsset): number => v.currentValue ?? 0

/** Whether a vehicle's worth is known at all, as against known to be zero. */
export const vehicleValued = (v: VehicleAsset): boolean => v.currentValue !== undefined

/**
 * Interest a deposit throws off in a year at its stated rate.
 *
 * Simple interest on the current balance — not compounded, because a CD paying
 * out monthly into a different account does not compound, and the difference
 * over one year is small next to the uncertainty in the balance itself.
 */
export const annualInterest = (i: InvestmentAsset): number =>
  i.ratePct === undefined ? 0 : i.balance * (i.ratePct / 100)

export const registerInterest = (r: AssetRegister): number =>
  r.investments.reduce((a, i) => a + annualInterest(i), 0)

/** Weighted average rate across everything earning interest. */
export function blendedRate(r: AssetRegister): number | undefined {
  const rated = r.investments.filter((i) => i.ratePct !== undefined && i.balance > 0)
  const principal = rated.reduce((a, i) => a + i.balance, 0)
  if (principal <= 0) return undefined
  return (rated.reduce((a, i) => a + annualInterest(i), 0) / principal) * 100
}

/* ── Maturities ──────────────────────────────────────────────────────────── */

export interface Maturity {
  investment: InvestmentAsset
  date: Date
  daysAway: number
  /** True once the maturity date has passed. */
  matured: boolean
}

const MS_PER_DAY = 86_400_000
const atMidnight = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/**
 * Everything with a maturity date, soonest first.
 *
 * A CD coming due is a decision — roll it, move it, or spend it — and one that
 * has already matured is usually sitting in a low-rate sweep account losing to
 * whatever it could be re-bought at. Both are worth seeing before the fact.
 */
export function maturities(r: AssetRegister, asOf: Date = new Date()): Maturity[] {
  const today = atMidnight(asOf)
  return r.investments
    .filter((i) => i.maturityDate)
    .map((i) => {
      const date = new Date(`${i.maturityDate}T00:00:00`)
      const daysAway = Math.round((atMidnight(date).getTime() - today.getTime()) / MS_PER_DAY)
      return { investment: i, date, daysAway, matured: daysAway < 0 }
    })
    .filter((m) => !Number.isNaN(m.date.getTime()))
    .sort((a, b) => a.daysAway - b.daysAway)
}

/* ── Totals ──────────────────────────────────────────────────────────────── */

export interface AssetTotals {
  realEstate: number
  rentalRealEstate: number
  personalRealEstate: number
  investments: number
  vehicles: number
  gross: number
  debt: number
  /** Gross less the debt recorded against real estate. */
  net: number
  /** Vehicles with no current value entered — excluded from every total above. */
  unvaluedVehicles: number
  /** Real estate rows with neither a portfolio value nor a typed one. */
  unvaluedRealEstate: number
}

/**
 * Add the register up.
 *
 * `propertyValue` supplies the worth of a portfolio building, so the register
 * never holds a second, staler opinion of what the commercial estate is worth.
 * Anything with no value on it is counted as zero and reported separately — a
 * total that quietly swallowed the unknowns would read as complete when it is
 * not.
 */
export function assetTotals(
  r: AssetRegister,
  propertyValue: (propertyId: string) => number | undefined,
): AssetTotals {
  let rental = 0
  let personal = 0
  let unvaluedRealEstate = 0
  for (const re of r.realEstate) {
    const value = re.propertyId ? propertyValue(re.propertyId) : re.estimatedValue
    if (value === undefined) unvaluedRealEstate += 1
    const v = value ?? 0
    if (re.use === 'rental') rental += v
    else personal += v
  }

  const investments = r.investments.reduce((a, i) => a + i.balance, 0)
  const vehicles = r.vehicles.reduce((a, v) => a + vehicleValue(v), 0)
  const debt = r.realEstate.reduce((a, re) => a + (re.debt ?? 0), 0)
  const realEstate = rental + personal
  const gross = realEstate + investments + vehicles

  return {
    realEstate,
    rentalRealEstate: rental,
    personalRealEstate: personal,
    investments,
    vehicles,
    gross,
    debt,
    net: gross - debt,
    unvaluedVehicles: r.vehicles.filter((v) => !vehicleValued(v)).length,
    unvaluedRealEstate,
  }
}

/** The breakdown a chart needs: one slice per class, largest first. */
export function assetBreakdown(t: AssetTotals): { id: string; label: string; value: number }[] {
  return [
    { id: 'rental', label: 'Rental real estate', value: t.rentalRealEstate },
    { id: 'personal', label: 'Personal real estate', value: t.personalRealEstate },
    { id: 'investments', label: 'Investments', value: t.investments },
    { id: 'vehicles', label: 'Vehicles', value: t.vehicles },
  ].filter((s) => s.value > 0).sort((a, b) => b.value - a.value)
}

/** Deposits grouped by the bank holding them. */
export function byInstitution(r: AssetRegister): {
  institution: string
  balance: number
  accounts: number
  interest: number
  rate?: number
}[] {
  const m = new Map<string, InvestmentAsset[]>()
  for (const i of r.investments) {
    const key = i.institution.trim() || 'Not recorded'
    m.set(key, [...(m.get(key) ?? []), i])
  }
  return [...m].map(([institution, list]) => {
    const balance = list.reduce((a, i) => a + i.balance, 0)
    const interest = list.reduce((a, i) => a + annualInterest(i), 0)
    const rated = list.filter((i) => i.ratePct !== undefined).reduce((a, i) => a + i.balance, 0)
    return {
      institution,
      balance,
      accounts: list.length,
      interest,
      rate: rated > 0 ? (interest / rated) * 100 : undefined,
    }
  }).sort((a, b) => b.balance - a.balance)
}
