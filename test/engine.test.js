// Offline smoke test with synthetic in-memory data (not real data): npm test
import assert from 'node:assert'; import { generateKeyPairSync } from 'node:crypto';
import { compute } from '../lib/engine.js'; import { RULES, MATCH_TOLERANCE_PCT } from '../lib/rules.js'; import { signJwt, load } from '../lib/sheets.js';
const ei = { h: ['ss_store', 'circle', 'sqft'], rows: [['A_Store', 'X', 100], ['B_Store', 'X', 300]] };
const us = { h: ['ss_store', 'circle', 'accessories', 'connector', 'face plate', 'ont', 'modem outdoor', 'wifi router', 'iptv', 'cat 6', 'outdoor cable'], rows: [['A_Store', 'X', 420, 760, 400, 76, 40, 44, 40, 3980, 20220], ['B_Store', 'X', 1, 1, 1, 1, 1, 1, 1, 1, 1]] };
const sw = { h: ['ss', 'total count'], rows: [['A_Store', 198]] };
const r = compute({ ei, us, sw }, RULES); const a = r.stores.find(s => s.store === 'A_Store');
assert.equal(a.projected, 25800); assert.equal(a.actual, 25980); assert.equal(a.variance, 180); assert.equal(a.s2wMax, 200); assert.equal(a.s2wStatus, 'Within Limit');
assert.equal(r.stores.find(s => s.store === 'B_Store').status, 'Unknown');
assert.equal(r.matchTolerancePct, MATCH_TOLERANCE_PCT);
assert.equal(a.storeStatus, ''); // synthetic EI block has no "Current Store Status" column

// ±1% matched tolerance (25 Sq.Ft -> projected = base; base total 6450).
// C: Cat 6 -0.5% -> material Matched; store -0.08% -> Matched. D: Cat 6 -5% -> Shortage.
// E: Cat 6 +1.1% -> Excess. F: store -9.3% -> Shortage. G: store +9.3% -> Excess.
// H: Cat 6 -3.2% (material Shortage) but store total exactly -0.5% -> store Matched.
const ei2 = { h: ['ss_store', 'circle', 'sqft', 'current store status'], rows: [
  ['C_Store', 'X', 25, 'Active'], ['D_Store', 'X', 25, 'Inactive'], ['E_Store', 'X', 25, ''],
  ['F_Store', 'X', 25, 'Active'], ['G_Store', 'X', 25, 'Active'], ['H_Store', 'X', 25, 'Active']] };
const base = [100, 200, 100, 20, 10, 10, 10, 1000, 5000];
const row2 = (s, cat6, outdoor) => [s, 'X', ...base.slice(0, 7), cat6, outdoor];
const us2 = { h: ['ss_store', 'circle', 'accessories', 'connector', 'face plate', 'ont', 'modem outdoor', 'wifi router', 'iptv', 'cat 6', 'outdoor cable'], rows: [
  row2('C_Store', 995, 5000), row2('D_Store', 950, 5000), row2('E_Store', 1011, 5000),
  row2('F_Store', 900, 4500), row2('G_Store', 1100, 5500), row2('H_Store', 967.75, 5000)] };
const sw2 = { h: ['ss', 'total count'], rows: [] };
const r2 = compute({ ei: ei2, us: us2, sw: sw2 }, RULES);
const at = (name, mat) => r2.stores.find(s => s.store === name).materials.find(m => m.material === mat);
assert.equal(at('C_Store', 'Cat 6').status, 'Matched');
assert.equal(r2.stores.find(s => s.store === 'C_Store').status, 'Matched');
assert.equal(r2.stores.find(s => s.store === 'C_Store').storeStatus, 'Active');
assert.equal(at('D_Store', 'Cat 6').status, 'Shortage');
assert.equal(r2.stores.find(s => s.store === 'D_Store').storeStatus, 'Inactive');
assert.equal(at('E_Store', 'Cat 6').status, 'Excess');
assert.equal(r2.stores.find(s => s.store === 'E_Store').storeStatus, '');
assert.equal(r2.stores.find(s => s.store === 'F_Store').status, 'Shortage');
assert.equal(r2.stores.find(s => s.store === 'G_Store').status, 'Excess');
assert.equal(at('H_Store', 'Cat 6').status, 'Shortage');
assert.equal(r2.stores.find(s => s.store === 'H_Store').status, 'Matched');
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const jwt = await signJwt({ client_email: 't@t.iam.gserviceaccount.com', private_key: privateKey }); assert.equal(jwt.split('.').length, 3);
// Apps Script feed path with a stubbed fetch
globalThis.fetch = async url => { assert.ok(String(url).includes('key=k1')); return { text: async () => JSON.stringify({ ei, us, sw }) }; };
const viaFeed = await load({ APPS_SCRIPT_URL: 'https://script.google.com/macros/s/x/exec', APPS_SCRIPT_KEY: 'k1' });
assert.equal(viaFeed.stores.find(s => s.store === 'A_Store').variance, 180);
console.log('engine + jwt + apps-script feed ok');
