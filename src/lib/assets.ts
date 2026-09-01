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

export type InvestmentKind =
  | 'money-market' | 'cd' | 'savings' | 'checking' | 'treasury' | 'mutual-fund'
  | 'brokerage' | 'other'

export const INVESTMENT_KINDS: { id: InvestmentKind; label: string }[] = [
  { id: 'cd', label: 'Certificate of deposit' },
  { id: 'money-market', label: 'Money market' },
  { id: 'savings', label: 'Savings' },
  { id: 'checking', label: 'Checking' },
  { id: 'treasury', label: 'Treasury' },
  { id: 'mutual-fund', label: 'Mutual fund' },
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
  investments: InvestmentAsset[]
  vehicles: VehicleAsset[]
  /**
   * Which batch of seeded accounts this register has already taken.
   *
   * Deposits arrive with the application rather than being typed in on every
   * device. A register saved before a batch existed would otherwise never see
   * it, and re-merging on every load would resurrect rows somebody deleted on
   * purpose — so the version is recorded once the merge has happened.
   */
  seedVersion?: number
  /**
   * Kept only so a register saved before the trust schedule existed still parses.
   * Property is read from the schedule now; anything left here is ignored.
   *
   * @deprecated
   */
  realEstate?: RealEstateAsset[]
}

export const EMPTY_REGISTER: AssetRegister = { investments: [], vehicles: [] }

export const newAssetId = (): string =>
  `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/* ── Seeding ─────────────────────────────────────────────────────────────── */

/** True when this register has not yet taken the current batch of deposits. */
export const needsSeed = (r: AssetRegister, version: number): boolean =>
  (r.seedVersion ?? 0) < version

/**
 * Merge seeded deposits into a register, once.
 *
 * Rows already present by id are left exactly as they are — an edited balance
 * must survive, or the seed would quietly overwrite a correction. Only genuinely
 * new ids are added, and the version is stamped so a row deleted afterwards
 * stays deleted.
 */
export function applySeed(
  r: AssetRegister, seeded: InvestmentAsset[], version: number,
): AssetRegister {
  if (!needsSeed(r, version)) return r
  const have = new Set(r.investments.map((i) => i.id))
  return {
    ...r,
    investments: [...r.investments, ...seeded.filter((i) => !have.has(i.id))],
    seedVersion: version,
  }
}

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

/* ── Shape of the deposits ───────────────────────────────────────────────── */

export interface MaturityBucket {
  /** `YYYY-MM`, so buckets sort naturally. */
  key: string
  /** "Oct 26". */
  label: string
  balance: number
  count: number
  /** Interest those accounts earn in a year at their stated rates. */
  interest: number
  /** True where the month is within the window a decision has to be made in. */
  soon: boolean
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * When the money comes free, month by month.
 *
 * Only months that actually hold something appear. Padding the gaps with empty
 * columns would spread five real bars across a year of whitespace and make the
 * clustering — which is the whole point — impossible to see.
 *
 * Anything without a maturity date is left out rather than counted as due now:
 * a mutual fund has no term, and putting it in the ladder would imply a decision
 * that does not exist.
 */
export function maturitySchedule(
  r: AssetRegister, asOf: Date = new Date(), soonDays = 90,
): MaturityBucket[] {
  const buckets = new Map<string, MaturityBucket>()
  for (const m of maturities(r, asOf)) {
    const d = m.date
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const row = buckets.get(key) ?? {
      key,
      label: `${SHORT_MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      balance: 0,
      count: 0,
      interest: 0,
      soon: false,
    }
    row.balance += m.investment.balance
    row.count += 1
    row.interest += annualInterest(m.investment)
    // A month counts as near if anything in it comes due inside the window.
    if (m.daysAway <= soonDays) row.soon = true
    buckets.set(key, row)
  }
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key))
}

export interface RateBand {
  ratePct: number
  balance: number
  count: number
  interest: number
}

/**
 * How much money sits at each rate.
 *
 * Rates are an ordered scale, so this is the one breakdown here that earns a
 * light-to-dark ramp: the bands have a natural sequence and the colour carries
 * it. Accounts with no stated rate — a mutual fund, say — are left out
 * entirely rather than banded at zero, which would invent a rate they do not
 * have and drag the picture down with it.
 */
export function byRate(r: AssetRegister): RateBand[] {
  const bands = new Map<number, RateBand>()
  for (const i of r.investments) {
    if (i.ratePct === undefined) continue
    const b = bands.get(i.ratePct) ?? { ratePct: i.ratePct, balance: 0, count: 0, interest: 0 }
    b.balance += i.balance
    b.count += 1
    b.interest += annualInterest(i)
    bands.set(i.ratePct, b)
  }
  return [...bands.values()].sort((a, b) => a.ratePct - b.ratePct)
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
 * What the trust's real estate contributes to the register.
 *
 * Property lives on the trust's schedule of assets, not here — one list of what
 * is owned, not two that can drift. This reduces it to the few figures the
 * register needs.
 */
export interface RealEstateContribution {
  rental: number
  personal: number
  /** Seller-financed notes — a receivable, not a building. */
  notes: number
  debt: number
  /** Holdings with no value from any source, counted as zero. */
  unvalued: number
}

export function realEstateTotals(rows: {
  use: 'rental' | 'personal' | 'resale' | 'note'
  estimatedValue?: number
  debt?: number
}[]): RealEstateContribution {
  let rental = 0
  let personal = 0
  let notes = 0
  let debt = 0
  let unvalued = 0
  for (const r of rows) {
    if (r.estimatedValue === undefined) unvalued += 1
    const v = r.estimatedValue ?? 0
    // A note is a receivable rather than property, and a holding kept for resale
    // is not let either — neither belongs in the rental estate.
    if (r.use === 'rental') rental += v
    else if (r.use === 'note') notes += v
    else personal += v
    debt += r.debt ?? 0
  }
  return { rental, personal, notes, debt, unvalued }
}

/**
 * Add the register up.
 *
 * Real estate is handed in from the trust schedule rather than read out of the
 * register, so there is only ever one opinion of what the property is worth.
 * Anything with no value on it is counted as zero and reported separately — a
 * total that quietly swallowed the unknowns would read as complete when it is
 * not.
 */
export function assetTotals(r: AssetRegister, property: RealEstateContribution): AssetTotals {
  const investments = r.investments.reduce((a, i) => a + i.balance, 0)
  const vehicles = r.vehicles.reduce((a, v) => a + vehicleValue(v), 0)
  const realEstate = property.rental + property.personal + property.notes
  const gross = realEstate + investments + vehicles

  return {
    realEstate,
    rentalRealEstate: property.rental,
    personalRealEstate: property.personal,
    investments,
    vehicles,
    gross,
    debt: property.debt,
    net: gross - property.debt,
    unvaluedVehicles: r.vehicles.filter((v) => !vehicleValued(v)).length,
    unvaluedRealEstate: property.unvalued,
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
