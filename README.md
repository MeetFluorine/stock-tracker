# Shadowfax Store Stock Tracker (Cloudflare Workers + static assets)
Projected (Sq.Ft based) vs actual usable stock, plus S2W limits, per store.

```
public/               index.html, app.css, app.js   (static site; Chart.js from CDN)
src/worker.js         Worker: GET /api/data, everything else served from public/
lib/                  engine.js (all calculations), sheets.js (Google Sheets reader), config.js (sheet gids/ranges), rules.js (allocation rules)
wrangler.toml         Worker config (name must match the Worker in the dashboard)
test/                 offline smoke test: npm test
```

## Data source option A (no Google Cloud): Apps Script feed
1. script.new > paste `apps-script/Code.gs`. Project Settings > Script properties > add `API_KEY` = a long random string.
2. Run `testFeed` once (authorize), then Deploy > New deployment > Web app > Execute as **Me**, access **Anyone** > copy the `/exec` URL.
3. Cloudflare Worker > Settings > Variables and Secrets: add `APPS_SCRIPT_URL` and secret `APPS_SCRIPT_KEY` (same value as API_KEY). Redeploy.
The URL + key give read access to the three source blocks; keep them private and rotate by changing API_KEY.

## Data source option B (service account)
1. **Google service account** (Google Cloud console): create/choose a project > enable **Google Sheets API** > IAM & Admin > Service Accounts > create one > Keys > Add key > JSON (downloads a file).
2. Share both source spreadsheets with the service account's `client_email` as **Viewer**.
3. **Cloudflare dashboard** > Workers & Pages > your project (connected to this GitHub repo). Build command: empty. Deploy command: `npx wrangler deploy`. Root directory: `/`.
4. Project > Settings > **Variables and Secrets** (runtime, not "Build variables") > add secret **GOOGLE_SERVICE_ACCOUNT_JSON** = the full contents of the JSON key file.
5. Push to `main`; Cloudflare builds and deploys automatically. Open the `.workers.dev` URL.

## Local test
`npm install`, copy `.dev.vars.example` to `.dev.vars` and fill the key, then `npm run dev` and open the URL it prints (usually http://localhost:8787). `npm test` checks the calculation engine offline.

## Maintenance
- Allocation rules: edit `lib/rules.js`, push.
- Sheet layout changed: edit `lib/config.js` (gid + column range). Headers are read from the sheet by name.
- The Data Quality page lists unmatched stores, blank cells and Sq.Ft values without a rule (e.g. 300).
- Access: open to anyone with the URL (no login).
