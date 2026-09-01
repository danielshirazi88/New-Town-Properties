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

/**
 * A month cell in the rent roll.
 *
 * `NR` means "not reported" — a month the sheet simply does not cover, as in a
 * part-year rent roll pulled mid-year. It is deliberately distinct from `V`:
 * treating an unreported month as a vacancy would invent months of lost rent for
 * every tenant in the portfolio.
 */
export type MonthCell = number | 'V' | 'FREE' | 'NR'

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
  /** Rentable square feet for the unit, where the sheet records it. */
  squareFeet?: number
  /**
   * Set when the area came from a different year's sheet than this one. A suite
   * does not change size between years, so an area stated on any rent roll
   * applies to every other — but the figure should never look like it was
   * printed on a sheet that never stated it.
   */
  squareFeetFromYear?: number
  /**
   * Monthly rent sought for space standing empty.
   *
   * A vacant unit that has never billed has no rate to impute one from, so
   * without this its downtime is valued at nothing and an empty suite looks
   * costless. This is what the landlord is asking, not what anyone is paying:
   * it values the vacancy and it never counts as income.
   */
  askingRent?: number
  /** Security deposit held against the unit. */
  securityDeposit?: number
  /** Renewal options as written, e.g. "5YR + 5YR" or "M to M". */
  renewalOptions?: string
  /**
   * The date the building was sold, where it has been.
   *
   * Set from the property when the year's data is resolved, not typed on the
   * lease. A lease at a building that has been sold did not expire — it went
   * with the building, and it is the buyer's to renew or not. Treating its end
   * date as a lapse would put someone else's tenants on this landlord's list of
   * problems.
   */
  conveyedOn?: string
  /**
   * What the money is. Almost everything is rent; the exceptions matter because
   * they should not be divided by square footage or counted as occupancy.
   */
  incomeType?: 'rent' | 'billboard' | 'parking' | 'note'
  /**
   * Free rent granted at commencement. Recorded on the lease rather than read
   * off the months, because the concession outlives the year it was given in:
   * from 2025 onwards the Body Shop pays every month, and the only place the
   * free October of 2024 still shows is here. In the year the concession falls,
   * the months carry `FREE` as well, so the loss is counted once and in the
   * right year.
   */
  concession?: {
    /** Number of months of free rent granted. */
    months: number
    /** Which calendar months were free, ISO `YYYY-MM`, where known. */
    periods?: string[]
    note?: string
  }
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
  /** First year owned, when known. Absent means "before the records we hold". */
  acquiredYear?: number
  /**
   * Year the property was sold. It still appears in the years it was owned and
   * disappears from later ones, rather than being deleted — otherwise selling a
   * building would silently rewrite history.
   */
  soldYear?: number
  /** Exact disposal date, when known. */
  soldDate?: string
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
  /**
   * The asterisk beside some names on the registry: the home on that lot is
   * owned by the park rather than by the tenant.
   *
   * It changes what the rent is for. On a tenant-owned lot the park collects
   * ground rent and the tenant maintains their own home; on a park-owned one the
   * park owns the structure too, so it carries the maintenance, the insurance and
   * the depreciation — and the rent covers both the land and the home.
   */
  parkOwned: boolean
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
