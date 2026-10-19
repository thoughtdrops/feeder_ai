import * as T from 'three';
import {addRoof} from './architecture';

// One-story additions (L, T and U homes) and bump-outs. Their walls, windows, rooms and furniture arrive with the ground
// floor; this adds what the main house draws from its rectangle: foundation, floor, ceiling and gable roof.
export function addWings(scene:T.Object3D,m:any,wings:any[],opts:{floor:T.Material;ceiling:T.Material;roof:T.MeshStandardMaterial;siding:T.MeshStandardMaterial;trim:T.Material;foundation:T.Material;frame:boolean;cut:boolean;roofOn:boolean}){
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material,name:string)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.position.set(x-m.w/2,y,z-m.d/2);mesh.castShadow=mesh.receiveShadow=true;mesh.name=name;scene.add(mesh);return mesh;};
 for(const g of wings){
  if(opts.frame)continue;
  // Overlap the house foundation and floor by a hair so the seam at the house wall never shows. Wings sit
  // behind the house; bump-outs can pop out of any side.
  const [ox,oz]=({front:[0,-1],left:[-1,0],right:[1,0]} as any)[g.side]||[0,1];
  box(g.x+g.w/2+ox*.15,-.25,g.z+g.d/2+oz*.15,g.w+(ox?.4:.7),.7,g.d+(oz?.4:.7),opts.foundation,g.bump?'Bump-out foundation':'Addition foundation');
  const floor=box(g.x+g.w/2,.14,g.z+g.d/2,g.w,.14,g.d+.02,opts.floor,'Addition finished floor');floor.userData.editTarget={kind:'floor'};
  if(!opts.cut){box(g.x+g.w/2,g.h-.08,g.z+g.d/2,g.w,.14,g.d,opts.ceiling,'Addition ceiling');}
  if(opts.roofOn&&!opts.cut)addRoof(scene,{roof:g.roof,w:m.w,d:m.d,h:g.h},opts.roof,opts.siding,opts.trim);
 }
}
