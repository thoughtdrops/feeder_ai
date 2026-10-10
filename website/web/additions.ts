import * as T from 'three';
import {addRoof} from './architecture';
import {addPorch} from './porch';
import {addTrimSegment} from './trim';

const point=(p:number[],m:any)=>new T.Vector3(p[0]-m.w/2,p[1],p[2]-m.d/2);
function beam(root:T.Object3D,a:T.Vector3,b:T.Vector3,w:number,h:number,mat:T.Material,name:string){
 const delta=b.clone().sub(a);if(delta.length()<.01)return;const mesh=new T.Mesh(new T.BoxGeometry(w,h,delta.length()),mat);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),delta.normalize());mesh.castShadow=mesh.receiveShadow=true;mesh.name=name;root.add(mesh);return mesh;
}
function polygon(root:T.Object3D,points:number[][],m:any,mat:T.Material,name:string){
 const positions:number[]=[],uv:number[]=[];
 // Roof/cheek faces are convex and may be vertical, so triangulate their fan.
 for(let i=1;i<points.length-1;i++)for(const p of [points[0],points[i],points[i+1]]){positions.push(p[0]-m.w/2,p[1],p[2]-m.d/2);uv.push((p[0]+p[2])/3,p[1]/3);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.computeVertexNormals();const mesh=new T.Mesh(geo,mat);mesh.castShadow=mesh.receiveShadow=true;mesh.name=name;root.add(mesh);return mesh;
}

export function addDormers(root:T.Object3D,m:any,framing:boolean,wood:T.MeshStandardMaterial,roof:T.MeshStandardMaterial,siding:T.MeshStandardMaterial,glass:T.Material){
 for(const d of m.dormers||[]){
  const group=new T.Group();group.name=d.id+' '+d.kind+' window dormer';root.add(group);
  if(framing){
   for(const member of [...d.members,...(d.supportMembers||[])])beam(group,point([member.x1,member.y1,member.z1],m),point([member.x2,member.y2,member.z2],m),member.width,member.depth,wood,d.id+' '+member.role);
   for(const r of d.rafters){const a=point([r.x1,r.y1,r.z1],m),b=point([r.x2,r.y2,r.z2],m);beam(group,a,b,.045,.62,wood,d.id+' I-joist web');for(const offset of [-.36,.36])beam(group,a.clone().add(new T.Vector3(0,offset,0)),b.clone().add(new T.Vector3(0,offset,0)),.3,.1,wood,d.id+' I-joist flange');}
   continue;
  }
  addRoof(group,{...m,roof:{facets:d.facets,edges:[],profiles:[]}},roof,siding,wood);
  const side=siding.clone();side.side=T.DoubleSide;for(const cheek of d.cheeks)polygon(group,cheek,m,side,d.id+' sloped cheek');
  const local=new T.Group();local.position.set(d.origin[0]-m.w/2,d.baseY,d.origin[1]-m.d/2);local.rotation.y=Math.atan2(-d.tangent[1],d.tangent[0]);group.add(local);
  const box=(x:number,y:number,z:number,w:number,h:number,dep:number,mat:T.Material,name:string)=>{if(w<=0||h<=0)return;const object=new T.Mesh(new T.BoxGeometry(w,h,dep),mat);object.position.set(x,y,z);object.castShadow=object.receiveShadow=true;object.name=name;local.add(object);return object;};
  let cursor=0;for(const o of d.openings){box((cursor+o.at)/2,d.height/2,0,o.at-cursor,d.height,.42,siding,d.id+' front wall');box(o.at+o.width/2,o.bottom/2,0,o.width,o.bottom,.42,siding,d.id+' wall below window');box(o.at+o.width/2,(o.bottom+o.height+d.height)/2,0,o.width,d.height-o.bottom-o.height,.42,siding,d.id+' wall above window');box(o.at+o.width/2,o.bottom+o.height/2,-.03,o.width-.14,o.height-.14,.04,glass,d.id+' glazed window');
   const outward=new T.Vector3(0,0,-1);for(const at of [o.at-.13,o.at+o.width+.13])addTrimSegment(local,new T.Vector3(at,o.bottom-.12,-.25),new T.Vector3(at,o.bottom+o.height+.12,-.25),.26,.14,outward,m.trimPackage?.profile??3,wood,undefined);
   for(const yy of [o.bottom-.13,o.bottom+o.height+.13])addTrimSegment(local,new T.Vector3(o.at-.26,yy,-.25),new T.Vector3(o.at+o.width+.26,yy,-.25),.26,.17,outward,m.trimPackage?.profile??3,wood,undefined);
   if(d.width>2.){box(o.at+o.width/2,o.bottom+o.height/2,-.10,.065,o.height,.10,wood,d.id+' window mullion');box(o.at+o.width/2,o.bottom+o.height/2,-.10,o.width,.065,.10,wood,d.id+' window meeting rail');}
   cursor=o.at+o.width;
  }box((cursor+d.width)/2,d.height/2,0,d.width-cursor,d.height,.42,siding,d.id+' front wall');
  if(d.gableRise>0.){
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,d.height,0,d.width,d.height,0,d.width/2,d.height+d.gableRise,0],3));g.setAttribute('uv',new T.Float32BufferAttribute([0,0,d.width/3,0,d.width/6,d.gableRise/3],2));g.computeVertexNormals();const object=new T.Mesh(g,side);object.name=d.id+' gable infill';local.add(object);
   beam(local,new T.Vector3(0,d.height,-.27),new T.Vector3(d.width/2,d.height+d.gableRise,-.27),.2,.2,wood,d.id+' gable rake');beam(local,new T.Vector3(d.width/2,d.height+d.gableRise,-.27),new T.Vector3(d.width,d.height,-.27),.2,.2,wood,d.id+' gable rake');
  }
  for(const facet of d.facets)for(let i=0;i<facet.points.length;i++){const a=point(facet.points[i],m),b=point(facet.points[(i+1)%facet.points.length],m);beam(group,a,b,.14,.14,wood,d.id+' roof edge / flashing');}
 }
}

export function addRearOutdoor(root:T.Object3D,m:any,framing:boolean,wood:T.MeshStandardMaterial,roof:T.MeshStandardMaterial,siding:T.MeshStandardMaterial){
 const p=m.rearOutdoor;if(!p||m.floorIndex)return;addPorch(root,{...m,porch:p},framing,wood,roof,siding);
 for(const b of p.beams||[])beam(root,point(b.a,m),point(b.b,m),.25,.75,wood,'Rear deck doubled support beam');
}

export function addBalcony(root:T.Object3D,m:any,framing:boolean,wood:T.MeshStandardMaterial,whole:boolean){
 const p=m.balcony;if(!p||whole&&m.floorIndex||!whole&&!m.floorIndex||whole&&p.existingGallery)return;
 const group=new T.Group();group.name='Connected upper balcony';root.add(group);const offset=whole?0:-m.floorHeight;
 const pt=(a:number[])=>point([a[0],a[1]+offset,a[2]],m);
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,name:string)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),wood);mesh.position.set(x-m.w/2,y+offset,z-m.d/2);mesh.castShadow=mesh.receiveShadow=true;mesh.name=name;group.add(mesh);};
 for(const j of p.joists)beam(group,pt(j.a),pt(j.b),.125,7.25/12,wood,'Balcony deck joist');
 for(const z of[p.z,p.z+p.d])box(p.x+p.w/2,p.deckY-.33,z,p.w,7.25/12,.125,'Balcony rim / ledger');
 for(const x of[p.x,p.x+p.w])box(x,p.deckY-.33,p.z+p.d/2,.125,7.25/12,p.d,'Balcony rim');
 beam(group,pt([p.x,p.deckY-.67,p.z+p.d]),pt([p.x+p.w,p.deckY-.67,p.z+p.d]),.25,.75,wood,'Balcony doubled beam');
 if(whole)for(const post of p.posts)box(post.x,post.height/2,post.z,.5,post.height,.5,'Balcony support post');
 if(!framing){for(let z=p.z+.22;z<p.z+p.d;z+=.47)box(p.x+p.w/2,p.deckY-.04,z,p.w,.08,Math.min(.455,p.z+p.d-z+.22),'Sealed balcony decking');
  for(const r of p.rails){beam(group,pt(r.a),pt(r.b),.17,.16,wood,'Balcony guard cap');const a=[...r.a],b=[...r.b];a[1]=b[1]=p.deckY+.25;beam(group,pt(a),pt(b),.15,.12,wood,'Balcony guard lower rail');
   for(let i=1;i<=r.balusters;i++){const t=i/(r.balusters+1);box(r.a[0]+(r.b[0]-r.a[0])*t,p.deckY+1.84,r.a[2]+(r.b[2]-r.a[2])*t,.08,3.10,.08,'Balcony baluster');}
  }
  for(const [x,z]of[[p.x,p.z],[p.x+p.w,p.z],[p.x,p.z+p.d],[p.x+p.w,p.z+p.d]])box(x,p.deckY+1.75,z,.3,3.5,.3,'Balcony guard post');
 }
}

export function addRoofAccents(root:T.Object3D,m:any,wood:T.MeshStandardMaterial){
 const data=m.roofAccents;if(!data)return;const group=new T.Group();group.name='Style-coordinated roof accents';root.add(group);
 for(const edge of data.edges){const a=point(edge.a,m),b=point(edge.b,m),normal=new T.Vector3(...edge.normal as [number,number,number]);const direction=b.clone().sub(a);if(direction.clone().cross(normal).y<0){const temp=a.clone();a.copy(b);b.copy(temp);}addTrimSegment(group,a,b,edge.width,edge.projection,normal,edge.profile,wood,undefined);}
 for(const kind of ['dentil','bracket','fret']){
  const items=data.ornaments.filter((o:any)=>o.kind===kind);if(!items.length)continue;
  let geometry:T.BufferGeometry;if(kind==='dentil')geometry=new T.BoxGeometry(.23,.3,.38);else if(kind==='fret')geometry=new T.TorusGeometry(.27,.045,7,20);else{const shape=new T.Shape();shape.moveTo(-.35,.6);shape.lineTo(.35,.6);shape.lineTo(.35,-.4);shape.quadraticCurveTo(.15,.05,-.35,.6);geometry=new T.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1});}
  const instances=new T.InstancedMesh(geometry,wood,items.length);instances.name='Carved roof '+kind;const dummy=new T.Object3D();items.forEach((o:any,i:number)=>{dummy.position.copy(point(o.position,m));dummy.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...o.normal as [number,number,number]));dummy.scale.setScalar(o.size);dummy.updateMatrix();instances.setMatrixAt(i,dummy.matrix);});instances.instanceMatrix.needsUpdate=true;instances.computeBoundingSphere();instances.castShadow=instances.receiveShadow=true;group.add(instances);
 }
 const panelMat=wood.clone();panelMat.side=T.DoubleSide;
 for(const p of data.panels){const along=p.axis==='x',outside=(along?p.z<m.d/2:p.x<m.w/2)?-.31:.31,pt=(at:number,h:number)=>[p.x+(along?at:outside),p.baseY+h,p.z+(along?outside:at)];
  for(let i=1;i<p.points.length;i++){const [a,ay]=p.points[i-1],[b,by]=p.points[i];if(Math.max(ay,by)<.05)continue;polygon(group,[pt(a,0),pt(b,0),pt(b,by),pt(a,ay)],m,panelMat,p.kind+' gable accent');
   if(p.kind==='Tudor timber'||p.kind==='Board and batten'){for(let at=Math.ceil(a/2)*2;at<b;at+=2){const h=ay+(by-ay)*(at-a)/(b-a);if(h>.1)beam(group,point(pt(at,.03),m),point(pt(at,h),m),p.kind==='Tudor timber'?.2:.09,.12,wood,p.kind+' gable batten');}}
   else for(let h=.55;h<Math.max(ay,by);h+=.55){const span=(at:number)=>ay+(by-ay)*(at-a)/(b-a);let lo=a,hi=b;if(span(lo)<h)lo=a+(h-ay)*(b-a)/(by-ay);if(span(hi)<h)hi=a+(h-ay)*(b-a)/(by-ay);if(hi>lo)beam(group,point(pt(lo,h),m),point(pt(hi,h),m),.045,.045,wood,'Shingle panel overlap');}
  }
 }
 for(const f of data.finials){const p=point(f.position,m);let geometry:T.BufferGeometry;
  if(f.kind==='Roof spire')geometry=new T.ConeGeometry(f.width/2,f.height,8);else{const h=f.height,w=f.width;geometry=new T.LatheGeometry([new T.Vector2(w*.45,0),new T.Vector2(w*.45,.18),new T.Vector2(w*.2,.3),new T.Vector2(w*.35,.55),new T.Vector2(w*.16,h*.55),new T.Vector2(w*.24,h*.68),new T.Vector2(.025,h)],20);}
  const mesh=new T.Mesh(geometry,wood);mesh.position.copy(p);if(f.kind==='Roof spire')mesh.position.y+=f.height/2;mesh.name=f.kind;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
 }
}
