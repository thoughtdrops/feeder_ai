import * as T from 'three';

// One context per studio, shared by all views and design changes.
const renderers=new WeakMap<HTMLElement,T.WebGLRenderer>();
export function mobileGraphics(){
 if(typeof navigator==='undefined')return false;
 return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)||(navigator.maxTouchPoints>0&&typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches);
}
export function graphicsAsset(path:string){return mobileGraphics()?'/mobile'+path:path;}
// Render at the screen's real pixel density (up to 2x) so edges stay crisp on Retina and phone screens.
export function fullPixelRatio(){return Math.min(globalThis.devicePixelRatio||1,2);}
/** Keeps the view sharp and smooth: every still frame is drawn at full resolution; while the camera moves,
 * a device that can't keep ~30 fps steps its moving resolution down (never below 1x) and the next still
 * frame snaps back to full. */
export function adaptiveResolution(renderer:T.WebGLRenderer,onChange?:()=>void){
 const full=fullPixelRatio();let moving=full,current=full,slow=0,last=0;
 const use=(ratio:number)=>{if(Math.abs(current-ratio)>.01){current=ratio;renderer.setPixelRatio(ratio);onChange?.();}};
 return {
  frame(now:number){
   const dt=now-last;last=now;
   if(dt>0&&dt<250){slow=dt>34?slow+1:Math.max(0,slow-2);if(slow>30&&moving>1){moving=Math.max(1,moving-.25);slow=0;}}
   use(moving);
  },
  // Called when the view goes idle: one more full-resolution frame if the last one was reduced.
  settle(){if(current<full-.01){use(full);last=0;return true;}return false;},
 };
}
export function acquireRenderer(el:HTMLElement){
 let renderer=renderers.get(el);
 if(!renderer){
  renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  // Avoid an Apple flat-varying buffer upload failure when the extension exists.
  const gl=renderer.getContext(),provoking=gl.getExtension('WEBGL_provoking_vertex') as any;
  provoking?.provokingVertexWEBGL(provoking.FIRST_VERTEX_CONVENTION_WEBGL);
  renderers.set(el,renderer);
 }
 renderer.setPixelRatio(fullPixelRatio());
 el.appendChild(renderer.domElement);
 return renderer;
}
export function clearSceneResources(scene:T.Scene,textures:T.Texture[]){
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),maps=new Set<T.Texture>(textures);
 scene.traverse(object=>{
  const draw=object as T.Mesh;
  if(draw.geometry)geometries.add(draw.geometry);
  if(draw.material)for(const mat of Array.isArray(draw.material)?draw.material:[draw.material])materials.add(mat);
  if(object instanceof T.InstancedMesh)object.dispose();
  if(object instanceof T.Light&&(object as T.DirectionalLight).shadow)(object as T.DirectionalLight).shadow.dispose();
 });
 for(const material of materials)for(const value of Object.values(material))if(value instanceof T.Texture)maps.add(value);
 for(const geometry of geometries)geometry.dispose();
 for(const material of materials)material.dispose();
 for(const texture of maps)if(!texture.userData.persistent)texture.dispose();
 // Cached GLB source images/geometries remain bounded and may be used again.
 scene.environment=null;scene.background=null;scene.clear();
}
export function releaseRenderer(el:HTMLElement){
 const renderer=renderers.get(el);if(!renderer)return;
 renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();renderers.delete(el);
}
