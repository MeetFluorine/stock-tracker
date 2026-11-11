// Allocation rules (base = qty for a 25 Sq.Ft store). Edit via pull request.
// Sq.Ft values with no entry in `mult` (e.g. 300) are flagged "Unknown" until a rule is added.
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
  ]
};
