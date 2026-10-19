import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM,VirtualConsole} from 'jsdom';
const errors=[];
const virtualConsole=new VirtualConsole();
virtualConsole.on('jsdomError',e=>errors.push(e));
const dom=new JSDOM('<!doctype html><div id="app"></div>',{url:'https://universal-frames.test/',pretendToBeVisual:true,virtualConsole});
for(const key of ['window','document','Window','Document','Element','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','MouseEvent','PointerEvent','KeyboardEvent','Node'])globalThis[key]=dom.window[key];
globalThis.self=dom.window;
let timerId=0;const noticeTimers=new Map();dom.window.setTimeout=(fn,ms)=>{assert.equal(ms,6000);const id=++timerId;noticeTimers.set(id,fn);return id;};dom.window.clearTimeout=id=>noticeTimers.delete(id);
if(!dom.window.PointerEvent){dom.window.PointerEvent=class extends dom.window.MouseEvent{constructor(type,init={}){super(type,init);for(const key of ['pointerType','pointerId','isPrimary'])Object.defineProperty(this,key,{value:init[key]});}};globalThis.PointerEvent=dom.window.PointerEvent;}
const pointer=(type,x=40,y=40,pointerType='touch')=>new dom.window.PointerEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y,pointerId:1,pointerType,isPrimary:true});
// TouchList-shaped objects exercise the actual compiled web-sys TouchEvent getters.
const contact=(x=40,y=40,id=7)=>({identifier:id,clientX:x,clientY:y});
const touchEvent=(type,x=40,y=40,count=1)=>{const e=new dom.window.Event(type,{bubbles:true,cancelable:true});const changed=[contact(x,y)],contacts=type==='touchend'||type==='touchcancel'?[]:Array.from({length:count},(_,i)=>contact(x,y,7+i));const list=a=>({length:a.length,item:i=>a[i]??null});Object.defineProperties(e,{touches:{value:list(contacts)},changedTouches:{value:list(changed)}});return e;};
let lastScene,exported,requestedZip,reportKind,selectedTarget;
globalThis.ufBridge={layoutEditor(){},setEditMode(){},selectScene(raw){selectedTarget=JSON.parse(raw);},renderScene(raw){lastScene=JSON.parse(raw);},lookupZip(zip){requestedZip=zip;},download(raw){exported=JSON.parse(raw);},report(raw,kind){exported=JSON.parse(raw);reportKind=kind;}};
const app=await import('../../public/pkg/universal_frames.js');
app.initSync({module:fs.readFileSync(new URL('../../public/pkg/universal_frames_bg.wasm',import.meta.url))});
app.start();
const q=s=>{const el=document.querySelector(s);assert.ok(el,'Missing control '+s);return el;};
const click=s=>q(s).dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));
const change=(s,value)=>{const el=q(s);if(el.type==='checkbox')el.checked=value;else el.value=String(value);el.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
const snapshot=()=>{click('[data-action="reports"]');click('[data-action="json"]');click('[data-action="close"]');return exported;};
assert.equal(lastScene.config.homeStyle,'Colonial','first visit opens on a Colonial');assert.equal(lastScene.config.garage,'Attached','with an attached garage');assert.equal(lastScene.config.tax,6,'and 6% sales tax');assert.ok(lastScene.model.garage);
const startup=structuredClone(lastScene);
assert.deepEqual(lastScene.config,JSON.parse(app.defaults()),'The first scene uses the Rust startup house');
const startCfg=lastScene.config;assert.equal(startCfg.homeStyle,'Colonial');assert.match(startCfg.layout,/^Catalog · /);assert.equal(startCfg.trimPackage,'Colonial ogee');console.log('START',startCfg.layout,startCfg.wallpaper,startCfg.bedroomWallpaper,startCfg.pitch,lastScene.model.homeStyle.feature,lastScene.model.w,lastScene.model.d);
assert.equal(startCfg.pitch,9,'the Colonial opens at its 9:12 pitch');assert.equal(lastScene.model.homeStyle.feature,'pediment');assert.equal(lastScene.model.trimPackage.name,'Colonial ogee');
assert.ok(lastScene.model.rooms.some(r=>r.type==='hall'));
assert.ok(lastScene.model.wallFaces.every(f=>f.wallpaper===(f.group==='bedroom'?startCfg.bedroomWallpaper:startCfg.wallpaper)));
// The layout menu follows the requested order, with history collapsed at the end.
const layoutBody=q('#controls .control-body');
const ordered=['[data-field="width"]','[data-field="homeStyle"]','[data-field="stories"]','[data-field="bedrooms"]','[data-section="roof"]','[data-field="garage"]','[data-field="shape"]','[data-field="frontBearing"]','.source-card'];
// Dimension fields use IDs; the remainder are immediate native controls.
ordered[0]='#width';for(let i=1;i<ordered.length;i++)assert.ok(q(ordered[i-1]).compareDocumentPosition(q(ordered[i]))&Node.DOCUMENT_POSITION_FOLLOWING);
assert.equal(q('.source-card').open,false);assert.match(q('.source-card').textContent,/Main floor · foyer, reception, kitchen and dining/);assert.match(q('.source-card').textContent,/Gordon-Van Tine/);assert.match(q('[data-field="frontBearing"]').selectedOptions[0].textContent,/South/);
q('.source-card').open=true;change('[data-field="frontBearing"]',90);assert.equal(q('.source-card').open,true);assert.equal(lastScene.config.frontBearing,90);assert.match(q('[data-field="frontBearing"]').selectedOptions[0].textContent,/East/);change('[data-field="frontBearing"]',180);
click('[data-tab="materials"]');for(const key of ['laborCost','landCost','permitCost','surveyCost'])assert.ok(q('#controls [data-field="'+key+'"]'));assert.equal(document.querySelectorAll('#estimate .project-allowance-fields [data-field]').length,4);assert.equal(document.querySelector('#estimate .project-costs'),null);click('[data-tab="layout"]');
// Preserve the pressed control when field blur/change updates its section.
const pressedNext=q('[data-action="next"]'),startLayout=lastScene.config.layout;pressedNext.dispatchEvent(pointer('pointerdown'));change('[data-field="bedrooms"]',2);assert.equal(pressedNext.isConnected,true);pressedNext.dispatchEvent(pointer('pointerup'));assert.notEqual(lastScene.config.layout,startLayout);const touchedLayout=lastScene.config.layout;
q('[data-action="next"]').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true,detail:1,clientX:40,clientY:40}));assert.equal(lastScene.config.layout,touchedLayout,'Synthetic touch click must not activate twice');
click('[data-action="previous"]');change('[data-field="bedrooms"]',3);assert.equal(lastScene.config.layout,startLayout);assert.ok(q('#message').classList.contains('hidden'),'Ordinary edits do not show a popup');
const next=q('[data-action="next"]');next.dispatchEvent(pointer('pointerdown'));q('#app').dispatchEvent(pointer('pointermove',70,40));q('#app').dispatchEvent(pointer('pointerup',70,40));assert.equal(lastScene.config.layout,startLayout,'Scrolling across a button is not a tap');
next.dispatchEvent(pointer('pointerdown'));q('#app').dispatchEvent(pointer('pointercancel'));q('#app').dispatchEvent(pointer('pointerup'));assert.equal(lastScene.config.layout,startLayout,'Cancelled gestures are ignored');
const touch=s=>{q(s).dispatchEvent(pointer('pointerdown'));q('#app').dispatchEvent(pointer('pointerup'));};touch('[data-view="dollhouse"]');assert.equal(lastScene.view,'dollhouse');touch('[data-view="exterior"]');assert.equal(lastScene.view,'exterior');touch('[data-action="reports"]');assert.ok(q('.report-modal'));touch('[data-action="close"]');assert.equal(document.querySelector('.report-modal'),null);
const safariTap=s=>{const target=q(s);target.dispatchEvent(touchEvent('touchstart'));target.dispatchEvent(touchEvent('touchend'));};
for(const view of ['dollhouse','exterior','framing','walk','plan']){safariTap('[data-view="'+view+'"]');assert.equal(lastScene.view,view,'Touch-only view button '+view);}
safariTap('[data-view="exterior"]');safariTap('[data-action="reports"]');assert.ok(q('.report-modal'));safariTap('[data-action="close"]');assert.equal(document.querySelector('.report-modal'),null);
// Safari can deliver both input streams, or cancel PointerEvent before TouchEvent ends.
const nextBefore=lastScene.config.layout,mixed=q('[data-action="next"]');mixed.dispatchEvent(pointer('pointerdown'));mixed.dispatchEvent(touchEvent('touchstart'));mixed.dispatchEvent(pointer('pointerup'));assert.equal(lastScene.config.layout,nextBefore,'Touch stream owns the mixed gesture');mixed.dispatchEvent(touchEvent('touchend'));const nextAfter=lastScene.config.layout;assert.notEqual(nextAfter,nextBefore);q('[data-action="next"]').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true,detail:1,clientX:40,clientY:40}));assert.equal(lastScene.config.layout,nextAfter,'Mixed stream plus compatibility click activates once');
const cancelPointer=q('[data-action="previous"]');cancelPointer.dispatchEvent(pointer('pointerdown'));cancelPointer.dispatchEvent(touchEvent('touchstart'));cancelPointer.dispatchEvent(pointer('pointercancel'));cancelPointer.dispatchEvent(touchEvent('touchend'));assert.equal(lastScene.config.layout,nextBefore,'Touchend still works after pointer cancellation');
const touchDraft=q('[data-action="next"]');touchDraft.dispatchEvent(touchEvent('touchstart'));change('[data-field="bedrooms"]',1);assert.equal(touchDraft.isConnected,true);touchDraft.dispatchEvent(touchEvent('touchend'));assert.equal(lastScene.config.bedrooms,4);assert.notEqual(lastScene.config.layout,nextBefore);safariTap('[data-action="previous"]');change('[data-field="bedrooms"]',3);
for(const gesture of ['scroll','cancel','multi']){const before=lastScene.config.layout,target=q('[data-action="next"]');target.dispatchEvent(touchEvent('touchstart'));if(gesture==='scroll')target.dispatchEvent(touchEvent('touchmove',70,40));if(gesture==='cancel')target.dispatchEvent(touchEvent('touchcancel'));if(gesture==='multi')target.dispatchEvent(touchEvent('touchstart',40,40,2));target.dispatchEvent(touchEvent('touchend',gesture==='scroll'?70:40,40));assert.equal(lastScene.config.layout,before,'Touch '+gesture+' must not activate');}
for(let i=0;i<2;i++){safariTap('[data-action="next"]');safariTap('[data-action="previous"]');assert.equal(lastScene.config.layout,startLayout,'Fast repeated taps are separate gestures');}
// A different button at the same screen position must retain its native click fallback.
safariTap('[data-view="dollhouse"]');q('[data-view="exterior"]').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true,detail:1,clientX:40,clientY:40}));assert.equal(lastScene.view,'exterior');

change('[data-field="stories"]',1);change('#width',24);change('#depth',32);
assert.equal(q('#width').value,'24','Draft dimensions must survive blur');
click('[data-action="dimensions"]');assert.equal(lastScene.model.area,768+(lastScene.model.bumpOutArea||0),'Floor area is the footprint plus any bump-outs');
change('#width',7);click('[data-action="dimensions"]');assert.equal(lastScene.model.w,24);assert.match(q('#message').textContent,/8–100/);assert.equal(noticeTimers.size,1);const [noticeId,expire]=[...noticeTimers][0];noticeTimers.delete(noticeId);expire();assert.equal(q('#message').textContent,'');assert.ok(q('#message').classList.contains('hidden'));click('[data-view="exterior"]');assert.ok(q('#message').classList.contains('hidden'),'Expired notices stay cleared on later renders');
change('#width',48);change('#depth',36);click('[data-action="dimensions"]');
change('#width',47.2);change('#depth',35.1);click('[data-action="dimensions"]');assert.equal(lastScene.model.w,48);assert.equal(lastScene.model.d,36);assert.match(q('#message').textContent,/2-foot/);assert.ok(lastScene.model.rooms.every(r=>[r.x,r.z,r.w,r.d].every(n=>n%2===0)));let previous=lastScene.config.layout;click('[data-action="next"]');assert.notEqual(lastScene.config.layout,previous);click('[data-action="previous"]');assert.equal(lastScene.config.layout,previous);
assert.equal(document.querySelector('[data-field="layout"]'),null);assert.ok(q('.source-card'));assert.equal(q('[data-field="homeStyle"]').options.length,15);change('[data-field="stories"]',1);change('#width',48);change('#depth',36);click('[data-action="dimensions"]');
click('[data-tab="finishes"]');assert.equal(q('[data-field="interiorStyle"]').options.length,30);assert.equal(q('[data-field="trimPackage"]').options.length,10);assert.equal(q('[data-field="wallpaper"]').options.length,JSON.parse(fs.readFileSync('rust-app/data/catalog.json')).wallpapers.length+1);assert.equal(q('[data-field="bedroomWallpaper"]').options.length,JSON.parse(fs.readFileSync('rust-app/data/catalog.json')).wallpapers.length+1);
const normalTrim=structuredClone(lastScene.model.trimPackage),normalTrimTotal=lastScene.model.total;click('[data-action="trim-size"][data-value="Oversized"]');assert.equal(lastScene.config.trimSize,'Oversized');assert.equal(q('[data-value="Oversized"]').getAttribute('aria-pressed'),'true');assert.equal(lastScene.model.trimPackage.baseHeight,normalTrim.baseHeight*1.5);assert.ok(lastScene.model.total>normalTrimTotal);click('[data-action="trim-size"][data-value="Normal"]');assert.equal(lastScene.model.total,normalTrimTotal);
assert.ok(!lastScene.model.items.some(i=>['chairrail','paneltrim','panelinfill'].includes(i.id)));assert.ok(lastScene.model.trimCorners.length>0);const trimChoice=lastScene.config.trimPackage,trimFinishes=new Set();for(const name of [...q('[data-field="trimPackage"]').options].map(o=>o.value)){change('[data-field="trimPackage"]',name);trimFinishes.add(lastScene.model.trimPackage.finish);assert.equal(q('.trim-wood-preview').getAttribute('aria-label'),lastScene.model.trimPackage.finish+' wood grain');}assert.equal(trimFinishes.size,10);change('[data-field="trimPackage"]',trimChoice);
change('[data-color="walls"]','#abc123');assert.equal(lastScene.config.colors.walls,'#abc123');
click('[data-tab="build"]');const originalTotal=snapshot().model.total;
change('[data-field="studType"]','LSL studs');let state=snapshot();assert.ok(state.model.total>originalTotal);assert.ok(state.model.frameMembers.some(m=>m.material==='LSL 2x6'));
change('[data-field="zip"]','33101');assert.equal(requestedZip,'33101');app.apply_location('33101',25.77,-80.19);assert.match(q('.profile-grid').closest('.profile').textContent,/Zone 1A/);const warm=snapshot().model.profile.requiredAtticR;
change('[data-field="zip"]','55401');app.apply_location('55401',44.98,-93.26);state=snapshot();assert.ok(state.model.profile.requiredAtticR>warm);assert.equal(state.model.profile.facing,'Kraft faced');
assert.equal(document.querySelector('[data-field="facing"]'),null,'Facing selection is fixed by the assembly');assert.equal(snapshot().model.profile.facing,'Kraft faced');
change('[data-field="ridgeVentNfa"]',6);state=snapshot();assert.ok(state.model.ventilation.boxVentCount>0);assert.equal(state.model.ventilation.passesArea,true);assert.equal(state.model.ventilation.passesBalance,true);assert.equal(state.model.items.find(i=>i.id==='roofvents').net,state.model.ventilation.boxVentCount);change('[data-field="ridgeVentNfa"]',18);
change('[data-field="buildingCode"]','2021 IRC');assert.equal(snapshot().model.openingChecks.edition,'2021 IRC');change('[data-field="buildingCode"]','2024 IRC');
click('[data-view="dollhouse"]');assert.equal(lastScene.view,'dollhouse');assert.equal(document.querySelector('[data-tab="edit"]'),null,'3D edit tab removed');
const pick=target=>app.pick_scene(JSON.stringify({screenX:120,screenY:100,...target}));
const interiorWall=lastScene.model.walls.find(w=>!w.exterior);pick({kind:'wall',wallId:interiorWall.id,at:2});assert.equal(selectedTarget.wallId,interiorWall.id);click('[data-view="exterior"]');assert.equal(selectedTarget,null);assert.equal(document.querySelector('.context-menu'),null);pick({kind:'wall',wallId:interiorWall.id,at:2});assert.equal(selectedTarget,null);pick({kind:'furniture',id:lastScene.model.furniture[0].id});assert.equal(selectedTarget,null);pick({kind:'floor',x:4,z:4});assert.equal(selectedTarget,null);pick({kind:'wall',wallId:'E1',at:2});assert.equal(selectedTarget.wallId,'E1');click('[data-view="dollhouse"]');pick({kind:'wall',wallId:interiorWall.id,at:2});assert.equal(selectedTarget.wallId,interiorWall.id);click('[data-action="edit-cancel"]');
assert.equal(document.querySelector('[data-tab="openings"]'),null,'Plan editor removed');
assert.equal(document.querySelector('svg [data-wall]'),null);
while(lastScene.model.walls.find(w=>w.id==='E2').openings.length){const op=lastScene.model.walls.find(w=>w.id==='E2').openings[0];pick({kind:'opening',id:op.id,wallId:'E2',at:op.at});click('[data-action="edit-delete"]');}
pick({kind:'wall',wallId:'E2',at:5.5});assert.equal(selectedTarget.kind,'wall');assert.equal(selectedTarget.sectionWidth,2);
change('#edit-at',4);change('#edit-width',3);change('#edit-opening-kind','door');assert.equal(q('#edit-at').value,'4','Opening draft survives change events');click('[data-action="edit-insert-opening"]');
let editedWall=lastScene.model.walls.find(w=>w.id==='E2');assert.equal(editedWall.openings.length,1);assert.equal(editedWall.openings[0].at,4);assert.equal(editedWall.openings[0].height,82.5/12.);
const editedId=editedWall.openings[0].id;
assert.equal(lastScene.model.frameMembers.filter(f=>f.openingId===editedId&&f.role==='Header ply').length,2);
assert.equal(lastScene.model.frameMembers.filter(f=>f.openingId===editedId&&f.role==='King').length,2);
pick({kind:'opening',id:editedId,wallId:'E2',at:4});change('#edit-width',3.5);click('[data-action="edit-save-opening"]');assert.equal(lastScene.model.walls.find(w=>w.id==='E2').openings[0].width,3.5);
const beforeInvalid=snapshot().model.total;pick({kind:'wall',wallId:'E2',at:5.5});change('#edit-at',4);click('[data-action="edit-insert-opening"]');assert.match(q('#message').textContent,/overlap/);assert.equal(snapshot().model.total,beforeInvalid);click('[data-action="edit-cancel"]');
const beforeWallRemoval=snapshot().model;
pick({kind:'wall',wallId:'E2',at:20});click('[data-action="edit-delete"]');assert.ok(!lastScene.model.walls.some(w=>w.id==='E2'));assert.ok(lastScene.model.walls.some(w=>w.id==='E2-A'));
assert.ok(lastScene.model.drywallWalls<beforeWallRemoval.drywallWalls);
click('[data-action="undo"]');assert.ok(lastScene.model.walls.some(w=>w.id==='E2'));click('[data-action="redo"]');assert.ok(lastScene.model.walls.some(w=>w.id==='E2-A'));click('[data-action="undo"]');
const initialFurniture=lastScene.model.furniture[0];pick({kind:'furniture',id:initialFurniture.id});assert.ok(q('[data-action="edit-move"]'));click('[data-action="edit-delete"]');assert.ok(!lastScene.model.furniture.some(f=>f.id===initialFurniture.id));click('[data-action="undo"]');assert.ok(lastScene.model.furniture.some(f=>f.id===initialFurniture.id));
// Try free floor locations using the actual placement constraints, then insert a small item.
let inserted=false;
for(let x=2;x<lastScene.model.w-2&&!inserted;x+=3)for(let z=2;z<lastScene.model.d-2&&!inserted;z+=3){pick({kind:'floor',x,z});change('#edit-item','plant');click('[data-action="edit-insert-item"]');inserted=lastScene.config.placedFurniture.length>0;}
assert.ok(inserted,'Floor insertion at a valid free point');let userItem=lastScene.config.placedFurniture[0];assert.ok(lastScene.model.furniture.some(f=>f.id===userItem.id));
pick({kind:'furniture',id:userItem.id});click('[data-action="edit-move"]');assert.match(q('#message').textContent,/Click the floor/);
pick({kind:'floor',x:0,z:0});assert.equal(selectedTarget.placementError,null,'Near-edge placement snaps inside');assert.ok(selectedTarget.placement.x>=.28+selectedTarget.placement.w/2);assert.equal(selectedTarget.placement.id,userItem.id);click('[data-action="edit-cancel"]');pick({kind:'furniture',id:userItem.id});click('[data-action="edit-move"]');
let destination;
for(let x=2;x<lastScene.model.w-2&&!destination;x+=3)for(let z=2;z<lastScene.model.d-2&&!destination;z+=3){if(Math.hypot(x-userItem.x,z-userItem.z)<4)continue;const trial=structuredClone(lastScene.config);trial.placedFurniture[0]={...userItem,x,z};const result=JSON.parse(app.calculate(JSON.stringify(trial)));if(result.furniture.some(f=>f.id===userItem.id&&f.x===x&&f.z===z))destination={x,z};}
assert.ok(destination,'Find a distinct valid move destination');pick({kind:'floor',...destination});assert.equal(selectedTarget.placementError,null);click('[data-action="edit-insert-item"]');let moved=lastScene.model.furniture.find(f=>f.id===userItem.id);assert.equal(moved.x,destination.x);assert.equal(moved.z,destination.z);assert.ok(q('#message').classList.contains('hidden'),'Routine item moves do not leave a toast');click('[data-action="undo"]');assert.equal(lastScene.model.furniture.find(f=>f.id===userItem.id).x,userItem.x);click('[data-action="redo"]');assert.equal(lastScene.model.furniture.find(f=>f.id===userItem.id).x,destination.x);

pick({kind:'floor',x:10,z:10});change('#edit-axis','x');change('#edit-length',4);click('[data-action="edit-add-wall"]');assert.equal(lastScene.config.addedWalls.length,1);assert.ok(lastScene.model.frameMembers.some(f=>f.wallId===lastScene.config.addedWalls[0].id));const customWall=lastScene.config.addedWalls[0],resizeBefore=lastScene.model.drywallWalls;app.resize_wall(JSON.stringify({wallId:customWall.id,edge:'end',coordinate:customWall.x+8}));assert.equal(lastScene.model.walls.find(w=>w.id===customWall.id).length,8);assert.ok(Math.abs(lastScene.model.drywallWalls-resizeBefore-8*lastScene.config.wallHeight)<.02);assert.ok(lastScene.model.frameMembers.some(f=>f.wallId===customWall.id));app.resize_wall(JSON.stringify({wallId:customWall.id,edge:'start',coordinate:customWall.x-4}));assert.equal(lastScene.model.walls.find(w=>w.id===customWall.id).length,12);click('[data-action="undo"]');assert.equal(lastScene.model.walls.find(w=>w.id===customWall.id).length,8);click('[data-action="undo"]');assert.equal(lastScene.model.walls.find(w=>w.id===customWall.id).length,4);click('[data-action="undo"]');assert.equal(lastScene.config.addedWalls.length,0);
click('[data-tab="finishes"]');let originalWalls=lastScene.config.colors.walls;change('[data-field="interiorStyle"]',q('[data-field="interiorStyle"]').options[15].value);assert.notEqual(lastScene.config.colors.walls,originalWalls);
change('[data-field="bedroomWallpaper"]','None');change('[data-field="wallpaper"]','Midnight damask');assert.ok(Math.abs(lastScene.model.wallpaperArea-lastScene.model.generalWallArea)<.02);change('[data-field="bedroomWallpaper"]','Botanical silk');assert.ok(lastScene.model.wallpaperBedroomArea>0);assert.ok(Math.abs(lastScene.model.wallpaperArea-(lastScene.model.generalWallArea+lastScene.model.wallpaperBedroomArea))<.02);assert.ok(lastScene.model.wallpaperArea<=lastScene.model.drywallWalls+.02);change('[data-field="bedroomWallpaper"]','None');change('[data-field="wallpaper"]','None');
for(const view of ['exterior','dollhouse','framing','walk','plan']){click('[data-view="'+view+'"]');assert.equal(lastScene.view,view);}
click('[data-view="framing"]');change('[data-field="frameRoof"]',false);assert.equal(lastScene.frameRoof,false);const opening=lastScene.model.openings[0].id;change('[data-field="frameOpening"]',opening);assert.equal(lastScene.frameOpening,opening);
click('[data-action="expand"]');assert.ok(q('#visual').classList.contains('expanded'));document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.ok(!q('#visual').classList.contains('expanded'));
change('[data-field="tax"]',5);change('[data-field="waste"]',15);const firstPrice=q('[data-price]');const id=firstPrice.dataset.price;change('[data-price="'+id+'"]',100);state=snapshot();assert.equal(state.model.items.find(i=>i.id===id).price,100);assert.equal(state.model.tax,Math.round(state.model.subtotal*.05*100)/100);
click('[data-action="reports"]');for(const kind of ['pdf','csv','framing']){click('[data-action="'+kind+'"]');assert.equal(reportKind,kind);assert.equal(exported.schemaVersion,'5.0-rust');}click('[data-action="forte"]');assert.match(q('#modal').textContent,/SDK connection not active/);click('[data-action="close"]');
assert.equal(q('#keep-size').checked,false,'Generate another home varies the size unless the visitor keeps it');const styleBefore=lastScene.config.homeStyle,beforeGenerate=JSON.stringify(snapshot().config);click('[data-action="generate"]');assert.notEqual(lastScene.config.homeStyle,styleBefore,'Each generated home is a new style');change('#keep-size',true);const sizeBeforeGenerate=[lastScene.model.w,lastScene.model.d];click('[data-action="generate"]');assert.deepEqual([lastScene.model.w,lastScene.model.d],sizeBeforeGenerate);
// Generated homes are random; Undo twice returns to the exact design, so the checks below stay deterministic.
click('[data-action="undo"]');click('[data-action="undo"]');assert.equal(JSON.stringify(snapshot().config),beforeGenerate,'Undo restores the design from before Generate');
assert.deepEqual(JSON.parse(app.defaults()),startup.config,'Edits and generation leave the next page load default intact');
assert.deepEqual(errors,[]);
// Architectural selections change actual dimensions and walls, and both floors remain editable.
click('[data-tab="layout"]');
const styleShapes=new Set(),roofTypes=new Set();
for(const option of [...q('[data-field="homeStyle"]').options]){change('[data-field="homeStyle"]',option.value);styleShapes.add(JSON.stringify([lastScene.model.w,lastScene.model.d,lastScene.model.walls.map(w=>[w.x,w.z,w.length,w.axis])]));roofTypes.add(lastScene.model.roof.type);assert.equal(lastScene.config.width%2,0);assert.equal(lastScene.config.depth%2,0);}
assert.equal(styleShapes.size,15);assert.equal(roofTypes.size,7);
change('[data-field="homeStyle"]','Victorian');change('[data-field="stories"]',2);
assert.equal(lastScene.model.levels.length,2);assert.equal(lastScene.model.levels[0].counts.bedrooms,0);assert.equal(lastScene.model.levels[1].counts.bedrooms,lastScene.model.counts.bedrooms);
const twoFloorCost=lastScene.model.total;
safariTap('[data-floor="1"]');assert.equal(lastScene.config.activeFloor,1);assert.ok(lastScene.model.rooms.some(r=>r.type==='bedroom'));assert.equal(lastScene.model.total,twoFloorCost);safariTap('[data-view="framing"]');assert.equal(lastScene.view,'framing');assert.equal(lastScene.config.activeFloor,1);safariTap('[data-view="dollhouse"]');assert.equal(lastScene.view,'dollhouse');
click('[data-view="dollhouse"]');const upperWall=lastScene.model.walls.find(w=>!w.exterior);app.pick_scene(JSON.stringify({kind:'wall',wallId:upperWall.id,at:2,x:upperWall.x,z:upperWall.z}));assert.equal(selectedTarget.wallId,upperWall.id);click('[data-floor="0"]');assert.equal(lastScene.config.activeFloor,0);assert.equal(lastScene.model.total,twoFloorCost);assert.ok(!lastScene.model.rooms.some(r=>r.type==='bedroom'));
click('[data-tab="layout"]');change('[data-field="stories"]',1);assert.equal(lastScene.config.activeFloor,0);assert.ok(!lastScene.model.levels);
console.log('PASS: 15 distinct architectural footprints/wall plans, seven roof forms, two stories, floor touch controls, selected-floor geometry and stable aggregate pricing.');
console.log('PASS: compiled Rust/WASM interface — touch-only and mixed-stream actions, stable pressed controls during blur/change, duplicate-click rejection, fast repeated taps, scroll/multitouch/cancel handling, timed notices, trim, dimensions, ZIP, 3D edits, undo/redo, wallpapers, views, costs and exports.');

// Two-car garage choices, live cost, plan, walkthrough and framing inspection.
change('[data-field="garage"]','None');const garageBase=snapshot();assert.equal(q('[data-field="garage"]').options.length,3);assert.equal(garageBase.config.garage,'None');
for(const kind of ['Attached','Detached']){
 change('[data-field="garage"]',kind);const state=snapshot();assert.equal(state.config.garage,kind);assert.equal(state.model.garage.area,576);assert.ok(state.model.total>garageBase.model.total);assert.equal(state.model.area,garageBase.model.area);assert.equal(state.model.items.find(i=>i.id==='garage-overheaddoor').qty,1);
 safariTap('[data-view="plan"]');assert.ok(q('svg .garage-plan').textContent.includes('24 × 24'));const vb=q('svg').getAttribute('viewBox').split(' ').map(Number);assert.ok(vb[0]<=state.model.siteBounds.minX&&vb[1]<=state.model.siteBounds.minZ);assert.ok(vb[0]+vb[2]>=state.model.siteBounds.maxX);
 safariTap('[data-view="walk"]');assert.ok(q('[data-field="room"] option[value="G-GARAGE"]'));change('[data-field="room"]','G-GARAGE');assert.equal(lastScene.jump,'G-GARAGE');
 safariTap('[data-view="framing"]');assert.ok(q('[data-field="frameOpening"] option[value="G-OVERHEAD"]'));change('[data-field="frameOpening"]','G-OVERHEAD');assert.equal(lastScene.frameOpening,'G-OVERHEAD');
 safariTap('[data-view="exterior"]');assert.equal(lastScene.view,'exterior');safariTap('[data-view="walk"]');assert.equal(lastScene.view,'walk');
}
change('[data-field="garage"]','None');assert.equal(snapshot().model.total,garageBase.model.total);assert.equal(snapshot().model.garage,null);assert.deepEqual(errors,[]);
console.log('PASS: garage selection, 576 sq ft separate area, live materials/pricing, plan bounds, touch views, garage walkthrough and framing opening inspection.');

// Use a known valid seed for the touch-control fixture; native tests cover plan variation.
const modeTap=selector=>{const original=Math.random;Math.random=()=>.000001;try{safariTap(selector)}finally{Math.random=original}};
// Build tiers, compact two-story generation, blank-slate edits and project costs.
click('[data-tab="layout"]');change('[data-field="stories"]',2);change('[data-field="bedrooms"]',3);
q('#width').value='24';q('#depth').value='32';click('[data-action="dimensions"]');
assert.equal(snapshot().config.width,24);assert.equal(snapshot().config.depth,32);
modeTap('[data-action="generate-affordable"]');let affordable=snapshot();
assert.equal(affordable.config.designMode,'Affordable');assert.equal(affordable.model.counts.bedrooms,3);
assert.equal(affordable.config.wallHeight,8.09375);assert.equal(affordable.config.trimSize,'Normal');assert.equal(affordable.config.wallpaper,'None');
assert.equal(affordable.config.width,24);assert.equal(affordable.config.depth,32);
assert.equal(affordable.model.projectCostTotal,32000);assert.equal(affordable.model.projectTotal,Math.round((affordable.model.total+32000)*100)/100);
assert.ok(q('[data-action="generate-affordable"]').getAttribute('aria-pressed')==='true');
for(const level of affordable.model.levels)for(const room of level.rooms.filter(r=>r.type==='bath')){
 const kinds=level.furniture.filter(f=>f.roomId===room.id).map(f=>f.kind);assert.ok(kinds.includes('toilet')&&kinds.includes('vanity'));if(!room.name.includes('Powder'))assert.ok(kinds.includes('shower'));
}
modeTap('[data-action="generate-premium"]');let premium=snapshot();
assert.equal(premium.config.designMode,'Premium','Premium generation failed: '+q('#message').textContent);assert.equal(premium.config.trimSize,'Oversized');assert.notEqual(premium.config.wallpaper,'None');
assert.equal(premium.config.width,24);assert.equal(premium.config.depth,32);assert.ok(premium.model.projectTotal>affordable.model.projectTotal);
const premiumSeed=premium.config.seed;modeTap('[data-action="generate"]');assert.equal(snapshot().config.designMode,'Premium');
assert.ok(q('[data-action="generate-premium"]').getAttribute('aria-pressed')==='true');
// Allowances update without taxing/wasting them; negative values are rejected.
const beforeAllowances=snapshot();change('[data-field="laborCost"]',15000);change('[data-field="landCost"]',20000);change('[data-field="permitCost"]',9000);change('[data-field="surveyCost"]',3500);
let budget=snapshot();assert.equal(budget.model.total,beforeAllowances.model.total);assert.equal(budget.model.projectCostTotal,47500);
assert.equal(budget.model.projectTotal,Math.round((budget.model.total+47500)*100)/100);
change('[data-field="laborCost"]',-1);assert.match(q('#message').textContent,/nonnegative/);assert.equal(snapshot().config.laborCost,15000);
// Blank mode creates an actual empty shell and remains empty on dimension changes.
safariTap('[data-action="blank-slate"]');let empty=snapshot();if(empty.config.shape!=='Rectangle'||empty.config.garage!=='None'){const tab=document.querySelector('[data-tab][aria-pressed="true"]')?.dataset.tab;click('[data-tab="layout"]');change('[data-field="shape"]','Rectangle');change('[data-field="garage"]','None');if(tab)click(`[data-tab="${tab}"]`);empty=snapshot();}assert.equal(empty.config.designMode,'Blank slate');assert.equal(empty.model.allFurniture.length,0);assert.equal(empty.model.allWalls.length,8);assert.equal(empty.model.allOpenings.length,0);assert.equal(empty.model.stair,null);assert.equal(empty.model.area,24*32*2);assert.equal(lastScene.view,'dollhouse');
assert.equal(document.querySelector('[data-field="layout"]'),null);
q('#width').value='28';q('#depth').value='32';safariTap('[data-action="dimensions"]');empty=snapshot();assert.equal(empty.model.area,28*32*2);assert.equal(empty.model.allFurniture.length,0);
click('[data-view="dollhouse"]');pick({kind:'floor',x:12,z:12});change('#edit-axis','x');change('#edit-length',8);click('[data-action="edit-add-wall"]');
let custom=snapshot();assert.equal(custom.config.addedWalls.length,1);assert.equal(custom.model.partitionLength,8);assert.ok(custom.model.total>empty.model.total);
pick({kind:'floor',x:5,z:5});change('#edit-item','bed');click('[data-action="edit-insert-item"]');custom=snapshot();assert.equal(custom.config.placedFurniture.length,1);assert.ok(custom.model.furniture.some(f=>f.kind==='bed'));
const customWallId=custom.config.addedWalls[0].id;pick({kind:'wall',wallId:customWallId,at:4});change('#edit-opening-kind','door');change('#edit-at',2);click('[data-action="edit-insert-opening"]');
custom=snapshot();assert.ok(custom.model.walls.find(w=>w.id===customWallId).openings.some(o=>o.kind==='door'));assert.ok(custom.model.frameMembers.some(f=>f.wallId===customWallId&&f.role==='Flat door header'));
click('[data-floor="1"]');pick({kind:'floor',x:12,z:12});change('#edit-length',8);click('[data-action="edit-add-wall"]');custom=snapshot();assert.equal(custom.config.addedWalls.length,2);assert.ok(custom.config.addedWalls[1].id.includes('-L2'));assert.equal(custom.model.allFurniture.length,1);
click('[data-action="undo"]');assert.equal(snapshot().config.addedWalls.length,1);
safariTap('[data-action="generate"]');empty=snapshot();assert.equal(empty.config.designMode,'Blank slate');assert.equal(empty.model.allFurniture.length,0);assert.equal(empty.config.addedWalls.length,0);assert.equal(empty.model.projectCostTotal,47500);
assert.deepEqual(errors,[]);assert.deepEqual(JSON.parse(app.defaults()),startup.config);
console.log('PASS: 24-foot two-story tiers, touch mode buttons, complete compact bathrooms, editable untaxed project allowances, empty shell on both floors, custom walls/doors/items, undo and mode-aware generation.');

// Reported regression: furnishing one blank floor, then enabling a second story.
click('[data-tab="layout"]');change('[data-field="stories"]',1);
q('#width').value='32';q('#depth').value='32';click('[data-action="dimensions"]');click('[data-action="blank-slate"]');
click('#viewbar [data-action="edit-draw"]');assert.equal(q('#viewbar [data-action="edit-draw"]').getAttribute('aria-pressed'),'true');
assert.ok(q('.wall-draw-guide'));assert.equal(document.querySelector('.direction-guide'),null);
app.draw_wall(JSON.stringify({x1:8,z1:12,x2:24,z2:13}));let main=snapshot();
assert.equal(main.config.addedWalls.length,1);const mainWallId=main.config.addedWalls[0].id;
assert.deepEqual([main.model.walls.find(w=>w.id===mainWallId).x,main.model.walls.find(w=>w.id===mainWallId).z,main.model.walls.find(w=>w.id===mainWallId).length],[8,12,16]);
app.draw_wall(JSON.stringify({x1:12,z1:12,x2:28,z2:12}));assert.match(q('#message').textContent,/already occupies/);assert.equal(snapshot().config.addedWalls.length,1);
click('#viewbar [data-action="edit-draw"]');pick({kind:'wall',wallId:mainWallId,at:8});
const key=(key,options={})=>document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...options}));
key('ArrowUp');assert.equal(snapshot().model.walls.find(w=>w.id===mainWallId).z,14);
key('ArrowRight',{shiftKey:true});assert.equal(snapshot().model.walls.find(w=>w.id===mainWallId).length,18);
click('[data-action="edit-edge-start"]');key('ArrowLeft',{shiftKey:true});assert.equal(snapshot().model.walls.find(w=>w.id===mainWallId).length,20);
key('z',{ctrlKey:true});assert.equal(snapshot().model.walls.find(w=>w.id===mainWallId).length,18);
key('z',{ctrlKey:true,shiftKey:true});assert.equal(snapshot().model.walls.find(w=>w.id===mainWallId).length,20);
pick({kind:'wall',wallId:mainWallId,at:8});change('#edit-opening-kind','door');change('#edit-at',8);click('[data-action="edit-insert-opening"]');
const doorBefore=snapshot().model.walls.find(w=>w.id===mainWallId).openings[0];pick({kind:'opening',id:doorBefore.id,wallId:mainWallId,at:doorBefore.at});key('ArrowRight');assert.equal(snapshot().model.walls.find(w=>w.id===mainWallId).openings[0].at,doorBefore.at+1);assert.equal(snapshot().model.walls.find(w=>w.id===mainWallId).x,6);
pick({kind:'floor',x:6,z:5});change('#edit-item','bed');click('[data-action="edit-insert-item"]');
pick({kind:'floor',x:24,z:5});change('#edit-item','plant');click('[data-action="edit-insert-item"]');main=snapshot();assert.equal(main.config.placedFurniture.length,2);
const mainFurniture=structuredClone(main.model.furniture),mainWalls=structuredClone(main.model.walls);
click('[data-tab="layout"]');change('[data-field="stories"]',2);let both=snapshot();
assert.equal(both.config.addedWalls.length,1);assert.equal(both.config.placedFurniture.length,2);
assert.deepEqual(both.model.levels[0].walls,mainWalls);assert.deepEqual(both.model.levels[0].furniture,mainFurniture);
assert.ok(both.model.levels[0].frameMembers.some(f=>f.wallId===mainWallId&&f.role==='Flat door header'));
const totalBeforeFloorSwitch=both.model.projectTotal;
for(let i=0;i<3;i++){safariTap('[data-floor="1"]');assert.equal(snapshot().model.projectTotal,totalBeforeFloorSwitch);assert.equal(snapshot().model.furniture.length,0);safariTap('[data-floor="0"]');assert.deepEqual(snapshot().model.furniture,mainFurniture);assert.deepEqual(snapshot().model.walls,mainWalls);}
safariTap('[data-floor="1"]');click('#viewbar [data-action="edit-draw"]');app.draw_wall(JSON.stringify({x1:4,z1:20,x2:24,z2:20}));click('#viewbar [data-action="edit-draw"]');
pick({kind:'floor',x:6,z:6});change('#edit-item','bed');click('[data-action="edit-insert-item"]');both=snapshot();
const upstairsWallId=both.config.addedWalls.find(w=>w.id.includes('-L2')).id,upstairsItemId=both.config.placedFurniture.find(f=>f.id.includes('-L2')).id;
assert.ok(both.model.walls.some(w=>w.id===upstairsWallId));assert.ok(both.model.furniture.some(f=>f.id===upstairsItemId));
safariTap('[data-floor="0"]');assert.deepEqual(snapshot().model.walls,mainWalls);assert.deepEqual(snapshot().model.furniture,mainFurniture);
click('#viewbar [data-action="undo"]');both=snapshot();assert.equal(both.config.activeFloor,0);assert.deepEqual(both.model.furniture,mainFurniture);assert.ok(!both.config.placedFurniture.some(f=>f.id===upstairsItemId));assert.ok(both.config.addedWalls.some(w=>w.id===upstairsWallId));
click('#viewbar [data-action="redo"]');assert.equal(snapshot().config.activeFloor,0);assert.ok(snapshot().model.levels[1].furniture.some(f=>f.id===upstairsItemId));
// Changing story count hides or restores upper edits; applying the same dimensions is harmless.
click('[data-tab="layout"]');change('[data-field="stories"]',1);assert.deepEqual(snapshot().model.furniture,mainFurniture);assert.ok(snapshot().config.placedFurniture.some(f=>f.id===upstairsItemId));
change('[data-field="stories"]',2);assert.ok(snapshot().model.levels[1].furniture.some(f=>f.id===upstairsItemId));click('[data-action="dimensions"]');assert.deepEqual(snapshot().model.levels[0].walls,mainWalls);
q('#width').value='24';q('#depth').value='12';click('[data-action="dimensions"]');assert.match(q('#message').textContent,/cut off custom/);assert.equal(snapshot().config.width,32);
q('#width').value='32';q('#depth').value='32';click('[data-action="dimensions"]');
// New style defaults in blank mode keep geometry and decorations.
change('[data-field="homeStyle"]','Georgian');both=snapshot();assert.equal(both.config.wallpaper,'Sunlit damask');assert.equal(both.config.bedroomWallpaper,'Ivory botanical');assert.deepEqual(both.model.levels[0].walls,mainWalls);assert.deepEqual(both.model.levels[0].furniture,mainFurniture);
click('[data-tab="finishes"]');for(const name of ['Ivory botanical','Sunlit damask','Sky blue toile']){change('[data-field="wallpaper"]',name);const tile=q('[data-action="wallpaper-pick"][data-group="wallpaper"][aria-pressed="true"]');assert.equal(tile.dataset.value,name);assert.match(tile.querySelector('img').getAttribute('src'),/\/materials\/wallpaper\/thumbs\//);assert.ok(snapshot().model.wallpaperGeneralArea>0);}
// Every wallpaper has a preview tile; choosing one applies it to that group only and keeps the gallery open.
assert.equal(document.querySelectorAll('[data-action="wallpaper-pick"][data-group="bedroomWallpaper"]').length,JSON.parse(fs.readFileSync('rust-app/data/catalog.json','utf8')).wallpapers.length+1);
q('[data-section="wallpaper-bedroomWallpaper"]').open=true;const before=lastScene.config.wallpaper;click('[data-action="wallpaper-pick"][data-group="bedroomWallpaper"][data-value="Midnight damask"]');assert.equal(lastScene.config.bedroomWallpaper,'Midnight damask');assert.equal(lastScene.config.wallpaper,before);assert.equal(q('[data-section="wallpaper-bedroomWallpaper"]').open,true);
// Cladding: each type offers styles and color chips, and both reach the 3D view.
change('[data-field="siding"]','Board & batten siding');assert.deepEqual([...q('[data-field="claddingVariant"]').options].map(o=>o.value),['12 in boards · 2 in battens','16 in boards · 3 in battens','Reverse batten']);change('[data-field="claddingVariant"]','Reverse batten');assert.equal(lastScene.config.claddingVariant,'Reverse batten');
click('[data-action="siding-color"][data-value="#566878"]');assert.equal(lastScene.config.colors.siding,'#566878');assert.equal(q('[data-action="siding-color"][data-value="#566878"]').getAttribute('aria-pressed'),'true');
change('[data-field="siding"]','Cedar shingles');assert.equal(lastScene.config.claddingVariant,'');assert.ok([...q('[data-field="claddingVariant"]').options].some(o=>o.value==='Fish-scale'));
const beforeInputUndo=snapshot().config.wallpaper;q('[data-color="walls"]').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}));assert.equal(snapshot().config.wallpaper,beforeInputUndo);
assert.deepEqual(errors,[]);assert.deepEqual(JSON.parse(app.defaults()),startup.config);
console.log('PASS: viewer Undo/Redo and shortcuts, 2-ft wall drawing/moving/edge resizing, duplicate rejection, blank main-floor walls/door/furniture retained when adding a story, repeated floor changes, upstairs undo without floor jumps, safe dimensions, style defaults and three bright wallpapers.');

// Historic profile controls operate on actual Rust schedules, keeping their disclosure open.
click('[data-tab="finishes"]');q('.millwork-controls').open=true;q('.millwork-library').open=true;
assert.equal(document.querySelectorAll('.millwork-gallery figure').length,100);
const beforeProfiles=snapshot().model;change('[data-trim-role="crown"]','rockwell-8023');let selectedProfile=snapshot();assert.equal(selectedProfile.config.trimOverrides.crown,'rockwell-8023');assert.equal(selectedProfile.model.trimPackage.parts.crown.catalogNumber,8023);assert.ok(selectedProfile.model.trimPieces.some(p=>p.profileId==='rockwell-8023'));
assert.equal(q('.millwork-controls').open,true);assert.equal(q('.millwork-library').open,true);assert.notEqual(selectedProfile.model.items.find(i=>i.id==='crown').total,beforeProfiles.items.find(i=>i.id==='crown').total);
change('[data-trim-role="crown"]','none');assert.equal(snapshot().model.trimPieces.some(p=>p.role==='crown'),false);assert.equal(snapshot().model.items.find(i=>i.id==='crown').rawNet,0);
change('[data-trim-role="cap"]','rockwell-8414');assert.ok(snapshot().model.trimPieces.some(p=>p.role==='cap'));change('[data-trim-role="shoe"]','rockwell-8416');assert.ok(snapshot().model.trimPieces.some(p=>p.role==='shoe'));
change('[data-field="trimPackage"]','Victorian ornate');assert.deepEqual(snapshot().config.trimOverrides,{});
click('[data-tab="layout"]');change('[data-field="frontBearing"]',90);assert.equal(snapshot().config.frontBearing,90);
console.log('PASS: 100 original source sections, working role selectors, live trim costs and optional cap/shoe geometry, retained disclosures and numeric compass bearing.');

// Reported wall-drag / accidental window and placement regressions.
click('[data-tab="layout"]');change('[data-field="stories"]',1);q('#width').value='32';q('#depth').value='32';click('[data-action="dimensions"]');click('[data-action="blank-slate"]');
click('#viewbar [data-action="edit-draw"]');app.draw_wall(JSON.stringify({x1:8,z1:12,x2:20,z2:12}));click('#viewbar [data-action="edit-draw"]');let revised=snapshot();const dragWallId=revised.config.addedWalls[0].id;
pick({kind:'wall',wallId:dragWallId,at:6});assert.equal(q('.context-opening').hasAttribute('open'),false,'Opening insertion requires opening its own controls');
app.resize_wall(JSON.stringify({wallId:dragWallId,edge:'end',coordinate:24}));const compatibilityClick=new dom.window.MouseEvent('click',{bubbles:true,cancelable:true,detail:1,clientX:50,clientY:50});q('[data-action="edit-insert-opening"]').dispatchEvent(compatibilityClick);assert.equal(compatibilityClick.defaultPrevented,true);assert.equal(snapshot().model.walls.find(w=>w.id===dragWallId).openings.length,0,'A wall resize and its synthetic click cannot add a window');
pick({kind:'wall',wallId:dragWallId,at:6});q('.context-opening').setAttribute('open','');change('#edit-at',4);safariTap('[data-action="edit-insert-opening"]');revised=snapshot();assert.equal(revised.model.walls.find(w=>w.id===dragWallId).openings.length,1,'A fresh deliberate touch can insert an opening');
app.resize_wall(JSON.stringify({wallId:dragWallId,operation:'move',x:10,z:14}));let movedWall=snapshot().model.walls.find(w=>w.id===dragWallId);assert.equal(movedWall.x,10);assert.equal(movedWall.z,14);assert.equal(movedWall.openings.length,1);
for(let i=0;i<4;i++)click('[data-action="edit-wall-right"]');movedWall=snapshot().model.walls.find(w=>w.id===dragWallId);assert.equal(movedWall.axis,'x');assert.equal(movedWall.x,10);assert.equal(movedWall.z,14);assert.equal(movedWall.openings.length,1);assert.equal(snapshot().model.frameMembers.filter(f=>f.wallId===dragWallId&&f.role==='Flat door header').length,1);
click('[data-action="edit-cancel"]');click('[data-view="dollhouse"]');change('#place-kind','bench');change('#place-angle',45);click('#viewbar [data-action="edit-place"]');
const preview=JSON.parse(app.preview_placement(JSON.stringify({kind:'floor',x:.1,z:.1})));assert.equal(preview.placementError,null);assert.equal(preview.snapped,true);assert.ok(Math.abs(preview.placement.w-5.6/Math.sqrt(2))<1e-8);const beforePlace=snapshot().model,beforeBuild=beforePlace.total,beforeFurnish=beforePlace.furnishingsTotal;app.pick_scene(JSON.stringify({...preview,commit:true}));revised=snapshot();assert.equal(revised.config.placedFurniture.length,1);let bench=revised.model.furniture[0];assert.equal(bench.kind,'bench');assert.equal(bench.x,preview.x);assert.equal(bench.z,preview.z);assert.equal(revised.model.items.find(i=>i.id==='furniture-bench').qty,1);assert.ok(revised.model.furnishingsTotal>beforeFurnish,'A placed bench is priced as model-home furnishing');assert.equal(revised.model.total,beforeBuild,'Furniture is not build cost');
click('#viewbar [data-action="edit-place"]');pick({kind:'furniture',id:bench.id});key('r');bench=snapshot().model.furniture[0];assert.ok(Math.abs(bench.rotation-60*Math.PI/180)<1e-8);const bx=bench.x;key('ArrowRight');assert.equal(snapshot().model.furniture[0].x,bx+.25);key('ArrowRight',{shiftKey:true});assert.equal(snapshot().model.furniture[0].x,bx+1.25);change('#edit-rotation',360);click('[data-action="edit-save-item"]');assert.equal(snapshot().model.furniture[0].rotation,0);assert.deepEqual(errors,[]);
console.log('PASS: wall resizing rejects retargeted compatibility clicks, deliberate window insertion still works, wall moves and four rotations preserve one opening/all headers, one-click 45-degree snapped placement updates cost, 15-degree rotation, 3-inch/1-foot arrows and 360-degree normalization.');

// Blank-slate stairs, nonblocking span warnings, selected garage sides and camera buttons.
document.querySelector('[data-action="edit-cancel"]')?.click();click('[data-action="blank-slate"]');click('[data-tab="layout"]');change('[data-field="stories"]',2);q('#width').value='32';q('#depth').value='32';click('[data-action="dimensions"]');
safariTap('#viewbar [data-action="edit-stairs"]');assert.equal(lastScene.view,'dollhouse');const stairPreview=JSON.parse(app.preview_placement(JSON.stringify({kind:'floor',x:16,z:16})));assert.equal(stairPreview.placement.kind,'stairs');assert.equal(stairPreview.placementError,null);app.pick_scene(JSON.stringify({...stairPreview,commit:true}));let stairDesign=snapshot();assert.ok(stairDesign.model.stair);assert.equal(stairDesign.model.stair.opening.area,96);assert.equal(stairDesign.model.levels[1].stair.itemId,stairDesign.model.stair.itemId);assert.ok(stairDesign.model.items.find(i=>i.id==='stairtreads').qty>0);
assert.ok(!q('#viewbar [data-action="edit-place"]').textContent.includes("Placing"),"Stair placement ends after one insertion");click('[data-floor="1"]');assert.ok(snapshot().model.stair);click('[data-floor="0"]');const stairId=snapshot().model.stair.itemId;pick({kind:'furniture',id:stairId});click('[data-action="edit-rotate-quarter"]');assert.ok(Math.abs(snapshot().model.stair.rotation-Math.PI/2)<1e-8);click('[data-action="edit-delete"]');assert.equal(snapshot().model.stair,null);click('#viewbar [data-action="undo"]');assert.ok(snapshot().model.stair);
document.querySelector('[data-action="edit-cancel"]')?.click();click('[data-tab="layout"]');change('[data-field="garage"]','Attached');change('[data-field="garageSide"]','Left');assert.ok(snapshot().model.garage.x<0);change('[data-field="garageSide"]','Right');assert.ok(snapshot().model.garage.x>=32);change('[data-field="garage"]','None');
click('[data-tab="build"]');change('[data-field="floorLiveLoad"]',80);const oversizedLoad=snapshot();assert.equal(oversizedLoad.model.structural.floor.candidate,null);assert.ok(q('#estimate .structural-status').textContent.includes('No joist candidate'));assert.ok(!q('#message').classList.contains('hidden'));for(const fn of [...noticeTimers.values()])fn();assert.ok(q('#message').classList.contains('hidden'));assert.ok(q('#estimate .structural-status').textContent.includes('No joist candidate'));
assert.equal(document.querySelector('.interior-navigation'),null);assert.equal(document.querySelector('.walk-pad'),null);assert.deepEqual(errors,[]);console.log('PASS: touch stair placement, rotation/delete/undo, garage sides and nonblocking span warnings; viewer navigation buttons removed.');

// Existing upper-floor work cannot prevent first-floor stairs; Undo restores it.
document.querySelector('[data-action="edit-cancel"]')?.click();click('[data-action="blank-slate"]');click('[data-tab="layout"]');change('[data-field="stories"]',2);q('#width').value='32';q('#depth').value='32';click('[data-action="dimensions"]');
click('[data-floor="1"]');click('[data-view="dollhouse"]');click('#viewbar [data-action="edit-draw"]');app.draw_wall(JSON.stringify({x1:4,z1:16,x2:28,z2:16}));click('#viewbar [data-action="edit-draw"]');
click('[data-view="dollhouse"]');change('#place-kind','bed');change('#place-angle',0);click('#viewbar [data-action="edit-place"]');const aboveBed=JSON.parse(app.preview_placement(JSON.stringify({kind:'floor',x:16,z:22})));assert.equal(aboveBed.placementError,null);app.pick_scene(JSON.stringify({...aboveBed,commit:true}));click('#viewbar [data-action="edit-place"]');
const upperBeforeStairs=snapshot(),bedAboveId=upperBeforeStairs.model.furniture.find(f=>f.kind==='bed').id,wallAboveId=upperBeforeStairs.model.walls.find(w=>!w.exterior).id;
safariTap('#viewbar [data-action="edit-stairs"]');assert.equal(snapshot().config.activeFloor,0);const automaticStair=JSON.parse(app.preview_placement(JSON.stringify({kind:'floor',x:16,z:16})));assert.equal(automaticStair.placementError,null,'Upper walls/items must not turn the first-floor stair preview red');app.pick_scene(JSON.stringify({...automaticStair,commit:true}));
let autoStairState=snapshot();assert.ok(autoStairState.model.stair);assert.ok(autoStairState.model.levels[1].walls.some(w=>w.id.startsWith(wallAboveId+'-STAIR-')));assert.ok(!autoStairState.model.levels[1].furniture.some(f=>f.id===bedAboveId));assert.equal(autoStairState.config.addedWalls.length,1,'Original upper work remains available to Undo');
click('#viewbar [data-action="undo"]');assert.equal(snapshot().model.stair,null);assert.deepEqual(snapshot().model.levels[1].walls,upperBeforeStairs.model.walls);assert.ok(snapshot().model.levels[1].furniture.some(f=>f.id===bedAboveId));click('#viewbar [data-action="redo"]');assert.ok(snapshot().model.stair);
assert.equal(document.querySelector('[data-action^="camera-"]'),null);click('[data-view="exterior"]');assert.equal(document.querySelector('[data-action^="camera-"]'),null);assert.deepEqual(errors,[]);
console.log('PASS: first-floor stairs clear upper work, preserve Undo/Redo and update framing; exterior and interior viewer controls remain uncluttered.');

// New exterior modules and category budgets exercise the compiled interface.
click('[data-tab="layout"]');modeTap('[data-action="generate-premium"]');change('[data-field="homeStyle"]','Colonial');
q('[data-section="exterior"]').open=true;change('[data-field="dormerStyle"]','Gable');assert.equal(q('[data-section="exterior"]').open,true);
change('[data-field="dormerDepth"]',16);change('[data-field="dormerCount"]',2);let additions=snapshot();assert.equal(additions.model.dormers.length,2);assert.equal(additions.model.levels[1].dormers.length,2);
change('[data-field="roofEdgeStyle"]','Dentil cornice');change('[data-field="gableAccent"]','Board and batten');change('[data-field="finials"]','Roof spire');additions=snapshot();assert.equal(additions.model.roofAccents.style,'Dentil cornice');assert.ok(additions.model.roofAccents.finials.length>0);
change('[data-field="rearOutdoor"]','Deck');change('[data-field="rearWidth"]',12);change('[data-field="rearDepth"]',6);additions=snapshot();assert.equal(additions.model.rearOutdoor.area,72);assert.equal(additions.model.rearOutdoor.roofs.length,0);
click('[data-tab="finishes"]');change('[data-field="windowStyle"]','Casement');change('[data-field="windowSize"]','Large');additions=snapshot();assert.equal(additions.model.windowType,'Casement');assert.equal(additions.config.windowSize,'Large');
const category=additions.model.categoryBudgets.find(g=>g.name==='Roof features'),budgetInput=q('[data-budget="Roof features"]'),calculated=category.calculated;const group=q('[data-cost-group="Roof features"]');group.open=true;
change('[data-budget="Roof features"]',1000);let edited=snapshot();assert.equal(edited.config.categoryBudgets['Roof features'],1000);assert.equal(edited.model.categoryBudgets.find(g=>g.name==='Roof features').calculated,calculated);assert.equal(q('[data-cost-group="Roof features"]').open,true);
assert.equal(edited.model.budgetOverrideCount,1);assert.equal(edited.model.projectTotal,Math.round((edited.model.materialsBudgetTotal+edited.model.projectCostTotal)*100)/100);assert.ok(document.querySelector('.project-cost-total'));
click('[data-action="budget-reset"][data-value="Roof features"]');edited=snapshot();assert.equal(edited.model.budgetOverrideCount,0);assert.equal(edited.model.materialsBudgetTotal,edited.model.total);
safariTap('[data-action="pricing-mode"][data-value="Wholesale estimate"]');edited=snapshot();assert.equal(edited.config.pricingMode,'Wholesale estimate');assert.ok(edited.model.volumeSavings>0);change('[data-discount="Roof features"]',20);edited=snapshot();assert.equal(edited.config.bulkDiscounts['Roof features'],20);safariTap('[data-action="pricing-mode"][data-value="Retail"]');edited=snapshot();assert.equal(edited.model.volumeSavings,0);
assert.equal(document.querySelector('[data-field="facing"]'),null);assert.deepEqual(errors,[]);console.log('PASS: modular dormers, roof molding/panels/spires, rear deck sizes, window types/sizes, preserved dropdowns, category budget/reset, separate cost totals and retail/bulk discounts.');
