/** The theme is a device preference; it never changes or rebuilds the house. */
export function bindTheme(root:HTMLElement=document.documentElement,doc:Document=document,storage?:Pick<Storage,'getItem'|'setItem'>){
 let saved:string|null=null;
 try{storage??=doc.defaultView?.localStorage;saved=storage?.getItem('uf-theme')??null;}catch{/* Private browsing still supports toggling. */}
 let dark=saved==='dark';
 const apply=()=>{root.dataset.theme=dark?'dark':'light';for(const button of doc.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')){button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');const label=button.querySelector('.theme-label');if(label)label.textContent=dark?'Light mode':'Dark mode';}};
 apply();
 const click=(event:MouseEvent)=>{if(!(event.target instanceof (doc.defaultView!.Element)))return;const button=(event.target as Element).closest('[data-theme-toggle]');if(!button)return;dark=!dark;apply();try{storage?.setItem('uf-theme',dark?'dark':'light');}catch{}};
 doc.addEventListener('click',click);
 return {refresh:apply,dispose(){doc.removeEventListener('click',click);}};
}
