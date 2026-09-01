import { app, health } from './app.js'
import { migrate } from './db.js'
import { authRequired } from './auth.js'
import { seedOwner } from './users.js'

/**
 * Starting the server.
 *
 * Listen first, migrate second: a managed Postgres is often still starting when
 * the app container is ready, so refusing to listen until the database answers
 * turns a few seconds of normal startup lag into a failed deploy.
 */

/* ── Startup ─────────────────────────────────────────────────────────────── */

const port = process.env.PORT || 3000

// Listen first, migrate second. A managed Postgres is often still starting when
// the app container is ready, so refusing to listen until the database answers
// turns a few seconds of normal startup lag into a failed deploy.
app.listen(port, '0.0.0.0', () => {
  console.log(`New Town Properties listening on 0.0.0.0:${port}`)
  console.log(authRequired()
    ? 'Password protection is ON.'
    : 'WARNING: APP_PASSWORD is not set — anyone with the URL can read and edit the portfolio.')
})

async function connect(attempt = 1) {
  try {
    await migrate()
    // Give the first deployment an owner from APP_PASSWORD, so upgrading to
    // per-person accounts never locks out whoever was already using it.
    const seeded = await seedOwner()
    if (seeded) console.log(`Seeded owner account "${seeded.username}" from APP_PASSWORD.`)
    health.ready = true
    health.error = null
    console.log('Database ready.')
  } catch (err) {
    health.error = err.message
    const missing = !process.env.DATABASE_URL
    console.error(`Database not ready (attempt ${attempt}): ${err.message}`)
    if (missing) {
      console.error(
        'DATABASE_URL is not set on this service. Adding a Postgres database to the\n' +
        'project does not by itself expose it here — add a variable on THIS service:\n' +
        '    DATABASE_URL = ${{Postgres.DATABASE_URL}}',
      )
    }
    if (attempt < 10) {
      const wait = Math.min(30_000, 2 ** attempt * 500)
      setTimeout(() => connect(attempt + 1), wait)
    } else {
      console.error('Giving up after 10 attempts. Fix the database configuration and redeploy.')
    }
  }
}

void connect()
