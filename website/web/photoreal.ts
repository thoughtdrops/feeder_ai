import * as T from 'three';

// Photoreal view: a progressive GPU path tracer (three-gpu-pathtracer) renders the house with true sunlight,
// sky light, bounced light, soft shadows and reflections whenever the camera rests. While the visitor moves
// the camera the normal real-time view is shown, then the traced image fades in and keeps refining.
// The library is loaded only when this style is chosen.
export type PhotorealHandle={render():boolean;cameraMoved():void;contentChanged():void;dispose():void;samples():number};
type Options={renderer:T.WebGLRenderer;scene:T.Scene;camera:T.PerspectiveCamera;sun:T.DirectionalLight;sky:T.Mesh;raster:()=>void;mobile:boolean;onStatus:(text:string)=>void;onReady:()=>void};

/** Equirect sky + ground radiance for image-based lighting (the sun itself is the directional light). */
function skyEnvironment(){
 const W=512,H=256,data=new Float32Array(W*H*4);const zenith=new T.Color('#3d78c8'),horizon=new T.Color('#c9dcec'),ground=new T.Color('#4d5a3a'),c=new T.Color();
 for(let y=0;y<H;y++){const lat=((y+.5)/H-.5)*Math.PI,e=Math.sin(lat);
  if(e>=0)c.copy(horizon).lerp(zenith,Math.pow(e,.45)).multiplyScalar(1.15);else c.copy(ground).multiplyScalar(.55+.45*Math.min(1,-e*4));
  for(let x=0;x<W;x++){const i=(y*W+x)*4;data[i]=c.r;data[i+1]=c.g;data[i+2]=c.b;data[i+3]=1;}}
 const t=new T.DataTexture(data,W,H,T.RGBAFormat,T.FloatType);t.mapping=T.EquirectangularReflectionMapping;t.magFilter=t.minFilter=T.LinearFilter;t.needsUpdate=true;return t;
}

/** A flat copy of everything visible, with instanced parts expanded, in materials the tracer understands. */
function traceScene(src:T.Scene,sun:T.DirectionalLight,environment:T.Texture){
 const out=new T.Scene();out.environment=environment;out.environmentIntensity=1;out.background=null;
 const light=new T.DirectionalLight(sun.color,sun.intensity);light.position.copy(sun.position);light.target.position.copy(sun.target.position);out.add(light,light.target);
 const converted=new Map<T.Material,T.Material|null>();const lawn=(src.userData.grass as T.MeshStandardMaterial|undefined)?.map?.source;
 const loaded=(t:T.Texture|null)=>!t||Boolean((t.image as any)&&((t.image as any).width||(t.image as any).data));
 const usable=(mat:T.Material):T.Material|null=>{
  if(converted.has(mat))return converted.get(mat)!;let result:T.Material|null=null;const any=mat as any;
  // Soft fade pads are a raster-only effect; the lawn traces as a matte green (its photo tiles 100× and
  // reads as flat colour at a distance anyway).
  if(any.alphaMap){converted.set(mat,null);return null;}
  if(lawn&&any.map?.source===lawn){result=new T.MeshStandardMaterial({color:new T.Color('#6f8f45').multiply(any.color??new T.Color(1,1,1)),roughness:1});converted.set(mat,result);return result;}
  if(any.isMeshStandardMaterial&&['map','normalMap','roughnessMap','metalnessMap','bumpMap','emissiveMap'].some(k=>!loaded(any[k]))){const copy=(mat as T.MeshStandardMaterial).clone();for(const k of ['map','normalMap','roughnessMap','metalnessMap','bumpMap','emissiveMap'])if(!loaded((copy as any)[k]))(copy as any)[k]=null;result=copy;}
  else if(any.isMeshStandardMaterial)result=mat;
  else if(any.isShaderMaterial||any.isLineBasicMaterial||any.isPointsMaterial||any.isSpriteMaterial)result=null;
  else if(mat.transparent&&mat.opacity<.05)result=null;
  else if(any.color){result=new T.MeshStandardMaterial({color:any.color,map:any.map??null,transparent:mat.transparent,opacity:mat.opacity,side:mat.side,roughness:.8});}
  converted.set(mat,result);return result;
 };
 const shown=(o:T.Object3D)=>{for(let n:T.Object3D|null=o;n;n=n.parent)if(!n.visible)return false;return true;};
 src.updateMatrixWorld(true);const tmp=new T.Matrix4();
 src.traverse(o=>{
  const mesh=o as T.Mesh;if(!mesh.isMesh||mesh.name==='Sky'||!shown(mesh))return;
  const mats=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).map(usable);if(mats.every(m=>!m))return;
  const material=Array.isArray(mesh.material)?mats.map(m=>m??new T.MeshStandardMaterial({transparent:true,opacity:0})):mats[0]!;
  const place=(matrix:T.Matrix4)=>{const p=new T.Mesh(mesh.geometry,material as any);p.matrixAutoUpdate=false;p.matrix.copy(matrix);out.add(p);};
  if((mesh as T.InstancedMesh).isInstancedMesh){const inst=mesh as T.InstancedMesh;for(let i=0;i<inst.count;i++){inst.getMatrixAt(i,tmp);place(new T.Matrix4().multiplyMatrices(inst.matrixWorld,tmp));}}
  else place(mesh.matrixWorld);
 });
 out.updateMatrixWorld(true);return out;
}

export async function createPhotoreal(o:Options):Promise<PhotorealHandle|null>{
 const gl=o.renderer.getContext();
 if(!(gl instanceof WebGL2RenderingContext)||!o.renderer.extensions.has('EXT_color_buffer_float')){o.onStatus('Photoreal needs WebGL 2 with float render targets; showing the real-time view.');return null;}
 const [{WebGLPathTracer},{ParallelMeshBVHWorker}]=await Promise.all([import('three-gpu-pathtracer'),import('three-mesh-bvh/worker')]);
 const tracer=new WebGLPathTracer(o.renderer);let worker:any=null;
 try{worker=new ParallelMeshBVHWorker();tracer.setBVHWorker(worker);}catch{worker=null;}
 tracer.multipleImportanceSampling=true;tracer.bounces=o.mobile?3:5;tracer.transmissiveBounces=4;tracer.filterGlossyFactor=.5;
 tracer.minSamples=2;tracer.renderDelay=200;tracer.fadeDuration=350;tracer.dynamicLowRes=false;tracer.renderScale=o.mobile?.5:1;
 tracer.textureSize.set(o.mobile?512:1024,o.mobile?512:1024);
 const maxSamples=o.mobile?96:600;
 // Sky only (no house) under the traced pixels: the traced background is transparent so the painted sky shows.
 const skyScene=new T.Scene();const skyCopy=new T.Mesh(o.sky.geometry,o.sky.material);skyCopy.name='Sky';skyCopy.frustumCulled=false;skyCopy.onBeforeRender=(_r,_s,camera)=>{skyCopy.position.copy(camera.position);skyCopy.updateMatrixWorld();};skyScene.add(skyCopy);
 tracer.rasterizeSceneCallback=()=>o.raster();
 tracer.renderToCanvasCallback=(_target:any,renderer:T.WebGLRenderer,quad:any)=>{
  if(quad.material.opacity>=1)renderer.render(skyScene,o.camera);
  const auto=renderer.autoClear;renderer.autoClear=false;quad.material.blending=T.NormalBlending;quad.material.transparent=true;quad.render(renderer);renderer.autoClear=auto;
 };
 const environment=skyEnvironment();let ready=false,building:Promise<void>|null=null,dirty=false,disposed=false,lastStatus='';
 const status=(text:string)=>{if(text!==lastStatus){lastStatus=text;o.onStatus(text);}};
 const build=async()=>{
  if(building){dirty=true;return;}status('Preparing photoreal render…');
  building=(async()=>{try{const scene=traceScene(o.scene,o.sun,environment);
    if(worker)await tracer.setSceneAsync(scene,o.camera);else tracer.setScene(scene,o.camera);
    if(disposed)return;ready=true;o.onReady();}
   catch(error){console.warn('Photoreal render unavailable',error);status('Photoreal render could not start on this device; showing the real-time view.');}
   finally{building=null;if(dirty&&!disposed){dirty=false;build();}}})();
 };
 build();
 return{
  render(){
   if(!ready){o.raster();return Boolean(building);}
   tracer.renderSample();const n=tracer.samples;
   status(n<1?'Photoreal · rendering…':n>=maxSamples?'Photoreal · finished':`Photoreal · refining ${Math.min(99,Math.round(n/maxSamples*100))}%`);
   return n<maxSamples;
  },
  cameraMoved(){if(ready)tracer.updateCamera();},
  contentChanged(){build();},
  samples(){return ready?tracer.samples:0;},
  dispose(){disposed=true;try{tracer.dispose();}catch{}try{worker?.dispose();}catch{}environment.dispose();},
 };
}
