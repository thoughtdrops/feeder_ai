import './style.css';
import {bindTextureUploads} from './texture-upload';
import {bindTheme} from './theme';
const theme=bindTheme();
import {bindStudioAccessibility} from './studio-accessibility';
import {renderHouse} from './scene';
import {layoutEditor} from './context-menu';
import {createSceneController} from './scene-controller';
import {releaseRenderer} from './graphics';
let unbindTextures:undefined|(()=>void);
let unbindAccessibility:undefined|(()=>void);
let reportBusy=false;
let app:any,stage:ReturnType<typeof createSceneController>|undefined;
let zipController:AbortController|undefined;
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
 renderScene(raw:string){stage??=createSceneController({host:document.getElementById('scene')!,render:renderHouse,onError(error){console.error(error);app?.show_status('The 3D view could not load. Switch views or use Reset view to retry.');}});stage.update(JSON.parse(raw));},
 async lookupZip(zip:string){if(!/^\d{5}$/.test(zip)){app?.show_status('Enter a five-digit US ZIP code.');return;}zipController?.abort();const controller=new AbortController();zipController=controller;let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;controller.abort();},12000);try{const r=await fetch('https://api.zippopotam.us/us/'+encodeURIComponent(zip),{signal:controller.signal});if(!r.ok)throw Error('ZIP not found');const j=await r.json() as {places?:{latitude:string;longitude:string}[]};const p=j.places?.[0],lat=Number(p?.latitude),lon=Number(p?.longitude);if(!p||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw Error('ZIP not found');app.apply_location(zip,lat,lon);}catch(e:any){if(e.name!=='AbortError'||timedOut&&zipController===controller)app.show_status('ZIP lookup is unavailable or the ZIP was not found. Choose state and county in Build.');}finally{clearTimeout(timeout);}},
 download(data:string,mime:string,name:string){const url=URL.createObjectURL(new Blob([data],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);app.show_status('Design JSON downloaded');},
 async report(raw:string,kind:string){if(reportBusy){app?.show_status('Your report is being prepared…');return;}reportBusy=true;try{const {config,model,project}=JSON.parse(raw);const r=await import('./report');r.setReportModel(model);if(kind==='pdf')await r.exportPDF(config,project);else if(kind==='framing')r.exportFraming(config);else r.exportCSV(config);app.show_status('Report downloaded');}catch(e){console.error(e);app.show_status('Report download failed. Please try again.');}finally{reportBusy=false;}}
};
window.addEventListener('pagehide',event=>{if(event.persisted)return;unbindAccessibility?.();unbindTextures?.();theme.dispose();zipController?.abort();stage?.dispose();const host=document.getElementById('scene');if(host)releaseRenderer(host);});
declare const __UF_ENGINE_REVISION__:string;
const engineRevision=__UF_ENGINE_REVISION__;
const wasmModule='/pkg/universal_frames.js?v='+engineRevision;
try{app=await import(/* @vite-ignore */wasmModule);await app.default({module_or_path:'/pkg/universal_frames_bg.wasm?v='+engineRevision});app.start();unbindTextures=bindTextureUploads(()=>app);theme.refresh();unbindAccessibility=bindStudioAccessibility();}catch(e){console.error(e);document.getElementById('app')!.innerHTML='<div class="load-error"><div class="loading-brand"><img class="brand-icon" src="/brand/universal-frames-icon.png" alt="" width="64" height="64"><img class="brand-wordmark" src="/brand/universal-frame-wordmark.webp" alt="Universal Frame" width="246" height="82"></div><p>The design engine could not load. Please refresh the page to retry.</p><button id="retry-studio">Reload studio</button></div>';document.getElementById('retry-studio')?.addEventListener('click',()=>location.reload());}
