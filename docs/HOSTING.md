# Putting this online so Chicago and Miami see the same numbers

The app runs in two modes. It ships in the first and needs about fifteen minutes
to reach the second.

| | Where data lives | Who sees edits |
|---|---|---|
| **Standalone** (default) | the browser it's open in | that one machine |
| **Shared** | a Supabase database | everyone, within ~20 seconds |

Nothing about the app changes between them. The difference is one config file.

---

## Step 1 — the database (about 5 minutes)

1. Sign up at [supabase.com](https://supabase.com) — the free tier is enough for
   this by a wide margin.
2. Create a project. Any region; pick one near Chicago.
3. Open **SQL Editor**, paste the contents of [`schema.sql`](./schema.sql), and run it.
   That creates the one table the app needs, plus a history table so a bad edit
   can be recovered.
4. Go to **Settings → API** and copy two values: the **Project URL** and the
   **anon public** key.

## Step 2 — point the app at it

Copy `public/config.example.js` to `public/config.js` and paste both values in:

```js
window.NTP_BACKEND = {
  url: 'https://abcdefgh.supabase.co',
  key: 'eyJhbGci…',
}
```

Then `npm run build`. The sidebar will now read **Shared** instead of
**This browser only** — that's how you know it took.

## Step 3 — host it

The build in `dist/` is a plain static site. Any of these work:

- **Netlify** — drag `dist/` onto [app.netlify.com/drop](https://app.netlify.com/drop)
- **Vercel** — `npx vercel deploy dist --prod`
- **Cloudflare Pages** — connect the repo, publish directory `dist`

All three are free at this size and give a URL that works on any device with no
software to install.

---

## Who can get in

The anon key sits inside the published page, so **the site's URL is effectively
the password**. Anyone with the link can read and edit the portfolio.

For a family business where the people involved are you, your father and a couple
of employees, that is usually the right trade — no accounts to manage, no
password resets, and it works from a phone. But be deliberate about it: the data
includes 37 tenants' names, home addresses and phone numbers.

Two ways to tighten it when you want to:

- **Cloudflare Pages + Cloudflare Access** — free for up to 50 people. Puts a
  login in front of the whole site; you list who's allowed by email address.
- **Supabase Auth** — real per-user accounts, and edits get attributed to a real
  identity rather than a typed name. More work, and the right answer if employees
  come and go.

## What happens when two people edit at once

Each area of the app (rent-roll edits, expenses, the tax worksheet) is stored
separately, so two people working in different tabs never collide. Within the
same area, last write wins, and the previous version is kept in
`app_state_history` — nothing is lost, but a simultaneous edit to the same field
can be overwritten. The app polls every 20 seconds, so you see other people's
changes shortly after they make them.

For the size of this team that's fine. If it ever isn't, the fix is Supabase
Realtime, which the storage layer is already shaped for.

## Going back

Delete `config.js` and rebuild. The app returns to browser-only storage without
any other change.
