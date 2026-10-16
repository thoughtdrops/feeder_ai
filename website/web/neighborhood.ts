import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {roofMaterial} from './roofing';

// A modeled neighborhood around the lot: one straight residential street in front with curbs, sidewalks,
// tree lawns and driveways; finished two-story homes across the street and beside the lot; mature street
// trees (baked from ez-tree, MIT, Daniel Greenheck) and a wooded backdrop. Everything is built once per
// page and reused across scene rebuilds: textures are drawn on canvases, houses are merged into a few draw
// calls each and trees are instanced, so the whole street costs little more than one extra house.

type Site={minX:number,minZ:number,maxX:number,maxZ:number};
type Opts={site:Site,groundY:number,mobile:boolean,anisotropy:number};
function rng(seed:number){return()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};}

// ---------- Canvas textures (persistent: drawn once, never disposed) ----------
const canvasTextures=new Map<string,T.CanvasTexture>();
function canvasTexture(key:string,size:number,draw:(c:CanvasRenderingContext2D,s:number,r:()=>number)=>void,srgb=true){
 const hit=canvasTextures.get(key);if(hit)return hit;
 const cvs=document.createElement('canvas');cvs.width=cvs.height=size;const ctx=cvs.getContext('2d')!;draw(ctx,size,rng(key.length*7919+size));
 const t=new T.CanvasTexture(cvs);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;if(srgb)t.colorSpace=T.SRGBColorSpace;t.userData.persistent=true;canvasTextures.set(key,t);return t;
}
function speckle(c:CanvasRenderingContext2D,s:number,r:()=>number,count:number,base:number,spread:number,alpha:number,size=1.6){for(let i=0;i<count;i++){const g=base+(r()-.5)*spread;c.fillStyle=`rgba(${g},${g},${g},${alpha})`;c.fillRect(r()*s,r()*s,.6+r()*size,.6+r()*size);}}
function blotches(c:CanvasRenderingContext2D,s:number,r:()=>number,count:number,rgb:string,alpha:number,radius:number){for(let i=0;i<count;i++){const x=r()*s,y=r()*s,rad=radius*(.4+r());const g=c.createRadialGradient(x,y,0,x,y,rad);g.addColorStop(0,`rgba(${rgb},${alpha*r()})`);g.addColorStop(1,`rgba(${rgb},0)`);c.fillStyle=g;c.fillRect(x-rad,y-rad,rad*2,rad*2);}}
// Asphalt: dark binder, light and dark aggregate, faint patching. One tile spans 12 ft.
const asphalt=()=>canvasTexture('asphalt',1024,(c,s,r)=>{c.fillStyle='#46484a';c.fillRect(0,0,s,s);blotches(c,s,r,40,'30,31,33',.35,140);blotches(c,s,r,25,'95,96,96',.18,120);speckle(c,s,r,60000,90,120,.55,1.4);speckle(c,s,r,9000,170,60,.5,1.2);speckle(c,s,r,9000,25,20,.6,1.4);});
// Broom-finished concrete with 5-ft control joints (one tile = 5 × 5 ft).
const slab=()=>canvasTexture('slab',512,(c,s,r)=>{c.fillStyle='#c4c1b9';c.fillRect(0,0,s,s);blotches(c,s,r,30,'150,146,138',.25,90);blotches(c,s,r,20,'225,222,214',.25,90);for(let y=0;y<s;y+=2){c.fillStyle=`rgba(0,0,0,${.02+r()*.03})`;c.fillRect(0,y,s,1);}speckle(c,s,r,14000,150,90,.35,1.2);c.fillStyle='rgba(60,58,55,.75)';c.fillRect(0,0,s,3);c.fillRect(0,0,3,s);});
const plainConcrete=()=>canvasTexture('concrete',512,(c,s,r)=>{c.fillStyle='#cbc8c0';c.fillRect(0,0,s,s);blotches(c,s,r,30,'150,146,138',.22,90);speckle(c,s,r,14000,150,90,.3,1.2);});
// Lap siding, 6-in reveal: each board lighter at the top, a crisp shadow under its lap. Tile = 4 ft high.
const siding=()=>canvasTexture('siding',512,(c,s,r)=>{const boards=8,b=s/boards;for(let i=0;i<boards;i++){const y=i*b;const g=c.createLinearGradient(0,y,0,y+b);g.addColorStop(0,'#ffffff');g.addColorStop(.85,'#ebebeb');g.addColorStop(1,'#cfcfcf');c.fillStyle=g;c.fillRect(0,y,s,b);c.fillStyle='rgba(0,0,0,.34)';c.fillRect(0,y+b-3,s,3);for(let k=0;k<60;k++){c.fillStyle=`rgba(0,0,0,${r()*.035})`;c.fillRect(r()*s,y+r()*b,40+r()*120,1);}}});
// Raised-panel sectional garage door, 4 sections of 8 panels (texture spans one 16 × 7 ft door).
const garageDoor=()=>canvasTexture('garage-door',1024,(c,s)=>{c.fillStyle='#f3f3f1';c.fillRect(0,0,s,s);const rows=4,cols=8,ph=s/rows,pw=s/cols;for(let y=0;y<rows;y++){c.fillStyle='rgba(0,0,0,.28)';c.fillRect(0,y*ph,s,4);for(let x=0;x<cols;x++){const x0=x*pw+10,y0=y*ph+18,w=pw-20,h=ph-36;c.fillStyle='rgba(0,0,0,.10)';c.fillRect(x0,y0,w,h);c.fillStyle='rgba(255,255,255,.9)';c.fillRect(x0,y0,w,3);c.fillRect(x0,y0,3,h);c.fillStyle='rgba(0,0,0,.25)';c.fillRect(x0,y0+h-3,w,3);c.fillRect(x0+w-3,y0,3,h);}}});
// Louvered shutter.
const shutterTex=()=>canvasTexture('shutter',256,(c,s)=>{c.fillStyle='#ffffff';c.fillRect(0,0,s,s);for(let y=12;y<s-12;y+=10){c.fillStyle='rgba(0,0,0,.35)';c.fillRect(14,y+7,s-28,3);c.fillStyle='rgba(255,255,255,.6)';c.fillRect(14,y,s-28,2);}c.strokeStyle='rgba(0,0,0,.45)';c.lineWidth=8;c.strokeRect(6,6,s-12,s-12);});

// ---------- Geometry helpers (UVs in feet so textures keep real scale) ----------
type Bucket=Map<string,T.BufferGeometry[]>;
const put=(b:Bucket,key:string,g:T.BufferGeometry)=>{let list=b.get(key);if(!list)b.set(key,list=[]);list.push(g);};
/** Quad from four corners (counter-clockwise seen from the front); u along p0→p1, v along p0→p3, in feet ÷ tile. */
function quad(p:T.Vector3[],tileU:number,tileV:number,offsetU=0,offsetV=0){
 const g=new T.BufferGeometry(),a=p[1]!.clone().sub(p[0]!),b=p[3]!.clone().sub(p[0]!),n=new T.Vector3().crossVectors(a,b).normalize(),au=a.clone().normalize(),bv=b.clone().sub(au.clone().multiplyScalar(b.dot(au))).normalize();
 const pos:number[]=[],uv:number[]=[],nor:number[]=[];for(const q of p){pos.push(q.x,q.y,q.z);const d=q.clone().sub(p[0]!);uv.push((d.dot(au)+offsetU)/tileU,(d.dot(bv)+offsetV)/tileV);nor.push(n.x,n.y,n.z);}
 g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex([0,1,2,0,2,3]);return g;
}
function tri(p:T.Vector3[],tileU:number,tileV:number){const g=quad([p[0]!,p[1]!,p[2]!,p[2]!],tileU,tileV);g.setIndex([0,1,2]);return g;}
function box(cx:number,cy:number,cz:number,sx:number,sy:number,sz:number,ry=0){const g=new T.BoxGeometry(sx,sy,sz);if(ry)g.rotateY(ry);g.translate(cx,cy,cz);return g;}
const V=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);

// ---------- Shared materials ----------
type Mats=Record<string,T.Material>;
function materials(o:Opts):Mats{
 const tex=(t:T.Texture,rx:number,ry:number)=>{const c=t.clone();c.repeat.set(rx,ry);c.userData.persistent=true;c.needsUpdate=true;return c;};
 const std=(p:T.MeshStandardMaterialParameters)=>new T.MeshStandardMaterial(p);
 const m:Mats={
  asphalt:std({map:asphalt(),bumpMap:asphalt(),bumpScale:1.2,roughness:.92,color:'#ffffff'}),
  slab:std({map:slab(),bumpMap:slab(),bumpScale:.6,roughness:.85}),
  concrete:std({map:plainConcrete(),bumpMap:plainConcrete(),bumpScale:.5,roughness:.85}),
  trim:std({color:'#f4f2ec',roughness:.55}),
  soffit:std({color:'#ece9e1',roughness:.7}),
  glass:new T.MeshPhysicalMaterial({color:'#3b4c5a',roughness:.04,metalness:.15,envMapIntensity:1.7,clearcoat:.4,clearcoatRoughness:.05}),
  muntin:std({color:'#f6f4ef',roughness:.5}),
  gutter:std({color:'#eeeeea',roughness:.4,metalness:.2}),
  garage:std({map:garageDoor(),bumpMap:garageDoor(),bumpScale:2,roughness:.5,color:'#f7f6f2'}),
  doorNavy:std({color:'#1f2c3d',roughness:.35}),doorBlack:std({color:'#1a1b1d',roughness:.35}),doorOak:std({color:'#6b4a2c',roughness:.5}),
  brass:std({color:'#b08d4a',roughness:.3,metalness:.9}),
  lamp:std({color:'#1c1d1f',roughness:.45,metalness:.6}),lampGlass:std({color:'#fff3d6',emissive:'#ffe2a8',emissiveIntensity:.25,roughness:.2}),
  mailbox:std({color:'#202224',roughness:.5,metalness:.3}),
 };
 for(const k of Object.keys(m))m[k]!.userData.persistent=true;
 void o;void tex;return m;
}
const sidingMats=new Map<string,T.MeshStandardMaterial>();
function sidingMat(color:string){let m=sidingMats.get(color);if(!m){const t=siding();m=new T.MeshStandardMaterial({color,map:t,bumpMap:t,bumpScale:1.4,roughness:.72,side:T.DoubleSide});m.userData.persistent=true;sidingMats.set(color,m);}return m;}
const shutterMats=new Map<string,T.MeshStandardMaterial>();
function shutterMat(color:string){let m=shutterMats.get(color);if(!m){const t=shutterTex();m=new T.MeshStandardMaterial({color,map:t,bumpMap:t,bumpScale:1,roughness:.5});m.userData.persistent=true;shutterMats.set(color,m);}return m;}
const loadedMaps=new Map<string,T.Texture>();
function photoMap(url:string,srgb=true){let t=loadedMaps.get(url);if(!t){t=new T.TextureLoader().load(url);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;if(srgb)t.colorSpace=T.SRGBColorSpace;t.userData.persistent=true;loadedMaps.set(url,t);}return t;}
const stoneMat=()=>{const m=new T.MeshStandardMaterial({map:photoMap('/materials/stone-diff.jpg'),normalMap:photoMap('/materials/stone-nor_gl.jpg',false),roughness:.9,color:'#d8d2c8'});return m;};
const brickMat=()=>new T.MeshStandardMaterial({map:photoMap('/materials/brick-diff.jpg'),normalMap:photoMap('/materials/brick-nor_gl.jpg',false),roughness:.85});

// ---------- One finished house ----------
type HouseSpec={w:number,d:number,roof:'gable'|'hip',garage:-1|0|1,siding:string,roofColor:string,shutters:string|null,door:'doorNavy'|'doorBlack'|'doorOak',chimney:boolean,porch:boolean,seed:number};
const PITCH=8/12,FLOOR=9.5,PLINTH=1.6,OVER=1.3;
/** A two-story home with its front wall on z = 0 facing +z, centered on x = 0 (its garage, if any, extends sideways). */
function house(spec:HouseSpec,mats:Mats,roofMats:Map<string,T.Material>):T.Group{
 const b:Bucket=new Map(),{w,d}=spec,eave=PLINTH+FLOOR*2,sidingKey='siding:'+spec.siding;
 // Stone plinth, then siding walls (tile 4 ft wide × 4 ft tall).
 const walls:[T.Vector3,T.Vector3][]=[[V(-w/2,0,0),V(w/2,0,0)],[V(w/2,0,0),V(w/2,0,-d)],[V(w/2,0,-d),V(-w/2,0,-d)],[V(-w/2,0,-d),V(-w/2,0,0)]];
 for(const [a,c] of walls){put(b,'stone',quad([V(a.x,0,a.z),V(c.x,0,c.z),V(c.x,PLINTH,c.z),V(a.x,PLINTH,a.z)],5,5));put(b,sidingKey,quad([V(a.x,PLINTH,a.z),V(c.x,PLINTH,c.z),V(c.x,eave,c.z),V(a.x,eave,a.z)],4,4));}
 // Corner boards.
 for(const [x,z] of [[-w/2,0],[w/2,0],[w/2,-d],[-w/2,-d]] as const)put(b,'trim',box(x,(PLINTH+eave)/2,z,.55,eave-PLINTH,.55));
 put(b,'trim',box(0,PLINTH+FLOOR,.02,w+.3,.5,.12));put(b,'trim',box(0,PLINTH+FLOOR,-d-.02,w+.3,.5,.12));
 // Roof.
 const roofKey='roof:'+spec.roofColor,rise=d/2*PITCH,ridgeY=eave+rise,ey=eave-OVER*PITCH,slope=Math.hypot(1,PITCH);
 const fz=OVER,bz=-d-OVER,xl=-w/2-OVER,xr=w/2+OVER,course=3.75;
 if(spec.roof==='gable'){
  put(b,roofKey,quad([V(xl,ey,fz),V(xr,ey,fz),V(xr,ridgeY,-d/2),V(xl,ridgeY,-d/2)],4,course));
  put(b,roofKey,quad([V(xr,ey,bz),V(xl,ey,bz),V(xl,ridgeY,-d/2),V(xr,ridgeY,-d/2)],4,course));
  for(const sx of [-1,1]){const x=sx*w/2;const p=sx>0?[V(x,eave,0),V(x,eave,-d),V(x,ridgeY,-d/2)]:[V(x,eave,-d),V(x,eave,0),V(x,ridgeY,-d/2)];put(b,sidingKey,tri(p,4,4));
   // Rake boards along both gable edges.
   for(const [z0,z1] of [[fz,-d/2],[bz,-d/2]] as const){const a=V(sx*(w/2+OVER)-sx*.05,z0===fz?ey:ey,z0),c=V(sx*(w/2+OVER)-sx*.05,ridgeY,z1);const mid=a.clone().add(c).multiplyScalar(.5),len=a.distanceTo(c);const g=new T.BoxGeometry(.12,.75,len);g.rotateX(Math.atan2(c.y-a.y,Math.abs(c.z-a.z))*(z0>z1?1:-1));g.translate(mid.x,mid.y,mid.z);put(b,'trim',g);}}
  put(b,'trim',box(0,ridgeY+.08,-d/2,w+2*OVER,.22,.5));
 }else{
  const hx=Math.max(0,w/2-d/2);
  put(b,roofKey,quad([V(xl,ey,fz),V(xr,ey,fz),V(hx,ridgeY,-d/2),V(-hx,ridgeY,-d/2)],4,course));
  put(b,roofKey,quad([V(xr,ey,bz),V(xl,ey,bz),V(-hx,ridgeY,-d/2),V(hx,ridgeY,-d/2)],4,course));
  put(b,roofKey,tri([V(xr,ey,fz),V(xr,ey,bz),V(hx,ridgeY,-d/2)],4,course));put(b,roofKey,tri([V(xl,ey,bz),V(xl,ey,fz),V(-hx,ridgeY,-d/2)],4,course));
  put(b,'trim',box(0,ridgeY+.08,-d/2,2*hx+.4,.22,.5));
 }
 // Soffits, fascia and gutters along the eaves.
 put(b,'soffit',quad([V(xl,eave-.05,0),V(xr,eave-.05,0),V(xr,eave-.05,fz),V(xl,eave-.05,fz)],4,4));put(b,'soffit',quad([V(xr,eave-.05,-d),V(xl,eave-.05,-d),V(xl,eave-.05,bz),V(xr,eave-.05,bz)],4,4));
 for(const z of [fz,bz]){put(b,'trim',box(0,ey-.25,z,xr-xl,.7,.12));put(b,'gutter',box(0,ey-.2,z+(z>0?.22:-.22),xr-xl,.38,.38));}
 for(const [x,z] of [[xl+.5,fz+.2],[xr-.5,fz+.2],[xl+.5,bz-.2],[xr-.5,bz-.2]] as const)put(b,'gutter',box(x,ey/2,z,.28,ey,.22));
 // Windows: a bay grid on the front (door in the middle bay), two per floor on the sides, a row on the back.
 const r=rng(spec.seed);const shutters=spec.shutters;
 const windowAt=(x:number,y:number,z:number,ry:number,ww:number,wh:number,shut:boolean)=>{
  const s=Math.sin(ry),c=Math.cos(ry),place=(g:T.BufferGeometry,dx:number,dy:number,dz:number)=>{g.rotateY(ry);g.translate(x+dx*c+dz*s,y+dy,z-dx*s+dz*c);return g;};
  put(b,'glass',place(new T.PlaneGeometry(ww,wh),0,wh/2,.03));
  for(const [dx,dy,sx,sy] of [[0,wh+.17,ww+.7,.34],[0,-.12,ww+.9,.24],[-ww/2-.17,wh/2,.34,wh+.2],[ww/2+.17,wh/2,.34,wh+.2]] as const)put(b,'trim',place(new T.BoxGeometry(sx,sy,.32),dx,dy,.04));
  // Colonial grilles: 2 columns × 2 rows per sash pair.
  put(b,'muntin',place(new T.BoxGeometry(.07,wh,.06),0,wh/2,.08));put(b,'muntin',place(new T.BoxGeometry(ww,.1,.08),0,wh*.5,.08));for(const fy of [.25,.75])put(b,'muntin',place(new T.BoxGeometry(ww,.05,.05),0,wh*fy,.08));
  if(shut&&shutters){for(const sx of [-1,1])put(b,'shutter:'+shutters,place(new T.BoxGeometry(ww*.48,wh+.1,.1),sx*(ww/2+.42+ww*.24),wh/2,.08));}
 };
 const bays=Math.max(3,Math.round(w/9)|1),bw=w/bays,mid=Math.floor(bays/2);
 for(let i=0;i<bays;i++){const x=-w/2+bw*(i+.5);windowAt(x,PLINTH+FLOOR+2.6,0,0,3,5,true);if(i!==mid)windowAt(x,PLINTH+2.6,0,0,3,5.2,true);windowAt(x,PLINTH+FLOOR+2.6,-d,Math.PI,3,5,false);windowAt(x,PLINTH+2.6,-d,Math.PI,3,5,false);}
 for(const sx of [-1,1])for(const f of [0,1])for(const fz2 of [-d*.3,-d*.7]){if(spec.garage===sx&&f===0)continue;windowAt(sx*w/2,PLINTH+f*FLOOR+2.6,fz2,sx*Math.PI/2,2.8,4.6,false);}
 // Front door with a portico.
 const dx=-w/2+bw*(mid+.5);put(b,spec.door,box(dx,PLINTH+3.5,.05,3.3,7,.18));put(b,'trim',box(dx,PLINTH+7.35,.12,4.6,.5,.3));for(const sx of [-1,1])put(b,'trim',box(dx+sx*2,PLINTH+3.6,.12,.45,7.3,.3));put(b,'glass',box(dx,PLINTH+7.95,.1,3.3,.7,.05));put(b,'brass',box(dx+1.2,PLINTH+3.3,.25,.12,.5,.12));
 for(let k=0;k<3;k++)put(b,'concrete',box(dx,PLINTH-(k+.5)*.53,1.2+k*1.1,7.5,.53,1.2+(2-k)*0));
 put(b,'concrete',box(dx,PLINTH-.26,2.2,8,.52,4.4));
 if(spec.porch){const pz=4.6,ph=PLINTH+9;for(const sx of [-1,1]){const col=new T.CylinderGeometry(.42,.48,ph-PLINTH,16);col.translate(dx+sx*3.4,(ph+PLINTH)/2,pz);put(b,'trim',col);}
  const pr=2.3;put(b,roofKey,quad([V(dx-4.4,ph,pz+.8),V(dx+4.4,ph,pz+.8),V(dx+4.4,ph+pr,0),V(dx-4.4,ph+pr,0)],4,course));put(b,'trim',box(dx,ph-.25,pz+.6,8.8,.6,.25));put(b,'soffit',box(dx,ph-.1,pz/2,8.6,.1,pz));}
 // Chimney.
 if(spec.chimney){const cx=(r()<.5?-1:1)*w/2;put(b,'brick',box(cx+(cx<0?-1.4:1.4),(ridgeY+3)/2,-d*.5,2.8,ridgeY+3,5));put(b,'concrete',box(cx+(cx<0?-1.4:1.4),ridgeY+3.1,-d*.5,3.2,.3,5.4));}
 // Attached two-car garage, set back 2 ft, front-gable roof.
 if(spec.garage){const gw=23,gd=24,gh=PLINTH+9.5,gx=spec.garage*(w/2+gw/2),gz=-2,gr=gw/2*PITCH*.8;
  const g0=gx-gw/2,g1=gx+gw/2,zf=gz,zb=gz-gd;
  for(const [a,c] of [[V(g0,0,zf),V(g1,0,zf)],[V(g1,0,zf),V(g1,0,zb)],[V(g1,0,zb),V(g0,0,zb)],[V(g0,0,zb),V(g0,0,zf)]] as [T.Vector3,T.Vector3][]){put(b,'stone',quad([V(a.x,0,a.z),V(c.x,0,c.z),V(c.x,PLINTH*.6,c.z),V(a.x,PLINTH*.6,a.z)],5,5));put(b,sidingKey,quad([V(a.x,PLINTH*.6,a.z),V(c.x,PLINTH*.6,c.z),V(c.x,gh,c.z),V(a.x,gh,a.z)],4,4));}
  put(b,sidingKey,tri([V(g0,gh,zf+.01),V(g1,gh,zf+.01),V(gx,gh+gr,zf+.01)],4,4));
  const go=1.2,gey=gh-go*PITCH*.8;put(b,roofKey,quad([V(g0-go,gey,zf+go),V(gx,gh+gr,zf+go),V(gx,gh+gr,zb-go),V(g0-go,gey,zb-go)],4,course));put(b,roofKey,quad([V(gx,gh+gr,zf+go),V(g1+go,gey,zf+go),V(g1+go,gey,zb-go),V(gx,gh+gr,zb-go)],4,course));
  for(const sx of [-1,1]){const a=V(gx+sx*(gw/2+go),gey,zf+go),c=V(gx,gh+gr,zf+go);const m2=a.clone().add(c).multiplyScalar(.5);const g=new T.BoxGeometry(a.distanceTo(c),.7,.14);g.rotateZ(Math.atan2(c.y-a.y,c.x-a.x));g.translate(m2.x,m2.y,m2.z+.05);put(b,'trim',g);put(b,'gutter',box(gx+sx*(gw/2+go),gey-.2,(zf+zb)/2,.38,.38,gd+2*go));}
  put(b,'garage',quad([V(gx-8,.05,zf+.08),V(gx+8,.05,zf+.08),V(gx+8,7.3,zf+.08),V(gx-8,7.3,zf+.08)],16,7.25));
  for(const [ox,sx2,sy2,oy] of [[0,17.2,.5,7.55],[-8.35,.5,7.6,3.8],[8.35,.5,7.6,3.8]] as const)put(b,'trim',box(gx+ox,oy,zf+.15,sx2,sy2,.25));
  for(const sx of [-1,1]){put(b,'lamp',box(gx+sx*9.4,6.4,zf+.35,.55,1.1,.45));put(b,'lampGlass',box(gx+sx*9.4,6.35,zf+.62,.4,.75,.05));}
 }
 // Foundation shrubs are added as tree instances by the caller.
 const group=new T.Group();group.name='Neighbor house';
 for(const [key,list] of b){const geo=mergeGeometries(list.map(g=>g.index?g.toNonIndexed():g).map(g=>{g.deleteAttribute('uv1' as any);return g;}),false);for(const g of list)g.dispose();if(!geo)continue;
  const mat=key.startsWith('siding:')?sidingMat(key.slice(7)):key.startsWith('roof:')?roofMats.get(key.slice(5))!:key.startsWith('shutter:')?shutterMat(key.slice(8)):mats[key]!;
  const mesh=new T.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name='Neighbor '+key;group.add(mesh);}
 return group;
}

// ---------- Trees: decode the baked binary into geometries ----------
type TreeVariant={name:string,height:number,branches:T.BufferGeometry,leaves:T.BufferGeometry,leavesFar:T.BufferGeometry,bark:string,leaf:string,barkScale:{x:number,y:number}};
let treeRequest:Promise<TreeVariant[]|null>|null=null;
function loadTrees(){
 treeRequest??=fetch('/neighborhood/trees.bin').then(r=>r.ok?r.arrayBuffer():null).then(buf=>{if(!buf)return null;
  const hlen=new DataView(buf).getUint32(0,true),header=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,4,hlen)));const base=4+hlen+((4-(4+hlen)%4)%4);
  const out:TreeVariant[]=[];
  for(const v of header.variants){
   const B=v.branches,L=v.leaves;
   const q=new Uint16Array(buf,base+B.pos,B.count*3),qn=new Int8Array(buf,base+B.nor,B.count*3),qu=new Int16Array(buf,base+B.uv,B.count*2);
   const pos=new Float32Array(B.count*3),nor=new Float32Array(B.count*3),uv=new Float32Array(B.count*2);
   for(let i=0;i<B.count*3;i++){const k=i%3;pos[i]=B.min[k]+q[i]!/65535*(B.max[k]-B.min[k]);nor[i]=qn[i]!/127;}for(let i=0;i<B.count*2;i++)uv[i]=qu[i]!/32767*B.uvScale;
   const branches=new T.BufferGeometry();branches.setAttribute('position',new T.BufferAttribute(pos,3));branches.setAttribute('normal',new T.BufferAttribute(nor,3));branches.setAttribute('uv',new T.BufferAttribute(uv,2));
   if(B.index>=0)branches.setIndex(new T.BufferAttribute(B.index32?new Uint32Array(buf.slice(base+B.index,base+B.index+B.indexCount*4)):new Uint16Array(buf.slice(base+B.index,base+B.index+B.indexCount*2)),1));
   // Leaves: rebuild both crossed cards per leaf; normals point out of the canopy for soft, rounded light.
   const lo=new Uint16Array(buf,base+L.origin,L.count*3),ld=new Int8Array(buf,base+L.dirs,L.count*6),ls=new Uint8Array(buf,base+L.size,L.count);
   const cards=L.double?2:1,lp=new Float32Array(L.count*cards*12),ln=new Float32Array(L.count*cards*12),lu=new Float32Array(L.count*cards*8),li=new Uint32Array(L.count*cards*6);
   const height=Math.max(B.max[1],L.max[1]),center=new T.Vector3(0,height*.62,0);const o=new T.Vector3(),u=new T.Vector3(),r=new T.Vector3(),r2=new T.Vector3(),n=new T.Vector3(),tmp=new T.Vector3();
   let vi=0,ii=0;
   for(let i=0;i<L.count;i++){
    o.set(L.min[0]+lo[i*3]!/65535*(L.max[0]-L.min[0]),L.min[1]+lo[i*3+1]!/65535*(L.max[1]-L.min[1]),L.min[2]+lo[i*3+2]!/65535*(L.max[2]-L.min[2]));
    u.set(ld[i*6]!,ld[i*6+1]!,ld[i*6+2]!).normalize();r.set(ld[i*6+3]!,ld[i*6+4]!,ld[i*6+5]!).normalize();const size=ls[i]!/255*L.sizeMax;
    n.copy(o).sub(center).normalize().lerp(new T.Vector3(0,1,0),.25).normalize();
    for(let k=0;k<cards;k++){const right=k===0?r:r2.crossVectors(u,r).normalize();
     const corners=[[-.5,1],[-.5,0],[.5,0],[.5,1]] as const;const start=vi;
     for(const [cx,cy] of corners){tmp.copy(o).addScaledVector(right,cx*size).addScaledVector(u,cy*size);lp[vi*3]=tmp.x;lp[vi*3+1]=tmp.y;lp[vi*3+2]=tmp.z;ln[vi*3]=n.x;ln[vi*3+1]=n.y;ln[vi*3+2]=n.z;lu[vi*2]=cx+.5;lu[vi*2+1]=cy;vi++;}
     li.set([start,start+1,start+2,start,start+2,start+3],ii);ii+=6;}
   }
   const leaves=new T.BufferGeometry();leaves.setAttribute('position',new T.BufferAttribute(lp,3));leaves.setAttribute('normal',new T.BufferAttribute(ln,3));leaves.setAttribute('uv',new T.BufferAttribute(lu,2));leaves.setIndex(new T.BufferAttribute(li,1));
   // Distant trees: every third leaf, half again as large, so the canopy reads the same at a third of the cost.
   const quads=L.count*cards,keep:number[]=[];for(let qd=0;qd<quads;qd++)if(Math.floor(qd/cards)%3===0)keep.push(qd);
   const fp=new Float32Array(keep.length*12),fn=new Float32Array(keep.length*12),fu=new Float32Array(keep.length*8),fi=new Uint32Array(keep.length*6);
   keep.forEach((qd,k)=>{const b0=qd*4;const cx=(lp[b0*3]!+lp[(b0+2)*3]!)/2,cy=(lp[(b0+1)*3+1]!+lp[b0*3+1]!)/2,cz=(lp[b0*3+2]!+lp[(b0+2)*3+2]!)/2;
    for(let c=0;c<4;c++){for(let a=0;a<3;a++){const v=lp[(b0+c)*3+a]!,m=[cx,cy,cz][a]!;fp[(k*4+c)*3+a]=m+(v-m)*1.55;fn[(k*4+c)*3+a]=ln[(b0+c)*3+a]!;}fu[(k*4+c)*2]=lu[(b0+c)*2]!;fu[(k*4+c)*2+1]=lu[(b0+c)*2+1]!;}
    fi.set([k*4,k*4+1,k*4+2,k*4,k*4+2,k*4+3],k*6);});
   const leavesFar=new T.BufferGeometry();leavesFar.setAttribute('position',new T.BufferAttribute(fp,3));leavesFar.setAttribute('normal',new T.BufferAttribute(fn,3));leavesFar.setAttribute('uv',new T.BufferAttribute(fu,2));leavesFar.setIndex(new T.BufferAttribute(fi,1));leavesFar.computeBoundingSphere();
   branches.computeBoundingSphere();leaves.computeBoundingSphere();
   out.push({name:v.name,height,branches,leaves,leavesFar,bark:v.bark,leaf:v.leaf,barkScale:v.barkScale});
  }
  return out;}).catch(()=>null);
 return treeRequest;
}
const treeMats=new Map<string,T.Material>();
function barkMat(kind:string,scale:{x:number,y:number}){const key='bark:'+kind;let m=treeMats.get(key);if(!m){const file=kind==='birch'?'birch':'oak';const map=photoMap(`/neighborhood/bark-${file}-color.jpg`).clone(),nrm=photoMap(`/neighborhood/bark-${file}-normal.jpg`,false).clone();for(const t of [map,nrm]){t.repeat.set(scale.x,scale.y);t.userData.persistent=true;t.needsUpdate=true;}m=new T.MeshStandardMaterial({map,normalMap:nrm,roughness:.95,color:kind==='birch'?'#e8e4dc':'#a89a8a'});m.userData.persistent=true;treeMats.set(key,m);}return m;}
function leafMat(kind:string,tint:string){const key='leaf:'+kind+tint;let m=treeMats.get(key);if(!m){m=new T.MeshStandardMaterial({map:photoMap(`/neighborhood/leaf-${kind==='pine'?'oak':kind}.webp`),alphaTest:.5,side:T.DoubleSide,roughness:.78,color:tint});m.userData.persistent=true;treeMats.set(key,m);}return m;}

type Placement={x:number,z:number,h:number,ry:number};
function instanced(v:TreeVariant,list:Placement[],shadows:boolean,tint:string){
 const g=new T.Group();if(!list.length)return g;const m=new T.Matrix4(),q=new T.Quaternion(),s=new T.Vector3(),p=new T.Vector3(),up=new T.Vector3(0,1,0);
 for(const [geo,mat] of [[v.branches,barkMat(v.bark,v.barkScale)],[shadows?v.leaves:v.leavesFar,leafMat(v.leaf,tint)]] as const){
  const mesh=new T.InstancedMesh(geo,mat,list.length);list.forEach((t,i)=>{const k=t.h/v.height;q.setFromAxisAngle(up,t.ry);s.set(k,k,k);p.set(t.x,0,t.z);m.compose(p,q,s);mesh.setMatrixAt(i,m);});
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.castShadow=shadows;mesh.receiveShadow=true;mesh.name='Tree '+v.name;g.add(mesh);}
 return g;
}

// ---------- The street ----------
const PALETTE=[{siding:'#f2efe7',roof:'#3a3b3d',shutters:'#1f2a36'},{siding:'#d9d4c7',roof:'#4a4643',shutters:null},{siding:'#8e9a8f',roof:'#353637',shutters:'#ece8dc'},{siding:'#3f4a57',roof:'#2e2f31',shutters:null},{siding:'#c9c2b3',roof:'#5a4f45',shutters:'#2b3a2f'},{siding:'#e7e2d6',roof:'#2f3236',shutters:'#3a4a5c'},{siding:'#6f7674',roof:'#2a2b2d',shutters:null},{siding:'#efe9dc',roof:'#4b4038',shutters:'#203040'}];
const cache=new Map<string,T.Group>();
/** The street, houses and trees around a lot; `site` is the lot in world feet (front of the house at minZ, facing -z). */
export function addNeighborhood(root:T.Object3D,o:Opts,wake:()=>void){
 const s=o.site,key=[s.minX,s.minZ,s.maxX,s.maxZ].map(v=>Math.round(v/4)*4).join(',')+(o.mobile?'m':'');
 const hit=cache.get(key);if(hit){hit.position.y=o.groundY;root.add(hit);return hit;}
 const group=new T.Group();group.name='Modeled neighborhood';group.userData.persistentAsset=true;group.position.y=o.groundY;root.add(group);cache.set(key,group);
 if(cache.size>3){const [oldKey,old]=cache.entries().next().value as [string,T.Group];cache.delete(oldKey);old.traverse(x=>{const m=x as T.Mesh;if(m.geometry&&!(x instanceof T.InstancedMesh))m.geometry.dispose();});}
 const mats=materials(o),roofMats=new Map<string,T.Material>();const roofFor=(c:string)=>{let m=roofMats.get(c);if(!m){m=roofMaterial('Architectural asphalt shingles',c,[],o.anisotropy);m.side=T.DoubleSide;m.userData.persistent=true;(m as T.MeshStandardMaterial).map!.userData.persistent=true;((m as T.MeshStandardMaterial).bumpMap as T.Texture).userData.persistent=true;roofMats.set(c,m);}return m;};
 mats.stone=stoneMat();mats.brick=brickMat();
 const r=rng(73),half=o.mobile?420:700,front=s.minZ-28;           // back of the sidewalk on our side
 const walkNear=[front-5,front],lawnNear=[front-11,front-5],road=[front-41,front-11],lawnFar=[front-47,front-41],walkFar=[front-52,front-47],acrossFront=front-80;
 const flat=(x0:number,x1:number,z0:number,z1:number,y:number,mat:string,tile:number)=>{const g=quad([V(x0,y,z1),V(x1,y,z1),V(x1,y,z0),V(x0,y,z0)],tile,tile);const mesh=new T.Mesh(g,mats[mat]);mesh.receiveShadow=true;mesh.name='Street '+mat;group.add(mesh);return mesh;};
 flat(-half,half,road[0]!,road[1]!,.03,'asphalt',12);
 for(const z of [walkNear,walkFar])flat(-half,half,z[0]!,z[1]!,.07,'slab',5);
 // Curbs: 6-in reveal with a rounded top edge, along both sides of the road.
 for(const z of [road[1]!,road[0]!]){const g=new T.BoxGeometry(half*2,.55,.55);g.translate(0,.27,z+(z===road[1]?.27:-.27));const mesh=new T.Mesh(g,mats.concrete);mesh.receiveShadow=mesh.castShadow=true;mesh.name='Curb';group.add(mesh);}
 // Houses beside the lot (front on our setback, facing the street) and across the street.
 // The camera orbits the house at roughly twice its half-diagonal; keep that ring free of trees and houses.
 const clear=Math.max(105,Math.hypot(s.maxX-s.minX,s.maxZ-s.minZ)/2*2.3),lotHalf=Math.max(Math.max(-s.minX,s.maxX)+18,clear*.85);
 const homes:{x:number,z:number,ry:number,spec:HouseSpec}[]=[];
 const specFor=(i:number):HouseSpec=>{const p=PALETTE[i%PALETTE.length]!;return {w:40+Math.round(r()*4)*3,d:32+Math.round(r()*3)*3,roof:r()<.45?'hip':'gable',garage:r()<.5?-1:1,siding:p.siding,roofColor:p.roof,shutters:p.shutters,door:(['doorNavy','doorBlack','doorOak'] as const)[i%3]!,chimney:r()<.4,porch:r()<.6,seed:i*97+11};};
 let i=0;const perSide=o.mobile?1:3;
 for(const side of [-1,1]){let x=side*lotHalf;for(let k=0;k<perSide;k++){const spec=specFor(i++);const span=spec.w/2+(spec.garage===-side?23:0)+(spec.garage===side?0:0);const cx=x+side*(span+18+(k?10:0));homes.push({x:cx,z:s.minZ,ry:Math.PI,spec});x=cx+side*(spec.w/2+(spec.garage===side?23:0)+12);}}
 const across=o.mobile?4:8,spacing=92;for(let k=0;k<across;k++){const spec=specFor(i++);homes.push({x:(k-(across-1)/2)*spacing+(r()-.5)*8,z:acrossFront,ry:0,spec});}
 const drives:[number,number][]=[];
 for(const h of homes){const g=house(h.spec,mats,new Map([[h.spec.roofColor,roofFor(h.spec.roofColor)]]));g.position.set(h.x,0,h.z);g.rotation.y=h.ry;group.add(g);
  // Driveway from the garage door to the curb, and a walk from the front door to the sidewalk.
  if(h.spec.garage){const facing=h.ry===0?1:-1,gx=h.x+facing*h.spec.garage*(h.spec.w/2+11.5),z0=h.z+facing*(-2),z1=facing>0?walkFar[0]!:walkNear[1]!;
   const za=Math.min(z0,z1),zb=Math.max(z0,z1);drives.push([gx-10,gx+10]);flat(gx-9,gx+9,za,zb,.06,'concrete',6);
   const zr=facing>0?road[0]!:road[1]!,zs=facing>0?walkFar[1]!:walkNear[0]!;flat(gx-9,gx+9,Math.min(zr,zs),Math.max(zr,zs),.065,'concrete',6);}
  const facing=h.ry===0?1:-1,bays=Math.max(3,Math.round(h.spec.w/9)|1),dx=h.x+facing*(-h.spec.w/2+h.spec.w/bays*(Math.floor(bays/2)+.5));
  const z0=h.z+facing*4.4,z1=facing>0?walkFar[0]!:walkNear[1]!;flat(dx-2,dx+2,Math.min(z0,z1),Math.max(z0,z1),.065,'slab',5);
  // Mailbox at the curb.
  const mz=facing>0?road[0]!-1:road[1]!+1;const post=new T.Mesh(new T.BoxGeometry(.3,3.6,.3),mats.mailbox);post.position.set(dx+5,1.8,mz);const mbox=new T.Mesh(new T.BoxGeometry(.6,.65,1.6),mats.mailbox);mbox.position.set(dx+5,3.7,mz);post.castShadow=mbox.castShadow=true;group.add(post,mbox);}
 // Street lamps every ~170 ft on the near side.
 for(let x=-half+60;x<half;x+=170){const pole=new T.Mesh(new T.CylinderGeometry(.18,.26,13,12),mats.lamp);pole.position.set(x,6.5,lawnNear[0]!+3);const head=new T.Mesh(new T.CylinderGeometry(.55,.85,1.5,8),mats.lamp);head.position.set(x,13.6,lawnNear[0]!+3);const glow=new T.Mesh(new T.CylinderGeometry(.5,.5,.9,8),mats.lampGlass);glow.position.set(x,12.9,lawnNear[0]!+3);pole.castShadow=true;group.add(pole,head,glow);}
 // Trees arrive once the small binary has loaded.
 loadTrees().then(vs=>{if(!vs)return;const by=(n:string)=>vs.find(v=>v.name===n)!;
  const near:Record<string,Placement[]>={oak:[],ash:[],aspen:[]},far:Record<string,Placement[]>={oak:[],ash:[],aspen:[]},bushes:Placement[]=[];
  const species=['oak','ash','oak','ash','aspen'];const clearOf=(x:number)=>!drives.some(([a,b])=>x>a-4&&x<b+4);const outside=(p:Placement)=>Math.hypot(p.x,p.z)>clear*1.1;
  for(const z of [(lawnNear[0]!+lawnNear[1]!)/2,(lawnFar[0]!+lawnFar[1]!)/2])for(let x=-half+20;x<half;x+=46+r()*10){if(!clearOf(x)||Math.hypot(x,z)<clear*1.08)continue;near[species[Math.floor(r()*4)]!]!.push({x,z,h:28+r()*8,ry:r()*6.28});}
  // Woods behind the lot and the homes beside it, and a loose ring of trees on every horizon.
  const back=Math.max(s.maxZ+60,clear+15);for(let row=0;row<(o.mobile?1:3);row++)for(let x=-half*.7;x<half*.7;x+=38+r()*18){const z=back+row*40+r()*16;(row<1?near:far)[species[Math.floor(r()*5)]!]!.push({x:x+r()*12,z,h:36+r()*14,ry:r()*6.28});}
  for(const h of homes){const f=h.ry===0?1:-1;for(let k=0;k<5;k++)bushes.push({x:h.x+f*(-h.spec.w/2+2+k*(h.spec.w-4)/4),z:h.z+f*2.2,h:3.4+r()*1.2,ry:r()*6.28});
   far[species[Math.floor(r()*5)]!]!.push({x:h.x+(r()-.5)*h.spec.w,z:h.z-f*(h.spec.d+22+r()*20),h:34+r()*14,ry:r()*6.28});}
  if(!o.mobile)for(let k=0;k<55;k++){const a=r()*Math.PI*2,rad=560+r()*260;const x=Math.cos(a)*rad,z=Math.sin(a)*rad;if(z<road[1]!+20&&z>acrossFront-60&&Math.abs(x)<half)continue;far[species[Math.floor(r()*5)]!]!.push({x,z,h:40+r()*18,ry:r()*6.28});}
  for(const list of [...Object.values(near),...Object.values(far)])for(let k=list.length-1;k>=0;k--)if(!outside(list[k]!))list.splice(k,1);
  const tint:Record<string,string>={oak:'#a3b37e',ash:'#9fb27a',aspen:'#b7bf86'};
  for(const n of ['oak','ash','aspen'])group.add(instanced(by(n),near[n]!,true,tint[n]!),instanced(by(n),far[n]!,false,tint[n]!));
  group.add(instanced(by('bush'),bushes,true,'#93a874'));
  wake();});
 group.add(treeline(760,o.mobile),treeline(810,o.mobile));
 return group;
}

// A continuous wooded horizon well past the street's ends: two staggered bands of crowns, hazed by the fog,
// so the lawn never meets the sky in a hard line. A few thousand triangles stand in for thousands of trees.
function treeline(radius:number,mobile:boolean){
 const r=rng(radius),n=mobile?360:900,crowns:number[]=[];let a=0;
 while(a<Math.PI*2){const w=(14+r()*22)/radius;crowns.push(a,w,(radius>780?54:44)+r()*22);a+=w*(.55+r()*.35);}
 const height=(t:number)=>{let h=radius>780?30:24;for(let i=0;i<crowns.length;i+=3){const d=Math.abs(t-crowns[i]!)/crowns[i+1]!;if(d<1)h=Math.max(h,crowns[i+2]!*Math.sqrt(1-d*d));}return h;};
 const pos:number[]=[],col:number[]=[];
 for(let i=0;i<n;i++){const t0=i/n*Math.PI*2,t1=(i+1)/n*Math.PI*2,h0=height(t0),h1=height(t1),g=.8+r()*.35;
  const P=(t:number,y:number)=>[Math.cos(t)*radius,y,Math.sin(t)*radius];
  for(const [t,y] of [[t0,-2],[t1,-2],[t1,h1],[t0,-2],[t1,h1],[t0,h0]] as const){pos.push(...P(t,y));const k=y<0?.55:g;col.push(.24*k,.33*k,.2*k);}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('color',new T.Float32BufferAttribute(col,3));geo.computeVertexNormals();
 const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide}));mesh.name='Distant treeline';mesh.userData.backdrop=true;return mesh;
}

export function skyDome(texture:T.Texture,rotation:number){
 const g=new T.SphereGeometry(950,64,32);g.scale(1,1,-1);const dome=new T.Mesh(g,new T.MeshBasicMaterial({map:texture,depthWrite:false,fog:false}));dome.rotation.y=rotation;dome.renderOrder=-10;dome.frustumCulled=false;dome.name='Photo sky';dome.userData.backdrop=true;
 dome.onBeforeRender=(_r,_s,camera)=>{dome.position.copy(camera.position);dome.updateMatrixWorld();};return dome;
}
