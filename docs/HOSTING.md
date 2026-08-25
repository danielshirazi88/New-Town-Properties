# Deploying to Railway

Same shape as the FGL platform: GitHub for the code, Railway for the server and
the database, deploying on every push. Roughly ten minutes end to end.

## What gets deployed

One Railway service running `server/index.js`, which does two jobs:

- serves the built front-end from `dist/`
- keeps everyone's edits in Postgres, so Chicago and Miami see the same numbers

There is no separate front-end host and no API key in the page. The database
credentials stay on the server.

---

## 1. Create the project

1. Railway → **New Project → Deploy from GitHub repo** → pick this repository.
2. In the same project: **New → Database → Add PostgreSQL**.

**Then connect them.** Adding the database to the project does *not* by itself
make it visible to the app. On the app service, go to **Variables** and add a
reference:

```
DATABASE_URL = ${{Postgres.DATABASE_URL}}
```

Type `${{` in the value box and Railway offers the database's variables. This is
the step that is easy to miss, and the symptom is a **healthcheck failure** with
a build and deploy that both went green.

The app creates its own tables on first boot — there is no schema to run by hand.

## 2. Set two variables

On the service, under **Variables**:

| Variable | Value |
|---|---|
| `APP_PASSWORD` | the passphrase everyone types to get in |
| `SESSION_SECRET` | any long random string — `openssl rand -hex 32` |

`APP_PASSWORD` is what turns the login on. **Leave it unset and the site is open
to anyone with the URL** — the server logs a warning at startup saying so.

## 3. Generate the URL

**Settings → Networking → Generate Domain.** That's the link you send your father.

Push to the branch and Railway rebuilds and redeploys on its own. No files to
email, nothing for him to install.

---

## When the healthcheck fails

`/api/health` answers even when the database is unreachable, and says why:

```json
{"ok":false,"database":"unavailable","error":"DATABASE_URL is not set — …"}
```

The deploy logs carry the same message, plus the exact variable to add. The
server retries the connection ten times with backoff before giving up, so a
database that is merely slow to start resolves itself.

## Checking it worked

- The sidebar reads **Shared — everyone sees these numbers** rather than
  *This browser only*.
- `https://your-app.up.railway.app/api/health` returns `{"ok":true}`.
- Deploy logs say `Password protection is ON.`

## How people use it

Everyone opens the same URL, types the passphrase once, and enters their name.
The name is not a login — it is so an edit made in Chicago shows up in Miami
attributed to whoever made it. The session lasts 30 days per device.

## If two people edit at once

Each area (rent-roll edits, expenses, the tax worksheet) is stored separately, so
two people working in different parts of the app never collide. Within one area,
last write wins — and the version it replaced is kept in `app_state_history`, so
nothing is actually lost. The app polls every 15 seconds and catches up
immediately when you return to the tab.

For a handful of people that is the right trade. If it ever isn't, the storage
layer is already shaped for websockets.

## Recovering a bad edit

Every save keeps the version before it:

```sql
select id, saved_at, saved_by from app_state_history
where key = 'overrides.v1' order by saved_at desc limit 20;
```

`POST /api/history/:id/restore` puts one back. Individual rent-roll edits can
also be reverted one at a time from the Edit dialog, which is usually what you
want.

## Running it locally

```bash
npm install
npm run build
DATABASE_URL=postgresql://localhost/ntp APP_PASSWORD=test npm start
```

Without `DATABASE_URL` the server will not start — that is deliberate, so a
misconfigured deploy fails loudly instead of quietly losing data. With no server
at all (`npm run dev`, or opening the built file directly) the app falls back to
browser storage and still works, single-machine.

## Costs

Railway's usage plan covers a service plus a small Postgres for a few dollars a
month at this size. The database holds JSON documents measured in kilobytes.
