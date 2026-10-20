import * as T from 'three';
import {addRoof} from './architecture';

// Additions (L, T and U homes) and bump-outs, one story or several. Their walls, windows, rooms and furniture arrive with
// each floor they reach; this adds what the main house draws from its rectangle: foundation (ground floor), floor,
// ceiling and, on their top floor, the roof.
export function addWings(scene:T.Object3D,m:any,wings:any[],opts:{floor:T.Material;ceiling:T.Material;roof:T.MeshStandardMaterial;siding:T.MeshStandardMaterial;trim:T.Material;foundation:T.Material;frame:boolean;cut:boolean;roofOn:boolean;level?:number}){const level=opts.level||0;
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material,name:string)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.position.set(x-m.w/2,y,z-m.d/2);mesh.castShadow=mesh.receiveShadow=true;mesh.name=name;scene.add(mesh);return mesh;};
 for(const g of wings){
  if(opts.frame)continue;
  // Overlap the house foundation and floor by a hair so the seam at the house wall never shows. Wings sit
  // behind the house; bump-outs can pop out of any side.
  const [ox,oz]=({front:[0,-1],left:[-1,0],right:[1,0]} as any)[g.side]||[0,1];
  if(!level)box(g.x+g.w/2+ox*.15,-.25,g.z+g.d/2+oz*.15,g.w+(ox?.4:.7),.7,g.d+(oz?.4:.7),opts.foundation,g.bump?'Bump-out foundation':'Addition foundation');
  const floor=box(g.x+g.w/2,.14,g.z+g.d/2,g.w,.14,g.d+.02,opts.floor,'Addition finished floor');floor.userData.editTarget={kind:'floor'};
  // Between floors of a taller wing or bump-out, the rim band continues the house's siding.
  if(level<(g.levels||1)-1&&m.floorGap){const gap=m.floorGap,y=g.h+gap/2;for(const z of [g.z,g.z+g.d])box(g.x+g.w/2,y,z,g.w+.46,gap,.46,opts.siding,'Addition rim band');for(const x of [g.x,g.x+g.w])box(x,y,g.z+g.d/2,.46,gap,g.d,opts.siding,'Addition rim band');}
  if(!opts.cut){box(g.x+g.w/2,g.h-.08,g.z+g.d/2,g.w,.14,g.d,opts.ceiling,'Addition ceiling');}
  if(opts.roofOn&&!opts.cut&&level===(g.levels||1)-1)addRoof(scene,{roof:g.roof,w:m.w,d:m.d,h:g.h},opts.roof,opts.siding,opts.trim);
 }
}
