import * as T from 'three';

// Facade character drawn on the house's own openings: window grilles, shutters, entry-door styles and the
// front-door surround. Positions are in house feet (the scene's `box`/`mesh` helpers centre them).
type Box=(x:number,y:number,z:number,a:number,b:number,c:number,mat:T.Material|T.Material[])=>T.Mesh;
type MeshAt=(geo:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number)=>T.Mesh;

let diamondTexture:T.CanvasTexture|null=null;
function diamond(){
 if(diamondTexture)return diamondTexture;
 const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d')!;g.clearRect(0,0,128,128);g.strokeStyle='#2b2b2b';g.lineWidth=7;
 g.beginPath();g.moveTo(0,64);g.lineTo(64,0);g.lineTo(128,64);g.lineTo(64,128);g.closePath();g.stroke();
 diamondTexture=new T.CanvasTexture(c);diamondTexture.wrapS=diamondTexture.wrapT=T.RepeatWrapping;diamondTexture.colorSpace=T.SRGBColorSpace;diamondTexture.userData.persistent=true;return diamondTexture;
}

/** Grille bars over one window's glass. `x,z` is the window centre on the wall line. */
export function addGrilles(box:Box,mesh:MeshAt,kind:string,windowType:string,x:number,z:number,along:boolean,width:number,bottom:number,height:number,bar:T.Material){
 if(kind==='none'||height<=.4)return;const t=.05,deep=.13;
 const v=(offset:number,y0:number,y1:number)=>box(x+(along?offset:0),(y0+y1)/2,z+(along?0:offset),along?t:deep,y1-y0,along?deep:t,bar);
 const hz=(y:number,o0=-width/2,o1=width/2)=>box(x+(along?(o0+o1)/2:0),y,z+(along?0:(o0+o1)/2),along?o1-o0:deep,t,along?deep:o1-o0,bar);
 const top=bottom+height,mid=bottom+height/2,twoSash=windowType==='Double hung';
 if(kind==='colonial'){
  const cols=width>=2.5?[-width/6,width/6]:[0];for(const c of cols)v(c,bottom,top);
  const rows=twoSash?[bottom+height/4,bottom+height*3/4]:[bottom+height/3,bottom+height*2/3];for(const r of rows)hz(r);
 }else if(kind==='prairie'){
  const inset=Math.min(.38,width/5,height/5);for(const c of [-width/2+inset,width/2-inset])v(c,bottom,top);for(const r of [bottom+inset,top-inset])hz(r);
 }else if(kind==='craftsman'){
  const from=twoSash?mid:bottom+height*.62;for(const c of (width>=2.5?[-width/6,width/6]:[-width/8,width/8]))v(c,from,top);
 }else if(kind==='diamond'){
  const geo=new T.PlaneGeometry(width,height);const uv=geo.getAttribute('uv') as T.BufferAttribute;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*width/.55,uv.getY(i)*height/.8);
  const mat=new T.MeshBasicMaterial({map:diamond(),transparent:true,depthWrite:false,side:T.DoubleSide});
  const plane=mesh(geo,mat,x,mid,z);if(!along)plane.rotation.y=Math.PI/2;plane.castShadow=false;plane.name='Leaded diamond lites';
 }
}

const shutterMats=new Map<string,T.MeshStandardMaterial>();
let louverTexture:T.CanvasTexture|null=null;
function louvers(){
 if(louverTexture)return louverTexture;const c=document.createElement('canvas');c.width=64;c.height=256;const g=c.getContext('2d')!;
 g.fillStyle='#ffffff';g.fillRect(0,0,64,256);for(let y=0;y<256;y+=16){const grad=g.createLinearGradient(0,y,0,y+16);grad.addColorStop(0,'#ffffff');grad.addColorStop(.7,'#d4d4d4');grad.addColorStop(1,'#8f8f8f');g.fillStyle=grad;g.fillRect(6,y,52,16);}
 g.fillStyle='#ffffff';g.fillRect(0,0,6,256);g.fillRect(58,0,6,256);
 louverTexture=new T.CanvasTexture(c);louverTexture.colorSpace=T.SRGBColorSpace;louverTexture.userData.persistent=true;return louverTexture;
}
/** Shutter color that contrasts with the siding: deep green-black on light siding, cream on dark. */
export function shutterColor(siding:string){const c=new T.Color(siding);const hsl={h:0,s:0,l:0};c.getHSL(hsl,T.SRGBColorSpace);return hsl.l>.3?'#25332d':'#ece6d6';}
function shutterMaterial(kind:string,color:string){
 const key=kind+color;let m=shutterMats.get(key);if(m)return m;
 m=new T.MeshStandardMaterial({color,roughness:.6,map:kind==='louvered'?louvers():null});m.userData.persistent=true;shutterMats.set(key,m);return m;
}
/** A pair of shutters beside an exterior window. `outward` is the wall's outside direction (±1 on its normal axis). */
export function addShutters(box:Box,kind:string,color:string,x:number,z:number,along:boolean,outward:number,face:number,width:number,bottom:number,height:number){
 if(kind==='none'||width<2||height<1.5)return;
 const sw=Math.min(width/2,1.7),gap=width/2+.34+sw/2,depth=.1,off=outward*(face+depth/2+.02),mat=shutterMaterial(kind,color),accent=shutterMaterial('plain',color);
 for(const side of [-1,1]){
  const cx=x+(along?side*gap:off),cz=z+(along?off:side*gap),y=bottom+height/2;
  const panel=box(cx,y,cz,along?sw:depth,height,along?depth:sw,mat);panel.name='Window shutter';
  const proud=(dy:number,h:number,inset=.16)=>box(cx+(along?0:outward*.04),y+dy,cz+(along?outward*.04:0),along?sw-inset*2:depth,h,along?depth:sw-inset*2,accent);
  if(kind==='panel'){const ph=(height-.6)/2;proud(ph/2+.1,ph);proud(-ph/2-.1,ph);}
  else if(kind==='batten'){for(const dy of [height/2-.45,-height/2+.45])proud(dy,.22,.05);
   const brace=box(cx+(along?0:outward*.05),y,cz+(along?outward*.05:0),along?.18:depth,Math.hypot(sw-.2,height-1.1),along?depth:.18,accent);brace.rotation[along?'z':'x']=Math.atan2(sw-.2,height-1.1)*(along?side:-side);}
 }
}

/** Raised panels, glass lites and hardware on an exterior door leaf (children of the leaf, so they swing with it). */
export function decorateDoor(leaf:T.Mesh,style:string,along:boolean,width:number,height:number,mats:{panel:T.Material,glass:T.Material,metal:T.Material}){
 const thick=.16,add=(u:number,y:number,w:number,h:number,mat:T.Material,proud=.025,both=true)=>{for(const side of both?[-1,1]:[-1]){const m=new T.Mesh(new T.BoxGeometry(along?w:proud*2,h,along?proud*2:w),mat);m.position.set(along?u:side*thick/2,y-height/2,along?side*thick/2:u);m.castShadow=true;m.name='Door detail';leaf.add(m);}};
 const lw=width,inner=lw-.5;
 if(style==='six-panel'){const pw=(inner-.15)/2;for(const c of [-pw/2-.075,pw/2+.075]){add(c,height*.83,pw,height*.2,mats.panel);add(c,height*.55,pw,height*.27,mats.panel);add(c,height*.2,pw,height*.32,mats.panel);}}
 else if(style==='craftsman'){const lite=(inner-.2)/3;for(let i=0;i<3;i++)add(-inner/2+lite/2+i*(lite+.1),height*.8,lite,height*.18,mats.glass,.03);add(0,height*.69,lw-.25,.12,mats.panel,.06);for(const c of [-inner/4,inner/4])add(c,height*.32,inner/2-.12,height*.5,mats.panel);}
 else if(style==='glass'){add(0,height*.53,inner,height*.86,mats.glass,.03);}
 else if(style==='dutch'){add(0,height*.5,lw,.05,mats.metal,.09);add(0,height*.49,lw+.08,.1,mats.panel,.12,false);for(const r of [0,1])for(const c of [0,1])add(-inner/4+c*inner/2,height*.68+r*height*.14,inner/2-.08,height*.13,mats.glass,.03);add(0,height*.22,inner,height*.3,mats.panel);}
 else if(style==='plank'){for(let u=-lw/2+lw/5;u<lw/2-.05;u+=lw/5)add(u,height/2,.03,height-.1,mats.metal,.012);for(const y of [height*.2,height*.8])add(-lw/2+lw*.28,y,lw*.55,.11,mats.metal,.035,false);add(0,height*.72,.42,.32,mats.glass,.03);}
}

/** Front-door surround on the outside face of the front wall. `x` is the door centre; `face` the wall's outer face z. */
export function addEntrySurround(box:Box,mesh:MeshAt,style:string,x:number,face:number,doorWidth:number,doorHeight:number,wallTop:number,trim:T.Material,glass:T.Material){
 if(style==='casing')return;const out=-1,z=(d:number)=>face+out*d;
 if(style==='pediment'){
  for(const s of [-1,1]){box(x+s*(doorWidth/2+.42),doorHeight/2,z(.1),.42,doorHeight,.2,trim).name='Entry pilaster';box(x+s*(doorWidth/2+.42),.2,z(.14),.56,.4,.28,trim);box(x+s*(doorWidth/2+.42),doorHeight-.12,z(.14),.56,.24,.28,trim);}
  const span=doorWidth+1.5,beamY=doorHeight+.25;box(x,beamY,z(.15),span,.42,.3,trim).name='Entry entablature';
  const rise=Math.min(1.1,wallTop-beamY-.3);if(rise>.35){const shape=new T.Shape();shape.moveTo(-span/2-.1,0);shape.lineTo(span/2+.1,0);shape.lineTo(0,rise);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:.3,bevelEnabled:false});geo.translate(0,0,-.3);const ped=mesh(geo,trim as T.Material,x,beamY+.21,z(0));ped.name='Entry pediment';}
 }else if(style==='craftsman'){
  box(x,doorHeight+.3,z(.14),doorWidth+1.3,.5,.28,trim).name='Craftsman entry header';box(x,doorHeight+.62,z(.2),doorWidth+1.5,.14,.4,trim);
  for(const s of [-1,1]){const b=box(x+s*(doorWidth/2+.35),doorHeight-.15,z(.12),.22,.5,.24,trim);b.name='Header bracket';}
 }else if(style==='fanlight'){
  const radius=Math.min(doorWidth/2+.1,wallTop-doorHeight-.35);if(radius<.5)return;const base=doorHeight+.12;
  const pane=mesh(new T.CircleGeometry(radius-.12,32,0,Math.PI),glass as T.Material,x,base,z(.03));pane.name='Arched fanlight';
  const arch=mesh(new T.TorusGeometry(radius,.11,8,32,Math.PI),trim as T.Material,x,base,z(.08));arch.name='Fanlight arch trim';
  box(x,base+radius,z(.1),.3,.42,.22,trim).name='Keystone';
  for(let i=1;i<4;i++){const a=Math.PI*i/4;const bar=box(x+Math.cos(a)*(radius-.12)/2,base+Math.sin(a)*(radius-.12)/2,z(.05),.045,radius-.14,.06,trim);bar.rotation.z=a-Math.PI/2;}
 }else if(style==='hood'){
  const span=doorWidth+1.4,y=Math.min(doorHeight+.75,wallTop-.3),proj=1.6;
  const roof=box(x,y,z(proj/2),span,.12,proj,trim);roof.rotation.x=.22;roof.name='Entry hood';
  box(x,y-.32,z(proj-.08),span,.32,.1,trim).name='Hood fascia';
  for(const s of [-1,1]){const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(proj-.2,0);shape.quadraticCurveTo(.15,-.25,0,-1.1);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:false});geo.translate(0,0,-.09);geo.rotateY(Math.PI/2);const bracket=mesh(geo,trim as T.Material,x+s*(span/2-.35),y-.15,z(0));bracket.name='Hood bracket';}
 }
}
