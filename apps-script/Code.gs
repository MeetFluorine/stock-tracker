/** Data feed for the Store Stock Tracker. Returns the three source blocks as JSON; the Cloudflare Worker does all calculations.
 *  Setup: Project Settings > Script properties > add API_KEY (long random string). Deploy as Web app: Execute as "Me", access "Anyone". */
const SRC = {
  us: { id: '1VL7vKeDP5VeUa8v2wr2GvpJn73tHk3JPmuHVfOuq0B0', gid: 0,         c0: 18, c1: 31 }, // Report!R:AE
  sw: { id: '1VL7vKeDP5VeUa8v2wr2GvpJn73tHk3JPmuHVfOuq0B0', gid: 745322622, c0: 15, c1: 23 }, // S2W pendency O:W
  ei: { id: '1MBgRfa6AR1YGG1f8LilgUdvUAbrO4gLPHqLK6w4cZ8Q', gid: 497754035, c0: 1,  c1: 0 }  // EI Stats A:dynamic (SS_Store .. daily matrix; c1 0 = read to the sheet's last column)
};

function doGet(e) {
  const key = PropertiesService.getScriptProperties().getProperty('API_KEY');
  if (!key || !e || !e.parameter || e.parameter.key !== key) return out_({ error: 'Unauthorized' });
  try { return out_({ ei: block_(SRC.ei), us: block_(SRC.us), sw: block_(SRC.sw) }); }
  catch (err) { return out_({ error: String(err.message || err) }); }
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function norm_(s) { return String(s == null ? '' : s).trim().toUpperCase().replace(/\s+/g, ' '); }

/** Finds the header row (contains SS_Store / SS), returns lowercase headers + non-empty data rows.
 *  c1 = 0 means read to the sheet's last column (the EI daily matrix grows over time). */
function block_(s) {
  const sh = SpreadsheetApp.openById(s.id).getSheets().filter(x => x.getSheetId() === s.gid)[0];
  if (!sh) throw new Error('Tab with gid ' + s.gid + ' not found');
  const ncols = s.c1 > 0 ? s.c1 - s.c0 + 1 : sh.getLastColumn() - s.c0 + 1;
  const v = sh.getRange(1, s.c0, sh.getLastRow(), ncols).getValues();
  const hr = v.findIndex(r => r.some(x => ['SS_STORE', 'SS STORE', 'SS'].indexOf(norm_(x)) >= 0));
  if (hr < 0) throw new Error('Header row with SS_Store not found in "' + sh.getName() + '"');
  return { h: v[hr].map(x => String(x).trim().toLowerCase()), rows: v.slice(hr + 1).filter(r => r.some(x => x !== '')) };
}

/** Run once from the editor: authorizes sheet access and logs row counts. */
function testFeed() {
  ['ei', 'us', 'sw'].forEach(k => { const b = block_(SRC[k]); Logger.log(k + ': ' + b.rows.length + ' rows, headers: ' + b.h.join(' | ')); });
}
