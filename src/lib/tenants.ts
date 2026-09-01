/**
 * Tenant profiles — the contact directory that sits behind each lease.
 *
 * Keyed by lease id, which is stable per unit across years, so a profile follows
 * the unit rather than being retyped every rent roll. Everything here is entered
 * by hand and stored alongside the other app state; nothing comes from the
 * source documents beyond the phone numbers already on them.
 */

export const PAYMENT_METHODS = [
  { id: 'zelle', label: 'Zelle' },
  { id: 'ach', label: 'ACH / bank transfer' },
  { id: 'check', label: 'Check' },
  { id: 'cash', label: 'Cash' },
  { id: 'wire', label: 'Wire' },
  { id: 'money-order', label: 'Money order' },
  { id: 'card', label: 'Credit / debit card' },
  { id: 'custom', label: 'Other — describe it' },
] as const

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]['id']

export const methodLabel = (id: PaymentMethodId | undefined, custom?: string): string => {
  if (!id) return 'Not recorded'
  if (id === 'custom') return custom?.trim() || 'Other'
  return PAYMENT_METHODS.find((m) => m.id === id)?.label ?? 'Not recorded'
}

export interface TenantPhone {
  label: string
  number: string
}

export interface TenantProfile {
  leaseId: string
  /** Overrides the name on the rent roll, where the legal name differs. */
  displayName?: string
  businessName?: string
  contactPerson?: string
  email?: string
  phones: TenantPhone[]
  mailingAddress?: string
  /** How this tenant prefers to pay. */
  preferredPayment?: PaymentMethodId
  /** Free text when the method is "custom". */
  customPaymentLabel?: string
  /** Zelle handle, account reference, whatever is needed to reconcile a payment. */
  paymentDetails?: string
  emergencyContact?: string
  notes?: string
  updatedBy?: string
  updatedAt?: string
}

export type TenantProfiles = Record<string, TenantProfile>

/**
 * The profile as it should be shown: whatever has been entered by hand, falling
 * back to the phone numbers the rent roll already carries so the directory is
 * useful before anyone has typed anything.
 */
export function resolveProfile(
  leaseId: string,
  fallbackContacts: { name?: string; phone: string; label?: string }[],
  profiles: TenantProfiles,
): TenantProfile {
  const stored = profiles[leaseId]
  if (stored?.phones?.length) return stored
  // Nothing typed yet, or typed without phone numbers: fall back to whatever the
  // rent roll already carries so the directory is useful from the first visit.
  const phones = fallbackContacts
    .filter((c) => c.phone && c.phone !== '—')
    .map((c) => ({ label: c.name ?? c.label ?? 'Phone', number: c.phone }))
  return { ...stored, leaseId, phones }
}

export const hasProfile = (leaseId: string, profiles: TenantProfiles): boolean =>
  Boolean(profiles[leaseId])

/** How complete a profile is, so gaps are visible rather than assumed filled. */
/* ── One tenant, more than one unit ──────────────────────────────────────── */

/** Digits only, so "708-681-0844" and "(708) 681 0844" are the same line. */
const digits = (s: string): string => s.replace(/\D/g, '')

/**
 * The other leases held by the same tenant.
 *
 * Matched on a shared telephone number rather than on the name in the tenant
 * column, which is written differently from sheet to sheet — "Jean Pedroza" at
 * 1643 N 43rd and "Jean Pedroza — Shop" at 1638A are one man with two units.
 *
 * This matters most where a lease ends. A tenant whose lease at one address has
 * lapsed has not necessarily left: read on its own, the row says a tenant is
 * gone, when in fact he is still in another building on a lease with years to
 * run. Losing a unit and losing a tenant are different events and want
 * different phone calls.
 */
export function relatedLeases<T extends {
  id: string
  tenant: string
  contacts: { phone: string }[]
}>(lease: T, all: T[]): T[] {
  const mine = new Set(lease.contacts.map((c) => digits(c.phone)).filter((d) => d.length >= 10))
  const name = lease.tenant.trim().toLowerCase()
  return all.filter((l) => {
    if (l.id === lease.id) return false
    if (l.contacts.some((c) => mine.has(digits(c.phone)))) return true
    // A name match still counts, but only an exact one: two rows reading
    // "Vacant" or "Apartment" are not one tenant with two units.
    const other = l.tenant.trim().toLowerCase()
    return other === name && mine.size > 0
  })
}

export function profileCompleteness(p: TenantProfile): { filled: number; total: number; missing: string[] } {
  const checks: [string, boolean][] = [
    ['Email', Boolean(p.email?.trim())],
    ['Phone', p.phones.some((x) => x.number.trim())],
    ['Contact person', Boolean(p.contactPerson?.trim())],
    ['Mailing address', Boolean(p.mailingAddress?.trim())],
    ['Payment method', Boolean(p.preferredPayment)],
  ]
  return {
    filled: checks.filter(([, ok]) => ok).length,
    total: checks.length,
    missing: checks.filter(([, ok]) => !ok).map(([name]) => name),
  }
}
