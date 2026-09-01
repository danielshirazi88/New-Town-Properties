import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_STAFF_SECTIONS, KEY_SECTIONS, SECTIONS, SECTION_IDS, canReach, sectionForKey,
  type AccountSummary,
} from '../src/lib/access'
import { hashPassword, normaliseUsername, passwordMatches } from '../server/users.js'
import { canReach as serverCanReach } from '../server/auth.js'
import { KEY_SECTIONS as SERVER_KEYS, SECTION_IDS as SERVER_SECTION_IDS } from '../server/sections.js'
import { STORE_KEYS } from '../src/lib/store'

const account = (o: Partial<AccountSummary> = {}): AccountSummary => ({
  id: 'a', name: 'Someone', username: 'someone', role: 'staff', sections: [], active: true, ...o,
})

describe('who can reach what', () => {
  it('gives an owner everything, without listing it', () => {
    // Listing every section against each owner would mean a section added later
    // is unreachable by the person who owns the place.
    const owner = account({ role: 'owner', sections: [] })
    for (const s of SECTION_IDS) expect(canReach(owner, s), s).toBe(true)
  })

  it('gives staff only what they hold', () => {
    const fab = account({ sections: ['collection', 'tenants'] })
    expect(canReach(fab, 'collection')).toBe(true)
    expect(canReach(fab, 'tenants')).toBe(true)
    expect(canReach(fab, 'wealth')).toBe(false)
    expect(canReach(fab, 'taxes')).toBe(false)
    expect(canReach(fab, 'team')).toBe(false)
  })

  it('shuts out a deactivated account even where it held sections', () => {
    expect(canReach(account({ sections: ['collection'], active: false }), 'collection')).toBe(false)
    // Deactivating an owner shuts them out too, or turning one off would do nothing.
    expect(canReach(account({ role: 'owner', active: false }), 'dashboard')).toBe(false)
  })

  it('shuts out nobody at all', () => {
    expect(canReach(null, 'dashboard')).toBe(false)
    expect(canReach(undefined, 'dashboard')).toBe(false)
  })

  it('keeps managing people to owners', () => {
    // A staff account handed 'team' by a bad edit still must not manage accounts;
    // the server checks the role, not the section.
    expect(SECTIONS.find((s) => s.id === 'team')?.ownerOnly).toBe(true)
  })

  it('starts an assistant with the operational screens and none of the wealth', () => {
    expect(DEFAULT_STAFF_SECTIONS).not.toContain('wealth')
    expect(DEFAULT_STAFF_SECTIONS).not.toContain('taxes')
    expect(DEFAULT_STAFF_SECTIONS).not.toContain('team')
    expect(DEFAULT_STAFF_SECTIONS).toContain('collection')
  })
})

describe('the browser and the server agree', () => {
  it('maps every stored document to the same section on both sides', () => {
    // The server is JavaScript and the browser TypeScript, so the map is written
    // twice. A key that drifts here is a key the server stops protecting.
    expect(SERVER_KEYS).toEqual(KEY_SECTIONS)
    expect(SERVER_SECTION_IDS).toEqual(SECTION_IDS)
  })

  it('claims every key the app actually stores', () => {
    // An unclaimed key is owner-only by default, which is safe — but it is
    // safer still to notice that nobody assigned it.
    for (const key of Object.values(STORE_KEYS)) {
      expect(sectionForKey(key), `${key} has no section`).toBeDefined()
    }
  })

  it('reaches the same verdict as the browser, account for account', () => {
    const fab = { role: 'staff', sections: ['collection'], active: true }
    for (const s of SECTION_IDS) {
      expect(serverCanReach(fab, s), s).toBe(canReach(account(fab as never), s))
    }
  })
})

/**
 * These read the routing table rather than calling it. The behaviour itself is
 * covered against a real database in `auth-server.test.ts`; this is a guard on
 * the wiring, so a route added later without a check is noticed even where no
 * database is available to run the integration suite.
 */
describe('the server refuses what the browser only hides', () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
  const index = read('../server/app.js')

  it('puts a section check on every route that touches stored state', () => {
    for (const route of [
      "app.get('/api/state/:key', requireAuth, section",
      "app.put('/api/state/:key', requireAuth, section",
      "app.get('/api/history/:key', requireAuth, section",
    ]) expect(index, route).toContain(route)
  })

  it('checks the section on restore, which is addressed by id rather than key', () => {
    // Restoring is a write; reaching it by history id must not skip the check.
    const restore = index.slice(index.indexOf("'/api/history/:id/restore'"))
    expect(restore.slice(0, 900)).toContain('KEY_SECTIONS[entry.key]')
  })

  it('keeps account management behind requireOwner, not behind a hidden tab', () => {
    for (const route of ['/api/accounts', '/api/sign-ins']) {
      const at = index.indexOf(`'${route}'`)
      expect(at, route).toBeGreaterThan(-1)
      expect(index.slice(at, at + 120)).toContain('requireOwner')
    }
  })
})

describe('passwords', () => {
  it('never stores anything reversible', () => {
    const { salt, hash } = hashPassword('correct horse battery staple')
    expect(hash).not.toContain('horse')
    expect(hash).toHaveLength(128)
    expect(salt).toHaveLength(32)
  })

  it('gives a different hash to the same password twice', () => {
    // Per-account salts, so two people who pick the same password do not have
    // matching rows, and one rainbow table does not open both.
    expect(hashPassword('same').hash).not.toBe(hashPassword('same').hash)
  })

  it('accepts the right password and refuses a wrong one', () => {
    const { salt, hash } = hashPassword('a-real-password')
    const record = { password_salt: salt, password_hash: hash }
    expect(passwordMatches('a-real-password', record)).toBe(true)
    expect(passwordMatches('a-real-passwore', record)).toBe(false)
    expect(passwordMatches('', record)).toBe(false)
  })

  it('refuses when there is no such account, without shortcutting', () => {
    // It still hashes, so a missing username costs the same as a wrong password
    // and the two cannot be told apart by how fast the answer comes back.
    expect(passwordMatches('anything', null)).toBe(false)
    expect(passwordMatches('anything', undefined)).toBe(false)
  })

  it('tidies a username so two accounts cannot look alike', () => {
    expect(normaliseUsername('  Fab  ')).toBe('fab')
    expect(normaliseUsername('F A B')).toBe('fab')
    expect(normaliseUsername('fab@office')).toBe('faboffice')
    expect(normaliseUsername('Fab.Ortiz-1_')).toBe('fab.ortiz-1_')
  })
})
