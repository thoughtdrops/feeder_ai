import * as T from 'three';

// Porch / deck / balcony columns and guard railings in the style the engine resolved
// (model.character.column / .railing). Positions are scene coordinates (already centred on the house).
function beam(root:T.Object3D,a:T.Vector3,b:T.Vector3,w:number,h:number,mat:T.Material,name:string){
 const delta=b.clone().sub(a);if(delta.length()<.01)return;const mesh=new T.Mesh(new T.BoxGeometry(w,h,delta.length()),mat);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),delta.normalize());mesh.castShadow=mesh.receiveShadow=true;mesh.name=name;root.add(mesh);return mesh;
}
function solid(root:T.Object3D,geo:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number,name:string){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;m.name=name;root.add(m);return m;}
const shared={stone:null as T.MeshStandardMaterial|null,metal:null as T.MeshStandardMaterial|null,glass:null as T.MeshPhysicalMaterial|null};
function stone(){if(!shared.stone){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d')!;g.fillStyle='#8c8478';g.fillRect(0,0,128,128);let seed=7;const r=()=>(seed=(seed*16807)%2147483647)/2147483647;for(let row=0;row<6;row++){let x=-r()*20;while(x<128){const w=14+r()*22;g.fillStyle=`hsl(30,${8+r()*8}%,${42+r()*16}%)`;g.fillRect(x+1.5,row*21.3+1.5,w-3,18.3);x+=w;}}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.userData.persistent=true;shared.stone=new T.MeshStandardMaterial({map:t,roughness:.95});shared.stone.userData.persistent=true;}return shared.stone;}
function metal(){if(!shared.metal){shared.metal=new T.MeshStandardMaterial({color:'#2f3133',roughness:.35,metalness:.85});shared.metal.userData.persistent=true;}return shared.metal;}
function glass(){if(!shared.glass){shared.glass=new T.MeshPhysicalMaterial({color:'#cfe3e6',roughness:.05,metalness:0,transparent:true,opacity:.28,side:T.DoubleSide,depthWrite:false});shared.glass.userData.persistent=true;}return shared.glass;}

/** One column from `baseY` up `height` feet. `brace` is the beam direction braces reach along (timber style). */
export function addColumn(root:T.Object3D,style:string,x:number,baseY:number,z:number,height:number,brace:'x'|'z',wood:T.Material,siding:T.Material){
 if(style==='turned'){
  const profile=[[.19,0],[.19,.65],[.15,.68],[.18,.76],[.14,.84],[.105,1.05],[.14,1.2],[.105,1.4],[.11,height-.45],[.19,height-.3],[.19,height]].map(([r,y])=>new T.Vector2(r,y));
  solid(root,new T.LatheGeometry(profile,16),wood,x,baseY,z,'Turned porch column');
 }else if(style==='tapered'){
  solid(root,new T.BoxGeometry(1.3,1.7,1.3),siding,x,baseY+.85,z,'Craftsman column pedestal');solid(root,new T.BoxGeometry(1.4,.12,1.4),wood,x,baseY+1.76,z,'Pedestal cap');
  const col=solid(root,new T.CylinderGeometry(.27,.5,height-1.7,4),wood,x,baseY+1.7+(height-1.7)/2,z,'Tapered Craftsman porch column');col.rotation.y=Math.PI/4;
 }else if(style==='classical'||style==='fluted'){
  const geo=new T.CylinderGeometry(style==='fluted'?.21:.2,style==='fluted'?.245:.25,height-.5,style==='fluted'?64:28,1);
  if(style==='fluted'){const p=geo.getAttribute('position') as T.BufferAttribute;for(let i=0;i<p.count;i++){const px=p.getX(i),pz=p.getZ(i),r=Math.hypot(px,pz);if(r<1e-4)continue;const a=Math.atan2(pz,px),k=1-.07*Math.max(0,Math.cos(a*16));p.setXYZ(i,px*k,p.getY(i),pz*k);}geo.computeVertexNormals();}
  solid(root,geo,wood,x,baseY+.25+(height-.5)/2,z,style==='fluted'?'Fluted Doric column':'Classical round column');
  solid(root,new T.TorusGeometry(.27,.06,8,24),wood,x,baseY+.28,z,'Column base torus').rotation.x=Math.PI/2;
  solid(root,new T.CylinderGeometry(.32,.24,.22,24),wood,x,baseY+height-.4,z,'Column echinus');
 }else if(style==='stone'){
  const pier=Math.min(3,height*.38);solid(root,new T.BoxGeometry(1.35,pier,1.35),stone(),x,baseY+pier/2,z,'Stone pier');solid(root,new T.BoxGeometry(1.55,.18,1.55),stone(),x,baseY+pier+.09,z,'Stone pier cap');
  const col=solid(root,new T.CylinderGeometry(.24,.36,height-pier-.18,4),wood,x,baseY+pier+.18+(height-pier-.18)/2,z,'Tapered post on stone pier');col.rotation.y=Math.PI/4;
 }else if(style==='timber'){
  solid(root,new T.BoxGeometry(.55,height,.55),wood,x,baseY+height/2,z,'Timber post');
  for(const s of [-1,1]){const reach=1.6,top=baseY+height-.25;const a=new T.Vector3(x,top-reach,z),b=new T.Vector3(x+(brace==='x'?s*reach:0),top,z+(brace==='z'?s*reach:0)),mid=a.clone().lerp(b,.5).add(new T.Vector3(brace==='x'?-s*.25:0,.25,brace==='z'?-s*.25:0));
   solid(root,new T.TubeGeometry(new T.QuadraticBezierCurve3(a,mid,b),12,.12,4,false),wood,0,0,0,'Curved timber brace');}
 }else solid(root,new T.BoxGeometry(.5,height,.5),wood,x,baseY+height/2,z,'Square porch post');
}

/** Guard rail from `a` to `b` (top-rail height) down to a bottom rail at `bottomY`, infilled in `style`. */
export function addGuard(root:T.Object3D,a:T.Vector3,b:T.Vector3,bottomY:number,balusters:number,style:string,wood:T.Material,label:string){
 const length=a.distanceTo(new T.Vector3(b.x,a.y,b.z));if(length<.2)return;
 const at=(u:number,y:number)=>new T.Vector3(a.x+(b.x-a.x)*u,y,a.z+(b.z-a.z)*u);
 beam(root,a,b,.17,.16,wood,label+' upper rail');
 beam(root,at(0,bottomY),at(1,bottomY),.15,.12,wood,label+' lower rail');
 const lo=bottomY+.06,hi=a.y-.08,span=hi-lo;if(span<.3)return;
 const instanced=(geo:T.BufferGeometry,mat:T.Material,count:number,place:(i:number,o:T.Object3D)=>void,name:string)=>{if(count<1)return;const im=new T.InstancedMesh(geo,mat,count);const d=new T.Object3D();for(let i=0;i<count;i++){d.position.set(0,0,0);d.rotation.set(0,0,0);place(i,d);d.updateMatrix();im.setMatrixAt(i,d.matrix);}im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();im.castShadow=im.receiveShadow=true;im.name=name;root.add(im);};
 if(style==='turned'){
  const p=[[.05,0],[.05,.12],[.035,.18],[.06,.32],[.03,.5],[.032,span-.4],[.06,span-.28],[.035,span-.16],[.05,span-.1],[.05,span]].map(([r,y])=>new T.Vector2(r,y));
  instanced(new T.LatheGeometry(p,10),wood,balusters,(i,d)=>d.position.copy(at((i+1)/(balusters+1),lo)),label+' turned balusters');
 }else if(style==='chippendale'){
  const bays=Math.max(1,Math.round(length/3));for(let i=0;i<=bays;i++)beam(root,at(i/bays,lo),at(i/bays,hi),.1,.1,wood,label+' lattice post');
  for(let i=0;i<bays;i++){const u0=i/bays,u1=(i+1)/bays,um=(u0+u1)/2,ym=(lo+hi)/2;beam(root,at(u0,lo),at(u1,hi),.07,.07,wood,label+' lattice');beam(root,at(u0,hi),at(u1,lo),.07,.07,wood,label+' lattice');
   for(const [p,q] of [[at(um,lo+span*.18),at(u0+(u1-u0)*.18,ym)],[at(u0+(u1-u0)*.18,ym),at(um,hi-span*.18)],[at(um,hi-span*.18),at(u1-(u1-u0)*.18,ym)],[at(u1-(u1-u0)*.18,ym),at(um,lo+span*.18)]] as [T.Vector3,T.Vector3][])beam(root,p,q,.06,.06,wood,label+' lattice diamond');}
 }else if(style==='boards'){
  const posts=Math.max(1,Math.ceil(length/4));for(let i=1;i<posts;i++)beam(root,at(i/posts,lo),at(i/posts,hi),.12,.12,wood,label+' board post');
  for(let y=lo+.18;y<hi-.1;y+=.42)beam(root,at(0,y),at(1,y),.07,.28,wood,label+' horizontal board');
 }else if(style==='cable'){
  const posts=Math.max(1,Math.ceil(length/4));for(let i=1;i<posts;i++)beam(root,at(i/posts,bottomY),at(i/posts,a.y-.08),.11,.11,metal(),label+' cable post');
  for(let y=lo+.2;y<hi;y+=.27){const cable=beam(root,at(0,y),at(1,y),.025,.025,metal(),label+' stainless cable');if(cable)cable.castShadow=false;}
 }else if(style==='glass'){
  const panels=Math.max(1,Math.ceil(length/5));for(let i=1;i<panels;i++)beam(root,at(i/panels,bottomY),at(i/panels,a.y-.08),.09,.09,metal(),label+' glass post');
  const pane=beam(root,at(0,(lo+hi)/2),at(1,(lo+hi)/2),.04,span,glass(),label+' tempered glass panel');if(pane)pane.castShadow=false;
 }else{
  instanced(new T.BoxGeometry(.07,span,.07),wood,balusters,(i,d)=>d.position.copy(at((i+1)/(balusters+1),lo+span/2)),label+' balusters');
 }
}
