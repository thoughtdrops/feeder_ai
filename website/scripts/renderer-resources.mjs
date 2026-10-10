import fs from 'node:fs';
export function enhanceResources(){
 let source=fs.readFileSync('web/scene.ts','utf8');
 const replace=(from,to)=>{if(!source.includes(from))throw Error('Graphics resource anchor missing: '+from.slice(0,90));source=source.replace(from,to);};
 replace("import * as T from 'three';","import * as T from 'three';\nimport {acquireRenderer,clearSceneResources,mobileGraphics,graphicsAsset} from './graphics';");
 replace("renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});","renderer=acquireRenderer(el);");
 replace("T.Cache.enabled=true;renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));","T.Cache.enabled=false;");
 replace("new HDRLoader().load('/materials/evening-light.hdr'","if(!mobileGraphics())new HDRLoader().load('/materials/evening-light.hdr'");
 replace('sun.shadow.mapSize.set(2048,2048);','sun.shadow.mapSize.set(mobileGraphics()?1024:2048,mobileGraphics()?1024:2048);');
 replace('transmission:.3,transparent:true','transmission:mobileGraphics()?0:.3,transparent:true');
 const a=source.indexOf(' const loadMap='),b=source.indexOf(' const oak=',a);
 if(a<0||b<0)throw Error('Texture loader boundaries changed');
 source=source.slice(0,a)+` const mapCache=new Map<string,T.Texture>();
 const loadMap=(file:string,repx:number,repz:number,color=false)=>{let base=mapCache.get(file);if(!base){base=new T.TextureLoader().load(graphicsAsset('/materials/'+file),loaded=>{if(!active)return;for(const map of textures)if(map.source===loaded.source)map.needsUpdate=true;});base.wrapS=base.wrapT=T.RepeatWrapping;base.anisotropy=Math.min(mobileGraphics()?4:8,renderer.capabilities.getMaxAnisotropy());if(color)base.colorSpace=T.SRGBColorSpace;mapCache.set(file,base);textures.push(base);}const tex=base.clone();tex.repeat.set(repx,repz);textures.push(tex);return tex;};
`+source.slice(b);
 replace('renderer.domElement.setPointerCapture(e.pointerId);','try{renderer.domElement.setPointerCapture(e.pointerId);}catch{}');
 replace("document.addEventListener('pointerdown',pad);",`document.addEventListener('pointerdown',pad);const touchPad=(e:TouchEvent)=>{if(!walk)return;const b=(e.target as Element).closest('[data-walk]');if(b){e.preventDefault();keys.current.add(b.getAttribute('data-walk')!);}};document.addEventListener('touchstart',touchPad,{passive:false});document.addEventListener('touchend',up);document.addEventListener('touchcancel',up);window.addEventListener('pointercancel',up);`);
 replace('function tick(){id=requestAnimationFrame(tick);','function tick(){if(!active)return;try{id=requestAnimationFrame(tick);');
 replace('renderer.render(scene,camera);}tick();',"renderer.render(scene,camera);}catch(error){cleanup();if(payload.onRenderError)payload.onRenderError(error);else throw error;}}");
 replace('const cleanup:any=()=>{editControls.dispose();',"const cleanup:any=()=>{if(!active)return;active=false;editControls.dispose();renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointermove',move);document.removeEventListener('touchstart',touchPad);document.removeEventListener('touchend',up);document.removeEventListener('touchcancel',up);window.removeEventListener('pointercancel',up);");
 const start=source.indexOf('const mats=new Set<T.Material>();'),end=source.indexOf('keys.current.clear();};cleanup.select=',start);
 if(start<0||end<0)throw Error('Graphics cleanup boundaries changed');
 source=source.slice(0,start)+`clearSceneResources(scene,textures);hdriEnvironment?.dispose();env.dispose();pmrem.dispose();renderer.renderLists.dispose();renderer.domElement.remove();`+source.slice(end);
 replace('return cleanup;','tick();return cleanup;');
 fs.writeFileSync('web/scene.ts',source);
}
