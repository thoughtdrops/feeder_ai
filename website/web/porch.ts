import * as T from 'three';
import {addRoof} from './architecture';
import {addColumn,addGuard} from './railings';

/** Display exactly the porch schedule supplied by the Rust takeoff. */
export function addPorch(scene:T.Object3D,m:any,frame:boolean,wood:T.MeshStandardMaterial,roof:T.MeshStandardMaterial,siding:T.MeshStandardMaterial){
 const p=m.porch;if(!p||m.floorIndex)return;
 const group=new T.Group();group.name=p.kind?p.form:'Reference porch';scene.add(group);
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material,name:string)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.position.set(x-m.w/2,y,z-m.d/2);mesh.castShadow=mesh.receiveShadow=true;mesh.name=name;group.add(mesh);return mesh;};
 const beam=(a:number[],b:number[],width:number,depth:number,name:string)=>{const av=new T.Vector3(a[0]-m.w/2,a[1],a[2]-m.d/2),bv=new T.Vector3(b[0]-m.w/2,b[1],b[2]-m.d/2),delta=bv.clone().sub(av);if(delta.length()<.01)return;const mesh=new T.Mesh(new T.BoxGeometry(width,depth,delta.length()),wood);mesh.position.copy(av).add(bv).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),delta.normalize());mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;};
 const concrete=new T.MeshStandardMaterial({color:'#8d9290',roughness:.92});
 for(const r of p.rectangles){
  for(const dy of r.deckYs||[p.deckY]){
   if(!frame){for(let z=r.z+.23;z<r.z+r.d;z+=.47)box(r.x+r.w/2,dy-.04,z,r.w,.08,Math.min(.455,r.z+r.d-z+.23),wood,'Sealed wood porch deck');}
   for(const z of [r.z,r.z+r.d])box(r.x+r.w/2,dy-.33,z,r.w,7.25/12,.125,wood,'Porch deck rim');
   for(const x of [r.x,r.x+r.w])box(x,dy-.33,r.z+r.d/2,.125,7.25/12,r.d,wood,'Porch deck rim');
  }
 }
 for(const j of p.deckJoists)beam(j.a,j.b,.125,7.25/12,'Porch deck joist');
 for(const post of p.posts){
  const height=post.height-p.deckY,returnPost=post.x<0||post.x>m.w;
  if(frame)box(post.x,p.deckY+height/2,post.z,.5,height,.5,wood,'Porch structural column');
  else addColumn(group,p.columnStyle,post.x-m.w/2,p.deckY,post.z-m.d/2,height,returnPost?'z':'x',wood,siding);
  box(post.x,p.deckY+.09,post.z,.64,.18,.64,wood,'Porch column plinth');box(post.x,post.height-.08,post.z,.65,.16,.65,wood,'Porch column capital');
  if(frame)box(post.x,-.5,post.z,2.,.5,2.,concrete,'Porch footing allowance');
 }
 if(!frame){const style=m.character?.railing||'square';for(const rail of p.rails){
  const deck=Math.max(...p.rectangles.flatMap((r:any)=>r.deckYs||[p.deckY]).filter((y:number)=>y<rail.a[1]-1));
  addGuard(group,new T.Vector3(rail.a[0]-m.w/2,rail.a[1],rail.a[2]-m.d/2),new T.Vector3(rail.b[0]-m.w/2,rail.b[1],rail.b[2]-m.d/2),deck+.25,rail.balusters,style,wood,'Porch');
 }}
 for(const r of p.roofs){
  const roofGroup=new T.Group();roofGroup.position.set(r.x+r.w/2-m.w/2,0,r.z+r.d/2-m.d/2);roofGroup.name='Porch roof';group.add(roofGroup);
  const local={...r,roof:r.roof};
  if(!frame){addRoof(roofGroup,local,roof,siding,wood);roofGroup.traverse(object=>{if(object.name.startsWith('Roof '))object.name='Porch '+object.name;});}
  else for(const f of r.roof.rafters){
   const a=new T.Vector3(f.x1-r.w/2,f.y1-.08,f.z1-r.d/2),b=new T.Vector3(f.x2-r.w/2,f.y2-.08,f.z2-r.d/2),delta=b.clone().sub(a),length=delta.length();
   const member=new T.Group();member.name='Porch roof I-joist';member.position.copy(a).add(b).multiplyScalar(.5);member.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),delta.normalize());
   for(const [width,depth,y]of [[.3,.1,.35],[.045,.6,0],[.3,.1,-.35]]){const mesh=new T.Mesh(new T.BoxGeometry(width,depth,length),wood);mesh.position.y=y;mesh.castShadow=mesh.receiveShadow=true;member.add(mesh);}roofGroup.add(member);
  }
  for(const edge of r.roof.edges){const a=edge.a,b=edge.b;if(['eave','ridge','hip'].includes(edge.kind))beam([r.x+a[0],a[1]-.2,r.z+a[2]],[r.x+b[0],b[1]-.2,r.z+b[2]],7./12,.75,'Porch '+edge.kind+' beam');}
  if(!frame)box(r.x+r.w/2,r.h-.04,r.z+r.d/2,r.w,.06,r.d,wood,'Porch soffit');
 }
 const st=p.steps;for(let i=0;i<st.risers;i++)box(st.x+st.w/2,p.deckY-.18-(i+.5)*.25,st.z+(st.direction??-1)*(i+.5)*st.tread,st.w,.14,st.tread,wood,'Porch entrance step');
}
