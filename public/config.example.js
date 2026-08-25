// Copy to `config.js` and fill in, then the app reads and writes shared data
// instead of this browser's own storage. Without it everything still works —
// it just stays on one machine.
//
// Both values come from the Supabase dashboard under Settings → API. The anon
// key is meant to be public, but it is the only thing guarding the data, so
// share the site's URL only with people who should see the portfolio.
window.NTP_BACKEND = {
  url: 'https://YOUR-PROJECT.supabase.co',
  key: 'YOUR-ANON-KEY',
  pollSeconds: 20,
}
