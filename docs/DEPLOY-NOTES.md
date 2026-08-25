# Why the build command is what it is

`railway.json` builds with:

```
npm install --include=dev --no-audit --no-fund && npm run build
```

Two deliberate choices, both of which broke the first deploy.

**`npm install`, not `npm ci`.** `npm ci` deletes `node_modules` wholesale before
installing. Railway mounts its build cache *inside* that directory, at
`/app/node_modules/.cache`, and a mount point cannot be removed — so the install
dies with `EBUSY: resource busy or locked, rmdir '/app/node_modules/.cache'`
before it has installed anything. `npm install` updates in place and leaves the
mount alone.

**`--include=dev`.** Railway sets `NODE_ENV=production`, under which npm skips
devDependencies. Vite and TypeScript are devDependencies — they build the app and
are not needed once it is built — so without this the install "succeeds" and the
build then fails with `vite: not found`. The flag forces them in regardless of
`NODE_ENV`, and they stay out of the runtime image's dependency set.

The server itself needs no build step: it is plain JavaScript, so `npm start`
runs `node server/index.js` directly.
