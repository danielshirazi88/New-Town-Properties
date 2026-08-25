import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate, readHistory, readHistoryEntry, readState, writeState } from './db.js'
import { authRequired, clearCookie, issueCookie, passwordMatches, requireAuth, sessionOf } from './auth.js'

/**
 * The New Town Properties server.
 *
 * It does two jobs: serve the built front-end, and keep everyone's edits in one
 * Postgres database so Chicago and Miami are looking at the same numbers.
 *
 * Deliberately small. The application's state is a handful of JSON documents,
 * so the API is a key-value store with history rather than a modelled schema —
 * adding a feature to the front-end never requires a migration back here.
 */

const app = express()
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')

app.disable('x-powered-by')
app.use(express.json({ limit: '5mb' }))

/* ── Session ─────────────────────────────────────────────────────────────── */

app.get('/api/session', (req, res) => {
  res.json({
    authRequired: authRequired(),
    authenticated: !authRequired() || Boolean(sessionOf(req)),
    name: sessionOf(req)?.name ?? null,
  })
})

app.post('/api/login', (req, res) => {
  if (!authRequired()) return res.json({ ok: true })
  if (!passwordMatches(req.body?.password)) {
    return res.status(401).json({ error: 'wrong_password' })
  }
  issueCookie(res, String(req.body?.name ?? '').slice(0, 60))
  res.json({ ok: true })
})

app.post('/api/logout', (_req, res) => {
  clearCookie(res)
  res.json({ ok: true })
})

/* ── State ───────────────────────────────────────────────────────────────── */

const KEY = /^[a-zA-Z0-9._-]{1,64}$/

app.get('/api/state/:key', requireAuth, async (req, res) => {
  if (!KEY.test(req.params.key)) return res.status(400).json({ error: 'bad_key' })
  try {
    const row = await readState(req.params.key)
    res.json(row ? { value: row.value, updatedAt: row.updated_at, updatedBy: row.updated_by } : { value: null })
  } catch (err) {
    console.error('read failed', err)
    res.status(500).json({ error: 'read_failed' })
  }
})

app.put('/api/state/:key', requireAuth, async (req, res) => {
  if (!KEY.test(req.params.key)) return res.status(400).json({ error: 'bad_key' })
  if (req.body?.value === undefined) return res.status(400).json({ error: 'missing_value' })
  try {
    const who = sessionOf(req)?.name || req.body?.by || null
    await writeState(req.params.key, req.body.value, who)
    res.json({ ok: true, updatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('write failed', err)
    res.status(500).json({ error: 'write_failed' })
  }
})

/** Previous versions, so a bad edit can be looked at and restored. */
app.get('/api/history/:key', requireAuth, async (req, res) => {
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
    await writeState(entry.key, entry.value, sessionOf(req)?.name ?? null)
    res.json({ ok: true, key: entry.key })
  } catch (err) {
    console.error('restore failed', err)
    res.status(500).json({ error: 'restore_failed' })
  }
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))

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

const port = process.env.PORT || 3000
migrate()
  .then(() => {
    app.listen(port, () => {
      console.log(`New Town Properties on :${port}`)
      console.log(authRequired() ? 'Password protection is ON.' : 'WARNING: APP_PASSWORD not set — the site is open.')
    })
  })
  .catch((err) => {
    console.error('Could not start: database migration failed.', err)
    process.exit(1)
  })
