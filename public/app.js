let D=null,cur=null,sortK='material',sortD=1,charts={};
const $=id=>document.getElementById(id),n=x=>Number(x).toLocaleString('en-IN'),sg=x=>(x>0?'+':'')+n(x);
const cls=s=>s.split(' ')[0];const pill=s=>`<span class="pill ${cls(s)}">${s}</span>`;
const vc=x=>x>0?'pos':x<0?'neg':'';
function show(v){['dash','rec','rules','dq'].forEach(i=>$(i).classList.toggle('hide',i!==v));document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('on',a.dataset.v===v))}
document.querySelectorAll('nav a').forEach(a=>a.onclick=()=>show(a.dataset.v));
$('th').onclick=()=>{const d=document.body.parentElement;d.dataset.t=d.dataset.t==='dark'?'':'dark'};
function load(force){$('load').classList.remove('hide');$('msg').classList.add('hide');
 fetch('/api/data'+(force?'?force=1':'')).then(r=>r.json().then(d=>{if(!r.ok)throw new Error(d.error||r.statusText);return d}))
 .then(d=>{D=d;$('load').classList.add('hide');init();show('dash')})
 .catch(e=>{$('load').classList.add('hide');$('msg').textContent='Could not load data: '+e.message;$('msg').classList.remove('hide')})}
$('ref').onclick=()=>load(true);
function opts(el,vals){vals.forEach(v=>el.insertAdjacentHTML('beforeend',`<option>${v}</option>`))}
function init(){$('upd').textContent='Last synced '+new Date(D.updated).toLocaleString();
 ['fC','fS','st'].forEach(i=>$(i).length=i==='st'?0:1);
 opts($('fC'),[...new Set(D.stores.map(s=>s.circle))].sort());opts($('fS'),[...new Set(D.stores.map(s=>s.sqft))].sort((a,b)=>a-b));
 D.stores.forEach(s=>$('st').insertAdjacentHTML('beforeend',`<option>${s.store}</option>`));
 ['fC','fS','fT'].forEach(i=>$(i).onchange=dash);dash();
 $('wl').innerHTML=D.warnings.map(w=>`<li>${w}</li>`).join('')||'<li>No warnings.</li>';drawRules()}
function dash(){const c=$('fC').value,z=$('fS').value,t=$('fT').value;
 const S=D.stores.filter(s=>(!c||s.circle===c)&&(!z||s.sqft==z)&&(!t||s.status===t));
 const k=(l,v)=>`<div class="kpi"><span>${l}</span><b>${v}</b></div>`,cnt=x=>S.filter(s=>s.status===x).length;
 $('kp').innerHTML=k('Total stores',S.length)+k('Matched',cnt('Matched'))+k('Shortage stores',cnt('Shortage'))+k('Excess stores',cnt('Excess'));
 const tbl=(el,rows,f)=>$(el).innerHTML='<tr><th>Store</th><th>Circle</th><th>Value</th></tr>'+rows.map(s=>`<tr><td>${s.store}</td><td>${s.circle}</td><td class="${vc(f(s))}">${typeof f(s)==='number'?sg(f(s)):f(s)}</td></tr>`).join('');
 tbl('tS',[...S].sort((a,b)=>a.variance-b.variance).slice(0,10).filter(s=>s.variance<0),s=>s.variance);
 tbl('tE',[...S].sort((a,b)=>b.variance-a.variance).slice(0,10).filter(s=>s.variance>0),s=>s.variance);
 tbl('tB',S.filter(s=>s.s2wStatus==='Limit Breached'),s=>s.s2w+' / '+s.s2wMax);
 const cs={};S.forEach(s=>{if(s.variance<0)cs[s.circle]=(cs[s.circle]||0)+s.variance});
 draw('ch1','doughnut',['Excess','Shortage','Matched'],[cnt('Excess'),cnt('Shortage'),cnt('Matched')],['#15803d','#e11d1d','#9ca3af']);
 draw('ch2','bar',Object.keys(cs),Object.values(cs).map(Math.abs),'#e11d1d')}
function draw(id,type,l,d,c){if(charts[id])charts[id].destroy();charts[id]=new Chart($(id),{type,data:{labels:l,datasets:[{data:d,backgroundColor:c}]},options:{plugins:{legend:{display:type==='doughnut'}}}})}
function apply(){cur=D.stores.find(s=>s.store===$('st').value);if(!cur)return;
 $('meta').textContent=cur.circle+' · '+cur.sqft+' Sq.Ft';const k=(l,v,x='')=>`<div class="kpi"><span>${l}</span><b class="${x}">${v}</b></div>`;
 $('rk').innerHTML=k('Projected',n(cur.projected))+k('Actual usable',n(cur.actual))+k('Variance',sg(cur.variance),vc(cur.variance))+k('S2W',cur.s2w+' / '+cur.s2wMax+' '+cur.s2wStatus,cur.s2wStatus==='Limit Breached'?'neg':'');rt()}
function rt(){if(!cur)return;const q=$('q').value.toLowerCase();
 const R=cur.materials.filter(m=>m.material.toLowerCase().includes(q)).sort((a,b)=>(a[sortK]>b[sortK]?1:-1)*sortD);
 const H=[['material','Material'],['projected','Projected'],['actual','Actual'],['variance','Variance'],['pct','Var %'],['s2w','S2W'],['status','Status']];
 $('rt').innerHTML='<tr>'+H.map(h=>`<th data-k="${h[0]}">${h[1]}</th>`).join('')+'</tr>'+R.map(m=>`<tr><td>${m.material}</td><td>${n(m.projected)}</td><td>${n(m.actual)}</td><td class="${vc(m.variance)}">${sg(m.variance)}</td><td class="${vc(m.variance)}">${m.pct.toFixed(1)}%</td><td>${m.s2w==null?'—':n(m.s2w)}</td><td>${pill(m.status)}</td></tr>`).join('');
 document.querySelectorAll('#rt th').forEach(t=>t.onclick=()=>{sortD=sortK===t.dataset.k?-sortD:1;sortK=t.dataset.k;rt()})}
$('ap').onclick=apply;$('rs').onclick=()=>{cur=null;$('rt').innerHTML='';$('rk').innerHTML='';$('meta').textContent=''};$('q').oninput=rt;
$('ex').onclick=()=>{if(!cur)return;const r=[['Material','Projected','Actual','Variance','Var%','S2W','Status'],...cur.materials.map(m=>[m.material,m.projected,m.actual,m.variance,m.pct.toFixed(1),m.s2w,m.status])];
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([r.map(x=>x.join(',')).join('\n')],{type:'text/csv'}));a.download=cur.store+'_reconciliation.csv';a.click()};
function drawRules(){if(!D.rules){return}
 $('ra').innerHTML='<tr><th>Material</th><th>Base qty</th></tr>'+D.rules.alloc.map(a=>`<tr><td>${a.material}</td><td>${n(a.base)}</td></tr>`).join('');
 $('rm').innerHTML='<tr><th>Sq.Ft</th><th>Multiplier</th><th>S2W max</th></tr>'+D.rules.mult.map(m=>`<tr><td>${m.sqft}</td><td>${m.m}x</td><td>${m.s2w}</td></tr>`).join('')}
load();
