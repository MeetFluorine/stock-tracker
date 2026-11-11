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
// Capacity Status rule: alignment = actual / projected.
// >=95% OKAY (green), 80–95% WATCH (amber), <80% CRITICAL (red); Unknown store -> '—' (grey).
const capOf=s=>{ if(!s||s.status==='Unknown'||!s.projected) return {label:'—', cls:'cap-none'};
  const a=s.actual/s.projected*100;
  return a>=95?{label:'OKAY',cls:'cap-ok'}:a>=80?{label:'WATCH',cls:'cap-watch'}:{label:'CRITICAL',cls:'cap-crit'}; };
const s2wText=s=>s.s2wMax>0?`${n(s.s2w)} / ${n(s.s2wMax)}`:`${n(s.s2w)} / —`;
// Effective-space line for the Store Stock Summary card (tiers in order).
const TIERS=[25,50,100,200];
function effLine(s){
  if(!s) return '';
  if(s.effectiveSqft===null||s.effectiveSqft===undefined) return 'Effective space: No stock recorded';
  if(s.status==='Unknown') return 'Effective space: '+s.effectiveSqft+' Sq.Ft';
  if(s.effectiveSqft===s.sqft) return 'Effective space: '+s.sqft+' Sq.Ft — aligned with its space';
  const d=Math.abs(TIERS.indexOf(s.effectiveSqft)-TIERS.indexOf(s.sqft));
  return 'Effective space: '+s.effectiveSqft+' Sq.Ft — '+d+' tier'+(d>1?'s':'')+' '+(s.effectiveSqft>s.sqft?'above':'below')+' its '+s.sqft+' Sq.Ft';
}
const PAGES=['dash','rec','ledger','txn','master','rules','reports','dq'];

function show(v){ PAGES.forEach(i=>$(i).classList.toggle('hide',i!==v));
  document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('on',a.dataset.v===v));
  if(v==='dash'&&D) renderDash();
  document.querySelector('main').scrollTop=0; }
document.querySelectorAll('nav a').forEach(a=>a.onclick=()=>show(a.dataset.v));

function load(force){ $('load').classList.remove('hide'); $('msg').classList.add('hide');
  fetch('/api/data'+(force?'?force=1':'')).then(r=>r.json().then(d=>{if(!r.ok)throw new Error(d.error||r.statusText);return d}))
  .then(d=>{D=d;$('load').classList.add('hide');init();show('dash');})
  .catch(e=>{$('load').classList.add('hide');$('msg').textContent='Could not load data: '+e.message;$('msg').classList.remove('hide');}); }
$('ref').onclick=()=>load(true);

function init(){
  $('upd').textContent='Last Updated: '+new Date(D.updated).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'});
  const w=D.warnings||[];
  $('bell-badge').textContent=w.length; $('bell-badge').classList.toggle('hide',!w.length);
  $('dq-badge').textContent=w.length; $('dq-badge').classList.toggle('hide',!w.length);
  $('bell-dd').innerHTML=w.length? w.map(x=>`<div class="bell-item">${esc(x)}</div>`).join('') : '<div class="bell-item">No warnings.</div>';
  $('st').length=0;
  D.stores.forEach(s=>$('st').insertAdjacentHTML('beforeend',`<option>${esc(s.store)}</option>`));
  // Default store: first in data order that has a multiplier rule (i.e. not Sq.Ft 300).
  cur=D.stores.find(s=>(D.rules.mult||[]).some(m=>m.sqft===s.sqft))||D.stores[0]||null;
  $('store-search').value=cur?cur.store:'';
  $('tol').textContent=D.matchTolerancePct??1;
  renderDash(); drawRules(); renderDQ(); renderMaster('');
}

/* ---------- Dashboard ---------- */
function renderDash(){ renderKpis(); renderPickerFields(); renderSummary(); renderDonut(); renderCapacity(); renderMaterial(); renderTxn(); renderTrend(); }

function renderKpis(){
  const S=D.stores, cnt=x=>S.filter(s=>s.status===x).length;
  const tot=S.length, m=cnt('Matched'), sh=cnt('Shortage'), ex=cnt('Excess'), un=cnt('Unknown');
  const mm=S.filter(s=>s.spaceMismatch).length;
  const pc=x=>tot? (x/tot*100).toFixed(1)+'%' : '—';
  const card=(key,ic,label,val,p,icCls,ttl)=>`<div class="kpi ${kpiOpen===key?'open':''}" data-kpi="${key}" tabindex="0" role="button" title="${ttl||'Click to see the stores'}">
    <span class="kpi-ic ${icCls}">${ic}</span><span class="kpi-tx"><span>${label}</span><b>${n(val)}</b></span><span class="kpi-pc">${p}</span></div>`;
  $('kp').innerHTML=
    card('total','🏪','Total Stores',tot,'','')+
    card('compliant','✅','Compliant Stores',m,pc(m),'grn')+
    card('shortage','⚠️','Shortage Stores',sh,pc(sh),'amb')+
    card('excess','📈','Excess Stores',ex,pc(ex),'red')+
    card('unknown','❓','Unknown (Sq.Ft 300)',un,pc(un),'gry')+
    card('mismatch','📐','Space Mismatch',mm,pc(mm),'blu','Actual stock falls in a different Sq.Ft category than the store\u2019s own — click to see the stores');
  document.querySelectorAll('#kp .kpi').forEach(el=>{
    el.onclick=()=>toggleKpi(el.dataset.kpi);
    el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleKpi(el.dataset.kpi);}};
  });
}
function kpiStores(key){
  if(key==='total') return D.stores;
  if(key==='compliant') return D.stores.filter(s=>s.status==='Matched');
  if(key==='shortage') return D.stores.filter(s=>s.status==='Shortage');
  if(key==='excess') return D.stores.filter(s=>s.status==='Excess');
  if(key==='unknown') return D.stores.filter(s=>s.status==='Unknown');
  if(key==='mismatch') return D.stores.filter(s=>s.spaceMismatch);
  return [];
}
const KPI_TITLES={total:'All stores',compliant:'Compliant stores (Matched)',shortage:'Shortage stores',excess:'Excess stores',unknown:'Unknown stores (Sq.Ft 300 — no multiplier rule)',mismatch:'Space mismatch stores (actual stock in a different Sq.Ft category)'};
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
  const st=(cur.storeStatus||'').trim();
  $('pf-status').innerHTML=st? `<span class="pill ${st.toLowerCase()==='active'?'Active':'Unknown'}">${esc(st)}</span>` : '—';
}

function renderSummary(){
  if(!cur) return;
  const cap=capOf(cur);
  const b=$('cap-badge');
  b.textContent=cap.label==='—'?'Capacity Status: —':'Capacity Status: '+cap.label;
  b.className='cap-badge '+cap.cls;
  const mult=(D.rules.mult||[]).find(m=>m.sqft===cur.sqft);
  const stat=(label,val,sub,cl)=>`<div class="stat"><span>${label}</span><b class="${cl||''}">${val}</b><small>${sub}</small></div>`;
  $('sum-stats').innerHTML=
    stat('Projected Stock',n(cur.projected),mult?`As per ${cur.sqft} Sq.Ft (${mult.m}x)`:'No multiplier rule')+
    stat('Actual Usable Stock',n(cur.actual),'From Report tab')+
    stat('Variance',sg(cur.variance),pctOf(cur.variance,cur.projected)===null?'—':fmtPct(pctOf(cur.variance,cur.projected))+' '+cur.status,vc(cur.variance))+
    stat('S2W Stock',s2wText(cur),cur.s2wStatus,cur.s2wStatus==='Limit Breached'?'neg':'');
  const al=cur.projected? cur.actual/cur.projected*100 : null;
  $('align-pct').textContent=al===null?'—':al.toFixed(1)+'%';
  $('align-frac').textContent=cur.projected?`${n(cur.actual)} / ${n(cur.projected)}`:'';
  const bar=$('align-bar');
  bar.style.width=al===null?'0%':Math.min(100,Math.max(0,al))+'%';
  bar.className='bar-'+cap.cls.replace('cap-','');
  $('eff-line').textContent=effLine(cur);
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
    empty.textContent='Chart could not be loaded (check your connection and refresh). Materials: Matched '+cnt.Matched+', Shortage '+cnt.Shortage+', Excess '+cnt.Excess+'.';
    empty.classList.remove('hide'); $('donut-legend').innerHTML=''; return;
  }
  empty.classList.add('hide');
  const cnt={Matched:0,Shortage:0,Excess:0};
  cur.materials.forEach(m=>{cnt[m.status]=(cnt[m.status]||0)+1;});
  const labels=['Matched','Shortage','Excess'], cols=['#22c55e','#ef4444','#3b82f6'];
  const tot=cur.materials.length;
  charts.ch1=new Chart($('ch1'),{type:'doughnut',
    data:{labels,datasets:[{data:labels.map(l=>cnt[l]),backgroundColor:cols,borderWidth:2,borderColor:'#fff'}]},
    options:{cutout:'68%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.label}: ${c.parsed} (${(c.parsed/tot*100).toFixed(1)}%)`}}}},
    plugins:[centerTextPlugin(tot)]});
  $('donut-legend').innerHTML=labels.map((l,i)=>`<div class="leg"><span class="dot" style="background:${cols[i]}"></span>${l} (${cnt[l]})<b>${(cnt[l]/tot*100).toFixed(1)}%</b></div>`).join('');
}

function renderCapacity(){
  const rows=(D.rules.mult||[]).map(m=>({sqft:m.sqft,m:m.m+'x',s2w:m.s2w,norule:false}));
  rows.push({sqft:300,m:'—',s2w:'—',norule:true});
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
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
  matTab=t.dataset.tab;
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===t));
  $('tab-mat').classList.toggle('hide',matTab!=='mat');
  $('tab-txn').classList.toggle('hide',matTab!=='txn');
  $('tab-trend').classList.toggle('hide',matTab!=='trend');
  $('mat-export').style.visibility=matTab==='mat'?'visible':'hidden';
  // Re-render the chart tab on open — a chart built while hidden has no size.
  if(matTab==='txn') renderTxn();
  if(matTab==='trend') renderTrend();
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
  $('rt').innerHTML='<tr>'+H.map(h=>`<th data-k="${h[0]}">${h[1]}</th>`).join('')+'</tr>'+
    R.map(m=>`<tr><td>${esc(m.material)}</td><td>${n(m.projected)}</td><td>${n(m.actual)}</td><td class="${vc(m.variance)}">${sg(m.variance)}</td><td class="${vc(m.variance)}">${(m.pct>0?'+':'')+m.pct.toFixed(1)}%</td><td>${pill(m.status)}</td></tr>`).join('');
  document.querySelectorAll('#rt th').forEach(t=>t.onclick=()=>{sortD=sortK===t.dataset.k?-sortD:1;sortK=t.dataset.k;rt();}); }
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

/* ---------- Reports ---------- */
function downloadCsv(name,rows){
  const csv=rows.map(r=>r.map(x=>{const v=String(x??'');return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}).join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
const STORE_CSV_HEAD=['Store','Circle','Sq.Ft','Store Status','Projected','Actual','Variance','S2W','S2W Max','S2W Status','Status'];
const storeCsvRow=s=>[s.store,s.circle,s.sqft,(s.storeStatus||'').trim(),s.projected,s.actual,s.variance,s.s2w,s.s2wMax,s.s2wStatus,s.status];
$('rep-all').onclick=()=>downloadCsv('all_stores.csv',[STORE_CSV_HEAD,...D.stores.map(storeCsvRow)]);
$('rep-short').onclick=()=>downloadCsv('shortage_stores.csv',[STORE_CSV_HEAD,...D.stores.filter(s=>s.status==='Shortage').map(storeCsvRow)]);
$('rep-excess').onclick=()=>downloadCsv('excess_stores.csv',[STORE_CSV_HEAD,...D.stores.filter(s=>s.status==='Excess').map(storeCsvRow)]);
$('rep-breach').onclick=()=>downloadCsv('s2w_breaches.csv',[STORE_CSV_HEAD,...D.stores.filter(s=>s.s2wStatus==='Limit Breached').map(storeCsvRow)]);

/* ---------- Allocation Rules / Data Quality ---------- */
function drawRules(){ if(!D.rules) return;
  $('ra').innerHTML='<tr><th>Material</th><th>Base qty</th></tr>'+D.rules.alloc.map(a=>`<tr><td>${esc(a.material)}</td><td>${n(a.base)}</td></tr>`).join('');
  $('rm').innerHTML='<tr><th>Sq.Ft</th><th>Multiplier</th><th>S2W max</th></tr>'+D.rules.mult.map(m=>`<tr><td>${m.sqft}</td><td>${m.m}x</td><td>${m.s2w}</td></tr>`).join('');
}
function renderDQ(){ $('wl').innerHTML=(D.warnings||[]).map(w=>`<li>${esc(w)}</li>`).join('')||'<li>No warnings.</li>'; }

load();
