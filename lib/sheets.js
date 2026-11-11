import { CONFIG } from './config.js';
import { RULES } from './rules.js';
import { compute, norm } from './engine.js';

const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = s => b64u(new TextEncoder().encode(s));

/** Builds a signed service-account JWT (RS256) using Web Crypto, which works on Cloudflare Workers. */
export async function signJwt(sa, now = Math.floor(Date.now() / 1000)) {
  const head = enc(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = enc(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head + '.' + claim));
  return head + '.' + claim + '.' + b64u(sig);
}

async function accessToken(env) {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error('Secret GOOGLE_SERVICE_ACCOUNT_JSON is not set on the server');
  let sa; try { sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON); } catch (e) { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON'); }
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: await signJwt(sa) }) });
  const j = await r.json(); if (!j.access_token) throw new Error('Google auth failed: ' + (j.error_description || j.error));
  return j.access_token;
}

async function gget(url, token) {
  const r = await fetch(url, { headers: { authorization: 'Bearer ' + token } }); const j = await r.json();
  if (!r.ok) throw new Error('Google Sheets API: ' + ((j.error && j.error.message) || r.status) + ' (is the sheet shared with the service account?)');
  return j;
}

async function readBlock(src, token) {
  const base = 'https://sheets.googleapis.com/v4/spreadsheets/' + src.id;
  const meta = await gget(base + '?fields=sheets.properties(sheetId,title)', token);
  const p = meta.sheets.map(s => s.properties).find(x => x.sheetId === src.gid);
  if (!p) throw new Error('Tab with gid ' + src.gid + ' not found in spreadsheet ' + src.id);
  const range = "'" + p.title.replace(/'/g, "''") + "'!" + src.cols;
  const j = await gget(base + '/values/' + encodeURIComponent(range) + '?valueRenderOption=UNFORMATTED_VALUE', token);
  const v = j.values || [];
  const hr = v.findIndex(row => row.some(x => ['SS_STORE', 'SS STORE', 'SS'].includes(norm(x))));
  if (hr < 0) throw new Error('Header row with SS_Store not found in tab "' + p.title + '"');
  return { h: v[hr].map(x => String(x).trim().toLowerCase()), rows: v.slice(hr + 1) };
}

async function loadFromAppsScript(env) {
  if (!env.APPS_SCRIPT_KEY) throw new Error('Secret APPS_SCRIPT_KEY is not set on the server');
  const u = new URL(env.APPS_SCRIPT_URL); u.searchParams.set('key', env.APPS_SCRIPT_KEY);
  const r = await fetch(u.toString(), { redirect: 'follow' }); const text = await r.text(); let j;
  try { j = JSON.parse(text); } catch (e) { throw new Error('Apps Script did not return JSON - check the deployment: Execute as Me, access Anyone, and use the /exec URL'); }
  if (j.error) throw new Error('Apps Script: ' + j.error);
  return compute(j, RULES);
}

export async function load(env) {
  if (env.APPS_SCRIPT_URL) return loadFromAppsScript(env);
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error('No data source configured: set APPS_SCRIPT_URL + APPS_SCRIPT_KEY (or GOOGLE_SERVICE_ACCOUNT_JSON)');
  return loadFromGoogle(env);
}

async function loadFromGoogle(env) {
  const token = await accessToken(env);
  const [ei, us, sw] = await Promise.all([readBlock(CONFIG.TXN, token), readBlock(CONFIG.USABLE, token), readBlock(CONFIG.S2W, token)]);
  return compute({ ei, us, sw }, RULES);
}
