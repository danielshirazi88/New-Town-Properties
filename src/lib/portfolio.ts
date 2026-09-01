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
  isConveyed, isMonthToMonth, hasVacated,
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
  /** Where the Apollo figure came from, and its caveats if it was derived. */
  apolloBasis: 'printed' | 'derived'
  apolloNote?: string
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
  /** Past its end date and empty — a unit to re-let, not a tenant to negotiate. */
  vacatedLeases: Lease[]
  /** Tenancies that renew by the month rather than running to a date. */
  monthToMonthLeases: Lease[]
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
  /**
   * Monthly rent sought across every empty unit that has been priced, and the
   * year it would make. Not a forecast — nothing says the space will let, or
   * let at that — but it is the landlord's own number for what the vacancy is
   * costing, which beats an estimate off a per-square-foot average.
   */
  askingRentMonthly: number
  askingRentAnnual: number
  unitsOnMarket: number
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
      const own = roll.leases.filter((l) => l.propertyId === p.id)
      // Apollo was a single annual figure until its own rent roll arrived. Where
      // the park now has lease rows they are the source, and the annual figure
      // is only a fallback for the years that still have nothing else.
      const gross = own.length > 0
        ? own.reduce((a, l) => a + l.statedAnnualTotal, 0)
        : (p.id === 'apollo' ? roll.apolloGross : 0)
      return {
        ...p,
        taxBill: tax?.bill ?? 0,
        taxBillYear: tax?.billYear ?? p.taxBillYear,
        statedGross: gross,
        statedNetAfterTax: gross - (tax?.bill ?? 0),
      }
    })

  // Leases at a building that has been sold are marked as having gone with it.
  // Their end dates are still on the sheet and still in the past, but renewing
  // them is the buyer's decision, not this landlord's.
  const soldOn = new Map(
    PROPERTIES.filter((p) => p.soldDate).map((p) => [p.id, p.soldDate!]),
  )

  // A unit's area is a fact about the building, so an area stated on any sheet
  // is carried onto the same unit in every year — tagged with where it came from.
  const withArea = roll.leases.map((l) => {
    const area = l.squareFeet ? undefined : areaForUnit(l.propertyId, l.unit)
    const kind = l.incomeType ? undefined : incomeTypeForUnit(l.propertyId, l.unit)
    // The seller note sits under the sold building's id but did not convey with
    // it — it is what the landlord received *for* conveying, and it still pays.
    const conveyedOn = l.incomeType === 'note' ? undefined : soldOn.get(l.propertyId)
    if (!area && !kind && !conveyedOn) return l
    return {
      ...l,
      ...(area && { squareFeet: area.squareFeet, squareFeetFromYear: area.sourceYear }),
      ...(kind && { incomeType: kind }),
      ...(conveyedOn && { conveyedOn }),
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
  // The park's lots are leases like any other and are charged, aged and chased
  // like any other — but they are not commercial suites, and every measure built
  // for suites (rent per square foot, WALT, tenant concentration, the expiration
  // ladder) would be swamped by thirty-seven month-to-month lots. So the split
  // holds, and it is the one place a lot must not be counted twice.
  const apolloLeases = ALL_LEASES.filter((l) => l.propertyId === 'apollo')
  const commercialLeases = ALL_LEASES.filter((l) => l.propertyId !== 'apollo')
  const commercialGross = commercialLeases.reduce((a, l) => a + collected(l), 0)
  const apolloProp = PROPS.find((p) => p.id === 'apollo')!
  const apolloGross = apolloLeases.length > 0
    ? apolloLeases.reduce((a, l) => a + collected(l), 0)
    : apolloProp.statedGross
  const grossCollected = commercialGross + apolloGross

  const props = PROPS.map((p) => propertyMetrics(p, ALL_LEASES, grossCollected, asOf, reportedMonths))
  // Reconciliation covers only what the 2025 rent-roll workbook covers. A holding
  // that exists solely on the tax return is browsable and taxable but is not part
  // of the figure that is claimed to tie to that document.
  const commercialProps = props.filter(
    (p) => p.property.id !== 'apollo' && p.property.onRentRoll !== false,
  )

  const monthly = monthlySeries(commercialLeases)
  // Apollo is one figure for the months its source covers, so it spreads across
  // those months rather than across twelve. On a part year, dividing by twelve
  // would understate every month that did happen and credit the park with income
  // in months nobody has reported yet.
  const apolloPerMonth = apolloGross / reportedMonths
  const apolloMonthly = apolloLeases.length > 0
    ? monthlySeries(apolloLeases)
    : monthly.map((_, i) => (i < reportedMonths ? apolloPerMonth : 0))
  const monthlyWithApollo = monthly.map((m, i) => m + apolloMonthly[i])

  const bestIdx = monthly.indexOf(Math.max(...monthly))
  const worstIdx = monthly.indexOf(Math.min(...monthly))

  const commercialTaxes = commercialProps.reduce((a, p) => a + p.taxBill, 0)
  const totalTaxes = commercialTaxes + apolloProp.taxBill

  const exitMonthlyRent = commercialLeases.reduce((a, l) => a + exitRate(l), 0)
  const forwardRunRate = exitMonthlyRent * 12 + apolloPerMonth * 12

  // Everything about expiry is measured on the leases this landlord still holds.
  // A building that has been sold takes its leases with it, and counting them
  // here would put someone else's renewals on this portfolio's risk.
  const ownLeases = commercialLeases.filter((l) => !isConveyed(l))

  const withinMonths = (l: Lease, lo: number, hi: number) => {
    const m = monthsRemaining(l, asOf)
    return m !== undefined && m >= lo && m <= hi
  }
  const expiring12 = ownLeases.filter((l) => withinMonths(l, 0, 12))
  const expiring24 = ownLeases.filter((l) => withinMonths(l, 0, 24))
  const expiring36 = ownLeases.filter((l) => withinMonths(l, 0, 36))
  const expiredLeases = ownLeases.filter((l) => isExpired(l, asOf))
  const holdoverLeases = ownLeases.filter((l) => isHoldover(l, asOf))
  const vacatedLeases = ownLeases.filter((l) => hasVacated(l, asOf))
  const monthToMonthLeases = ownLeases.filter((l) => isMonthToMonth(l))

  // Expiration ladder, bucketed by calendar year of expiry.
  const ladderMap = new Map<number, { count: number; rent: number }>()
  for (const l of ownLeases) {
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
    apolloBasis: rentRoll(data.year).apolloBasis,
    apolloNote: rentRoll(data.year).apolloNote,
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
    vacatedLeases,
    monthToMonthLeases,
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
    // Priced empty units take the owner's own asking rent; the rest fall back to
    // what their property's let space achieves. Mixing the two beats using the
    // per-square-foot estimate everywhere, which assumes a back room is worth
    // what the frontage is.
    vacantSqFtAnnualValue: props.reduce(
      (a, p) => a + (p.askingMonthly > 0 ? p.askingMonthly * 12 : p.vacantSquareFeet * p.rentPerSqFt),
      0,
    ),
    askingRentMonthly: props.reduce((a, p) => a + p.askingMonthly, 0),
    askingRentAnnual: props.reduce((a, p) => a + p.askingMonthly, 0) * 12,
    unitsOnMarket: props.reduce((a, p) => a + p.unitsOnMarket, 0),
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
/**
 * What the portfolio is worth on its income, at a chosen cap rate.
 *
 * `monthsReported` matters more than it looks. A cap rate is a rate per year, so
 * capitalising eight months of rent against a full year's tax bill prices every
 * building at a fraction of what it is worth. Income is scaled to a full year
 * before anything is divided by a rate; the tax bill is already annual and is
 * left alone. Pass 12, or omit it, for a complete year.
 */
export function valuationModel(
  k: PortfolioKpis, capRatePct: number, opexLoadPct: number, monthsReported = 12,
) {
  const months = monthsReported > 0 && monthsReported < 12 ? monthsReported : 12
  const annualise = (n: number) => (n / months) * 12

  const gross = annualise(k.grossCollected)
  const opex = gross * (opexLoadPct / 100)
  const trueNoi = gross - k.totalTaxes - opex
  const sheetNet = annualise(k.grossCollected) - k.totalTaxes
  return {
    /** Gross scaled to a full year — equal to the sheet's own figure at 12 months. */
    annualGross: gross,
    annualised: months < 12,
    monthsReported: months,
    opex,
    trueNoi,
    noiMarginPct: gross > 0 ? (trueNoi / gross) * 100 : 0,
    valueOnSheetNet: valueAtCap(sheetNet, capRatePct),
    valueOnTrueNoi: valueAtCap(trueNoi, capRatePct),
    valuePerProperty: valueAtCap(trueNoi, capRatePct) / k.propertyCount,
  }
}
