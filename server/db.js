import pg from 'pg'

/**
 * Postgres access.
 *
 * The whole application stores its state as JSON documents under well-known
 * keys, so there is exactly one table and adding a feature never needs a
 * migration. A second table keeps the previous version of every document, which
 * is what makes a bad edit recoverable rather than final.
 */

const { Pool } = pg

let pool

export function db() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set — add a Postgres database to the Railway project.')
    }
    pool = new Pool({
      connectionString,
      // Railway's managed Postgres presents a certificate the default trust
      // store does not carry; the connection is still TLS.
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 5,
    })
  }
  return pool
}

export async function migrate() {
  const sql = `
    create table if not exists app_state (
      key        text primary key,
      value      jsonb not null,
      updated_at timestamptz not null default now(),
      updated_by text
    );

    create table if not exists app_state_history (
      id       bigserial primary key,
      key      text not null,
      value    jsonb not null,
      saved_at timestamptz not null default now(),
      saved_by text
    );

    create index if not exists app_state_history_key_idx
      on app_state_history (key, saved_at desc);
  `
  await db().query(sql)
}

export async function readState(key) {
  const { rows } = await db().query('select value, updated_at, updated_by from app_state where key = $1', [key])
  return rows[0] ?? null
}

/**
 * node-pg maps a JavaScript array onto a Postgres *array literal*, which jsonb
 * rejects — so an object payload saves and an array payload fails. Serialise
 * here and let Postgres parse it as JSON regardless of the shape.
 */
const toJson = (value) => JSON.stringify(value)

export async function writeState(key, value, updatedBy) {
  const client = await db().connect()
  try {
    await client.query('begin')
    // Keep the outgoing version before replacing it.
    await client.query(
      `insert into app_state_history (key, value, saved_by)
       select key, value, updated_by from app_state where key = $1`,
      [key],
    )
    await client.query(
      `insert into app_state (key, value, updated_at, updated_by)
       values ($1, $2, now(), $3)
       on conflict (key) do update
         set value = excluded.value,
             updated_at = excluded.updated_at,
             updated_by = excluded.updated_by`,
      [key, toJson(value), updatedBy ?? null],
    )
    await client.query('commit')
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    client.release()
  }
}

export async function readHistory(key, limit = 20) {
  const { rows } = await db().query(
    'select id, saved_at, saved_by from app_state_history where key = $1 order by saved_at desc limit $2',
    [key, limit],
  )
  return rows
}

export async function readHistoryEntry(id) {
  const { rows } = await db().query('select key, value, saved_at from app_state_history where id = $1', [id])
  return rows[0] ?? null
}
