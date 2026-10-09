import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aStar,key,nearestUnit} from '../dist/routing.js';
import {graph,places,hospitals,initialUnits,closureEdge} from '../dist/data.js';
test('A* matches Dijkstra for every pickup, hospital, and traffic/closure scenario',()=>{
 for(const traffic of [false,true])for(const closed of [false,true]) {
  const options={traffic,blocked:closed?new Set([key(...closureEdge)]):new Set()};
  for(const start of [...places.map(p=>p.id),...initialUnits.map(u=>u.node)]) for(const goal of [...places.map(p=>p.id),...hospitals.map(h=>h.node)]) {
   const a=aStar(graph,start,goal,options),d=aStar(graph,start,goal,{...options,heuristic:false});
   assert.ok(Math.abs(a.minutes-d.minutes)<1e-9,`${start} → ${goal}`);
   assert.equal(a.path[0],start);assert.equal(a.path.at(-1),goal);
   for(let i=1;i<a.path.length;i++){assert.ok(graph[a.path[i-1]].edges.some(e=>e.to===a.path[i]));assert.ok(!options.blocked.has(key(a.path[i-1],a.path[i])));}
  }
 }
});
test('closure reroutes a direct route',()=>{const [start,goal]=closureEdge;const plain=aStar(graph,start,goal),closed=aStar(graph,start,goal,{blocked:new Set([key(start,goal)])});assert.equal(plain.path.length,2);assert.ok(closed.minutes>plain.minutes);});
test('unreachable and invalid destinations return no path',()=>{const blocked=new Set(graph['5-3'].edges.map(e=>key('5-3',e.to)));assert.deepEqual(aStar(graph,'2-4','5-3',{blocked}).path,[]);assert.equal(aStar(graph,'missing','5-3').minutes,Infinity);});
test('same-node route has zero travel time',()=>{const r=aStar(graph,'5-3','5-3');assert.deepEqual(r.path,['5-3']);assert.equal(r.minutes,0);});
test('auto assignment ignores unavailable units and handles no fleet',()=>{assert.equal(nearestUnit(graph,[],'5-3',{}),null);const units=initialUnits.map(u=>({...u,status:'Offline'}));assert.equal(nearestUnit(graph,units,'5-3',{}),null);units[1].status='Available';assert.equal(nearestUnit(graph,units,'5-3',{}).unit.id,'AMB-02');});
