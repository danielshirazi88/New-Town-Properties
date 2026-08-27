import type { Lease } from '../../lib/types'
import { APOLLO_GROSS_2024, KNOWN_VARIANCES_2024, LEASES_2024, STATED_TOTALS_2024, TAX_2024 } from './y2024'
import { APOLLO_GROSS_2025, KNOWN_VARIANCES_2025, LEASES_2025, STATED_TOTALS_2025, TAX_2025 } from './y2025'

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
}

export const RENT_ROLLS: Record<number, RentRollYear> = {
  2024: {
    year: 2024,
    leases: LEASES_2024,
    tax: TAX_2024,
    apolloGross: APOLLO_GROSS_2024,
    statedTotals: STATED_TOTALS_2024,
    variances: KNOWN_VARIANCES_2024,
  },
  2025: {
    year: 2025,
    leases: LEASES_2025,
    tax: TAX_2025,
    apolloGross: APOLLO_GROSS_2025,
    statedTotals: STATED_TOTALS_2025,
    variances: KNOWN_VARIANCES_2025,
  },
}

export const AVAILABLE_YEARS: number[] = Object.keys(RENT_ROLLS).map(Number).sort((a, b) => a - b)

/** The year the app opens on: the most recent one loaded. */
export const CURRENT_YEAR: number = AVAILABLE_YEARS[AVAILABLE_YEARS.length - 1]

export const rentRoll = (year: number): RentRollYear => RENT_ROLLS[year] ?? RENT_ROLLS[CURRENT_YEAR]

/** Whether a property produced anything in a given year — used to spot disposals. */
export function propertyActiveIn(propertyId: string, year: number): boolean {
  const roll = RENT_ROLLS[year]
  if (!roll) return false
  if (propertyId === 'apollo') return roll.apolloGross > 0
  return roll.leases.some((l) => l.propertyId === propertyId)
}
