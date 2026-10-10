import * as T from 'three';
import {addRoof} from './architecture';

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
  const height=post.height-p.deckY;
  if(!frame&&p.columnStyle==='turned'){
   const profile=[new T.Vector2(.19,0),new T.Vector2(.19,.65),new T.Vector2(.15,.68),new T.Vector2(.18,.76),new T.Vector2(.14,.84),new T.Vector2(.105,1.05),new T.Vector2(.14,1.2),new T.Vector2(.105,1.4),new T.Vector2(.11,height-.45),new T.Vector2(.19,height-.3),new T.Vector2(.19,height)];
   const mesh=new T.Mesh(new T.LatheGeometry(profile,16),wood);mesh.position.set(post.x-m.w/2,p.deckY,post.z-m.d/2);mesh.name='Turned porch column';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  }else if(!frame&&p.columnStyle==='tapered'){
   box(post.x,1.05,post.z,1.3,1.7,1.3,siding,'Craftsman column pedestal');const mesh=new T.Mesh(new T.CylinderGeometry(.27,.5,height-1.7,4),wood);mesh.rotation.y=Math.PI/4;mesh.position.set(post.x-m.w/2,1.9+(height-1.7)/2,post.z-m.d/2);mesh.name='Tapered Craftsman porch column';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  }else if(!frame&&p.columnStyle==='classical'){
   const mesh=new T.Mesh(new T.CylinderGeometry(.18,.23,height,24),wood);mesh.position.set(post.x-m.w/2,p.deckY+height/2,post.z-m.d/2);mesh.name='Classical porch column';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  }else box(post.x,p.deckY+height/2,post.z,.5,height,.5,wood,'Porch structural column');
  box(post.x,p.deckY+.09,post.z,.64,.18,.64,wood,'Porch column plinth');box(post.x,post.height-.08,post.z,.65,.16,.65,wood,'Porch column capital');
  if(frame)box(post.x,-.5,post.z,2.,.5,2.,concrete,'Porch footing allowance');
 }
 if(!frame)for(const rail of p.rails){
  beam(rail.a,rail.b,.17,.16,'Porch upper rail');const aa=[...rail.a],bb=[...rail.b],deck=Math.max(...p.rectangles.flatMap((r:any)=>r.deckYs||[p.deckY]).filter((y:number)=>y<rail.a[1]-1));aa[1]=bb[1]=deck+.25;beam(aa,bb,.15,.12,'Porch lower rail');
  for(let i=1;i<=rail.balusters;i++){const t=i/(rail.balusters+1),x=rail.a[0]+(rail.b[0]-rail.a[0])*t,z=rail.a[2]+(rail.b[2]-rail.a[2])*t;box(x,(rail.a[1]+deck+.25)/2,z,.07,rail.a[1]-deck-.42,.07,wood,'Porch baluster');}
 }
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
