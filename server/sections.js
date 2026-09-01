/**
 * Which section governs each stored document.
 *
 * This is the server's copy of the map in `src/lib/access.ts`. The browser is
 * TypeScript and the server is not, so the two are written out separately — and
 * a test compares them, because a key that drifts out of step here is a key the
 * server stops protecting.
 *
 * A key that appears in neither is owner-only: adding a store key without saying
 * who it belongs to should fail closed rather than quietly become public.
 */
export const KEY_SECTIONS = {
  'overrides.v1': 'properties',
  'expenses.v1': 'expenses',
  'taxes.v1': 'taxes',
  'tenantProfiles.v1': 'tenants',
  'payments.v1': 'collection',
  'collection.v1': 'collection',
  'assets.v1': 'wealth',
  'trust.v1': 'wealth',
}

export const SECTION_IDS = [
  'dashboard', 'properties', 'tenants', 'collection', 'expenses', 'taxes', 'wealth', 'team',
]
