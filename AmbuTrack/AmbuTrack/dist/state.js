import { graph, places } from './data.js';
import { aStar, key } from './routing.js';
const string = (x, max=100) => typeof x==='string' && x.length>0 && x.length<=max;
const unique = items => new Set(items.map(x=>x.id)).size===items.length;
export function validateState(s) {
  if(!s || s.schemaVersion!==1 || !Array.isArray(s.units) || !s.units.length || s.units.length>20 || !unique(s.units)) throw Error('Invalid fleet data.');
  for(const u of s.units) if(!string(u.id,40)||!graph[u.node]||!string(u.type)||!string(u.crew)||!['Available','Offline','On trip'].includes(u.status)) throw Error('Invalid ambulance record.');
  if(!Array.isArray(s.hospitals)||!s.hospitals.length||s.hospitals.length>20||!unique(s.hospitals)) throw Error('Invalid hospital data.');
  for(const h of s.hospitals) if(!string(h.id,40)||!graph[h.node]||!string(h.name)||!string(h.area)||!Array.isArray(h.services)||h.services.length>10||!h.services.every(x=>string(x,40))||!Number.isInteger(h.beds)||h.beds<0||h.beds>10000) throw Error('Invalid hospital record.');
  if(!Array.isArray(s.history)||s.history.length>100) throw Error('Invalid history data.');
  for(const r of s.history) if(!['id','name','pickup','hospital','unit','priority','created'].every(k=>string(r[k]))||!['Completed','Cancelled'].includes(r.status)||!Number.isFinite(r.km)||r.km<0||!Number.isFinite(r.estimatedMinutes)||r.estimatedMinutes<0) throw Error('Invalid trip history record.');
  const st=s.settings;
  if(!st||!places.some(p=>p.id===st.pickup)||!s.hospitals.some(h=>h.id===st.hospital)||!(st.unit==='auto'||s.units.some(u=>u.id===st.unit))||typeof st.traffic!=='boolean'||typeof st.closed!=='boolean') throw Error('Invalid route settings.');
  if(s.activeTrip!==null){const t=s.activeTrip;
    if(!t||!['id','name','priority','created','unitId','hospitalId'].every(k=>string(t[k]))||!graph[t.startNode]||!places.some(p=>p.id===t.pickup)||!s.units.some(u=>u.id===t.unitId&&u.status==='On trip')||!s.hospitals.some(h=>h.id===t.hospitalId)||!Number.isInteger(t.index)||t.index<0||!Number.isFinite(t.fraction)||t.fraction<0||t.fraction>=1||!Number.isFinite(t.elapsed)||t.elapsed<0||typeof t.traffic!=='boolean'||typeof t.closed!=='boolean') throw Error('Invalid active trip.');
  }
  if(s.units.filter(u=>u.status==='On trip').length!==(s.activeTrip?1:0)) throw Error('Fleet and active trip are inconsistent.');
  return s;
}
export function encodeTrip(t) {
  if(!t)return null;
  return {id:t.id,name:t.name,priority:t.priority,created:t.created,unitId:t.route.unit.id,hospitalId:t.route.hospital.id,startNode:t.path[0],pickup:t.route.pickup,index:t.index,fraction:t.fraction,elapsed:t.elapsed,traffic:t.route.opt.traffic,closed:t.route.opt.blocked.size>0};
}
export function decodeTrip(t,units,hospitals,closureEdge) {
  if(!t)return null;
  const unit=units.find(u=>u.id===t.unitId),hospital=hospitals.find(h=>h.id===t.hospitalId);
  const opt={traffic:t.traffic,blocked:t.closed?new Set([key(...closureEdge)]):new Set()};
  const toPickup=aStar(graph,t.startNode,t.pickup,opt),onward=aStar(graph,t.pickup,hospital.node,opt);
  const path=[...toPickup.path,...onward.path.slice(1)];
  if(!toPickup.path.length||!onward.path.length||t.index>=path.length||t.elapsed>toPickup.minutes+onward.minutes+.001)throw Error('Saved trip no longer matches the road network.');
  return {...t,path,route:{unit,hospital,pickup:t.pickup,toPickup,onward,opt},pickupIndex:toPickup.path.length-1};
}
