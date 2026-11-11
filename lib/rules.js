// Allocation rules (base = qty for a 25 Sq.Ft store). Edit via pull request.
// Sq.Ft values with no entry in `mult` (e.g. 300) are flagged "Unknown" until a rule is added.
// Effective space category: which Sq.Ft tier a store's ACTUAL total stock falls
// into. baseTotal = sum of the alloc bases (6450 = the projected stock of a
// 25 Sq.Ft store). ratio = actual / baseTotal; actual 0 -> no effective tier.
// The cut points sit halfway between the tier multipliers (1x, 2x, 4x, 6x):
// ratio < 1.5 -> 25; < 3 -> 50; < 5 -> 100; otherwise 200. A store whose
// effective tier differs from its own Sq.Ft is a "space mismatch" (its stock
// behaves like a bigger or smaller store than its floor size says).
export const SPACE_RATIO_CUTS = [
  { max: 1.5, sqft: 25 }, { max: 3, sqft: 50 }, { max: 5, sqft: 100 }
];
// Matched tolerance: a material/store whose |variance %| is within MATCH_TOLERANCE_PCT
// counts as Matched (the mockup treats e.g. Cat 6 at -0.5% as Matched, not Shortage).
export const MATCH_TOLERANCE_PCT = 1;
export const RULES = {
  alloc: [
    { material: 'Accessories', base: 100 }, { material: 'Connector', base: 200 },
    { material: 'Face Plate', base: 100 },  { material: 'ONT', base: 20 },
    { material: 'Modem Outdoor', base: 10 }, { material: 'WiFi Router', base: 10 },
    { material: 'IPTV', base: 10 },         { material: 'Cat 6', base: 1000 },
    { material: 'Outdoor Cable', base: 5000 }
  ],
  mult: [
    { sqft: 25, m: 1, s2w: 50 }, { sqft: 50, m: 2, s2w: 100 },
    { sqft: 100, m: 4, s2w: 200 }, { sqft: 200, m: 6, s2w: 300 }
  ],
  // Tier cutoffs travel with the rules so the frontend can edit them:
  // cuts[i] is the top of tier i (the ratio boundary between tiers[i] and
  // tiers[i+1]); above the last cutoff a store is the largest tier. When a
  // band is added or removed, the cuts are re-derived as the midpoints
  // between neighbouring multipliers (see the Rules page).
  cuts: SPACE_RATIO_CUTS
};
