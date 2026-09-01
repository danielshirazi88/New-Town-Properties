import crypto from 'node:crypto'
import { db } from './db.js'

/**
 * Accounts, passwords and the record of who signed in.
 *
 * Passwords are stored as scrypt hashes with a per-account salt, never as
 * anything reversible. scrypt is deliberately slow and memory-hard, so a stolen
 * database does not become a list of passwords — which matters more than usual
 * here, because people reuse them.
 */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }

export const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => ({
  salt,
  hash: crypto.scryptSync(String(password), salt, SCRYPT.keylen, SCRYPT).toString('hex'),
})

/**
 * Check a password without leaking, through timing, how much of it was right.
 *
 * A wrong username is made to cost the same as a wrong password by hashing
 * anyway against a throwaway salt; otherwise the speed of the answer tells an
 * attacker which usernames exist.
 */
export function passwordMatches(password, record) {
  const salt = record?.password_salt ?? 'absent'
  const expected = record?.password_hash ?? crypto.randomBytes(SCRYPT.keylen).toString('hex')
  const actual = crypto.scryptSync(String(password ?? ''), salt, SCRYPT.keylen, SCRYPT).toString('hex')
  const a = Buffer.from(actual, 'hex')
  const b = Buffer.from(expected, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b) && Boolean(record)
}

/** Usernames are lowercase and punctuation-free, so they cannot be near-duplicates. */
export const normaliseUsername = (raw) =>
  String(raw ?? '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')

const rowToAccount = (r) => ({
  id: r.id,
  name: r.name,
  username: r.username,
  role: r.role,
  sections: r.sections ?? [],
  active: r.active,
  createdAt: r.created_at,
  lastSeenAt: r.last_seen_at,
  mustChangePassword: r.must_change_password,
})

export async function listAccounts() {
  const { rows } = await db().query(
    `select id, name, username, role, sections, active, created_at, last_seen_at,
            must_change_password
       from app_user order by role, name`,
  )
  return rows.map(rowToAccount)
}

export async function findByUsername(username) {
  const { rows } = await db().query('select * from app_user where username = $1', [
    normaliseUsername(username),
  ])
  return rows[0] ?? null
}

export async function findById(id) {
  const { rows } = await db().query('select * from app_user where id = $1', [id])
  return rows[0] ?? null
}

export async function countAccounts() {
  const { rows } = await db().query('select count(*)::int as n from app_user')
  return rows[0].n
}

export async function createAccount({ name, username, password, role, sections, mustChangePassword = true }) {
  const { salt, hash } = hashPassword(password)
  const id = crypto.randomUUID()
  await db().query(
    `insert into app_user
       (id, name, username, role, sections, password_hash, password_salt, must_change_password)
     values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
    [id, name, normaliseUsername(username), role, JSON.stringify(sections ?? []), hash, salt,
      mustChangePassword],
  )
  return findById(id).then(rowToAccount)
}

export async function updateAccount(id, { name, role, sections, active }) {
  await db().query(
    `update app_user set
       name     = coalesce($2, name),
       role     = coalesce($3, role),
       sections = coalesce($4::jsonb, sections),
       active   = coalesce($5, active)
     where id = $1`,
    [id, name ?? null, role ?? null, sections ? JSON.stringify(sections) : null,
      active === undefined ? null : active],
  )
  const row = await findById(id)
  return row ? rowToAccount(row) : null
}

export async function setPassword(id, password, { mustChange = false } = {}) {
  const { salt, hash } = hashPassword(password)
  await db().query(
    `update app_user set password_hash = $2, password_salt = $3, must_change_password = $4
     where id = $1`,
    [id, hash, salt, mustChange],
  )
}

export async function deleteAccount(id) {
  await db().query('delete from app_user where id = $1', [id])
}

export const touchLastSeen = (id) =>
  db().query('update app_user set last_seen_at = now() where id = $1', [id])

/* ── The sign-in record ──────────────────────────────────────────────────── */

/**
 * Every attempt is written down, successful or not.
 *
 * Failures are the half worth having: three wrong passwords against an account
 * at two in the morning is the only warning this application will ever give.
 */
export async function recordSignIn({ userId, username, outcome, ip, userAgent }) {
  await db().query(
    `insert into sign_in_log (user_id, username, outcome, ip, user_agent)
     values ($1, $2, $3, $4, $5)`,
    [userId ?? null, String(username ?? '').slice(0, 120), outcome,
      String(ip ?? '').slice(0, 60) || null, String(userAgent ?? '').slice(0, 300) || null],
  )
}

export async function listSignIns({ limit = 200 } = {}) {
  const { rows } = await db().query(
    `select l.id, l.user_id, l.username, l.outcome, l.at, l.ip, l.user_agent, u.name
       from sign_in_log l
       left join app_user u on u.id = l.user_id
      order by l.at desc
      limit $1`,
    [Math.min(500, Math.max(1, limit))],
  )
  return rows.map((r) => ({
    id: String(r.id),
    userId: r.user_id,
    username: r.username,
    name: r.name,
    outcome: r.outcome,
    at: r.at,
    ip: r.ip,
    userAgent: r.user_agent,
  }))
}

/**
 * How many times this account has been refused recently.
 *
 * Used to slow down guessing: a handful of wrong passwords in a quarter of an
 * hour locks the account out for the rest of it. It is counted in the database
 * rather than in memory so that restarting the server does not clear it, and so
 * that it holds across however many instances are running.
 */
export async function recentFailures(username, minutes = 15) {
  const { rows } = await db().query(
    `select count(*)::int as n from sign_in_log
      where username = $1 and outcome <> 'ok' and at > now() - ($2 || ' minutes')::interval`,
    [normaliseUsername(username), String(minutes)],
  )
  return rows[0].n
}

export const MAX_FAILURES = 8

/* ── First run ───────────────────────────────────────────────────────────── */

/**
 * Give the first deployment an owner, so nobody is locked out by the upgrade.
 *
 * Before accounts existed there was one shared passphrase in APP_PASSWORD. That
 * passphrase becomes the owner's password, and the username defaults to
 * `owner` — so whoever was already using the application signs in with what
 * they already know plus a name they can be told once.
 */
export async function seedOwner() {
  if (await countAccounts()) return null
  const password = process.env.APP_PASSWORD
  if (!password) return null
  return createAccount({
    name: process.env.OWNER_NAME || 'Mr. Shirazi',
    username: normaliseUsername(process.env.OWNER_USERNAME || 'owner'),
    password,
    role: 'owner',
    sections: [],
    // It is the passphrase they already use, so it is not a temporary one.
    mustChangePassword: false,
  })
}

export { rowToAccount }
