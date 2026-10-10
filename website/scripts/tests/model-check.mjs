import assert from 'node:assert/strict';
import fs from 'node:fs';import ts from 'typescript';
const dir='.sites-runtime/qa';fs.mkdirSync(dir,{recursive:true});
for(const name of ['layouts','framing','designs','house','report']){let src=fs.readFileSync(`lib/${name}.ts`,'utf8').replaceAll("from './house'","from './house.mjs'").replaceAll("from './layouts'","from './layouts.mjs'").replaceAll("from './framing'","from './framing.mjs'").replaceAll("from './designs'","from './designs.mjs'");fs.writeFileSync(`${dir}/${name}.mjs`,ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
const {model,initial,generate,validate,options}=await import('../../'+dir+'/house.mjs');
let scenarios=0;const variants=new Set();
function check(c){const m=model(c);assert.deepEqual(validate(c),[]);
 assert.ok(Math.abs(m.rooms.reduce((a,r)=>a+r.w*r.d,0)-m.area)<.001,`Rooms tile footprint ${c.width}x${c.depth} ${c.layout}: ${m.rooms.reduce((a,r)=>a+r.w*r.d,0)} vs ${m.area}`);
 for(const r of m.rooms){assert.ok(r.w>0&&r.d>0);assert.ok(r.x>=0&&r.z>=0&&r.x+r.w<=m.w+.001&&r.z+r.d<=m.d+.001);}
 for(let i=0;i<m.rooms.length;i++)for(let j=i+1;j<m.rooms.length;j++){const a=m.rooms[i],b=m.rooms[j];assert.ok(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)<.001||Math.min(a.z+a.d,b.z+b.d)-Math.max(a.z,b.z)<.001,'Rooms do not overlap');}
 for(const w of m.walls){let end=0;for(const o of [...w.openings].sort((a,b)=>a.at-b.at)){assert.ok(o.at>=end-.001&&o.at+o.width<=w.length+.001,`Opening fits ${w.id}`);assert.ok(o.bottom+o.height+m.headerDepth<=c.wallHeight-.25+.001,'Header fits');end=o.at+o.width;}}
 assert.equal(new Set(m.studs.map(s=>s.id)).size,m.studs.length);assert.equal(Object.values(m.piecesByRole).reduce((a,b)=>a+b,0),m.studs.length);assert.ok(m.studs.every(s=>s.length>0&&s.length<=20));assert.equal(m.counts.exteriorStuds+m.counts.interiorStuds,m.counts.studs);
 assert.equal(new Set(m.frameMembers.map(s=>s.id)).size,m.frameMembers.length);assert.ok(m.frameMembers.every(s=>s.length>0&&s.length<=s.stockLength+.000001));
 assert.equal(m.counts.headerPlies,2*m.openings.length);assert.equal(m.counts.sills,m.counts.windows);assert.equal(m.piecesByRole['Corner backing'],4);
 for(const o of m.openings){assert.equal(m.frameMembers.filter(p=>p.openingId===o.id&&p.role==='King').length,2);assert.equal(m.frameMembers.filter(p=>p.openingId===o.id&&p.role==='Jack').length,2);}
 const lumber=m.items.filter(i=>['Exterior framing','Interior framing'].includes(i.category)&&i.unit==='boards');assert.equal(lumber.reduce((n,i)=>n+i.net,0),m.frameMembers.length,'Every framing cut has exactly one purchased stock blank before waste');
 for(const wall of m.walls)for(const o of wall.openings.filter(o=>o.kind!=='window'))for(const p of m.frameMembers.filter(p=>p.wallId===wall.id&&p.role==='Bottom plate')){const start=wall.axis==='x'?p.x1-wall.x:p.z1-wall.z,end=wall.axis==='x'?p.x2-wall.x:p.z2-wall.z;assert.ok(end<=o.at+.001||start>=o.at+o.width-.001,'No bottom plate crosses a doorway');}
 assert.equal(m.rafterStations.at(-1),c.width);assert.ok(m.rafterStations.slice(1).every((x,i)=>x-m.rafterStations[i]<=2));assert.equal(m.rafters.length,m.rafterStations.length*2*m.roofBays);assert.ok(m.rafters.every(r=>r.length>0&&r.stockLength>=r.length&&r.stockLength<=24));
 assert.equal(m.items.filter(i=>i.id.startsWith('rafter')&&/^rafter\d/.test(i.id)).reduce((n,i)=>n+i.net,0),m.counts.rafters);
 assert.ok(m.items.every(i=>Number.isFinite(i.total)&&i.qty>=0&&i.total>=0));assert.ok(Math.abs(m.items.reduce((a,i)=>a+i.total,0)-m.subtotal)<.011);assert.ok(Math.abs(m.drywallWalls+m.drywallCeiling-m.drywallTotal)<.011);
 for(const r of m.rooms.filter(r=>r.type==='bedroom'))assert.ok(m.walls.filter(w=>w.exterior).some(w=>{const along=w.axis==='x',on=along?Math.abs(r.z-w.z)<.001||Math.abs(r.z+r.d-w.z)<.001:Math.abs(r.x-w.x)<.001||Math.abs(r.x+r.w-w.x)<.001;return on&&w.openings.some(o=>o.kind==='window'&&o.at>=(along?r.x:r.z)-.001&&o.at+o.width<=(along?r.x+r.w:r.z+r.d)+.001)}),'Every separate bedroom has an exterior window');
 assert.equal(m.items.find(i=>i.id==='bathfixtures').net,m.counts.baths);assert.ok(!JSON.stringify(m.items).toLowerCase().includes('truss'));
 // Check a route from the front entrance to every room using actual wall gaps/doorways.
 const links=m.rooms.map(()=>[]),eps=.001;
 for(let i=0;i<m.rooms.length;i++)for(let j=i+1;j<m.rooms.length;j++){const a=m.rooms[i],b=m.rooms[j];let axis,line,lo,hi;
  if(Math.abs(a.x+a.w-b.x)<eps||Math.abs(b.x+b.w-a.x)<eps){axis='z';line=Math.abs(a.x+a.w-b.x)<eps?b.x:a.x;lo=Math.max(a.z,b.z);hi=Math.min(a.z+a.d,b.z+b.d);}
  else if(Math.abs(a.z+a.d-b.z)<eps||Math.abs(b.z+b.d-a.z)<eps){axis='x';line=Math.abs(a.z+a.d-b.z)<eps?b.z:a.z;lo=Math.max(a.x,b.x);hi=Math.min(a.x+a.w,b.x+b.w);}else continue;
  if(hi-lo<2.5)continue;
  const solids=[];for(const wall of m.walls.filter(w=>!w.exterior&&w.axis===axis&&Math.abs((axis==='x'?w.z:w.x)-line)<eps)){const start=axis==='x'?wall.x:wall.z;let at=start;for(const o of [...wall.openings].sort((a,b)=>a.at-b.at)){solids.push([at,start+o.at]);at=start+o.at+o.width;}solids.push([at,start+wall.length]);}
  let end=lo,pass=false;for(const [s,e]of solids.filter(([s,e])=>e>lo&&s<hi).sort((a,b)=>a[0]-b[0])){if(s-end>=2.5)pass=true;end=Math.max(end,e);}if(hi-end>=2.5)pass=true;
  if(pass){links[i].push(j);links[j].push(i);}
 }
 const entry=m.walls[0].openings.find(o=>o.kind==='door'),entryX=entry.at+entry.width/2,start=m.rooms.findIndex(r=>r.z<eps&&entryX>=r.x-eps&&entryX<=r.x+r.w+eps),seen=new Set([start]),stack=[start];assert.ok(start>=0,'Entry meets a room');
 while(stack.length){const at=stack.pop();for(const next of links[at])if(!seen.has(next)){seen.add(next);stack.push(next);}}assert.equal(seen.size,m.rooms.length,`All rooms reachable: ${c.width}x${c.depth} ${c.layout} ${m.rooms.filter((r,i)=>!seen.has(i)).map(r=>r.name)}`);
 scenarios++;return m;
}
for(const [width,depth]of [[8,8],[8,100],[100,8],[8.25,17.5],[12,20],[16,36],[24,24],[25,24],[36,48],[48,36],[51.25,43.5],[100,100]])for(const layout of options.layout)for(const bedrooms of [0,3,6])for(const [wallHeight,pitch]of [[8,4],[10,8]])check({...initial,width,depth,bedrooms,layout,wallHeight,pitch});
for(const layout of options.layout){const m=model({...initial,layout});variants.add(JSON.stringify(m.walls.filter(w=>!w.exterior).map(w=>[w.axis,w.x,w.z,w.length,w.openings.map(o=>[o.kind,o.at,o.width])])))}assert.equal(variants.size,30,'30 geometrically distinct standard wall plans');
const {buildFraming}=await import('../../'+dir+'/framing.mjs');const fixture=buildFraming([{id:'I1',name:'Fixture',x:0,z:0,length:12,axis:'x',exterior:false,openings:[{id:'O1',kind:'window',at:4,width:4,bottom:3,height:4}]}],9,5,12);assert.equal(fixture.studs.length,10,'Independent 12 ft window wall: four common studs, four jamb studs and two cripples');assert.equal(fixture.members.length,17,'Window wall also has two header plies, one sill and four plate cuts across three plate layers');assert.equal(fixture.studs.find(s=>s.role==='Cripple'&&s.bottom===.125).length,2.75);
assert.equal(options.interiorStyle.length,30);assert.equal(options.trimPackage.length,10);assert.equal(options.homeStyle.length,15);assert.equal(options.wallpaper.length,11);
const a=model(initial),large=model({...initial,width:60}),tiny=model({...initial,width:8,depth:8}),waste=model({...initial,waste:20}),tax=model({...initial,tax:7}),price=model({...initial,prices:{siding:8}});
assert.equal(tiny.counts.bedrooms,0);assert.equal(tiny.counts.baths,0);assert.equal(tiny.counts.interiorStuds,0);assert.ok(large.total>a.total);assert.equal(waste.counts.studs,a.counts.studs);assert.ok(waste.counts.drywallSheets>a.counts.drywallSheets);assert.equal(tax.tax,Math.round(a.subtotal*.07*100)/100);assert.ok(price.total>a.total);assert.equal(generate(initial,true).width,initial.width);
assert.ok(validate({...initial,width:7.9}).length);assert.ok(validate({...initial,depth:100.1}).length);for(let i=0;i<50;i++)assert.deepEqual(validate(generate(initial,false)),[]);
const report=await import('../../'+dir+'/report.mjs');for(const c of [initial,{...initial,seed:3000,width:100,depth:100,pitch:8,wallHeight:10},{...initial,seed:8008,width:8,depth:8}])await report.exportPDF(c,'QA / Universal Frames');
for(const file of fs.readdirSync('.').filter(x=>x.endsWith('-design-cost-report.pdf')))fs.renameSync(file,dir+'/'+file);
console.log(JSON.stringify({geometryScenarios:scenarios,distinctStandardLayouts:variants.size,initialStuds:a.counts.studs,interiorStuds:a.counts.interiorStuds,rafters:a.counts.rafters,materialLines:a.items.length,budget:a.total,status:'passed'}));
