import crypto from 'node:crypto'
import { findById, rowToAccount, touchLastSeen } from './users.js'

/**
 * Sessions.
 *
 * A signed cookie carries the account id and nothing else that matters. What the
 * account is *allowed* to do is read from the database on every request rather
 * than baked into the cookie, so revoking someone's access takes effect on their
 * next click instead of whenever their cookie happens to expire.
 *
 * Set APP_PASSWORD to switch authentication on. With it unset the server runs
 * open, which is only appropriate on a local machine.
 */

const COOKIE = 'ntp_session'
const MAX_AGE_DAYS = 30

const secret = () =>
  process.env.SESSION_SECRET ||
  process.env.APP_PASSWORD ||
  'insecure-development-secret'

export const authRequired = () => Boolean(process.env.APP_PASSWORD)

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${mac}`
}

function verify(token) {
  if (!token || !token.includes('.')) return null
  const [body, mac] = token.split('.')
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url')
  // Constant-time compare so the signature cannot be guessed a byte at a time.
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    return payload.exp > Date.now() ? payload : null
  } catch {
    return null
  }
}

export function issueCookie(res, account) {
  const token = sign({ uid: account.id, exp: Date.now() + MAX_AGE_DAYS * 864e5 })
  const parts = [
    `${COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE_DAYS * 86400}`,
  ]
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

export function clearCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

function readCookie(req) {
  const header = req.headers.cookie
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === COOKIE) return rest.join('=')
  }
  return null
}

export const sessionOf = (req) => verify(readCookie(req))

/**
 * The account behind a request, read fresh from the database.
 *
 * Deactivating someone therefore cuts them off immediately: their cookie still
 * verifies, but the account it names is no longer usable.
 */
export async function accountOf(req) {
  const session = sessionOf(req)
  if (!session?.uid) return null
  const row = await findById(session.uid)
  if (!row || !row.active) return null
  return rowToAccount(row)
}

/**
 * An owner reaches everything. Kept identical to the browser's copy in
 * `src/lib/access.ts` — the browser hides, this refuses.
 */
export const canReach = (account, section) => {
  if (!account || !account.active) return false
  if (account.role === 'owner') return true
  return (account.sections ?? []).includes(section)
}

/** Attach the account to the request, or refuse it. */
export function requireAuth(req, res, next) {
  if (!authRequired()) return next()
  accountOf(req)
    .then((account) => {
      if (!account) return res.status(401).json({ error: 'not_authenticated' })
      req.account = account
      // Fire and forget: a failed timestamp update must not fail the request.
      touchLastSeen(account.id).catch(() => {})
      next()
    })
    .catch(() => res.status(500).json({ error: 'auth_unavailable' }))
}

export function requireOwner(req, res, next) {
  if (!authRequired()) return next()
  if (req.account?.role === 'owner') return next()
  res.status(403).json({ error: 'owner_only' })
}

/**
 * Refuse a request for a document the account's sections do not cover.
 *
 * A key nobody has claimed is owner-only by default. Adding a store key without
 * saying who it belongs to should fail closed, not quietly hand it to everyone.
 */
export const requireSection = (sectionForKey) => (req, res, next) => {
  if (!authRequired()) return next()
  const section = sectionForKey(req.params.key)
  if (!section) {
    return req.account?.role === 'owner'
      ? next()
      : res.status(403).json({ error: 'not_permitted' })
  }
  if (canReach(req.account, section)) return next()
  res.status(403).json({ error: 'not_permitted', section })
}

/** The caller's address, honouring the proxy Railway puts in front. */
export const addressOf = (req) =>
  String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() ||
  req.socket?.remoteAddress || ''
