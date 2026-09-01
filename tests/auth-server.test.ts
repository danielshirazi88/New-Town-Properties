import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * The sign-in flow against a real Postgres and a real Express app.
 *
 * Access control is the one part of this application where being wrong is not a
 * wrong number on a screen — it is the office assistant reading the trust's
 * schedule of assets. So it is tested through the actual HTTP surface, cookies
 * and all, rather than by calling the helpers underneath it.
 *
 * Runs only when DATABASE_URL points somewhere.
 */

const url = process.env.DATABASE_URL
const suite = url ? describe : describe.skip

suite('accounts, sign-in and what each person can reach', () => {
  let server: import('node:http').Server
  let base: string
  let db: typeof import('../server/db.js')
  let users: typeof import('../server/users.js')

  /** Fetch that carries one account's cookie, the way a browser would. */
  const as = (jar: { cookie?: string }) => async (path: string, init: RequestInit = {}) => {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(jar.cookie ? { cookie: jar.cookie } : {}),
        ...(init.headers ?? {}),
      },
    })
    const set = res.headers.get('set-cookie')
    if (set) jar.cookie = set.split(';')[0]
    return res
  }

  const signIn = async (username: string, password: string) => {
    const jar: { cookie?: string } = {}
    const res = await as(jar)('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    return { res, jar, body: await res.json().catch(() => ({})) }
  }

  const owner: { cookie?: string } = {}
  let fabId = ''

  beforeAll(async () => {
    process.env.APP_PASSWORD = 'owner-passphrase-for-tests'
    process.env.SESSION_SECRET = 'test-session-secret'
    process.env.OWNER_USERNAME = 'shirazi'

    db = await import('../server/db.js')
    users = await import('../server/users.js')
    await db.db().query(
      'drop table if exists sign_in_log, app_user, app_state_history, app_state cascade',
    )
    await db.migrate()
    await users.seedOwner()

    const { app } = await import('../server/app.js')
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address()
        base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
        resolve()
      })
    })

    const { jar } = await signIn('shirazi', 'owner-passphrase-for-tests')
    owner.cookie = jar.cookie
  }, 40_000)

  afterAll(async () => {
    server?.close()
    await db?.db().end().catch(() => {})
  })

  it('turns the old shared passphrase into an owner account', async () => {
    // Nobody should be locked out by the upgrade to per-person accounts.
    const res = await as(owner)('/api/session')
    const body = await res.json()
    expect(body.authenticated).toBe(true)
    expect(body.account.username).toBe('shirazi')
    expect(body.account.role).toBe('owner')
  })

  it('refuses a wrong password and a username that does not exist alike', async () => {
    expect((await signIn('shirazi', 'not-it')).res.status).toBe(401)
    expect((await signIn('nobody', 'not-it')).res.status).toBe(401)
  })

  it('lets an owner create the assistant with only the sections she needs', async () => {
    const res = await as(owner)('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Fab',
        username: 'fab',
        password: 'temporary-one-time',
        role: 'staff',
        sections: ['collection', 'tenants', 'expenses'],
      }),
    })
    expect(res.status).toBe(200)
    const { account } = await res.json()
    fabId = account.id
    expect(account.role).toBe('staff')
    expect(account.mustChangePassword).toBe(true)
  })

  it('will not take a second account on the same username', async () => {
    const res = await as(owner)('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Someone else', username: 'fab', password: 'another-one-here' }),
    })
    expect(res.status).toBe(409)
  })

  it('will not take a password short enough to guess', async () => {
    const res = await as(owner)('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Short', username: 'short', password: 'abc123' }),
    })
    expect(res.status).toBe(400)
  })

  it('serves Fab the documents she holds', async () => {
    const { jar } = await signIn('fab', 'temporary-one-time')
    for (const key of ['payments.v1', 'tenantProfiles.v1', 'expenses.v1']) {
      expect((await as(jar)(`/api/state/${key}`)).status, key).toBe(200)
    }
  })

  it('refuses Fab the documents she does not, even asking the server directly', async () => {
    // This is the test that matters: hiding the tab is manners, this is the lock.
    const { jar } = await signIn('fab', 'temporary-one-time')
    for (const key of ['trust.v1', 'assets.v1', 'taxes.v1']) {
      expect((await as(jar)(`/api/state/${key}`)).status, `read ${key}`).toBe(403)
      const write = await as(jar)(`/api/state/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value: { sneaked: true } }),
      })
      expect(write.status, `write ${key}`).toBe(403)
    }
  })

  it('refuses Fab the account management and the sign-in log', async () => {
    const { jar } = await signIn('fab', 'temporary-one-time')
    expect((await as(jar)('/api/accounts')).status).toBe(403)
    expect((await as(jar)('/api/sign-ins')).status).toBe(403)
    const promote = await as(jar)(`/api/accounts/${fabId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'owner' }),
    })
    expect(promote.status).toBe(403)
  })

  it('records every attempt, refused ones included', async () => {
    await signIn('fab', 'wrong-on-purpose')
    const { signIns } = await (await as(owner)('/api/sign-ins')).json()
    const fabs = signIns.filter((s: { username: string }) => s.username === 'fab')
    expect(fabs.some((s: { outcome: string }) => s.outcome === 'ok')).toBe(true)
    expect(fabs.some((s: { outcome: string }) => s.outcome === 'wrong_password')).toBe(true)
    // The owner can see when she signed in, which is the point of the exercise.
    expect(fabs[0].at).toBeTruthy()
  })

  it('takes a section away and the server stops serving it at once', async () => {
    // No waiting for a cookie to expire: what an account may reach is read from
    // the database on every request.
    const { jar } = await signIn('fab', 'temporary-one-time')
    expect((await as(jar)('/api/state/payments.v1')).status).toBe(200)
    await as(owner)(`/api/accounts/${fabId}`, {
      method: 'PATCH',
      body: JSON.stringify({ sections: ['tenants'] }),
    })
    expect((await as(jar)('/api/state/payments.v1')).status).toBe(403)
    await as(owner)(`/api/accounts/${fabId}`, {
      method: 'PATCH',
      body: JSON.stringify({ sections: ['collection', 'tenants', 'expenses'] }),
    })
  })

  it('turns an account off mid-session and the cookie stops working', async () => {
    const { jar } = await signIn('fab', 'temporary-one-time')
    expect((await as(jar)('/api/state/payments.v1')).status).toBe(200)
    await as(owner)(`/api/accounts/${fabId}`, {
      method: 'PATCH', body: JSON.stringify({ active: false }),
    })
    expect((await as(jar)('/api/state/payments.v1')).status).toBe(401)
    expect((await signIn('fab', 'temporary-one-time')).res.status).toBe(403)
    await as(owner)(`/api/accounts/${fabId}`, {
      method: 'PATCH', body: JSON.stringify({ active: true }),
    })
  })

  it('lets Fab change her own password and nobody else’s', async () => {
    const { jar } = await signIn('fab', 'temporary-one-time')
    const wrongCurrent = await as(jar)('/api/password', {
      method: 'POST',
      body: JSON.stringify({ current: 'not-my-password', password: 'her-own-choice-now' }),
    })
    expect(wrongCurrent.status).toBe(401)

    const ok = await as(jar)('/api/password', {
      method: 'POST',
      body: JSON.stringify({ current: 'temporary-one-time', password: 'her-own-choice-now' }),
    })
    expect(ok.status).toBe(200)
    expect((await signIn('fab', 'temporary-one-time')).res.status).toBe(401)
    expect((await signIn('fab', 'her-own-choice-now')).res.status).toBe(200)
  })

  it('refuses to leave the place without an owner', async () => {
    const me = await (await as(owner)('/api/session')).json()
    const demote = await as(owner)(`/api/accounts/${me.account.id}`, {
      method: 'PATCH', body: JSON.stringify({ role: 'staff' }),
    })
    expect(demote.status).toBe(409)
    const remove = await as(owner)(`/api/accounts/${me.account.id}`, { method: 'DELETE' })
    expect(remove.status).toBe(409)
  })

  it('locks an account out after a run of wrong passwords', async () => {
    for (let i = 0; i < 10; i += 1) await signIn('fab', `guess-number-${i}`)
    const after = await signIn('fab', 'her-own-choice-now')
    // Right password, still refused — the lockout does not care.
    expect(after.res.status).toBe(429)
  })
})
