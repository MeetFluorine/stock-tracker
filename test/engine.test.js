// Offline smoke test with synthetic in-memory data (not real data): npm test
import assert from 'node:assert'; import { generateKeyPairSync } from 'node:crypto';
import { compute } from '../lib/engine.js'; import { RULES } from '../lib/rules.js'; import { signJwt, load } from '../lib/sheets.js';
const ei = { h: ['ss_store', 'circle', 'sqft'], rows: [['A_Store', 'X', 100], ['B_Store', 'X', 300]] };
const us = { h: ['ss_store', 'circle', 'accessories', 'connector', 'face plate', 'ont', 'modem outdoor', 'wifi router', 'iptv', 'cat 6', 'outdoor cable'], rows: [['A_Store', 'X', 420, 760, 400, 76, 40, 44, 40, 3980, 20220], ['B_Store', 'X', 1, 1, 1, 1, 1, 1, 1, 1, 1]] };
const sw = { h: ['ss', 'total count'], rows: [['A_Store', 198]] };
const r = compute({ ei, us, sw }, RULES); const a = r.stores.find(s => s.store === 'A_Store');
assert.equal(a.projected, 25800); assert.equal(a.actual, 25980); assert.equal(a.variance, 180); assert.equal(a.s2wMax, 200); assert.equal(a.s2wStatus, 'Within Limit');
assert.equal(r.stores.find(s => s.store === 'B_Store').status, 'Unknown');
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const jwt = await signJwt({ client_email: 't@t.iam.gserviceaccount.com', private_key: privateKey }); assert.equal(jwt.split('.').length, 3);
// Apps Script feed path with a stubbed fetch
globalThis.fetch = async url => { assert.ok(String(url).includes('key=k1')); return { text: async () => JSON.stringify({ ei, us, sw }) }; };
const viaFeed = await load({ APPS_SCRIPT_URL: 'https://script.google.com/macros/s/x/exec', APPS_SCRIPT_KEY: 'k1' });
assert.equal(viaFeed.stores.find(s => s.store === 'A_Store').variance, 180);
console.log('engine + jwt + apps-script feed ok');
