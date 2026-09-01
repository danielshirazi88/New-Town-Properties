import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate, readHistory, readHistoryEntry, readState, writeState } from './db.js'
import {
  accountOf, addressOf, authRequired, clearCookie, issueCookie, requireAuth, requireOwner,
  requireSection,
} from './auth.js'
import {
  MAX_FAILURES, createAccount, deleteAccount, findByUsername, listAccounts, listSignIns,
  normaliseUsername, passwordMatches, recentFailures, recordSignIn, rowToAccount, seedOwner,
  setPassword, updateAccount,
} from './users.js'
import { KEY_SECTIONS } from './sections.js'

/**
 * The New Town Properties application.
 *
 * It does two jobs: serve the built front-end, and keep everyone's edits in one
 * Postgres database so Chicago and Miami are looking at the same numbers.
 *
 * The application's state is a handful of JSON documents, so most of the API is
 * a key-value store with history rather than a modelled schema. Accounts are the
 * exception: a password hash is not a document, and who may read what has to be
 * decided here rather than in the browser.
 *
 * Kept separate from `index.js`, which starts it listening, so the whole HTTP
 * surface can be exercised by the tests — access control is worth testing
 * through the door people actually come in by.
 */

const app = express()
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')

app.disable('x-powered-by')
app.use(express.json({ limit: '5mb' }))

/* ── Session ─────────────────────────────────────────────────────────────── */

app.get('/api/session', async (req, res) => {
  if (!authRequired()) {
    return res.json({ authRequired: false, authenticated: true, account: null })
  }
  const account = await accountOf(req).catch(() => null)
  res.json({ authRequired: true, authenticated: Boolean(account), account })
})

app.post('/api/login', async (req, res) => {
  if (!authRequired()) return res.json({ ok: true })

  const username = normaliseUsername(req.body?.username)
  const ip = addressOf(req)
  const userAgent = req.headers['user-agent']
  const deny = async (outcome, userId = null, status = 401, error = 'wrong_password') => {
    await recordSignIn({ userId, username, outcome, ip, userAgent }).catch(() => {})
    return res.status(status).json({ error })
  }

  try {
    // Slow guessing down before the password is even checked. Counted in the
    // database so a restart does not reset it and every instance shares it.
    if (username && (await recentFailures(username)) >= MAX_FAILURES) {
      return deny('locked_out', null, 429, 'too_many_attempts')
    }

    const row = await findByUsername(username)
    // passwordMatches hashes even when the row is missing, so a wrong username
    // costs the same as a wrong password and cannot be told apart by timing.
    const ok = passwordMatches(req.body?.password, row)
    if (!ok) return deny(row ? 'wrong_password' : 'unknown_user', row?.id ?? null)
    if (!row.active) return deny('disabled', row.id, 403, 'account_disabled')

    const account = rowToAccount(row)
    issueCookie(res, account)
    await recordSignIn({ userId: account.id, username, outcome: 'ok', ip, userAgent })
    res.json({ ok: true, account })
  } catch {
    res.status(500).json({ error: 'sign_in_unavailable' })
  }
})

app.post('/api/logout', (_req, res) => {
  clearCookie(res)
  res.json({ ok: true })
})

/** Anyone signed in may change their own password; nobody else's. */
app.post('/api/password', requireAuth, async (req, res) => {
  if (!authRequired()) return res.json({ ok: true })
  const next = String(req.body?.password ?? '')
  if (next.length < 10) return res.status(400).json({ error: 'too_short' })
  const row = await findByUsername(req.account.username)
  if (!passwordMatches(req.body?.current, row)) {
    return res.status(401).json({ error: 'wrong_password' })
  }
  await setPassword(req.account.id, next, { mustChange: false })
  res.json({ ok: true })
})

/* ── People ──────────────────────────────────────────────────────────────── */

app.get('/api/accounts', requireAuth, requireOwner, async (_req, res) => {
  res.json({ accounts: await listAccounts() })
})

app.post('/api/accounts', requireAuth, requireOwner, async (req, res) => {
  const username = normaliseUsername(req.body?.username)
  const name = String(req.body?.name ?? '').trim().slice(0, 80)
  const password = String(req.body?.password ?? '')
  if (!username || !name) return res.status(400).json({ error: 'name_and_username_required' })
  if (password.length < 10) return res.status(400).json({ error: 'too_short' })
  if (await findByUsername(username)) return res.status(409).json({ error: 'username_taken' })
  const account = await createAccount({
    name,
    username,
    password,
    role: req.body?.role === 'owner' ? 'owner' : 'staff',
    sections: Array.isArray(req.body?.sections) ? req.body.sections : [],
    mustChangePassword: true,
  })
  res.json({ account })
})

app.patch('/api/accounts/:id', requireAuth, requireOwner, async (req, res) => {
  const accounts = await listAccounts()
  const target = accounts.find((a) => a.id === req.params.id)
  if (!target) return res.status(404).json({ error: 'no_such_account' })

  const wouldRemoveLastOwner = target.role === 'owner'
    && (req.body?.role === 'staff' || req.body?.active === false)
    && accounts.filter((a) => a.role === 'owner' && a.active).length <= 1
  if (wouldRemoveLastOwner) return res.status(409).json({ error: 'last_owner' })

  const account = await updateAccount(req.params.id, {
    name: req.body?.name?.trim()?.slice(0, 80),
    role: req.body?.role,
    sections: Array.isArray(req.body?.sections) ? req.body.sections : undefined,
    active: typeof req.body?.active === 'boolean' ? req.body.active : undefined,
  })
  res.json({ account })
})

/** An owner resetting someone's password: the new one must be changed on use. */
app.post('/api/accounts/:id/password', requireAuth, requireOwner, async (req, res) => {
  const password = String(req.body?.password ?? '')
  if (password.length < 10) return res.status(400).json({ error: 'too_short' })
  await setPassword(req.params.id, password, { mustChange: true })
  res.json({ ok: true })
})

app.delete('/api/accounts/:id', requireAuth, requireOwner, async (req, res) => {
  if (req.params.id === req.account?.id) return res.status(409).json({ error: 'cannot_remove_self' })
  const accounts = await listAccounts()
  const target = accounts.find((a) => a.id === req.params.id)
  if (!target) return res.status(404).json({ error: 'no_such_account' })
  if (target.role === 'owner' && accounts.filter((a) => a.role === 'owner').length <= 1) {
    return res.status(409).json({ error: 'last_owner' })
  }
  await deleteAccount(req.params.id)
  res.json({ ok: true })
})

app.get('/api/sign-ins', requireAuth, requireOwner, async (req, res) => {
  res.json({ signIns: await listSignIns({ limit: Number(req.query.limit) || 200 }) })
})

/* ── State ───────────────────────────────────────────────────────────────── */

const KEY = /^[a-zA-Z0-9._-]{1,64}$/

const section = requireSection((key) => KEY_SECTIONS[key])

app.get('/api/state/:key', requireAuth, section, async (req, res) => {
  if (!KEY.test(req.params.key)) return res.status(400).json({ error: 'bad_key' })
  try {
    const row = await readState(req.params.key)
    res.json(row ? { value: row.value, updatedAt: row.updated_at, updatedBy: row.updated_by } : { value: null })
  } catch (err) {
    console.error('read failed', err)
    res.status(500).json({ error: 'read_failed' })
  }
})

app.put('/api/state/:key', requireAuth, section, async (req, res) => {
  if (!KEY.test(req.params.key)) return res.status(400).json({ error: 'bad_key' })
  if (req.body?.value === undefined) return res.status(400).json({ error: 'missing_value' })
  try {
    const who = req.account?.name || req.body?.by || null
    await writeState(req.params.key, req.body.value, who)
    res.json({ ok: true, updatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('write failed', err)
    res.status(500).json({ error: 'write_failed' })
  }
})

/** Previous versions, so a bad edit can be looked at and restored. */
app.get('/api/history/:key', requireAuth, section, async (req, res) => {
  if (!KEY.test(req.params.key)) return res.status(400).json({ error: 'bad_key' })
  try {
    res.json({ versions: await readHistory(req.params.key) })
  } catch (err) {
    console.error('history failed', err)
    res.status(500).json({ error: 'history_failed' })
  }
})

app.post('/api/history/:id/restore', requireAuth, async (req, res) => {
  try {
    const entry = await readHistoryEntry(Number(req.params.id))
    if (!entry) return res.status(404).json({ error: 'not_found' })
    // Addressed by history id rather than by key, so the section has to be read
    // off the entry itself — otherwise restoring is a way round the check.
    if (authRequired()) {
      const needed = KEY_SECTIONS[entry.key]
      const allowed = req.account?.role === 'owner'
        || (needed && (req.account?.sections ?? []).includes(needed))
      if (!allowed) return res.status(403).json({ error: 'not_permitted' })
    }
    await writeState(entry.key, entry.value, req.account?.name ?? null)
    res.json({ ok: true, key: entry.key })
  } catch (err) {
    console.error('restore failed', err)
    res.status(500).json({ error: 'restore_failed' })
  }
})

/**
 * Health.
 *
 * Reports *why* it is unhealthy rather than just failing. A deploy whose
 * database is not wired up should say so in one line, not present as an opaque
 * healthcheck timeout with nothing to go on.
 */
export const health = { ready: false, error: null }

app.get('/api/health', (_req, res) => {
  if (health.ready) return res.json({ ok: true, database: 'connected' })
  res.status(503).json({ ok: false, database: 'unavailable', error: health.error })
})

/* ── Front-end ───────────────────────────────────────────────────────────── */

app.use(express.static(dist, { index: false, maxAge: '1h' }))

// Single-page app: anything not matched above is a client-side route, so serve
// the shell and let the front-end router handle it. Written as a catch-all
// middleware rather than a wildcard path, whose syntax changed in Express 5.
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found' })
  // A missing asset must 404, not fall through to the HTML shell — otherwise the
  // browser parses a page as JavaScript and reports a baffling syntax error.
  if (/\.[a-z0-9]{2,5}$/i.test(req.path)) return res.status(404).end()
  res.sendFile(path.join(dist, 'index.html'))
})


export { app }
