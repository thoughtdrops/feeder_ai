import * as T from 'three';
// Procedural roof coverings, drawn to real course sizes so they read at true scale:
// architectural asphalt (5-5/8 in exposure), 18 in cedar (5-1/2 in) and 20 × 10 in slate (8-1/2 in).
// Canvases are built once per page; each render wraps them in fresh textures it can dispose.
export const COVERINGS:Record<string,{width:number,height:number,metal?:boolean}>={
 'Ribbed metal':{width:4,height:4,metal:true},
 'Architectural asphalt shingles':{width:4,height:8*5.625/12},
 'Cedar shingles':{width:4,height:8*5.5/12},
 'Natural slate':{width:5,height:6*8.5/12},
};
const canvases=new Map<string,HTMLCanvasElement>();
function random(seed:number){return()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};}
function draw(kind:string){
 const cached=canvases.get(kind);if(cached)return cached;
 const size=512,cvs=document.createElement('canvas');cvs.width=cvs.height=size;const ctx=cvs.getContext('2d')!;const rnd=random(kind.length*7919+11);
 const courses=kind==='Natural slate'?6:8,band=size/courses;
 const grain=(x:number,y:number,w:number,h:number,base:number,spread:number,alpha:number,count:number)=>{for(let i=0;i<count;i++){const g=base+(rnd()-.5)*spread;ctx.fillStyle=`rgba(${g},${g},${g},${alpha})`;ctx.fillRect(x+rnd()*w,y+rnd()*h,1+rnd()*1.5,1+rnd()*1.5);}};
 if(kind==='Architectural asphalt shingles'){
  ctx.fillStyle='#d2d2d2';ctx.fillRect(0,0,size,size);
  for(let c=0;c<courses;c++){const y=c*band;let x=-rnd()*90;
   while(x<size){const tab=50+rnd()*95,tone=175+rnd()*60;ctx.fillStyle=`rgb(${tone},${tone},${tone})`;ctx.fillRect(x,y,tab,band);
    // The laminate's darker lower layer shows as a stepped shadow band under each tab.
    const drop=band*(.18+rnd()*.32);ctx.fillStyle=`rgba(40,40,40,${.35+rnd()*.25})`;ctx.fillRect(x,y+band-drop,tab,drop);
    ctx.fillStyle='rgba(20,20,20,.55)';ctx.fillRect(x,y,2,band);x+=tab;}
   grain(0,y,size,band,190,140,.35,2600);ctx.fillStyle='rgba(15,15,15,.75)';ctx.fillRect(0,y+band-3,size,3);}
 }else if(kind==='Cedar shingles'){
  for(let c=0;c<courses;c++){const y=c*band;let x=-rnd()*60;
   while(x<size){const width=34+rnd()*80,r=150+rnd()*60,g=r*.72,b=r*.5;ctx.fillStyle=`rgb(${r},${g},${b})`;ctx.fillRect(x,y,width,band);
    for(let k=0;k<7;k++){const gx=x+rnd()*width;ctx.fillStyle=`rgba(70,45,25,${.12+rnd()*.15})`;ctx.fillRect(gx,y,1,band);}
    ctx.fillStyle='rgba(30,18,10,.85)';ctx.fillRect(x,y,3,band);x+=width+3;}
   grain(0,y,size,band,120,80,.18,900);const shade=ctx.createLinearGradient(0,y,0,y+band);shade.addColorStop(0,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(20,12,6,.45)');ctx.fillStyle=shade;ctx.fillRect(0,y,size,band);ctx.fillStyle='rgba(15,9,5,.8)';ctx.fillRect(0,y+band-3,size,3);}
 }else if(kind==='Natural slate'){
  ctx.fillStyle='#1d1f22';ctx.fillRect(0,0,size,size);const slate=size/6;
  for(let c=0;c<courses;c++){const y=c*band,offset=c%2?slate/2:0;
   for(let x=-slate+offset;x<size;x+=slate){const tone=120+rnd()*55,tint=rnd()*14;ctx.fillStyle=`rgb(${tone-tint},${tone-tint*.5},${tone+tint})`;ctx.beginPath();const inset=2+rnd()*2;ctx.moveTo(x+inset,y+1);ctx.lineTo(x+slate-inset,y+1);ctx.lineTo(x+slate-inset-rnd()*3,y+band-3);ctx.lineTo(x+inset+rnd()*3,y+band-3);ctx.closePath();ctx.fill();
    grain(x,y,slate,band,tone,50,.25,140);ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(x+inset,y+1,slate-2*inset,2);}
   ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(0,y+band-4,size,4);}
 }else{ctx.fillStyle='#ffffff';ctx.fillRect(0,0,size,size);}
 canvases.set(kind,cvs);return cvs;
}
export function roofMaterial(kind:string,color:string,textures:T.Texture[],anisotropy:number){
 const spec=COVERINGS[kind]||COVERINGS['Ribbed metal'];
 if(spec.metal){const mat=new T.MeshStandardMaterial({color,roughness:.44,metalness:.65});mat.userData.covering='Ribbed metal';return mat;}
 const cvs=draw(kind);const map=new T.CanvasTexture(cvs),bump=new T.CanvasTexture(cvs);
 for(const t of [map,bump]){t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=anisotropy;textures.push(t);}map.colorSpace=T.SRGBColorSpace;
 // Cedar and slate carry their own color; the chosen roof color only tints them. Asphalt takes it fully.
 const tint=new T.Color(color);if(kind!=='Architectural asphalt shingles')tint.lerp(new T.Color('#ffffff'),kind==='Cedar shingles'?.7:.45);
 const mat=new T.MeshStandardMaterial({color:tint,map,bumpMap:bump,bumpScale:kind==='Natural slate'?2.4:1.6,roughness:kind==='Natural slate'?.62:.9,metalness:0});
 mat.userData.covering=kind;mat.userData.course=[spec.width,spec.height];return mat;
}
/** Texture coordinates in feet along the eave (u) and up the slope (v), so courses run level on every plane. */
export function slopeUV(p:number[],plane:number[]){
 const [a,b]=plane,len=Math.hypot(a,b),gx=len>1e-6?a/len:0,gz=len>1e-6?b/len:1,stretch=Math.sqrt(1+a*a+b*b);
 return [p[0]*gz-p[2]*gx,(p[0]*gx+p[2]*gz)*stretch];
}
