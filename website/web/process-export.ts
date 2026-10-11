import * as T from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {renderHouse} from './scene';
import {releaseRenderer} from './graphics';
// "See our process" hands the simulator the studio's own 3D house: the exterior view is built offscreen,
// furniture and surroundings are left out, and the result is stored as a GLB in IndexedDB. The simulator
// reveals these exact pieces as each panel is set, so the finished build is the studio design.
const SKIP=new Set(['Sky','Surroundings','Painted surroundings','Photo surroundings','Lot lawn','North arrow']);
function keep(o:T.Object3D){if(o.userData.batch||(!o.visible&&!o.userData.batchedOriginal)||SKIP.has(o.name)||(o as any).isLight||(o as any).isCamera)return false;const t=o.userData.editTarget;return !(t&&(t.kind==='furniture'||t.kind==='staging'));}
// Exported copies drop any texture whose image has not arrived (zero size), so the exporter never fails.
// The same photo is often loaded once per surface, so images are shared by source and stored as small
// JPEGs (PNG only where a color map carries cut-out transparency): the house stays a few megabytes.
const cleaned=new Map<string,T.Material>(),shrunk=new Map<unknown,HTMLCanvasElement>(),light=new Map<string,T.Texture>();
function exportTexture(tex:T.Texture,key:string,mat:T.Material){
 const cut=key==='map'&&(mat.transparent||mat.alphaTest>0),size=key==='map'?512:256,id=tex.uuid+(cut?':png':':jpg');
 const hit=light.get(id);if(hit)return hit;
 const img:any=tex.image,source=img.currentSrc||img.src||img,cacheKey=typeof source==='string'?source+'@'+size:source;
 let cvs=shrunk.get(cacheKey);
 if(!cvs){const k=Math.min(1,size/Math.max(img.width,img.height));cvs=document.createElement('canvas');cvs.width=Math.max(1,Math.round(img.width*k));cvs.height=Math.max(1,Math.round(img.height*k));
  try{cvs.getContext('2d')!.drawImage(img,0,0,cvs.width,cvs.height);}catch{return null;}shrunk.set(cacheKey,cvs);}
 const out=tex.clone();out.source=new T.Source(cvs);out.userData={...tex.userData,mimeType:cut?'image/png':'image/jpeg'};light.set(id,out);return out;}
function exportMaterial(mat:T.Material){const hit=cleaned.get(mat.uuid);if(hit)return hit;const copy=mat.clone();
 for(const [key,value] of Object.entries(mat))if(value instanceof T.Texture){const img:any=value.image;
  (copy as any)[key]=img&&img.width>0&&img.height>0&&!(value as any).isDataTexture?exportTexture(value,key,mat):null;}
 cleaned.set(mat.uuid,copy);return copy;}
function exportable(source:T.Object3D):T.Object3D|null{
 if(!keep(source))return null;
 let copy:T.Object3D;
 if((source as T.InstancedMesh).isInstancedMesh){
  // The simulator's glTF loader predates GPU instancing, so instances become one merged mesh.
  const inst=source as T.InstancedMesh,base=inst.geometry.index?inst.geometry.toNonIndexed():inst.geometry,pos=base.getAttribute('position'),nor=base.getAttribute('normal'),out:number[]=[],norms:number[]=[],m=new T.Matrix4(),n=new T.Matrix3(),v=new T.Vector3();
  for(let i=0;i<inst.count;i++){inst.getMatrixAt(i,m);n.getNormalMatrix(m);for(let k=0;k<pos.count;k++){v.fromBufferAttribute(pos,k).applyMatrix4(m);out.push(v.x,v.y,v.z);if(nor){v.fromBufferAttribute(nor,k).applyMatrix3(n).normalize();norms.push(v.x,v.y,v.z);}}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(out,3));if(nor)g.setAttribute('normal',new T.Float32BufferAttribute(norms,3));else g.computeVertexNormals();
  const mat=Array.isArray(inst.material)?inst.material[0]:inst.material;copy=new T.Mesh(g,exportMaterial(mat));copy.name=inst.name;
  copy.position.copy(inst.position);copy.quaternion.copy(inst.quaternion);copy.scale.copy(inst.scale);
 }else{copy=source.clone(false);if(source.userData.batchedOriginal)copy.visible=true;const mesh=copy as T.Mesh;if(mesh.isMesh)mesh.material=Array.isArray(mesh.material)?mesh.material.map(exportMaterial):exportMaterial(mesh.material);}
 for(const child of source.children){const c=exportable(child);if(c)copy.add(c);}
 if(!(copy as any).isMesh&&!copy.children.length)return null;
 return copy;
}
// Loader textures start with no image (or, for trim, a 1 × 1 stand-in canvas) until the photo arrives.
function imageReady(t:T.Texture){const img:any=t.image;if(!img)return false;if(img instanceof HTMLImageElement&&!img.complete)return false;if(t.userData?.url&&img.width<=1)return false;return img.width>0;}
function texturesReady(root:T.Object3D){let ok=true;root.traverse(o=>{const mats=(o as T.Mesh).material;if(!mats)return;for(const mat of Array.isArray(mats)?mats:[mats])for(const value of Object.values(mat))if(value instanceof T.Texture&&!(value as any).isCanvasTexture&&!imageReady(value))ok=false;});return ok;}
function store(record:any){return new Promise<void>((resolve,reject)=>{const req=indexedDB.open('uf-process',1);req.onupgradeneeded=()=>req.result.createObjectStore('models');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result;const tx=db.transaction('models','readwrite');tx.objectStore('models').put(record,'house');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};};});}
export async function exportHouseForProcess(payload:any,design:string,live?:T.Scene){
 cleaned.clear();shrunk.clear();light.clear();
 const host=document.createElement('div');host.style.cssText='position:fixed;left:-4000px;top:0;width:320px;height:240px;';document.body.appendChild(host);
 let cleanup:any;
 try{
  // Reuse the exterior view on screen when there is one; otherwise build it offscreen without drawing.
  const t0=performance.now();
  if(!live)cleanup=renderHouse(host,{...payload,view:'exterior',frameOpening:'',selection:null,cameraPose:null,exportOnly:true});
  const scene:T.Scene|undefined=live??cleanup?.scene;if(!scene)throw new Error('3D view unavailable');
  const start=performance.now();while(!texturesReady(scene)&&performance.now()-start<4000)await new Promise(r=>setTimeout(r,100));
  const t1=performance.now();scene.updateMatrixWorld(true);
  const root=new T.Group();root.name='Studio house';for(const child of scene.children){const c=exportable(child);if(c)root.add(c);}
  const t2=performance.now();
  const glb=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true,maxTextureSize:512}) as ArrayBuffer;
  const t3=performance.now();await store({data:glb,design,created:Date.now()});
  console.info(`Studio house for the simulator: ${(glb.byteLength/1e6).toFixed(1)} MB; build ${Math.round(t1-t0)} ms, prepare ${Math.round(t2-t1)} ms, export ${Math.round(t3-t2)} ms, store ${Math.round(performance.now()-t3)} ms`);
  return glb.byteLength;
 }finally{try{cleanup?.();}catch{/* already disposed */}releaseRenderer(host);host.remove();}
}
