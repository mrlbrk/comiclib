# Panel Comic Collection V5.23

Cloudflare Pages-ready build.

Repository structure:
- index.html
- _routes.json
- functions/api/amazon-search.js
- functions/api/cover.js

The API functions are under `functions/api/` so Cloudflare Pages maps them to `/api/amazon-search` and `/api/cover`.

Cloudflare Pages Git integration should deploy the `main` branch.
No build command is required.
