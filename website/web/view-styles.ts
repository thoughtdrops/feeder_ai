import * as T from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/examples/jsm/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {EdgePass,FINE_DETAIL_LAYER,type EdgeOptions} from './edges';

// Viewer graphics styles. Every style shows the same house; a style changes how it is drawn:
// Studio (the everyday view), Photoreal (progressive path tracing), SketchUp-style shaded + edges,
// hidden-line Line drawing, Blueprint, and a physical Scale model on a wooden base.
export type ViewStyle='studio'|'photoreal'|'sketch'|'lines'|'blueprint'|'mockup';
export const VIEW_STYLES:{id:ViewStyle,label:string,note:string}[]=[
 {id:'studio',label:'Studio',note:'The everyday real-time view'},
 {id:'photoreal',label:'Photoreal',note:'Soft sun-sized shadows, ambient occlusion and clean edges; refines in a moment when the view rests'},
 {id:'sketch',label:'SketchUp style',note:'Shaded faces with crisp black edges'},
 {id:'lines',label:'Line drawing',note:'Hidden-line architectural drawing on paper'},
 {id:'blueprint',label:'Blueprint',note:'White linework on blueprint blue'},
 {id:'mockup',label:'Scale model',note:'Foam-board and basswood model on a wooden base'},
];
const KEY='uf-view-style';
const LEGACY:Record<string,ViewStyle>={realistic:'photoreal',twilight:'photoreal',model:'mockup'};
let current:ViewStyle=(()=>{try{const raw=localStorage.getItem(KEY)||'';const v=LEGACY[raw]??raw;return VIEW_STYLES.some(s=>s.id===v)?v as ViewStyle:'studio';}catch{return 'studio';}})();
export function viewStyle(){return current;}
export function viewStyleLabel(id=current){return VIEW_STYLES.find(s=>s.id===id)!.label;}
/** Marks the page so the style button shows the current name (it survives the studio's HTML re-renders). */
export function markViewStyle(){if(typeof document!=='undefined')document.documentElement.dataset.viewStyle=current;}
export function setViewStyle(id:ViewStyle){if(!VIEW_STYLES.some(s=>s.id===id))return current;current=id;try{localStorage.setItem(KEY,current);}catch{/* not remembered */}markViewStyle();return current;}

type Site={minX:number,minZ:number,maxX:number,maxZ:number};
type Look={scene:T.Scene;renderer:T.WebGLRenderer;sun:T.DirectionalLight;hemi:T.HemisphereLight;ambient:T.AmbientLight;sky:T.Mesh;glass:T.MeshPhysicalMaterial;span:number;h:number;site:Site;groundY:number;indoor?:boolean};

const hideSurroundings=(scene:T.Scene)=>scene.traverse(o=>{if(o.name==='Surroundings')o.visible=false;});

/** Applies the light, sky, background and props of `style`. Returns the factor for environment-map intensity. */
export function applyLook(style:ViewStyle,o:Look){
 const {scene,renderer,sun,hemi,ambient,sky}=o;const uniforms=(sky.material as T.ShaderMaterial).uniforms;
 const place=(azimuth:number,elevation:number)=>{const r=Math.max(90,o.span*1.6+o.h);const a=T.MathUtils.degToRad(azimuth),e=T.MathUtils.degToRad(elevation);sun.position.set(-Math.sin(a)*Math.cos(e)*r,Math.sin(e)*r,-Math.cos(a)*Math.cos(e)*r);uniforms.sunDir?.value.copy(sun.position).normalize();};
 if(style==='photoreal'){
  renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=1;
  sun.color.set('#fff1dc');sun.intensity=3.4;place(36,44);hemi.intensity=.35;ambient.intensity=0;
  uniforms.zenith?.value.set('#3d78c8');uniforms.horizon?.value.set('#d4e3ef');(scene.fog as T.Fog|null)?.color.set('#d4e3ef');
  // Walking through rooms: keep the soft white room environment (bounce light off ceilings and walls) and
  // let the sun reach in through the windows; outdoor sky light would tint every room green and blue.
  if(o.indoor){hemi.intensity=.2;return 1.7;}
  // Image-based light from this exact sky and a lawn-coloured ground, so ambient light and reflections match
  // the sun and sky the house sits under (the generic studio environment reads as indoor light).
  // A real backdrop photograph already lights the scene with its own sky and ground.
  if(scene.userData.photoBackdrop)return 1/(scene.environmentIntensity||1);
  const pmrem=new T.PMREMGenerator(renderer),envScene=new T.Scene(),dome=new T.Mesh(new T.SphereGeometry(100,48,24),(sky.material as T.ShaderMaterial).clone());(dome.material as T.ShaderMaterial).side=T.BackSide;envScene.add(dome);
  const lawn=new T.Mesh(new T.CircleGeometry(99,48).rotateX(-Math.PI/2),new T.MeshBasicMaterial({color:'#5b6f42'}));lawn.position.y=-2;envScene.add(lawn);
  const env=pmrem.fromScene(envScene,.02);scene.environment=env.texture;scene.userData.styleEnv=env;scene.userData.photoEnvironment=true;
  dome.geometry.dispose();(dome.material as T.Material).dispose();lawn.geometry.dispose();(lawn.material as T.Material).dispose();pmrem.dispose();
  return 1/(scene.environmentIntensity||1);
 }
 if(style==='lines'||style==='blueprint'){
  renderer.toneMapping=T.NoToneMapping;sky.visible=false;scene.fog=null;hideSurroundings(scene);
  scene.background=new T.Color(style==='lines'?'#f7f5ef':'#1b4885');
  sun.intensity=style==='lines'?1.7:0;sun.castShadow=style==='lines';hemi.color.set('#ffffff');hemi.groundColor.set('#cfcfcf');hemi.intensity=1.1;ambient.intensity=.25;place(40,50);
  if(style==='lines'){const paper=new T.Mesh(new T.PlaneGeometry(4000,4000).rotateX(-Math.PI/2),new T.MeshLambertMaterial({color:'#ffffff'}));paper.position.y=o.groundY-.01;paper.receiveShadow=true;paper.name='Drawing ground';scene.add(paper);}
  return .3;
 }
 if(style==='mockup'){
  renderer.toneMapping=T.NeutralToneMapping;renderer.toneMappingExposure=1;sky.visible=false;scene.fog=null;hideSurroundings(scene);
  scene.background=new T.Color('#d9d7d2');sun.color.set('#ffffff');sun.intensity=2.4;place(48,58);hemi.color.set('#ffffff');hemi.groundColor.set('#cbc6bc');hemi.intensity=1.15;ambient.intensity=.15;
  addModelBase(scene,o.site,o.groundY);return .6;
 }
 return 1;
}

/** Scale-model props: a basswood plinth with walnut edges, white card top, and lollipop model trees. */
function addModelBase(scene:T.Scene,site:Site,groundY:number){
 const pad=14,minX=site.minX-pad,maxX=site.maxX+pad,minZ=site.minZ-pad,maxZ=site.maxZ+pad,w=maxX-minX,d=maxZ-minZ,cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
 const group=new T.Group();group.name='Scale model base';scene.add(group);
 const card=new T.MeshStandardMaterial({color:'#efece6',roughness:.95});card.userData.role='model';
 const walnut=new T.MeshStandardMaterial({color:'#6b4a33',roughness:.6,map:woodGrain('#7a553a','#5f412c')});walnut.userData.role='model';
 const top=new T.Mesh(new T.BoxGeometry(w,.4,d),card);top.position.set(cx,groundY-.21,cz);top.receiveShadow=true;group.add(top);
 const base=new T.Mesh(new T.BoxGeometry(w+1.2,3.2,d+1.2),walnut);base.position.set(cx,groundY-.41-1.6,cz);base.castShadow=base.receiveShadow=true;group.add(base);
 const foam=new T.MeshStandardMaterial({color:'#f6f4ef',roughness:.9});foam.userData.role='model';const dowel=new T.MeshStandardMaterial({color:'#d9bf97',roughness:.7});dowel.userData.role='model';
 const spots:[number,number,number][]=[[minX+6,minZ+6,5],[maxX-6,minZ+7,4.4],[minX+5,maxZ-6,4.8],[maxX-7,maxZ-5,5.4],[cx,maxZ-4,4],[minX+4,cz,3.8]];
 for(const [x,z,r] of spots){const trunk=new T.Mesh(new T.CylinderGeometry(.22,.26,r*1.5,10),dowel);trunk.position.set(x,groundY+r*.75,z);trunk.castShadow=true;group.add(trunk);
  const crown=new T.Mesh(new T.SphereGeometry(r,28,18),foam);crown.position.set(x,groundY+r*1.5+r*.8,z);crown.castShadow=crown.receiveShadow=true;group.add(crown);}
}

const grainCache=new Map<string,T.CanvasTexture>();
function woodGrain(light:string,dark:string){
 const key=light+dark;let t=grainCache.get(key);if(t)return t;const c=document.createElement('canvas');c.width=64;c.height=512;const g=c.getContext('2d')!;g.fillStyle=light;g.fillRect(0,0,64,512);
 let seed=11;const r=()=>(seed=(seed*16807)%2147483647)/2147483647;for(let i=0;i<46;i++){g.strokeStyle=dark;g.globalAlpha=.08+r()*.18;g.lineWidth=.6+r()*1.6;g.beginPath();const x=r()*64;g.moveTo(x,0);for(let y=0;y<=512;y+=32)g.lineTo(x+Math.sin(y/60+i)*2.5,y);g.stroke();}
 t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.userData.persistent=true;grainCache.set(key,t);return t;
}

const modelSource=new WeakMap<T.Material,T.Material>();
/** Scale model: foam-board walls, basswood roof and trim, frosted acrylic glazing, card floors. Idempotent;
 * call again after late-loading content (furniture, textures). */
function modelScene(root:T.Object3D){
 const swap=(m:T.Material):T.Material=>{
  const any=m as any;if(m.userData.role==='model'||m.userData.modelCopy)return m;let c=modelSource.get(m);if(c)return c;
  if(any.isShaderMaterial||any.isLineBasicMaterial||any.isSpriteMaterial||any.isPointsMaterial)return m;
  const role=m.userData.role;const base=any.color instanceof T.Color?(any.color as T.Color):new T.Color('#cccccc');const hsl={h:0,s:0,l:0};base.getHSL(hsl,T.SRGBColorSpace);
  if(role==='glass'||(m.transparent&&m.opacity<.6&&m.opacity>.05))c=new T.MeshPhysicalMaterial({color:'#eef4f5',roughness:.35,transparent:true,opacity:.55,depthWrite:false,side:m.side});
  else if(m.transparent&&m.opacity<=.05)return m;
  else if(role==='roof')c=new T.MeshStandardMaterial({color:'#e7d3b0',roughness:.75,map:woodGrain('#ead7b5','#cdb38a'),side:m.side});
  else if(role==='trim'||role==='door')c=new T.MeshStandardMaterial({color:'#d9bf97',roughness:.7,map:woodGrain('#dcc39c','#bea076'),side:m.side});
  else if(role==='ground'||role==='floor')c=new T.MeshStandardMaterial({color:'#e9e6df',roughness:.95,side:m.side});
  else{const tone=.9+.08*hsl.l;c=new T.MeshStandardMaterial({color:new T.Color().setRGB(tone,tone*.995,tone*.98,T.SRGBColorSpace),roughness:.92,side:m.side,transparent:m.transparent,opacity:m.opacity,alphaTest:any.alphaTest||0});}
  c.userData.modelCopy=true;modelSource.set(m,c);return c;
 };
 root.traverse(object=>{const mesh=object as T.Mesh;if(!mesh.isMesh||mesh.name==='Sky')return;mesh.material=Array.isArray(mesh.material)?mesh.material.map(swap):swap(mesh.material);});
}

/** Photoreal: a fresher lawn for the real-time preview (tints materials that use the grass photo). */
function tintLawn(root:T.Scene){
 const lawn=(root.userData.grass as T.MeshStandardMaterial|undefined)?.map?.source;if(!lawn)return;
 root.traverse(obj=>{const mats=(obj as T.Mesh).material;for(const mat of Array.isArray(mats)?mats:mats?[mats]:[]){const std=mat as T.MeshStandardMaterial;if(std.map?.source===lawn&&!std.userData.lawnTint){std.color.multiply(new T.Color('#c8ec98'));std.userData.lawnTint=true;}}});
}

/** Re-applies material-level parts of a style after content changes (late furniture, textures, photos). */
export function refreshLook(style:ViewStyle,scene:T.Scene){
 if(style==='mockup'){hideSurroundings(scene);modelScene(scene);scene.traverse(o=>{if(o.layers.mask===1<<FINE_DETAIL_LAYER)o.visible=false;});}
 else if(style==='lines'||style==='blueprint')hideSurroundings(scene);
 else if(style==='photoreal')tintLawn(scene);
}

/** Post-processing per style: ambient occlusion (desktop) and architectural line work. */
export function createPostFX(style:ViewStyle,renderer:T.WebGLRenderer,scene:T.Scene,camera:T.PerspectiveCamera,mobile:boolean){
 const edges:EdgeOptions|null=style==='sketch'?{line:'#151515',strength:.95,width:1.15}:style==='lines'?{line:'#2b2b2b',strength:1,width:1,background:'#f7f5ef'}:style==='blueprint'?{line:'#eef5ff',strength:1,width:1.1,background:'#1b4885',grid:'#4f7cba'}:null;
 const ao=!mobile&&(style==='mockup'||style==='lines');
 if(!edges&&!ao)return null;
 const size=renderer.getDrawingBufferSize(new T.Vector2()),width=Math.max(1,size.x),height=Math.max(1,size.y);
 const target=new T.WebGLRenderTarget(width,height,{type:T.HalfFloatType,samples:4});
 const composer=new EffectComposer(renderer,target);
 const faces=style==='lines'?new T.MeshLambertMaterial({color:'#ffffff'}):style==='blueprint'?new T.MeshBasicMaterial({color:'#2259a0'}):undefined;
 composer.addPass(new RenderPass(scene,camera,faces));
 let gtao:GTAOPass|null=null;
 if(ao){gtao=new GTAOPass(scene,camera,width,height);gtao.blendIntensity=style==='mockup'?.9:style==='lines'?.6:.55;gtao.updateGtaoMaterial({radius:1.2,distanceExponent:1.4,thickness:1,scale:1,samples:12});gtao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:5,rings:2,samples:12});composer.addPass(gtao);}
 let edgePass:EdgePass|null=null;if(edges){edgePass=new EdgePass(scene,camera,edges,width,height);composer.addPass(edgePass);}
 composer.addPass(new OutputPass());
 return {
  render(){composer.render();},
  setSize(w:number,h:number){composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(w,h);const s=renderer.getDrawingBufferSize(new T.Vector2());edgePass?.setSize(s.x,s.y);},
  dispose(){gtao?.dispose();edgePass?.dispose();faces?.dispose();composer.dispose();target.dispose();},
 };
}

/** The style picker: a small menu above the viewer's style button. */
export function openStylePicker(button:HTMLElement,onPick:(id:ViewStyle)=>void){
 const stage=button.closest('.stage')||document.body;stage.querySelector('.view-style-menu')?.remove();
 const menu=document.createElement('div');menu.className='view-style-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Graphics style');
 const close=()=>{menu.remove();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',keys,true);button.setAttribute('aria-expanded','false');button.focus();};
 const outside=(e:Event)=>{if(!menu.contains(e.target as Node)&&!button.contains(e.target as Node))close();};
 const keys=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();close();}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const items=[...menu.querySelectorAll<HTMLButtonElement>('button')];const i=items.indexOf(document.activeElement as HTMLButtonElement);items[(i+(e.key==='ArrowDown'?1:items.length-1))%items.length]?.focus();}};
 for(const s of VIEW_STYLES){const item=document.createElement('button');item.type='button';item.setAttribute('role','menuitemradio');item.setAttribute('aria-checked',String(s.id===current));item.dataset.style=s.id;
  const name=document.createElement('strong');name.textContent=s.label;const note=document.createElement('span');note.textContent=s.note;item.append(name,note);
  item.onclick=()=>{close();onPick(s.id);};menu.append(item);}
 stage.append(menu);button.setAttribute('aria-expanded','true');
 setTimeout(()=>{document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',keys,true);(menu.querySelector('[aria-checked=true]') as HTMLElement|null)?.focus();},0);
}
