import crypto from 'node:crypto'

/**
 * A single shared passphrase, held in an environment variable and never in the
 * code or the page.
 *
 * This is deliberately modest: the people using it are one family and a couple
 * of employees, and anything with per-user accounts would mean managing
 * accounts. What it does buy is that the portfolio — which carries tenants'
 * names, home addresses and phone numbers — is not readable by anyone who
 * happens on the URL.
 *
 * Set APP_PASSWORD to switch it on. With it unset the server runs open, which
 * is only appropriate on a local machine.
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

export function issueCookie(res, name) {
  const token = sign({ name, exp: Date.now() + MAX_AGE_DAYS * 864e5 })
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

/** Compare the submitted passphrase without leaking its length through timing. */
export function passwordMatches(submitted) {
  const expected = process.env.APP_PASSWORD ?? ''
  const a = crypto.createHash('sha256').update(String(submitted ?? '')).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

export function requireAuth(req, res, next) {
  if (!authRequired()) return next()
  if (sessionOf(req)) return next()
  res.status(401).json({ error: 'not_authenticated' })
}
