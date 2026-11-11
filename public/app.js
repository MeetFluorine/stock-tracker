let D=null, cur=null, sortK='material', sortD=1, charts={}, kpiOpen=null, matTab='mat';
const $=id=>document.getElementById(id);
const n=x=>Number(x).toLocaleString('en-IN');
const sg=x=>(x>0?'+':'')+n(x);
const cls=s=>String(s).split(' ')[0];
const pill=s=>`<span class="pill ${cls(s)}">${s}</span>`;
const vc=x=>x>0?'pos':x<0?'neg':'';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pctOf=(v,p)=>p? v/p*100 : null;
const fmtPct=p=>p===null?'—':(p>0?'+':'')+p.toFixed(1)+'%';
// Capacity Status rule (SPACE-based): how much space the client's stock
// occupies vs the space allocated to the store, via the effective tier
// (actual stock / 6450 base total, nearest tier [25,50,100,200]).
// effective == allocated -> OKAY (green); effective above allocated -> Extra Space (red);
// effective below allocated, or no stock at all -> Less Space (amber); Sq.Ft 300 (no rule) -> '—' (grey).
const capOf=s=>{ if(!s||s.status==='Unknown') return {label:'—', cls:'cap-none'};
  if(s.effectiveSqft===null||s.effectiveSqft===undefined) return {label:'Less Space',cls:'cap-watch'};
  if(s.effectiveSqft===s.sqft) return {label:'OKAY',cls:'cap-ok'};
  return s.effectiveSqft>s.sqft?{label:'Extra Space',cls:'cap-crit'}:{label:'Less Space',cls:'cap-watch'}; };
const s2wText=s=>s.s2wMax>0?`${n(s.s2w)} / ${n(s.s2wMax)}`:`${n(s.s2w)} / —`;
// Effective-space box for the Store Stock Summary card. Big value + direction
// chip, then a tier ladder built from the CURRENT rules (not hardcoded): the
// store's OWN tier gets an outline + "Allocated" tag, the EFFECTIVE tier gets
// the status-colour fill + "Effective" tag (both tags on one box when they are
// the same tier). Under the value, the volume in units and the unit band the
// effective tier covers: band edges come from the current cutoffs × base total
// (tier i: lo = ceil(cuts[i-1].max × baseTotal), hi = ceil(cuts[i].max ×
// baseTotal) − 1; the largest tier is open-ended).
function effBox(s){
  if(!s) return '';
  const cap=capOf(s);
  const tiers=(D.rules.mult||[]).map(m=>m.sqft).sort((a,b)=>a-b);
  const ladderTiers=tiers.length?tiers:[25,50,100,200];
  const cuts=D.rules.cuts||[];
  const baseTotal=(D.rules.alloc||[]).reduce((t,a)=>t+a.base,0);
  const bandOf=i=>{
    const lo=i===0?0:(cuts[i-1]?Math.ceil(cuts[i-1].max*baseTotal):0);
    const hi=(i===ladderTiers.length-1||!cuts[i])?null:Math.ceil(cuts[i].max*baseTotal)-1;
    return {lo,hi}; };
  const bandText=i=>{ const b=bandOf(i); return b.hi===null?n(b.lo)+'+ units':n(b.lo)+' – '+n(b.hi)+' units'; };
  const eff=s.effectiveSqft;
  let chip, val;
  if(s.status==='Unknown'){ val=eff==null?'—':eff+' Sq.Ft'; chip='Allocated '+s.sqft+' Sq.Ft — no multiplier rule'; }
  else if(eff===null||eff===undefined){ val='—'; chip='No stock recorded'; }
  else if(eff===s.sqft){ val=eff+' Sq.Ft'; chip='Aligned with allocated '+s.sqft+' Sq.Ft'; }
  else { val=eff+' Sq.Ft';
    const d=Math.abs(ladderTiers.indexOf(eff)-ladderTiers.indexOf(s.sqft));
    chip=(eff>s.sqft?'▲ ':'▼ ')+d+' tier'+(d>1?'s':'')+' '+(eff>s.sqft?'above':'below')+' allocated '+s.sqft+' Sq.Ft'; }
  const vol=s.usableTotal??s.actual??0;
  const ei=ladderTiers.indexOf(eff);
  const volLine=eff===null||eff===undefined
    ? '0 units · Band —'
    : n(vol)+' units · Band '+bandText(ei<0?0:ei);
  const cells=ladderTiers.map((t,i)=>{
    const isOwn=t===s.sqft&&s.status!=='Unknown', isEff=t===eff;
    const cls='ladder-cell'+(isOwn?' alloc':'')+(isEff?' eff '+cap.cls:'');
    const tag=isOwn&&isEff?'Allocated · Effective':isOwn?'Allocated':isEff?'Effective':'';
    return `<div class="${cls}"><b>${t}</b><span>Sq.Ft</span><i>${tag}</i><small class="ladder-range">${bandText(i)}</small></div>`; }).join('');
  // Space Mismatch lives here now (not a KPI card any more): the count and
  // the same drill-down the old KPI opened.
  const mm=D.stores.filter(x=>x.spaceMismatch).length;
  const mmLine=mm?`<button class="mismatch-link" data-open-kpi="mismatch">Space Mismatch: ${n(mm)} stores — View details</button>`:'';
  return `<div class="eff-box"><div class="eff-top"><div><span class="eff-label">Effective Space</span><b class="eff-val">${val}</b><span class="eff-vol">${volLine}</span></div><span class="eff-chip ${cap.cls}">${chip}</span></div><div class="ladder" style="grid-template-columns:repeat(${ladderTiers.length},1fr)">${cells}</div>${mmLine}</div>`;
}
const PAGES=['dash','rec','ledger','txn','master','rules','reports','dq'];

const PAGE_META={dash:['Store Stock Capacity Tracker','Projected vs Actual Stock, Space Utilization & S2W Monitoring'],
 rec:['Store Reconciliation','Material-wise projected vs actual stock for one store'],
 ledger:['Stock Ledger','Item-level stock movements'],
 txn:['Transactions','Daily issuance history from EI Stats'],
 master:['Stores Master','All stores with projected, actual and effective space'],
 rules:['Allocation Rules','Base quantities, multipliers, S2W limits and effective-space thresholds'],
 reports:['Reports','Download store, reconciliation and transaction reports'],
 dq:['Data Quality','Warnings found while reading the source sheets']};
function show(v){ PAGES.forEach(i=>$(i).classList.toggle('hide',i!==v));
  document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('on',a.dataset.v===v));
  const m=PAGE_META[v]; if(m){ $('page-title').textContent=m[0]; $('page-desc').textContent=m[1]; }
  if(v==='dash'&&D) renderDash();
  if(v==='txn'&&D) renderTxnPage();
  document.querySelector('main').scrollTop=0; }
document.querySelectorAll('nav a').forEach(a=>a.onclick=()=>show(a.dataset.v));

/* Minimal loading screen: the stage text and bar advance at real load
   phases (connect -> fetch -> calculate -> prepare). No percentage is
   shown — the progress is not measurable in percent. On failure the
   overlay stays with the source that failed and a Retry button. */
const setStage=(t,w)=>{ $('load-stage').textContent=t; $('load-bar-fill').style.width=w+'%'; };
function load(force){
  $('load').classList.remove('hide'); $('load-err').classList.add('hide');
  setStage('Connecting to Google Sheets...',15);
  fetch('/api/data'+(force?'?force=1':''))
  .then(r=>{ setStage('Fetching store records...',40);
    return r.json().then(d=>{ if(!r.ok) throw new Error(d.error||r.statusText); return d; }); })
  .then(d=>{ setStage('Calculating reconciliation...',70); D=d; initPayload(); init();
    setStage('Preparing dashboard...',90);
    $('load').classList.add('hide'); show('dash'); })
  .catch(e=>{ $('load-bar-fill').style.width='100%';
    $('load-stage').textContent='Could not load data.';
    $('load-err-text').textContent='Could not load data from Google Sheets ('+e.message+'). Check the connection and try again.';
    $('load-err').classList.remove('hide'); });
}
$('ref').onclick=()=>load(true);
$('load-retry').onclick=()=>load(true);

/* ---------- Editable allocation rules (client-side only) ----------
   The Worker has no write endpoint and no KV binding, so a rule edit lives
   in this browser: it recomputes every store from the ORIGINAL payload data
   (origStores, never mutated), saves the rule set to localStorage, and is
   re-applied on every load / refresh. Download / Import JSON carries a rule
   set to another device. */
const LS_KEY='stock-tracker-custom-rules';
let origStores=[], origWarnings=[], defaultRules=null;
const cloneRules=r=>JSON.parse(JSON.stringify(r));
const baseTotalOf=r=>(r.alloc||[]).reduce((t,a)=>t+a.base,0);
const tiersOf=r=>(r.mult||[]).map(m=>m.sqft).sort((a,b)=>a-b);
// Same status rule as lib/engine.js statusOf, with the payload tolerance.
const statusOf=(v,p,tol)=>{ const t=tol??D.matchTolerancePct??1;
  return (p>0&&Math.abs(v/p*100)<=t)?'Matched':v>0?'Excess':v<0?'Shortage':'Matched'; };
// Same effective-tier rule as lib/engine.js effectiveSqftOf.
const effOf=(actual,baseTotal,tiers,cuts)=>{ if(!actual||!tiers.length) return null;
  const ratio=actual/baseTotal, cut=(cuts||[]).find(c=>ratio<c.max);
  return cut?cut.sqft:tiers[tiers.length-1]; };
// Recompute every store from the ORIGINAL payload stores under `rules`.
// Mirrors lib/engine.js compute() exactly: same tolerance, same S2W rule
// (s2wStatus 'Unknown' means the sheet value was null), same effective tier
// and space-mismatch rule (null effective counts as mismatch for rule stores).
// recentDays / lastMonths / circle / storeStatus pass through untouched.
function recomputeStores(rules){
  const bt=baseTotalOf(rules), tiers=tiersOf(rules), cuts=rules.cuts||[];
  return origStores.map(s=>{
    const tier=(rules.mult||[]).find(m=>m.sqft===s.sqft);
    const use=s.use||{}, usableTotal=s.usableTotal??Object.values(use).reduce((t,q)=>t+q,0);
    if(!tier) return { ...s, materials:[], projected:0, actual:0, variance:0, status:'Unknown',
      s2w:s.s2w||0, s2wMax:0, s2wStatus:'Unknown', excess:0, shortage:0,
      effectiveSqft:effOf(usableTotal,bt,tiers,cuts), spaceMismatch:false, use, usableTotal };
    const materials=rules.alloc.map(a=>{ const p=a.base*tier.m, act=use[a.material]||0, v=act-p;
      return { material:a.material, projected:p, actual:act, variance:v, pct:p?v/p*100:0, s2w:null, status:statusOf(v,p) }; });
    const projected=materials.reduce((t,m)=>t+m.projected,0), actual=materials.reduce((t,m)=>t+m.actual,0), v=actual-projected;
    const w=s.s2w||0;
    const s2wStatus=s.s2wStatus==='Unknown'?'Unknown':w>tier.s2w?'Limit Breached':w===tier.s2w?'At Limit':'Within Limit';
    const eff=effOf(actual,bt,tiers,cuts);
    return { ...s, materials, projected, actual, variance:v, s2w:w, s2wMax:tier.s2w, s2wStatus,
      excess:materials.filter(m=>m.variance>0).reduce((t,m)=>t+m.variance,0),
      shortage:materials.filter(m=>m.variance<0).reduce((t,m)=>t+m.variance,0),
      status:statusOf(v,projected), effectiveSqft:eff, spaceMismatch:eff!==s.sqft, use, usableTotal };
  });
}
function rebuildWarnings(rules){
  const tiers=tiersOf(rules);
  const kept=origWarnings.filter(w=>!/has no multiplier rule/.test(w));
  const added=origStores.filter(s=>!tiers.includes(s.sqft))
    .map(s=>'Store "'+s.store+'": Sq.Ft '+s.sqft+' has no multiplier rule');
  return kept.concat(added).slice(0,200);
}
function renderBell(){ const w=D.warnings||[];
  $('bell-badge').textContent=w.length; $('bell-badge').classList.toggle('hide',!w.length);
  $('dq-badge').textContent=w.length; $('dq-badge').classList.toggle('hide',!w.length);
  $('bell-dd').innerHTML=w.length? w.map(x=>`<div class="bell-item">${esc(x)}</div>`).join('') : '<div class="bell-item">No warnings.</div>'; }
// The live rules, normalised for a fair diff against the payload defaults.
const normRules=r=>({alloc:(r.alloc||[]).map(a=>({material:a.material,base:+a.base})),
  mult:[...(r.mult||[])].sort((a,b)=>a.sqft-b.sqft).map(m=>({sqft:+m.sqft,m:+m.m,s2w:+m.s2w})),
  cuts:(r.cuts||[]).map(c=>({max:+c.max,sqft:+c.sqft}))});
const customActive=()=>defaultRules&&JSON.stringify(normRules(D.rules))!==JSON.stringify(normRules(defaultRules));
function updateCustomChip(){ const on=customActive();
  $('custom-chip').classList.toggle('hide',!on); $('rules-chip').classList.toggle('hide',!on); }
// Apply a rule set: recompute everything, save it, re-render the whole app.
// `note` (when given) is logged to the Change History tab.
function applyRules(rules,save=true,note){
  D.rules=rules; D.stores=recomputeStores(rules); D.warnings=rebuildWarnings(rules);
  if(save){ try{ localStorage.setItem(LS_KEY,JSON.stringify(rules)); }catch(e){} }
  if(note) logRuleChange(note);
  const name=cur?cur.store:null;
  cur=D.stores.find(s=>s.store===name)
    ||D.stores.find(s=>(rules.mult||[]).some(m=>m.sqft===s.sqft))
    ||D.stores[0]||null;
  if(cur) $('store-search').value=cur.store;
  kpiOpen=null; $('kpi-detail').classList.add('hide'); $('kpi-detail').innerHTML='';
  renderBell(); renderDash(); drawRules(); renderDQ(); renderMaster(); updateCustomChip();
}
// Validate a rule set (imported JSON or a saved override). Returns an error
// string, or null when the shape is good. Cuts must be one per band except
// the largest, strictly increasing, and leading to the tiers in order.
function validRules(r){
  if(!r||typeof r!=='object') return 'Not a rules file.';
  if(!Array.isArray(r.alloc)||!r.alloc.length) return 'alloc must be a non-empty list of {material, base}.';
  for(const a of r.alloc){ if(!a||typeof a.material!=='string'||!a.material.trim()||!isFinite(+a.base)||+a.base<0) return 'Each alloc row needs a material name and a base qty (0 or more).'; }
  if(!Array.isArray(r.mult)) return 'mult must be a list of {sqft, m, s2w}.';
  const seen=new Set();
  for(const m of r.mult){ if(!m||!isFinite(+m.sqft)||+m.sqft<=0||!isFinite(+m.m)||+m.m<0||!isFinite(+m.s2w)||+m.s2w<0) return 'Each mult row needs Sq.Ft (>0), multiplier (0 or more) and S2W max (0 or more).';
    if(seen.has(+m.sqft)) return 'Duplicate Sq.Ft band: '+m.sqft+'.'; seen.add(+m.sqft); }
  const tiers=tiersOf(r);
  if(!Array.isArray(r.cuts)) return 'cuts must be a list (one per band except the largest).';
  if(r.cuts.length!==Math.max(0,tiers.length-1)) return 'cuts must have exactly one entry per band except the largest ('+Math.max(0,tiers.length-1)+' expected, got '+r.cuts.length+').';
  let prev=0;
  for(let i=0;i<r.cuts.length;i++){ const c=r.cuts[i];
    if(!c||!isFinite(+c.max)||+c.max<=0||+c.max<=prev) return 'Cutoffs must be positive and strictly increasing.';
    if(+c.sqft!==tiers[i]) return 'Cutoff '+(i+1)+' must lead to '+tiers[i]+' Sq.Ft.'; prev=+c.max; }
  return null;
}
const cleanRules=r=>({alloc:r.alloc.map(a=>({material:String(a.material).trim(),base:+a.base})),
  mult:[...r.mult].sort((a,b)=>a.sqft-b.sqft).map(m=>({sqft:+m.sqft,m:+m.m,s2w:+m.s2w})),
  cuts:(r.cuts||[]).map(c=>({max:+c.max,sqft:+c.sqft}))});
function readSavedRules(){ try{ const raw=localStorage.getItem(LS_KEY); if(!raw) return null;
    const r=JSON.parse(raw); const err=validRules(r); if(err) return null; return cleanRules(r); }catch(e){ return null; } }
// Snapshot the payload, then re-apply a saved custom rule set if it validates.
function initPayload(){
  origStores=(D.stores||[]).slice();
  origWarnings=(D.warnings||[]).slice();
  defaultRules=cloneRules(D.rules);
  const saved=readSavedRules();
  if(saved){ D.rules=saved; D.stores=recomputeStores(saved); D.warnings=rebuildWarnings(saved); }
}
const rulesErr=m=>{ const el=$('rules-err'); el.textContent=m||''; el.className=m?'err-text':'err-text hide'; };
// Midpoint between two neighbouring multipliers, rounded to 1 decimal —
// the ratio boundary where one tier hands over to the next.
const mid=(a,b)=>Math.round((a+b)/2*10)/10;
// Keep cuts consistent with the bands: cuts[i] is the boundary between
// tiers[i] and tiers[i+1], i.e. the midpoint of their multipliers.
function maintainCutsAfterAdd(nr,i){
  const ms=nr.mult;
  if(ms.length<2) return;
  if(i===ms.length-1){ // new largest band: boundary for the previous largest
    nr.cuts.push({max:mid(ms[i-1].m,ms[i].m),sqft:ms[i-1].sqft}); }
  else {
    if(i>0){ const c=nr.cuts.find(x=>x.sqft===ms[i-1].sqft); if(c) c.max=mid(ms[i-1].m,ms[i].m); }
    nr.cuts.push({max:mid(ms[i].m,ms[i+1].m),sqft:ms[i].sqft}); }
  nr.cuts.sort((a,b)=>a.max-b.max);
}
function maintainCutsAfterDelete(nr,deletedSqft,i){
  if(!nr.mult.length){ nr.cuts=[]; return; }
  if(i===nr.mult.length){ // deleted band was the largest: the cut that led
    // to the new largest tier is now the open end, so it goes away.
    const top=nr.mult[nr.mult.length-1].sqft;
    nr.cuts=nr.cuts.filter(x=>x.sqft!==top); }
  else {
    nr.cuts=nr.cuts.filter(x=>x.sqft!==deletedSqft);
    if(i>0){ const c=nr.cuts.find(x=>x.sqft===nr.mult[i-1].sqft);
      if(c) c.max=mid(nr.mult[i-1].m,nr.mult[i].m); } }
  nr.cuts.sort((a,b)=>a.max-b.max);
}

function init(){
  $('upd').textContent='Last Updated: '+new Date(D.updated).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'});
  renderBell();
  $('st').length=0;
  D.stores.forEach(s=>$('st').insertAdjacentHTML('beforeend',`<option>${esc(s.store)}</option>`));
  // Default store: first in data order that has a multiplier rule (i.e. not Sq.Ft 300).
  cur=D.stores.find(s=>(D.rules.mult||[]).some(m=>m.sqft===s.sqft))||D.stores[0]||null;
  $('store-search').value=cur?cur.store:'';
  $('tol').textContent=D.matchTolerancePct??1;
  // Transactions page filters + Reports circle filter
  $('txn-store').innerHTML='<option value="">All stores</option>'+D.stores.map(s=>`<option${cur&&s.store===cur.store?' selected':''}>${esc(s.store)}</option>`).join('');
  $('txn-date').innerHTML='<option value="">All dates</option>'+(cur&&cur.recentDays?cur.recentDays.map(d=>`<option>${esc(d.label)}</option>`).join(''):'');
  const circles=[...new Set(D.stores.map(s=>s.circle||'').filter(Boolean))].sort();
  $('rep-circle').innerHTML='<option value="">All circles</option>'+circles.map(c=>`<option>${esc(c)}</option>`).join('');
  renderDash(); drawRules(); renderDQ(); renderMaster(''); renderTxnPage(); updateCustomChip();
}

/* ---------- Dashboard ---------- */
function renderDash(){ renderKpis(); renderPickerFields(); renderSummary(); renderDonut(); renderCapacity(); renderMaterial(); renderTxn(); renderTrend(); }

/* KPI icons (inline SVG outline icons, matching the sidebar). */
const IC={
 store:'<svg viewBox="0 0 24 24"><path d="M3 9l1.5-5h15L21 9M3 9v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9M3 9h18M9 21v-6h6v6"/></svg>',
 check:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>',
 alert:'<svg viewBox="0 0 24 24"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
 trend:'<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
 layers:'<svg viewBox="0 0 24 24"><path d="M12 2l10 5-10 5L2 7z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>'};
/* Five KPI cards, in order. The classification is the store variance status,
   renamed: Less Space = Shortage, Extra Space = Excess. Okay is the
   remainder — Total minus Less minus Extra (Matched + Unknown today, since
   Matched is 0). Dedicated is INDEPENDENT of status: stores whose actual
   Sq.Ft is 300 (the dedicated size), counted from the store master. The two
   42s coincide today only because Matched is 0; they are computed separately
   and will diverge if a store ever lands Matched. */
function renderKpis(){
  const S=D.stores, tot=S.length;
  const less=S.filter(s=>s.status==='Shortage').length;
  const extra=S.filter(s=>s.status==='Excess').length;
  const okay=tot-less-extra;
  const ded=S.filter(s=>s.sqft===300).length;
  const pc=x=>tot? (x/tot*100).toFixed(1)+'%' : '—';
  const card=(key,ic,label,val,p,icCls,ttl)=>`<div class="kpi ${kpiOpen===key?'open':''}" data-kpi="${key}" tabindex="0" role="button" title="${ttl||'Click to see the stores'}">
    <span class="kpi-ic ${icCls}">${ic}</span><span class="kpi-tx"><span>${label}</span><b>${n(val)}</b></span><span class="kpi-pc">${p}</span></div>`;
  $('kp').innerHTML=
    card('total',IC.store,'Total Stores',tot,'','blu')+
    card('okay',IC.check,'Okay Stores',okay,pc(okay),'grn','Neither less nor extra space — click to see the stores')+
    card('less',IC.alert,'Less Space Stores',less,pc(less),'amb','Stock shortage — click to see the stores')+
    card('extra',IC.trend,'Extra Space Stores',extra,pc(extra),'red','Excess stock — click to see the stores')+
    card('dedicated',IC.layers,'Dedicated (300 Sq.Ft)',ded,pc(ded),'pur','Stores with 300 Sq.Ft — click to see the stores');
  document.querySelectorAll('#kp .kpi').forEach(el=>{
    el.onclick=()=>toggleKpi(el.dataset.kpi);
    el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleKpi(el.dataset.kpi);}};
  });
}
function kpiStores(key){
  if(key==='total') return D.stores;
  if(key==='okay') return D.stores.filter(s=>s.status!=='Shortage'&&s.status!=='Excess');
  if(key==='less') return D.stores.filter(s=>s.status==='Shortage');
  if(key==='extra') return D.stores.filter(s=>s.status==='Excess');
  if(key==='dedicated') return D.stores.filter(s=>s.sqft===300);
  if(key==='mismatch') return D.stores.filter(s=>s.spaceMismatch);
  return [];
}
const KPI_TITLES={total:'All stores',okay:'Okay stores (neither less nor extra space)',less:'Less Space stores (Shortage)',extra:'Extra Space stores (Excess)',dedicated:'Dedicated stores (300 Sq.Ft)',mismatch:'Space mismatch stores (actual stock in a different Sq.Ft category)'};
function toggleKpi(key){
  kpiOpen=kpiOpen===key?null:key;
  renderKpis();
  if(!kpiOpen){ $('kpi-detail').classList.add('hide'); $('kpi-detail').innerHTML=''; return; }
  const rows=kpiStores(key), el=$('kpi-detail');
  const dirOf=s=>{
    if(s.effectiveSqft===null||s.effectiveSqft===undefined) return 'No stock';
    if(s.effectiveSqft>s.sqft) return '▲ Over';
    if(s.effectiveSqft<s.sqft) return '▼ Under';
    return '—'; };
  const tbl= key==='mismatch'
    ? `<div class="tbl-scroll"><table><tr><th>Store</th><th>Circle</th><th>Own Sq.Ft</th><th>Effective Sq.Ft</th><th>Direction</th><th>Actual</th><th>Projected</th></tr>`+
      rows.map(s=>`<tr class="clickable" data-store="${esc(s.store)}"><td>${esc(s.store)}</td><td>${esc(s.circle||'—')}</td><td>${s.sqft}</td><td>${s.effectiveSqft==null?'—':s.effectiveSqft}</td><td>${dirOf(s)}</td><td>${n(s.actual)}</td><td>${n(s.projected)}</td></tr>`).join('')+'</table></div>'
    : `<div class="tbl-scroll"><table><tr><th>Store</th><th>Circle</th><th>Sq.Ft</th><th>Projected</th><th>Actual</th><th>Variance</th><th>S2W</th><th>Status</th></tr>`+
      rows.map(s=>`<tr class="clickable" data-store="${esc(s.store)}"><td>${esc(s.store)}</td><td>${esc(s.circle||'—')}</td><td>${s.sqft}</td><td>${n(s.projected)}</td><td>${n(s.actual)}</td><td class="${vc(s.variance)}">${sg(s.variance)}</td><td>${s2wText(s)}</td><td>${pill(s.status)}</td></tr>`).join('')+'</table></div>';
  el.innerHTML=`<div class="card-head"><h2>${KPI_TITLES[key]} — ${rows.length}</h2><button id="kpi-close">✕ Close</button></div>`+
    (rows.length? tbl : '<p class="muted">No stores in this category.</p>');
  el.classList.remove('hide');
  $('kpi-close').onclick=()=>{kpiOpen=null;renderKpis();el.classList.add('hide');el.innerHTML='';};
  el.querySelectorAll('tr.clickable').forEach(tr=>tr.onclick=()=>{
    const s=D.stores.find(x=>x.store===tr.dataset.store); if(!s) return;
    selectStore(s); $('summary-card').scrollIntoView({behavior:'smooth',block:'start'});
  });
}

function renderPickerFields(){
  if(!cur) return;
  $('pf-circle').textContent=cur.circle||'—';
  $('pf-sqft').textContent=cur.sqft+' Sq.Ft';
  $('pf-eff').textContent=cur.effectiveSqft==null?'—':cur.effectiveSqft+' Sq.Ft';
  const st=(cur.storeStatus||'').trim();
  $('pf-status').innerHTML=st? `<span class="pill ${st.toLowerCase()==='active'?'Active':'Unknown'}">${esc(st)}</span>` : '—';
}

function renderSummary(){
  if(!cur) return;
  const cap=capOf(cur);
  // Variance number follows the capacity status, not the variance sign:
  // an over-occupied store must not show a big green variance next to a red badge.
  const varCls=cap.cls==='cap-ok'?'pos':cap.cls==='cap-crit'?'neg':cap.cls==='cap-watch'?'warn':'';
  const b=$('cap-badge');
  b.textContent=cap.label==='—'?'Capacity Status: —':'Capacity Status: '+cap.label;
  b.className='cap-badge '+cap.cls;
  const mult=(D.rules.mult||[]).find(m=>m.sqft===cur.sqft);
  const stat=(label,val,sub,cl)=>`<div class="stat"><span>${label}</span><b class="${cl||''}">${val}</b><small>${sub}</small></div>`;
  $('sum-stats').innerHTML=
    stat('Projected Stock',n(cur.projected),mult?`As per ${cur.sqft} Sq.Ft (${mult.m}x)`:'No multiplier rule')+
    stat('Actual Usable Stock',n(cur.actual),'From Report tab')+
    stat('Variance',sg(cur.variance),pctOf(cur.variance,cur.projected)===null?'—':fmtPct(pctOf(cur.variance,cur.projected))+' '+cur.status,varCls)+
    stat('S2W Stock',s2wText(cur),cur.s2wStatus,cur.s2wStatus==='Limit Breached'?'neg':'');
  const al=cur.projected? cur.actual/cur.projected*100 : null;
  $('align-pct').textContent=al===null?'—':al.toFixed(1)+'%';
  $('align-frac').textContent=cur.projected?`${n(cur.actual)} / ${n(cur.projected)}`:'';
  const bar=$('align-bar');
  bar.style.width=al===null?'0%':Math.min(100,Math.max(0,al))+'%';
  bar.className='bar-'+cap.cls.replace('cap-','');
  $('eff-box').innerHTML=effBox(cur);
}

function centerTextPlugin(total){
  return {id:'centerText',beforeDraw(c){
    const a=c.chartArea; if(!a) return;
    const x=(a.left+a.right)/2, y=(a.top+a.bottom)/2, ctx=c.ctx;
    ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='700 22px system-ui, sans-serif'; ctx.fillStyle='#1f2937';
    ctx.fillText(String(total),x,y-9);
    ctx.font='12px system-ui, sans-serif'; ctx.fillStyle='#6b7280';
    ctx.fillText('Materials',x,y+11); ctx.restore(); }};
}
function renderDonut(){
  const empty=$('donut-empty');
  if(charts.ch1){charts.ch1.destroy();charts.ch1=null;}
  if(!cur||!cur.materials||!cur.materials.length){
    empty.textContent='No multiplier rule for Sq.Ft '+(cur?cur.sqft:'—')+' — no materials to show.';
    empty.classList.remove('hide'); $('donut-legend').innerHTML=''; return;
  }
  // If the Chart.js CDN failed to load, don't kill the whole dashboard —
  // show the counts as text and let the rest of the page render.
  if(typeof Chart==='undefined'){
    const cnt={Matched:0,Shortage:0,Excess:0};
    cur.materials.forEach(m=>{cnt[m.status]=(cnt[m.status]||0)+1;});
    empty.textContent='Chart could not be loaded (check your connection and refresh). Materials: Excess '+cnt.Excess+', Shortage '+cnt.Shortage+', Matched '+cnt.Matched+'.';
    empty.classList.remove('hide'); $('donut-legend').innerHTML=''; return;
  }
  empty.classList.add('hide');
  const cnt={Matched:0,Shortage:0,Excess:0};
  cur.materials.forEach(m=>{cnt[m.status]=(cnt[m.status]||0)+1;});
  // Donut follows the reconciliation colour convention: excess is green
  // (more stock than projected), shortage red, matched neutral grey.
  const labels=['Excess','Shortage','Matched'], cols=['#22c55e','#ef4444','#9ca3af'];
  const tot=cur.materials.length;
  charts.ch1=new Chart($('ch1'),{type:'doughnut',
    data:{labels,datasets:[{data:labels.map(l=>cnt[l]),backgroundColor:cols,borderWidth:2,borderColor:'#fff'}]},
    options:{cutout:'68%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.label}: ${c.parsed} (${(c.parsed/tot*100).toFixed(1)}%)`}}}},
    plugins:[centerTextPlugin(tot)]});
  $('donut-legend').innerHTML=labels.map((l,i)=>`<div class="leg"><span class="dot" style="background:${cols[i]}"></span>${l} (${cnt[l]})<b>${(cnt[l]/tot*100).toFixed(1)}%</b></div>`).join('');
}

function renderCapacity(){
  const rows=(D.rules.mult||[]).map(m=>({sqft:m.sqft,m:m.m+'x',s2w:m.s2w,norule:false}));
  // The 300 row is only a "no rule" placeholder when no 300 band exists.
  if(!(D.rules.mult||[]).some(m=>m.sqft===300)) rows.push({sqft:300,m:'—',s2w:'—',norule:true});
  $('cap-table').innerHTML='<tr><th>Sq.Ft</th><th>Multiplier</th><th>S2W Limit</th></tr>'+
    rows.map(r=>`<tr class="${cur&&cur.sqft===r.sqft?'hl':''}"><td>${r.sqft}</td><td>${r.m}</td><td>${r.s2w}${r.norule?' <span class="muted">(No rule)</span>':''}</td></tr>`).join('');
}

function renderMaterial(){
  if(!cur) return;
  const el=$('mt');
  if(!cur.materials||!cur.materials.length){
    el.innerHTML='<tr><td>No multiplier rule for Sq.Ft '+cur.sqft+' — projected quantities can’t be computed, so there is no material-wise reconciliation for this store.</td></tr>'; return;
  }
  el.innerHTML='<tr><th>#</th><th>Material</th><th>Projected Qty ('+cur.sqft+' Sq.Ft)</th><th>Actual Usable Qty</th><th>Variance (Actual - Projected)</th><th>Variance %</th><th>Status</th></tr>'+
    cur.materials.map((m,i)=>`<tr><td>${i+1}</td><td>${esc(m.material)}</td><td>${n(m.projected)}</td><td>${n(m.actual)}</td><td class="${vc(m.variance)}">${sg(m.variance)}</td><td class="${vc(m.variance)}">${(m.pct>0?'+':'')+m.pct.toFixed(1)}%</td><td>${pill(m.status)}</td></tr>`).join('');
}
/* ---------- Transaction Summary + Trend tabs (EI Stats issuance history) ---------- */
function renderTxn(){
  const el=$('txn-body'); if(!cur) return;
  const days=cur.recentDays||[];
  if(!days.length){ el.innerHTML='<p class="empty">No daily issuance record is available in EI Stats — the daily matrix has no dated columns, so there is nothing to show for this store.</p>'; return; }
  const tot=days.reduce((t,d)=>t+d.value,0);
  el.innerHTML='<p class="muted">Last 15 days · from EI Stats daily record</p>'+
    (typeof Chart==='undefined'?'':'<div style="max-width:560px;margin:0 auto 10px"><canvas id="ch-txn" height="120"></canvas></div>')+
    '<table><tr><th>Date</th><th>Issuance count</th></tr>'+
    days.map(d=>`<tr><td>${esc(d.label)}</td><td>${n(d.value)}</td></tr>`).join('')+
    `<tr><td><b>Total (15 days)</b></td><td><b>${n(tot)}</b></td></tr></table>`;
  if(typeof Chart==='undefined') return;
  if(charts.txn){charts.txn.destroy();charts.txn=null;}
  charts.txn=new Chart($('ch-txn'),{type:'bar',
    data:{labels:days.map(d=>d.label),datasets:[{data:days.map(d=>d.value),backgroundColor:'#3b82f6'}]},
    options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});
}
function renderTrend(){
  const el=$('trend-body'); if(!cur) return;
  const ms=cur.lastMonths||[];
  if(!ms.length){ el.innerHTML='<p class="empty">No monthly issuance record is available in EI Stats — no month columns were found, so there is no trend to draw.</p>'; return; }
  el.innerHTML='<p class="muted">Last 3 months · from EI Stats monthly totals (last month is so far)</p>'+
    (typeof Chart==='undefined'?'':'<div style="max-width:560px;margin:0 auto 10px"><canvas id="ch-trend" height="120"></canvas></div>')+
    '<table><tr><th>Month</th><th>Issuance</th></tr>'+
    ms.map((m,i)=>`<tr><td>${esc(m.label)}${i===ms.length-1?' (so far)':''}</td><td>${n(m.value)}</td></tr>`).join('')+'</table>';
  if(typeof Chart==='undefined') return;
  if(charts.trend){charts.trend.destroy();charts.trend=null;}
  charts.trend=new Chart($('ch-trend'),{type:'bar',
    data:{labels:ms.map(m=>m.label),datasets:[{data:ms.map(m=>m.value),backgroundColor:'#22c55e'}]},
    options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}}}});
}
document.querySelectorAll('#dash-tabs .tab').forEach(t=>t.onclick=()=>{
  matTab=t.dataset.tab;
  document.querySelectorAll('#dash-tabs .tab').forEach(x=>x.classList.toggle('on',x===t));
  $('tab-mat').classList.toggle('hide',matTab!=='mat');
  $('tab-txn').classList.toggle('hide',matTab!=='txn');
  $('tab-trend').classList.toggle('hide',matTab!=='trend');
  $('mat-export').style.visibility=matTab==='mat'?'visible':'hidden';
  // Re-render the chart tab on open — a chart built while hidden has no size.
  if(matTab==='txn') renderTxn();
  if(matTab==='trend') renderTrend();
});
/* The Space Mismatch link inside the Effective Space box opens the same
   drill-down the old KPI card used to open. */
$('dash').addEventListener('click',e=>{ const b=e.target.closest('[data-open-kpi]'); if(!b) return;
  if(kpiOpen!==b.dataset.openKpi) toggleKpi(b.dataset.openKpi);
  $('kpi-detail').scrollIntoView({behavior:'smooth',block:'start'}); });
/* Allocation Rules tabs: Base Allocation / Multipliers / S2W Limits /
   Effective Space / Change History. */
document.querySelectorAll('#rules-tabs .tab').forEach(t=>t.onclick=()=>{
  document.querySelectorAll('#rules-tabs .tab').forEach(x=>x.classList.toggle('on',x===t));
  ['base','mult','s2w','eff','hist'].forEach(k=>$('rtab-'+k).classList.toggle('hide',k!==t.dataset.rtab));
});
$('mat-export').onclick=()=>{ if(!cur) return;
  downloadCsv(cur.store+'_reconciliation.csv',
    [['Material','Projected','Actual','Variance','Var%','Status'],
     ...cur.materials.map(m=>[m.material,m.projected,m.actual,m.variance,m.pct.toFixed(1),m.status])]); };

/* ---------- Searchable store picker ---------- */
const pickerInput=$('store-search'), pickerDd=$('store-dd');
let pickerItems=[];
function pickerFilter(){
  // When the box still holds the selected store's name, show the full list.
  const raw=pickerInput.value.trim().toLowerCase();
  const q=(cur&&raw===cur.store.toLowerCase())?'':raw;
  let list=D.stores.filter(s=>!q||s.store.toLowerCase().includes(q)||(s.circle||'').toLowerCase().includes(q));
  if(q) list=list.slice(0,50);
  return list;
}
function renderPicker(){
  const list=pickerFilter(); pickerItems=list;
  pickerDd.innerHTML=list.length
    ? list.map((s,i)=>`<div class="picker-item${i===0?' first':''}" data-i="${i}">${esc(s.store)} <span class="muted">${esc(s.circle||'')} · ${s.sqft} Sq.Ft</span></div>`).join('')
    : '<div class="picker-empty">No matching store.</div>';
  pickerDd.classList.remove('hide');
  pickerDd.querySelectorAll('.picker-item').forEach(el=>el.onclick=()=>{const s=pickerItems[+el.dataset.i]; if(s) selectStore(s);});
}
function closePicker(){ pickerDd.classList.add('hide'); }
function selectStore(s){ cur=s; pickerInput.value=s.store; closePicker(); renderDash(); }
pickerInput.addEventListener('focus',renderPicker);
pickerInput.addEventListener('click',renderPicker);
pickerInput.addEventListener('input',renderPicker);
pickerInput.addEventListener('keydown',e=>{
  if(e.key==='Enter'){ const s=pickerFilter()[0]; if(s){e.preventDefault();selectStore(s);} }
  else if(e.key==='Escape'){ closePicker(); pickerInput.blur(); }
});
document.addEventListener('click',e=>{
  if(!e.target.closest('.picker')) closePicker();
  if(!e.target.closest('.bell-wrap')) $('bell-dd').classList.add('hide');
});

/* ---------- Bell / warnings ---------- */
$('bell').onclick=e=>{ e.stopPropagation(); $('bell-dd').classList.toggle('hide'); };
$('bell-dd').addEventListener('click',e=>{
  if(e.target.closest('.bell-item')){ $('bell-dd').classList.add('hide'); show('dq'); }
});

/* ---------- Store Reconciliation (existing behaviour) ---------- */
function apply(){ cur=D.stores.find(s=>s.store===$('st').value); if(!cur) return;
  $('meta').textContent=cur.circle+' · '+cur.sqft+' Sq.Ft';
  const k=(l,v,x='')=>`<div class="kpi"><span class="kpi-tx"><span>${l}</span><b class="${x}">${v}</b></span></div>`;
  $('rk').innerHTML=k('Projected',n(cur.projected))+k('Actual usable',n(cur.actual))+k('Variance',sg(cur.variance),vc(cur.variance))+k('S2W',s2wText(cur)+' '+cur.s2wStatus,cur.s2wStatus==='Limit Breached'?'neg':'');
  rt(); }
function rt(){ if(!cur) return;
  const q=$('q').value.toLowerCase();
  const R=cur.materials.filter(m=>m.material.toLowerCase().includes(q)).sort((a,b)=>(a[sortK]>b[sortK]?1:-1)*sortD);
  const H=[['material','Material'],['projected','Projected'],['actual','Actual'],['variance','Variance'],['pct','Var %'],['status','Status']];
  $('rt').innerHTML='<tr><th>#</th>'+H.map(h=>`<th data-k="${h[0]}">${h[1]}</th>`).join('')+'</tr>'+
    R.map((m,i)=>`<tr><td>${i+1}</td><td>${esc(m.material)}</td><td>${n(m.projected)}</td><td>${n(m.actual)}</td><td class="${vc(m.variance)}">${sg(m.variance)}</td><td class="${vc(m.variance)}">${(m.pct>0?'+':'')+m.pct.toFixed(1)}%</td><td>${pill(m.status)}</td></tr>`).join('');
  document.querySelectorAll('#rt th[data-k]').forEach(t=>t.onclick=()=>{sortD=sortK===t.dataset.k?-sortD:1;sortK=t.dataset.k;rt();}); }
$('ap').onclick=apply;
$('rs').onclick=()=>{cur=null;$('rt').innerHTML='';$('rk').innerHTML='';$('meta').textContent='';};
$('q').oninput=rt;
$('ex').onclick=()=>{ if(!cur) return;
  downloadCsv(cur.store+'_reconciliation.csv',
    [['Material','Projected','Actual','Variance','Var%','Status'],
     ...cur.materials.map(m=>[m.material,m.projected,m.actual,m.variance,m.pct.toFixed(1),m.status])]); };

/* ---------- Stores Master ---------- */
function renderMaster(){
  const q=($('mq').value||'').trim().toLowerCase();
  const rows=D.stores.filter(s=>!q||s.store.toLowerCase().includes(q)||(s.circle||'').toLowerCase().includes(q));
  $('mmeta').textContent=rows.length+' of '+D.stores.length+' stores';
  $('mtbl').innerHTML='<tr><th>Store</th><th>Circle</th><th>Sq.Ft</th><th>Effective Sq.Ft</th><th>Store Status</th><th>Projected</th><th>Actual</th><th>Variance</th><th>S2W</th><th>Status</th></tr>'+
    rows.map(s=>`<tr class="clickable" data-store="${esc(s.store)}"><td>${esc(s.store)}</td><td>${esc(s.circle||'—')}</td><td>${s.sqft}</td><td>${s.effectiveSqft==null?'—':s.effectiveSqft}</td><td>${(s.storeStatus||'').trim()?esc(s.storeStatus):'—'}</td><td>${n(s.projected)}</td><td>${n(s.actual)}</td><td class="${vc(s.variance)}">${sg(s.variance)}</td><td>${s2wText(s)}</td><td>${pill(s.status)}</td></tr>`).join('');
  $('mtbl').querySelectorAll('tr.clickable').forEach(tr=>tr.onclick=()=>{
    const s=D.stores.find(x=>x.store===tr.dataset.store); if(!s) return;
    selectStore(s); show('dash'); $('summary-card').scrollIntoView({behavior:'smooth',block:'start'});
  });
}
$('mq').addEventListener('input',renderMaster);

/* ---------- Transactions page (real daily issuance from EI Stats) ----------
   The page lists the daily issuance record every store already carries
   (recentDays, last 15 days). Store / date / text filters + CSV export.
   Item-level detail (material, reference number) is not in the source
   data, so those columns are not shown. */
function txnRows(){
  const storeSel=$('txn-store').value, dateSel=$('txn-date').value, q=($('txn-q').value||'').trim().toLowerCase();
  const rows=[];
  D.stores.forEach(s=>{
    if(storeSel&&s.store!==storeSel) return;
    if(q&&!s.store.toLowerCase().includes(q)&&!(s.circle||'').toLowerCase().includes(q)) return;
    (s.recentDays||[]).forEach(d=>{
      if(dateSel&&d.label!==dateSel) return;
      rows.push({label:d.label,store:s.store,circle:s.circle||'—',value:d.value});
    });
  });
  return rows;
}
function renderTxnPage(){
  if(!D) return;
  const rows=txnRows();
  $('txn-meta').textContent='Showing '+Math.min(rows.length,200)+' of '+rows.length.toLocaleString('en-IN')+' records';
  const body=rows.slice(0,200).map(r=>`<tr><td>${esc(r.label)}</td><td>${esc(r.store)}</td><td>${esc(r.circle)}</td><td>Issuance</td><td>${n(r.value)}</td></tr>`).join('');
  $('txn-table').innerHTML='<tr><th>Transaction Date</th><th>Store Name</th><th>Circle</th><th>Transaction Type</th><th>Quantity</th></tr>'+
    (body||'<tr><td colspan="5" class="muted">No issuance records match these filters.</td></tr>');
}
$('txn-store').addEventListener('change',renderTxnPage);
$('txn-date').addEventListener('change',renderTxnPage);
$('txn-q').addEventListener('input',renderTxnPage);
$('txn-export').onclick=()=>{ const rows=txnRows();
  downloadCsv('transaction_report.csv',[['Transaction Date','Store','Circle','Transaction Type','Quantity'],...rows.map(r=>[r.label,r.store,r.circle,'Issuance',r.value])]); };

/* ---------- Reports ---------- */
function downloadCsv(name,rows){
  const csv=rows.map(r=>r.map(x=>{const v=String(x??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}).join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
const STORE_CSV_HEAD=['Store','Circle','Sq.Ft','Store Status','Projected','Actual','Variance','S2W','S2W Max','S2W Status','Status'];
const storeCsvRow=s=>[s.store,s.circle,s.sqft,(s.storeStatus||'').trim(),s.projected,s.actual,s.variance,s.s2w,s.s2wMax,s.s2wStatus,s.status];
// The circle filter on the Reports page applies to every report below.
const repStores=()=>{ const c=$('rep-circle').value; return c? D.stores.filter(s=>s.circle===c) : D.stores; };
const repRows=list=>list.map(storeCsvRow);
$('rep-all').onclick=()=>downloadCsv('all_stores.csv',[STORE_CSV_HEAD,...repRows(repStores())]);
$('rep-short').onclick=()=>downloadCsv('shortage_stores.csv',[STORE_CSV_HEAD,...repRows(repStores().filter(s=>s.status==='Shortage'))]);
$('rep-excess').onclick=()=>downloadCsv('excess_stores.csv',[STORE_CSV_HEAD,...repRows(repStores().filter(s=>s.status==='Excess'))]);
$('rep-breach').onclick=()=>downloadCsv('s2w_breaches.csv',[STORE_CSV_HEAD,...repRows(repStores().filter(s=>s.s2wStatus==='Limit Breached'))]);
$('rep-okay').onclick=()=>downloadCsv('okay_stores.csv',[STORE_CSV_HEAD,...repRows(repStores().filter(s=>s.status!=='Shortage'&&s.status!=='Excess'))]);
$('rep-dedicated').onclick=()=>downloadCsv('dedicated_300sqft_stores.csv',[STORE_CSV_HEAD,...repRows(repStores().filter(s=>s.sqft===300))]);
$('rep-material').onclick=()=>{ const rows=[];
  repStores().forEach(s=>(s.materials||[]).forEach(m=>rows.push([s.store,s.circle,s.sqft,m.material,m.projected,m.actual,m.variance,m.pct.toFixed(1),m.status])));
  downloadCsv('material_wise_stock.csv',[['Store','Circle','Sq.Ft','Material','Projected','Actual','Variance','Var%','Status'],...rows]); };
$('rep-txn').onclick=()=>{ const rows=[];
  repStores().forEach(s=>(s.recentDays||[]).forEach(d=>rows.push([d.label,s.store,s.circle,'Issuance',d.value])));
  downloadCsv('transaction_report.csv',[['Transaction Date','Store','Circle','Transaction Type','Quantity'],...rows]); };

/* ---------- Allocation Rules (interactive) ----------
   Every input commits on change (not on every keystroke, so the re-render
   never steals focus mid-typing). Each edit clones the live rules, applies
   the change, and recomputes the whole app via applyRules(). */
/* Change History tab: rule edits are logged in this browser only (the
   site has no login and no server-side save), newest first, capped at 50. */
const HIST_KEY='stock-tracker-rules-history';
function logRuleChange(note){ try{
  const h=JSON.parse(localStorage.getItem(HIST_KEY)||'[]');
  h.unshift({ts:Date.now(),note});
  localStorage.setItem(HIST_KEY,JSON.stringify(h.slice(0,50))); }catch(e){} }
function renderHistory(){ const el=$('rhist'); if(!el) return;
  let h=[]; try{ h=JSON.parse(localStorage.getItem(HIST_KEY)||'[]'); }catch(e){}
  el.innerHTML=h.length? h.map(x=>`<div class="hist-item">${esc(x.note)}<small>${new Date(x.ts).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'})} · This browser</small></div>`).join('')
    : '<p class="muted">No rule changes recorded in this browser yet.</p>'; }
function drawRules(){ if(!D.rules) return;
  // The re-render replaces the inputs below; if one of them still has focus
  // (a change handler runs mid-blur), blur it first — removing a focused
  // node via innerHTML throws in Chrome ("node to be removed is no longer
  // a child of this node").
  const ae=document.activeElement;
  if(ae&&($('ra').contains(ae)||$('rm-mult').contains(ae)||$('rm-s2w').contains(ae)||$('rc').contains(ae))) ae.blur();
  const R=D.rules;
  $('ra').innerHTML='<tr><th>Material</th><th>Base qty</th></tr>'+R.alloc.map((a,i)=>
    `<tr><td>${esc(a.material)}</td><td><input type="number" min="0" step="1" value="${a.base}" data-alloc="${i}" class="num" aria-label="Base qty for ${esc(a.material)}"></td></tr>`).join('');
  $('rm-mult').innerHTML='<tr><th>Sq.Ft</th><th>Multiplier</th><th></th></tr>'+R.mult.map((m,i)=>
    `<tr><td>${m.sqft}</td><td><input type="number" min="0" step="0.1" value="${m.m}" data-mult-m="${i}" class="num" aria-label="Multiplier for ${m.sqft} Sq.Ft"></td><td><button class="icon-btn" data-del-mult="${i}" title="Delete the ${m.sqft} Sq.Ft band">×</button></td></tr>`).join('');
  $('rm-s2w').innerHTML='<tr><th>Sq.Ft</th><th>S2W max</th></tr>'+R.mult.map((m,i)=>
    `<tr><td>${m.sqft}</td><td><input type="number" min="0" step="1" value="${m.s2w}" data-mult-s="${i}" class="num" aria-label="S2W max for ${m.sqft} Sq.Ft"></td></tr>`).join('');
  const bt=baseTotalOf(R), tiers=tiersOf(R);
  $('rc').innerHTML=(R.cuts||[]).map((c,i)=>
    `<div class="cut-row"><label>Up to <input type="number" min="0.1" step="0.1" value="${c.max}" data-cut="${i}" class="num" aria-label="Cutoff leading to ${c.sqft} Sq.Ft">× base → ${c.sqft} Sq.Ft</label></div>`).join('')+
    `<p class="muted">A store's actual stock ÷ ${n(bt)} (base total) decides its effective space${tiers.length?`; above the last cutoff it is the largest tier (${tiers[tiers.length-1]} Sq.Ft)`:''}. Cutoffs must stay in increasing order.</p>`;
  renderHistory();
  // Base qty edits
  document.querySelectorAll('#ra input[data-alloc]').forEach(el=>el.onchange=()=>{
    const i=+el.dataset.alloc, raw=el.value.trim(), v=Number(raw);
    if(raw===''||!isFinite(v)||v<0){ el.value=D.rules.alloc[i].base; rulesErr('Base qty must be 0 or more — kept the previous value.'); return; }
    const nr=cloneRules(D.rules); const old=nr.alloc[i].base; nr.alloc[i].base=v; rulesErr(''); applyRules(nr,true,nr.alloc[i].material+' base qty '+old+' → '+v); });
  // Multiplier edits
  document.querySelectorAll('#rm-mult input[data-mult-m]').forEach(el=>el.onchange=()=>{
    const i=+el.dataset.multM, raw=el.value.trim(), v=Number(raw);
    if(raw===''||!isFinite(v)||v<0){ el.value=D.rules.mult[i].m; rulesErr('Multiplier must be 0 or more — kept the previous value.'); return; }
    const nr=cloneRules(D.rules); const old=nr.mult[i].m; nr.mult[i].m=v; rulesErr(''); applyRules(nr,true,nr.mult[i].sqft+' Sq.Ft multiplier '+old+'× → '+v+'×'); });
  // S2W limit edits
  document.querySelectorAll('#rm-s2w input[data-mult-s]').forEach(el=>el.onchange=()=>{
    const i=+el.dataset.multS, raw=el.value.trim(), v=Number(raw);
    if(raw===''||!isFinite(v)||v<0){ el.value=D.rules.mult[i].s2w; rulesErr('S2W max must be 0 or more — kept the previous value.'); return; }
    const nr=cloneRules(D.rules); const old=nr.mult[i].s2w; nr.mult[i].s2w=v; rulesErr(''); applyRules(nr,true,nr.mult[i].sqft+' Sq.Ft S2W max '+old+' → '+v); });
  // Cutoff edits — must stay strictly increasing
  document.querySelectorAll('#rc input[data-cut]').forEach(el=>el.onchange=()=>{
    const i=+el.dataset.cut, raw=el.value.trim(), v=Number(raw);
    const cuts=D.rules.cuts||[];
    const prev=i>0?cuts[i-1].max:0, next=i<cuts.length-1?cuts[i+1].max:Infinity;
    if(raw===''||!isFinite(v)||v<=0||v<=prev||v>=next){ el.value=cuts[i].max;
      rulesErr('Cutoffs must stay in increasing order'+(i>0?' (above '+prev+'×)':'')+(i<cuts.length-1?' (below '+next+'×)':'')+' — kept the previous value.'); return; }
    const nr=cloneRules(D.rules); const old=nr.cuts[i].max; nr.cuts[i].max=v; rulesErr(''); applyRules(nr,true,'Effective-space cutoff → '+cuts[i].sqft+' Sq.Ft: '+old+'× → '+v+'×'); });
  // Delete a band
  document.querySelectorAll('#rm-mult button[data-del-mult]').forEach(el=>el.onclick=()=>{
    const i=+el.dataset.delMult, nr=cloneRules(D.rules);
    const removed=nr.mult.splice(i,1)[0];
    maintainCutsAfterDelete(nr,removed.sqft,i);
    rulesErr(''); applyRules(nr,true,'Deleted the '+removed.sqft+' Sq.Ft band');
    if(!nr.mult.length) rulesErr('No Sq.Ft bands left — every store is now Unknown. Use Reset to restore the defaults.'); });
  // Add a band (form sits under the multipliers table, in the same tab)
  $('add-band').onclick=()=>{
    const sqft=parseInt($('new-sqft').value,10), m=Number($('new-m').value), s2w=Number($('new-s2w').value);
    if(!isFinite(sqft)||sqft<=0){ rulesErr('Enter a Sq.Ft size (a whole number above 0).'); return; }
    if((D.rules.mult||[]).some(x=>x.sqft===sqft)){ rulesErr('A '+sqft+' Sq.Ft band already exists.'); return; }
    if(!isFinite(m)||m<0){ rulesErr('Enter a multiplier (0 or more).'); return; }
    if(!isFinite(s2w)||s2w<0){ rulesErr('Enter an S2W max (0 or more).'); return; }
    const nr=cloneRules(D.rules);
    nr.mult.push({sqft,m,s2w}); nr.mult.sort((a,b)=>a.sqft-b.sqft);
    maintainCutsAfterAdd(nr,nr.mult.findIndex(x=>x.sqft===sqft));
    rulesErr(''); applyRules(nr,true,'Added '+sqft+' Sq.Ft band (×'+m+', S2W max '+s2w+')'); };
}
function downloadFile(name,text,type){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([text],{type:type||'application/json'})); a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
$('rules-reset').onclick=()=>{ try{ localStorage.removeItem(LS_KEY); }catch(e){}
  rulesErr(''); applyRules(cloneRules(defaultRules),false,'Reset to defaults'); };
$('rules-export').onclick=()=>downloadFile('stock-tracker-rules.json',JSON.stringify(D.rules,null,2));
$('rules-import-btn').onclick=()=>$('rules-import').click();
$('rules-import').onchange=e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{ let r; try{ r=JSON.parse(rd.result); }catch(err){ rulesErr('Could not read that file — it is not valid JSON.'); e.target.value=''; return; }
    const err=validRules(r);
    if(err){ rulesErr('That rules file was rejected: '+err); e.target.value=''; return; }
    rulesErr(''); applyRules(cleanRules(r),true,'Imported rules from '+f.name); e.target.value=''; };
  rd.onerror=()=>{ rulesErr('Could not read that file.'); e.target.value=''; };
  rd.readAsText(f); };
/* Data Quality: the engine's warning strings are free text, so they are
   categorised here into Issue Type / Store / Material / Severity /
   Recommended Action. The full warning text stays as the Description. */
function dqCat(w){
  let m;
  if(/has no multiplier rule/.test(w)){ m=w.match(/"([^"]+)"/); return {type:'Unknown store Sq.Ft',store:m?m[1]:'—',material:'—',sev:'Critical',act:'Add a multiplier rule for this Sq.Ft size on the Allocation Rules page.'}; }
  if(/Report has no column for material/.test(w)){ m=w.match(/"([^"]+)"/); return {type:'Unknown material',store:'—',material:m?m[1]:'—',sev:'Critical',act:'Check the Report tab — the material column is missing, so its stock is not counted.'}; }
  if(/Report store .* not found in EI Stats/.test(w)){ m=w.match(/"([^"]+)"/); return {type:'Missing store mapping',store:m?m[1]:'—',material:'—',sev:'Warning',act:'Add the store to EI Stats or check the store name spelling.'}; }
  if(/non-numeric/.test(w)){ m=w.match(/^Report (\S+) \/ (\S+):/); return {type:'Invalid quantity',store:m?m[1]:'—',material:m?m[2]:'—',sev:'Warning',act:'Fix the cell value in the Report tab.'}; }
  if(/blank usable-stock cells/.test(w)) return {type:'Missing data',store:'—',material:'—',sev:'Information',act:'Confirm the blank cells should be 0.'};
  if(/have no row in Report/.test(w)) return {type:'Missing store mapping',store:'—',material:'—',sev:'Warning',act:'Add the missing rows to the Report tab.'};
  if(/Duplicate store in EI Stats/.test(w)){ m=w.match(/: (.+)$/); return {type:'Duplicate record',store:m?m[1]:'—',material:'—',sev:'Warning',act:'Remove the duplicate row in EI Stats.'}; }
  if(/Duplicate S2W row ignored/.test(w)){ m=w.match(/: (.+)$/); return {type:'Duplicate record',store:m?m[1]:'—',material:'—',sev:'Warning',act:'Remove the duplicate S2W row.'}; }
  if(/S2W store .* not found in EI Stats/.test(w)){ m=w.match(/"([^"]+)"/); return {type:'S2W mapping issue',store:m?m[1]:'—',material:'—',sev:'Warning',act:'Add the store to EI Stats or check the name.'}; }
  if(/invalid Total Count/.test(w)){ m=w.match(/^S2W (\S+):/); return {type:'Invalid quantity',store:m?m[1]:'—',material:'—',sev:'Warning',act:'Fix the Total Count in the S2W tab.'}; }
  if(/have no S2W record/.test(w)) return {type:'S2W mapping issue',store:'—',material:'—',sev:'Information',act:'Add the S2W row — S2W shows as Unknown until then.'};
  return {type:'Data warning',store:'—',material:'—',sev:'Warning',act:'Review the source sheet.'};
}
function renderDQ(){ const W=D.warnings||[];
  const crit=W.filter(w=>dqCat(w).sev==='Critical').length;
  $('dq-meta').textContent=W.length? W.length+' warnings · '+crit+' critical · '+(W.length-crit)+' other' : 'No warnings.';
  const body=W.map(w=>{ const c=dqCat(w);
    return `<tr><td>${esc(c.type)}</td><td>${esc(c.store)}</td><td>${esc(c.material)}</td><td>${esc(w)}</td><td><span class="sev sev-${c.sev}">${c.sev}</span></td><td>${esc(c.act)}</td></tr>`; }).join('');
  $('dq-table').innerHTML='<tr><th>Issue Type</th><th>Store</th><th>Material</th><th>Description</th><th>Severity</th><th>Recommended Action</th></tr>'+
    (body||'<tr><td colspan="6">No warnings.</td></tr>');
}

load();
