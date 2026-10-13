import * as T from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/examples/jsm/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';

// Graphics styles for the studio viewer. Geometry, materials and quantities are unchanged; a style only
// changes light, sky, tone and (for the architect's model) surface colors, so every style shows the same house.
export type ViewStyle='studio'|'realistic'|'twilight'|'model';
export const VIEW_STYLES:{id:ViewStyle,label:string}[]=[
 {id:'studio',label:'Studio'},
 {id:'realistic',label:'Realistic'},
 {id:'twilight',label:'Twilight'},
 {id:'model',label:'Architect model'},
];
const KEY='uf-view-style';
let current:ViewStyle=(()=>{try{const v=localStorage.getItem(KEY);return VIEW_STYLES.some(s=>s.id===v)?v as ViewStyle:'studio';}catch{return 'studio';}})();
export function viewStyle(){return current;}
export function viewStyleLabel(id=current){return VIEW_STYLES.find(s=>s.id===id)!.label;}
/** Marks the page so the style button shows the current name (it survives the studio's HTML re-renders). */
export function markViewStyle(){if(typeof document!=='undefined')document.documentElement.dataset.viewStyle=current;}
export function cycleViewStyle(){
 const i=VIEW_STYLES.findIndex(s=>s.id===current);current=VIEW_STYLES[(i+1)%VIEW_STYLES.length]!.id;
 try{localStorage.setItem(KEY,current);}catch{/* not remembered */}
 markViewStyle();return current;
}

type Look={scene:T.Scene;renderer:T.WebGLRenderer;sun:T.DirectionalLight;hemi:T.HemisphereLight;ambient:T.AmbientLight;sky:T.Mesh;glass:T.MeshPhysicalMaterial;span:number;h:number};

/** Applies the light, sky and tone of `style`. Returns the factor for environment-map intensity. */
export function applyLook(style:ViewStyle,o:Look){
 const {scene,renderer,sun,hemi,ambient,sky,glass}=o;const uniforms=(sky.material as T.ShaderMaterial).uniforms;
 const place=(azimuth:number,elevation:number)=>{const r=Math.max(90,o.span*1.6+o.h);const a=T.MathUtils.degToRad(azimuth),e=T.MathUtils.degToRad(elevation);sun.position.set(-Math.sin(a)*Math.cos(e)*r,Math.sin(e)*r,-Math.cos(a)*Math.cos(e)*r);uniforms.sunDir?.value.copy(sun.position).normalize();};
 const fog=scene.fog as T.Fog|null;
 if(style==='realistic'){
  // Listing-photo daylight: neutral tone curve, crisp high sun, soft sky fill, ambient occlusion.
  renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=1.08;
  sun.color.set('#fff3e0');sun.intensity=3.4;place(38,48);
  hemi.color.set('#d6e8ff');hemi.groundColor.set('#94a06a');hemi.intensity=.95;ambient.intensity=.06;
  uniforms.zenith?.value.set('#3f88d6');uniforms.horizon?.value.set('#dbe8f2');fog?.color.set('#dbe8f2');
  return 1.25;
 }
 if(style==='twilight'){
  // Dusk listing shot: deep blue sky, low warm sun, every window lit from inside.
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  sun.color.set('#ff9a5c');sun.intensity=1.5;place(-62,7);
  hemi.color.set('#5b6fb0');hemi.groundColor.set('#2a2833');hemi.intensity=.7;ambient.color.set('#7c80b0');ambient.intensity=.18;
  uniforms.zenith?.value.set('#1b2750');uniforms.horizon?.value.set('#ef9a5d');fog?.color.set('#5d5068');
  glass.color.set('#ffd9a3');glass.emissive.set('#ffb35c');glass.emissiveIntensity=1.6;glass.opacity=.88;glass.needsUpdate=true;
  return .35;
 }
 if(style==='model'){
  // Architect's white model: matte clay surfaces on a soft studio backdrop.
  renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=.95;
  sun.color.set('#ffffff');sun.intensity=2.4;place(40,52);
  hemi.color.set('#ffffff');hemi.groundColor.set('#d8d3ca');hemi.intensity=1.1;ambient.intensity=.12;
  sky.visible=false;scene.background=new T.Color('#e9e7e2');if(fog){fog.color.set('#e9e7e2');fog.near*=.6;}
  return .55;
 }
 return 1;
}

/** Realistic: a fresher, listing-photo lawn. Tints every material using the grass photo (house lot, lawn,
 * fade pad); call again after late-loading surroundings. */
export function tintLawn(root:T.Scene){
 const lawn=(root.userData.grass as T.MeshStandardMaterial|undefined)?.map?.source;if(!lawn)return;
 root.traverse(obj=>{const mats=(obj as T.Mesh).material;for(const mat of Array.isArray(mats)?mats:mats?[mats]:[]){const std=mat as T.MeshStandardMaterial;if(std.map?.source===lawn&&!std.userData.lawnTint){std.color.multiply(new T.Color('#c4ec93'));std.userData.lawnTint=true;}}});
}

const claySource=new WeakMap<T.Material,T.Material>();
/** Architect model: replaces every surface with matte clay, keeping light/dark contrast so roofs, trim and
 * walls still read apart. Idempotent; call again after late-loading content (furniture, textures). */
export function clayScene(root:T.Object3D){
 const clayFor=(m:T.Material)=>{
  if(m.userData.clay)return m;let c=claySource.get(m);if(c)return c;
  const base=(m as any).color instanceof T.Color?((m as any).color as T.Color):new T.Color('#bbbbbb');
  const hsl={h:0,s:0,l:0};base.getHSL(hsl,T.SRGBColorSpace);const tone=.78+.18*hsl.l;
  if((m as any).isLineBasicMaterial||(m as any).isSpriteMaterial||(m as any).isShaderMaterial||(m as any).isPointsMaterial)return m;
  if(m.transparent&&m.opacity<.6)c=new T.MeshStandardMaterial({color:'#cdd7da',roughness:.2,transparent:true,opacity:.45,depthWrite:false,side:m.side});
  else c=new T.MeshStandardMaterial({color:new T.Color(tone,tone*.99,tone*.97),roughness:.88,metalness:0,side:m.side,transparent:m.transparent,opacity:m.opacity,alphaTest:(m as any).alphaTest||0});
  c.userData.clay=true;claySource.set(m,c);return c;
 };
 root.traverse(object=>{const mesh=object as T.Mesh;if(!mesh.isMesh||mesh.name==='Sky')return;
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(clayFor):clayFor(mesh.material);});
}

/** Ambient occlusion for the realistic and model styles (desktop only; phones keep the direct path). */
export function createPostFX(style:ViewStyle,renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera){
 if(style!=='realistic'&&style!=='model')return null;
 const size=renderer.getDrawingBufferSize(new T.Vector2());
 const target=new T.WebGLRenderTarget(Math.max(1,size.x),Math.max(1,size.y),{type:T.HalfFloatType,samples:4});
 const composer=new EffectComposer(renderer,target);composer.addPass(new RenderPass(scene,camera));
 const ao=new GTAOPass(scene,camera,Math.max(1,size.x),Math.max(1,size.y));
 ao.blendIntensity=style==='model'?.9:.55;
 ao.updateGtaoMaterial({radius:1.2,distanceExponent:1.4,thickness:1,scale:1,samples:12});
 ao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:5,rings:2,samples:12});
 composer.addPass(ao);composer.addPass(new OutputPass());
 return {
  render(){composer.render();},
  setSize(width:number,height:number){composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(width,height);},
  dispose(){ao.dispose();composer.dispose();target.dispose();},
 };
}
