import * as T from 'three';
import type {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export function interiorNavigation(camera:T.PerspectiveCamera,orbit:OrbitControls,m:any,view:string){
 const interior=view==='dollhouse';
 // No inertia (it makes touch controls drift). Zoom goes straight in toward the middle of the view (zooming toward
 // the cursor dragged the camera up or down), and panning follows the screen, so any part of the house can be brought
 // close by panning to it. The view never tilts below about 11° above level, so turning can't drop the camera onto
 // the ground.
 orbit.screenSpacePanning=true;orbit.enablePan=true;orbit.zoomToCursor=false;
 orbit.enableDamping=false;orbit.rotateSpeed=.45;orbit.zoomSpeed=.6;orbit.panSpeed=.9;
 orbit.minPolarAngle=Math.PI/18;orbit.maxPolarAngle=Math.PI*.44;
 if(!(orbit as any).groundGuard){(orbit as any).groundGuard=true;orbit.addEventListener('change',()=>keepAboveGround(camera,orbit));}
 // Left-drag turns the view; the wheel zooms; middle-drag or Shift/Ctrl + left-drag pans. The right button is kept free
 // for the right-click menu (select, insert here, delete).
 orbit.mouseButtons={LEFT:T.MOUSE.ROTATE,MIDDLE:T.MOUSE.PAN,RIGHT:null as any};
 orbit.touches={ONE:T.TOUCH.ROTATE,TWO:T.TOUCH.DOLLY_PAN};
 if(interior){const span=Math.max(m.w,m.d);camera.fov=50;camera.updateProjectionMatrix();orbit.minDistance=3;orbit.maxDistance=span*4;orbit.target.set(0,m.h*.24,0);camera.position.set(span*.65,m.h+span*.7,-span*.85);orbit.update();}
 return (direction:string)=>{
  if(view==='walk')return;
  // Moves follow the view: forward is where the camera looks, right is screen right.
  const step=Math.max(1,Math.min(m.w,m.d)/10),delta=new T.Vector3(),{forward,right}=viewAxes(camera);
  if(direction==='left')delta.addScaledVector(right,-step);if(direction==='right')delta.addScaledVector(right,step);
  if(direction==='front')delta.addScaledVector(forward,step);if(direction==='rear')delta.addScaledVector(forward,-step);
  if(direction==='up')delta.y=step;if(direction==='down')delta.y=-step;
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
  keepAboveGround(camera,orbit);orbit.update();
 };
}
/// The camera's heading on the ground: forward (where it looks) and right, both level.
export function viewAxes(camera:T.Camera){
 const forward=new T.Vector3();camera.getWorldDirection(forward);forward.y=0;if(forward.lengthSq()<1e-6)forward.set(0,0,-1);forward.normalize();
 return {forward,right:new T.Vector3(-forward.z,0,forward.x)};
}
/// The pivot stays at or above the ground. With the tilt limit that keeps the camera above it too, so the camera itself
/// is only moved in the rare case it is already below the ground (moving it on every change fought the orbit and
/// made the view twitch).
export function keepAboveGround(camera:T.Camera,orbit:OrbitControls){
 if(orbit.target.y<.3){const lift=.3-orbit.target.y;orbit.target.y+=lift;camera.position.y+=lift;}
 if(camera.position.y<.3)camera.position.y=.3;
}
