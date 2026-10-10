// CPU geometry and ray-picking checks. GPU rendering is deliberately not simulated.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
import * as T from 'three';
const work='work/scene-editor-check';fs.mkdirSync(work,{recursive:true});
const dom=new JSDOM('<div id="scene"></div>',{url:'https://universal-frames.test/',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','Element','HTMLCanvasElement','MouseEvent','ProgressEvent'])globalThis[key]=dom.window[key];
globalThis.self=globalThis;globalThis.devicePixelRatio=1;
globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
globalThis.ResizeObserver=class{observe(){}disconnect(){}};
HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},clearRect(){},fillStyle:'',fillText(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},bezierCurveTo(){},stroke(){},ellipse(){},closePath(){},fill(){},save(){},restore(){},translate(){},rotate(){}});
HTMLCanvasElement.prototype.setPointerCapture=()=>{};HTMLCanvasElement.prototype.releasePointerCapture=()=>{};
globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
const realRequest=globalThis.Request,realFetch=globalThis.fetch;
globalThis.Request=class extends realRequest{constructor(input,init){super(typeof input==='string'&&input.startsWith('/')?'https://universal-frames.test'+input:input,init);}};
globalThis.fetch=async(input,init)=>{const url=typeof input==='string'?input:input.url;if(url.startsWith('blob:'))return realFetch(input,init);const u=new URL(url);assert.equal(u.origin,'https://universal-frames.test');const local=path.join('public',u.pathname);assert.ok(fs.existsSync(local),'Missing local model '+local);return new Response(fs.readFileSync(local));};
const adapter=`
class GeometryRenderer{domElement=document.createElement('canvas');shadowMap={};renderLists={dispose(){}};capabilities={getMaxAnisotropy:()=>8};constructor(options){globalThis.rendererCreations=(globalThis.rendererCreations||0)+1;this.options=options;this.domElement.getBoundingClientRect=()=>({left:0,top:0,width:800,height:600});}getContext(){return {getExtension:()=>null};}setPixelRatio(value){this.pixelRatio=value;}setClearColor(){}setSize(){}render(scene,camera){globalThis.rendered={scene,camera,renderer:this};}dispose(){}forceContextLoss(){}}
class GeometryEnvironment{fromScene(){return {texture:new T.Texture(),dispose(){}};}dispose(){}}
class GeometryHDR{load(){}}
class GeometryTextureLoader{load(url,onLoad){const texture=new T.Texture();texture.userData.file=url.replace(/^\\/(?:mobile\\/)?materials\\//,'');texture.userData.url=url;queueMicrotask(()=>onLoad?.(texture));return texture;}}
`;
for(const file of ['editor','furniture','trim','architecture','graphics','garage','orientation','navigation','walk-controls','surface-patterns','staging-items','camera-fit','porch','additions','surface-patterns','staging-items','camera-fit']){let code=fs.readFileSync('web/'+file+'.ts','utf8').replace("from './graphics'","from './graphics.mjs'").replace("from './architecture'","from './architecture.mjs'").replace("from './trim'","from './trim.mjs'").replace("from './porch'","from './porch.mjs'");code=code.replace("from './furniture'","from './furniture.mjs'").replace("import objects from '../rust-app/data/objects.json';",'const objects='+fs.readFileSync('rust-app/data/objects.json','utf8')+';').replace("import tileCatalog from '../rust-app/data/tiles.json';",'const tileCatalog='+fs.readFileSync('rust-app/data/tiles.json','utf8')+';');if(file==='surface-patterns')code=adapter+code.replace('new T.TextureLoader()', 'new GeometryTextureLoader()');if(file==='graphics')code=adapter+code.replace('new T.WebGLRenderer(', 'new GeometryRenderer(');fs.writeFileSync(work+'/'+file+'.mjs',ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);}
let source=fs.readFileSync('web/scene.ts','utf8').replace("import vinylCatalog from '../rust-app/data/vinyl.json';",'const vinylCatalog='+fs.readFileSync('rust-app/data/vinyl.json','utf8')+';').replace("from './walk-controls'","from './walk-controls.mjs'").replace("import catalog from '../rust-app/data/catalog.json';",'const catalog='+fs.readFileSync('rust-app/data/catalog.json','utf8')+';').replace("from './additions'","from './additions.mjs'").replace("from './architecture'","from './architecture.mjs'").replace("from './porch'","from './porch.mjs'").replace("from './editor'","from './editor.mjs'").replace("from './furniture'","from './furniture.mjs'").replace("from './trim'","from './trim.mjs'").replace("from './graphics'","from './graphics.mjs'").replace("from './garage'","from './garage.mjs'").replace("from './orientation'","from './orientation.mjs'").replace("from './navigation'","from './navigation.mjs'").replace("from './surface-patterns'","from './surface-patterns.mjs'").replace("from './staging-items'","from './staging-items.mjs'").replace("from './camera-fit'","from './camera-fit.mjs'").replace('new T.PMREMGenerator(', 'new GeometryEnvironment(').replace('new HDRLoader()', 'new GeometryHDR()').replace('new T.TextureLoader()', 'new GeometryTextureLoader()');
fs.writeFileSync(work+'/scene.mjs',ts.transpileModule(adapter+source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
const app=await import('../../public/pkg/universal_frames.js');app.initSync({module:fs.readFileSync('public/pkg/universal_frames_bg.wasm')});
const {renderHouse}=await import('../../'+work+'/scene.mjs');
const el=document.getElementById('scene');Object.defineProperties(el,{clientWidth:{value:800},clientHeight:{value:600}});el.getBoundingClientRect=()=>({left:0,top:0,width:800,height:600});
let picked,resized,drawn=[],assetErrors=[];globalThis.ufBridge={previewPlacement(t){return {...t,placement:{...model.furniture[0],x:t.x,z:t.z},placementError:null};},drawWall(change){drawn.push(change);},resizeWall(change){resized=change;},pickScene(target){picked=target;},assetStatus(message){assetErrors.push(message);}};
const config=JSON.parse(app.defaults());Object.assign(config,{stories:1,width:48,depth:36,pitch:8,activeFloor:0});config.wallpaper='Midnight damask';config.bedroomWallpaper='Botanical silk';config.trimPackage='Victorian ornate';
const model=JSON.parse(app.calculate(JSON.stringify(config)));
const cleanup=renderHouse(el,{config,model,view:'dollhouse'});
// Allow local GLB parsing and embedded-image bindings to finish.
for(let i=0;i<100;i++){const ids=new Set();rendered.scene.traverse(o=>{if(o.type==='Group'&&o.userData.editTarget?.kind==='furniture')ids.add(o.userData.editTarget.id);});const pending=[];rendered.scene.traverse(o=>{if(o.userData.assetState==='loading')pending.push(o);});if(model.furniture.every(f=>ids.has(f.id))&&!pending.length)break;await new Promise(r=>setTimeout(r,20));}
assert.deepEqual(assetErrors,[]);
const disposableMaps=new Set();rendered.scene.traverse(o=>{if(o instanceof T.Mesh)for(const mat of Array.isArray(o.material)?o.material:[o.material])for(const value of Object.values(mat))if(value instanceof T.Texture)disposableMaps.add(value);});const disposedMaps=new Set();for(const map of disposableMaps)map.addEventListener('dispose',()=>disposedMaps.add(map));
let groups=new Map(),paperWalls=0,trimMaterials=new Set();
rendered.scene.traverse(o=>{if(o.type==='Group'&&o.userData.editTarget?.kind==='furniture'){const list=groups.get(o.userData.editTarget.id)||[];list.push(o);groups.set(o.userData.editTarget.id,list);}if(o instanceof T.Mesh){const materials=Array.isArray(o.material)?o.material:[o.material];if(materials.some(mat=>mat.map?.userData.file?.startsWith('wallpaper/')))paperWalls++;for(const mat of materials)if(mat.userData.trimFinish)trimMaterials.add(mat.userData.trimFinish);}});
assert.ok(paperWalls>model.walls.length,'Wallpaper is present on all partitions, not one accent wall');
assert.ok(trimMaterials.has('Sealed dark walnut tone'),'Victorian trim uses its distinct photographic walnut finish');
let bedroomFaces=0,generalFaces=0,carved=0,rosettes=0;
rendered.scene.traverse(o=>{if(o.userData.wallFace){const f=o.userData.wallFace;assert.equal(f.wallpaper,f.group==='bedroom'?'Botanical silk':'Midnight damask');const mat=Array.isArray(o.material)?o.material[0]:o.material;assert.ok(mat.map.userData.file.endsWith(f.group==='bedroom'?'02-botanical-silk.webp':'01-midnight-damask.webp'));if(f.group==='bedroom')bedroomFaces++;else generalFaces++;}if(o.userData.profileId){carved++;assert.ok(o.geometry.attributes.position.count>=20);assert.ok(o.material.normalMap&&o.material.roughnessMap);}if(o.name==='Carved rosette band')rosettes++;});
assert.ok(bedroomFaces>0&&generalFaces>0&&carved>0,'Separate room-facing papers and actual carved geometry are present');
let cornerMeshes=0;rendered.scene.traverse(o=>{assert.ok(!o.userData.trimPanel&&!o.name.startsWith('Decorative '),'No wall panel squares are rendered');if(o.userData.trimCorner)cornerMeshes++;if(!o.userData.trimExterior&&o.userData.editTarget?.kind==='opening'&&o.userData.trimProfile!==undefined)assert.equal(model.openings.find(p=>p.id===o.userData.editTarget.id).kind!=='window',true,'Decorative casing belongs to entrances');});assert.equal(cornerMeshes,model.trimCorners.length,'Every scheduled corner leg is rendered');


for(const f of model.furniture){assert.ok(groups.has(f.id),'Every visible furniture item has a selectable group: '+f.id);const bounds=new T.Box3();for(const g of groups.get(f.id))bounds.union(new T.Box3().setFromObject(g));const size=bounds.getSize(new T.Vector3());assert.ok(size.x<=f.w+.45&&size.z<=f.d+.45,'Furniture fits its modeled footprint: '+f.id);if(['sofa','bed','armchair','coffee'].includes(f.kind)){let vertices=0,pbr=0;for(const g of groups.get(f.id))g.traverse(o=>{if(o instanceof T.Mesh){vertices+=o.geometry.attributes.position.count;const mats=Array.isArray(o.material)?o.material:[o.material];pbr+=mats.filter(mat=>mat.map&&mat.normalMap&&mat.roughnessMap).length;}});assert.ok(vertices>500&&pbr>0,'Detailed real PBR furniture: '+f.kind);}}
const canvas=el.querySelector('canvas');
function hit(point,from){rendered.camera.position.copy(from);rendered.camera.lookAt(point);rendered.camera.updateMatrixWorld();picked=null;for(const type of ['pointerdown','pointerup'])el.querySelector('canvas').dispatchEvent(new dom.window.MouseEvent(type,{clientX:400,clientY:300,button:0,bubbles:true}));return picked;}
const front=model.walls.find(w=>w.id==='E1');const door=front.openings.find(o=>o.kind==='door');const doorCenter=new T.Vector3(front.x+door.at+door.width/2-model.w/2,2,front.z-model.d/2);const pickedDoor=hit(doorCenter,doorCenter.clone().add(new T.Vector3(0,0,-15)));assert.equal(pickedDoor.kind,'opening');assert.equal(pickedDoor.id,door.id);
const wallPoint=new T.Vector3(1-model.w/2,2,-model.d/2);assert.equal(hit(wallPoint,wallPoint.clone().add(new T.Vector3(0,0,-15))).kind,'wall');
cleanup.select({kind:'wall',wallId:'E1',sectionAt:.4,sectionWidth:4});assert.ok(rendered.scene.children.some(o=>o.type==='Group'&&o.children.some(c=>c.type==='Box3Helper')));
let wallHandles=[];rendered.scene.traverse(o=>{if(o.userData.wallHandle)wallHandles.push(o);});assert.equal(wallHandles.length,2);
const endHandle=wallHandles.find(o=>o.userData.wallHandle.edge==='end');const endPoint=endHandle.position.clone();rendered.camera.position.copy(endPoint.clone().add(new T.Vector3(0,12,-22)));rendered.camera.lookAt(endPoint);rendered.camera.updateMatrixWorld();
function projected(point){const p=point.clone().project(rendered.camera);return {clientX:(p.x+1)*400,clientY:(1-p.y)*300};}
const cameraBefore=rendered.camera.position.clone();canvas.dispatchEvent(new dom.window.MouseEvent('pointerdown',{...projected(endPoint),button:0,bubbles:true}));const shortPoint=endPoint.clone().add(new T.Vector3(-4,0,0));for(const type of ['pointermove','pointerup'])canvas.dispatchEvent(new dom.window.MouseEvent(type,{...projected(shortPoint),button:0,bubbles:true}));assert.equal(resized.wallId,'E1');assert.equal(resized.edge,'end');assert.equal(resized.coordinate,44);assert.ok(rendered.camera.position.distanceTo(cameraBefore)<.001,'Wall dragging does not orbit the camera');
cleanup.setMode({moving:model.furniture[0].id,handles:false});const floorTarget=new T.Vector3(model.furniture[0].x-model.w/2,.22,model.furniture[0].z-model.d/2);const floorPick=hit(floorTarget,floorTarget.clone().add(new T.Vector3(0,12,-2)));assert.equal(floorPick.kind,'floor','Move mode projects to floor even when furniture obscures it');assert.ok(Math.abs(floorPick.x-model.furniture[0].x)<.01);assert.ok(Math.abs(floorPick.z-model.furniture[0].z)<.01);
const pose=cleanup.getPose();cleanup.select(null);cleanup();assert.deepEqual(disposedMaps,disposableMaps,'Every used texture, including imported furniture textures, is released from the renderer');const restored=renderHouse(el,{config,model,view:'dollhouse',cameraPose:pose});assert.deepEqual(rendered.camera.position.toArray().map(v=>Math.round(v*1000)),pose.position.map(v=>Math.round(v*1000)),'Edits preserve camera position');restored();
const frameCleanup=renderHouse(el,{config,model,view:'framing',frameRoof:false});
let frameCount=0;rendered.scene.traverse(o=>{if(o instanceof T.InstancedMesh){frameCount+=o.count;assert.equal(o.count,o.userData.frameMembers.length);assert.equal(o.material.opacity,1,'Single-storey framing remains fully visible');assert.ok(o.boundingBox&&!o.boundingBox.isEmpty());}});assert.equal(frameCount,model.frameMembers.length,'Every enumerated wall framing member is rendered');
const framedDoor=hit(doorCenter,doorCenter.clone().add(new T.Vector3(0,0,-15)));assert.equal(framedDoor.kind,'opening');assert.equal(framedDoor.id,door.id);
frameCleanup();
const interiorWall=model.walls.find(w=>!w.exterior);
const exteriorCleanup=renderHouse(el,{config,model,view:'exterior',selection:{kind:'wall',wallId:interiorWall.id,at:2}});
assert.ok(!rendered.scene.children.some(o=>o.name==='3D edit highlight'),'Exterior rejects a retained interior selection');
exteriorCleanup.select({kind:'furniture',id:model.furniture[0].id});assert.ok(!rendered.scene.children.some(o=>o.name==='3D edit highlight'));
exteriorCleanup.select({kind:'floor',x:4,z:4});assert.ok(!rendered.scene.children.some(o=>o.name==='3D edit highlight'));
const obstructing=new T.Mesh(new T.BoxGeometry(2,3,1),new T.MeshBasicMaterial());obstructing.position.copy(doorCenter.clone().add(new T.Vector3(0,0,-4)));obstructing.userData.editTarget={kind:'wall',wallId:interiorWall.id};rendered.scene.add(obstructing);
const exteriorDoor=hit(doorCenter,doorCenter.clone().add(new T.Vector3(0,0,-15)));assert.equal(exteriorDoor.wallId,front.id,'Ray filter skips interior targets in exterior view');
exteriorCleanup.select(exteriorDoor);assert.ok(rendered.scene.children.some(o=>o.name==='3D edit highlight'),'Exterior doors remain selectable');
exteriorCleanup.setMode({moving:model.furniture[0].id,handles:false});const blockedMove=hit(doorCenter,doorCenter.clone().add(new T.Vector3(0,0,-15)));assert.notEqual(blockedMove?.kind,'floor','Exterior cannot retain interior furniture move mode');exteriorCleanup();
const trimModule=await import('../../'+work+'/trim.mjs'),profiles=new Set(),finishNames=new Set();
for(const pack of JSON.parse(fs.readFileSync('rust-app/data/catalog.json','utf8')).trimPackages){
 const testConfig={...config,trimPackage:pack.name,trimSize:'Normal'},normalModel=JSON.parse(app.calculate(JSON.stringify(testConfig))),oversizedModel=JSON.parse(app.calculate(JSON.stringify({...testConfig,trimSize:'Oversized'})));
 const points=trimModule.profileShape(1,1,pack.profile).getPoints(24);profiles.add(JSON.stringify(points.map(p=>[Number(p.x.toFixed(5)),Number(p.y.toFixed(5))])));
 const check=renderHouse(el,{config:testConfig,model:normalModel,view:'dollhouse'});let sample;rendered.scene.traverse(o=>{if(o.userData.trimPiece?.role==='base'&&!sample)sample=o;});
 assert.ok(sample);finishNames.add(sample.material.userData.trimFinish);assert.equal(sample.material.userData.textureCell,pack.profile);assert.equal(sample.material.map.userData.file,'oak-diff.jpg');
 const trimHeight=new T.Box3().setFromObject(sample).getSize(new T.Vector3()).y;check();
 const big=renderHouse(el,{config:{...testConfig,trimSize:'Oversized'},model:oversizedModel,view:'dollhouse'});let oversizedSample;rendered.scene.traverse(o=>{if(o.userData.trimPiece?.role==='base'&&!oversizedSample)oversizedSample=o;});const bigHeight=new T.Box3().setFromObject(oversizedSample).getSize(new T.Vector3()).y;assert.ok(bigHeight>trimHeight*1.4,'Oversized has visibly larger geometry: '+pack.name);big();
}
assert.equal(profiles.size,10,'All ten profiles have different geometry');assert.equal(finishNames.size,10,'All ten finishes have separate sealed-wood tones');
// Both storeys are stacked in the exterior, with one roof and a closed rim band.
const twoConfig={...config,stories:2,activeFloor:0},twoModel=JSON.parse(app.calculate(JSON.stringify(twoConfig)));
const two=renderHouse(el,{config:twoConfig,model:twoModel,view:'exterior'});rendered.scene.updateMatrixWorld(true);
const levels=rendered.scene.children.filter(o=>o.name.startsWith('House level '));assert.equal(levels.length,2);assert.equal(levels[1].position.y,twoModel.floorHeight);
let roofCount=0;rendered.scene.traverse(o=>{if(o.name.startsWith('Roof plane ')){roofCount++;const bounds=new T.Box3().setFromObject(o);assert.ok(bounds.min.y>config.wallHeight*1.8);}});assert.equal(roofCount,twoModel.roof.facets.length);two();
for(const floor of [0,1]){
 const c={...twoConfig,activeFloor:floor},m=JSON.parse(app.calculate(JSON.stringify(c))),floorHeight=m.floorHeight,base=floor*floorHeight;
 const check=renderHouse(el,{config:c,model:m,view:'dollhouse'});let treads=0;rendered.scene.traverse(o=>{if(o.name.includes('stair tread'))treads++;});assert.equal(treads,m.stair.treads);assert.equal(rendered.scene.children.filter(o=>o.name.startsWith('House level ')).length,1);check();
 const frame=renderHouse(el,{config:c,model:m,view:'framing',frameRoof:true});rendered.scene.updateMatrixWorld(true);
 const frameLevels=rendered.scene.children.filter(o=>o.name.startsWith('House level '));assert.deepEqual(frameLevels.map(o=>o.position.y),[0,floorHeight]);
 let pieces=0,groundCount=0,rafters=0,floorMembers=0;const activeIds=new Set(),floorRoles=new Set(m.floorFrameMembers.map(p=>p.role));
 rendered.scene.traverse(o=>{
  if(o instanceof T.InstancedMesh){pieces+=o.count;const level=Number(o.parent.name.split(' ').at(-1));assert.equal(o.material.opacity,level===floor?1:.22,'Only the selected story is emphasized');const bounds=new T.Box3().setFromObject(o);assert.ok(bounds.min.y>=level*floorHeight-.001,'Every story framing group has the correct elevation');if(level===floor)for(const p of o.userData.frameMembers)activeIds.add(p.id);}
  if(o instanceof T.Mesh&&o.material.map?.userData.file==='grass-diff.jpg')groundCount++;
  if(o.name.startsWith('I-joist web ')){rafters++;assert.ok(new T.Box3().setFromObject(o).min.y>floorHeight,'Roof framing belongs above the upper story');}
  if(o instanceof T.Mesh&&floorRoles.has(o.name)){const p=m.floorFrameMembers[floorMembers++];assert.equal(o.name,p.role);assert.equal(o.parent.name,'House level 0','Interstory framing is positioned once from its world schedule');assert.ok(Math.abs(o.getWorldPosition(new T.Vector3()).y-(p.y1+p.y2)/2)<.001,'Floor member elevation matches the Rust schedule');const bounds=new T.Box3().setFromObject(o);assert.ok(bounds.min.y>=m.h-(p.role==='Floor support beam'?1.25:0)-.001&&bounds.max.y<=floorHeight+.001,'Joists and dropped support beams fit below the upper walls');}
 });
 assert.equal(pieces,m.levels.reduce((n,l)=>n+l.frameMembers.length,0),'All wall framing from both stories is rendered');assert.deepEqual(activeIds,new Set(m.frameMembers.map(p=>p.id)),'Every selected-floor stud, header, sill and cripple is present');assert.equal(groundCount,1,'No upper-story terrain obscures the framing');assert.equal(rafters,m.rafters.length,'Roof rafters are rendered once');assert.equal(floorMembers,m.floorFrameMembers.length,'Every interstory joist, rim, beam and stair header is rendered');
 const wall=m.walls.find(w=>w.exterior&&w.axis==='x'&&w.z===0),opening=wall.openings[0];assert.ok(opening);
 const center=new T.Vector3(wall.x+opening.at+opening.width/2-m.w/2,base+opening.bottom+opening.height/2,wall.z-m.d/2);
 const obstruction=new T.Mesh(new T.BoxGeometry(.2,.2,.2),new T.MeshBasicMaterial());obstruction.position.copy(center.clone().add(new T.Vector3(0,0,-2)));obstruction.userData.editTarget={kind:'wall',wallId:m.levels[1-floor].walls[0].id};rendered.scene.add(obstruction);
 const selected=hit(center,center.clone().add(new T.Vector3(0,0,-15)));assert.equal(selected?.wallId,wall.id,'Inactive-story targets cannot steal the selected-floor pick');assert.equal(selected.kind,'opening');assert.equal(selected.id,opening.id);
 frame.select(selected);const highlight=rendered.scene.children.find(o=>o.name==='3D edit highlight'),outline=highlight.children.find(o=>o instanceof T.Box3Helper);assert.ok(Math.abs(outline.box.min.y-(base+opening.bottom))<.001,'Opening highlight follows the selected storey');
 frame.select({kind:'wall',wallId:wall.id,sectionAt:0,sectionWidth:4});const handles=[];rendered.scene.traverse(o=>{if(o.userData.wallHandle)handles.push(o);});assert.equal(handles.length,2);assert.ok(handles.every(o=>o.position.y>base),'Wall handles are elevated with the active framing story');frame();
 const focused=renderHouse(el,{config:c,model:m,view:'framing',frameRoof:false,frameOpening:opening.id});assert.ok(rendered.camera.position.y>base,'Opening inspector camera uses the selected storey');let hiddenRoof=0;rendered.scene.traverse(o=>{if(o.name.startsWith('I-joist web '))hiddenRoof++;});assert.equal(hiddenRoof,0);focused();
}
console.log('PASS: stacked exterior and framing levels, correct upper-wall/highlight elevations, selected-floor picking, all interstory framing, one roof, isolated interiors and both stair flights.');
console.log('PASS: actual Three.js geometry — exterior-only picking, distinct trim finishes/profiles, larger trim geometry, real furniture, wallpapers and all framing instances. GPU visual review remains separate.');
assert.equal(globalThis.rendererCreations,1,'All desktop view changes share one WebGL renderer');
const originalNavigator=globalThis.navigator;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 Version/18.3 Mobile/15E148 Safari/604.1',maxTouchPoints:5,platform:'iPhone'}});
const mobileEl=document.createElement('div');document.body.appendChild(mobileEl);Object.defineProperties(mobileEl,{clientWidth:{value:390},clientHeight:{value:400}});mobileEl.getBoundingClientRect=()=>({left:0,top:0,width:390,height:400});globalThis.devicePixelRatio=3;
let nextFrame;globalThis.requestAnimationFrame=callback=>{nextFrame=callback;return 1;};
for(const view of ['exterior','dollhouse','walk','framing','dollhouse','walk']){
 const check=renderHouse(mobileEl,{config,model,view});
 for(let i=0;i<100;i++){const ids=new Set();rendered.scene.traverse(o=>{if(o.userData.editTarget?.kind==='furniture')ids.add(o.userData.editTarget.id);});if(view==='framing'||model.furniture.every(f=>ids.has(f.id)))break;await new Promise(r=>setTimeout(r,20));}
 assert.equal(rendered.renderer.options.antialias,false);assert.equal(rendered.renderer.pixelRatio,1.25);assert.equal(globalThis.rendererCreations,2,'iPhone mode reuses one context through every switch');
 const urls=new Set();rendered.scene.traverse(o=>{if(o instanceof T.Mesh)for(const mat of Array.isArray(o.material)?o.material:[o.material])for(const map of Object.values(mat))if(map instanceof T.Texture&&map.userData.url)urls.add(map.userData.url);});assert.ok([...urls].every(url=>url.startsWith('/mobile/')),'Mobile wall, floor and grass maps use bounded assets');
 if(view==='walk'){
  const walkCanvas=mobileEl.querySelector('canvas'),before=rendered.camera.position.clone(),touch=(name,points)=>{const e=new dom.window.Event(name,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:points.map(([clientX,clientY])=>({clientX,clientY}))});walkCanvas.dispatchEvent(e);return e;};
  assert.equal(touch('touchstart',[[100,100],[140,100]]).defaultPrevented,true);assert.equal(touch('touchmove',[[100,65],[140,65]]).defaultPrevented,true);await new Promise(r=>setTimeout(r,30));nextFrame();assert.ok(rendered.camera.position.distanceTo(before)>.01,'Two-finger dragging moves the walkthrough camera without viewer controls');touch('touchend',[]);const stopped=rendered.camera.position.clone();await new Promise(r=>setTimeout(r,30));nextFrame();assert.ok(rendered.camera.position.distanceTo(stopped)<.001,'Releasing both fingers stops movement');
 }
 const liveScene=rendered.scene;check();check();await Promise.resolve();assert.equal(liveScene.children.length,0,'Cleanup is complete and idempotent');
}
Object.defineProperty(globalThis,'navigator',{configurable:true,value:originalNavigator});assert.deepEqual(assetErrors,[]);
console.log('PASS: repeated iPhone-profile Interior/Walkthrough switches, one context per studio, bounded mobile assets and complete resource cleanup. No actual WebKit/GPU execution is simulated.');

// Actual garage framing/roof/overhead door geometry shares the Rust schedule.
for(const kind of ['Attached','Detached']){
 for(const stories of [1,2]){
  const c={...config,garage:kind,stories,activeFloor:stories===2?1:0},m=JSON.parse(app.calculate(JSON.stringify(c)));
  const exterior=renderHouse(el,{config:c,model:m,view:'exterior'});rendered.scene.updateMatrixWorld(true);const group=rendered.scene.getObjectByName('Garage '+kind);assert.ok(group);const leaf=group.getObjectByName('Garage 16 × 7 sectional door');assert.ok(leaf);const size=new T.Box3().setFromObject(leaf).getSize(new T.Vector3());assert.ok(Math.abs(size.x-16)<.001&&Math.abs(size.y-7)<.001);const roofs=[];group.traverse(o=>{if(o.name.startsWith('Roof plane '))roofs.push(o);});assert.equal(roofs.length,2);for(const o of roofs)assert.ok(new T.Box3().setFromObject(o).max.y<=m.garage.h+m.garage.roof.rise+.1,'Garage roof is not shifted to upper floor');exterior();
  for(const roof of [false,true]){const cleanup=renderHouse(el,{config:c,model:m,view:'framing',frameRoof:roof});let total=0,garages=0,garageRoof=0;rendered.scene.traverse(o=>{if(o instanceof T.InstancedMesh){total+=o.count;if(o.userData.garage)garages+=o.count;}if(o.name==='Garage I-joist rafter')garageRoof++;});assert.equal(total,m.allFrameMembers.length);assert.equal(garages,m.garage.frameMembers.length);assert.equal(garageRoof,roof?m.garage.roof.rafters.length:0);cleanup();}
  const floor=renderHouse(el,{config:c,model:m,view:'dollhouse'});assert.equal(!!rendered.scene.getObjectByName('Garage '+kind),stories===1,'Upper floor does not duplicate the garage');floor();
 }
 const c={...config,garage:kind,stories:1,activeFloor:0},m=JSON.parse(app.calculate(JSON.stringify(c)));const walk=renderHouse(el,{config:c,model:m,view:'walk',jump:'G-GARAGE'});assert.ok(Math.abs(rendered.camera.position.x-(m.garage.x+24*.48-m.w/2))<.01);walk();
}
console.log('PASS: both garage options, exact 16×7 door geometry, one ground-level gable roof, all framing members, roof toggle, correct two-story visibility and garage walkthrough camera.');

// Wall tool uses real projected floor coordinates, on either story, with mouse or touch.
for(const floorIndex of [0,1]){
 const c={...JSON.parse(app.defaults()),designMode:'Blank slate',width:32,depth:32,stories:2,activeFloor:floorIndex,wallpaper:'Sky blue toile',bedroomWallpaper:'Ivory botanical'};
 const m=JSON.parse(app.calculate(JSON.stringify(c)));const editing=renderHouse(el,{config:c,model:m,view:floorIndex?'framing':'dollhouse'});
 editing.setMode({moving:'',handles:false,drawWalls:true,wallEdge:'end'});
 assert.ok(rendered.scene.children.some(o=>o.name==='Two-foot wall drawing grid'));assert.equal(el.querySelector('.wall-draft-measure').hidden,true);
 const y=floorIndex?(m.h+1.25)+.23:.23;rendered.camera.position.set(0,y+38,-24);rendered.camera.lookAt(0,y,0);rendered.camera.updateMatrixWorld();
 const drawCanvas=el.querySelector('canvas'),projectedFloor=(x,z)=>projected(new T.Vector3(x-16,y,z-16));
 function dragEvent(type,x,z,pointerType='mouse',pointerId=71){const e=new dom.window.MouseEvent(type,{...projectedFloor(x,z),button:0,bubbles:true,cancelable:true});Object.defineProperties(e,{pointerType:{value:pointerType},pointerId:{value:pointerId}});drawCanvas.dispatchEvent(e);return e;}
 const prior=drawn.length;const begin=dragEvent('pointerdown',8,12);assert.equal(begin.defaultPrevented,true);dragEvent('pointermove',24,12);assert.match(el.querySelector('.wall-draft-measure').textContent,/16 ft.*Left/);dragEvent('pointerup',24,12);assert.equal(drawn.length,prior+1);assert.deepEqual(drawn.at(-1),{x1:8,z1:12,x2:24,z2:12});
 // Two clicks work on touch as well; keyboard adjusts the pending wall by one grid cell.
 dragEvent('pointerdown',4,4,'touch',72);dragEvent('pointerup',4,4,'touch',72);assert.ok(rendered.scene.children.some(o=>o.name==='Wall drawing preview'));
 const arrow=new dom.window.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true});window.dispatchEvent(arrow);assert.equal(arrow.defaultPrevented,true);assert.match(el.querySelector('.wall-draft-measure').textContent,/2 ft.*Rear/);
 window.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.deepEqual(drawn.at(-1),{x1:4,z1:4,x2:4,z2:6});
 dragEvent('pointerdown',8,24,'touch',73);dragEvent('pointerup',8,24,'touch',73);dragEvent('pointermove',20,24,'touch',74);dragEvent('pointerdown',20,24,'touch',74);dragEvent('pointerup',20,24,'touch',74);assert.deepEqual(drawn.at(-1),{x1:8,z1:24,x2:20,z2:24});
 const beforeCancel=drawn.length;dragEvent('pointerdown',16,8,'touch',75);dragEvent('pointermove',28,8,'touch',75);dragEvent('pointercancel',28,8,'touch',75);assert.equal(drawn.length,beforeCancel);assert.equal(el.querySelector('.wall-draft-measure').hidden,true);
 editing.setMode({moving:'',handles:true,drawWalls:false});assert.ok(!rendered.scene.children.some(o=>o.name==='Two-foot wall drawing grid'));
 let brightFaces=0;rendered.scene.traverse(o=>{if(o.userData.wallFace?.wallpaper==='Sky blue toile'){brightFaces++;assert.equal(o.material.color.getHexString(),'ffffff');assert.ok(o.material.map.userData.file.endsWith('13-sky-blue-toile.webp'));}});if(floorIndex===0)assert.ok(brightFaces>0);else assert.equal(brightFaces,0);
 editing();assert.equal(el.querySelector('.wall-draft-measure'),null);
}
console.log('PASS: mouse drag and touch two-click wall drawing on both floors, 2-foot grid/length preview, keyboard endpoint placement, Enter confirmation, pointer cancellation, cleanup and bright wallpaper material mapping.');

const sections=JSON.parse(fs.readFileSync('rust-app/data/millwork.json')).profiles;const sourceShapes=new Set();
for(const section of sections){const width=section.installedHeightInches/12,depth=section.installedProjectionInches/12;const scene=new T.Scene();const mesh=trimModule.addTrimSegment(scene,new T.Vector3(0,0,0),new T.Vector3(0,0,8),width,depth,new T.Vector3(1,0,0),section,new T.MeshStandardMaterial(),undefined);mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox;assert.ok(Math.abs(b.max.x-depth)<.00001);assert.ok(Math.abs(b.max.y-width)<.00001);assert.ok(Math.abs(b.max.z-8)<.00001);assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));assert.equal(mesh.userData.profileId,section.id);sourceShapes.add(JSON.stringify([...mesh.geometry.attributes.position.array]));mesh.geometry.dispose();mesh.material.dispose();}
assert.equal(sourceShapes.size,100);
const northModule=await import('../../'+work+'/orientation.mjs');const compass=document.createElement('div');compass.className='camera-heading';el.appendChild(compass);const c=new T.PerspectiveCamera();c.position.set(0,1,-10);c.lookAt(0,1,0);c.updateMatrixWorld();const heading=northModule.watchHeading(c,180,el);heading.update();assert.equal(compass.textContent,'Looking N · 0°');c.lookAt(10,1,-10);c.updateMatrixWorld();heading.update();assert.equal(compass.textContent,'Looking E · 90°');heading.dispose();compass.remove();
const compassScene=new T.Scene(),maps=[];const arrow=northModule.addNorthArrow(compassScene,model,90,maps);assert.equal(arrow.name,'North arrow');assert.ok(Math.abs(arrow.rotation.y-Math.PI/2)<.000001);assert.ok(!arrow.userData.editTarget);const graphics=await import('../../'+work+'/graphics.mjs');graphics.clearSceneResources(compassScene,maps);
console.log('PASS: 100 distinct finite source extrusions at catalog installed dimensions; north arrow and camera bearings.');

// Dedicated wall-move handle and direct placement interaction.
{
 const c={...config,designMode:'Blank slate',stories:1,activeFloor:0,width:32,depth:32,addedWalls:[{id:'I-drag',name:'Drag regression',axis:'x',x:8,z:12,length:12,exterior:false,openings:[]}],wallAdjustments:{},openingOverrides:{},wallRemovals:[],placedFurniture:[],deletedFurniture:[]};const m=JSON.parse(app.calculate(JSON.stringify(c)));const viewer=renderHouse(el,{config:c,model:m,view:'dollhouse'});viewer.setMode({moving:'',handles:true,placing:false});viewer.select({kind:'wall',wallId:'I-drag',sectionAt:0,sectionWidth:12});const handles=[];rendered.scene.traverse(o=>{if(o.userData.wallHandle?.wallId==='I-drag')handles.push(o);});assert.equal(handles.length,3);const middle=handles.find(o=>o.userData.wallHandle.edge==='move'),origin=middle.position.clone();rendered.camera.position.copy(origin.clone().add(new T.Vector3(0,20,-25)));rendered.camera.lookAt(origin);rendered.camera.updateMatrixWorld();const canvas=el.querySelector('canvas'),destination=origin.clone().add(new T.Vector3(4,0,2));canvas.dispatchEvent(new dom.window.MouseEvent('pointerdown',{...projected(origin),button:0,bubbles:true,cancelable:true}));canvas.dispatchEvent(new dom.window.MouseEvent('pointermove',{...projected(destination),button:0,bubbles:true,cancelable:true}));canvas.dispatchEvent(new dom.window.MouseEvent('pointerup',{...projected(destination),button:0,bubbles:true,cancelable:true}));assert.deepEqual(resized,{wallId:'I-drag',operation:'move',x:12,z:14});const click=new dom.window.MouseEvent('click',{bubbles:true,cancelable:true,detail:1});canvas.dispatchEvent(click);assert.equal(click.defaultPrevented,true,'Dragging consumes the following compatibility click');
 globalThis.ufBridge.previewPlacement=t=>({...t,x:3,z:3,snapped:true,placementError:null,placement:{id:'preview',kind:'bench',localWidth:4,localDepth:1.6,w:5.6/Math.sqrt(2),d:5.6/Math.sqrt(2),rotation:Math.PI/4,x:3,z:3}});viewer.setMode({moving:'',handles:false,placing:true,insertKind:'bench',insertRotation:Math.PI/4});const point=new T.Vector3(-13,.23,-13);rendered.camera.position.set(0,34,-24);rendered.camera.lookAt(point);rendered.camera.updateMatrixWorld();picked=null;canvas.dispatchEvent(new dom.window.MouseEvent('pointerdown',{...projected(point),button:0,bubbles:true,cancelable:true}));let footprint;rendered.scene.traverse(o=>{if(o.parent?.name==='3D edit highlight'&&o instanceof T.Mesh)footprint=o;});assert.equal(footprint.geometry.parameters.width,4);assert.ok(Math.abs(footprint.rotation.y+Math.PI/4)<1e-8);assert.equal(footprint.material.color.getHexString(),'86d8ad');canvas.dispatchEvent(new dom.window.MouseEvent('pointerup',{...projected(point),button:0,bubbles:true,cancelable:true}));assert.equal(picked.commit,true);assert.equal(picked.x,3);assert.equal(picked.z,3);const arrow=new dom.window.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true});window.dispatchEvent(arrow);assert.equal(arrow.defaultPrevented,true);viewer();
 const decorations=[['floorlamp',1.6,1.6],['side-table',2,2],['bench',4,1.6],['bookcase',3,1.1],['entry-console',4,1.2],['floor-vase',1,1],['floor-mirror',2.6,.7],['tall-plant',2,2]];c.addedWalls=[];c.placedFurniture=decorations.map(([kind,w,d],i)=>({id:'decor-'+i,kind,roomId:'custom',x:5+(i%3)*10,z:5+Math.floor(i/3)*10,w,d,localWidth:w,localDepth:d,rotation:0}));const staged=JSON.parse(app.calculate(JSON.stringify(c)));assert.equal(staged.furniture.length,8);const decorView=renderHouse(el,{config:c,model:staged,view:'dollhouse'});for(const f of staged.furniture){let group;rendered.scene.traverse(o=>{if(o.type==='Group'&&o.userData.editTarget?.id===f.id)group=o;});assert.ok(group,'Decoration has real selectable 3D geometry: '+f.kind);const size=new T.Box3().setFromObject(group).getSize(new T.Vector3());assert.ok(size.x<=f.w+.01&&size.z<=f.d+.01);assert.ok(size.y>.8);assert.equal(staged.items.find(i=>i.id==='furniture-'+f.kind).qty,1);}decorView();
}
console.log('PASS: middle-handle wall movement, compatibility click suppression, rotated green one-click footprint, keyboard placement and all eight proportioned selectable/budgeted decorations.');

// Empty-shell stair flights, floor hole and framing survive all quarter turns and floor views.
for(const turn of [0,1,2,3]){const angle=turn*Math.PI/2,c={...config,designMode:'Blank slate',width:32,depth:32,stories:2,activeFloor:0,placedFurniture:[{id:'F-U-stairs',kind:'stairs',roomId:'custom',x:16,z:16,w:turn%2?16:8,d:turn%2?8:16,localWidth:8,localDepth:16,rotation:angle}]};for(const floor of [0,1]){c.activeFloor=floor;const m=JSON.parse(app.calculate(JSON.stringify(c)));const check=renderHouse(el,{config:c,model:m,view:'dollhouse'});let treads=0,floors=0,targets=0;rendered.scene.traverse(o=>{if(o.name.includes('stair tread'))treads++;if(o.name==='Finished floor')floors++;if(o.userData.editTarget?.id==='F-U-stairs')targets++;});assert.equal(treads,m.stair.treads);assert.ok(targets>0);if(floor===1)assert.equal(floors,4,'Upper finished floor is cut around the rotated opening');const pose=check.getPose(),distance=rendered.camera.position.distanceTo(new T.Vector3().fromArray(pose.target));check.navigate('right');const moved=check.getPose();assert.ok(moved.position[0]>pose.position[0]);assert.ok(Math.abs((moved.position[0]-pose.position[0])-(moved.target[0]-pose.target[0]))<1e-8);check.navigate('in');assert.ok(rendered.camera.position.distanceTo(new T.Vector3().fromArray(moved.target))<distance);assert.equal(rendered.camera.fov,50);check();}}
const rightArrowScene=new T.Scene(),arrowMaps=[];const rightArrow=northModule.addNorthArrow(rightArrowScene,{w:32,d:40,garage:{x:32,z:0}},180,arrowMaps);assert.equal(rightArrow.position.z,0);assert.ok(rightArrow.position.x>32/2+24);graphics.clearSceneResources(rightArrowScene,arrowMaps);console.log('PASS: blank stairs render both flights at four rotations on both floors, upper floors have real holes, stair objects can be picked, interior camera pan/zoom and right-lawn compass clear a right garage.');

// Drag-to-drop placement must commit after movement beyond the old 6 px click limit.
{
 const c={...config,designMode:'Blank slate',width:32,depth:32,stories:2,activeFloor:0,addedWalls:[],placedFurniture:[],wallRemovals:[],wallAdjustments:{},openingOverrides:{},deletedFurniture:[]},m=JSON.parse(app.calculate(JSON.stringify(c)));
 const nav=renderHouse(el,{config:c,model:m,view:'dollhouse'});const fixedTarget=new T.Vector3().fromArray(nav.getPose().target),distance=rendered.camera.position.distanceTo(fixedTarget),original=rendered.camera.position.clone();
 nav.navigate('rotate-right');assert.ok(rendered.camera.position.distanceTo(original)>1);assert.ok(rendered.camera.position.distanceTo(fixedTarget)-distance<1e-8);assert.deepEqual(nav.getPose().target,fixedTarget.toArray());nav.navigate('rotate-left');assert.ok(rendered.camera.position.distanceTo(original)<1e-8);
 nav.navigate('tilt-up');assert.ok(rendered.camera.position.y>original.y);assert.deepEqual(nav.getPose().target,fixedTarget.toArray());for(let i=0;i<50;i++)nav.navigate('tilt-up');let offset=rendered.camera.position.clone().sub(fixedTarget);assert.ok(new T.Spherical().setFromVector3(offset).phi>=Math.PI/18-1e-8);for(let i=0;i<50;i++)nav.navigate('tilt-down');offset=rendered.camera.position.clone().sub(fixedTarget);assert.ok(new T.Spherical().setFromVector3(offset).phi<=Math.PI*.48+1e-8);
 for(let i=0;i<100;i++)nav.navigate('in');assert.ok(rendered.camera.position.distanceTo(fixedTarget)>=32*.3-1e-8);for(let i=0;i<100;i++)nav.navigate('out');assert.ok(rendered.camera.position.distanceTo(fixedTarget)<=Math.max(distance*3,32*5)+1e-8);
 const canvas=el.querySelector('canvas');rendered.camera.position.set(0,34,-24);rendered.camera.lookAt(0,.23,0);rendered.camera.updateMatrixWorld();
 globalThis.ufBridge.previewPlacement=t=>({...t,snapped:true,placementError:t.x<8?'Choose a clear position':null,placement:{id:'preview',kind:'stairs',localWidth:8,localDepth:16,w:8,d:16,rotation:0,x:16,z:16}});
 nav.setMode({moving:'',handles:false,placing:true,insertKind:'stairs',insertRotation:0});
 const event=(type,x,z,id=81)=>{const e=new dom.window.MouseEvent(type,{...projected(new T.Vector3(x-16,.23,z-16)),button:0,bubbles:true,cancelable:true});Object.defineProperties(e,{pointerId:{value:id},pointerType:{value:'touch'}});canvas.dispatchEvent(e);return e;};
 picked=null;event('pointerdown',4,16);event('pointermove',16,16);event('pointerup',16,16);assert.equal(picked?.commit,true,'Touch drag commits at the final green position');assert.equal(picked.placement.kind,'stairs');assert.match(el.querySelector('.wall-draft-measure').textContent,/upstairs clears automatically/);
 picked=null;event('pointerdown',16,16);event('pointercancel',16,16);event('pointerup',16,16);assert.equal(picked,null,'A cancelled drag cannot place stairs');
 event('pointerdown',16,16,82);event('pointerup',16,16,83);assert.equal(picked,null,'A different finger cannot commit the first finger placement');event('pointerup',4,16,82);assert.equal(picked,null,'A red final footprint cannot place');
 nav();delete globalThis.ufBridge.previewPlacement;
}
console.log('PASS: fixed-pivot orbit/tilt buttons, reversible rotation, bounded tilt/zoom, touch drag from red to green commits stairs, pointer cancellation and additional-finger rejection.');

// Reference porch structures are rendered from the same takeoff on all floors.
for(const style of ['Victorian','Colonial']){
 const c=JSON.parse(app.defaults());Object.assign(c,{homeStyle:style,stories:2,activeFloor:1,width:40,depth:40});
 const m=JSON.parse(app.calculate(JSON.stringify(c)));
 const stop=renderHouse(el,{config:c,model:m,view:'framing'});let joists=0,rafters=0;
 rendered.scene.traverse(object=>{if(object.name==='Porch deck joist')joists++;if(object.name==='Porch roof I-joist')rafters++;});
 assert.equal(joists,m.porch.deckJoists.length+(m.rearOutdoor?.deckJoists.length||0));assert.equal(rafters,m.porch.roofs.reduce((n,r)=>n+r.roof.rafters.length,0)+(m.rearOutdoor?.roofs.reduce((n,r)=>n+r.roof.rafters.length,0)||0));
 for(const object of rendered.scene.children)object.updateMatrixWorld(true);stop();
 const finish=renderHouse(el,{config:c,model:m,view:'exterior'});const relief=[];rendered.scene.traverse(object=>{if(object.userData.trimOrnament)relief.push(object);});
 assert.equal(relief.length,m.allTrimOrnaments.length);assert.ok(relief.every(group=>group.children.length===1),'Carved relief uses one merged mesh per modeled ornament');
 finish();
}
console.log('PASS: upper-floor framing keeps the complete reference porch, exact scheduled deck/roof joist counts, and merged source-matched relief on both stories.');

// New panel defaults, repeatable finishes, object geometry and responsive camera fit.
{
 const {fitHouseCamera,houseViewBounds}=await import('../../'+work+'/camera-fit.mjs');
 for(const [w,d,stories] of [[8,8,1],[32,40,2],[100,100,1],[100,100,2]])for(const [width,height]of [[1440,900],[390,680],[800,600]])for(const view of ['exterior','dollhouse','framing']){
  const c={...config,width:w,depth:d,stories,garage:'None',dormerStyle:'None',rearOutdoor:'None'},m=JSON.parse(app.calculate(JSON.stringify(c))),camera=new T.PerspectiveCamera(view==='dollhouse'?50:37,width/height,.08,1000),orbit={target:new T.Vector3(),update(){camera.lookAt(this.target);}};
  camera.position.set(w*.8,m.h+w*.6,-d);const distance=fitHouseCamera(camera,orbit,m,c,view,width,height);assert.ok(Number.isFinite(distance)&&distance>0);const bounds=houseViewBounds(m,c,view);let occupied=0;
  for(const x of[bounds.min.x,bounds.max.x])for(const y of[bounds.min.y,bounds.max.y])for(const z of[bounds.min.z,bounds.max.z]){const p=new T.Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<=.8&&Math.abs(p.y)<=.8,`${w}×${d} ${view} fits ${width}×${height}`);occupied=Math.max(occupied,Math.abs(p.x),Math.abs(p.y));}assert.ok(occupied>.65,'House uses the available viewport');assert.ok(orbit.maxDistance>=distance);
 }
 const {tileMaterial}=await import('../../'+work+'/surface-patterns.mjs'),textures=[],tileCatalog=JSON.parse(fs.readFileSync('rust-app/data/tiles.json','utf8'));
 for(const tile of tileCatalog){const mat=tileMaterial(tile.name,textures);assert.ok(mat.map&&mat.bumpMap);assert.equal(mat.userData.repeatFeet,tile.size*2);assert.notEqual(mat.map,mat.bumpMap);}for(const texture of textures)texture.dispose();
 const objects=JSON.parse(fs.readFileSync('rust-app/data/objects.json','utf8')),{addStagingObject}=await import('../../'+work+'/staging-items.mjs'),scene=new T.Scene(),maps=[],wood=new T.MeshStandardMaterial({map:new T.Texture(),normalMap:new T.Texture()}),cloth=new T.MeshStandardMaterial(),metal=new T.MeshStandardMaterial();
 for(const [i,obj]of objects.entries()){const f={id:'forty-'+i,kind:obj.kind,localWidth:obj.width,localDepth:obj.depth,w:obj.width,d:obj.depth,rotation:0,x:i*12,z:0};assert.equal(addStagingObject(scene,f,{w:500,d:100},model.interior,wood,cloth,metal,()=>true),true);}
 for(let i=0;i<100;i++){const groups=scene.children.filter(o=>o.userData.editTarget?.kind==='furniture');if(groups.length===40)break;await new Promise(r=>setTimeout(r,20));}
 assert.equal(scene.children.filter(o=>o.userData.editTarget?.kind==='furniture').length,40);
 for(const [i,obj]of objects.entries()){const group=scene.children.find(o=>o.userData.editTarget?.id==='forty-'+i);assert.ok(group,'Selectable '+obj.kind);const size=new T.Box3().setFromObject(group).getSize(new T.Vector3());assert.ok(size.x<=obj.width+.03&&size.z<=obj.depth+.03,'Accurate footprint '+obj.kind);assert.ok(size.y>.5,'Actual 3D shape '+obj.kind);assert.ok(group.children.length>0);}graphics.clearSceneResources(scene,maps);
 const c={...config,width:32,depth:32,stories:2,designMode:'Blank slate',placedFurniture:[],addedWalls:[],garage:'None',dormerStyle:'None'},m=JSON.parse(app.calculate(JSON.stringify(c)));const stop=renderHouse(el,{config:c,model:m,view:'framing'});let crawl=0;rendered.scene.traverse(o=>{if(o.name==='Crawlspace floor I-joist')crawl++;});assert.equal(crawl,m.crawlFloorFrameMembers.filter(p=>p.role==='Crawlspace floor I-joist').length);stop();
}
console.log('PASS: 8–100 ft camera fits in portrait/desktop, 12 repeatable tile surfaces, all 40 selectable objects with real-size footprints and crawlspace framing.');

// Dormer wall openings, child rafters and support plies share the Rust geometry.
{
 const c={...config,homeStyle:'Colonial',width:40,depth:36,stories:2,activeFloor:1,pitch:8,dormerStyle:'Gable',dormerWidth:4,dormerDepth:16,dormerCount:2,rearOutdoor:'Deck',rearWidth:12,rearDepth:6};const m=JSON.parse(app.calculate(JSON.stringify(c)));assert.equal(m.dormers.length,2);
 const stop=renderHouse(el,{config:c,model:m,view:'framing',frameRoof:true});const names=[];rendered.scene.traverse(o=>{if(o instanceof T.Mesh)names.push(o.name)});
 for(const d of m.dormers){assert.equal(names.filter(name=>name.startsWith(d.id+' ')).length,d.members.length+d.supportMembers.length+d.rafters.length*3);assert.equal(names.filter(name=>name===d.id+' Rough sill').length,d.openings.length);assert.equal(names.filter(name=>name===d.id+' Header ply').length,d.openings.length*2);}
 for(const r of m.rafters.filter(r=>r.id.includes('CUT')))assert.ok(names.includes('I-joist web '+r.id));stop();
 const finish=renderHouse(el,{config:c,model:m,view:'exterior'});const meshes=[];rendered.scene.traverse(o=>{if(o instanceof T.Mesh)meshes.push(o);});for(const d of m.dormers)assert.equal(meshes.filter(o=>o.name===d.id+' glazed window').length,d.openings.length);assert.ok(rendered.scene.children.some(o=>o.name==='House level 0'));finish();
}
console.log('PASS: exact dormer window headers/sills, roof-opening support plies, I-joist cuts and finished glazing on the upper story.');


// New finishes render on the selected room's actual faces, including upper floors.
{
 const vinyl=JSON.parse(fs.readFileSync('rust-app/data/vinyl.json','utf8'));
 const c={...config,width:32,depth:40,stories:2,activeFloor:1,garage:'None',balcony:'Rear balcony',roomWallpapers:{},floor:vinyl[10].name,colors:{...config.colors,floor:'#ffffff'}};
 const initial=JSON.parse(app.calculate(JSON.stringify(c))),room=initial.levels[1].finishRooms.find(r=>r.type==='bedroom');
 assert.ok(room);c.roomWallpapers[room.id]='Sapphire paisley';const m=JSON.parse(app.calculate(JSON.stringify(c)));
 const stop=renderHouse(el,{config:c,model:m,view:'dollhouse'});let faces=0,floor=false;
 rendered.scene.traverse(o=>{if(!(o instanceof T.Mesh))return;const materials=Array.isArray(o.material)?o.material:[o.material];
 if(o.userData.wallFace?.roomId===room.id){faces++;assert.equal(o.userData.wallFace.wallpaper,'Sapphire paisley');assert.ok(materials.some(mat=>mat.map?.userData.file.endsWith('26-paisley.webp')));}
 if(materials.some(mat=>mat.map?.userData.file==='vinyl/'+vinyl[10].file))floor=true;});
 assert.ok(faces>0&&floor,'Upper-floor room paper and patterned vinyl are rendered');
 const upper=[];rendered.scene.traverse(o=>{if(o.name==='Connected upper balcony')upper.push(o);});assert.equal(upper.length,1);const localBounds=new T.Box3().setFromObject(upper[0]);assert.ok(localBounds.min.y>-1.1&&localBounds.max.y<4,'Upper interior balcony uses local floor height');stop();
 for(const view of ['exterior','framing']){
  const finish=renderHouse(el,{config:c,model:m,view});const balconies=[],joists=[],posts=[];rendered.scene.traverse(o=>{if(o.name==='Connected upper balcony')balconies.push(o);if(o.name==='Balcony deck joist')joists.push(o);if(o.name==='Balcony support post')posts.push(o);});
  assert.equal(balconies.length,1,'A balcony appears once in '+view);assert.equal(joists.length,m.balcony.joists.length);assert.equal(posts.length,m.balcony.posts.length);
  const bounds=new T.Box3().setFromObject(balconies[0]);assert.ok(bounds.max.y>m.floorHeight+(view==='framing'?-.5:3)&&bounds.min.y<.1,'Whole-house balcony spans from ground to upper deck / guard');
  const door=m.levels[1].openings.find(o=>o.id===m.balcony.doorId);assert.ok(door&&door.kind==='door'&&door.bottom===0);assert.ok(m.levels[1].frameMembers.some(f=>f.openingId===door.id&&f.role==='Header ply'));finish();
 }
 const dc={...config,width:100,depth:100,homeStyle:'Colonial',stories:2,pitch:8,dormerStyle:'Gable',dormerWidth:4,dormerDepth:16,dormerCount:6,dormerSide:'Front',garage:'None',balcony:'None'};
 const dm=JSON.parse(app.calculate(JSON.stringify(dc)));assert.equal(dm.dormers.length,6);const finish=renderHouse(el,{config:dc,model:dm,view:'exterior'});let windows=0;rendered.scene.traverse(o=>{if(o.name.endsWith('glazed window'))windows++;});assert.equal(windows,6);finish();
}
console.log('PASS: actual room-facing wallpaper, patterned vinyl, connected upper balcony at local/whole-house elevations with complete joists/posts/headers, and all six dormer windows.');

// Distinct catalog choices retain visible color and geometry; failed detailed models stay visible.
{
 const {addStagingObject}=await import('../../'+work+'/staging-items.mjs'),objects=JSON.parse(fs.readFileSync('rust-app/data/objects.json','utf8'));
 const wood=new T.MeshStandardMaterial({map:new T.Texture(),normalMap:new T.Texture()}),cloth=new T.MeshStandardMaterial({color:'#617974'}),metal=new T.MeshStandardMaterial({color:'#acb2b4'}),signatures=new Map();
 for(const kind of ['loveseat','accent-chair','recliner','twin-bed','king-bed','pouffe','ottoman','round-table','breakfast-table','dresser','chest','filing-cabinet','china-cabinet','linen-cabinet','pantry-cabinet','range','freezer']){
  const obj=objects.find(o=>o.kind===kind),scene=new T.Scene(),f={id:kind,kind,localWidth:obj.width,localDepth:obj.depth,rotation:0,x:0,z:0};assert.ok(addStagingObject(scene,f,{w:32,d:32},model.interior,wood,cloth,metal,()=>true));
  const signature=[],colors=new Set();scene.traverse(o=>{if(o instanceof T.Mesh){signature.push([o.geometry.type,o.geometry.attributes.position.count,o.position.toArray(),o.scale.toArray()]);for(const mat of Array.isArray(o.material)?o.material:[o.material])if(mat.color)colors.add(mat.color.getHexString());}});
  assert.ok(colors.size>=2,'Colored staging '+kind);signatures.set(kind,JSON.stringify(signature));graphics.clearSceneResources(scene,[]);
 }
 assert.equal(new Set(signatures.values()).size,signatures.size,'Distinct choices have different actual geometry');
 const furniture=await import('../../'+work+'/furniture.mjs?failure-test'),savedFetch=globalThis.fetch,savedWarn=console.warn;globalThis.fetch=async()=>{throw Error('Simulated unavailable furniture asset');};console.warn=()=>{};
 const scene=new T.Scene(),f={id:'fallback-sofa',kind:'sofa',localWidth:6,localDepth:3,rotation:0,x:4,z:5};furniture.addRealFurniture(scene,f,{w:32,d:32},model.interior,()=>true);assert.equal(scene.children.length,1);const parent=scene.children[0];assert.ok(parent.children.length>4,'Complete colored fallback exists immediately');
 for(let i=0;i<30&&parent.userData.assetState==='loading';i++)await new Promise(r=>setTimeout(r,5));assert.equal(parent.userData.assetState,'fallback');assert.ok(new T.Box3().setFromObject(parent).getSize(new T.Vector3()).y>2,'Failed asset retains a visible complete sofa');globalThis.fetch=savedFetch;console.warn=savedWarn;graphics.clearSceneResources(scene,[]);
}
console.log('PASS: distinct staging geometry/material colors and complete furniture fallback when the detailed model download fails.');
