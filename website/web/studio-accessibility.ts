/** Keep report/terms dialogs keyboard accessible without replacing native inputs. */
export function bindStudioAccessibility(){
 const root=document.getElementById('modal');if(!root)return ()=>{};
 let dialog:HTMLElement|null=null,returnFocus:HTMLElement|null=null,overflow='';
 const focusable=()=>Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),summary,[tabindex="0"]')??[]).filter(e=>!e.closest('[hidden]'));
 const sync=()=>{
  const next=root.querySelector<HTMLElement>('[role="dialog"]');
  if(next===dialog)return;
  if(next){if(!dialog){returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;overflow=document.body.style.overflow;document.body.style.overflow='hidden';}dialog=next;for(const e of document.querySelectorAll<HTMLElement>('.header,.workspace,.skip-link'))e.setAttribute('inert','');(next.querySelector<HTMLElement>('h2')??next).setAttribute('tabindex','-1');(next.querySelector<HTMLElement>('h2')??next).focus({preventScroll:true});}
  else if(dialog){dialog=null;document.body.style.overflow=overflow;for(const e of document.querySelectorAll<HTMLElement>('[inert]'))e.removeAttribute('inert');if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;}
 };
 const key=(e:KeyboardEvent)=>{if(e.key!=='Tab'||!dialog)return;const list=focusable();if(!list.length){e.preventDefault();dialog.focus();return;}const first=list[0],last=list[list.length-1],active=document.activeElement;if(e.shiftKey&&(active===first||!list.includes(active as HTMLElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(active===last||!list.includes(active as HTMLElement))){e.preventDefault();first.focus();}};
 const observer=new MutationObserver(sync);observer.observe(root,{childList:true,subtree:true});document.addEventListener('keydown',key,true);sync();
 return ()=>{observer.disconnect();document.removeEventListener('keydown',key,true);if(dialog){dialog=null;document.body.style.overflow=overflow;for(const e of document.querySelectorAll<HTMLElement>('[inert]'))e.removeAttribute('inert');}};
}
