# Panel Comic Collection V5.25 — Cloudflare Pages

Deploy the contents of this folder to the root of a Cloudflare Pages Git repository.

Structure:

```text
index.html
_routes.json
functions/
└── api/
    ├── amazon-search.js
    ├── br-search.js
    └── cover.js
```

Cloudflare Pages should use the `main` branch, no build command, and `/` as the output directory.

V5.25 adds a Brazilian web catalogue fallback for title/ISBN searches and uses wsrv.nl as an image cache/proxy for cover sources. The Brazilian fallback searches Brazilian catalogue/retail sources and is especially useful for Panini Brasil editions that are absent from international book databases.
