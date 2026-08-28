import type { Lease } from '../../lib/types'
import { APOLLO_GROSS_2024, KNOWN_VARIANCES_2024, LEASES_2024, STATED_TOTALS_2024, TAX_2024 } from './y2024'
import { APOLLO_GROSS_2025, KNOWN_VARIANCES_2025, LEASES_2025, STATED_TOTALS_2025, TAX_2025 } from './y2025'
import { APOLLO_GROSS_2026, KNOWN_VARIANCES_2026, LEASES_2026, MONTHS_REPORTED_2026, STATED_TOTALS_2026, TAX_2026 } from './y2026'

/**
 * One rent roll per year.
 *
 * Each year stands on its own: its own lease lines, its own tax bills, its own
 * printed totals. Nothing is inferred from a neighbouring year, because tenants
 * turn over, units sit empty and properties get bought and sold — a portfolio
 * modelled as one list with a few dates attached would quietly lose all of that.
 *
 * Add a year by writing its file and registering it here.
 */
export interface RentRollYear {
  year: number
  leases: Lease[]
  /** Property tax applied to that year's income, and which year's bill it is. */
  tax: Record<string, { bill: number; billYear: number }>
  /** Apollo is reported as one annual figure on every sheet so far. */
  apolloGross: number
  statedTotals: {
    commercialGross: number
    commercialTaxes: number
    apolloGross: number
    apolloTaxes: number
    totalGross: number
    totalNet: number
  }
  /** Rows where the workbook's own arithmetic disagrees with its month cells. */
  variances: { leaseId: string; computed: number; stated: number; note: string }[]
  /** Months the sheet covers. Below 12 means a part-year roll pulled mid-year. */
  monthsReported: number
  /** False when the sheet prints no totals, so the transcription cannot be checked. */
  hasControlTotals: boolean
}

export const RENT_ROLLS: Record<number, RentRollYear> = {
  2024: {
    year: 2024,
    leases: LEASES_2024,
    tax: TAX_2024,
    apolloGross: APOLLO_GROSS_2024,
    statedTotals: STATED_TOTALS_2024,
    variances: KNOWN_VARIANCES_2024,
    monthsReported: 12,
    hasControlTotals: true,
  },
  2025: {
    year: 2025,
    leases: LEASES_2025,
    tax: TAX_2025,
    apolloGross: APOLLO_GROSS_2025,
    statedTotals: STATED_TOTALS_2025,
    variances: KNOWN_VARIANCES_2025,
    monthsReported: 12,
    hasControlTotals: true,
  },
  2026: {
    year: 2026,
    leases: LEASES_2026,
    tax: TAX_2026,
    apolloGross: APOLLO_GROSS_2026,
    statedTotals: STATED_TOTALS_2026,
    variances: KNOWN_VARIANCES_2026,
    monthsReported: MONTHS_REPORTED_2026,
    hasControlTotals: false,
  },
}

export const AVAILABLE_YEARS: number[] = Object.keys(RENT_ROLLS).map(Number).sort((a, b) => a - b)

/** The most recent year loaded, complete or not. */
export const LATEST_YEAR: number = AVAILABLE_YEARS[AVAILABLE_YEARS.length - 1]

/**
 * The year the app opens on: the most recent *complete* one.
 *
 * A part-year sheet makes a poor default. Opening on eight months of 2026 would
 * show income of $1.65M against 2025's $2.93M and read as a collapse, when the
 * only thing that happened is that the year is not over. The current year is one
 * click away in the picker and labelled as partial wherever it is shown.
 */
export const CURRENT_YEAR: number =
  [...AVAILABLE_YEARS].reverse().find((y) => RENT_ROLLS[y].monthsReported === 12) ?? LATEST_YEAR

/** How a year is described in the picker and in headings. */
export function yearLabel(year: number): string {
  const roll = RENT_ROLLS[year]
  if (!roll || roll.monthsReported === 12) return String(year)
  const upto = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'][roll.monthsReported - 1]
  return `${year} (through ${upto})`
}

export const isPartYear = (year: number): boolean =>
  (RENT_ROLLS[year]?.monthsReported ?? 12) < 12

export const rentRoll = (year: number): RentRollYear => RENT_ROLLS[year] ?? RENT_ROLLS[CURRENT_YEAR]

/** Whether a property produced anything in a given year — used to spot disposals. */
export function propertyActiveIn(propertyId: string, year: number): boolean {
  const roll = RENT_ROLLS[year]
  if (!roll) return false
  if (propertyId === 'apollo') return roll.apolloGross > 0
  return roll.leases.some((l) => l.propertyId === propertyId)
}

/* ── Unit areas across years ────────────────────────────────────────────── */

/**
 * Square footage, carried between rent rolls.
 *
 * Only the 2026 sheet states unit areas; the 2024 and 2025 sheets have none. But
 * a suite does not change size between years — the area is a fact about the
 * building, not about the year — so an area stated on any sheet is applied to
 * the same unit on every other. Each carried figure records the sheet it came
 * from, so nothing appears to be measured on a document that never stated it.
 *
 * Units are matched on property and unit label. Where a sheet has merged two
 * bays into one line (Plaza #2's 1683 and 1685 became 1683–1685 in 2026) the
 * labels no longer line up and no area is carried, which is the right outcome:
 * splitting a combined figure would be a guess.
 */
export interface UnitArea {
  squareFeet: number
  /** The rent roll year the figure was printed on. */
  sourceYear: number
}


/**
 * The same physical unit written under different labels from year to year.
 *
 * Most units carry a suite number that never changes. But at 1401 N 25th Avenue
 * the sheets label each bay by whoever occupies it, so a new tenant renames the
 * unit, and Nu River Landing was written simply as "Florida" before the condo
 * number was recorded. Matching on the label alone would treat those as separate
 * units and lose the area.
 *
 * Every group here is one the source documents themselves identify — each has a
 * note on the 2026 sheet naming the unit's earlier titles. Nothing is grouped on
 * a guess: Plaza #2's 1683 and 1685 were merged into a single 1683–1685 line in
 * 2026 and are deliberately absent, because splitting that 2,200 sf back into
 * two would be an invention rather than a rename.
 */
const UNIT_ALIASES: { propertyId: string; labels: string[] }[] = [
  // The auto-service row labels each bay by its occupant, so a re-let renames it.
  { propertyId: 'ave-25-1401', labels: ['Autotech Garage', 'Mechanic', 'Fast Cars Group'] },
  { propertyId: 'ave-25-1401', labels: ['Body Shop', 'KGZ Collision'] },
  // The condo was recorded only as "Florida" until the 2026 sheet gave its number.
  { propertyId: 'florida', labels: ['Florida', 'Unit 1918'] },
]

/** Every label for a unit resolves to the first one in its group. */
const CANONICAL_UNIT: Map<string, string> = (() => {
  const m = new Map<string, string>()
  for (const { propertyId, labels } of UNIT_ALIASES) {
    for (const label of labels) m.set(`${propertyId}|${label}`, `${propertyId}|${labels[0]}`)
  }
  return m
})()

const unitKey = (propertyId: string, unit: string): string => {
  const raw = `${propertyId}|${unit}`
  return CANONICAL_UNIT.get(raw) ?? raw
}

const AREA_BY_UNIT: Map<string, UnitArea> = (() => {
  const m = new Map<string, UnitArea>()
  // Newest sheet first, so the most recent measurement wins.
  for (const year of [...AVAILABLE_YEARS].reverse()) {
    for (const l of RENT_ROLLS[year].leases) {
      const key = unitKey(l.propertyId, l.unit)
      if (l.squareFeet && !m.has(key)) m.set(key, { squareFeet: l.squareFeet, sourceYear: year })
    }
  }
  return m
})()

export const areaForUnit = (propertyId: string, unit: string): UnitArea | undefined =>
  AREA_BY_UNIT.get(unitKey(propertyId, unit))

/**
 * What kind of income a unit produces, carried the same way as its area.
 *
 * A billboard ground lease and a garage rental are what they are in every year,
 * but only the 2026 sheet was transcribed with that classification. Carrying it
 * back keeps a billboard out of the square-footage and occupancy figures on the
 * earlier years too, where dividing it by an area it does not have would be
 * meaningless.
 */
const INCOME_TYPE_BY_UNIT: Map<string, NonNullable<Lease['incomeType']>> = (() => {
  const m = new Map<string, NonNullable<Lease['incomeType']>>()
  for (const year of [...AVAILABLE_YEARS].reverse()) {
    for (const l of RENT_ROLLS[year].leases) {
      const key = unitKey(l.propertyId, l.unit)
      if (l.incomeType && l.incomeType !== 'rent' && !m.has(key)) m.set(key, l.incomeType)
    }
  }
  return m
})()

export const incomeTypeForUnit = (
  propertyId: string,
  unit: string,
): NonNullable<Lease['incomeType']> | undefined => INCOME_TYPE_BY_UNIT.get(unitKey(propertyId, unit))
