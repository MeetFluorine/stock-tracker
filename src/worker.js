// Cloudflare Worker: serves GET /api/data; everything else is served from the static ./public assets.
import { load } from '../lib/sheets.js';
import { CONFIG } from '../lib/config.js';

let memo = null; // kept while the worker isolate stays warm
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/data') {
      try {
        const force = url.searchParams.get('force') === '1';
        if (force || !memo || Date.now() - memo.t > CONFIG.CACHE_SECONDS * 1000) memo = { t: Date.now(), d: await load(env) };
        return json(memo.d);
      } catch (e) { return json({ error: e.message }, 500); }
    }
    return env.ASSETS.fetch(request);
  }
};
