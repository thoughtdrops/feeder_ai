import * as T from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/examples/jsm/postprocessing/GTAOPass.js';
import {FullScreenQuad} from 'three/examples/jsm/postprocessing/Pass.js';

// Photoreal at real-time cost. While the camera moves, the normal view is drawn. When it rests, a short
// burst of frames is blended together: each frame moves the sun across its disc (soft, sun-sized
// penumbras), shifts the camera by a fraction of a pixel (clean anti-aliased edges) and adds ambient
// occlusion (contact shadows in corners and under furniture). After ~30 frames (about half a second on a
// laptop) the view is converged and rendering stops until something changes.
export type PhotorealHandle={render():boolean;cameraMoved():void;contentChanged():void;setSize():void;dispose():void};
type Options={renderer:T.WebGLRenderer;scene:T.Scene;camera:T.PerspectiveCamera;sun:T.DirectionalLight;mobile:boolean;onStatus:(text:string)=>void};

const halton=(i:number,b:number)=>{let f=1,r=0;while(i>0){f/=b;r+=f*(i%b);i=Math.floor(i/b);}return r;};

export function createPhotoreal(o:Options):PhotorealHandle{
 const {renderer,scene,camera,sun}=o;const target=o.mobile?12:32;
 const size=()=>renderer.getDrawingBufferSize(new T.Vector2());let {x:W,y:H}=size();
 const rt=(w:number,h:number)=>new T.WebGLRenderTarget(Math.max(1,w),Math.max(1,h),{type:T.HalfFloatType,depthBuffer:true});
 const frameTarget=rt(W,H),accumulation=rt(W,H);
 const composer=new EffectComposer(renderer,frameTarget);composer.renderToScreen=false;composer.addPass(new RenderPass(scene,camera));
 const ao=new GTAOPass(scene,camera,W,H);ao.blendIntensity=.85;ao.updateGtaoMaterial({radius:o.mobile?1:1.4,distanceExponent:1.5,thickness:1.2,scale:1,samples:o.mobile?8:12});ao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:4,rings:2,samples:o.mobile?8:12});composer.addPass(ao);
 // The backdrop photograph is a sky sphere, not geometry: keep it out of the contact-shadow pass.
 const aoAny=ao as any,hide=aoAny._overrideVisibility.bind(ao);aoAny._overrideVisibility=()=>{hide();scene.traverse(obj=>{if(obj.userData.backdrop&&obj.visible){obj.visible=false;aoAny._visibilityCache.push(obj);}});};
 // Running average: acc = acc·(1−a) + frame·a with a = 1/(n+1).
 const blend=new FullScreenQuad(new T.ShaderMaterial({uniforms:{tFrame:{value:null},alpha:{value:1}},transparent:true,depthTest:false,depthWrite:false,blending:T.NormalBlending,toneMapped:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:'uniform sampler2D tFrame;uniform float alpha;varying vec2 vUv;void main(){gl_FragColor=vec4(texture2D(tFrame,vUv).rgb,alpha);}'}));
 // Shows the accumulated HDR image with the renderer's tone mapping and output colour space.
 const show=new FullScreenQuad(new T.ShaderMaterial({uniforms:{tAcc:{value:accumulation.texture}},depthTest:false,depthWrite:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:'uniform sampler2D tAcc;varying vec2 vUv;void main(){gl_FragColor=vec4(texture2D(tAcc,vUv).rgb,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}));
 let samples=0,lastStatus='';const status=(t:string)=>{if(t!==lastStatus){lastStatus=t;o.onStatus(t);}};
 const base=new T.Vector3(),dir=new T.Vector3(),u=new T.Vector3(),v=new T.Vector3();
 const reset=()=>{samples=0;};
 return{
  render(){
   if(samples>=target){show.render(renderer);return false;}
   // Sun disc (~1.5° wide, a little larger than the real sun for a pleasing penumbra) and sub-pixel shift.
   base.copy(sun.position);dir.copy(base).sub(sun.target.position).normalize();u.set(0,1,0).cross(dir).normalize();if(u.lengthSq()<1e-6)u.set(1,0,0);v.copy(dir).cross(u).normalize();
   const n=samples+1,radius=base.distanceTo(sun.target.position)*Math.tan(T.MathUtils.degToRad(.75)),r=Math.sqrt(halton(n,2))*radius,a=halton(n,3)*Math.PI*2;
   if(samples>0)sun.position.addScaledVector(u,Math.cos(a)*r).addScaledVector(v,Math.sin(a)*r);
   renderer.shadowMap.needsUpdate=true;
   if(samples>0)camera.setViewOffset(W,H,halton(n,2)-.5,halton(n,3)-.5,W,H);
   composer.render();
   camera.clearViewOffset();sun.position.copy(base);
   const auto=renderer.autoClear;renderer.autoClear=false;renderer.setRenderTarget(accumulation);(blend.material as T.ShaderMaterial).uniforms.tFrame!.value=composer.readBuffer.texture;(blend.material as T.ShaderMaterial).uniforms.alpha!.value=1/n;blend.render(renderer);renderer.setRenderTarget(null);renderer.autoClear=auto;
   samples=n;show.render(renderer);
   if(samples>=target){renderer.shadowMap.needsUpdate=true;status('Photoreal');}else status(`Photoreal · refining ${Math.round(samples/target*100)}%`);
   return samples<target;
  },
  cameraMoved(){reset();},
  contentChanged(){reset();},
  setSize(){const s=size();W=s.x;H=s.y;frameTarget.setSize(W,H);accumulation.setSize(W,H);composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(W/renderer.getPixelRatio(),H/renderer.getPixelRatio());ao.setSize(W,H);reset();},
  dispose(){ao.dispose();composer.dispose();frameTarget.dispose();accumulation.dispose();blend.material.dispose();blend.dispose();show.material.dispose();show.dispose();},
 };
}
