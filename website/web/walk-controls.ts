// Press-and-hold movement stays independent of a second finger looking around.
export function bindWalkControls(root:HTMLElement,movement:(directions:Set<string>)=>void){
 const held=new Map<string,string>();
 const emit=()=>{const active=new Set(held.values());movement(active);for(const b of root.querySelectorAll<HTMLElement>('[data-walk]'))b.classList.toggle('held',active.has(b.dataset.walk!));};
 const button=(target:EventTarget|null)=>{const b=target instanceof Element?target.closest<HTMLElement>('[data-walk]'):null;return b&&root.contains(b)?b:null;};
 const start=(e:PointerEvent)=>{const b=button(e.target);if(!b||e.button>0)return;e.preventDefault();e.stopPropagation();held.set('p'+e.pointerId,b.dataset.walk!);try{b.setPointerCapture(e.pointerId);}catch{}emit();};
 const end=(e:PointerEvent)=>{if(held.delete('p'+e.pointerId)){e.preventDefault();emit();}};
 const touchStart=(e:TouchEvent)=>{const b=button(e.target);if(!b)return;e.preventDefault();e.stopPropagation();for(const t of Array.from(e.changedTouches))held.set('t'+t.identifier,b.dataset.walk!);emit();};
 const touchEnd=(e:TouchEvent)=>{let changed=false;for(const t of Array.from(e.changedTouches))changed=held.delete('t'+t.identifier)||changed;if(changed){e.preventDefault();emit();}};
 const keyDown=(e:KeyboardEvent)=>{const b=button(e.target);if(!b||![' ','Enter'].includes(e.key))return;e.preventDefault();e.stopPropagation();held.set('k'+e.key,b.dataset.walk!);emit();};
 const keyUp=(e:KeyboardEvent)=>{if(held.delete('k'+e.key)){e.preventDefault();emit();}};
 const clear=()=>{held.clear();emit();};const hidden=()=>{if(document.hidden)clear();};
 const click=(e:Event)=>{if(button(e.target)){e.preventDefault();e.stopPropagation();}};
 const pointer=typeof window.PointerEvent==='function';
 if(pointer){root.addEventListener('pointerdown',start,true);window.addEventListener('pointerup',end,true);window.addEventListener('pointercancel',end,true);root.addEventListener('lostpointercapture',end,true);}
 else{root.addEventListener('touchstart',touchStart,{capture:true,passive:false});window.addEventListener('touchend',touchEnd,{capture:true,passive:false});window.addEventListener('touchcancel',touchEnd,{capture:true,passive:false});}
 root.addEventListener('keydown',keyDown,true);window.addEventListener('keyup',keyUp,true);root.addEventListener('click',click,true);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',hidden);
 return()=>{clear();root.removeEventListener('pointerdown',start,true);window.removeEventListener('pointerup',end,true);window.removeEventListener('pointercancel',end,true);root.removeEventListener('lostpointercapture',end,true);root.removeEventListener('touchstart',touchStart,true);window.removeEventListener('touchend',touchEnd,true);window.removeEventListener('touchcancel',touchEnd,true);root.removeEventListener('keydown',keyDown,true);window.removeEventListener('keyup',keyUp,true);root.removeEventListener('click',click,true);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',hidden);};
}
