import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Round-trip tests against a real Postgres.
 *
 * These run only when DATABASE_URL points somewhere — locally against a throwaway
 * database, in CI against a service container. They exist because the storage
 * layer had a bug that no amount of front-end testing would have caught: node-pg
 * maps a JavaScript array onto a Postgres array literal, which jsonb rejects, so
 * object payloads saved and array payloads failed with a 500. The expense ledger
 * is an array.
 */

const url = process.env.DATABASE_URL
const suite = url ? describe : describe.skip

suite('state storage', () => {
  let db: typeof import('../server/db.js')

  beforeAll(async () => {
    db = await import('../server/db.js')
    await db.migrate()
  })

  afterAll(async () => {
    await db.db().end()
  })

  it('round-trips an object', async () => {
    const value = { leases: { 'p1-michoacana': { tenant: 'Corrected' } } }
    await db.writeState('test.object', value, 'tester')
    const row = await db.readState('test.object')
    expect(row?.value).toEqual(value)
  })

  it('round-trips an array — the shape the expense ledger uses', async () => {
    const value = [
      { id: 'a', vendor: 'Vega Roofing', amount: 4250, receipts: [] },
      { id: 'b', vendor: 'Alvarez Plumbing', amount: 380, receipts: [] },
    ]
    await db.writeState('test.array', value, 'tester')
    const row = await db.readState('test.array')
    expect(row?.value).toEqual(value)
  })

  it('round-trips an empty array and an empty object', async () => {
    await db.writeState('test.empty-array', [], 'tester')
    expect((await db.readState('test.empty-array'))?.value).toEqual([])
    await db.writeState('test.empty-object', {}, 'tester')
    expect((await db.readState('test.empty-object'))?.value).toEqual({})
  })

  it('records who made the change', async () => {
    await db.writeState('test.author', { a: 1 }, 'Kambiz')
    expect((await db.readState('test.author'))?.updated_by).toBe('Kambiz')
  })

  it('keeps the previous version so an edit can be undone', async () => {
    await db.writeState('test.history', { version: 1 }, 'first')
    await db.writeState('test.history', { version: 2 }, 'second')
    const versions = await db.readHistory('test.history')
    expect(versions.length).toBeGreaterThanOrEqual(1)

    const restored = await db.readHistoryEntry(Number(versions[0].id))
    expect(restored?.value).toEqual({ version: 1 })
  })

  it('returns null for a key that was never written', async () => {
    expect(await db.readState('test.never-written')).toBeNull()
  })
})
