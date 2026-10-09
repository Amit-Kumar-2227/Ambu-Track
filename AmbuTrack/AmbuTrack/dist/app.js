import { graph, places, hospitals, initialUnits, closureEdge } from './data.js';
import { aStar, nearestUnit, key, edgeCost } from './routing.js';
import { firebaseSettings } from './firebase-config.js';
import { openBackend, createSaveQueue } from './backend.js';
import { encodeTrip, decodeTrip, validateState } from './state.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const icons={dashboard:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',ambulance:'M3 7h11v11H3z M14 11h4l3 4v3h-7 M7 10v5 M4.5 12.5h5 M6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M6 4h5',hospital:'M5 21V3h14v18 M2 21h20 M9 7h6 M12 4v6 M9 21v-6h6v6',route:'M5 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M19 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4 M7 6h8a4 4 0 0 1 0 8H9a4 4 0 0 0 0 4h8',list:'M8 5h13 M8 12h13 M8 19h13 M3 5h.1 M3 12h.1 M3 19h.1',info:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M12 10v7 M12 6h.01',pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0 M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',plus:'M12 5v14 M5 12h14',check:'M4 12l5 5L20 6',expand:'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5',download:'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',play:'M8 4l12 8-12 8z'};
const icon=n=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[n]||icons.info}"/></svg>`;
$$('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let units=initialUnits.map(u=>({...u})), route=null, trip=null, playing=false, traceIndex=1, zoom=1, toastTimer;
let history=[];
let backend=null, saveQueue=null, backendReady=false, backendFailed=false, conflict=false;
const canChange=()=>backendReady&&!backendFailed;
try { const saved=JSON.parse(localStorage.getItem('ambutrack-history')||'[]'); if(Array.isArray(saved)) history=saved.filter(r=>r&&typeof r.id==='string'&&['Completed','Cancelled'].includes(r.status)).slice(0,100); } catch { /* A restricted browser can still run the demo. */ }
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000);}
const option=(value,label)=>`<option value="${escape(value)}">${escape(label)}</option>`;
$('#pickup').innerHTML=places.map(p=>option(p.id,p.name)).join(''); $('#pickup').value='5-3';
$('#hospital').innerHTML=hospitals.map(h=>option(h.id,h.name)).join('');
$('#unit').insertAdjacentHTML('beforeend',units.map(u=>option(u.id,`${escape(u.id)} · ${escape(u.type)}`)).join(''));
function options(){return {traffic:$('#traffic').checked,blocked:$('#closure').checked?new Set([key(...closureEdge)]):new Set()};}
function go(page){if(!$('#page-'+page))page='dashboard';$$('.page').forEach(p=>p.hidden=p.id!=='page-'+page);$$('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('#breadcrumb').textContent={dashboard:'Overview',fleet:'Ambulance fleet',hospitals:'Hospitals',requests:'Trip history',algorithm:'A* explorer',about:'About AmbuTrack'}[page];document.title=`AmbuTrack • ${$('#breadcrumb').textContent}`;if(page==='fleet')renderFleet();if(page==='hospitals')renderHospitals();if(page==='requests')renderHistory();if(page==='algorithm')renderTrace();window.scrollTo(0,0);}
$$('[data-page]').forEach(b=>b.addEventListener('click',()=>{location.hash=b.dataset.page;go(b.dataset.page)}));window.addEventListener('hashchange',()=>go(location.hash.slice(1)));go(location.hash.slice(1)||'dashboard');
function plan(notify=false){
  if(trip)return;
  const pickup=$('#pickup').value, hospital=hospitals.find(h=>h.id===$('#hospital').value), opt=options();
  let result;
  if($('#unit').value==='auto')result=nearestUnit(graph,units,pickup,opt);
  else {const unit=units.find(u=>u.id===$('#unit').value&&u.status==='Available');if(unit)result={unit,route:aStar(graph,unit.node,pickup,opt)};}
  route=null;
  if(result&&result.route.path.length){const onward=aStar(graph,pickup,hospital.node,opt);if(onward.path.length)route={unit:result.unit,pickup,hospital,toPickup:result.route,onward,opt};}
  traceIndex=1;renderRoute();renderMap();renderTrace();renderHospitals();
  if(notify)toast(route?'A* route recalculated.':'No available ambulance can complete this route.');
}
function renderRoute(){
  $('#dispatch-button').disabled=!route||!!trip||!canChange();
  if(!route){$('#route-summary').innerHTML='<strong>No route available</strong><p>Select an available unit or change the pickup.</p>';$('#route-status').textContent='No route available';return;}
  const r=route;$('#route-summary').innerHTML=`<div class="summary-top"><strong>${escape(r.unit.id)} recommended</strong><span>${r.toPickup.visited.length} nodes explored</span></div><div class="summary-numbers"><div><b>${r.toPickup.minutes.toFixed(1)}<span>min</span></b>To pickup</div><div><b>${(r.toPickup.km+r.onward.km).toFixed(1)}<span>km</span></b>Total journey</div></div>`;
  $('#route-status').textContent=`A* · ${(r.toPickup.minutes+r.onward.minutes).toFixed(1)} min total estimated travel`;
}
function lockForm(lock){lock=lock||!canChange();$$('#route-form select,#route-form input,#route-form button').forEach(e=>e.disabled=lock);$('#dispatch-button').disabled=lock||!route;$$('[data-action="new"]').forEach(e=>e.disabled=lock);}
function renderMetrics(){ $('#available').innerHTML=`${String(units.filter(u=>u.status==='Available').length).padStart(2,'0')}<span>/ ${String(units.length).padStart(2,'0')}</span>`;$('#active-count').textContent=trip?'01':'00';$('#active-caption').textContent=trip?'Simulation in progress':'Your next trip starts here';$('#completed-count').textContent=String(history.filter(t=>t.status==='Completed').length).padStart(2,'0');}
function request(){if(!canChange()){toast('Wait for the backend connection or resolve the sync error.');return;}if(trip){toast('Finish or cancel the active demo trip first.');return;}plan();if(!route){toast('Choose an available ambulance first.');return;}$('#request-name').value='Demo pickup';$('#request-dialog').showModal();}
$$('[data-action="new"]').forEach(b=>b.addEventListener('click',request));$('#dispatch-button').addEventListener('click',request);$('#close-dialog').addEventListener('click',()=>$('#request-dialog').close());
$('#request-form').addEventListener('submit',e=>{e.preventDefault();if(!canChange()||!route||trip)return;const name=$('#request-name').value.trim();if(!name){$('#request-name').setCustomValidity('Enter a request label.');$('#request-name').reportValidity();return;}$('#request-dialog').close();
  const path=[...route.toPickup.path,...route.onward.path.slice(1)];
  trip={id:'AT-'+Date.now().toString(36).toUpperCase(),name,priority:$('#priority').value,route,path,index:0,fraction:0,elapsed:0,pickupIndex:route.toPickup.path.length-1,created:new Date().toISOString()};
  route.unit.status='On trip';playing=true;lockForm(true);renderMetrics();renderTrip();renderMap();persistState();toast(`${route.unit.id} dispatched. Simulation runs at 30× speed.`);
});
$('#request-name').addEventListener('input',()=>$('#request-name').setCustomValidity(''));
$('#route-form').addEventListener('submit',e=>{e.preventDefault();if(!canChange())return;plan(true);persistState()});$$('#route-form select,#route-form input').forEach(e=>e.addEventListener('change',()=>{if(!canChange())return;plan();persistState()}));
$('#show-explored').addEventListener('change',renderMap);
function renderBase(){
 let blocks='',roads='',labels='';const seen=new Set();
 for(const n of Object.values(graph)) {
  const [x,y]=n.id.split('-').map(Number);if(x<9&&y<6&&graph[`${x+1}-${y}`]&&graph[`${x}-${y+1}`])blocks+=`<rect x="${n.x+15}" y="${n.y+14}" width="53" height="49" rx="5" fill="${(x+y)%4===0?'#d6e6cd':'#e0e5da'}" stroke="#d6dfd0" stroke-width=".5"/>`;
  for(const e of n.edges){const k=key(n.id,e.to);if(seen.has(k))continue;seen.add(k);const b=graph[e.to];roads+=`<path d="M${n.x},${n.y}L${b.x},${b.y}" fill="none" stroke="#d3dccf" stroke-width="12"/><path d="M${n.x},${n.y}L${b.x},${b.y}" fill="none" stroke="#fffef9" stroke-width="9"/>`;}
 }
 labels='<text x="340" y="38" class="map-label">NORTH DISTRICT</text><text x="382" y="222" class="map-label">MP NAGAR</text><text x="657" y="399" class="map-label">SAKET NAGAR</text><text x="198" y="452" class="map-label">ARERA COLONY</text><text x="477" y="551" class="map-label">SOUTH DISTRICT</text>';
 $('#blocks').innerHTML=blocks;$('#roads').innerHTML=roads;$('#map-labels').innerHTML=labels;
}
const pathD=path=>path.map((id,i)=>`${i?'L':'M'}${graph[id].x},${graph[id].y}`).join(' ');
function renderMap(){
 let lines='',markers='',explored='';const r=trip?trip.route:route;
 if($('#traffic').checked){const done=new Set();for(const n of Object.values(graph))for(const e of n.edges){const k=key(n.id,e.to);if(e.traffic<2||done.has(k))continue;done.add(k);const b=graph[e.to];lines+=`<path d="M${n.x} ${n.y}L${b.x} ${b.y}" stroke="#ddac63" stroke-width="3" opacity=".7"/>`;}}
 if(r){if($('#show-explored').checked)explored=[...new Set([...r.toPickup.visited,...r.onward.visited])].map(id=>`<circle cx="${graph[id].x}" cy="${graph[id].y}" r="8" fill="#94ba7b" opacity=".55"/>`).join('');lines+=`<path d="${pathD(r.toPickup.path)}" class="route-path" stroke="white" stroke-width="9"/><path d="${pathD(r.toPickup.path)}" class="route-path" stroke="#137b60" stroke-width="5"/><path d="${pathD(r.onward.path)}" class="route-path" stroke="white" stroke-width="8"/><path d="${pathD(r.onward.path)}" class="route-path" stroke="#137b60" stroke-width="4" stroke-dasharray="7 6"/>`;
 const p=graph[r.pickup];markers+=`<g transform="translate(${p.x},${p.y})"><circle r="17" fill="#e7bb99" opacity=".25"/><circle r="9" fill="#c98659" stroke="white" stroke-width="3"/><text x="13" y="-12" class="map-marker-label">Pickup</text></g>`;}
 if($('#closure').checked){const a=graph[closureEdge[0]],b=graph[closureEdge[1]],x=(a.x+b.x)/2,y=(a.y+b.y)/2;lines+=`<path d="M${a.x},${a.y}L${b.x},${b.y}" stroke="#ce7770" stroke-width="5"/><circle cx="${x}" cy="${y}" r="10" fill="#ce7770" stroke="white" stroke-width="2"/><path d="M${x-4},${y}h8" stroke="white" stroke-width="2"/>`;}
 for(const h of hospitals){const p=graph[h.node];markers+=`<g transform="translate(${p.x},${p.y})"><rect x="-12" y="-12" width="24" height="24" rx="6" fill="white" stroke="#cd9c8c"/><text text-anchor="middle" y="4" font-size="12" font-weight="700" fill="#b57965">H</text><text x="0" y="-19" text-anchor="middle" class="map-marker-label">${escape(h.name)}</text></g>`;}
 for(const u of units){let p=graph[u.node];if(trip&&trip.route.unit.id===u.id){const a=graph[trip.path[trip.index]],b=graph[trip.path[Math.min(trip.index+1,trip.path.length-1)]];p={x:a.x+(b.x-a.x)*trip.fraction,y:a.y+(b.y-a.y)*trip.fraction};}const color=u.status==='Offline'?'#9aa59e':'#197455';markers+=`<g class="unit-marker" transform="translate(${p.x},${p.y})"><circle r="16" fill="white"/><circle r="13" fill="${color}"/><path d="M-7-4h8v8H-7z M1-1h4l3 3v2H1 M-3-3v5 M-5-.5h4" fill="none" stroke="white" stroke-width="1.2"/><circle cx="-4" cy="5" r="1.5" fill="white"/><circle cx="5" cy="5" r="1.5" fill="white"/><text x="0" y="29" text-anchor="middle" class="map-marker-label">${escape(u.id)}</text></g>`;}
 $('#route-lines').innerHTML=lines;$('#markers').innerHTML=markers;$('#explored').innerHTML=explored;
}
function setZoom(value){zoom=Math.max(1,Math.min(1.8,value));$('#map').setAttribute('viewBox',`${440-440/zoom} ${282.5-282.5/zoom} ${880/zoom} ${565/zoom}`)}$('#zoom-in').onclick=()=>setZoom(zoom+.2);$('#zoom-out').onclick=()=>setZoom(zoom-.2);$('#reset-map').onclick=()=>setZoom(1);
function renderTrip(){
 if(!trip){$('#trip-badge').textContent='READY';$('#trip-caption').textContent='Follow each stage of your simulated journey';$('#trip-content').innerHTML=`<div class="empty-trip">${icon('route')}<div><strong>Your next response starts here.</strong><p>Plan a route above, then dispatch an ambulance to begin.</p></div><button class="secondary" id="try-demo">Try a demo trip →</button></div>`;$('#try-demo').onclick=request;return;}
 const t=trip, picked=t.index>=t.pickupIndex,progress=100*t.elapsed/(t.route.toPickup.minutes+t.route.onward.minutes);
 $('#trip-badge').textContent=playing?'SIMULATING · 30×':'PAUSED';$('#trip-caption').textContent=`${t.id} · ${t.priority} priority · simulated tracking`;
 $('#trip-content').innerHTML=`<div class="trip-body"><div class="trip-info"><div><strong>${escape(t.name)} <span style="color:#aab7ae">/</span> ${escape(t.route.unit.id)}</strong><small id="trip-position">${picked?'Patient picked up · en route to hospital':'Ambulance en route to pickup'} · ${Math.max(0,t.route.toPickup.minutes+t.route.onward.minutes-t.elapsed).toFixed(1)} min remaining</small></div><div class="trip-controls"><button class="secondary" id="pause-trip">${playing?'Pause':'Resume'}</button><button class="secondary" id="cancel-trip">Cancel trip</button></div></div><div class="progress"><div id="trip-progress" style="width:${Math.min(100,progress)}%"></div></div><div class="stages"><span class="done">● Dispatched</span><span id="pickup-stage" class="${picked?'done':''}">● Patient pickup</span><span>● Hospital arrival</span></div></div>`;
 $('#pause-trip').onclick=()=>{if(!canChange())return;playing=!playing;renderTrip();persistState()};$('#cancel-trip').onclick=()=>finishTrip('Cancelled');
}
function finishTrip(status){
 const t=trip;if(!t||!canChange())return;const lastNode=t.path[t.index];t.route.unit.node=status==='Completed'?t.route.hospital.node:lastNode;t.route.unit.status='Available';
 history.unshift({id:t.id,name:t.name,priority:t.priority,pickup:places.find(p=>p.id===t.route.pickup).name,hospital:t.route.hospital.name,unit:t.route.unit.id,status,created:t.created,km:Number((t.route.toPickup.km+t.route.onward.km).toFixed(2)),estimatedMinutes:Number((t.route.toPickup.minutes+t.route.onward.minutes).toFixed(2))});history=history.slice(0,100);
 
 trip=null;playing=false;lockForm(false);plan();renderMetrics();renderTrip();renderFleet();renderHistory();persistState();toast(status==='Completed'?'Hospital reached. Trip completed.':'Trip cancelled. The ambulance is available again.');
}
// 250 ms of real time represents 7.5 seconds of simulated travel.
setInterval(()=>{if(!trip||!playing)return;let budget=.125;while(budget>0&&trip.index<trip.path.length-1){const a=trip.path[trip.index],b=trip.path[trip.index+1],edge=graph[a].edges.find(e=>e.to===b),cost=edgeCost(graph[a],{...graph[b],...edge},trip.route.opt.traffic),remaining=cost*(1-trip.fraction);if(budget>=remaining){trip.elapsed+=remaining;budget-=remaining;trip.index++;trip.fraction=0;}else{trip.fraction+=budget/cost;trip.elapsed+=budget;budget=0;}}if(trip.index>=trip.path.length-1){finishTrip('Completed');return;}const picked=trip.index>=trip.pickupIndex;
 $('#trip-position').textContent=`${picked?'Patient picked up · en route to hospital':'Ambulance en route to pickup'} · ${Math.max(0,trip.route.toPickup.minutes+trip.route.onward.minutes-trip.elapsed).toFixed(1)} min remaining`;
 $('#trip-progress').style.width=`${Math.min(100,100*trip.elapsed/(trip.route.toPickup.minutes+trip.route.onward.minutes))}%`;
 $('#pickup-stage').classList.toggle('done',picked);renderMap();},250);
function renderFleet(){ $('#fleet-grid').innerHTML=units.map(u=>`<article class="panel unit-card"><div class="card-top"><span class="metric-icon mint">${icon('ambulance')}</span><span class="status-pill ${u.status==='Offline'?'offline':u.status==='On trip'?'busy':''}">${u.status}</span></div><h2>${escape(u.id)}</h2><p>${escape(u.type)}</p><div class="card-detail">Crew <strong>${escape(u.crew)}</strong><br>Current network node <strong>${escape(u.node)}</strong></div><button class="secondary" data-toggle-unit="${escape(u.id)}" ${u.status==='On trip'||!canChange()?'disabled':''}>${u.status==='Offline'?'Set available':'Set offline'}</button></article>`).join('');$$('[data-toggle-unit]').forEach(b=>b.onclick=()=>{const u=units.find(u=>u.id===b.dataset.toggleUnit);if(!canChange()||u.status==='On trip')return;u.status=u.status==='Offline'?'Available':'Offline';renderFleet();renderMetrics();if(!trip)plan();else renderMap();persistState();});}
function renderHospitals(){const pickup=$('#pickup').value,filter=$('#service-filter').value;const list=hospitals.map(h=>({...h,route:aStar(graph,pickup,h.node,options())})).sort((a,b)=>a.route.minutes-b.route.minutes).filter(h=>filter==='all'||h.services.includes(filter));$('#hospital-grid').innerHTML=list.map((h,i)=>`<article class="panel hospital-card"><div class="card-top"><span class="metric-icon peach">${icon('hospital')}</span><span class="status-pill">${h.beds} demo beds</span></div><h2>${escape(h.name)}</h2><p>${escape(h.area)} · fictional partner</p><div class="tag-row">${h.services.map(s=>`<span>${escape(s)}</span>`).join('')}</div><div class="card-detail"><strong>${h.route.minutes.toFixed(1)} min</strong> from selected pickup<br>${h.route.km.toFixed(1)} km via A* route</div><button class="secondary" data-hospital="${escape(h.id)}" ${trip||!canChange()?'disabled':''}>Route to this hospital →</button></article>`).join('');$$('[data-hospital]').forEach(b=>b.onclick=()=>{if(!canChange()||trip)return;$('#hospital').value=b.dataset.hospital;plan();persistState();location.hash='dashboard';go('dashboard')});}$('#service-filter').onchange=renderHospitals;
function renderHistory(){ $('#history').innerHTML=history.length?history.map(t=>`<tr><td><strong>${escape(t.id)}</strong><small>${escape(t.name)}</small></td><td>${escape(t.pickup)}<small>→ ${escape(t.hospital)}</small></td><td>${escape(t.unit)}</td><td>${escape(t.priority)}</td><td><span class="status-pill ${t.status==='Cancelled'?'cancelled':''}">${escape(t.status)}</span></td><td>${escape(new Date(t.created).toLocaleDateString())}<small>${escape(new Date(t.created).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}</small></td></tr>`).join(''):'<tr><td colspan="6" class="empty-cell">No trips yet. Dispatch an ambulance from Overview to get started.</td></tr>';$('#export').disabled=!history.length;}
$('#export').onclick=()=>{const fields=['id','name','pickup','hospital','unit','priority','status','created','km','estimatedMinutes'];const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';const csv=[fields.join(','),...history.map(r=>fields.map(f=>cell(r[f])).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='ambutrack-trip-history.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
function renderTrace(){const r=trip?trip.route:route;if(!r){$('#trace').innerHTML='<tr><td colspan="5">Plan an available route first.</td></tr>';$('#trace-stats').innerHTML='';$('#trace-next').disabled=true;return;}$('#trace-next').disabled=false;const steps=r.toPickup.steps;traceIndex=Math.min(traceIndex,steps.length);$('#trace-stats').innerHTML=`<div><strong>${steps.length}</strong>Nodes explored</div><div><strong>${r.toPickup.path.length}</strong>Path nodes</div><div><strong>${r.toPickup.minutes.toFixed(1)}</strong>Minutes to pickup</div>`;$('#trace').innerHTML=steps.slice(0,traceIndex).map((s,i)=>`<tr class="${i===traceIndex-1?'highlight':''}"><td>${i+1}</td><td>${s.node}</td><td>${s.g.toFixed(2)}</td><td>${s.h.toFixed(2)}</td><td>${s.f.toFixed(2)}</td></tr>`).join('');$('#trace-next').textContent=traceIndex>=steps.length?'Restart trace':'Next step';}
$('#trace-next').onclick=()=>{const r=trip?trip.route:route;if(!r)return;traceIndex=traceIndex>=r.toPickup.steps.length?1:traceIndex+1;renderTrace();$('.trace-table').scrollTop=$('.trace-table').scrollHeight;};
renderBase();plan();renderMetrics();renderTrip();renderFleet();renderHistory();lockForm(true);
void initializeBackend();


function snapshotState(){
 return {schemaVersion:1,units:units.map(u=>({...u})),hospitals:hospitals.map(h=>({...h,services:[...h.services]})),history:history.map(h=>({...h})),activeTrip:encodeTrip(trip),settings:{pickup:$('#pickup').value,hospital:$('#hospital').value,unit:$('#unit').value,traffic:$('#traffic').checked,closed:$('#closure').checked}};
}
function applyState(raw){
 const s=validateState(raw),newUnits=s.units.map(u=>({...u})),newHospitals=s.hospitals.map(h=>({...h}));
 const restored=decodeTrip(s.activeTrip,newUnits,newHospitals,closureEdge);
 units=newUnits;hospitals.splice(0,hospitals.length,...newHospitals);history=s.history.map(h=>({...h}));
 $('#hospital').innerHTML=hospitals.map(h=>option(h.id,h.name)).join('');
 $('#unit').innerHTML=option('auto','Auto-assign · fastest arrival')+units.map(u=>option(u.id,`${u.id} · ${u.type}`)).join('');
 $('#pickup').value=s.settings.pickup;$('#hospital').value=s.settings.hospital;$('#unit').value=s.settings.unit;
 $('#traffic').checked=s.settings.traffic;$('#closure').checked=s.settings.closed;
 trip=restored;playing=false;route=trip?trip.route:null;
 if(trip){$('#pickup').value=trip.route.pickup;$('#hospital').value=trip.route.hospital.id;$('#traffic').checked=trip.route.opt.traffic;$('#closure').checked=trip.route.opt.blocked.size>0;renderRoute();renderMap();renderTrace();}else plan();
 $('.nav-count').textContent=units.length;$('#hospital-count').textContent=String(hospitals.length).padStart(2,'0');
 renderMetrics();renderTrip();renderFleet();renderHospitals();renderHistory();lockForm(!!trip);
}
function setBackendStatus(label,detail,error=false){
 $('#backend-status').textContent=label;$('#backend-status').classList.toggle('error',error);
 $('#backend-detail').textContent=detail;$('#backend-retry').hidden=!error;
}
function persistenceStatus(status,error){
 if(status==='saving')setBackendStatus(backend.mode==='firebase'?'Firebase · saving…':'Local demo · saving…','Saving the latest workspace changes.');
 if(status==='saved'){
  backendFailed=false;conflict=false;lockForm(!!trip);renderFleet();renderHospitals();
  setBackendStatus(backend.mode==='firebase'?'Firebase · connected':'Local demo · saved',backend.mode==='firebase'?'Firestore stores your fleet, hospitals, trip history and paused trip checkpoints.':'Firebase is not configured yet. Your demo is saved in this browser.');
 }
 if(status==='error'){
  backendFailed=true;playing=false;conflict=error?.code==='ambutrack/conflict';lockForm(true);renderTrip();renderFleet();renderHospitals();
  $('#backend-retry').textContent=conflict?'Reload cloud copy':'Retry save';
  setBackendStatus('Changes not saved',error.message||'The backend could not save. Check your connection and retry.',true);
  toast('Saving failed. Simulation paused; your current changes are still open here.');
 }
}
function persistState(){if(!backendReady||!saveQueue||backendFailed)return;saveQueue.enqueue(snapshotState());}
async function initializeBackend(){
 setBackendStatus('Connecting…','Checking your configured data backend.');
 try{
  backend=await openBackend(firebaseSettings,snapshotState());backendReady=true;
  saveQueue=createSaveQueue(state=>backend.save(state),persistenceStatus);applyState(backend.state);
  const cloud=backend.mode==='firebase';
  setBackendStatus(cloud?'Firebase · connected':'Local demo · Firebase pending',cloud?'Connected to your private Firebase workspace. Existing data is loaded; empty workspaces are seeded once.':'Firebase is ready to configure. Demo data is local until a Firebase web config is supplied.');
  $('#history-storage-note').textContent=cloud?'Completed and cancelled demo trips stored in your Firebase workspace.':'Completed and cancelled demo trips stored in this browser until Firebase is connected.';
  $('#storage-caption').textContent=cloud?'Stored in Cloud Firestore':'Saved on this browser';
  $('#backend-identity').textContent=cloud?'Workspace ID: '+backend.uid:'No Firebase project connected';
  if(backend.recoveryWarning)toast(backend.recoveryWarning);
  if(trip)toast('Saved trip restored in a paused state. Resume when ready.');
 }catch(error){backendReady=false;backendFailed=true;lockForm(true);renderFleet();renderHospitals();$('#backend-retry').textContent='Retry connection';setBackendStatus('Backend unavailable',error.message||'Could not connect to Firebase. Check its configuration, Auth provider and Firestore rules.',true);}
}
$('#backend-retry').onclick=()=>{if(conflict||!backendReady){location.reload();return;}saveQueue?.retry();};
// Checkpoint a moving simulation every five seconds, not every animation frame.
setInterval(()=>{if(trip&&playing&&canChange())persistState();},5000);
window.addEventListener('beforeunload',e=>{if(saveQueue?.unsaved){e.preventDefault();e.returnValue='';}});
