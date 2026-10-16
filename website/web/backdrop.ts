import * as T from 'three';
import {GroundedSkybox} from 'three/examples/jsm/objects/GroundedSkybox.js';
// Surroundings: a real 360° photograph when one is installed in /backdrop (its ground is projected under
// the house, so the house appears to stand in the photo), otherwise a painted sky with soft cumulus over
// a lawn that fades into hazy hills. Nothing here is modeled scenery.
export const SKY={zenith:'#2f78cf',horizon:'#c4dbee',sun:new T.Vector3(-.42,.72,-.48).normalize()};
type Bounds={minX:number,minZ:number,maxX:number,maxZ:number};
function rng(seed:number){return()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};}

export function addSky(scene:T.Scene){
 const material=new T.ShaderMaterial({uniforms:{sunDir:{value:SKY.sun.clone()},zenith:{value:new T.Color(SKY.zenith)},horizon:{value:new T.Color(SKY.horizon)}},side:T.BackSide,depthWrite:false,fog:false,
  vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;gl_Position.z*=.99999;}`,
  fragmentShader:`uniform vec3 sunDir;uniform vec3 zenith;uniform vec3 horizon;varying vec3 vDir;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<6;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}
void main(){vec3 d=normalize(vDir);float y=max(d.y,0.);vec3 sky=mix(horizon,zenith,pow(y,.32));float s=max(dot(d,sunDir),0.);
sky+=vec3(1.,.9,.72)*(pow(s,10.)*.16+pow(s,90.)*.4)+vec3(1.,.98,.9)*smoothstep(.9994,.9997,s)*3.;
if(d.y>0.){vec2 uv=d.xz/(d.y+.1)*.42+vec2(3.1,7.4);float n=fbm(uv);float cover=smoothstep(.48,.72,n)*smoothstep(.0,.06,d.y);
float n2=fbm(uv+sunDir.xz*.05);float lit=clamp(.62+(n-n2)*5.,.3,1.12);vec3 cloud=mix(vec3(.62,.67,.75),vec3(1.,.995,.985),lit)+vec3(1.,.93,.8)*pow(s,6.)*.2;
sky=mix(sky,cloud,cover*.96);}
if(d.y<0.)sky=horizon;gl_FragColor=vec4(sky,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
 const dome=new T.Mesh(new T.SphereGeometry(500,48,24),material);dome.name='Sky';dome.frustumCulled=false;dome.renderOrder=-10;
 dome.onBeforeRender=(_r,_s,camera)=>{dome.position.copy(camera.position);dome.updateMatrixWorld();};
 scene.add(dome);scene.fog=new T.Fog(SKY.horizon,340,860);return dome;
}


// The photograph is described by /backdrop/backdrop.json:
// {"image":"street-8k.jpg","mobileImage":"street-4k.jpg","height":5.5,"radius":320,"rotation":0,"ground":"lawn","credit":"…"}
// height = camera height of the photo in feet, radius = how far its ground reaches, rotation in degrees;
// ground "photo" keeps the photograph's own ground under the house (shadows only), "lawn" lays sod over it.
type Photo={image:string,mobileImage?:string,height:number,radius:number,rotation:number,ground:'lawn'|'photo',groundTexture?:string,groundTile:number,groundRadius?:number,groundEdge?:[number,number][],lotEdge:number,scale:number,credit:string};
let photoRequest:Promise<{spec:Photo,texture:T.Texture,sun:T.Vector3|null}|null>|null=null;
let loadedPhoto:{spec:Photo,texture:T.Texture,sun:T.Vector3|null}|null=null;
const environments=new WeakMap<T.WebGLRenderer,T.WebGLRenderTarget>();
function parsePhoto(raw:any):Photo|null{
 const file=(v:unknown)=>typeof v==='string'&&/^[\w.-]{1,80}\.(jpe?g|webp|png)$/i.test(v);
 const num=(v:unknown,lo:number,hi:number,fallback:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi?v:fallback;
 if(!raw||typeof raw!=='object'||!file(raw.image))return null;
 const edge=Array.isArray(raw.groundEdge)&&raw.groundEdge.length>=3&&raw.groundEdge.length<=400&&raw.groundEdge.every((p:unknown)=>Array.isArray(p)&&p.length===2&&p.every(v=>typeof v==='number'&&Number.isFinite(v))&&p[0]>=0&&p[0]<=1&&p[1]>=1&&p[1]<=60)?[...raw.groundEdge].sort((a:number[],b:number[])=>a[0]!-b[0]!) as [number,number][]:undefined;
 return {lotEdge:num(raw.lotEdge,1,60,17.5),scale:num(raw.scale,1,10,1.6),groundEdge:edge,image:raw.image,mobileImage:file(raw.mobileImage)?raw.mobileImage:undefined,height:num(raw.height,1,40,5.5),radius:num(raw.radius,60,900,320),rotation:num(raw.rotation,-360,360,0),ground:raw.ground==='photo'?'photo':'lawn',groundTexture:file(raw.groundTexture)?raw.groundTexture:undefined,groundTile:num(raw.groundTile,1,100,14),groundRadius:typeof raw.groundRadius==='number'?num(raw.groundRadius,30,900,0)||undefined:undefined,credit:typeof raw.credit==='string'?raw.credit.slice(0,200):''};
}
function requestPhoto(mobile:boolean){
 photoRequest??=fetch('/backdrop/backdrop.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(async raw=>{const spec=parsePhoto(raw);if(!spec)return null;
  const texture=await new T.TextureLoader().loadAsync('/backdrop/'+(mobile&&spec.mobileImage?spec.mobileImage:spec.image));
  // One upload for the whole visit: scene rebuilds reuse this texture instead of disposing it.
  texture.mapping=T.EquirectangularReflectionMapping;texture.colorSpace=T.SRGBColorSpace;texture.userData.persistent=true;
  loadedPhoto={spec,texture,sun:photoSun(texture,spec.rotation)};return loadedPhoto;}).catch(()=>null);
 return photoRequest;
}
/** Where the sun is in the photograph (its brightest patch above the horizon), as a world direction. */
function photoSun(texture:T.Texture,rotation:number):T.Vector3|null{
 try{const image=texture.image as CanvasImageSource&{width:number,height:number};const W=256,H=128,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d',{willReadFrequently:true});if(!g)return null;g.drawImage(image,0,0,W,H);
  const px=g.getImageData(0,0,W,H/2).data;let best=0;for(let i=0;i<px.length;i+=4)best=Math.max(best,px[i]!+px[i+1]!+px[i+2]!);if(best<600)return null;
  let su=0,sv=0,n=0;for(let y=0;y<H/2;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;if(px[i]!+px[i+1]!+px[i+2]!>=best-6){su+=x+.5;sv+=y+.5;n++;}}
  if(!n||n>W*H*.02)return null;
  // GroundedSkybox maps image u to the angle 2πu around a sphere whose z is mirrored: x=-cos, z=-sin.
  const u=su/n/W,elevation=(.5-sv/n/H)*Math.PI,phi=u*Math.PI*2;
  return new T.Vector3(-Math.cos(phi)*Math.cos(elevation),Math.sin(elevation),-Math.sin(phi)*Math.cos(elevation)).applyAxisAngle(new T.Vector3(0,1,0),rotation*Math.PI/180).normalize();
 }catch{return null;}
}
function fadeMap(textures:T.Texture[],inner=.55){const cvs=document.createElement('canvas');cvs.width=cvs.height=256;const ctx=cvs.getContext('2d')!;const g=ctx.createRadialGradient(128,128,40,128,128,128);g.addColorStop(0,'#fff');g.addColorStop(inner,'#fff');g.addColorStop(1,'#000');ctx.fillStyle=g;ctx.fillRect(0,0,256,256);const t=new T.CanvasTexture(cvs);textures.push(t);return t;}

/** Depression angle (degrees below the horizon) where the photo's ground ends at image column u: the base of
 * the houses, trees and bushes in that direction. Linear between the measured points, wrapping around. */
function groundEdgeAt(edge:[number,number][],u:number){u=((u%1)+1)%1;for(let i=0;i<edge.length;i++){const a=edge[i]!,b=edge[(i+1)%edge.length]!;const ub=i+1<edge.length?b[0]:b[0]+1;const uu=u<a[0]?u+1:u;if(uu>=a[0]&&uu<=ub)return a[1]+(b[1]-a[1])*(uu-a[0])/Math.max(1e-6,ub-a[0]);}return edge[0]![1];}
/** Panorama streets run at a constant angle below the horizon, which would lay the street in front of the
 * lot out as an arc. Pushing each front direction out by 1/cos straightens it into one straight street across
 * the front (the photo's front is +x before rotation); behind and beside the lot there is no street, and the
 * stretch eases back to none at the rear. */
function blockShape(dx:number,_dz:number){return dx>0?1/Math.max(dx,.4):1+1.5*(1+dx)**2;}
/** A photo "stage": the panorama's ground lies flat at its true distance from the camera, and everything
 * standing on it (houses, trees, hedges) rises on an upright wall where it actually stands, all scaled by one
 * factor so nothing stretches. Seen from the photo's camera it is the photograph; from anywhere else the
 * street stays on the ground and the neighbours stay upright. */
function photoStage(texture:T.Texture,spec:Photo,scale:number,mobile:boolean){
 const edge=spec.groundEdge!,h=spec.height*scale,cols=mobile?160:320,deg=Math.PI/180;
 const rows:number[]=[];for(let b=-89.8;b<-32;b+=2)rows.push(b);for(let b=-32;b<14;b+=mobile?.5:.25)rows.push(b);for(let b=14;b<60;b+=2)rows.push(b);for(let b=60;b<=90.01;b+=3)rows.push(Math.min(b,89.9));
 const pos:number[]=[],uv:number[]=[],index:number[]=[];
 for(let i=0;i<=cols;i++){const u=i/cols,phi=u*Math.PI*2,dx=-Math.cos(phi),dz=-Math.sin(phi),tb=groundEdgeAt(edge,u)*deg,wall=h/Math.tan(tb),k=blockShape(dx,dz);
  for(const b of rows){const beta=b*deg;let r:number,y:number;
   if(beta<-tb){r=h/Math.tan(-beta);y=0;}
   else if(b<=60){r=wall;y=h+wall*Math.tan(beta);}
   else{const t=(b-60)/30;r=wall*(1-t);y=h+wall*Math.tan(60*deg)+wall*.6*t;}
   // Ground and walls follow a rounded square so the streets run straight along the block; heights keep
   // the photo's own distance so the houses keep their size.
   pos.push(dx*r*k,y,dz*r*k);uv.push(u,.5+beta/Math.PI);}}
 const n=rows.length;for(let i=0;i<cols;i++)for(let j=0;j<n-1;j++){const a=i*n+j,b=(i+1)*n+j;index.push(a,b,a+1,b,b+1,a+1);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(index);
 const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,fog:false}));mesh.rotation.y=spec.rotation*Math.PI/180;mesh.name='Photo surroundings';mesh.userData.backdrop=true;return mesh;
}
/** How far the photo's world reaches in a world direction (x, z), and the scale that keeps a lot clear of the
 * street and the neighbours: the house's footprint plus a yard must fit inside the photo's own lot edge. */
function stageFit(spec:Photo,site:{minX:number,minZ:number,maxX:number,maxZ:number}){
 const edge=spec.groundEdge!,rot=spec.rotation*Math.PI/180,deg=Math.PI/180;
 const uOf=(x:number,z:number)=>{const c=Math.cos(-rot),s=Math.sin(-rot);const lx=x*c+z*s,lz=-x*s+z*c;return ((Math.atan2(-lz,-lx)/(Math.PI*2))%1+1)%1;};
 // The photo's own scale (its far houses life-size) is the floor; a big house pushes everything out further.
 let scale=spec.scale;
 for(let k=0;k<96;k++){const a=k/96*Math.PI*2,x=Math.cos(a),z=Math.sin(a);
  const tx=x>1e-6?site.maxX/x:x<-1e-6?site.minX/x:Infinity,tz=z>1e-6?site.maxZ/z:z<-1e-6?site.minZ/z:Infinity;const need=Math.min(tx,tz)+10;
  const u=uOf(x,z),ph=u*Math.PI*2,lot=spec.height*blockShape(-Math.cos(ph),-Math.sin(ph))/Math.tan(Math.max(groundEdgeAt(edge,u),spec.lotEdge)*deg);scale=Math.max(scale,need/lot);}
 scale=Math.min(scale,8);
 // A lone tree trunk standing nearer than the houses behind it shouldn't hold the camera back.
 const open=(u:number)=>{let a=90;for(let k=-6;k<=6;k++)a=Math.min(a,groundEdgeAt(edge,u+k*.002));return a;};
 const reach=(x:number,z:number)=>{const u=uOf(x,z),ph=u*Math.PI*2;return spec.height*scale*blockShape(-Math.cos(ph),-Math.sin(ph))/Math.tan(open(u)*deg);};
 let far=0;for(let k=0;k<96;k++){const a=k/96*Math.PI*2;far=Math.max(far,reach(Math.cos(a),Math.sin(a)));}
 return {scale,reach,far,lot:spec.height*scale/Math.tan(spec.lotEdge*deg)};
}

/** Lawn, hills and, once available, the installed photograph. `site` is the lot in world feet. */
export function addSurroundings(scene:T.Scene,root:T.Object3D,o:{site:{minX:number,minZ:number,maxX:number,maxZ:number},groundY:number,mobile:boolean,textures:T.Texture[],grass:T.MeshStandardMaterial,renderer:T.WebGLRenderer,sky:T.Object3D,alive:()=>boolean,wake:(content?:boolean)=>void,onPhoto?:(sun:T.Vector3|null,radius:number,reach?:(x:number,z:number)=>number)=>void}){
 const {groundY:gy,textures}=o;const group=new T.Group();group.name='Surroundings';root.add(group);
 const grassRepeat=(mat:T.MeshStandardMaterial,size:number)=>{for(const key of ['map','normalMap','roughnessMap'] as const){const t=(o.grass as any)[key] as T.Texture|null;if(t){const c=t.clone();c.repeat.set(size/4.59,size/4.59);textures.push(c);(mat as any)[key]=c;}}return mat;};
 // Painted fallback: a broad lawn with gentle color variation and smooth hills lost in the haze.
 const painted=new T.Group();painted.name='Painted surroundings';group.add(painted);
 const ground=new T.PlaneGeometry(1700,1700,o.mobile?32:64,o.mobile?32:64);ground.rotateX(-Math.PI/2);const gc:number[]=[];const pos=ground.getAttribute('position');
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);const n=.5+.25*Math.sin(x*.021+Math.cos(z*.017)*2)+.25*Math.sin(z*.029+x*.011);const shade=.84+n*.2;gc.push(shade*.98,shade,shade*.9);}
 ground.setAttribute('color',new T.Float32BufferAttribute(gc,3));const lawnMat=grassRepeat(o.grass.clone(),1700);lawnMat.vertexColors=true;
 const lawn=new T.Mesh(ground,lawnMat);lawn.position.y=gy;lawn.receiveShadow=true;lawn.name='Lawn';painted.add(lawn);
 const segs=96,hp:number[]=[];for(let i=0;i<segs;i++){const a0=i/segs*Math.PI*2,a1=(i+1)/segs*Math.PI*2;const hgt=(a:number)=>18+14*Math.sin(a*3+1)+9*Math.sin(a*7+2)+5*Math.sin(a*13);const p=(a:number,r:number,y:number)=>[Math.cos(a)*r,y,Math.sin(a)*r];const q=[p(a0,600,gy),p(a1,600,gy),p(a1,700,gy+hgt(a1)),p(a0,700,gy+hgt(a0))];for(const v of [q[0],q[1],q[2],q[0],q[2],q[3]])hp.push(...v);}
 const hills=new T.BufferGeometry();hills.setAttribute('position',new T.Float32BufferAttribute(hp,3));hills.computeVertexNormals();const ridge=new T.Mesh(hills,new T.MeshStandardMaterial({color:'#5d7b55',roughness:1,side:T.DoubleSide}));ridge.name='Distant hills';painted.add(ridge);
 // Photograph: projected sky-and-ground panorama, its lighting used for reflections, and a soft lawn
 // under the lot that fades into the photo's own ground.
 const usePhoto=(photo:{spec:Photo,texture:T.Texture,sun:T.Vector3|null})=>{if(!o.alive())return;
  // Neighbouring houses in the photo look life-size when its sphere is about as far away as they were from the
  // camera; a large design pushes the sphere out (and the lawn with it) far enough that the camera can frame the whole house.
  const lot=o.site,fit=photo.spec.groundEdge?stageFit(photo.spec,lot):null;
  let sphere:number,grow:number;
  if(fit){const stage=photoStage(photo.texture,photo.spec,fit.scale,o.mobile);stage.position.y=gy-.02;group.add(stage);sphere=fit.far;grow=1;}
  else{sphere=Math.max(photo.spec.radius,Math.hypot(lot.maxX-lot.minX,lot.maxZ-lot.minZ)/2*5.4);grow=sphere/photo.spec.radius;
   const box=new GroundedSkybox(photo.texture,photo.spec.height,sphere,o.mobile?64:128);box.position.y=gy+photo.spec.height-.01;box.rotation.y=photo.spec.rotation*Math.PI/180;box.name='Photo surroundings';box.userData.backdrop=true;(box.material as T.MeshBasicMaterial).fog=false;group.add(box);}
  // On a stage the lawn covers only the lot, stopping short of the sidewalk so the street stays in view.
  const {minX,minZ,maxX,maxZ}=o.site,wide=fit?fit.lot*.97:photo.spec.groundRadius&&Math.min(photo.spec.groundRadius*grow,sphere*.95),cx=wide?0:(minX+maxX)/2,cz=wide?0:(minZ+maxZ)/2,radius=wide??Math.hypot(maxX-minX,maxZ-minZ)/2+60;
  // The lot itself: the photo's ground stretches into a blur close to the camera, so a tiling texture of the
  // same ground (or a lawn) covers the lot and fades into the photograph; shadows fall on it either way.
  let pad:T.Material;
  if(photo.spec.ground==='photo'&&!photo.spec.groundTexture)pad=new T.ShadowMaterial({opacity:.42,depthWrite:false});
  else{const mat=photo.spec.ground==='photo'?new T.MeshStandardMaterial({color:'#ffffff',roughness:1}):grassRepeat(o.grass.clone(),radius*2);
   if(photo.spec.ground==='photo'){const tile=new T.TextureLoader().load('/backdrop/'+photo.spec.groundTexture,()=>o.wake(true));tile.colorSpace=T.SRGBColorSpace;tile.wrapS=tile.wrapT=T.RepeatWrapping;tile.anisotropy=8;tile.repeat.set(radius*2/photo.spec.groundTile,radius*2/photo.spec.groundTile);textures.push(tile);mat.map=tile;}
   // A wide lawn (groundRadius) covers the photo's whole stretched floor, with gentle colour variation so the
   // tiling never repeats visibly, and fades out only near the photograph's own lawns at the horizon.
   if(wide&&photo.spec.ground==='lawn'){const lawn=mat as T.MeshStandardMaterial;lawn.vertexColors=true;
    // Sun-warmed yellow-green like the photograph's lawns: less blue in the albedo, plus a little of the grass
    // texture's own colour as fill light so the low afternoon sun doesn't leave the lot dull and grey.
    lawn.color.setRGB(1,1,.55);lawn.emissiveMap=lawn.map;lawn.emissive.setRGB(.42,.4,.1);}
   mat.alphaMap=fadeMap(textures,wide?.82:.55);mat.transparent=true;mat.depthWrite=false;pad=mat;}const discGeometry=new T.CircleGeometry(radius,wide?96:64,0,Math.PI*2).rotateX(-Math.PI/2);if(wide){const rings=new T.RingGeometry(0,radius,96,48).rotateX(-Math.PI/2);discGeometry.copy(rings);rings.dispose();const p=discGeometry.getAttribute('position'),c:number[]=[];for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),n=.5+.25*Math.sin(x*.021+Math.cos(z*.017)*2)+.25*Math.sin(z*.029+x*.011),shade=.88+n*.16;c.push(shade,shade,shade*.96);}discGeometry.setAttribute('color',new T.Float32BufferAttribute(c,3));}
  const disc=new T.Mesh(discGeometry,pad);disc.position.set(cx,gy+.01,cz);disc.receiveShadow=true;disc.name='Lot lawn';group.add(disc);
  painted.visible=false;o.sky.visible=false;scene.fog=null;
  let env=environments.get(o.renderer);if(!env){const pm=new T.PMREMGenerator(o.renderer);env=pm.fromEquirectangular(photo.texture);pm.dispose();env.texture.userData.persistent=true;environments.set(o.renderer,env);}
  scene.environment=env.texture;scene.environmentIntensity=.9;scene.userData.photoEnvironment=true;scene.userData.photoBackdrop=true;scene.userData.photoSun=photo.sun;scene.userData.photoRadius=sphere;scene.userData.photoReach=fit?.reach;o.onPhoto?.(photo.sun,sphere,fit?.reach);o.wake(true);};
 if(loadedPhoto)usePhoto(loadedPhoto);else requestPhoto(o.mobile).then(p=>{if(p)usePhoto(p);});
 return group;
}
