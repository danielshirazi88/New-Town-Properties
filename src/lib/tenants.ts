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
