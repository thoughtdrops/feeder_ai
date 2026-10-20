import * as T from 'three';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export function houseViewBounds(m:any,config:any,view:string){
 const whole=view==='exterior'||view==='framing';const b=whole&&m.siteBounds?m.siteBounds:{minX:-1.5,minZ:-1.5,maxX:m.w+1.5,maxZ:m.d+1.5};
 const roof=whole?Math.max(m.ridgeRise||0,m.roof?.rise||0):0;
 const height=view==='dollhouse'?4.2:m.h*(whole?(config.stories||1):1)+(whole?(m.floorGap||1.5833)*((config.stories||1)-1):0)+roof;
 return new T.Box3(new T.Vector3(b.minX-m.w/2,-1.6,b.minZ-m.d/2),new T.Vector3(b.maxX-m.w/2,height+.8,b.maxZ-m.d/2));
}
export function fitHouseCamera(camera:T.PerspectiveCamera,orbit:OrbitControls,m:any,config:any,view:string,width:number,height:number){
 const bounds=houseViewBounds(m,config,view),center=bounds.getCenter(new T.Vector3());
 const direction=camera.position.clone().sub(orbit.target).normalize();if(direction.lengthSq()<.5)direction.set(.6,.45,-.7).normalize();
 const right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),direction).normalize();
 const up=new T.Vector3().crossVectors(direction,right).normalize();
 const tanY=Math.tan(T.MathUtils.degToRad(camera.fov/2))*.79,tanX=tanY*Math.max(.1,width/height);
 let distance=0;
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  const offset=new T.Vector3(x,y,z).sub(center),toward=offset.dot(direction);
  distance=Math.max(distance,toward+Math.abs(offset.dot(right))/tanX,toward+Math.abs(offset.dot(up))/tanY);
 }
 orbit.target.copy(center);camera.position.copy(center).addScaledVector(direction,distance);
 orbit.minDistance=3;orbit.maxDistance=Math.max(distance*3,Math.max(m.w,m.d)*5);
 camera.far=Math.max(1000,distance*6);camera.updateProjectionMatrix();orbit.update();camera.updateMatrixWorld();return distance;
}
