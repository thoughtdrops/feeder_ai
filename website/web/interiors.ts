import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Show-home kitchens and living rooms, modelled on common real US products and drawn in feet at their real
// sizes: 34½ in base cabinets + 1¼ in tops = 36 in counters, 24 in deep; 30 in uppers from 54 in; 24 in
// dishwasher; 30 in slide-in, 36 in and 48 in professional ranges; 36 in counter-depth refrigerators;
// 3 × 6 in subway tile; seat heights of 17–18 in; 65 in TVs. Each kitchen and living-room choice from the
// engine (cabinet doors, counters, backsplash, range, hood, sink, wall storage, hardware, island, pendants,
// refrigerator, seating, media wall, coffee table, rug) changes what is drawn.
const FLOOR=.21;
type Ctx={config:any;interior:any;m:any};
type Design=Record<string,string>;

// Cached across rebuilds; disposing on cleanup only frees GPU memory (three re-uploads on next use).
const textures=new Map<string,T.CanvasTexture>();
function canvasTexture(key:string,size:number,draw:(g:CanvasRenderingContext2D,s:number)=>void,repeat=true){
 let t=textures.get(key);if(t)return t;const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d')!,size);
 t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;if(repeat)t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;textures.set(key,t);return t;
}
const rand=(seed:number)=>()=>(seed=(seed*16807)%2147483647)/2147483647;
const clouds=(g:CanvasRenderingContext2D,s:number,r:()=>number,color:string,count:number,alpha:number)=>{for(let i=0;i<count;i++){g.fillStyle=`rgba(${color},${alpha*(.5+r())})`;g.beginPath();g.arc(r()*s,r()*s,2+r()*s*.03,0,Math.PI*2);g.fill();}};
const veins=(g:CanvasRenderingContext2D,s:number,r:()=>number,color:string,count:number,alpha:number,width:number)=>{for(let v=0;v<count;v++){g.strokeStyle=`rgba(${color},${alpha*(.6+r()*.6)})`;g.lineWidth=width*(.4+r());g.beginPath();let x=r()*s,y=-10,dx=(r()-.5)*6;g.moveTo(x,y);while(y<s+10){dx+=(r()-.5)*3;x+=dx;y+=8;g.lineTo(x,y);}g.stroke();}};

/** Engineered quartz: soft cloudy body with a few faint veins. */
const quartz=(color:string)=>canvasTexture('quartz'+color,512,(g,s)=>{g.fillStyle=color;g.fillRect(0,0,s,s);const r=rand(77);clouds(g,s,r,'255,255,255',900,.05);veins(g,s,r,'120,120,126',4,.1,1.4);});
/** Calacatta: bright white body with bold grey and a few warm gold veins. */
const marble=()=>canvasTexture('marble',512,(g,s)=>{g.fillStyle='#f5f3ef';g.fillRect(0,0,s,s);const r=rand(11);clouds(g,s,r,'225,222,215',500,.08);veins(g,s,r,'92,92,98',5,.45,3);veins(g,s,r,'150,150,155',10,.2,1.2);veins(g,s,r,'176,146,92',3,.25,1.5);});
/** Absolute black granite: near-black with mineral flecks, polished. */
const granite=()=>canvasTexture('granite',256,(g,s)=>{g.fillStyle='#1a1b1d';g.fillRect(0,0,s,s);const r=rand(23),tones=['#2d2e31','#3c3a37','#0d0d0e','#55514b','#7a7468'];for(let i=0;i<7000;i++){g.fillStyle=tones[i%tones.length]!;const d=.8+r()*2.2;g.fillRect(r()*s,r()*s,d,d);}});
/** Cast concrete: warm grey with soft mottling and pin holes. */
const concrete=()=>canvasTexture('concrete',512,(g,s)=>{g.fillStyle='#a8a59f';g.fillRect(0,0,s,s);const r=rand(41);clouds(g,s,r,'60,58,55',700,.05);clouds(g,s,r,'255,255,255',600,.05);for(let i=0;i<500;i++){g.fillStyle='rgba(70,68,64,.35)';g.fillRect(r()*s,r()*s,1.4,1.4);}});
/** Soapstone: matte charcoal with faint pale veins. */
const soapstone=()=>canvasTexture('soapstone',512,(g,s)=>{g.fillStyle='#3a3d3f';g.fillRect(0,0,s,s);const r=rand(59);clouds(g,s,r,'20,22,24',600,.06);veins(g,s,r,'225,228,226',6,.14,1.2);});
/** Edge-grain maple butcher block: staves running the length of the counter. */
const butcherBlock=()=>canvasTexture('butcher',512,(g,s)=>{const r=rand(7),tones=['#c4955f','#b5844f','#d1a46e','#a8794a','#bf8f5a'];const rows=14;for(let i=0;i<rows;i++){g.fillStyle=tones[Math.floor(r()*tones.length)]!;g.fillRect(0,i*s/rows,s,s/rows);for(let k=0;k<6;k++){g.strokeStyle=`rgba(90,55,25,${.08+r()*.1})`;g.lineWidth=.6;g.beginPath();const y=i*s/rows+r()*s/rows;g.moveTo(0,y);for(let x=0;x<=s;x+=32)g.lineTo(x,y+(r()-.5)*2);g.stroke();}g.fillStyle='rgba(60,35,15,.25)';g.fillRect(0,i*s/rows,s,1);}});
/** 3 × 6 in subway tile, running bond, light grout. One repeat = 2 ft square. */
const subway=()=>canvasTexture('subway',512,(g,s)=>{g.fillStyle='#d9d6cf';g.fillRect(0,0,s,s);const rows=8,cols=4,th=s/rows,tw=s/cols;
 for(let r=0;r<rows;r++)for(let c=-1;c<cols;c++){const x=c*tw+(r%2?tw/2:0)+2,y=r*th+2;const grad=g.createLinearGradient(x,y,x,y+th);grad.addColorStop(0,'#fbfaf7');grad.addColorStop(.85,'#f1efea');grad.addColorStop(1,'#e2dfd8');g.fillStyle=grad;g.fillRect(x,y,tw-4,th-4);}});
/** 2 × 6 in tile in a chevron. One repeat = 2 ft square. */
const chevron=()=>canvasTexture('chevron',512,(g,s)=>{g.fillStyle='#cfcac0';g.fillRect(0,0,s,s);const cols=8,cw=s/cols,th=s/12;const r=rand(3);
 for(let c=0;c<cols;c++)for(let k=-2;k<14;k++){const x=c*cw,y=k*th,slope=(c%2?-1:1)*cw*.5;const v=235+Math.floor(r()*14);g.fillStyle=`rgb(${v},${v-2},${v-6})`;g.beginPath();g.moveTo(x+1.5,y+1.5+(slope<0?-slope:0));g.lineTo(x+cw-1.5,y+1.5+(slope>0?slope:0));g.lineTo(x+cw-1.5,y+th-1.5+(slope>0?slope:0));g.lineTo(x+1.5,y+th-1.5+(slope<0?-slope:0));g.closePath();g.fill();}});
/** 4 in handmade zellige: glossy, every tile a slightly different shade. */
const zellige=(base:[number,number,number])=>canvasTexture('zellige'+base.join(),512,(g,s)=>{g.fillStyle='#bdb8ae';g.fillRect(0,0,s,s);const n=6,t=s/n,r=rand(13);
 for(let i=0;i<n;i++)for(let j=0;j<n;j++){const k=(r()-.5)*28;g.fillStyle=`rgb(${base[0]+k},${base[1]+k},${base[2]+k})`;g.fillRect(i*t+2,j*t+2,t-4,t-4);g.fillStyle=`rgba(255,255,255,${.1+r()*.15})`;g.fillRect(i*t+4,j*t+4,(t-8)*r(),3);}});
/** 2 in hexagon mosaic, white with grey grout. */
const hexagon=()=>canvasTexture('hexagon',512,(g,s)=>{g.fillStyle='#bfbcb6';g.fillRect(0,0,s,s);const R=s/24,h=Math.sqrt(3)*R,r=rand(17);
 for(let row=-1;row<s/h+1;row++)for(let col=-1;col<s/(1.5*R)+1;col++){const cx=col*1.5*R,cy=row*h+(col%2?h/2:0);const v=240+Math.floor(r()*10);g.fillStyle=`rgb(${v},${v},${v-3})`;g.beginPath();for(let a=0;a<6;a++){const ang=a*Math.PI/3;g.lineTo(cx+Math.cos(ang)*(R-1.4),cy+Math.sin(ang)*(R-1.4));}g.closePath();g.fill();}});
/** Beadboard panel: vertical boards with a bead every 2 in. Multiplies the cabinet colour. */
const beadboard=()=>canvasTexture('beadboard',256,(g,s)=>{g.fillStyle='#ffffff';g.fillRect(0,0,s,s);for(let x=0;x<s;x+=s/8){g.fillStyle='rgba(0,0,0,.28)';g.fillRect(x,0,2,s);g.fillStyle='rgba(255,255,255,.9)';g.fillRect(x+2,0,2,s);}});
/** Fluted white oak: half-round reeds with grain. */
const flutedOak=()=>canvasTexture('fluted',256,(g,s)=>{const n=16,w=s/n;for(let i=0;i<n;i++){const grad=g.createLinearGradient(i*w,0,i*w+w,0);grad.addColorStop(0,'#8f6a45');grad.addColorStop(.35,'#c99d6e');grad.addColorStop(.7,'#b78b5c');grad.addColorStop(1,'#7f5d3c');g.fillStyle=grad;g.fillRect(i*w,0,w,s);}const r=rand(5);for(let k=0;k<60;k++){g.strokeStyle=`rgba(80,52,28,${.08+r()*.1})`;g.lineWidth=.7;g.beginPath();const x=r()*s;g.moveTo(x,0);g.lineTo(x+(r()-.5)*4,s);g.stroke();}});
/** Wool area rug: field, border and a soft trellis, in the room's fabric and accent colours. */
const trellisRug=(field:string,accent:string)=>canvasTexture('rug'+field+accent,512,(g,s)=>{g.fillStyle=field;g.fillRect(0,0,s,s);
 g.strokeStyle=accent;g.globalAlpha=.55;g.lineWidth=10;g.strokeRect(22,22,s-44,s-44);g.lineWidth=3;g.strokeRect(44,44,s-88,s-88);g.globalAlpha=.32;g.lineWidth=3;
 const n=6,step=(s-120)/n;for(let i=0;i<=n;i++)for(let j=0;j<=n;j++){const x=60+i*step,y=60+j*step;g.beginPath();g.moveTo(x,y-step/2);g.quadraticCurveTo(x+step/2,y-step/2,x+step/2,y);g.quadraticCurveTo(x+step/2,y+step/2,x,y+step/2);g.quadraticCurveTo(x-step/2,y+step/2,x-step/2,y);g.quadraticCurveTo(x-step/2,y-step/2,x,y-step/2);g.stroke();}
 g.globalAlpha=.08;const r=rand(5);for(let i=0;i<6000;i++){g.fillStyle=r()>.5?'#000':'#fff';g.fillRect(r()*s,r()*s,1.5,1.5);}g.globalAlpha=1;},false);
/** Vintage Persian: madder red field, indigo border, ivory medallion, worn. */
const persianRug=()=>canvasTexture('persian',512,(g,s)=>{g.fillStyle='#7e2b2a';g.fillRect(0,0,s,s);g.fillStyle='#243049';g.fillRect(0,0,s,40);g.fillRect(0,s-40,s,40);g.fillRect(0,0,40,s);g.fillRect(s-40,0,40,s);
 g.strokeStyle='#d9c79e';g.lineWidth=4;g.strokeRect(46,46,s-92,s-92);g.strokeRect(20,20,s-40,s-40);g.fillStyle='#d6c49a';g.beginPath();g.ellipse(s/2,s/2,s*.2,s*.3,0,0,Math.PI*2);g.fill();g.fillStyle='#243049';g.beginPath();g.ellipse(s/2,s/2,s*.12,s*.19,0,0,Math.PI*2);g.fill();g.fillStyle='#b3893f';g.beginPath();g.ellipse(s/2,s/2,s*.05,s*.08,0,0,Math.PI*2);g.fill();
 const r=rand(29);for(let i=0;i<260;i++){g.fillStyle=['#d6c49a','#243049','#b3893f','#3f6a62'][i%4]!;g.beginPath();g.arc(60+r()*(s-120),60+r()*(s-120),2+r()*4,0,Math.PI*2);g.fill();}
 g.globalAlpha=.12;for(let i=0;i<9000;i++){g.fillStyle=r()>.6?'#f4e6c8':'#000';g.fillRect(r()*s,r()*s,1.5,1.5);}g.globalAlpha=1;},false);
/** Natural jute: chunky basket weave. */
const juteRug=()=>canvasTexture('jute',256,(g,s)=>{g.fillStyle='#c4ad83';g.fillRect(0,0,s,s);const n=16,w=s/n;for(let i=0;i<n;i++)for(let j=0;j<n;j++){g.fillStyle=(i+j)%2?'rgba(120,90,50,.25)':'rgba(255,240,210,.18)';g.fillRect(i*w+1,j*w+1,w-2,w-2);}});
/** Solid plush: one colour with a soft pile. */
const plushRug=(color:string)=>canvasTexture('plush'+color,256,(g,s)=>{g.fillStyle=color;g.fillRect(0,0,s,s);const r=rand(9);g.globalAlpha=.1;for(let i=0;i<5000;i++){g.fillStyle=r()>.5?'#000':'#fff';g.fillRect(r()*s,r()*s,1.2,1.2);}g.globalAlpha=1;});
/** Walnut veneer with straight grain. */
const walnut=()=>canvasTexture('walnut',256,(g,s)=>{g.fillStyle='#5c3d29';g.fillRect(0,0,s,s);const r=rand(19);for(let i=0;i<70;i++){g.strokeStyle=r()>.5?'#4a3020':'#6e4b33';g.globalAlpha=.25+r()*.35;g.lineWidth=.5+r()*2;g.beginPath();const x=r()*s;g.moveTo(x,0);for(let y=0;y<=s;y+=16)g.lineTo(x+Math.sin(y/37+i)*3,y);g.stroke();}g.globalAlpha=1;});
/** A calm abstract picture for the TV (screens in listing photos are usually on). */
const screen=()=>canvasTexture('screen',512,(g,s)=>{const grad=g.createLinearGradient(0,0,s,s);grad.addColorStop(0,'#1f3b57');grad.addColorStop(.55,'#4f7c8f');grad.addColorStop(1,'#e2b98a');g.fillStyle=grad;g.fillRect(0,0,s,s);g.fillStyle='rgba(255,240,210,.55)';g.beginPath();g.arc(s*.72,s*.36,s*.09,0,Math.PI*2);g.fill();g.fillStyle='#1c2b33';g.beginPath();g.moveTo(0,s*.78);g.quadraticCurveTo(s*.35,s*.6,s*.6,s*.74);g.quadraticCurveTo(s*.8,s*.82,s,s*.7);g.lineTo(s,s);g.lineTo(0,s);g.fill();},false);
/** Large abstract canvas for over a mantel. */
const artwork=()=>canvasTexture('art',512,(g,s)=>{g.fillStyle='#ece6da';g.fillRect(0,0,s,s);g.fillStyle='#c4955a';g.beginPath();g.arc(s*.38,s*.55,s*.26,0,Math.PI*2);g.fill();g.fillStyle='#2f4b4f';g.fillRect(s*.55,s*.18,s*.28,s*.5);g.fillStyle='rgba(30,30,30,.85)';g.fillRect(s*.12,s*.78,s*.76,s*.03);g.strokeStyle='#8a5a3b';g.lineWidth=6;g.beginPath();g.moveTo(s*.2,s*.25);g.quadraticCurveTo(s*.5,s*.05,s*.8,s*.3);g.stroke();},false);
/** Linear fireplace flames over a dark firebox. */
const flames=()=>canvasTexture('flames',512,(g,s)=>{g.fillStyle='#120b07';g.fillRect(0,0,s,s);const r=rand(31);for(let i=0;i<26;i++){const x=r()*s,w=20+r()*40,h=s*(.35+r()*.45);const grad=g.createLinearGradient(0,s,0,s-h);grad.addColorStop(0,'rgba(255,190,90,.95)');grad.addColorStop(.45,'rgba(255,120,30,.75)');grad.addColorStop(1,'rgba(255,80,10,0)');g.fillStyle=grad;g.beginPath();g.moveTo(x-w,s);g.quadraticCurveTo(x-w*.3,s-h*.5,x,s-h);g.quadraticCurveTo(x+w*.3,s-h*.5,x+w,s);g.closePath();g.fill();}},false);

export const INTERIOR_KINDS=['kitchen','counter-run','pantry-tower','island','fridge','console','rug','floorlamp','plant','sofa','sectional','coffee'];

/** Builds a detailed interior piece; returns false for kinds (or choices) this module doesn't draw. */
export function addInteriorPiece(scene:T.Object3D,f:any,ctx:Ctx):boolean{
 if(!INTERIOR_KINDS.includes(f.kind))return false;
 const {config,interior,m}=ctx;const d:Design=m.interiorDesign||{};
 // The chesterfield is the scanned leather model; every other seating choice is drawn here.
 if(f.kind==='sofa'&&(d.livingSeating==='Chesterfield sofa'||!d.livingSeating))return false;
 if(f.kind==='coffee'&&!d.livingCoffee)return false;
 const group=new T.Group(),w=f.localWidth,dp=f.localDepth,front=dp/2;
 const std=(color:string,roughness:number,metalness=0,extra:Partial<T.MeshPhysicalMaterialParameters>={})=>new T.MeshPhysicalMaterial({color,roughness,metalness,...extra});
 const cabColor=config.colors?.cabinetry||'#e8e4da';
 const oak=std('#ffffff',.55,0,{map:flutedOak()});
 const cab=d.kitchenCabinets==='Fluted oak'?std('#c69a6b',.5,0,{clearcoat:.2}):std(cabColor,.45,0,{clearcoat:.25,clearcoatRoughness:.4});
 const counter=(()=>{switch(d.kitchenCounter){
  case 'Calacatta marble':return std('#ffffff',.12,0,{map:marble(),clearcoat:.8,clearcoatRoughness:.06});
  case 'Butcher block':return std('#ffffff',.45,0,{map:butcherBlock(),clearcoat:.3,clearcoatRoughness:.3});
  case 'Black granite':return std('#ffffff',.08,0,{map:granite(),clearcoat:1,clearcoatRoughness:.04});
  case 'Concrete':return std('#ffffff',.7,0,{map:concrete()});
  case 'Soapstone':return std('#ffffff',.6,0,{map:soapstone(),clearcoat:.2,clearcoatRoughness:.5});
  default:return std('#ffffff',.18,0,{map:quartz(config.colors?.countertop||'#e9e6df'),clearcoat:.6,clearcoatRoughness:.12});}})();
 const counterThick=d.kitchenCounter==='Butcher block'?.125:d.kitchenCounter==='Concrete'?.167:.104;
 const brushed=std('#c9cdcf',.32,1);const blackGlass=std('#0d0f10',.08,0,{clearcoat:1,clearcoatRoughness:.04});const iron=std('#1b1b1b',.6,.4);
 const metal=d.kitchenHardware==='Brass'?std('#b8924f',.28,1):d.kitchenHardware==='Matte black'?std('#1e1e1e',.5,.35):std('#c3c7c9',.3,1);
 const living=/brass|gold/i.test(interior.metal||'')?std('#b89254',.3,1):std('#2a2a2a',.45,.5);
 const warmLight=new T.MeshStandardMaterial({color:'#fff3dc',emissive:'#ffd9a0',emissiveIntensity:2.2});
 const glass=new T.MeshPhysicalMaterial({color:'#e8f0f0',roughness:.05,clearcoat:1,transparent:true,opacity:.3,depthWrite:false});
 const fabric=std(interior.fabric||'#b3a48d',.9,0,{sheen:1,sheenRoughness:.7,sheenColor:new T.Color('#ffffff')});
 const accentFabric=std(interior.accent||'#8c7259',.85,0,{sheen:1,sheenRoughness:.6,sheenColor:new T.Color('#ffffff')});
 const linen=std('#ece6da',.92,0,{sheen:.6,sheenRoughness:.8,sheenColor:new T.Color('#ffffff')});
 const plaster=std('#ece7de',.92);const darkWood=std('#ffffff',.55,0,{map:walnut()});
 const box=(x:number,y:number,z:number,a:number,b:number,c:number,mat:T.Material,r=0,parent:T.Object3D=group)=>{const mesh=new T.Mesh(r?new RoundedBoxGeometry(a,b,c,2,Math.min(r,a/3,b/3,c/3)):new T.BoxGeometry(a,b,c),mat);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 const cyl=(x:number,y:number,z:number,r:number,h:number,mat:T.Material,top=r,seg=20,parent:T.Object3D=group)=>{const mesh=new T.Mesh(new T.CylinderGeometry(top,r,h,seg),mat);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 const ball=(x:number,y:number,z:number,r:number,mat:T.Material,parent:T.Object3D=group)=>{const mesh=new T.Mesh(new T.SphereGeometry(r,20,14),mat);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;};
 const lathe=(points:number[][],mat:T.Material,x:number,y:number,z:number,parent:T.Object3D=group)=>{const mesh=new T.Mesh(new T.LatheGeometry(points.map(([a,b])=>new T.Vector2(a,b)),28),mat);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;};
 const bar=(x:number,y:number,z:number,length:number,vertical:boolean,mat:T.Material=metal)=>{const handle=cyl(x,y,z+.07,.022,length,mat,.022,12);if(!vertical)handle.rotation.z=Math.PI/2;for(const s of [-1,1]){const post=cyl(x+(vertical?0:s*(length/2-.05)),y+(vertical?s*(length/2-.05):0),z+.035,.015,.07,mat,.015,8);post.rotation.x=Math.PI/2;}};
 // Cabinet fronts in the chosen door style; `vertical` puts a door's pull at its free edge.
 const style=d.kitchenCabinets||'Shaker';const bead=std(cabColor,.5,0,{map:beadboard()});
 const frontPanel=(x:number,y:number,z:number,fw:number,fh:number,mat:T.Material=cab,stile=.2,parent:T.Object3D=group)=>{const s=Math.min(stile,fw/4,fh/4);
  if(style==='Flat slab'){box(x,y,z,fw-.03,fh-.03,.06,mat,.01,parent);return;}
  if(style==='Fluted oak'){const map=flutedOak().clone();map.userData={};map.needsUpdate=true;map.repeat.set(Math.max(1,Math.round(fw/1.3)),1);box(x,y,z,fw-.03,fh-.03,.06,std('#ffffff',.55,0,{map}),.01,parent);return;}
  box(x,y,z-.012,fw-.02,fh-.02,.04,style==='Beadboard'?bead:mat,0,parent);
  for(const sx of [-1,1])box(x+sx*(fw/2-s/2-.01),y,z+.018,s,fh-.02,.03,mat,0,parent);for(const sy of [-1,1])box(x,y+sy*(fh/2-s/2-.01),z+.018,fw-2*s-.02,s,.03,mat,0,parent);
  if(style==='Raised panel'){box(x,y,z+.02,fw-2*s-.14,fh-2*s-.14,.04,mat,.03,parent);}};
 const pull=(x:number,y:number,z:number,fw:number,vertical:boolean)=>{if(style==='Flat slab'){if(vertical)box(x,y,z+.045,.03,Math.min(1.2,fw*.8),.03,metal);else box(x,y,z+.045,Math.min(1.4,fw*.75),.03,.03,metal);return;}
  if(style==='Beadboard'&&!vertical){const cup=new T.Mesh(new T.CylinderGeometry(.09,.09,.18,16,1,true,0,Math.PI),metal);cup.rotation.z=Math.PI/2;cup.rotation.y=Math.PI/2;cup.position.set(x,y,z+.04);group.add(cup);return;}
  bar(x,y,z,vertical?.5:Math.min(.75,fw*.5),vertical);};
 const baseTop=FLOOR+2.875,top=baseTop+counterThick;
 const ceiling=Math.max(top+4.5,(m.h||8)-.05);
 switch(f.kind){
  case 'kitchen':{
   // Layout like a real kitchen: the sink sits under the window, the range on solid wall at least 3 ft away
   // (so the hood never covers glass), a dishwasher beside the sink, drawer banks and door bases between.
   const toe=FLOOR+.33,bodyH=baseTop-toe,sinkW=Math.min(3,w*.3);
   const rangeW=Math.min(d.kitchenRange==='48 in pro range'?4:d.kitchenRange==='36 in pro range'?3:2.5,w*.36);
   const glassAt=windowSpans(f,m,top+.2,top+4);const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x));
   let sinkX=-w*.22,rangeX=w*.25;
   if(glassAt.length){const [a,b]=glassAt.reduce((p,c)=>c[1]-c[0]>p[1]-p[0]?c:p);sinkX=clamp((a+b)/2,-w/2+sinkW/2,w/2-sinkW/2);
    const clear=(x:number)=>!glassAt.some(([a,b])=>a<x+rangeW/2+.4&&b>x-rangeW/2-.4)&&Math.abs(x-sinkX)>=(sinkW+rangeW)/2+1;
    const options:number[]=[];for(let x=-w/2+rangeW/2;x<=w/2-rangeW/2+1e-6;x+=.25)if(clear(x))options.push(x);
    rangeX=options.length?options.sort((p,q)=>Math.abs(Math.abs(p-sinkX)-4.5)-Math.abs(Math.abs(q-sinkX)-4.5))[0]!:sinkX<0?w/2-rangeW/2:-w/2+rangeW/2;}
   rangeX=clamp(rangeX,-w/2+rangeW/2,w/2-rangeW/2);
   if(Math.abs(rangeX-sinkX)<(sinkW+rangeW)/2){rangeX=sinkX<0?Math.min(w/2-rangeW/2,sinkX+(sinkW+rangeW)/2):Math.max(-w/2+rangeW/2,sinkX-(sinkW+rangeW)/2);}
   if(Math.abs(rangeX-sinkX)<(sinkW+rangeW)/2-.01)sinkX=rangeX<0?Math.min(w/2-sinkW/2,rangeX+(sinkW+rangeW)/2):Math.max(-w/2+sinkW/2,rangeX-(sinkW+rangeW)/2);
   box(0,(toe+FLOOR)/2,-.12,w,.33,dp-.25,std('#2b2b2b',.8));
   const modules:{x:number,width:number,kind:string}[]=[{x:sinkX,width:sinkW,kind:'sink'},{x:rangeX,width:rangeW,kind:'range'}].sort((a,b)=>a.x-b.x);
   const fixed=[...modules];let cursor=-w/2;
   const fill=(a:number,b:number,besideSink:'left'|'right'|null)=>{let len=b-a;if(len<.05)return;
    if(besideSink&&w>7&&len>=2.3){const x=besideSink==='right'?a+1:b-1;modules.push({x,width:2,kind:'dishwasher'});if(besideSink==='right')a+=2;else b-=2;len-=2;if(len<.05)return;}
    const n=Math.max(1,Math.round(len/1.75)),width=len/n;for(let i=0;i<n;i++)modules.push({x:a+width*(i+.5),width,kind:width<1?'doors':i%2?'doors':'drawers'});};
   for(const [i,mod] of fixed.entries()){const next=fixed[i+1];fill(cursor,mod.x-mod.width/2,i===1&&fixed[0]!.kind==='sink'?'right':null);cursor=mod.x+mod.width/2;if(!next)fill(cursor,w/2,mod.kind==='sink'?'right':null);}
   if(!modules.some(m=>m.kind==='dishwasher')){const sink=fixed.find(m=>m.kind==='sink')!,leftGap=modules.filter(m=>m.kind!=='sink'&&m.kind!=='range'&&m.x<sink.x);
    const touching=leftGap.sort((a,b)=>b.x-a.x)[0];if(touching&&touching.width>=2&&Math.abs(touching.x+touching.width/2-(sink.x-sink.width/2))<.05&&w>7){touching.width-=2;touching.x-=1;modules.push({x:sink.x-sink.width/2-1,width:2,kind:'dishwasher'});if(touching.width<.3)modules.splice(modules.indexOf(touching),1);}}
   const farmhouse=d.kitchenSink==='Farmhouse apron';
   for(const mod of modules){
    if(mod.kind==='range')continue;
    box(mod.x,toe+bodyH/2,-.04,mod.width-.01,bodyH,dp-.12,cab);
    const fz=front-.02,y0=toe+.05,h=bodyH-.1;
    if(mod.kind==='dishwasher'){box(mod.x,y0+h/2,fz+.02,mod.width-.04,h,.06,d.kitchenFridge==='Panel-ready built-in'?cab:brushed,.02);pull(mod.x,y0+h-.25,fz+.03,mod.width,false);box(mod.x,y0+.12,fz+.03,mod.width-.1,.2,.05,iron);}
    else if(mod.kind==='drawers'){const rows=[.2,.35,.45];let y=y0;for(const r of rows){const dh=h*r;frontPanel(mod.x,y+dh/2,fz,mod.width-.04,dh-.03,cab,.15);pull(mod.x,y+dh-.16,fz,mod.width,false);y+=dh;}}
    else{const apron=mod.kind==='sink'&&farmhouse?.8:0;const top_=apron?0:h*.2;
     if(apron){box(mod.x,y0+h-apron/2+.04,fz+.06,Math.min(mod.width-.1,2.75),apron+.08,.12,std('#f7f6f2',.15,0,{clearcoat:.8}),.03);}
     else{frontPanel(mod.x,y0+h-top_/2,fz,mod.width-.04,top_-.03,cab,.12);pull(mod.x,y0+h-top_/2,fz,mod.width,false);}
     const doorH=h-top_-apron,doors=mod.width>2.2?2:1;for(let i=0;i<doors;i++){const dw=(mod.width-.04)/doors,dx=mod.x-(mod.width-.04)/2+dw*(i+.5);frontPanel(dx,y0+doorH/2,fz,dw-.02,doorH-.03);pull(dx+(doors===2?(i?-1:1)*(dw/2-.18):dw/2-.18),y0+doorH-.45,fz,dw,true);}}
   }
   // Counter cut around the range, in the chosen material.
   const r=modules.find(m=>m.kind==='range')!;const left=r.x-r.width/2,right=r.x+r.width/2;
   if(left>-w/2+.05)box((-w/2+left)/2,baseTop+counterThick/2,0,left+w/2,counterThick,dp+.08,counter,.02);
   if(right<w/2-.05)box((right+w/2)/2,baseTop+counterThick/2,0,w/2-right,counterThick,dp+.08,counter,.02);
   // Sink: undermount stainless or fireclay farmhouse apron, with a gooseneck or bridge faucet.
   const sink=modules.find(m=>m.kind==='sink')!;{const sw=Math.min(2.5,sink.width-.5);
    if(farmhouse){box(sink.x,top-.35,.15,Math.min(sink.width-.15,2.7),.7,1.55,std('#f7f6f2',.15,0,{clearcoat:.8}),.04);box(sink.x,top-.05,.15,Math.min(sink.width-.35,2.5),.12,1.35,std('#d9d7d1',.3));}
    else{box(sink.x,top+.004,.05,sw,.012,1.35,brushed);box(sink.x,top+.002,.05,sw-.16,.016,1.19,std('#3a3d3f',.35,.7));}
    const fx=sink.x,fz=-dp/2+.45;
    if(farmhouse){for(const s of [-1,1]){cyl(fx+s*.35,top+.25,fz,.04,.5,metal);const lever=box(fx+s*.35,top+.55,fz+.05,.03,.03,.25,metal);lever.rotation.x=-.4;}
     const bridge=cyl(fx,top+.42,fz,.03,.7,metal);bridge.rotation.z=Math.PI/2;const spout=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(0,.55,0),new T.Vector3(0,.75,.25),new T.Vector3(0,.55,.55)]),20,.03,8,false),metal);spout.position.set(fx,top+.42,fz);spout.castShadow=true;group.add(spout);}
    else{const curve=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(0,.9,0),new T.Vector3(0,1.25,.25),new T.Vector3(0,1.05,.62),new T.Vector3(0,.82,.66)]);const tube=new T.Mesh(new T.TubeGeometry(curve,24,.035,10,false),metal);tube.position.set(fx,top,fz);tube.castShadow=true;group.add(tube);
     cyl(fx,top+.05,fz,.06,.1,metal);const lever=box(fx+.14,top+.35,fz,.03,.03,.28,metal);lever.rotation.x=-.5;}}
   // Range: 30 in slide-in, or a professional range with a raised back guard, red knobs and (48 in) a griddle.
   const rw=r.width-.02;
   if(d.kitchenRange==='36 in pro range'||d.kitchenRange==='48 in pro range'){const big=d.kitchenRange==='48 in pro range';
    box(r.x,(FLOOR+top)/2,-.05,rw,top-FLOOR,dp-.1,brushed,.02);box(r.x,top+.3,-dp/2+.12,rw,.6,.18,brushed,.02);box(r.x,top-.03,0,rw-.04,.06,dp-.3,iron);
    const burners=6,cols=3,span=big?rw*.62:rw,x0=r.x-rw/2;
    for(let i=0;i<burners;i++){const c=i%cols,row=Math.floor(i/cols);const bx=x0+span*(c+.5)/cols,bz=row?.45:-.4;cyl(bx,top+.03,bz,.17,.04,iron,.15,20);for(const a of [0,Math.PI/2])box(bx,top+.06,bz,a?.07:span/cols-.05,.05,a?.82:.07,iron).rotation.y=a;}
    if(big){box(r.x+rw*.31,top+.02,0,rw*.34,.04,dp-.5,std('#3a3a3a',.35,.6));}
    const knobs=big?8:6;for(let i=0;i<knobs;i++){const k=cyl(r.x-rw/2+.25+i*(rw-.5)/(knobs-1),top-.25,front+.06,.075,.1,std('#a41f22',.4),.075,16);k.rotation.x=Math.PI/2;}
    const doors=big?[[-rw/2+.05,rw*.6],[rw*.6-rw/2+.1,rw*.35]]:[[-rw/2+.05,rw-.1]];
    for(const [start,width] of doors as [number,number][]){const dx=r.x+start+width/2;box(dx,FLOOR+1.45,front+.02,width-.04,1.95,.06,brushed,.02);box(dx,FLOOR+1.4,front+.06,width-.5,1.0,.02,blackGlass);bar(dx,FLOOR+2.3,front+.04,width*.75,false,brushed);}
    box(r.x,FLOOR+.25,front,rw-.1,.35,.04,brushed);}
   else{const oy=FLOOR+.02;box(r.x,(FLOOR+top-.04)/2,-.05,rw,top-.04-FLOOR,dp-.1,brushed,.03);box(r.x,top-.02,0,rw,.04,dp-.15,blackGlass);
    for(const [gx,gz] of [[-1,-1],[1,-1],[-1,1],[1,1],[0,0]] as [number,number][]){const cx=r.x+gx*rw*.27,cz=gz*.5;cyl(cx,top+.01,cz,.17,.02,iron,.17,24);for(const a of [0,Math.PI/2])box(cx,top+.05,cz,a?.06:.62,.05,a?.62:.06,iron).rotation.y=a+Math.PI/4;}
    for(let i=0;i<5;i++)cyl(r.x-rw*.36+i*rw*.18,top-.18,front+.03,.07,.06,iron,.07,16).rotation.x=Math.PI/2;
    box(r.x,oy+1.6,front+.01,rw-.08,1.85,.05,brushed,.02);box(r.x,oy+1.55,front+.04,rw-.6,1.05,.02,blackGlass);bar(r.x,oy+2.42,front+.02,rw*.75,false);box(r.x,oy+.35,front+.02,rw-.08,.5,.04,brushed,.02);}
   // Hood over the range, to the ceiling: stainless chimney, tapered plaster, or painted with a wood mantel.
   const hoodBottom=top+2.5;
   if(d.kitchenHood==='Plaster hood'){const shell=new T.Mesh(new T.CylinderGeometry(.55,1.0,1,4,1).rotateY(Math.PI/4),plaster);const hh=ceiling-hoodBottom;shell.scale.set((rw+.4)/1.414,hh,1.9/1.414);shell.position.set(r.x,hoodBottom+hh/2,-dp/2+.95);shell.castShadow=shell.receiveShadow=true;group.add(shell);box(r.x,hoodBottom+.06,-dp/2+.97,rw+.45,.12,1.95,plaster);}
   else if(d.kitchenHood==='Wood mantel hood'){const hh=ceiling-hoodBottom;box(r.x,hoodBottom+hh/2,-dp/2+.8,rw+.3,hh,1.6,cab);box(r.x,hoodBottom+.55,-dp/2+.85,rw+.7,.22,1.75,darkWood,.02);box(r.x,hoodBottom+.05,-dp/2+.82,rw+.4,.1,1.65,cab);for(const s of [-1,1]){const corbel=box(r.x+s*(rw/2+.1),hoodBottom+.3,-dp/2+1.45,.18,.45,.3,darkWood,.03);corbel.rotation.x=.2;}}
   else{const canopy=new T.Mesh(new T.CylinderGeometry(.45,1.05,.95,4,1).rotateY(Math.PI/4),brushed);canopy.scale.set(rw/1.48,1,(dp*.8)/1.48);canopy.position.set(r.x,hoodBottom+.47,-dp/2+dp*.4);canopy.castShadow=true;group.add(canopy);
    box(r.x,(hoodBottom+.95+ceiling)/2,-dp/2+.45,.9,Math.max(.1,ceiling-hoodBottom-.95),.8,brushed);box(r.x,hoodBottom+.05,-dp/2+dp*.4,rw*.95,.06,dp*.75,brushed);}
   // Backsplash to the uppers; tile stops at window casings (a window over the sink keeps its sill and view).
   const splashH=d.kitchenBacksplash==='Full-height slab'?Math.min(2.5,hoodBottom-top):1.5;
   if(d.kitchenBacksplash!=='None'){let from=-w/2;const glassSpans=windowSpans(f,m,top,top+splashH).map(([a,b])=>[a-.25,b+.25]).sort((a,b)=>a[0]!-b[0]!);
    for(const [a,b] of [...glassSpans,[w/2,w/2]]){const to=Math.min(w/2,a!);if(to-from>.3){let mat:T.Material;
      if(d.kitchenBacksplash==='Full-height slab')mat=counter;
      else{const base=d.kitchenBacksplash==='Chevron'?chevron():d.kitchenBacksplash==='Zellige'?zellige([214,226,221]):d.kitchenBacksplash==='Hexagon'?hexagon():subway();const map=base.clone();map.userData={};map.needsUpdate=true;map.repeat.set((to-from)/2,splashH/2);map.offset.x=(from+w/2)/2;mat=std('#ffffff',d.kitchenBacksplash==='Zellige'?.05:.12,0,{map,clearcoat:.8,clearcoatRoughness:.08});}
      box((from+to)/2,top+splashH/2,-dp/2+.015,to-from,splashH,.02,mat);}from=Math.max(from,b!);}}
   // Wall storage: 30 in uppers (solid or glass-front with lit shelves) or floating shelves; never over glass or the hood.
   const blocked=windowSpans(f,m,top+1.5,top+4.25);
   for(const mod of modules){if(mod.kind==='range')continue;const x0=mod.x-mod.width/2,x1=mod.x+mod.width/2;if(blocked.some(([a,b])=>a<x1+.1&&b>x0-.1))continue;
    if(Math.abs(mod.x-r.x)<(mod.width+r.width)/2+.3&&d.kitchenHood!=='Stainless chimney'&&d.kitchenHood)continue;
    if(d.kitchenUppers==='Open shelving'){for(const sy of [top+2.0,top+3.3]){box(mod.x,sy,-dp/2+.45,mod.width-.1,.12,.85,std('#ffffff',.5,0,{map:butcherBlock()}),.01);
      for(let i=0;i<Math.floor(mod.width/.7);i++){const ix=x0+.35+i*.7;if(i%3===0){for(let k=0;k<4;k++)cyl(ix,sy+.08+k*.04,-dp/2+.45,.33,.035,std('#f4f2ec',.25,0,{clearcoat:.6}),.33,24);}else if(i%3===1)lathe([[0,0],[.14,0],[.16,.45],[.08,.55],[.09,.62],[0,.62]],std('#c9b89a',.5),ix,sy+.06,-dp/2+.45);else cyl(ix,sy+.3,-dp/2+.45,.12,.48,glass,.12,16);}}
     continue;}
    const uy=top+1.5+1.25;box(mod.x,uy,-dp/2+.5,mod.width-.01,2.5,1,cab);const doors=mod.width>2.2?2:1;
    for(let i=0;i<doors;i++){const dw=(mod.width-.04)/doors,dx=mod.x-(mod.width-.04)/2+dw*(i+.5);
     if(d.kitchenUppers==='Glass-front uppers'){const s=.16;for(const sx of [-1,1])box(dx+sx*(dw/2-s/2-.01),uy,-dp/2+1.02,s,2.44,.04,cab);for(const sy of [-1,1])box(dx,uy+sy*(1.22-s/2),-dp/2+1.02,dw-2*s,s,.04,cab);box(dx,uy,-dp/2+1.01,dw-2*s,2.44-2*s,.01,glass);
      box(dx,uy,-dp/2+.1,dw-.1,2.3,.02,std('#ffffff',.6,0,{emissive:'#fff2da',emissiveIntensity:.25}));for(const sy of [uy-.45,uy+.4]){box(dx,sy,-dp/2+.55,dw-.1,.04,.85,glass);for(let k=0;k<3;k++)cyl(dx-dw*.25+k*dw*.25,sy+.2,-dp/2+.4,.1,.36,std('#f4f2ec',.25,0,{clearcoat:.6}),.12,16);}}
     else frontPanel(dx,uy,-dp/2+1.02,dw-.02,2.46);
     pull(dx+(doors===2?(i?-1:1)*(dw/2-.18):dw/2-.18),uy-.85,-dp/2+1.02,dw,true);}
    box(mod.x,uy-1.27,-dp/2+.85,mod.width-.2,.03,.08,warmLight);}
   // Styling: wood board, fruit bowl.
   const sideX=left>-w/2+2?(-w/2+left)/2:(right+w/2)/2;box(sideX-.3,top+.03,.05,1.1,.05,.7,std('#a8794e',.5),.02);
   const bowl=new T.Mesh(new T.SphereGeometry(.38,24,12,0,Math.PI*2,Math.PI/2,Math.PI/2),std('#f2efe8',.25));bowl.position.set(sideX+.6,top+.36,.15);bowl.castShadow=true;group.add(bowl);
   for(let i=0;i<5;i++){const lemon=new T.Mesh(new T.SphereGeometry(.13,16,12),std('#e8c43a',.45));lemon.scale.set(1,.85,1.2);lemon.position.set(sideX+.5+(i%3)*.1,top+.16+Math.floor(i/3)*.1,.1+(i%2)*.12);group.add(lemon);}
   break;}
  case 'counter-run':{
   // An extra run of base cabinets, counter, backsplash and wall storage in the same finishes (L and U kitchens);
   // runs of 6 ft or more get a glass-door beverage refrigerator at one end.
   const toe=FLOOR+.33,bodyH=baseTop-toe,fz=front-.02,y0=toe+.05,h=bodyH-.1;
   box(0,(toe+FLOOR)/2,-.1,w,.33,dp-.2,std('#2b2b2b',.8));
   const n=Math.max(1,Math.round(w/1.75)),mw=w/n,wine=w>=6;
   for(let i=0;i<n;i++){const x=-w/2+mw*(i+.5);box(x,toe+bodyH/2,-.04,mw-.01,bodyH,dp-.1,cab);
    if(wine&&i===n-1){box(x,y0+h/2,fz+.02,mw-.06,h,.06,brushed,.02);box(x,y0+h/2,fz+.05,mw-.3,h-.3,.02,glass);box(x,y0+h/2,-.1,mw-.3,h-.3,.02,std('#ffffff',.6,0,{emissive:'#fff1d6',emissiveIntensity:.35}));for(let k=0;k<4;k++){const yy=y0+.4+k*(h-.6)/4;for(let b=0;b<3;b++){const bottle=cyl(x-mw*.25+b*mw*.25,yy,0,.09,.12,std(['#3c1520','#1f3a24','#e8d9a0'][b%3]!,.3),.09,12);bottle.rotation.x=Math.PI/2;}}bar(x,y0+h-.3,fz+.05,mw*.6,false,brushed);continue;}
    if(i%2===0){const rows=[.2,.35,.45];let y=y0;for(const r of rows){const dh=h*r;frontPanel(x,y+dh/2,fz,mw-.04,dh-.03,cab,.15);pull(x,y+dh-.16,fz,mw,false);y+=dh;}}
    else{const top_=h*.2;frontPanel(x,y0+h-top_/2,fz,mw-.04,top_-.03,cab,.12);pull(x,y0+h-top_/2,fz,mw,false);const doors=mw>2.2?2:1;for(let k=0;k<doors;k++){const dw=(mw-.04)/doors,dx=x-(mw-.04)/2+dw*(k+.5);frontPanel(dx,y0+(h-top_)/2,fz,dw-.02,h-top_-.03);pull(dx+(doors===2?(k?-1:1)*(dw/2-.18):dw/2-.18),y0+(h-top_)-.45,fz,dw,true);}}}
   box(0,baseTop+counterThick/2,0,w+.04,counterThick,dp+.08,counter,.02);
   const splashH=d.kitchenBacksplash==='Full-height slab'?2.5:1.5;
   if(d.kitchenBacksplash!=='None'){let from=-w/2;const spans=windowSpans(f,m,top,top+splashH).map(([a,b])=>[a-.25,b+.25]).sort((a,b)=>a[0]!-b[0]!);
    for(const [a,b] of [...spans,[w/2,w/2]]){const to=Math.min(w/2,a!);if(to-from>.3){let mat:T.Material;if(d.kitchenBacksplash==='Full-height slab')mat=counter;else{const base=d.kitchenBacksplash==='Chevron'?chevron():d.kitchenBacksplash==='Zellige'?zellige([214,226,221]):d.kitchenBacksplash==='Hexagon'?hexagon():subway();const map=base.clone();map.userData={};map.needsUpdate=true;map.repeat.set((to-from)/2,splashH/2);mat=std('#ffffff',.12,0,{map,clearcoat:.8,clearcoatRoughness:.08});}
     box((from+to)/2,top+splashH/2,-dp/2+.015,to-from,splashH,.02,mat);}from=Math.max(from,b!);}}
   const blocked=windowSpans(f,m,top+1.5,top+4.25);
   for(let i=0;i<n;i++){const x=-w/2+mw*(i+.5),x0=x-mw/2,x1=x+mw/2;if(blocked.some(([a,b])=>a<x1+.1&&b>x0-.1))continue;
    if(d.kitchenUppers==='Open shelving'){box(x,top+2.2,-dp/2+.45,mw-.1,.12,.85,std('#ffffff',.5,0,{map:butcherBlock()}),.01);for(let k=0;k<3;k++)cyl(x-mw*.25+k*mw*.25,top+2.45,-dp/2+.45,.25,.4,std('#f4f2ec',.25,0,{clearcoat:.6}),.25,20);continue;}
    const uy=top+1.5+1.25;box(x,uy,-dp/2+.5,mw-.01,2.5,1,cab);const doors=mw>2.2?2:1;
    for(let k=0;k<doors;k++){const dw=(mw-.04)/doors,dx=x-(mw-.04)/2+dw*(k+.5);frontPanel(dx,uy,-dp/2+1.02,dw-.02,2.46);pull(dx+(doors===2?(k?-1:1)*(dw/2-.18):dw/2-.18),uy-.85,-dp/2+1.02,dw,true);}
    box(x,uy-1.27,-dp/2+.85,mw-.2,.03,.08,warmLight);}
   // Styling: an espresso machine and a bowl.
   box(-w/2+.8,top+.55,-.1,.9,1.0,.9,brushed,.06);box(-w/2+.8,top+.25,.2,.5,.06,.25,iron);
   const bowl=new T.Mesh(new T.SphereGeometry(.32,24,12,0,Math.PI*2,Math.PI/2,Math.PI/2),std('#d9cbb2',.4));bowl.position.set(w*.15,top+.3,.1);bowl.castShadow=true;group.add(bowl);
   break;}
  case 'pantry-tower':{
   // Floor-to-ceiling pantry cabinet: tall doors over roll-out shelves, a stacked cabinet above.
   const H=Math.max(6.5,Math.min(ceiling-FLOOR-.05,9)),tallH=H*.68;box(0,FLOOR+H/2,-.04,w-.02,H,dp-.08,cab);
   const doors=w>2.2?2:1;for(let k=0;k<doors;k++){const dw=(w-.06)/doors,dx=-(w-.06)/2+dw*(k+.5);frontPanel(dx,FLOOR+.33+tallH/2,front-.02,dw-.02,tallH);frontPanel(dx,FLOOR+.33+tallH+(H-.33-tallH)/2,front-.02,dw-.02,H-.36-tallH);
    const px=dx+(doors===2?(k?-1:1)*(dw/2-.15):dw/2-.15);if(style==='Flat slab')box(px,FLOOR+.33+tallH*.55,front+.03,.03,Math.min(2.6,tallH*.6),.03,metal);else bar(px,FLOOR+.33+tallH*.55,front-.02,Math.min(2.2,tallH*.45),true);}
   box(0,FLOOR+.165,0,w-.1,.33,dp-.2,std('#2b2b2b',.8));box(0,FLOOR+H+.05,0,w+.06,.1,dp+.04,cab);
   break;}
  case 'island':{
   const kind=d.kitchenIsland||'Waterfall island',toe=FLOOR+.33;
   if(kind==='Butcher block work island'){
    // Furniture-style work island: turned legs, open shelf, thick maple top.
    const block=std('#ffffff',.45,0,{map:butcherBlock(),clearcoat:.3,clearcoatRoughness:.3});box(0,baseTop+.1,0,w,.2,dp,block,.02);
    for(const sx of [-1,1])for(const sz of [-1,1])lathe([[.0,0],[.13,0],[.1,.3],[.12,1.2],[.09,2.2],[.12,2.6],[.0,2.6]],cab,sx*(w/2-.3),FLOOR,sz*(dp/2-.3));
    box(0,baseTop-.25,0,w-.3,.4,dp-.3,cab);for(const sx of [-1,1])frontPanel(sx*(w/4-.05),baseTop-.25,dp/2-.13,w/2-.4,.32,cab,.08);
    box(0,FLOOR+.55,0,w-.4,.08,dp-.4,cab);for(let i=0;i<3;i++)lathe([[0,0],[.35,0],[.42,.25],[.3,.32],[0,.32]],std('#d9d2c3',.6),-w*.25+i*w*.25,FLOOR+.59,0);
    box(0,top+.13,.05,1.4,.06,.9,std('#a8794e',.5),.02);}
   else{
    const seating=kind==='Seating island & stools',overhang=seating?1.1:0;
    const bodyD=Math.max(1.6,dp-(seating?overhang+.1:1.1)),bodyZ=seating?-dp/2+bodyD/2+.05:-(dp-bodyD)/2;const bw=kind==='Waterfall island'?w-.6:w-.2;
    box(0,(toe+FLOOR)/2,bodyZ,bw,.33,bodyD-.25,std('#2b2b2b',.8));box(0,toe+(baseTop-toe)/2,bodyZ,bw,baseTop-toe,bodyD,cab);
    const n=Math.max(2,Math.round(bw/2));const mw=bw/n;for(let i=0;i<n;i++){const x=-bw/2+mw*(i+.5);frontPanel(x,toe+(baseTop-toe)/2,bodyZ-bodyD/2-.02,mw-.04,baseTop-toe-.1);if(!seating)frontPanel(x,toe+(baseTop-toe)/2,bodyZ+bodyD/2+.02,mw-.04,baseTop-toe-.1);}
    box(0,baseTop+counterThick/2,0,w,counterThick,dp,counter,.02);
    if(kind==='Waterfall island')for(const s of [-1,1])box(s*(w/2-.052),FLOOR+(baseTop-FLOOR)/2+.05,0,.104,baseTop-FLOOR+.1,dp,counter,.02);
    else for(const s of [-1,1])box(s*(w/2-.15),toe+(baseTop-toe)/2,bodyZ,.3,baseTop-toe+.1,bodyD+.05,cab);
    if(seating){const stoolMat=d.kitchenHardware==='Matte black'?std('#1e1e1e',.5,.35):std('#ffffff',.55,0,{map:walnut()});const stools=Math.max(2,Math.min(4,Math.floor(w/1.9)));
     for(let i=0;i<stools;i++){const sx=-w/2+w*(i+.5)/stools,sz=dp/2-.45;cyl(sx,FLOOR+2.15,sz,.6,.22,accentFabric,.62,24);cyl(sx,FLOOR+2.34,sz,.6,.08,accentFabric,.55,24);
      for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4,leg=cyl(sx+Math.cos(a)*.38,FLOOR+1.03,sz+Math.sin(a)*.38,.04,2.05,stoolMat,.035,8);leg.rotation.set(Math.sin(a)*.12,0,-Math.cos(a)*.12);}
      const ring=new T.Mesh(new T.TorusGeometry(.36,.025,8,32),metal);ring.rotation.x=Math.PI/2;ring.position.set(sx,FLOOR+.85,sz);group.add(ring);
      box(sx,FLOOR+2.8,sz+.5,1.1,.75,.12,accentFabric,.05);}}}
   // Island lighting, 30 in above the counter: domes, glass globes, lanterns or one linear chandelier.
   const shadeY=top+2.6,lights=d.kitchenPendants||'Dome',cordTo=(x:number,from:number)=>{cyl(x,(from+ceiling)/2,0,.012,Math.max(.1,ceiling-from),iron,.012,6).castShadow=false;};
   if(lights==='Linear chandelier'){const len=Math.min(w-.8,4.5);box(0,shadeY+.2,0,len,.08,.12,metal);for(const s of [-1,1])cordTo(s*len*.4,shadeY+.24);for(let i=0;i<5;i++){const x=-len/2+len*(i+.5)/5;cyl(x,shadeY,0,.16,.32,metal,.06,18);ball(x,shadeY-.12,0,.08,warmLight);}}
   else for(const px of [-w*.3,0,w*.3]){
    if(lights==='Glass globe'){cordTo(px,shadeY+.55);cyl(px,shadeY+.5,0,.09,.1,metal,.09,16);const globe=ball(px,shadeY,0,.45,glass);globe.castShadow=false;ball(px,shadeY,0,.1,warmLight);}
    else if(lights==='Lantern'){cordTo(px,shadeY+.75);const lw=.75,lh=1.1;for(const sx of [-1,1])for(const sz of [-1,1])box(px+sx*lw/2,shadeY+.1,sz*lw/2,.04,lh,.04,metal);for(const yy of [shadeY-.45,shadeY+.65])box(px,yy,0,lw+.04,.05,lw+.04,metal);box(px,shadeY+.1,0,lw,lh-.1,lw,glass);cyl(px,shadeY+.72,0,.02,.18,metal,.12,4);ball(px,shadeY,0,.11,warmLight);}
    else{cordTo(px,shadeY+.35);const shade=new T.Mesh(new T.SphereGeometry(.5,32,16,0,Math.PI*2,0,Math.PI/2),std(/brass|gold/i.test(interior.metal||'')?'#b89254':'#1f2223',.35,.8,{side:T.DoubleSide}));shade.position.set(px,shadeY,0);shade.castShadow=true;group.add(shade);ball(px,shadeY+.05,0,.13,warmLight);}}
   if(kind!=='Butcher block work island'){lathe([[.05,0],[.2,.05],[.24,.4],[.12,.8],[.15,.95]],std('#f2efe8',.3),w*.15,top,-.1);
    for(let i=0;i<6;i++){const stem=cyl(w*.15+Math.sin(i)*.12,top+1.15+i*.04,-.1+Math.cos(i)*.1,.01,.6,std('#56703f',.7),.01,5);stem.rotation.z=Math.sin(i*1.7)*.3;}}
   break;}
  case 'fridge':{
   const H=Math.min(5.85,(m.h||8)-.4),y0=FLOOR,split=y0+H*.36,dz=front-.05;
   if(d.kitchenFridge==='Panel-ready built-in'){
    // Panel-ready built-in: cabinet doors over the box, appliance pulls, a cabinet above to the ceiling.
    box(0,y0+H/2,-.06,w-.02,H,dp-.12,std('#d8d8d8',.4));for(const s of [-1,1])frontPanel(s*w/4,split+(y0+H-split)/2,dz+.02,w/2-.03,y0+H-split-.04);frontPanel(0,y0+(split-y0)/2,dz+.02,w-.03,split-y0-.05);
    for(const s of [-1,1])cyl(s*.12,split+(y0+H-split)*.55,dz+.14,.03,(y0+H-split)*.6,metal,.03,12);bar(0,split-.3,dz+.04,w*.7,false);
    const above=ceiling-(y0+H);if(above>.4){box(0,y0+H+above/2,-.06,w-.02,above-.05,dp-.12,cab);frontPanel(0,y0+H+above/2,dz+.02,w-.03,above-.08);}
    for(const s of [-1,1])box(s*(w/2-.04),(FLOOR+ceiling)/2,-.04,.08,ceiling-FLOOR,dp-.08,cab);}
   else{box(0,y0+H/2,-.06,w-.02,H,dp-.12,brushed,.04);
    for(const s of [-1,1]){box(s*(w/4),split+(y0+H-split)/2+.01,dz,w/2-.03,y0+H-split-.04,.12,brushed,.04);cyl(s*.1,split+(y0+H-split)*.55,dz+.16,.035,(y0+H-split)*.6,metal,.035,14);
     for(const e of [-1,1]){const post=cyl(s*.1,split+(y0+H-split)*.55+e*(y0+H-split)*.28,dz+.1,.02,.12,metal,.02,8);post.rotation.x=Math.PI/2;}}
    box(0,y0+(split-y0)/2,dz,w-.03,split-y0-.05,.12,brushed,.04);bar(0,split-.3,dz+.06,w*.7,false);box(-w/4,split+(y0+H-split)*.55,dz+.07,.55,.8,.02,blackGlass);}
   break;}
  case 'console':{
   // Media wall: TV over a fluted walnut console, a fireplace with a TV or art above, or painted built-ins.
   const media=d.livingMedia||'TV console';const tvW=Math.min(w*.95,4.7),tvH=tvW*.5625;
   const glassBehind=windowSpans(f,m,FLOOR+2.5,FLOOR+7).some(([a,b])=>a<w/2-.3&&b>-w/2+.3);
   const tv=(x:number,y:number,width:number,z=-dp/2+.08)=>{const height=width*.5625;box(x,y,z,width,height,.09,std('#111111',.4),.02);const panel=new T.Mesh(new T.PlaneGeometry(width-.08,height-.08),new T.MeshPhysicalMaterial({color:'#ffffff',map:screen(),emissive:'#ffffff',emissiveMap:screen(),emissiveIntensity:.55,roughness:.05,clearcoat:1,clearcoatRoughness:.03}));panel.position.set(x,y,z+.05);group.add(panel);};
   const books=(x:number,y:number,z:number)=>{const colors=['#334f53','#896b51','#a89670','#733f47'];for(let i=0;i<4;i++)box(x+i*.17,y+.31,z,.14,.62,.8,std(colors[i]!,.85),.015);};
   const lamp=(x:number,y:number)=>{lathe([[0,0],[.18,0],[.3,.25],[.32,.55],[.2,.85],[.07,.95],[.07,1.05],[0,1.05]],std('#d9d2c3',.35,0,{clearcoat:.5}),x,y,0);cyl(x,y+1.25,0,.012,.4,living,.012,6);const shade=new T.Mesh(new T.CylinderGeometry(.42,.55,.75,32,1,true),std('#efe7d8',.95,0,{side:T.DoubleSide,emissive:'#ffcf8f',emissiveIntensity:.3}));shade.position.set(x,y+1.55,0);shade.castShadow=true;group.add(shade);ball(x,y+1.45,0,.12,warmLight);};
   if(!glassBehind&&(media==='Fireplace & TV'||media==='Fireplace & art')){
    // Chimney breast with a linear fireplace, stone hearth and an oak beam mantel.
    const breastH=ceiling-FLOOR,fw=Math.min(w-.2,6.5);box(0,FLOOR+breastH/2,-.05,fw,breastH,dp-.1,plaster);box(0,FLOOR+.06,front-.15,fw+.3,.12,.5,std('#ffffff',.8,0,{map:concrete()}),.02);
    const fbW=Math.min(fw-1,4.2);box(0,FLOOR+1.55,front-.05,fbW+.3,1.3,.06,iron);const fire=new T.Mesh(new T.PlaneGeometry(fbW,1.0),new T.MeshStandardMaterial({color:'#ffffff',map:flames(),emissive:'#ffffff',emissiveMap:flames(),emissiveIntensity:1.4}));fire.position.set(0,FLOOR+1.55,front-.015);group.add(fire);
    for(let i=0;i<3;i++){const log=cyl(-fbW*.25+i*fbW*.25,FLOOR+1.2,front-.1,.08,1.1,std('#4a3426',.9),.08,10);log.rotation.z=Math.PI/2;log.rotation.y=.3*(i-1);}
    box(0,FLOOR+2.75,front-.05,fw+.4,.42,.6,darkWood,.03);
    if(media==='Fireplace & TV')tv(0,FLOOR+4.7,Math.min(fw-.6,4.4),front-.02);
    else{box(0,FLOOR+4.6,front-.06,Math.min(fw-1.2,3.6),2.6,.08,std('#2a2420',.6),.02);const art=new T.Mesh(new T.PlaneGeometry(Math.min(fw-1.2,3.6)-.25,2.35),std('#ffffff',.8,0,{map:artwork()}));art.position.set(0,FLOOR+4.6,front-.015);group.add(art);}
    for(const s of [-1,1]){cyl(s*(fw/2-.5),FLOOR+3.25,front-.1,.07,.6,std('#efe9dc',.6),.07,12);}lathe([[.05,0],[.25,.1],[.3,.45],[.14,.85],[.18,1]],std('#c9b89a',.6),fw*.25,FLOOR+2.96,front-.15);}
   else if(!glassBehind&&media==='Built-in shelves & TV'){
    const tower=Math.min(1.8,w*.22),mid=w-2*tower,low=2.4;box(0,FLOOR+low/2,0,mid,low,dp,cab);for(const s of [-1,1])frontPanel(s*mid/4,FLOOR+low/2+.1,front+.02,mid/2-.06,low-.4);box(0,FLOOR+low+.05,0,mid+.05,.1,dp+.05,cab);
    tv(0,FLOOR+low+.6+Math.min(mid-.4,4.4)*.28,Math.min(mid-.4,4.4));
    for(const s of [-1,1]){const tx=s*(w/2-tower/2),th=Math.min(ceiling-FLOOR-.2,7.6);box(tx,FLOOR+th/2,-dp/2+.05,tower,th,.1,cab);for(const sx of [-1,1])box(tx+sx*(tower/2-.05),FLOOR+th/2,0,.1,th,dp,cab);box(tx,FLOOR+.9,0,tower,1.4,dp,cab);frontPanel(tx,FLOOR+.95,front+.02,tower-.1,1.3);
     for(let k=0;k<4;k++){const sy=FLOOR+1.6+k*(th-1.8)/4;box(tx,sy,0,tower-.1,.07,dp-.05,cab);if(k%2===0)books(tx-tower/2+.25,sy+.03,0);else lathe([[.05,0],[.2,.08],[.24,.4],[.1,.75],[.13,.85]],std('#e8e2d6',.4),tx,sy+.04,0);}
     box(tx,FLOOR+th+.05,0,tower+.1,.12,dp+.1,cab);}}
   else{
    // Fluted walnut console on slim legs, TV above (or a ceramic lamp when a window is behind it).
    const wood=std('#ffffff',.55,0,{map:walnut()}),ch=1.75,cy=FLOOR+.45+ch/2;box(0,cy,0,w,ch,dp,wood,.03);
    for(const s of [-1,1])for(const e of [-1,1])cyl(s*(w/2-.3),FLOOR+.24,e*(dp/2-.25),.03,.45,iron,.03,8);
    const flutes=Math.floor((w-.3)/.12);for(let i=0;i<flutes;i++){const flute=cyl(-w/2+.15+(i+.5)*(w-.3)/flutes,cy,front+.005,.045,ch-.25,wood,.045,8);flute.scale.z=.45;flute.layers.set(2);}
    const tvY=Math.min(FLOOR+5.1,cy+ch/2+.9+tvH/2);const tvBlocked=windowSpans(f,m,tvY-tvH/2,tvY+tvH/2).some(([a,b])=>a<tvW/2&&b>-tvW/2);
    if(tvBlocked)lamp(-w/2+.55,cy+ch/2);else tv(0,tvY,tvW);
    books(tvBlocked?-w*.08:-w*.32,cy+ch/2,0);lathe([[.05,0],[.25,.1],[.3,.45],[.14,.85],[.18,1]],std('#c9b89a',.6),w*.3,cy+ch/2,0);}
   break;}
  case 'rug':{box(0,FLOOR+.025,0,w,.05,dp,rugMaterial(d,interior,std),.02);break;}
  case 'floorlamp':{
   // The arc spans the footprint: marble base at one side, shade over the other.
   const baseR=Math.min(.55,w*.2),shadeR=Math.min(.75,w*.25),bx=-w/2+baseR,reach=Math.max(.4,w-baseR-shadeR),sx=bx+reach;
   cyl(bx,FLOOR+.12,0,baseR,.22,std('#e9e6e1',.25,0,{clearcoat:.6}),baseR*.9,32);const arc=new T.CatmullRomCurve3([new T.Vector3(bx,FLOOR+.2,0),new T.Vector3(bx,FLOOR+4.6,0),new T.Vector3(bx+reach*.43,FLOOR+6.1,0),new T.Vector3(sx,FLOOR+5.6,0)]);
   const pole=new T.Mesh(new T.TubeGeometry(arc,40,.04,10,false),living);pole.castShadow=true;group.add(pole);
   const shade=new T.Mesh(new T.CylinderGeometry(shadeR*.8,shadeR,.85,32,1,true),std('#efe7d8',.95,0,{side:T.DoubleSide,emissive:'#ffcf8f',emissiveIntensity:.35}));shade.position.set(sx,FLOOR+5.05,0);group.add(shade);
   ball(sx,FLOOR+5,0,.15,warmLight);break;}
  case 'plant':{
   // Fiddle-leaf fig in a matte white planter.
   const pr=Math.min(.5,Math.min(w,dp)/2-.05);lathe([[.0,0],[pr*.84,0],[pr,.9],[pr*.94,.95],[0,.95]],std('#efede8',.8),0,FLOOR,0);
   cyl(0,FLOOR+.93,0,pr*.88,.02,std('#3b3027',1));const trunk=new T.CatmullRomCurve3([new T.Vector3(0,FLOOR+.9,0),new T.Vector3(.08,FLOOR+2.4,.05),new T.Vector3(-.05,FLOOR+4,-.04),new T.Vector3(.04,FLOOR+5.4,0)]);const stem=new T.Mesh(new T.TubeGeometry(trunk,20,.045,8,false),std('#6b5340',.9));stem.castShadow=true;group.add(stem);
   const leafMat=std('#3f6b2e',.42,0,{clearcoat:.5,clearcoatRoughness:.3,side:T.DoubleSide});const leafGeo=new T.SphereGeometry(1,14,10);const r=rand(31);
   const k=Math.min(1,Math.min(w,dp)/2.2),spread=Math.max(.15,Math.min(w,dp)/2+.12-.48*k);for(let i=0;i<34;i++){const t=.25+r()*.75,p=trunk.getPoint(t),a=i*2.39,reach=spread*(.35+r()*.65);const leaf=new T.Mesh(leafGeo,leafMat);leaf.scale.set(.32*k,.035,.48*k);leaf.position.set(p.x+Math.cos(a)*reach,p.y+(r()-.3)*.3,p.z+Math.sin(a)*reach);leaf.rotation.set(.5+r()*.5,-a+Math.PI/2,(r()-.5)*.6);leaf.castShadow=true;group.add(leaf);}
   break;}
  case 'sectional':case 'sofa':{
   // Upholstered seating built from real proportions: 17 in seat, 30–34 in back, 30–40 in deep.
   const seatD=2.7;
   /** A straight run along local x with its back at z=-depth/2; arms where asked. */
   const run=(length:number,depth:number,arms:[boolean,boolean],parent:T.Object3D,opts:{legs?:boolean;tufted?:boolean;low?:boolean}={})=>{
    const arm=.45,inner=length-(arms[0]?arm:0)-(arms[1]?arm:0),ix=((arms[0]?arm:0)-(arms[1]?arm:0))/2,baseY=opts.legs?FLOOR+.45:FLOOR,backH=opts.low?1.0:1.35;
    box(0,baseY+.3,0,length,.6,depth,fabric,.08,parent);
    if(opts.legs){const legMat=std('#ffffff',.55,0,{map:walnut()});for(const sx of [-1,1])for(const sz of [-1,1]){const leg=cyl(sx*(length/2-.25),FLOOR+.23,sz*(depth/2-.25),.04,.45,legMat,.055,10,parent);leg.rotation.z=sx*.12;}}
    const n=Math.max(1,Math.round(inner/2.6)),cw=inner/n;for(let i=0;i<n;i++){const cx=ix-inner/2+cw*(i+.5);box(cx,baseY+.72,.12,cw-.04,.32,depth-.5,fabric,.12,parent);
     const back=box(cx,baseY+.6+backH/2+.1,-depth/2+.3,cw-.04,backH,.5,fabric,.15,parent);back.rotation.x=-.08;
     if(opts.tufted)for(let k=0;k<3;k++)ball(cx-cw*.3+k*cw*.3,baseY+.6+backH*.6,-depth/2+.57,.035,fabric,parent);}
    for(const [k,s] of [[0,-1],[1,1]] as [number,number][])if(arms[k])box(s*(length/2-arm/2),baseY+.75,0,arm,opts.low?.9:1.1,depth,fabric,.1,parent);
    if(!opts.low)box(ix,baseY+.6+.12,-depth/2+.12,inner,.25,.25,fabric,.05,parent);};
   const pillows=(x:number,y:number,z:number,count:number,spread:number,parent:T.Object3D=group,angle=0)=>{for(let i=0;i<count;i++){const p=box(x+(i-(count-1)/2)*spread,y,z,.85,.8,.25,i%2?linen:accentFabric,.13,parent);p.rotation.set(-.25,angle,(i-(count-1)/2)*.15);}};
   const sub=(x:number,z:number,ry:number)=>{const g=new T.Group();g.position.set(x,0,z);g.rotation.y=ry;group.add(g);return g;};
   const kind=f.kind==='sectional'?(d.seatingKind||'u'):d.livingSeating==='Curved sofa'?'curved':d.livingSeating==='Mid-century sofa'?'mid':'track';
   if(f.kind==='sectional'){
    // Rug under the whole group, then the seating.
    box(0,FLOOR+.02,0,w-.3,.04,dp-.3,rugMaterial(d,interior,std),.02);
    if(kind==='chairs'){const sw=Math.min(w-1,8);run(sw,seatD,[true,true],sub(0,-dp/2+seatD/2,0));pillows(0,FLOOR+1.55,-dp/2+.75,3,sw*.3);
     for(const s of [-1,1]){const chair=sub(s*(w/2-1.35),dp/2-1.45,-s*Math.PI/2);run(2.6,2.6,[true,true],chair);pillows(0,FLOOR+1.5,-.6,1,0,chair);}}
    else{run(w,seatD,[kind==='l',false],sub(0,-dp/2+seatD/2,0));
     const ret=dp-seatD;for(const s of kind==='u'?[-1,1]:[1]){const g=sub(s*(w/2-seatD/2),-dp/2+seatD+ret/2,-s*Math.PI/2);run(ret,seatD,[s<0,s>0],g);}
     pillows(-w*.25,FLOOR+1.55,-dp/2+.75,2,.9);pillows(w*.2,FLOOR+1.55,-dp/2+.75,2,.9);
     // A throw over one return.
     box(w/2-seatD/2,FLOOR+1.08,dp/2-1.3,seatD-.5,.05,1.2,accentFabric,.02);}}
   else if(kind==='curved'){
    // Curved sofa: wedge segments along a shallow arc, ends reaching forward.
    const sag=.55,chord=w*.8-.3,R=(chord*chord/4+sag*sag)/(2*sag),half=Math.asin(Math.min(1,chord/2/R)),n=7,depth=Math.min(2.5,dp-.3),midZ=-dp/2+depth/2;
    for(let i=0;i<n;i++){const a=-half+2*half*(i+.5)/n,seg=new T.Group();seg.position.set(Math.sin(a)*R,0,midZ+R-Math.cos(a)*R);seg.rotation.y=-a;group.add(seg);
     const len=2*R*Math.sin(half/n)+.06;box(0,FLOOR+.42,0,len,.56,depth,fabric,.06,seg);box(0,FLOOR+.85,.08,len,.3,depth-.5,fabric,.1,seg);box(0,FLOOR+1.5,-depth/2+.28,len,1.15,.45,fabric,.1,seg);}
    pillows(0,FLOOR+1.55,-dp/2+.9,3,w*.22);}
   else if(kind==='mid'){run(w,Math.min(2.6,dp-.2),[true,true],group,{legs:true,tufted:true,low:true});for(const s of [-1,1]){const bolster=cyl(s*(w/2-.75),FLOOR+1.55,.1,.22,.9,accentFabric,.22,20);bolster.rotation.x=Math.PI/2;bolster.rotation.z=Math.PI/2;}}
   else{run(w,Math.min(seatD,dp-.1),[true,true],group);pillows(0,FLOOR+1.55,-dp/2+.75,2,w*.45);}
   break;}
  case 'coffee':{
   const style=d.livingCoffee||'Walnut rectangle';
   if(style==='Round marble'){const big=Math.min(dp,w*.55)/2,small=big*.75;cyl(-w/2+big+.05,FLOOR+.78,0,big,.12,std('#ffffff',.15,0,{map:marble(),clearcoat:.8}),big,40);cyl(-w/2+big+.05,FLOOR+.38,0,big*.65,.72,std('#3a2e26',.6),big*.65,32);
    cyl(w/2-small-.05,FLOOR+.62,dp*.12,small,.1,std('#ffffff',.15,0,{map:marble(),clearcoat:.8}),small,40);cyl(w/2-small-.05,FLOOR+.3,dp*.12,small*.6,.58,std('#3a2e26',.6),small*.6,32);
    lathe([[.05,0],[.2,.05],[.22,.35],[.08,.6],[.1,.7]],std('#5d6b5b',.4),-w/2+big+.05,FLOOR+.84,0);}
   else if(style==='Upholstered ottoman'){box(0,FLOOR+.75,0,w,1.1,dp,accentFabric,.25);for(let i=0;i<4;i++)for(let k=0;k<2;k++)ball(-w*.375+i*w*.25,FLOOR+1.31,-dp*.25+k*dp*.5,.04,accentFabric);box(w*.2,FLOOR+1.36,0,1.3,.06,.9,std('#2a2a2a',.4,.3),.02);books(w*.2-.4,FLOOR+1.39,0);}
   else if(style==='Glass & brass'){const brass=std('#b8924f',.28,1);for(const sx of [-1,1])for(const sz of [-1,1])box(sx*(w/2-.05),FLOOR+.65,sz*(dp/2-.05),.05,1.3,.05,brass);for(const yy of [FLOOR+.25,FLOOR+1.28])for(const sz of [-1,1])box(0,yy,sz*(dp/2-.05),w,.05,.05,brass);for(const yy of [FLOOR+.25,FLOOR+1.28])for(const sx of [-1,1])box(sx*(w/2-.05),yy,0,.05,.05,dp,brass);
    box(0,FLOOR+1.32,0,w,.04,dp,glass);box(0,FLOOR+.28,0,w-.1,.03,dp-.1,glass);books(-w*.25,FLOOR+1.34,0);lathe([[.05,0],[.2,.05],[.22,.35],[.08,.6],[.1,.7]],std('#d9d2c3',.4),w*.25,FLOOR+1.34,0);}
   else{const wood=std('#ffffff',.5,0,{map:walnut()});box(0,FLOOR+1.15,0,w,.17,dp,wood,.04);for(const s of [-1,1])box(s*(w/2-.35),FLOOR+.55,0,.17,1.05,dp-.2,wood,.02);box(0,FLOOR+.3,0,w-.8,.08,dp-.3,wood);books(-w*.3,FLOOR+1.24,0);lathe([[.05,0],[.25,.1],[.3,.45],[.14,.85],[.18,1]],std('#c9b89a',.6),w*.28,FLOOR+1.24,0);}
   break;}
 }
 function books(x:number,y:number,z:number){const colors=['#334f53','#896b51','#a89670'];for(let i=0;i<3;i++)box(x,y+i*.09+.04,z,.85-i*.1,.08,.6,std(colors[i]!,.85),.012);}
 // Safety net: a piece never spills past its planned footprint (narrow plans get a proportionally smaller one).
 const size=new T.Box3().setFromObject(group).getSize(new T.Vector3()),fit=Math.min(1,(w+.3)/Math.max(size.x,1e-3),(dp+.3)/Math.max(size.z,1e-3));if(fit<1)group.scale.set(fit,1,fit);
 group.rotation.y=-f.rotation;group.position.set(f.x-m.w/2,0,f.z-m.d/2);group.userData.editTarget={kind:'furniture',id:f.id};group.userData.stagingKind=f.kind;group.name=f.kind;
 scene.add(group);return true;
}

function rugMaterial(d:Design,interior:any,std:(c:string,r:number,m?:number,e?:Partial<T.MeshPhysicalMaterialParameters>)=>T.MeshPhysicalMaterial){
 const map=d.livingRug==='Vintage Persian'?persianRug():d.livingRug==='Natural jute'?juteRug():d.livingRug==='Solid plush'?plushRug(interior.fabric||'#c9bfae'):trellisRug(interior.fabric||'#c9bfae',interior.accent||'#4d5a63');
 return std('#ffffff',.97,0,{map,sheen:1,sheenRoughness:.8,sheenColor:new T.Color('#ffffff')});
}

/** Spans (in the piece's local x) where a window in the wall behind the piece overlaps height y0..y1. */
function windowSpans(f:any,m:any,y0:number,y1:number):[number,number][]{
 const cos=Math.cos(-f.rotation),sin=Math.sin(-f.rotation);const local=(lx:number,lz:number)=>({x:f.x+lx*cos+lz*sin,z:f.z-lx*sin+lz*cos});
 const back=local(0,-f.localDepth/2),ax=local(1,0);const along={x:ax.x-f.x,z:ax.z-f.z};
 let best:any=null,dist=1.6;for(const wall of m.walls||[]){const onX=wall.axis==='x',dd=onX?Math.abs(back.z-wall.z):Math.abs(back.x-wall.x);const inRange=onX?back.x>=wall.x-1&&back.x<=wall.x+wall.length+1:back.z>=wall.z-1&&back.z<=wall.z+wall.length+1;if(inRange&&dd<dist){dist=dd;best=wall;}}
 if(!best)return [];const onX=best.axis==='x',sign=onX?Math.sign(along.x)||1:Math.sign(along.z)||1;const start=onX?best.x:best.z;const centre=onX?back.x:back.z;
 return best.openings.filter((o:any)=>o.kind==='window'&&o.bottom<y1&&o.bottom+o.height>y0).map((o:any)=>{const a=(start+o.at-centre)*sign,b=(start+o.at+o.width-centre)*sign;return [Math.min(a,b),Math.max(a,b)] as [number,number];});
}
