import * as T from 'three';

// One context per studio, shared by all views and design changes.
const renderers=new WeakMap<HTMLElement,T.WebGLRenderer>();
export function mobileGraphics(){
 if(typeof navigator==='undefined')return false;
 return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)||(navigator.maxTouchPoints>0&&typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches);
}
export function graphicsAsset(path:string){return mobileGraphics()?'/mobile'+path:path;}
export function acquireRenderer(el:HTMLElement){
 let renderer=renderers.get(el);
 if(!renderer){
  renderer=new T.WebGLRenderer({antialias:!mobileGraphics(),powerPreference:mobileGraphics()?'low-power':'high-performance'});
  // Avoid an Apple flat-varying buffer upload failure when the extension exists.
  const gl=renderer.getContext(),provoking=gl.getExtension('WEBGL_provoking_vertex') as any;
  provoking?.provokingVertexWEBGL(provoking.FIRST_VERTEX_CONVENTION_WEBGL);
  renderers.set(el,renderer);
 }
 renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,mobileGraphics()?1.25:1.7));
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
