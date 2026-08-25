import type { ApolloTenant, Contact, Lease, LeaseType, MonthCell, Property } from './types'

/**
 * Corrections made by hand, layered over the transcribed source documents.
 *
 * The source data is never mutated. Every edit is stored as a patch keyed by
 * record id, so the original figure from the workbook stays available, the app
 * can show what was changed and by whom, and any edit can be undone by deleting
 * its patch. That matters here: the underlying documents are the audit trail for
 * a real portfolio, and an app that quietly overwrites them would destroy it.
 */

export interface EditMeta {
  /** Who made the change — free text, since there are no accounts. */
  by?: string
  at: string
  note?: string
}

export interface LeaseOverride {
  tenant?: string
  unit?: string
  months?: MonthCell[]
  leaseStart?: string | null
  leaseEnd?: string | null
  statedEscalationPct?: number | null
  leaseType?: LeaseType
  squareFeet?: number | null
  notes?: string
  contacts?: Contact[]
  meta?: EditMeta
}

export interface PropertyOverride {
  name?: string
  address?: string
  city?: string
  state?: string
  taxBill?: number
  taxBillYear?: number
  notes?: string
  meta?: EditMeta
}

export interface ApolloOverride {
  name?: string
  address?: string
  amountDue?: number
  flagged?: boolean
  meta?: EditMeta
}

export interface Overrides {
  leases: Record<string, LeaseOverride>
  properties: Record<string, PropertyOverride>
  apollo: Record<string, ApolloOverride>
  /** Lot tenants and lease rows added by hand rather than transcribed. */
  addedLeases: Lease[]
  addedApollo: ApolloTenant[]
  /** Ids of source records the user has removed from view. */
  removed: string[]
}

export const EMPTY_OVERRIDES: Overrides = {
  leases: {},
  properties: {},
  apollo: {},
  addedLeases: [],
  addedApollo: [],
  removed: [],
}

/** Drop keys whose value is undefined so a patch never blanks a field by accident. */
function defined<T extends object>(patch: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) out[k] = v
  return out as Partial<T>
}

/** `null` in a patch means "clear this field"; undefined means "leave it alone". */
function merge<T extends object, P extends object>(base: T, patch: P | undefined): T {
  if (!patch) return base
  const out = { ...base } as Record<string, unknown>
  for (const [k, v] of Object.entries(defined(patch))) {
    if (k === 'meta') continue
    out[k] = v === null ? undefined : v
  }
  return out as T
}

export function applyLeaseOverrides(leases: Lease[], o: Overrides): Lease[] {
  const patched = leases
    .filter((l) => !o.removed.includes(l.id))
    .map((l) => merge(l, o.leases[l.id]))
  return [...patched, ...o.addedLeases.filter((l) => !o.removed.includes(l.id))]
}

export function applyPropertyOverrides(properties: Property[], o: Overrides): Property[] {
  return properties
    .filter((p) => !o.removed.includes(p.id))
    .map((p) => {
      const patched = merge(p, o.properties[p.id])
      // Keep the printed net consistent when the tax bill is corrected by hand.
      return o.properties[p.id]?.taxBill !== undefined
        ? { ...patched, statedNetAfterTax: patched.statedGross - patched.taxBill }
        : patched
    })
}

export function applyApolloOverrides(tenants: ApolloTenant[], o: Overrides): ApolloTenant[] {
  const patched = tenants
    .filter((t) => !o.removed.includes(t.id))
    .map((t) => merge(t, o.apollo[t.id]))
  return [...patched, ...o.addedApollo.filter((t) => !o.removed.includes(t.id))]
}

export const isLeaseEdited = (o: Overrides, id: string): boolean => Boolean(o.leases[id])
export const isPropertyEdited = (o: Overrides, id: string): boolean => Boolean(o.properties[id])
export const isApolloEdited = (o: Overrides, id: string): boolean => Boolean(o.apollo[id])

export function editCount(o: Overrides): number {
  return (
    Object.keys(o.leases).length +
    Object.keys(o.properties).length +
    Object.keys(o.apollo).length +
    o.addedLeases.length +
    o.addedApollo.length +
    o.removed.length
  )
}

/** Which fields a patch actually changes, for showing "3 fields edited". */
export function changedFields(patch: object | undefined): string[] {
  if (!patch) return []
  return Object.keys(defined(patch as Record<string, unknown>)).filter((k) => k !== 'meta')
}
