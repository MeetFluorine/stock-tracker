// Source sheets. gid = number after "gid=" in the sheet URL. Ranges are read from that tab.
export const CONFIG = {
  CACHE_SECONDS: 300,
  USABLE: { id: '1VL7vKeDP5VeUa8v2wr2GvpJn73tHk3JPmuHVfOuq0B0', gid: 0,         cols: 'R:AE' }, // "Report": one column per material
  S2W:    { id: '1VL7vKeDP5VeUa8v2wr2GvpJn73tHk3JPmuHVfOuq0B0', gid: 745322622, cols: 'O:W'  }, // S2W pendency: SS, Circle, Store Type, POC, buckets, Total Count
  TXN:    { id: '1MBgRfa6AR1YGG1f8LilgUdvUAbrO4gLPHqLK6w4cZ8Q', gid: 497754035, cols: 'A:T'  }  // "EI Stats": SS_Store, Circle, SQFT, ... Current Store Status (col T)
};
