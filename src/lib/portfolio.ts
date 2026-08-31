import { APOLLO_TENANTS, APOLLO_WATER_CHARGE } from '../data/apollo'
import { PROPERTIES } from '../data/properties'
import { CURRENT_YEAR, areaForUnit, incomeTypeForUnit, rentRoll } from '../data/rentRolls'
import {
  applyApolloOverrides, applyLeaseOverrides, applyPropertyOverrides,
  EMPTY_OVERRIDES, type Overrides,
} from './overrides'
import type { ApolloTenant, Property } from './types'
import {
  AS_OF, collected, concessionLoss, darkMonths, exitRate, grossPotential, hasNoEndDate,
  herfindahl, isExpired, isFullyVacant, isHoldover, monthlySeries, monthsRemaining,
  propertyMetrics, realisedEscalationPct, vacancyLoss, valueAtCap, walt, waltActiveOnly,
  type PropertyMetrics,
} from './finance'
import type { Lease } from './types'

/** Cap rates offered on the valuation view. Nothing in the source implies a rate. */
export const CAP_RATE_CHOICES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const
export const DEFAULT_CAP_RATE = 8

/**
 * Operating expenses the source sheets never captured, as a share of gross rent.
 * The sheets subtract property taxes and nothing else, so every "net" they print
 * overstates true NOI. This is the adjustable allowance used to model the gap —
 * it is an assumption, shown as one, and dialled by the user on the Valuation view.
 */
export const DEFAULT_OPEX_LOAD_PCT = 12

export interface PortfolioKpis {
  asOf: Date
  fiscalYear: number

  // ── Income ───────────────────────────────────────────────────────────────
  grossCollected: number
  grossPotential: number
  vacancyLoss: number
  concessionLoss: number
  totalTaxes: number
  netAfterTax: number
  commercialGross: number
  commercialTaxes: number
  commercialNet: number
  apolloGross: number
  apolloTaxes: number
  apolloNet: number

  // ── Monthly shape ────────────────────────────────────────────────────────
  monthly: number[]
  monthlyWithApollo: number[]
  bestMonth: { index: number; amount: number }
  worstMonth: { index: number; amount: number }
  avgMonth: number
  janToDecGrowthPct: number
  /** Months of the selected sheet that carry data. */
  reportedMonths: number
  exitMonthlyRent: number
  forwardRunRate: number
  runRateVsActualPct: number

  // ── Portfolio shape ──────────────────────────────────────────────────────
  propertyCount: number
  /** Holdings on the tax return but absent from the 2025 rent roll. */
  offRentRollCount: number
  commercialPropertyCount: number
  unitCount: number
  occupiedUnits: number
  vacantUnits: number
  physicalOccupancyPct: number
  economicOccupancyPct: number
  totalDarkMonths: number

  // ── Lease risk ───────────────────────────────────────────────────────────
  walt: number
  waltActiveOnly: number
  expiredLeases: Lease[]
  holdoverLeases: Lease[]
  rentOnExpiredLeases: number
  expiring12: Lease[]
  expiring24: Lease[]
  expiring36: Lease[]
  rentAtRisk12: number
  rentAtRisk24: number
  rentAtRisk36: number
  noEndDateLeases: Lease[]
  expirationLadder: { year: number; count: number; rent: number }[]

  // ── Escalations ──────────────────────────────────────────────────────────
  avgStatedEscalationPct: number
  avgRealisedEscalationPct: number
  bumpsNotTaken: { lease: Lease; statedPct: number; realisedPct: number; forgone: number }[]
  totalForgoneFromMissedBumps: number

  // ── Concentration ────────────────────────────────────────────────────────
  topTenants: { lease: Lease; rent: number; sharePct: number }[]
  top5TenantSharePct: number
  largestTenantSharePct: number
  largestPropertySharePct: number
  tenantHerfindahl: number
  propertyHerfindahl: number

  // ── Cost ─────────────────────────────────────────────────────────────────
  taxLoadPct: number
  highestTaxLoad: PropertyMetrics
  lowestTaxLoad: PropertyMetrics

  // ── Lease structure ──────────────────────────────────────────────────────
  leaseTypeCounts: Record<string, number>
  unknownLeaseTypeRent: number

  // ── Square footage ───────────────────────────────────────────────────────
  totalSquareFeet: number
  leasedSquareFeet: number
  vacantSquareFeet: number
  occupancyBySqFtPct: number
  /** Portfolio rent per square foot, annualised, across let space only. */
  rentPerSqFt: number
  /** Units with no recorded area — the rate above does not cover these. */
  unmeasuredUnits: number
  /** Rent forgone each year on empty space, at the property's own rate. */
  vacantSqFtAnnualValue: number
  securityDepositsHeld: number

  // ── Apollo ───────────────────────────────────────────────────────────────
  apolloLots: number
  apolloParkingSpaces: number
  /** Dwelling lots only — parking is billed separately and carries no water. */
  apolloLotMonthly: number
  apolloParkingMonthly: number
  /** Lots plus parking. */
  apolloMonthlyBilled: number
  apolloAnnualisedCurrent: number
  apolloAvgLotRent: number
  apolloMedianLotRent: number
  apolloMinLotRent: number
  apolloMaxLotRent: number
  apolloWaterRevenueMonthly: number
  apolloBaseRentMonthly: number
  /** Lots where the park owns the home as well as the land. */
  apolloParkOwnedCount: number

  properties: PropertyMetrics[]
}

const median = (xs: number[]): number => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** The dataset the whole app reads: source documents with hand edits applied. */
export interface ResolvedData {
  properties: Property[]
  leases: Lease[]
  apolloTenants: ApolloTenant[]
  year: number
}

export function resolveData(
  overrides: Overrides = EMPTY_OVERRIDES,
  year: number = CURRENT_YEAR,
): ResolvedData {
  const roll = rentRoll(year)

  // Each year carries its own tax bills and its own Apollo figure, so the
  // property records are rebuilt against the year being viewed before any hand
  // edits are layered on.
  const forYear = PROPERTIES
    .filter((p) => p.soldYear === undefined || year <= p.soldYear)
    .filter((p) => p.acquiredYear === undefined || year >= p.acquiredYear)
    .map((p) => {
      const tax = roll.tax[p.id]
      const gross = p.id === 'apollo'
        ? roll.apolloGross
        : roll.leases.filter((l) => l.propertyId === p.id).reduce((a, l) => a + l.statedAnnualTotal, 0)
      return {
        ...p,
        taxBill: tax?.bill ?? 0,
        taxBillYear: tax?.billYear ?? p.taxBillYear,
        statedGross: gross,
        statedNetAfterTax: gross - (tax?.bill ?? 0),
      }
    })

  // A unit's area is a fact about the building, so an area stated on any sheet
  // is carried onto the same unit in every year — tagged with where it came from.
  const withArea = roll.leases.map((l) => {
    const area = l.squareFeet ? undefined : areaForUnit(l.propertyId, l.unit)
    const kind = l.incomeType ? undefined : incomeTypeForUnit(l.propertyId, l.unit)
    if (!area && !kind) return l
    return {
      ...l,
      ...(area && { squareFeet: area.squareFeet, squareFeetFromYear: area.sourceYear }),
      ...(kind && { incomeType: kind }),
    }
  })

  return {
    properties: applyPropertyOverrides(forYear, overrides),
    leases: applyLeaseOverrides(withArea, overrides),
    apolloTenants: applyApolloOverrides(APOLLO_TENANTS, overrides),
    year,
  }
}

export function computeKpis(asOf: Date = AS_OF, data: ResolvedData = resolveData()): PortfolioKpis {
  // How much of the year the sheet actually covers; a part year must not be
  // measured as though its blank months were zeros.
  const reportedMonths = rentRoll(data.year).monthsReported
  const { properties: PROPS, leases: ALL_LEASES, apolloTenants: APOLLO } = data
  const commercialLeases = ALL_LEASES
  const commercialGross = commercialLeases.reduce((a, l) => a + collected(l), 0)
  const apolloProp = PROPS.find((p) => p.id === 'apollo')!
  const apolloGross = apolloProp.statedGross
  const grossCollected = commercialGross + apolloGross

  const props = PROPS.map((p) => propertyMetrics(p, ALL_LEASES, grossCollected, asOf))
  // Reconciliation covers only what the 2025 rent-roll workbook covers. A holding
  // that exists solely on the tax return is browsable and taxable but is not part
  // of the figure that is claimed to tie to that document.
  const commercialProps = props.filter(
    (p) => p.property.id !== 'apollo' && p.property.onRentRoll !== false,
  )

  const monthly = monthlySeries(commercialLeases)
  const apolloPerMonth = apolloGross / 12
  const monthlyWithApollo = monthly.map((m) => m + apolloPerMonth)

  const bestIdx = monthly.indexOf(Math.max(...monthly))
  const worstIdx = monthly.indexOf(Math.min(...monthly))

  const commercialTaxes = commercialProps.reduce((a, p) => a + p.taxBill, 0)
  const totalTaxes = commercialTaxes + apolloProp.taxBill

  const exitMonthlyRent = commercialLeases.reduce((a, l) => a + exitRate(l), 0)
  const forwardRunRate = exitMonthlyRent * 12 + apolloGross

  const withinMonths = (l: Lease, lo: number, hi: number) => {
    const m = monthsRemaining(l, asOf)
    return m !== undefined && m >= lo && m <= hi
  }
  const expiring12 = commercialLeases.filter((l) => withinMonths(l, 0, 12))
  const expiring24 = commercialLeases.filter((l) => withinMonths(l, 0, 24))
  const expiring36 = commercialLeases.filter((l) => withinMonths(l, 0, 36))
  const expiredLeases = commercialLeases.filter((l) => isExpired(l, asOf))
  const holdoverLeases = commercialLeases.filter((l) => isHoldover(l, asOf))

  // Expiration ladder, bucketed by calendar year of expiry.
  const ladderMap = new Map<number, { count: number; rent: number }>()
  for (const l of commercialLeases) {
    if (!l.leaseEnd) continue
    const y = new Date(l.leaseEnd + 'T00:00:00').getFullYear()
    const cur = ladderMap.get(y) ?? { count: 0, rent: 0 }
    ladderMap.set(y, { count: cur.count + 1, rent: cur.rent + collected(l) })
  }
  const expirationLadder = [...ladderMap.entries()]
    .map(([year, v]) => ({ year, ...v }))
    .sort((a, b) => a.year - b.year)

  // A bump is "not taken" when the sheet marks an escalation the rent never shows.
  const bumpsNotTaken: PortfolioKpis['bumpsNotTaken'] = []
  for (const l of commercialLeases) {
    const stated = l.statedEscalationPct
    const realised = realisedEscalationPct(l)
    if (stated === undefined || realised === undefined) continue
    if (realised < stated - 0.75) {
      const shortfallPct = stated - realised
      bumpsNotTaken.push({
        lease: l,
        statedPct: stated,
        realisedPct: realised,
        forgone: collected(l) * (shortfallPct / 100),
      })
    }
  }
  bumpsNotTaken.sort((a, b) => b.forgone - a.forgone)

  const statedEsc = commercialLeases.map((l) => l.statedEscalationPct).filter((n): n is number => n !== undefined)
  const realisedEsc = commercialLeases.map((l) => realisedEscalationPct(l)).filter((n): n is number => n !== undefined)

  const ranked = [...commercialLeases]
    .map((l) => ({ lease: l, rent: collected(l) }))
    .filter((x) => x.rent > 0)
    .sort((a, b) => b.rent - a.rent)
  const topTenants = ranked.map((x) => ({ ...x, sharePct: (x.rent / grossCollected) * 100 }))

  const leaseTypeCounts: Record<string, number> = {}
  for (const l of commercialLeases) leaseTypeCounts[l.leaseType] = (leaseTypeCounts[l.leaseType] ?? 0) + 1

  // Dwelling lots and parking spaces are priced on completely different scales
  // ($650–$1,320 against a flat $100), so the lot averages are computed over
  // dwelling lots alone — folding parking in would drag "cheapest lot" to $100
  // and describe a lot nobody lives on.
  const paying = APOLLO.filter((t) => !t.isParking)
  const parking = APOLLO.filter((t) => t.isParking)
  const lotRents = paying.map((t) => t.amountDue)
  const apolloLotMonthly = lotRents.reduce((a, b) => a + b, 0)
  const apolloParkingMonthly = parking.reduce((a, t) => a + t.amountDue, 0)
  const apolloMonthlyBilled = apolloLotMonthly + apolloParkingMonthly

  const byTaxLoad = [...commercialProps].sort((a, b) => b.taxLoadPct - a.taxLoadPct)

  const potential = commercialLeases.reduce((a, l) => a + grossPotential(l), 0) + apolloGross

  return {
    asOf,
    fiscalYear: data.year,

    grossCollected,
    grossPotential: potential,
    vacancyLoss: commercialLeases.reduce((a, l) => a + vacancyLoss(l), 0),
    concessionLoss: commercialLeases.reduce((a, l) => a + concessionLoss(l), 0),
    totalTaxes,
    netAfterTax: grossCollected - totalTaxes,
    commercialGross,
    commercialTaxes,
    commercialNet: commercialGross - commercialTaxes,
    apolloGross,
    apolloTaxes: apolloProp.taxBill,
    apolloNet: apolloGross - apolloProp.taxBill,

    monthly,
    monthlyWithApollo,
    bestMonth: { index: bestIdx, amount: monthly[bestIdx] },
    worstMonth: { index: worstIdx, amount: monthly[worstIdx] },
    avgMonth: commercialGross / 12,
    reportedMonths,
    janToDecGrowthPct: (() => {
      // First reported month to last reported month. Running to December on a
      // part year compares January against a month the sheet does not cover and
      // reports the whole portfolio as down 100%.
      const last = monthly[reportedMonths - 1] ?? 0
      return monthly[0] > 0 ? ((last - monthly[0]) / monthly[0]) * 100 : 0
    })(),
    exitMonthlyRent,
    forwardRunRate,
    runRateVsActualPct: grossCollected > 0 ? ((forwardRunRate - grossCollected) / grossCollected) * 100 : 0,

    propertyCount: PROPS.length,
    offRentRollCount: PROPS.filter((p) => p.onRentRoll === false).length,
    commercialPropertyCount: commercialProps.length,
    unitCount: commercialLeases.length,
    occupiedUnits: commercialLeases.filter((l) => !isFullyVacant(l)).length,
    vacantUnits: commercialLeases.filter(isFullyVacant).length,
    physicalOccupancyPct: (commercialLeases.filter((l) => !isFullyVacant(l)).length / commercialLeases.length) * 100,
    economicOccupancyPct: (commercialGross / commercialLeases.reduce((a, l) => a + grossPotential(l), 0)) * 100,
    totalDarkMonths: commercialLeases.reduce((a, l) => a + darkMonths(l), 0),

    walt: walt(commercialLeases, asOf),
    waltActiveOnly: waltActiveOnly(commercialLeases, asOf),
    expiredLeases,
    holdoverLeases,
    rentOnExpiredLeases: expiredLeases.reduce((a, l) => a + collected(l), 0),
    expiring12,
    expiring24,
    expiring36,
    rentAtRisk12: expiring12.reduce((a, l) => a + collected(l), 0),
    rentAtRisk24: expiring24.reduce((a, l) => a + collected(l), 0),
    rentAtRisk36: expiring36.reduce((a, l) => a + collected(l), 0),
    noEndDateLeases: commercialLeases.filter(hasNoEndDate),
    expirationLadder,

    avgStatedEscalationPct: statedEsc.length ? statedEsc.reduce((a, b) => a + b, 0) / statedEsc.length : 0,
    avgRealisedEscalationPct: realisedEsc.length ? realisedEsc.reduce((a, b) => a + b, 0) / realisedEsc.length : 0,
    bumpsNotTaken,
    totalForgoneFromMissedBumps: bumpsNotTaken.reduce((a, b) => a + b.forgone, 0),

    topTenants,
    top5TenantSharePct: topTenants.slice(0, 5).reduce((a, t) => a + t.sharePct, 0),
    largestTenantSharePct: topTenants[0]?.sharePct ?? 0,
    largestPropertySharePct: Math.max(...props.map((p) => p.portfolioSharePct)),
    tenantHerfindahl: herfindahl(ranked.map((r) => r.rent)),
    propertyHerfindahl: herfindahl(props.map((p) => p.collected)),

    taxLoadPct: (totalTaxes / grossCollected) * 100,
    highestTaxLoad: byTaxLoad[0],
    lowestTaxLoad: byTaxLoad[byTaxLoad.length - 1],

    leaseTypeCounts,
    unknownLeaseTypeRent: commercialLeases
      .filter((l) => l.leaseType === 'UNKNOWN')
      .reduce((a, l) => a + collected(l), 0),

    totalSquareFeet: props.reduce((a, p) => a + p.squareFeet, 0),
    leasedSquareFeet: props.reduce((a, p) => a + p.leasedSquareFeet, 0),
    vacantSquareFeet: props.reduce((a, p) => a + p.vacantSquareFeet, 0),
    occupancyBySqFtPct: (() => {
      const total = props.reduce((a, p) => a + p.squareFeet, 0)
      const leased = props.reduce((a, p) => a + p.leasedSquareFeet, 0)
      return total > 0 ? (leased / total) * 100 : 0
    })(),
    rentPerSqFt: (() => {
      const leased = props.reduce((a, p) => a + p.leasedSquareFeet, 0)
      const rent = props.reduce((a, p) => a + p.rentPerSqFt * p.leasedSquareFeet, 0)
      return leased > 0 ? rent / leased : 0
    })(),
    unmeasuredUnits: props.reduce((a, p) => a + p.unmeasuredUnits, 0),
    // Empty space valued at the rate its own property actually achieves, which
    // is a fairer estimate than a single portfolio-wide average.
    vacantSqFtAnnualValue: props.reduce((a, p) => a + p.vacantSquareFeet * p.rentPerSqFt, 0),
    securityDepositsHeld: commercialLeases.reduce((a, l) => a + (l.securityDeposit ?? 0), 0),

    apolloLots: paying.length,
    apolloParkingSpaces: parking.length,
    apolloLotMonthly,
    apolloParkingMonthly,
    apolloMonthlyBilled,
    apolloAnnualisedCurrent: apolloMonthlyBilled * 12,
    apolloAvgLotRent: apolloLotMonthly / paying.length,
    apolloMedianLotRent: median(lotRents),
    apolloMinLotRent: Math.min(...lotRents),
    apolloMaxLotRent: Math.max(...lotRents),
    apolloWaterRevenueMonthly: paying.length * APOLLO_WATER_CHARGE,
    apolloBaseRentMonthly: apolloLotMonthly - paying.length * APOLLO_WATER_CHARGE,
    apolloParkOwnedCount: APOLLO.filter((t) => t.parkOwned).length,

    properties: props,
  }
}

/** True NOI after an assumed operating-expense load, and the value it implies. */
export function valuationModel(k: PortfolioKpis, capRatePct: number, opexLoadPct: number) {
  const opex = k.grossCollected * (opexLoadPct / 100)
  const trueNoi = k.grossCollected - k.totalTaxes - opex
  return {
    opex,
    trueNoi,
    noiMarginPct: (trueNoi / k.grossCollected) * 100,
    valueOnSheetNet: valueAtCap(k.netAfterTax, capRatePct),
    valueOnTrueNoi: valueAtCap(trueNoi, capRatePct),
    valuePerProperty: valueAtCap(trueNoi, capRatePct) / k.propertyCount,
  }
}
