/**
 * Who can see what.
 *
 * The portfolio is one household's finances, but not everyone who needs the app
 * needs all of it. An office assistant chasing rent needs the tenants, the
 * collection grid and the receivables; she does not need the trust's schedule of
 * assets, the tax returns or what the estate is worth. Splitting it that way is
 * not distrust — it is that a screen nobody needs is a screen that can only leak.
 *
 * This file is the single list of sections, shared by the browser and the
 * server. The browser hides what a user cannot reach; the server refuses it.
 * Only the second one is security — the first is manners.
 */

export type SectionId =
  | 'dashboard'
  | 'properties'
  | 'tenants'
  | 'collection'
  | 'expenses'
  | 'taxes'
  | 'wealth'
  | 'team'

export interface Section {
  id: SectionId
  label: string
  /** What a person with this section can actually do, in plain words. */
  detail: string
  /** Only an owner may hold it. */
  ownerOnly?: boolean
}

export const SECTIONS: Section[] = [
  {
    id: 'dashboard',
    label: 'Dashboard & portfolio',
    detail: 'The executive dashboard, income by month, year-over-year and square footage. Shows total income.',
  },
  {
    id: 'properties',
    label: 'Properties & rent roll',
    detail: 'Every building, the rent roll, lease expirations and annual bumps. Editing a rent line needs this.',
  },
  {
    id: 'tenants',
    label: 'Tenant profiles',
    detail: 'Contact details and preferred payment method for each tenant.',
  },
  {
    id: 'collection',
    label: 'Rent collection & receivables',
    detail: 'Recording payments, what is owed, late fees and the payer analytics.',
  },
  {
    id: 'expenses',
    label: 'Expenses',
    detail: 'Logging expenses and uploading receipts and invoices.',
  },
  {
    id: 'taxes',
    label: 'Taxes',
    detail: 'The Schedule E worksheet and the filed returns, including income and tax totals.',
  },
  {
    id: 'wealth',
    label: 'Trust, assets & valuation',
    detail: 'The trust schedule, bank accounts, vehicles and what the estate is worth.',
  },
  {
    id: 'team',
    label: 'Manage people',
    detail: 'Add or remove people, set what they can reach, and read the sign-in history.',
    ownerOnly: true,
  },
]

export const SECTION_IDS = SECTIONS.map((s) => s.id)

export const sectionLabel = (id: SectionId): string =>
  SECTIONS.find((s) => s.id === id)?.label ?? id

export type Role = 'owner' | 'staff'

export interface AccountSummary {
  id: string
  name: string
  username: string
  role: Role
  /** Sections a staff member holds. Ignored for an owner, who holds all of them. */
  sections: SectionId[]
  active: boolean
  createdAt?: string
  lastSeenAt?: string | null
  /** Set on a new account until the person picks their own password. */
  mustChangePassword?: boolean
}

/**
 * An owner reaches everything, always.
 *
 * Encoding that here rather than by handing owners a full section list means an
 * owner cannot be locked out of a section by an editing mistake, and a section
 * added later is reachable by its owner the moment it exists.
 */
export const canReach = (
  account: Pick<AccountSummary, 'role' | 'sections' | 'active'> | null | undefined,
  section: SectionId,
): boolean => {
  if (!account || !account.active) return false
  if (account.role === 'owner') return true
  return account.sections.includes(section)
}

/** What a new assistant starts with: the operational screens, none of the wealth. */
export const DEFAULT_STAFF_SECTIONS: SectionId[] = [
  'properties', 'tenants', 'collection', 'expenses',
]

/**
 * Which section governs a stored document.
 *
 * The server checks this before it will read or write one, so hiding a tab in
 * the browser is never the only thing standing between a person and the data
 * behind it.
 */
export const KEY_SECTIONS: Record<string, SectionId> = {
  'overrides.v1': 'properties',
  'expenses.v1': 'expenses',
  'taxes.v1': 'taxes',
  'tenantProfiles.v1': 'tenants',
  'payments.v1': 'collection',
  'collection.v1': 'collection',
  'assets.v1': 'wealth',
  'trust.v1': 'wealth',
}

export const sectionForKey = (key: string): SectionId | undefined => KEY_SECTIONS[key]
