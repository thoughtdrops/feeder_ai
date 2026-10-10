import * as T from 'three';
import tileCatalog from '../rust-app/data/tiles.json';
export const tiles=tileCatalog;
export function tileDefinition(name:string){return tiles.find(t=>t.name===name);}
const cache=new Map<string,HTMLCanvasElement>();

// The joints and relief share coordinates, so grazing light follows the pattern.
export function tileMaterial(name:string,textures:T.Texture[]){
 const tile=tileDefinition(name);if(!tile)return undefined;
 let canvas=cache.get(name);
 if(!canvas){canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d')!;
  c.fillStyle=tile.grout;c.fillRect(0,0,512,512);let state=73671;
  const rand=()=>{state=(state*16807)%2147483647;return state/2147483647};
  const block=(x:number,y:number,w:number,h:number,color=tile.color)=>{c.fillStyle=color;c.fillRect(x+2,y+2,w-4,h-4);c.strokeStyle='rgba(255,255,255,.25)';c.lineWidth=2;c.strokeRect(x+3,y+3,w-6,h-6);};
  if(tile.pattern==='subway'){for(let row=-1;row<5;row++)for(let col=-1;col<3;col++)block(col*256+(row%2)*128,row*128,256,128);}
  else if(tile.pattern==='checker'){for(let y=0;y<2;y++)for(let x=0;x<2;x++)block(x*256,y*256,256,256,(x+y)%2?'#343c3a':tile.color);}
  else if(tile.pattern==='plank'){for(let y=0;y<4;y++)for(let x=-1;x<2;x++){const start=x*512+(y%2)*256;block(start,y*128,512,128);c.strokeStyle='#66513d';c.globalAlpha=.13;for(let i=0;i<35;i++){c.beginPath();c.moveTo(start,y*128+rand()*122);c.bezierCurveTo(start+180,y*128+rand()*122,start+350,y*128+rand()*122,start+512,y*128+rand()*122);c.stroke()}c.globalAlpha=1;}}
  else if(tile.pattern==='hexagon'){const r=64;for(let row=-1;row<6;row++)for(let col=-1;col<6;col++){const x=col*96,y=row*110.85+(col%2)*55.425;c.fillStyle=tile.color;c.beginPath();for(let k=0;k<6;k++){const a=k*Math.PI/3;c.lineTo(x+Math.cos(a)*(r-2),y+Math.sin(a)*(r-2))}c.closePath();c.fill();c.strokeStyle=tile.grout;c.lineWidth=3;c.stroke();}}
  else if(tile.pattern==='herringbone'){c.fillStyle=tile.color;c.fillRect(0,0,512,512);c.save();c.translate(256,256);c.rotate(Math.PI/4);for(let r=-5;r<6;r++)for(let col=-5;col<6;col++){const x=col*128,y=r*128;block(x,y,128,64);block(x,y+64,64,128)}c.restore();}
  else{for(let y=0;y<2;y++)for(let x=0;x<2;x++){block(x*256,y*256,256,256);if(['moroccan','encaustic'].includes(tile.pattern)){c.strokeStyle=tile.pattern==='moroccan'?'#eee5cc':'#d8e2d0';c.lineWidth=10;const cx=x*256+128,cy=y*256+128;for(let k=0;k<4;k++){c.beginPath();c.ellipse(cx+Math.cos(k*Math.PI/2)*45,cy+Math.sin(k*Math.PI/2)*45,24,72,k*Math.PI/2,0,Math.PI*2);c.stroke()}c.strokeRect(cx-96,cy-96,192,192);}}}
  // Fine surface variations and continuous marble veins give stone depth.
  for(let i=0;i<12000;i++){c.fillStyle=rand()>.5?'rgba(255,255,255,.035)':'rgba(20,22,20,.035)';c.fillRect(rand()*512,rand()*512,rand()*2+1,rand()*2+1)}
  if(tile.pattern==='marble'){for(let i=0;i<18;i++){c.beginPath();const y=rand()*512;c.moveTo(0,y);c.bezierCurveTo(130,y-50,340,y+120,512,y+30);c.strokeStyle='rgba(95,109,111,.18)';c.lineWidth=rand()*3+.4;c.stroke();}}
  cache.set(name,canvas);
 }
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;textures.push(map);
 const bump=map.clone();bump.colorSpace=T.NoColorSpace;textures.push(bump);
 const material=new T.MeshStandardMaterial({map,bumpMap:bump,bumpScale:.012,roughness:tile.roughness,color:'#ffffff'});
 material.userData.repeatFeet=tile.size*2;material.userData.tileName=name;return material;
}

export function customMaterial(pattern:{dataUrl:string;repeatFeet:number},textures:T.Texture[],alive:()=>boolean){
 const texture=new T.TextureLoader().load(pattern.dataUrl,loaded=>{if(!alive()){loaded.dispose();return;}loaded.needsUpdate=true;});
 texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;textures.push(texture);
 const material=new T.MeshStandardMaterial({map:texture,roughness:.82,color:'#ffffff'});material.userData.repeatFeet=pattern.repeatFeet;return material;
}
