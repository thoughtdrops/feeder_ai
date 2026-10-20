type SceneHandle=(()=>void)&{select?:(target:any)=>void;setMode?:(mode:any)=>void;getPose?:()=>any;navigate?:(direction:string)=>void};
type Options={host:HTMLElement;render:(host:HTMLElement,data:any)=>SceneHandle|undefined;onError:(error:unknown)=>void;schedule?:(callback:FrameRequestCallback)=>number;cancel?:(id:number)=>void};

// Keep expensive graphics work outside the Rust touch/selection callback.
// Coalesce rapid changes so only the newest requested design is constructed.
export function createSceneController({host,render,onError,schedule=requestAnimationFrame,cancel=cancelAnimationFrame}:Options){
 let handle:SceneHandle|undefined,pending:any,last:any,lastKey='',lastFloor=0,frame=0,selection:any=null,mode:any;
 let lostCanvas:HTMLCanvasElement|undefined,recoveries=0,disposed=false;
 const report=(error:unknown)=>{try{onError(error)}catch{}};
 const stop=()=>{const old=handle;handle=undefined;if(old)try{old()}catch(error){report(error)}};
 const contextLost=(event:Event)=>{event.preventDefault();stop();};
 const contextRestored=()=>{if(disposed||!last)return;if(recoveries++<2)update(last);};
 const unbindContext=()=>{lostCanvas?.removeEventListener('webglcontextlost',contextLost);lostCanvas?.removeEventListener('webglcontextrestored',contextRestored);};
 function flush(){
  frame=0;if(disposed||!pending)return;const data=pending;pending=undefined;
  // Switching floors (a floor button, or clicking an upper window from outside) keeps the camera where it is: outside it
  // stays put, inside it rises or drops by the floor height to the chosen floor, instead of jumping back to the start view.
  const key=JSON.stringify([data.view,data.view==='walk'?data.jump:'',data.frameOpening,data.cameraRevision,data.config.garage,data.config.garageSide,['exterior','framing'].includes(data.view)?data.model.floorHeight:0,data.model.w,data.model.d]);
  const floor=data.config.activeFloor||0;
  if(key===lastKey&&handle?.getPose){const pose=handle.getPose();const lift=data.view==='exterior'?0:(floor-lastFloor)*(data.model.floorHeight||0);if(pose&&lift){pose.position=[...pose.position];pose.target=[...pose.target];pose.position[1]+=lift;pose.target[1]+=lift;}data.cameraPose=pose;}
  lastKey=key;lastFloor=floor;
  stop();host.replaceChildren();last=data;
  if(data.view==='plan')return;
  try{
   let building=true;
   handle=render(host,{...data,selection,onRenderError(error:unknown){if(building)throw error;stop();report(error);}});building=false;handle?.select?.(selection);if(mode)handle?.setMode?.(mode);
   const canvas=host.querySelector('canvas');
   if(canvas&&canvas!==lostCanvas){
    unbindContext();
    lostCanvas=canvas;
    canvas.addEventListener('webglcontextlost',contextLost);
    canvas.addEventListener('webglcontextrestored',contextRestored);
   }
  }catch(error){stop();host.replaceChildren();const message=document.createElement('div');message.className='webgl-error';message.textContent='The 3D view could not load. You can switch views or use Reset view to retry.';host.appendChild(message);report(error);}
 }
 function update(data:any){if(disposed)return;pending=data;selection=data.selection??null;if(frame)cancel(frame);frame=schedule(flush);}
 return {update,select(target:any){selection=target;handle?.select?.(target)},setMode(next:any){mode=next;handle?.setMode?.(next)},navigate(direction:string){handle?.navigate?.(direction)},dispose(){disposed=true;if(frame)cancel(frame);pending=undefined;stop();unbindContext();},getPose(){return handle?.getPose?.()},refresh(){if(last&&!pending)update(last);},liveScene(view:string){return !pending&&last?.view===view?(handle as any)?.scene:undefined}};
}
