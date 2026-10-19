import './style.css';
import {bindTextureUploads} from './texture-upload';
import {bindTheme} from './theme';
const theme=bindTheme();
import {bindStudioAccessibility} from './studio-accessibility';
import {renderHouse} from './scene';
import {layoutEditor} from './context-menu';
import {createSceneController} from './scene-controller';
import {releaseRenderer} from './graphics';
import {initAccounts,prepareSplash,saveBuild,openBuilds} from './account';
let unbindTextures:undefined|(()=>void);
let unbindAccessibility:undefined|(()=>void);
let reportBusy=false;
let app:any,stage:ReturnType<typeof createSceneController>|undefined;
let zipController:AbortController|undefined;
let engineWorker:Worker|undefined,workerBroken=false;const engineReplies=new Map<number,ReturnType<typeof setTimeout>>();
(globalThis as any).ufBridge={
 layoutEditor,
 navigateScene(direction:string){stage?.navigate(direction);},
 previewPlacement(target:any){return app?JSON.parse(app.preview_placement(JSON.stringify(target))):null;},
 setEditMode(raw:string){stage?.setMode(JSON.parse(raw));},
 resizeWall(change:any){app?.resize_wall(JSON.stringify(change));},
 drawWall(change:any){app?.draw_wall(JSON.stringify(change));},
 selectScene(raw:string){stage?.select(JSON.parse(raw));},
 pickScene(target:any){app?.pick_scene(JSON.stringify(target));},
 assetStatus(message:string){app?.show_status(message);},
 async openProcess(raw:string,design:string,live=true){const shade=document.createElement('div');shade.className='splash process-shade';shade.setAttribute('role','status');shade.innerHTML='<img src="/brand/universal-frames-loading.webp" alt="" width="861" height="603"><div class="splash-bar" aria-hidden="true"><span></span></div><p>Preparing your build…</p>';document.body.appendChild(shade);(globalThis as any).__ufPauseScene=true;try{const {exportHouseForProcess}=await import('./process-export');await Promise.race([exportHouseForProcess(JSON.parse(raw),design,live?stage?.liveScene('exterior'):undefined),new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),30000))]);}catch(e){console.warn('Studio model was not handed to the simulator; it will build its own panels.',e);}location.href='process/';},
 unitsChanged(metric:boolean){(globalThis as any).ufUnits?.set(metric);scopeNote();},
 saveBuild(design:string,summary:string){saveBuild(design,summary);},
 openBuilds(){openBuilds();},
 openPhotoHome(){if(app)import('./photo-home').then(m=>m.openPhotoHome(app)).catch(e=>{console.error(e);app?.show_status('Model from photos could not open. Please try again.');});},
 requestModel(config:string,seq:number){
  // The worker needs module workers; without them the engine builds on the main thread as before.
  if(typeof Worker==='undefined'||workerBroken)return false;
  // A reply only counts while its request is still waiting; once it times out the engine builds here instead.
  try{if(!engineWorker){engineWorker=new Worker(new URL('./engine-worker.ts',import.meta.url),{type:'module'});engineWorker.onmessage=(e:MessageEvent)=>{const {seq,model}=e.data;if(!engineReplies.has(seq))return;clearTimeout(engineReplies.get(seq));engineReplies.delete(seq);app?.apply_model(seq,typeof model==='string'?model:'');};engineWorker.onerror=()=>{workerBroken=true;engineWorker?.terminate();engineWorker=undefined;const waiting=[...engineReplies];engineReplies.clear();for(const [seq,timer] of waiting){clearTimeout(timer);app?.apply_model(seq,'');}};}}catch{workerBroken=true;return false;}
  const timer=setTimeout(()=>{engineReplies.delete(seq);app?.apply_model(seq,'');},5000);
  engineReplies.set(seq,timer);engineWorker.postMessage({seq,config,module:wasmModule,wasm:'/pkg/universal_frames_bg.wasm?v='+engineRevision});return true;
 },
 renderScene(raw:string){stage??=createSceneController({host:document.getElementById('scene')!,render:renderHouse,onError(error){console.error(error);app?.show_status('The 3D view could not load. Switch views or use Reset view to retry.');}});stage.update(JSON.parse(raw));},
 async lookupZip(zip:string){if(!/^\d{5}$/.test(zip)){app?.show_status('Enter a five-digit US ZIP code.');return;}zipController?.abort();const controller=new AbortController();zipController=controller;let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;controller.abort();},12000);try{const r=await fetch('https://api.zippopotam.us/us/'+encodeURIComponent(zip),{signal:controller.signal});if(!r.ok)throw Error('ZIP not found');const j=await r.json() as {places?:{latitude:string;longitude:string}[]};const p=j.places?.[0],lat=Number(p?.latitude),lon=Number(p?.longitude);if(!p||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('ZIP not found');app.apply_location(zip,lat,lon);}catch(e:any){if(e.name!=='AbortError'||timedOut&&zipController===controller)app.show_status('ZIP lookup is unavailable or the ZIP was not found. Choose state and county in Build.');}finally{clearTimeout(timeout);}},
 download(data:string,mime:string,name:string){const url=URL.createObjectURL(new Blob([data],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.rel='noopener';// A detached anchor, clicked on the next tick: clicking inside the engine's own click handler re-entered it.
 setTimeout(()=>a.click());setTimeout(()=>URL.revokeObjectURL(url),60000);app.show_status('Design JSON downloaded');},
 async report(raw:string,kind:string){if(reportBusy){app?.show_status('Your report is being prepared…');return;}reportBusy=true;try{const {config,model,project}=JSON.parse(raw);const r=await import('./report');r.setReportModel(model);if(kind==='pdf')await r.exportPDF(config,project);else if(kind==='framing')r.exportFraming(config);else r.exportCSV(config);app.show_status('Report downloaded');}catch(e){console.error(e);app.show_status('Report download failed. Please try again.');}finally{reportBusy=false;}}
};
// Back from the simulator (page restored from the back/forward cache): lift the hand-off screen and resume the 3D view.
// The heading's scope line names the units in use.
function scopeNote(){const n=document.getElementById('scope-note');if(n)n.textContent='For US projects · 2021 IRC & IECC basis · prices in US dollars · '+((globalThis as any).ufUnits?.metric()?'metric measurements (converted)':'imperial units');}
// Phones: the sticky viewer tucks its toolbar above the screen edge (CSS uses --viewbar-h).
{const bar=()=>document.getElementById('viewbar');const sync=()=>{const h=bar()?.getBoundingClientRect().height??0;document.documentElement.style.setProperty('--viewbar-h',h+'px');};if('ResizeObserver' in window){const ro=new ResizeObserver(sync);const watch=()=>{const b=bar();if(b){ro.observe(b);sync();}else requestAnimationFrame(watch);};watch();}}
window.addEventListener('pageshow',event=>{if(!event.persisted)return;document.querySelectorAll('.process-shade').forEach(n=>n.remove());(globalThis as any).__ufPauseScene=false;window.dispatchEvent(new KeyboardEvent('keydown'));});
window.addEventListener('pagehide',event=>{if(event.persisted)return;unbindAccessibility?.();unbindTextures?.();theme.dispose();zipController?.abort();stage?.dispose();const host=document.getElementById('scene');if(host)releaseRenderer(host);});
declare const __UF_ENGINE_REVISION__:string;
const engineRevision=__UF_ENGINE_REVISION__;
const wasmModule='/pkg/universal_frames.js?v='+engineRevision;
const hideSplash=()=>{const splash=document.getElementById('splash');if(!splash)return;splash.classList.add('done');setTimeout(()=>splash.remove(),600);};
prepareSplash();
try{app=await import(/* @vite-ignore */wasmModule);await app.default({module_or_path:'/pkg/universal_frames_bg.wasm?v='+engineRevision});app.start();initAccounts(app,()=>requestAnimationFrame(()=>requestAnimationFrame(hideSplash))).catch(()=>hideSplash());scopeNote();unbindTextures=bindTextureUploads(()=>app);theme.refresh();unbindAccessibility=bindStudioAccessibility();}catch(e){console.error(e);hideSplash();document.getElementById('app')!.innerHTML='<div class="load-error"><div class="loading-brand"><img class="brand-icon" src="/brand/universal-frames-icon.png" alt="" width="64" height="64"><img class="brand-wordmark" src="/brand/universal-frame-wordmark.webp" alt="Universal Frame" width="246" height="82"></div><p>The design engine could not load. Please refresh the page to retry.</p><button id="retry-studio">Reload studio</button></div>';document.getElementById('retry-studio')?.addEventListener('click',()=>location.reload());}
