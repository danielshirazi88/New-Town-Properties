/**
 * Domain model for the New Town Properties portfolio.
 *
 * Source of truth: "2025 rent roll net income" (8-page scanned workbook, Dec 2025)
 * plus the "Apollo Mobile Home Court Tenant Registry — July 2026".
 *
 * Every figure that appears here was transcribed from those documents. Anything
 * the documents do not state is either `undefined` or explicitly `'UNKNOWN'` —
 * we never invent a number. See `src/data/assumptions.ts` for the full ledger of
 * inferred values.
 */

/** A month cell in the rent roll: an amount, a vacancy, or a free-rent concession. */
export type MonthCell = number | 'V' | 'FREE'

/** How operating expenses are split between landlord and tenant. */
export type LeaseType =
  | 'NNN' // Triple net — tenant pays taxes, insurance and CAM
  | 'MG' // Modified gross — expenses split per the lease
  | 'GROSS' // Full service gross — landlord pays all expenses
  | 'UNKNOWN' // Not stated in the source documents; needs classification

export type PropertyCategory =
  | 'retail-plaza'
  | 'retail-single'
  | 'industrial'
  | 'automotive'
  | 'residential'
  | 'mobile-home-park'
  | 'billboard'
  | 'mixed-use'

export interface Contact {
  name?: string
  phone: string
  label?: string
}

export interface Lease {
  id: string
  propertyId: string
  /** Suite / unit designation as written on the rent roll, e.g. "1A&B", "1693". */
  unit: string
  tenant: string
  contacts: Contact[]
  /** Twelve cells, January through December 2025. */
  months: MonthCell[]
  /** The annual total printed on the source sheet. Used to verify our transcription. */
  statedAnnualTotal: number
  /** Lease commencement, ISO date. */
  leaseStart?: string
  /** Lease expiration, ISO date. */
  leaseEnd?: string
  /** The escalation percentage written in red on the sheet, if any. */
  statedEscalationPct?: number
  leaseType: LeaseType
  /** Approximate rentable square feet, when known. */
  squareFeet?: number
  notes?: string
}

export interface Property {
  id: string
  name: string
  address: string
  city: string
  state: string
  category: PropertyCategory
  /** Property tax bill applied against 2025 income (2024 bill, paid in arrears). */
  taxBill: number
  /** Which tax year the bill above belongs to. */
  taxBillYear: number
  /** Gross rental income total printed on the source sheet. */
  statedGross: number
  /** Gross minus taxes, as computed on the source sheet. */
  statedNetAfterTax: number
  /** Sheet page the property was transcribed from. 0 when it is not on the sheet. */
  sourcePage: number
  /**
   * False for a holding that appears on the tax return but not in the 2025 rent
   * roll. Such a property is still shown and still belongs on Schedule E, but it
   * is kept out of the totals that reconcile against the rent-roll workbook —
   * otherwise those figures would stop matching the document they came from.
   */
  onRentRoll?: boolean
  notes?: string
}

/** A tenant at Apollo Mobile Home Court (lot rental, month-to-month). */
export interface ApolloTenant {
  id: string
  name: string
  address: string
  /** Total monthly amount due, inclusive of the $75 water charge. */
  amountDue: number
  contacts: Contact[]
  /** The asterisk that appears beside some names on the registry. Meaning unconfirmed. */
  flagged: boolean
  /** Non-dwelling rentals such as tandem parking spaces. */
  isParking?: boolean
}

export interface Portfolio {
  owner: string
  fiscalYear: number
  properties: Property[]
  leases: Lease[]
  apollo: {
    propertyId: string
    registryLabel: string
    waterChargePerTenant: number
    statedAnnualGross: number
    tenants: ApolloTenant[]
  }
}
