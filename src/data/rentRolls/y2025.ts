import { KNOWN_SOURCE_VARIANCES, LEASES } from '../leases'
import type { Lease } from '../../lib/types'

/** The 2025 rent roll. The lease lines themselves live in `src/data/leases.ts`. */
export const LEASES_2025: Lease[] = LEASES

/** Property tax charged against 2025 income — the 2024 bills, paid in arrears. */
export const TAX_2025: Record<string, { bill: number; billYear: number }> = {
  'plaza-1': { bill: 168992.55, billYear: 2024 },
  'plaza-2': { bill: 92707.03, billYear: 2024 },
  'mannheim-plaza': { bill: 83142.43, billYear: 2024 },
  'west-plaza': { bill: 69864.34, billYear: 2024 },
  'mannheim-1500': { bill: 20776.45, billYear: 2024 },
  'mannheim-1506': { bill: 42263.7, billYear: 2024 },
  'mannheim-1511': { bill: 25050.37, billYear: 2024 },
  'playpen-1536': { bill: 26352.42, billYear: 2024 },
  'playpen-1538': { bill: 15862.05, billYear: 2024 },
  'florida': { bill: 5186.8, billYear: 2025 },
  'n-43rd-1643': { bill: 6671.66, billYear: 2024 },
  'mannheim-1638': { bill: 69974.53, billYear: 2024 },
  'ave-25-1401': { bill: 89380.35, billYear: 2024 },
  'apollo': { bill: 57077.58, billYear: 2024 },
  // On the tax return but not on the rent roll — vacant all year.
  'prairie-1211': { bill: 15080, billYear: 2024 },
}

export const APOLLO_GROSS_2025 = 378870.0

export const STATED_TOTALS_2025 = {
  commercialGross: 2552449.32,
  commercialTaxes: 716224.68,
  apolloGross: 378870.0,
  apolloTaxes: 57077.58,
  totalGross: 2931319.32,
  totalNet: 2158017.06,
}

export const KNOWN_VARIANCES_2025 = KNOWN_SOURCE_VARIANCES
