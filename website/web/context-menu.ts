type Point={x:number;y:number};
export function fitMenu(width:number,height:number,menuWidth:number,menuHeight:number,anchor:Point,preferred?:Point):Point{
 const pad=10,maxX=Math.max(pad,width-menuWidth-pad),maxY=Math.max(pad,height-menuHeight-pad);
 const clamp=(p:Point)=>({x:Math.max(pad,Math.min(maxX,p.x)),y:Math.max(pad,Math.min(maxY,p.y))});
 if(preferred)return clamp(preferred);
 const candidates=[{x:pad,y:pad},{x:maxX,y:pad},{x:pad,y:maxY},{x:maxX,y:maxY}];
 const score=(p:Point)=>{const inside=anchor.x>=p.x-24&&anchor.x<=p.x+menuWidth+24&&anchor.y>=p.y-24&&anchor.y<=p.y+menuHeight+24;return (inside?-1e9:0)+Math.hypot(p.x+menuWidth/2-anchor.x,p.y+menuHeight/2-anchor.y);};
 return candidates.sort((a,b)=>score(b)-score(a))[0];
}
let root:HTMLElement|null=null,selection:any=null,key='',manual:Point|undefined,observer:ResizeObserver|undefined;
let drag:{pointerId:number;offsetX:number;offsetY:number;menu:HTMLElement}|undefined;
function place(){if(!root)return;const menu=root.querySelector<HTMLElement>('.context-menu');if(!menu)return;const r=root.getBoundingClientRect();if(!r.width||!r.height)return;
 menu.style.width=Math.min(310,Math.max(0,r.width-20))+'px';menu.style.maxHeight=Math.max(0,r.height-20)+'px';
 const m=menu.getBoundingClientRect();const p=fitMenu(r.width,r.height,m.width,m.height,{x:selection?.screenX??r.width/2,y:selection?.screenY??r.height/2},manual);menu.style.left=p.x+'px';menu.style.top=p.y+'px';if(manual)manual=p;
}
function bind(next:HTMLElement){root=next;observer=new ResizeObserver(place);observer.observe(next);
 next.addEventListener('pointerdown',e=>{const element=e.target as HTMLElement;const heading=element.closest<HTMLElement>('[data-menu-drag]');if(!heading||element.closest('button')||e.button!==0)return;const menu=heading.closest<HTMLElement>('.context-menu')!;const m=menu.getBoundingClientRect();drag={pointerId:e.pointerId,offsetX:e.clientX-m.left,offsetY:e.clientY-m.top,menu};heading.setPointerCapture?.(e.pointerId);e.preventDefault();});
 document.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointerId||!root)return;const r=root.getBoundingClientRect();manual={x:e.clientX-r.left-drag.offsetX,y:e.clientY-r.top-drag.offsetY};place();e.preventDefault();});
 const finish=()=>{drag=undefined;};document.addEventListener('pointerup',finish);document.addEventListener('pointercancel',finish);window.addEventListener('blur',finish);
 next.addEventListener('toggle',place,true);
}
export function layoutEditor(raw:string){const next=document.getElementById('context');if(!next)return;if(root!==next){observer?.disconnect();bind(next);}selection=JSON.parse(raw);const nextKey=JSON.stringify([selection?.kind,selection?.id,selection?.wallId,selection?.x,selection?.z,selection?.screenX,selection?.screenY]);if(key!==nextKey){manual=undefined;drag=undefined;key=nextKey;}place();}
