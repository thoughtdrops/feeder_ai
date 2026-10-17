import * as T from 'three';
import {addRoof} from './architecture';

type Palette={siding:T.MeshStandardMaterial;roof:T.MeshStandardMaterial;trim:T.Material;paint:T.Material;ceiling:T.Material;wood:T.MeshStandardMaterial;metal:T.Material;glass:T.Material;door:T.Material};

// Garage coordinates, framing and quantities come from the Rust model.
export function addGarage(scene:T.Scene,m:any,config:any,view:string,frameRoof:boolean,palette:Palette,collisions:T.Box3[]){
 const g=m.garage;if(!g||(!['exterior','framing'].includes(view)&&config.activeFloor>0))return;
 const group=new T.Group();group.name='Garage '+g.kind;group.userData.garage=g.kind;scene.add(group);
 const frame=view==='framing',cut=view==='dollhouse',height=cut?4.1:g.h,origin=new T.Vector3(-m.w/2,0,-m.d/2);
 const material=(color:string,roughness=.7,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const concrete=material('#959c95',.95);const door=material(config.colors.trim,.44,.12);
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material,name:string,solid=false)=>{if(Math.min(w,h,d)<.001)return;const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.position.set(x-m.w/2,y,z-m.d/2);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);if(solid)collisions.push(new T.Box3().setFromObject(mesh));return mesh;};
 const beam=(v:any,mat:T.Material)=>{const a=new T.Vector3(v.x1,v.y1,v.z1).add(origin),b=new T.Vector3(v.x2,v.y2,v.z2).add(origin);const mesh=new T.Mesh(new T.BoxGeometry(v.width,v.depth,v.length),mat);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),b.sub(a).normalize());mesh.name=v.role;mesh.userData.garageMember=v;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;};
 const gw=g.w||24,mid=g.x+gw/2;
 box(mid,-.25,g.z+12,gw+.5,.7,24.5,concrete,'Garage foundation');
 if(!frame){
  const slab=box(mid,.12,g.z+12,gw,.14,24,concrete,'Garage concrete floor')!;
  if(palette.paint instanceof T.MeshStandardMaterial&&palette.paint.normalMap){concrete.normalMap=palette.paint.normalMap.clone();concrete.normalScale.set(.12,.12);}
  // Slab joints and the driveway give the double bay a useful sense of scale.
  for(let x=g.x+8;x<g.x+gw-1;x+=8)box(x,.196,g.z+12,.018,.006,24,material('#707873'),'Garage slab control joint');
  box(mid,-.57,g.z-3,gw-6,.2,6,concrete,'Garage driveway apron');
  const segment=(wall:any,start:number,len:number,bottom:number,h:number,shared=false)=>{if(len<.001||h<.001)return;const along=wall.axis==='x',side=shared?(g.x<0?-.25:.25):0;box(wall.x+(along?start+len/2:side),bottom+h/2,wall.z+(along?side:start+len/2),along?len:shared?.02:5.5/12,h,along?shared?.02:5.5/12:len,shared?palette.paint:palette.siding,shared?'Garage separation gypsum':'Garage exterior wall',!shared);if(!shared){const inner=wall.axis==='x'?(wall.z===g.z?1:-1):(wall.x===g.x?1:-1);box(wall.x+(along?start+len/2:inner*.245),bottom+h/2,wall.z+(along?inner*.245:start+len/2),along?len:.025,h,along?.025:len,palette.paint,'Garage finished wall');}};
  for(const wall of [...g.walls,...g.sharedWalls]){const shared=!wall.id.startsWith('G');let cursor=0;for(const opening of wall.openings){segment(wall,cursor,opening.at-cursor,0,height,shared);segment(wall,opening.at,opening.width,0,Math.min(opening.bottom,height),shared);const top=opening.bottom+opening.height;if(height>top)segment(wall,opening.at,opening.width,top,height-top,shared);cursor=opening.at+opening.width;
    if(shared)continue;const along=wall.axis==='x',cx=wall.x+(along?opening.at+opening.width/2:0),cz=wall.z+(along?0:opening.at+opening.width/2),visible=Math.min(opening.height,height-opening.bottom);
    if(visible<=0)continue;
    if(opening.id.startsWith('G-OVERHEAD')){
     const dw=opening.width,left=wall.x+opening.at,panels=Math.round(dw/4);
     box(cx,visible/2,cz,dw,visible,.12,door,`Garage ${Math.round(dw)} × 7 sectional door`,true);
     for(let y=.08;y<visible;y+=1.75){box(cx,y,cz-.075,dw-.3,.06,.05,palette.trim,'Garage door horizontal seam');for(let x=0;x<panels;x++){const py=Math.min(1.43,visible-y-.14);if(py>0)box(left+dw/panels*(x+.5),y+py/2+.05,cz-.095,dw/panels-.4,py,.035,door,'Garage door recessed panel');}}
     if(!cut){for(const x of [left-.2,left+dw+.2]){box(x,3.5,g.z+.3,.12,7,.12,palette.metal,'Garage door vertical track');box(x,7.4,g.z+4,.12,.12,8,palette.metal,'Garage door ceiling track');}box(cx,7.8,g.z+6,1.1,.5,1.5,material('#39474b'),'Garage door opener');box(cx,7.8,g.z+3,.08,.1,6,palette.metal,'Garage opener rail');}
    }else if(opening.kind==='window'){
     box(cx,opening.bottom+visible/2,cz,along?opening.width:.10,visible,along?.10:opening.width,palette.glass,'Garage window');
     for(const offset of [-opening.width/2,opening.width/2,0])box(cx+(along?offset:0),opening.bottom+visible/2,cz+(along?0:offset),along?.09:.4,visible,along?.4:.09,palette.trim,'Garage window mullion');
    }else{box(cx,visible/2,cz,along?opening.width-.12:.1,visible,along?.1:opening.width-.12,palette.door,'Garage service door',true);}
    for(const offset of [-opening.width/2-.07,opening.width/2+.07])box(cx+(along?offset:0),opening.bottom+visible/2,cz+(along?0:offset),along?.14:.6,visible,along?.6:.14,palette.trim,'Garage opening jamb trim');if(opening.bottom+opening.height<height)box(cx,opening.bottom+opening.height+.07,cz,along?opening.width+.3:.6,.14,along?.6:opening.width+.3,palette.trim,'Garage opening head trim');
   }segment(wall,cursor,wall.length-cursor,0,height,shared);}
  if(!cut){addRoof(group,{...g,w:m.w,d:m.d},palette.roof,palette.siding,palette.trim);box(mid,g.h-.08,g.z+12,gw,.1,24,palette.ceiling,'Garage ceiling');}
  if(!cut)for(let x=g.x+6;x<g.x+gw;x+=12)box(x,g.h-.2,g.z+12,.8,.1,4,material('#e4dfb8',.2),'Garage bay LED light');
  for(const x of [g.x+.6,g.x+gw-.6])box(x,1.6,g.z+18,.04,.36,.23,material('#e4dfcd'),'Garage receptacle');
  slab.userData.garageFloor=true;
 }else{
  const color:Record<string,string>={'Header ply':'#c69649','Rough sill':'#8aa582','Bottom plate':'#8aa582','Cripple':'#dca887','Jack':'#dca887','King':'#c1a981'};
  for(const role of new Set<string>(g.frameMembers.map((v:any)=>v.role))){const pieces=g.frameMembers.filter((v:any)=>v.role===role),wood=palette.wood.clone();wood.color.set(color[role]||'#b69c76');if(config.activeFloor>0){wood.transparent=true;wood.opacity=.22;wood.depthWrite=false;}const instances=new T.InstancedMesh(new T.BoxGeometry(1,1,1),wood,pieces.length),dummy=new T.Object3D();pieces.forEach((v:any,i:number)=>{const a=new T.Vector3(v.x1,v.y1,v.z1).add(origin),b=new T.Vector3(v.x2,v.y2,v.z2).add(origin);dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),b.sub(a).normalize());dummy.scale.set(v.width,v.depth,v.length);dummy.updateMatrix();instances.setMatrixAt(i,dummy.matrix);});instances.instanceMatrix.needsUpdate=true;instances.computeBoundingBox();instances.computeBoundingSphere();instances.userData.frameMembers=pieces;instances.userData.garage=true;instances.name='Garage '+role;instances.castShadow=instances.receiveShadow=true;group.add(instances);}
  for(const wall of g.walls)for(const o of wall.openings){const along=wall.axis==='x',center=new T.Vector3(wall.x+(along?o.at+o.width/2:0)-m.w/2,o.bottom+o.height/2,wall.z+(along?0:o.at+o.width/2)-m.d/2);const outline=new T.Box3Helper(new T.Box3().setFromCenterAndSize(center,new T.Vector3(along?o.width:.5,o.height,along?.5:o.width)),new T.Color('#edc55b'));outline.name='Garage rough opening '+o.id;group.add(outline);}
  if(frameRoof){for(const r of g.roof.rafters){const v={...r,width:.08,depth:.85,role:'Garage I-joist rafter'};beam(v,palette.wood);for(const offset of [-.43,.43])beam({...v,y1:r.y1+offset,y2:r.y2+offset,width:.3,depth:.12,role:'Garage rafter flange'},palette.wood);}for(const v of g.ceilingMembers){beam(v,palette.wood);for(const offset of [-.43,.43])beam({...v,y1:v.y1+offset,y2:v.y2+offset,width:.3,depth:.12,role:'Garage ceiling flange'},palette.wood);}const e=g.roof.edges.find((v:any)=>v.kind==='ridge');beam({x1:e.a[0],y1:e.a[1]-.8,z1:e.a[2],x2:e.b[0],y2:e.b[1]-.8,z2:e.b[2],width:.45,depth:1.25,length:e.length,role:'Garage engineered ridge beam'},palette.wood);}
 }
 return group;
}
