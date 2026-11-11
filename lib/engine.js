/** Single source of truth for all stock calculations. Pure function: takes parsed sheet blocks, returns results. */
import { MATCH_TOLERANCE_PCT } from './rules.js';
const norm = s => String(s == null ? '' : s).trim().toUpperCase().replace(/\s+/g, ' ');
const sum = (a, k) => a.reduce((t, x) => t + x[k], 0);
// A variance within ±MATCH_TOLERANCE_PCT of projected counts as Matched;
// otherwise the sign of the variance decides Excess/Shortage. A zero
// projected base with a non-zero variance is decided by sign alone.
const statusOf = (v, p) => (p > 0 && Math.abs(v / p * 100) <= MATCH_TOLERANCE_PCT) ? 'Matched' : v > 0 ? 'Excess' : v < 0 ? 'Shortage' : 'Matched';

function compute({ ei, us, sw }, rules) {
  const warn = [], stores = {};
  const ki = ei.h.indexOf('ss_store'), kc = ei.h.indexOf('circle'), kq = ei.h.indexOf('sqft');
  // Optional: EI Stats "Current Store Status" (col T). Absent in older reads -> storeStatus ''.
  const ks = ei.h.indexOf('current store status');
  if (kc < 0 || kq < 0) throw new Error('EI Stats needs Circle and SQFT headers. Found: ' + ei.h.join(' | '));
  ei.rows.forEach(r => { const k = norm(r[ki]); if (!k) return;
    if (stores[k]) { warn.push('Duplicate store in EI Stats: ' + r[ki]); return; }
    stores[k] = { store: String(r[ki]).trim(), circle: String(r[kc] || '').trim(), sqft: +r[kq] || 0, storeStatus: ks < 0 ? '' : String(r[ks] || '').trim(), use: {}, s2w: null, inReport: false }; });

  const ui = us.h.indexOf('ss_store'); let blanks = 0;
  const cols = rules.alloc.map(a => ({ m: a.material, i: us.h.indexOf(a.material.toLowerCase()) }));
  cols.filter(c => c.i < 0).forEach(c => warn.push('Report has no column for material "' + c.m + '"'));
  us.rows.forEach(r => { const k = norm(r[ui]); if (!k) return;
    const s = stores[k]; if (!s) { warn.push('Report store "' + r[ui] + '" not found in EI Stats (no Sq.Ft/circle)'); return; }
    s.inReport = true;
    cols.forEach(c => { if (c.i < 0) return; const raw = r[c.i];
      if (raw === undefined || raw === '') { blanks++; return; }
      const q = Number(raw); if (isNaN(q)) { warn.push('Report ' + r[ui] + ' / ' + c.m + ': non-numeric "' + raw + '"'); return; }
      s.use[c.m] = (s.use[c.m] || 0) + q; }); });
  if (blanks) warn.push(blanks + ' blank usable-stock cells in Report were treated as 0 - please confirm');
  const missing = Object.values(stores).filter(s => !s.inReport).length;
  if (missing) warn.push(missing + ' stores in EI Stats have no row in Report and were excluded');

  const si = sw.h.indexOf('ss'), st = sw.h.indexOf('total count'), seen = {};
  if (si < 0 || st < 0) throw new Error('S2W tab needs "SS" and "Total Count" headers. Found: ' + sw.h.join(' | '));
  sw.rows.forEach(r => { const k = norm(r[si]); if (!k) return;
    if (seen[k]) { warn.push('Duplicate S2W row ignored: ' + r[si]); return; } seen[k] = true;
    const s = stores[k]; if (!s) { warn.push('S2W store "' + r[si] + '" not found in EI Stats'); return; }
    const q = Number(r[st]); if (r[st] === undefined || r[st] === '' || isNaN(q)) { warn.push('S2W ' + r[si] + ': invalid Total Count'); return; }
    s.s2w = q; });
  const noS2w = Object.values(stores).filter(s => s.inReport && s.s2w === null).length;
  if (noS2w) warn.push(noS2w + ' stores have no S2W record - S2W shown as Unknown');

  const out = Object.values(stores).filter(s => s.inReport).map(s => {
    const tier = rules.mult.find(x => x.sqft === s.sqft);
    if (!tier) { warn.push('Store "' + s.store + '": Sq.Ft ' + s.sqft + ' has no multiplier rule');
      return { store: s.store, circle: s.circle, sqft: s.sqft, storeStatus: s.storeStatus, materials: [], projected: 0, actual: 0, variance: 0, status: 'Unknown', s2w: s.s2w || 0, s2wMax: 0, s2wStatus: 'Unknown', excess: 0, shortage: 0 }; }
    const materials = rules.alloc.map(a => { const p = a.base * tier.m, act = s.use[a.material] || 0, v = act - p;
      return { material: a.material, projected: p, actual: act, variance: v, pct: p ? v / p * 100 : 0, s2w: null, status: statusOf(v, p) }; });
    const projected = sum(materials, 'projected'), actual = sum(materials, 'actual'), v = actual - projected, w = s.s2w;
    const s2wStatus = w === null ? 'Unknown' : w > tier.s2w ? 'Limit Breached' : w === tier.s2w ? 'At Limit' : 'Within Limit';
    return { store: s.store, circle: s.circle, sqft: s.sqft, storeStatus: s.storeStatus, materials, projected, actual, variance: v, s2w: w === null ? 0 : w, s2wMax: tier.s2w, s2wStatus,
      excess: materials.filter(x => x.variance > 0).reduce((a, x) => a + x.variance, 0),
      shortage: materials.filter(x => x.variance < 0).reduce((a, x) => a + x.variance, 0),
      status: statusOf(v, projected) };
  });
  return { stores: out, warnings: warn.slice(0, 200), rules, matchTolerancePct: MATCH_TOLERANCE_PCT, updated: new Date().toISOString() };
}
export { compute, norm };
