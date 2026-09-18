# Panel Comic Collection V5.27

Cloudflare Pages package.

Structure:
- index.html
- _routes.json
- functions/api/amazon-search.js
- functions/api/br-search.js
- functions/api/cover.js

V5.27 verification changes:
- Brazilian search no longer relies only on Google Books language filtering; it uses ISBN-first Google Books BR plus Bing/DuckDuckGo discovery of Brazilian catalogues.
- Cover endpoint validates image responses before returning them and searches Brazilian catalogue pages when standard cover sources fail.
- Version marker is V5.27.
