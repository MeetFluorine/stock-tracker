/** Single source of truth for all stock calculations. Pure function: takes parsed sheet blocks, returns results. */
import { MATCH_TOLERANCE_PCT, SPACE_RATIO_CUTS } from './rules.js';
const norm = s => String(s == null ? '' : s).trim().toUpperCase().replace(/\s+/g, ' ');
const sum = (a, k) => a.reduce((t, x) => t + x[k], 0);
// A variance within ±MATCH_TOLERANCE_PCT of projected counts as Matched;
// otherwise the sign of the variance decides Excess/Shortage. A zero
// projected base with a non-zero variance is decided by sign alone.
const statusOf = (v, p) => (p > 0 && Math.abs(v / p * 100) <= MATCH_TOLERANCE_PCT) ? 'Matched' : v > 0 ? 'Excess' : v < 0 ? 'Shortage' : 'Matched';
const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'june', 'july', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAY_RE = /^\d{1,2}-(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)$/;
// Blank or non-numeric sheet cells count as 0 for issuance history.
const num0 = v => { const q = Number(v); return (v === undefined || v === '' || isNaN(q)) ? 0 : q; };
// Display label for a lowercased header: '27-oct' -> '27-Oct', 'sep' -> 'Sep'.
const dispLabel = h => h.replace(/(^|-)([a-z])/, (_, p, c) => p + c.toUpperCase());
// Effective Sq.Ft tier from actual total stock (see SPACE_RATIO_CUTS in rules.js).
// tiers = sorted Sq.Ft bands, cuts[i] = the ratio boundary between tiers[i]
// and tiers[i+1]; first cut with ratio < max wins, else the largest tier.
const effectiveSqftOf = (actual, baseTotal, tiers, cuts) => {
  if (!actual || !tiers.length) return null;
  const ratio = actual / baseTotal;
  const cut = (cuts || []).find(c => ratio < c.max);
  return cut ? cut.sqft : tiers[tiers.length - 1];
};

function compute({ ei, us, sw }, rules) {
  const warn = [], stores = {};
  const ki = ei.h.indexOf('ss_store'), kc = ei.h.indexOf('circle'), kq = ei.h.indexOf('sqft');
  // Optional: EI Stats "Current Store Status" (col T). Absent in older reads -> storeStatus ''.
  const ks = ei.h.indexOf('current store status');
  // Issuance history columns (EI Stats daily matrix + monthly totals).
  // Day headers look like '27-oct'; month headers are month names.
  // Trailing non-date columns after the day matrix are ignored by the matchers.
  const dayIdx = ei.h.map((x, i) => DAY_RE.test(x) ? i : -1).filter(i => i >= 0).slice(-15);
  const monIdx = ei.h.map((x, i) => MONTH_NAMES.indexOf(x) >= 0 ? i : -1).filter(i => i >= 0).slice(-3);
  const dayLabels = dayIdx.map(i => dispLabel(ei.h[i]));
  const monLabels = monIdx.map(i => dispLabel(ei.h[i]));
  if (kc < 0 || kq < 0) throw new Error('EI Stats needs Circle and SQFT headers. Found: ' + ei.h.join(' | '));
  ei.rows.forEach(r => { const k = norm(r[ki]); if (!k) return;
    if (stores[k]) { warn.push('Duplicate store in EI Stats: ' + r[ki]); return; }
    stores[k] = { store: String(r[ki]).trim(), circle: String(r[kc] || '').trim(), sqft: +r[kq] || 0, storeStatus: ks < 0 ? '' : String(r[ks] || '').trim(),
      dayVals: dayIdx.map(i => num0(r[i])), monVals: monIdx.map(i => num0(r[i])), use: {}, s2w: null, inReport: false }; });

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

  const baseTotal = rules.alloc.reduce((t, a) => t + a.base, 0);
  // Tier bands (sorted) and their ratio cutoffs come from the rules, so an
  // edited rule set recomputes effective tiers the same way on both sides.
  const tiers = (rules.mult || []).map(x => x.sqft).sort((a, b) => a - b);
  const cuts = rules.cuts || SPACE_RATIO_CUTS;
  const hist = s => ({
    recentDays: dayLabels.map((label, j) => ({ label, value: s.dayVals[j] })),
    lastMonths: monLabels.map((label, j) => ({ label, value: s.monVals[j] })) });
  const out = Object.values(stores).filter(s => s.inReport).map(s => {
    const tier = rules.mult.find(x => x.sqft === s.sqft);
    if (!tier) { warn.push('Store "' + s.store + '": Sq.Ft ' + s.sqft + ' has no multiplier rule');
      // Unknown stores still get an effective tier from their real usable stock
      // (sum of the Report row), but never count as a space mismatch — they
      // are already counted in the Unknown KPI.
      const actualTotal = Object.values(s.use).reduce((t, q) => t + q, 0);
      return { store: s.store, circle: s.circle, sqft: s.sqft, storeStatus: s.storeStatus, materials: [], projected: 0, actual: 0, variance: 0, status: 'Unknown', s2w: s.s2w || 0, s2wMax: 0, s2wStatus: 'Unknown', excess: 0, shortage: 0,
        effectiveSqft: effectiveSqftOf(actualTotal, baseTotal, tiers, cuts), spaceMismatch: false, use: s.use, usableTotal: actualTotal, ...hist(s) }; }
    const materials = rules.alloc.map(a => { const p = a.base * tier.m, act = s.use[a.material] || 0, v = act - p;
      return { material: a.material, projected: p, actual: act, variance: v, pct: p ? v / p * 100 : 0, s2w: null, status: statusOf(v, p) }; });
    const projected = sum(materials, 'projected'), actual = sum(materials, 'actual'), v = actual - projected, w = s.s2w;
    const s2wStatus = w === null ? 'Unknown' : w > tier.s2w ? 'Limit Breached' : w === tier.s2w ? 'At Limit' : 'Within Limit';
    const eff = effectiveSqftOf(actual, baseTotal, tiers, cuts);
    return { store: s.store, circle: s.circle, sqft: s.sqft, storeStatus: s.storeStatus, materials, projected, actual, variance: v, s2w: w === null ? 0 : w, s2wMax: tier.s2w, s2wStatus,
      excess: materials.filter(x => x.variance > 0).reduce((a, x) => a + x.variance, 0),
      shortage: materials.filter(x => x.variance < 0).reduce((a, x) => a + x.variance, 0),
      status: statusOf(v, projected),
      effectiveSqft: eff, spaceMismatch: eff !== s.sqft, use: s.use, usableTotal: actual, ...hist(s) };
  });
  return { stores: out, warnings: warn.slice(0, 200), rules, matchTolerancePct: MATCH_TOLERANCE_PCT, updated: new Date().toISOString() };
}
export { compute, norm };
