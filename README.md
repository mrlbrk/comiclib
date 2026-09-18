# ComicLib V5.28 — Cloudflare Worker + Static Assets

This version is built for a `*.workers.dev` deployment, not Pages Functions.

Structure:
- `src/index.js` — Worker API routes and static asset fallback
- `public/index.html` — ComicLib UI
- `wrangler.json` — Workers Static Assets configuration

API routes:
- `/api/cover?isbn=...`
- `/api/br-search?q=...`
- `/api/amazon-search?q=...&market=es|br`

The Worker explicitly routes `/api/*` before serving the static application.
