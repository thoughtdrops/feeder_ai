import * as T from 'three';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export function interiorNavigation(camera:T.PerspectiveCamera,orbit:OrbitControls,m:any,view:string){
 const interior=view==='dollhouse';
 // Keep the orbit pivot stable and remove inertia that makes touch controls drift.
 orbit.screenSpacePanning=false;orbit.enablePan=true;orbit.zoomToCursor=false;
 orbit.enableDamping=false;orbit.rotateSpeed=.45;orbit.zoomSpeed=.5;orbit.panSpeed=.9;
 orbit.minPolarAngle=Math.PI/18;orbit.maxPolarAngle=Math.PI*.48;
 orbit.mouseButtons={LEFT:T.MOUSE.ROTATE,MIDDLE:T.MOUSE.DOLLY,RIGHT:T.MOUSE.PAN};
 orbit.touches={ONE:T.TOUCH.ROTATE,TWO:T.TOUCH.DOLLY_PAN};
 if(interior){const span=Math.max(m.w,m.d);camera.fov=50;camera.updateProjectionMatrix();orbit.minDistance=Math.max(8,span*.3);orbit.maxDistance=span*4;orbit.target.set(0,m.h*.24,0);camera.position.set(span*.65,m.h+span*.7,-span*.85);orbit.update();}
 return (direction:string)=>{
  if(view==='walk')return;
  const step=Math.max(1,Math.min(m.w,m.d)/10),delta=new T.Vector3();
  if(direction==='left')delta.x=-step;if(direction==='right')delta.x=step;
  if(direction==='front')delta.z=-step;if(direction==='rear')delta.z=step;
  if(direction.startsWith('rotate-')||direction.startsWith('tilt-')){
   const spherical=new T.Spherical().setFromVector3(camera.position.clone().sub(orbit.target));
   if(direction==='rotate-left')spherical.theta-=Math.PI/12;
   if(direction==='rotate-right')spherical.theta+=Math.PI/12;
   if(direction==='tilt-up')spherical.phi-=Math.PI/18;
   if(direction==='tilt-down')spherical.phi+=Math.PI/18;
   spherical.phi=T.MathUtils.clamp(spherical.phi,orbit.minPolarAngle,orbit.maxPolarAngle);
   camera.position.copy(orbit.target).add(new T.Vector3().setFromSpherical(spherical));
  }else if(direction==='in'||direction==='out'){
   const offset=camera.position.clone().sub(orbit.target),factor=direction==='in'?.85:1.18;
   const length=T.MathUtils.clamp(offset.length()*factor,orbit.minDistance,orbit.maxDistance);
   camera.position.copy(orbit.target).add(offset.setLength(length));
  }else{camera.position.add(delta);orbit.target.add(delta);}
  orbit.update();
 };
}
