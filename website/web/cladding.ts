import * as T from 'three';

// Exterior cladding textures, drawn once on canvases in near-white so the chosen cladding color tints them.
// Each style is a real profile at true scale (one texture tile = `tile` feet), so lap reveals, battens,
// shingle courses and metal ribs read from the street as well as up close.
type Draw=(c:CanvasRenderingContext2D,s:number,r:()=>number)=>void;
// The canvases are drawn once and kept; each scene wraps them in its own texture, released with the scene.
const cache=new Map<string,HTMLCanvasElement>();
function rng(seed:number){return()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};}
function canvas(key:string,size:number,draw:Draw){let cv=cache.get(key);if(!cv){cv=document.createElement('canvas');cv.width=cv.height=size;const ctx=cv.getContext('2d')!;let h=7;for(const ch of key)h=(h*31+ch.charCodeAt(0))%2147483646;draw(ctx,size,rng(h+1));cache.set(key,cv);}
 const t=new T.CanvasTexture(cv);t.wrapS=t.wrapT=T.RepeatWrapping;t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;}
const grain=(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:()=>number,vertical:boolean,n=18)=>{for(let k=0;k<n;k++){c.fillStyle=`rgba(80,55,30,${.04+r()*.07})`;if(vertical)c.fillRect(x+r()*w,y,1+r()*1.5,h);else c.fillRect(x,y+r()*h,w,1+r()*1.5);}};
const speck=(c:CanvasRenderingContext2D,s:number,r:()=>number,n:number,a=.12)=>{for(let i=0;i<n;i++){const g=r()<.5?0:255;c.fillStyle=`rgba(${g},${g},${g},${r()*a})`;c.fillRect(r()*s,r()*s,1.5,1.5);}};
// Horizontal lap boards; Dutch lap has a cove under each butt; shiplap is flat with a dark gap.
const lap=(revealIn:number,kind:'lap'|'dutch'|'ship'|'wood'):Draw=>(c,s,r)=>{const rows=Math.round(48/revealIn),b=s/rows;for(let i=0;i<rows;i++){const y=i*b,g=c.createLinearGradient(0,y,0,y+b);
 if(kind==='dutch'){g.addColorStop(0,'#c9c9c9');g.addColorStop(.35,'#ffffff');g.addColorStop(.9,'#ececec');g.addColorStop(1,'#bdbdbd');}else if(kind==='ship'){g.addColorStop(0,'#f2f2f2');g.addColorStop(1,'#e8e8e8');}else{g.addColorStop(0,'#ffffff');g.addColorStop(.85,'#ebebeb');g.addColorStop(1,'#cdcdcd');}
 c.fillStyle=g;c.fillRect(0,y,s,b);if(kind==='wood'||kind==='ship'){const w=s/2;for(let x=-r()*w;x<s;x+=w*(.7+r()*.6)){grain(c,x,y,w,b,r,false,10);c.fillStyle='rgba(60,40,20,.25)';c.fillRect(x,y,2,b);}}
 c.fillStyle=kind==='ship'?'rgba(0,0,0,.55)':'rgba(0,0,0,.32)';c.fillRect(0,y+b-(kind==='ship'?3:4),s,kind==='ship'?3:4);}speck(c,s,r,4000,.06);};
// Vertical boards: board & batten (raised battens), reverse batten (recessed), tongue & groove / channel.
const vertical=(boardIn:number,battenIn:number,kind:'batten'|'reverse'|'tg'|'channel'|'charred'):Draw=>(c,s,r)=>{const n=Math.round(48/boardIn),b=s/n,bw=battenIn/48*s;
 c.fillStyle=kind==='charred'?'#3a3a3a':'#efefef';c.fillRect(0,0,s,s);for(let i=0;i<n;i++){const x=i*b;
  if(kind==='charred'){for(let y=0;y<s;y+=6+r()*10){c.fillStyle=`rgba(${r()<.3?120:10},${r()<.3?110:10},${r()<.3?100:10},.55)`;c.fillRect(x+r()*b,y,4+r()*b*.6,2+r()*3);}c.fillStyle='rgba(0,0,0,.8)';c.fillRect(x,0,3,s);continue}
  if(kind!=='batten'&&kind!=='reverse')grain(c,x,0,b,s,r,true,12);
  if(kind==='batten'){const g=c.createLinearGradient(x-bw/2,0,x+bw/2,0);g.addColorStop(0,'rgba(0,0,0,.35)');g.addColorStop(.12,'#ffffff');g.addColorStop(.8,'#e4e4e4');g.addColorStop(1,'rgba(0,0,0,.25)');c.fillStyle=g;c.fillRect(x-bw/2,0,bw,s);}
  else if(kind==='reverse'){c.fillStyle='rgba(0,0,0,.42)';c.fillRect(x-bw/2,0,bw,s);c.fillStyle='rgba(0,0,0,.2)';c.fillRect(x-bw/2,0,3,s);}
  else{c.fillStyle=kind==='channel'?'rgba(0,0,0,.45)':'rgba(0,0,0,.3)';c.fillRect(x,0,kind==='channel'?7:3,s);}}speck(c,s,r,3000,.06);};
// Cedar shingles in 7-in courses: straight, staggered butts, or fish-scale (rounded butts).
const shingles=(kind:'straight'|'stagger'|'fish'):Draw=>(c,s,r)=>{const rows=7,h=s/rows;c.fillStyle='#2a2a2a';c.fillRect(0,0,s,s);for(let y=0;y<rows;y++){let x=-r()*40;while(x<s){const sw=kind==='fish'?s/8:24+r()*46,g=195+r()*50,drop=kind==='stagger'?r()*7:0;
 c.fillStyle=`rgb(${g},${g},${g})`;if(kind==='fish'){c.beginPath();c.moveTo(x,y*h);c.lineTo(x+sw,y*h);c.lineTo(x+sw,y*h+h*.55);c.arc(x+sw/2,y*h+h*.55,sw/2,0,Math.PI);c.closePath();c.fill();}else c.fillRect(x,y*h,sw-2,h+drop-3);
 for(let k=0;k<4;k++){c.fillStyle=`rgba(0,0,0,${.04+r()*.06})`;c.fillRect(x+r()*sw,y*h,1,h);}x+=sw;}}};
// Metal: horizontal flush panels, corrugation and standing seams.
const hpanel=(panelIn:number,reveal:boolean):Draw=>(c,s)=>{const n=Math.round(48/panelIn),b=s/n;for(let i=0;i<n;i++){const y=i*b,g=c.createLinearGradient(0,y,0,y+b);g.addColorStop(0,'#f6f6f6');g.addColorStop(1,'#dedede');c.fillStyle=g;c.fillRect(0,y,s,b);c.fillStyle=reveal?'rgba(0,0,0,.55)':'rgba(0,0,0,.3)';c.fillRect(0,y+b-(reveal?8:3),s,reveal?8:3);c.fillStyle='rgba(255,255,255,.7)';c.fillRect(0,y,s,2);}};
const corrugated:(pitchIn:number)=>Draw=pitchIn=>(c,s)=>{const n=Math.round(24/pitchIn);for(let x=0;x<s;x++){const v=.5+.5*Math.cos(x/s*n*Math.PI*2),g=Math.round(150+v*105);c.fillStyle=`rgb(${g},${g},${g})`;c.fillRect(x,0,1,s);}};
const seams:(spacingIn:number)=>Draw=spacingIn=>(c,s)=>{const n=Math.round(48/spacingIn);c.fillStyle='#ececec';c.fillRect(0,0,s,s);for(let i=0;i<n;i++){const x=i*s/n;c.fillStyle='#ffffff';c.fillRect(x,0,4,s);c.fillStyle='rgba(0,0,0,.4)';c.fillRect(x+4,0,4,s);c.fillStyle='rgba(0,0,0,.06)';c.fillRect(x+s/n*.45,0,2,s);}};
// Masonry and stucco that take the chosen color: painted / whitewashed brick, ledgestone, sand-float stucco.
const brick=(wash:boolean):Draw=>(c,s,r)=>{c.fillStyle=wash?'#f4f4f4':'#d9d9d9';c.fillRect(0,0,s,s);const rows=16,h=s/rows,w=s/4;for(let y=0;y<rows;y++)for(let x=-(y%2)*w/2;x<s;x+=w){const g=wash?200+r()*55:215+r()*35;c.fillStyle=`rgb(${g},${g},${g})`;c.fillRect(x+3,y*h+3,w-6,h-6);if(wash){c.fillStyle=`rgba(150,70,55,${.15+r()*.35})`;c.fillRect(x+3+r()*w*.5,y*h+3,w*.4,h-6);}}speck(c,s,r,9000,.12);};
const ledge:Draw=(c,s,r)=>{c.fillStyle='#4a4a4a';c.fillRect(0,0,s,s);let y=0;while(y<s){const h=8+r()*18;let x=-r()*60;while(x<s){const w=40+r()*120,g=150+r()*90;c.fillStyle=`rgb(${g},${g-4},${g-10})`;c.fillRect(x+1,y+1,w-2,h-2);c.fillStyle='rgba(0,0,0,.18)';c.fillRect(x+1,y+h-4,w-2,3);x+=w;}y+=h;}};
const sand:Draw=(c,s,r)=>{c.fillStyle='#ececec';c.fillRect(0,0,s,s);speck(c,s,r,60000,.22);for(let i=0;i<30;i++){c.fillStyle=`rgba(0,0,0,${r()*.04})`;c.beginPath();c.arc(r()*s,r()*s,20+r()*60,0,7);c.fill();}};

export type Finish={map:T.Texture,tile:number,bump:number,roughness:number,metalness:number}|null;
/** The cladding texture for a siding and variant, or null where the photographed material (brick, stone,
 *  smooth stucco) is used instead. */
export function claddingFinish(siding:string,variant:string):Finish{
 const f=(key:string,size:number,draw:Draw,tile:number,bump:number,roughness=.72,metalness=0)=>({map:canvas(key,size,draw),tile,bump,roughness,metalness});
 switch(siding){
  case 'Painted lap siding':return variant==='Narrow 4 in lap'?f('lap4',512,lap(4,'lap'),4,1.4):variant==='Wide 8 in lap'?f('lap8',512,lap(8,'lap'),4,1.6):variant==='Dutch lap'?f('dutch',512,lap(6,'dutch'),4,1.6):f('lap6',512,lap(6,'lap'),4,1.4);
  case 'Wood lap siding':return variant==='Rustic 8 in'?f('wlap8',512,lap(8,'wood'),4,1.6,.8):variant==='Shiplap'?f('ship',512,lap(8,'ship'),4,1.2,.8):f('wlap6',512,lap(6,'wood'),4,1.4,.78);
  case 'Board & batten siding':return variant==='16 in boards · 3 in battens'?f('bb16',512,vertical(16,3,'batten'),4,1.8):variant==='Reverse batten'?f('rbb',512,vertical(12,2,'reverse'),4,1.6):f('bb12',512,vertical(12,2,'batten'),4,1.8);
  case 'Vertical timber siding':return variant==='Channel groove 8 in'?f('ch8',512,vertical(8,0,'channel'),4,1.6,.8):variant==='Charred · shou sugi ban'?f('charred',512,vertical(6,0,'charred'),4,2,.95):f('tg6',512,vertical(6,0,'tg'),4,1.3,.8);
  case 'Cedar shingles':return f('sh-'+variant,512,shingles(variant==='Fish-scale'?'fish':variant==='Staggered butts'?'stagger':'straight'),4,2,.85);
  case 'Horizontal metal':return variant==='8 in reveal panels'?f('hm8',512,hpanel(8,true),4,1.5,.45,.5):f('hm12',512,hpanel(12,false),4,1.2,.42,.5);
  case 'Corrugated metal':return variant==='1-1/4 in mini corrugation'?f('cor1',512,corrugated(1.25),2,1.8,.4,.6):f('cor2',512,corrugated(8/3),2,2,.4,.6);
  case 'Standing seam metal':return variant==='12 in seams'?f('ss12',512,seams(12),4,1.6,.4,.55):f('ss16',512,seams(16),4,1.6,.4,.55);
  case 'Brick veneer':return variant==='Painted brick'?f('pbrick',512,brick(false),4,1.6,.85):variant==='Whitewashed brick'?f('wbrick',512,brick(true),4,1.6,.85):null;
  case 'Stone veneer':return variant==='Ledgestone'?f('ledge',512,ledge,4,2.2,.9):null;
  case 'Stucco & timber':return variant==='Sand-float stucco'?f('sandstucco',512,sand,3,1.2,.95):null;
 }
 return null;
}
