import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Show-home kitchens and living rooms, modelled on the most common real US finishes and product sizes:
// Shaker cabinets (34½ in base + 1¼ in quartz = 36 in counter, 24 in deep; 30 in uppers from 54 in),
// a subway-tile backsplash, a 30 in slide-in range under a chimney hood, an undermount sink with a
// gooseneck faucet, a 24 in dishwasher, a 36 in counter-depth French-door refrigerator, a waterfall island
// under pendant lights; a media wall with a 65 in TV over a fluted walnut console, a patterned wool rug,
// a linen-shaded floor lamp and a fiddle-leaf fig. Everything is drawn in feet at those real sizes.
const FLOOR=.21;
type Ctx={config:any;interior:any;m:any};

const textures=new Map<string,T.CanvasTexture>();
// Cached across rebuilds; disposing on cleanup only frees GPU memory (three re-uploads on next use).
function canvasTexture(key:string,size:number,draw:(g:CanvasRenderingContext2D,s:number)=>void,repeat=true){
 let t=textures.get(key);if(t)return t;const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d')!,size);
 t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;if(repeat)t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;textures.set(key,t);return t;
}
const rand=(seed:number)=>()=>(seed=(seed*16807)%2147483647)/2147483647;
/** Engineered quartz: soft cloudy body with a few long grey veins. */
function quartz(color:string){return canvasTexture('quartz'+color,512,(g,s)=>{g.fillStyle=color;g.fillRect(0,0,s,s);const r=rand(77);
 for(let i=0;i<900;i++){g.fillStyle=`rgba(255,255,255,${.04+r()*.05})`;g.beginPath();g.arc(r()*s,r()*s,2+r()*14,0,Math.PI*2);g.fill();}
 for(let v=0;v<4;v++){g.strokeStyle=`rgba(120,120,126,${.07+r()*.08})`;g.lineWidth=.6+r()*1.4;g.beginPath();let x=r()*s,y=0,dx=(r()-.5)*6;g.moveTo(x,y);while(y<s){dx+=(r()-.5)*3;x+=dx;y+=8;g.lineTo(x,y);}g.stroke();}});}
/** 3 × 6 in subway tile, running bond, ¹⁄₁₆ in light grout. One texture repeat = 2 ft square. */
function subway(){return canvasTexture('subway',512,(g,s)=>{g.fillStyle='#d9d6cf';g.fillRect(0,0,s,s);const rows=8,cols=4,th=s/rows,tw=s/cols;
 for(let r=0;r<rows;r++)for(let c=-1;c<cols;c++){const x=c*tw+(r%2?tw/2:0)+2,y=r*th+2;const grad=g.createLinearGradient(x,y,x,y+th);grad.addColorStop(0,'#fbfaf7');grad.addColorStop(.85,'#f1efea');grad.addColorStop(1,'#e2dfd8');g.fillStyle=grad;g.fillRect(x,y,tw-4,th-4);}});}
/** Wool area rug: field, border and a soft trellis, in the room's fabric and accent colours. */
function rugTexture(field:string,accent:string){return canvasTexture('rug'+field+accent,512,(g,s)=>{g.fillStyle=field;g.fillRect(0,0,s,s);
 g.strokeStyle=accent;g.globalAlpha=.55;g.lineWidth=10;g.strokeRect(22,22,s-44,s-44);g.lineWidth=3;g.strokeRect(44,44,s-88,s-88);g.globalAlpha=.32;g.lineWidth=3;
 const n=6,step=(s-120)/n;for(let i=0;i<=n;i++)for(let j=0;j<=n;j++){const x=60+i*step,y=60+j*step;g.beginPath();g.moveTo(x,y-step/2);g.quadraticCurveTo(x+step/2,y-step/2,x+step/2,y);g.quadraticCurveTo(x+step/2,y+step/2,x,y+step/2);g.quadraticCurveTo(x-step/2,y+step/2,x-step/2,y);g.quadraticCurveTo(x-step/2,y-step/2,x,y-step/2);g.stroke();}
 g.globalAlpha=.08;const r=rand(5);for(let i=0;i<6000;i++){g.fillStyle=r()>.5?'#000':'#fff';g.fillRect(r()*s,r()*s,1.5,1.5);}g.globalAlpha=1;},false);}
/** Walnut veneer with straight grain. */
function walnut(){return canvasTexture('walnut',256,(g,s)=>{g.fillStyle='#5c3d29';g.fillRect(0,0,s,s);const r=rand(19);for(let i=0;i<70;i++){g.strokeStyle=r()>.5?'#4a3020':'#6e4b33';g.globalAlpha=.25+r()*.35;g.lineWidth=.5+r()*2;g.beginPath();const x=r()*s;g.moveTo(x,0);for(let y=0;y<=s;y+=16)g.lineTo(x+Math.sin(y/37+i)*3,y);g.stroke();}g.globalAlpha=1;});}
/** A calm abstract picture for the TV (screens in listing photos are usually on). */
function screen(){return canvasTexture('screen',512,(g,s)=>{const grad=g.createLinearGradient(0,0,s,s);grad.addColorStop(0,'#1f3b57');grad.addColorStop(.55,'#4f7c8f');grad.addColorStop(1,'#e2b98a');g.fillStyle=grad;g.fillRect(0,0,s,s);g.fillStyle='rgba(255,240,210,.55)';g.beginPath();g.arc(s*.72,s*.36,s*.09,0,Math.PI*2);g.fill();g.fillStyle='#1c2b33';g.beginPath();g.moveTo(0,s*.78);g.quadraticCurveTo(s*.35,s*.6,s*.6,s*.74);g.quadraticCurveTo(s*.8,s*.82,s,s*.7);g.lineTo(s,s);g.lineTo(0,s);g.fill();},false);}

export const INTERIOR_KINDS=['kitchen','island','fridge','console','rug','floorlamp','plant'];

/** Builds a detailed interior piece; returns false for kinds this module doesn't draw. */
export function addInteriorPiece(scene:T.Object3D,f:any,ctx:Ctx):boolean{
 if(!INTERIOR_KINDS.includes(f.kind))return false;
 const {config,interior,m}=ctx;const group=new T.Group(),w=f.localWidth,d=f.localDepth,front=d/2;
 const std=(color:string,roughness:number,metalness=0,extra:Partial<T.MeshPhysicalMaterialParameters>={})=>new T.MeshPhysicalMaterial({color,roughness,metalness,...extra});
 const cab=std(config.colors?.cabinetry||'#e8e4da',.45,0,{clearcoat:.25,clearcoatRoughness:.4});
 const counter=std('#ffffff',.18,0,{map:quartz(config.colors?.countertop||'#e9e6df'),clearcoat:.6,clearcoatRoughness:.12});
 const brushed=std('#c9cdcf',.32,1);const blackGlass=std('#0d0f10',.08,0,{clearcoat:1,clearcoatRoughness:.04});const iron=std('#1b1b1b',.6,.4);
 const metal=std(/brass|gold/i.test(interior.metal||'')?'#b89254':/black/i.test(interior.metal||'')?'#1e1e1e':'#b8bcbe',.3,1);
 const warmLight=new T.MeshStandardMaterial({color:'#fff3dc',emissive:'#ffd9a0',emissiveIntensity:2.2});
 const box=(x:number,y:number,z:number,a:number,b:number,c:number,mat:T.Material,r=0)=>{const mesh=new T.Mesh(r?new RoundedBoxGeometry(a,b,c,2,Math.min(r,a/3,b/3,c/3)):new T.BoxGeometry(a,b,c),mat);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;};
 const cyl=(x:number,y:number,z:number,r:number,h:number,mat:T.Material,top=r,seg=20)=>{const mesh=new T.Mesh(new T.CylinderGeometry(top,r,h,seg),mat);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;};
 const bar=(x:number,y:number,z:number,length:number,vertical:boolean)=>{const handle=cyl(x,y,z+.07,.022,length,metal,.022,12);if(!vertical)handle.rotation.z=Math.PI/2;for(const s of [-1,1]){const post=cyl(x+(vertical?0:s*(length/2-.05)),y+(vertical?s*(length/2-.05):0),z+.035,.015,.07,metal,.015,8);post.rotation.x=Math.PI/2;}};
 // A Shaker door or drawer front: flat frame with a recessed centre panel.
 const shaker=(x:number,y:number,z:number,dw:number,dh:number,mat:T.Material,stile=.2)=>{const s=Math.min(stile,dw/4,dh/4);box(x,y,z-.012,dw-.02,dh-.02,.04,mat);
  for(const sx of [-1,1])box(x+sx*(dw/2-s/2-.01),y,z+.018,s,dh-.02,.03,mat);for(const sy of [-1,1])box(x,y+sy*(dh/2-s/2-.01),z+.018,dw-2*s-.02,s,.03,mat);};
 const baseTop=FLOOR+2.875,top=baseTop+.104;
 switch(f.kind){
  case 'kitchen':{
   // Modules: sink base 3 ft, dishwasher 2 ft, range 2.5 ft, the rest drawer banks and door bases.
   // Layout like a real kitchen: the sink sits under the window, the range on solid wall at least 3 ft away
   // (so the hood never covers glass), a dishwasher beside the sink, drawer banks and door bases between.
   const toe=FLOOR+.33,bodyH=baseTop-toe,sinkW=Math.min(3,w*.3),rangeW=Math.min(2.5,w*.28);
   const glassAt=windowSpans(f,m,top+.2,top+4);const clamp=(x:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,x));
   let sinkX=-w*.22,rangeX=w*.25;
   if(glassAt.length){const [a,b]=glassAt.reduce((p,c)=>c[1]-c[0]>p[1]-p[0]?c:p);sinkX=clamp((a+b)/2,-w/2+sinkW/2,w/2-sinkW/2);
    const clear=(x:number)=>!glassAt.some(([a,b])=>a<x+rangeW/2+.4&&b>x-rangeW/2-.4)&&Math.abs(x-sinkX)>=(sinkW+rangeW)/2+1;
    const options:number[]=[];for(let x=-w/2+rangeW/2;x<=w/2-rangeW/2+1e-6;x+=.25)if(clear(x))options.push(x);
    rangeX=options.length?options.sort((p,q)=>Math.abs(Math.abs(p-sinkX)-4.5)-Math.abs(Math.abs(q-sinkX)-4.5))[0]!:sinkX<0?w/2-rangeW/2:-w/2+rangeW/2;}
   if(Math.abs(rangeX-sinkX)<(sinkW+rangeW)/2){rangeX=sinkX<0?Math.min(w/2-rangeW/2,sinkX+(sinkW+rangeW)/2):Math.max(-w/2+rangeW/2,sinkX-(sinkW+rangeW)/2);}
   box(0,(toe+FLOOR)/2,-.12,w,.33,d-.25,std('#2b2b2b',.8));
   const modules:{x:number,width:number,kind:string}[]=[{x:sinkX,width:sinkW,kind:'sink'},{x:rangeX,width:rangeW,kind:'range'}].sort((a,b)=>a.x-b.x);
   const fixed=[...modules];let cursor=-w/2;
   const fill=(a:number,b:number,besideSink:'left'|'right'|null)=>{let len=b-a;if(len<.05)return;
    if(besideSink&&w>7&&len>=2.3){const x=besideSink==='right'?a+1:b-1;modules.push({x,width:2,kind:'dishwasher'});if(besideSink==='right')a+=2;else b-=2;len-=2;if(len<.05)return;}
    const n=Math.max(1,Math.round(len/1.75)),width=len/n;for(let i=0;i<n;i++)modules.push({x:a+width*(i+.5),width,kind:width<1?'doors':i%2?'doors':'drawers'});};
   for(const [i,mod] of fixed.entries()){const next=fixed[i+1];fill(cursor,mod.x-mod.width/2,i===1&&fixed[0]!.kind==='sink'?'right':null);cursor=mod.x+mod.width/2;if(!next)fill(cursor,w/2,mod.kind==='sink'?'right':null);}
   if(!modules.some(m=>m.kind==='dishwasher')){const sink=fixed.find(m=>m.kind==='sink')!,leftGap=modules.filter(m=>m.kind!=='sink'&&m.kind!=='range'&&m.x<sink.x);
    const touching=leftGap.sort((a,b)=>b.x-a.x)[0];if(touching&&touching.width>=2&&Math.abs(touching.x+touching.width/2-(sink.x-sink.width/2))<.05&&w>7){touching.width-=2;touching.x-=1;modules.push({x:sink.x-sink.width/2-1,width:2,kind:'dishwasher'});if(touching.width<.3)modules.splice(modules.indexOf(touching),1);}}
   for(const mod of modules){
    if(mod.kind==='range'){continue;}
    box(mod.x,toe+bodyH/2,-.04,mod.width-.01,bodyH,d-.12,cab);
    const fz=front-.02,y0=toe+.05,h=bodyH-.1;
    if(mod.kind==='dishwasher'){box(mod.x,y0+h/2,fz+.02,mod.width-.04,h,.06,brushed,.02);bar(mod.x,y0+h-.25,fz+.05,mod.width*.7,false);box(mod.x,y0+.12,fz+.03,mod.width-.1,.2,.05,iron);}
    else if(mod.kind==='drawers'){const rows=[.2,.35,.45];let y=y0;for(const r of rows){const dh=h*r;shaker(mod.x,y+dh/2,fz,mod.width-.04,dh-.03,cab,.15);bar(mod.x,y+dh-.16,fz,Math.min(.75,mod.width*.5),false);y+=dh;}}
    else{const top_=h*.2;shaker(mod.x,y0+h-top_/2,fz,mod.width-.04,top_-.03,cab,.12);bar(mod.x,y0+h-top_/2,fz,Math.min(.6,mod.width*.45),false);
     const doors=mod.width>2.2?2:1;for(let i=0;i<doors;i++){const dw=(mod.width-.04)/doors,dx=mod.x-(mod.width-.04)/2+dw*(i+.5);shaker(dx,y0+(h-top_)/2,fz,dw-.02,h-top_-.03,cab);bar(dx+(doors===2?(i?-1:1)*(dw/2-.18):dw/2-.18),y0+(h-top_)-.45,fz,.55,true);}}
   }
   // Quartz top with an eased edge, cut around the range.
   const r=modules.find(m=>m.kind==='range')!;const left=r.x-r.width/2,right=r.x+r.width/2;
   if(left>-w/2+.05)box((-w/2+left)/2,baseTop+.052,0,left+w/2,.104,d+.08,counter,.02);
   if(right<w/2-.05)box((right+w/2)/2,baseTop+.052,0,w/2-right,.104,d+.08,counter,.02);
   // Undermount sink: brushed bowl rim, dark basin, gooseneck faucet and lever.
   const sink=modules.find(m=>m.kind==='sink');if(sink){const sw=Math.min(2.5,sink.width-.5);box(sink.x,top+.004,.05,sw,.012,1.35,brushed);box(sink.x,top+.002,.05,sw-.16,.016,1.19,std('#3a3d3f',.35,.7));
    const curve=new T.CatmullRomCurve3([new T.Vector3(0,0,0),new T.Vector3(0,.9,0),new T.Vector3(0,1.25,.25),new T.Vector3(0,1.05,.62),new T.Vector3(0,.82,.66)]);const tube=new T.Mesh(new T.TubeGeometry(curve,24,.035,10,false),metal);tube.position.set(sink.x,top,-d/2+.45);tube.castShadow=true;group.add(tube);
    cyl(sink.x,top+.05,-d/2+.45,.06,.1,metal);const lever=box(sink.x+.14,top+.35,-d/2+.45,.03,.03,.28,metal);lever.rotation.x=-.5;}
   // 30 in slide-in range: black glass cooktop, five grate-covered burners, knobs, windowed oven door.
   {const rw=r.width-.02,oy=FLOOR+.02;box(r.x,(FLOOR+top-.04)/2,-.05,rw,top-.04-FLOOR,d-.1,brushed,.03);box(r.x,top-.02,0,rw,.04,d-.15,blackGlass);
    for(const [gx,gz] of [[-1,-1],[1,-1],[-1,1],[1,1],[0,0]] as [number,number][]){const cx=r.x+gx*rw*.27,cz=gz*.5;cyl(cx,top+.01,cz,.17,.02,iron,.17,24);for(const a of [0,Math.PI/2])box(cx,top+.05,cz,a?.06:.62,.05,a?.62:.06,iron).rotation.y=a+Math.PI/4;}
    for(let i=0;i<5;i++)cyl(r.x-rw*.36+i*rw*.18,top-.18,front+.03,.07,.06,iron,.07,16).rotation.x=Math.PI/2;
    box(r.x,oy+1.6,front+.01,rw-.08,1.85,.05,brushed,.02);box(r.x,oy+1.55,front+.04,rw-.6,1.05,.02,blackGlass);bar(r.x,oy+2.42,front+.02,rw*.75,false);box(r.x,oy+.35,front+.02,rw-.08,.5,.04,brushed,.02);
    // Chimney hood centred over the range, up to the ceiling.
    const hoodY=top+2.5+.47,ceiling=Math.max(hoodY+1,m.h-.05);const canopy=new T.Mesh(new T.CylinderGeometry(.45,1.05,.95,4,1),brushed);canopy.rotation.y=Math.PI/4;canopy.scale.set(rw/1.48,1,(d*.8)/1.48);canopy.position.set(r.x,hoodY,-d/2+d*.4);canopy.castShadow=true;group.add(canopy);
    box(r.x,(hoodY+.47+ceiling)/2,-d/2+.45,.9,ceiling-hoodY-.47,.8,brushed);box(r.x,hoodY-.42,-d/2+d*.4,rw*.95,.06,d*.75,brushed);}
   // Backsplash: subway tile from counter to the uppers (to the hood behind the range).
   // Tile stops at window casings (a window over the sink keeps its sill and view).
   let from=-w/2;const glassSpans=windowSpans(f,m,top,top+1.5).map(([a,b])=>[a-.25,b+.25]).sort((a,b)=>a[0]!-b[0]!);
   for(const [a,b] of [...glassSpans,[w/2,w/2]]){const to=Math.min(w/2,a!);if(to-from>.3){const splash=subway().clone();splash.userData={};splash.needsUpdate=true;splash.repeat.set((to-from)/2,1.5/2);splash.offset.x=(from+w/2)/2;
     box((from+to)/2,top+.75,-d/2+.015,to-from,1.5,.02,std('#ffffff',.12,0,{map:splash,clearcoat:.8,clearcoatRoughness:.08}));}from=Math.max(from,b!);}
   // Uppers (30 in, 12 in deep) beside the hood, skipping any stretch that would cover a window.
   const blocked=windowSpans(f,m,top+1.5,top+4.25);
   for(const mod of modules){if(mod.kind==='range')continue;const x0=mod.x-mod.width/2,x1=mod.x+mod.width/2;if(blocked.some(([a,b])=>a<x1+.1&&b>x0-.1))continue;
    const uy=top+1.5+1.25;box(mod.x,uy,-d/2+.5,mod.width-.01,2.5,1,cab);const doors=mod.width>2.2?2:1;
    for(let i=0;i<doors;i++){const dw=(mod.width-.04)/doors,dx=mod.x-(mod.width-.04)/2+dw*(i+.5);shaker(dx,uy,-d/2+1.02,dw-.02,2.46,cab);bar(dx+(doors===2?(i?-1:1)*(dw/2-.18):dw/2-.18),uy-.85,-d/2+1.02,.45,true);}
    box(mod.x,uy-1.27,-d/2+.85,mod.width-.2,.03,.08,warmLight);}
   // Styling: wood board, fruit bowl, utensil crock.
   const sideX=left>-w/2+2?(-w/2+left)/2:(right+w/2)/2;box(sideX-.3,top+.03,.05,1.1,.05,.7,std('#a8794e',.5),.02);
   const bowl=new T.Mesh(new T.SphereGeometry(.38,24,12,0,Math.PI*2,Math.PI/2,Math.PI/2),std('#f2efe8',.25));bowl.position.set(sideX+.6,top+.36,.15);bowl.castShadow=true;group.add(bowl);
   for(let i=0;i<5;i++){const lemon=new T.Mesh(new T.SphereGeometry(.13,16,12),std('#e8c43a',.45));lemon.scale.set(1,.85,1.2);lemon.position.set(sideX+.5+(i%3)*.1,top+.16+Math.floor(i/3)*.1,.1+(i%2)*.12);group.add(lemon);}
   break;}
  case 'island':{
   const toe=FLOOR+.33,bodyD=Math.max(1.6,d-1.1),bodyZ=-(d-bodyD)/2;box(0,(toe+FLOOR)/2,bodyZ,w-.6,.33,bodyD-.25,std('#2b2b2b',.8));
   box(0,toe+(baseTop-toe)/2,bodyZ,w-.6,baseTop-toe,bodyD,cab);
   const n=Math.max(2,Math.round((w-.6)/2));const mw=(w-.6)/n;for(let i=0;i<n;i++){const x=-(w-.6)/2+mw*(i+.5);shaker(x,toe+(baseTop-toe)/2,bodyZ-bodyD/2-.02,mw-.04,baseTop-toe-.1,cab);}
   for(let i=0;i<n;i++){const x=-(w-.6)/2+mw*(i+.5);shaker(x,toe+(baseTop-toe)/2,bodyZ+bodyD/2+.02,mw-.04,baseTop-toe-.1,cab);}
   // Waterfall quartz: top with a 12 in seating overhang and slabs down both ends.
   box(0,baseTop+.052,0,w,.104,d,counter,.02);for(const s of [-1,1])box(s*(w/2-.052),FLOOR+(baseTop-FLOOR)/2+.05,0,.104,baseTop-FLOOR+.1,d,counter,.02);
   // Three dome pendants, 30 in above the counter.
   const shadeY=top+2.6;for(const px of [-w*.3,0,w*.3]){const cord=cyl(px,(shadeY+.35+m.h)/2,0,.012,Math.max(.1,m.h-shadeY-.35),iron,.012,6);cord.castShadow=false;
    const shade=new T.Mesh(new T.SphereGeometry(.5,32,16,0,Math.PI*2,0,Math.PI/2),std(/brass|gold/i.test(interior.metal||'')?'#b89254':'#1f2223',.35,.8,{side:T.DoubleSide}));shade.position.set(px,shadeY,0);shade.castShadow=true;group.add(shade);
    const bulb=new T.Mesh(new T.SphereGeometry(.13,16,12),warmLight);bulb.position.set(px,shadeY+.05,0);group.add(bulb);}
   const vase=new T.Mesh(new T.LatheGeometry([[.05,0],[.2,.05],[.24,.4],[.12,.8],[.15,.95]].map(([a,b])=>new T.Vector2(a,b)),24),std('#f2efe8',.3));vase.position.set(w*.15,top,.1);vase.castShadow=true;group.add(vase);
   for(let i=0;i<6;i++){const stem=cyl(w*.15+Math.sin(i)*.12,top+1.15+i*.04,.1+Math.cos(i)*.1,.01,.6,std('#56703f',.7),.01,5);stem.rotation.z=Math.sin(i*1.7)*.3;}
   break;}
  case 'fridge':{
   // 36 in counter-depth French-door refrigerator: two doors over a freezer drawer, tubular handles.
   const H=Math.min(5.85,(m.h||8)-.4),y0=FLOOR;box(0,y0+H/2,-.06,w-.02,H,d-.12,brushed,.04);
   const split=y0+H*.36,dz=front-.05;for(const s of [-1,1]){box(s*(w/4),split+(y0+H-split)/2+.01,dz,w/2-.03,y0+H-split-.04,.12,brushed,.04);cyl(s*.1,split+(y0+H-split)*.55,dz+.16,.035,(y0+H-split)*.6,metal,.035,14);
    for(const e of [-1,1]){const post=cyl(s*.1,split+(y0+H-split)*.55+e*(y0+H-split)*.28,dz+.1,.02,.12,metal,.02,8);post.rotation.x=Math.PI/2;}}
   box(0,y0+(split-y0)/2,dz,w-.03,split-y0-.05,.12,brushed,.04);bar(0,split-.3,dz+.06,w*.7,false);
   box(-w/4,split+(y0+H-split)*.55,dz+.07,.55,.8,.02,blackGlass);
   break;}
  case 'console':{
   // Media wall: fluted walnut console on slim legs, 65 in TV mounted above it.
   const wood=std('#ffffff',.55,0,{map:walnut()}),ch=1.75,cy=FLOOR+.45+ch/2;box(0,cy,0,w,ch,d,wood,.03);
   for(const s of [-1,1])for(const e of [-1,1])cyl(s*(w/2-.3),FLOOR+.24,e*(d/2-.25),.03,.45,iron,.03,8);
   const flutes=Math.floor((w-.3)/.12);for(let i=0;i<flutes;i++){const flute=cyl(-w/2+.15+(i+.5)*(w-.3)/flutes,cy,front+.005,.045,ch-.25,wood,.045,8);flute.scale.z=.45;flute.layers.set(2);}
   const tvW=Math.min(w*.95,4.7),tvH=tvW*.5625,tvY=Math.min(FLOOR+5.1,cy+ch/2+.9+tvH/2);
   // In front of a window the console is styled with a ceramic table lamp instead of a wall-mounted TV.
   const glassBehind=windowSpans(f,m,tvY-tvH/2,tvY+tvH/2).some(([a,b])=>a<tvW/2&&b>-tvW/2);
   const bookX=glassBehind?-w*.08:-w*.32;
   if(glassBehind){const lx=-w/2+.55,ly=cy+ch/2;const base=new T.Mesh(new T.LatheGeometry([[.0,0],[.18,0],[.3,.25],[.32,.55],[.2,.85],[.07,.95],[.07,1.05],[0,1.05]].map(([a,b])=>new T.Vector2(a,b)),32),std('#d9d2c3',.35,0,{clearcoat:.5}));base.position.set(lx,ly,0);base.castShadow=true;group.add(base);
    cyl(lx,ly+1.25,0,.012,.4,metal,.012,6);const shade=new T.Mesh(new T.CylinderGeometry(.42,.55,.75,32,1,true),std('#efe7d8',.95,0,{side:T.DoubleSide,emissive:'#ffcf8f',emissiveIntensity:.3}));shade.position.set(lx,ly+1.55,0);shade.castShadow=true;group.add(shade);
    const bulb=new T.Mesh(new T.SphereGeometry(.12,16,12),warmLight);bulb.position.set(lx,ly+1.45,0);group.add(bulb);}
   else{box(0,tvY,-d/2+.08,tvW,tvH,.09,std('#111111',.4),.02);
   const panel=new T.Mesh(new T.PlaneGeometry(tvW-.08,tvH-.08),new T.MeshPhysicalMaterial({color:'#ffffff',map:screen(),emissive:'#ffffff',emissiveMap:screen(),emissiveIntensity:.55,roughness:.05,clearcoat:1,clearcoatRoughness:.03}));panel.position.set(0,tvY,-d/2+.13);group.add(panel);}
   const books=['#334f53','#896b51','#a89670','#733f47'];for(let i=0;i<4;i++)box(bookX+i*.17,cy+ch/2+.33,0,.14,.62,.8,std(books[i]!,.85),.015);
   const urn=new T.Mesh(new T.LatheGeometry([[.05,0],[.25,.1],[.3,.45],[.14,.85],[.18,1]].map(([a,b])=>new T.Vector2(a,b)),24),std('#c9b89a',.6));urn.position.set(w*.3,cy+ch/2,0);urn.castShadow=true;group.add(urn);
   break;}
  case 'rug':{
   const mat=std('#ffffff',.97,0,{map:rugTexture(interior.fabric||'#c9bfae',interior.accent||'#4d5a63'),sheen:1,sheenRoughness:.8,sheenColor:new T.Color('#ffffff')});box(0,FLOOR+.025,0,w,.05,d,mat,.02);break;}
  case 'floorlamp':{
   // Arc floor lamp: marble base, brushed arc, linen drum shade lit from inside.
   // The arc spans the footprint: marble base at one side, shade over the other.
   const baseR=Math.min(.55,w*.2),shadeR=Math.min(.75,w*.25),bx=-w/2+baseR,reach=Math.max(.4,w-baseR-shadeR),sx=bx+reach;
   cyl(bx,FLOOR+.12,0,baseR,.22,std('#e9e6e1',.25,0,{clearcoat:.6}),baseR*.9,32);const arc=new T.CatmullRomCurve3([new T.Vector3(bx,FLOOR+.2,0),new T.Vector3(bx,FLOOR+4.6,0),new T.Vector3(bx+reach*.43,FLOOR+6.1,0),new T.Vector3(sx,FLOOR+5.6,0)]);
   const pole=new T.Mesh(new T.TubeGeometry(arc,40,.04,10,false),metal);pole.castShadow=true;group.add(pole);
   const shade=new T.Mesh(new T.CylinderGeometry(shadeR*.8,shadeR,.85,32,1,true),std('#efe7d8',.95,0,{side:T.DoubleSide,emissive:'#ffcf8f',emissiveIntensity:.35}));shade.position.set(sx,FLOOR+5.05,0);group.add(shade);
   const bulb=new T.Mesh(new T.SphereGeometry(.15,16,12),warmLight);bulb.position.set(sx,FLOOR+5,0);group.add(bulb);break;}
  case 'plant':{
   // Fiddle-leaf fig in a matte white planter.
   const pot=new T.Mesh(new T.LatheGeometry([[.0,0],[.42,0],[.5,.9],[.47,.95],[0,.95]].map(([a,b])=>new T.Vector2(a,b)),32),std('#efede8',.8));pot.position.y=FLOOR;pot.castShadow=true;group.add(pot);
   cyl(0,FLOOR+.93,0,.44,.02,std('#3b3027',1));const trunk=new T.CatmullRomCurve3([new T.Vector3(0,FLOOR+.9,0),new T.Vector3(.08,FLOOR+2.4,.05),new T.Vector3(-.05,FLOOR+4,-.04),new T.Vector3(.04,FLOOR+5.4,0)]);const stem=new T.Mesh(new T.TubeGeometry(trunk,20,.045,8,false),std('#6b5340',.9));stem.castShadow=true;group.add(stem);
   const leafMat=std('#3f6b2e',.42,0,{clearcoat:.5,clearcoatRoughness:.3,side:T.DoubleSide});const leafGeo=new T.SphereGeometry(1,14,10);const r=rand(31);
   for(let i=0;i<34;i++){const t=.25+r()*.75,p=trunk.getPoint(t),a=i*2.39,reach=.25+r()*.45;const leaf=new T.Mesh(leafGeo,leafMat);leaf.scale.set(.32,.035,.48);leaf.position.set(p.x+Math.cos(a)*reach,p.y+(r()-.3)*.3,p.z+Math.sin(a)*reach);leaf.rotation.set(.5+r()*.5,-a+Math.PI/2,(r()-.5)*.6);leaf.castShadow=true;group.add(leaf);}
   break;}
 }
 // Safety net: a piece never spills past its planned footprint (narrow plans get a proportionally smaller one).
 const size=new T.Box3().setFromObject(group).getSize(new T.Vector3()),fit=Math.min(1,(w+.3)/Math.max(size.x,1e-3),(d+.3)/Math.max(size.z,1e-3));if(fit<1)group.scale.set(fit,1,fit);
 group.rotation.y=-f.rotation;group.position.set(f.x-m.w/2,0,f.z-m.d/2);group.userData.editTarget={kind:'furniture',id:f.id};group.userData.stagingKind=f.kind;group.name=f.kind;
 scene.add(group);return true;
}

/** Spans (in the piece's local x) where a window in the wall behind the piece overlaps height y0..y1. */
function windowSpans(f:any,m:any,y0:number,y1:number):[number,number][]{
 const cos=Math.cos(-f.rotation),sin=Math.sin(-f.rotation);const local=(lx:number,lz:number)=>({x:f.x+lx*cos+lz*sin,z:f.z-lx*sin+lz*cos});
 const back=local(0,-f.localDepth/2),ax=local(1,0);const along={x:ax.x-f.x,z:ax.z-f.z};
 let best:any=null,dist=1.6;for(const wall of m.walls||[]){const onX=wall.axis==='x',dd=onX?Math.abs(back.z-wall.z):Math.abs(back.x-wall.x);const inRange=onX?back.x>=wall.x-1&&back.x<=wall.x+wall.length+1:back.z>=wall.z-1&&back.z<=wall.z+wall.length+1;if(inRange&&dd<dist){dist=dd;best=wall;}}
 if(!best)return [];const onX=best.axis==='x',sign=onX?Math.sign(along.x)||1:Math.sign(along.z)||1;const start=onX?best.x:best.z;const centre=onX?back.x:back.z;
 return best.openings.filter((o:any)=>o.kind==='window'&&o.bottom<y1&&o.bottom+o.height>y0).map((o:any)=>{const a=(start+o.at-centre)*sign,b=(start+o.at+o.width-centre)*sign;return [Math.min(a,b),Math.max(a,b)] as [number,number];});
}
