export const graph = {};
const omitted = new Set(['0-0','1-0','0-1','1-1','0-2','1-2']);
for(let y=0;y<7;y++) for(let x=0;x<10;x++) {
  const id=`${x}-${y}`; if(omitted.has(id)) continue;
  graph[id]={id, x:65+x*80+(y%2)*12, y:52+y*77, edges:[]};
}
for(const n of Object.values(graph)) {
  const [x,y]=n.id.split('-').map(Number);
  for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
    const to=`${nx}-${ny}`; if(!graph[to]) continue;
    n.edges.push({to,speed:(y===3||x===5)?50:35,traffic:(x>=3&&x<=6&&y>=2&&y<=4)?2.1:1.15});
  }
}
export const places=[
{id:'2-2',name:'Lake View Colony',area:'North district'},
{id:'4-1',name:'City Centre',area:'Central district'},
{id:'5-3',name:'MP Nagar',area:'Central district'},
{id:'3-5',name:'Arera Colony',area:'South district'},
{id:'8-4',name:'Saket Nagar',area:'East district'},
{id:'7-1',name:'Railway Station',area:'North district'},
{id:'1-4',name:'Community Campus',area:'West district'},
{id:'6-6',name:'Gulmohar Colony',area:'South district'}
];
export const hospitals=[
{id:'h1',node:'8-2',name:'City Care Hospital',area:'East district',services:['Trauma','Cardiac'],beds:8},
{id:'h2',node:'3-3',name:'Lakeview Medical Centre',area:'Central district',services:['General','Cardiac'],beds:5},
{id:'h3',node:'7-6',name:'Southside Hospital',area:'South district',services:['Trauma','General'],beds:12}
];
export const initialUnits=[
{id:'AMB-01',node:'2-4',type:'Advanced life support',crew:'Aarav & Priya',status:'Available'},
{id:'AMB-02',node:'6-1',type:'Basic life support',crew:'Rohan & Neha',status:'Available'},
{id:'AMB-03',node:'8-5',type:'Advanced life support',crew:'Kabir & Ananya',status:'Available'},
{id:'AMB-04',node:'5-6',type:'Basic life support',crew:'Ishaan & Meera',status:'Offline'}
];
export const closureEdge=['5-2','5-3'];
