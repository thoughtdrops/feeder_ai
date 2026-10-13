// Accounts: sign in with Google, a profile panel, and saved builds. Signed-in builds live in the visitor's
// profile on the server (/api/builds); without an account they are kept in this browser. When the site
// has no accounts configured (no /api), everything works locally and no sign-in is offered.
type User={name:string;email:string;picture?:string};
type BuildMeta={id:string;name:string;updated:string;summary?:string};
type LocalBuild=BuildMeta&{design:unknown};
type Engine={load_design(json:string):boolean;set_units(metric:boolean):void;show_status(text:string):void};

const LOCAL_KEY='uf-builds',WELCOME_KEY='uf-welcome-done',LOCAL_LIMIT=20;
let engine:Engine|undefined,user:User|null=null,accounts=false,clientId='',currentBuild:string|null=null,gisReady:Promise<void>|undefined;

function el<K extends keyof HTMLElementTagNameMap>(tag:K,props:Record<string,string>={},...children:(Node|string)[]){const e=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='text')e.textContent=v;else e.setAttribute(k,v);}e.append(...children);return e;}
async function api<T>(path:string,init:RequestInit={}):Promise<T>{
 const mutate=init.method&&init.method!=='GET';
 const r=await fetch(path,{credentials:'same-origin',...init,headers:{Accept:'application/json',...(init.body?{'Content-Type':'application/json'}:{}),...(mutate?{'X-UF-Request':'1'}:{}),...(init.headers||{})}});
 if(r.status===204)return undefined as T;
 const type=r.headers.get('content-type')||'';if(!type.includes('application/json'))throw new Error('Accounts are unavailable');
 const body=await r.json();if(!r.ok)throw Object.assign(new Error(body?.error||'Request failed'),{status:r.status});return body as T;
}
const store={
 read():LocalBuild[]{try{const v=JSON.parse(localStorage.getItem(LOCAL_KEY)||'[]');return Array.isArray(v)?v:[];}catch{return [];}},
 write(list:LocalBuild[]){try{localStorage.setItem(LOCAL_KEY,JSON.stringify(list.slice(0,LOCAL_LIMIT)));return true;}catch{return false;}},
};
let queued='';const say=(text:string)=>{if(engine)engine.show_status(text);else queued=text;};
const firstName=(u:User)=>(u.name||u.email||'').split(/\s+/)[0]||'Profile';
const when=(iso:string)=>{const d=new Date(iso);return Number.isNaN(d.getTime())?'':d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})+' · '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});};

// ---------- Google Identity Services ----------
function loadGoogle(){
 gisReady??=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=()=>{const g=(window as any).google;if(!g?.accounts?.id){gisReady=undefined;reject(new Error('Google sign-in did not load'));return;}g.accounts.id.initialize({client_id:clientId,callback:onCredential,ux_mode:'popup',auto_select:false,cancel_on_tap_outside:true,use_fedcm_for_prompt:true});resolve();};s.onerror=()=>{s.remove();gisReady=undefined;reject(new Error('Google sign-in could not load'));};document.head.appendChild(s);});
 return gisReady;
}
async function googleButton(host:HTMLElement,width=280){
 host.replaceChildren(el('span',{class:'account-muted',text:'Loading Google sign-in…'}));
 try{await loadGoogle();host.replaceChildren();(window as any).google.accounts.id.renderButton(host,{type:'standard',theme:'filled_black',size:'large',shape:'pill',text:'continue_with',logo_alignment:'left',width});}
 catch{host.replaceChildren(el('span',{class:'account-muted',text:'Google sign-in is unavailable right now. Your builds are still saved in this browser.'}));}
}
async function onCredential(response:{credential?:string}){
 if(!response?.credential)return;
 try{const r=await api<{user:User}>('/api/auth/google/',{method:'POST',body:JSON.stringify({credential:response.credential})});user=r.user;
  try{localStorage.setItem(WELCOME_KEY,'1');}catch{}leaveWelcome();renderProfileButton();await carryLocalBuilds();if(panel?.isConnected)renderPanel();say(`Signed in as ${user.name||user.email}. Your builds now save to your profile.`);}
 catch(e:any){say(e?.message?`Sign-in failed: ${e.message}`:'Sign-in failed. Please try again.');}
}
async function carryLocalBuilds(){
 const local=store.read();if(!user||!local.length)return;let moved=0;
 for(const b of local){try{await api('/api/builds/',{method:'POST',body:JSON.stringify({name:b.name,summary:b.summary||'',design:b.design})});moved++;}catch{break;}}
 if(moved){store.write(local.slice(moved));say(`${moved} build${moved===1?'':'s'} from this browser ${moved===1?'was':'were'} added to your profile.`);}
}

// ---------- Saved builds ----------
async function listBuilds():Promise<(BuildMeta&{local?:boolean})[]>{
 const local=store.read().map(({design:_d,...m})=>({...m,local:true}));
 if(!user)return local;
 try{const r=await api<{builds:BuildMeta[]}>('/api/builds/');return [...r.builds,...local];}catch(e:any){if(e?.status===401){user=null;renderProfileButton();}return local;}
}
async function openBuild(meta:BuildMeta&{local?:boolean}){
 try{const design=meta.local?store.read().find(b=>b.id===meta.id)?.design:(await api<{build:{design:unknown}}>(`/api/builds/?id=${encodeURIComponent(meta.id)}`)).build.design;
  if(!design||!engine?.load_design(JSON.stringify(design))){say('That build could not be opened.');return;}
  currentBuild=meta.local?null:meta.id;closePanel();say(`Opened “${meta.name}”.`);}
 catch{say('That build could not be opened. Check your connection and try again.');}
}
async function deleteBuild(meta:BuildMeta&{local?:boolean}){
 if(!confirm(`Delete “${meta.name}”? This cannot be undone.`))return;
 if(meta.local)store.write(store.read().filter(b=>b.id!==meta.id));
 else{try{await api(`/api/builds/?id=${encodeURIComponent(meta.id)}`,{method:'DELETE'});}catch{say('That build could not be deleted. Please try again.');return;}}
 if(currentBuild===meta.id)currentBuild=null;renderPanel();
}
// Dialogs are modal: Tab stays inside, and the page behind doesn't scroll.
const modalOpen=(on:boolean)=>document.documentElement.classList.toggle('account-modal-open',on);
function trap(box:HTMLElement,e:KeyboardEvent){if(e.key!=='Tab')return;const items=[...box.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],iframe,[tabindex]:not([tabindex="-1"])')].filter(x=>!x.hasAttribute('disabled')&&x.getClientRects().length>0);if(!items.length)return;
 const first=items[0]!,last=items[items.length-1]!,active=document.activeElement as HTMLElement|null;if(!active||!box.contains(active)){e.preventDefault();first.focus();}else if(e.shiftKey&&active===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&active===last){e.preventDefault();first.focus();}}
let pending:{design:string;summary:string}|null=null;
function saveDialog(design:string,summary:string){
 pending={design,summary};
 const shade=el('div',{class:'account-shade'});const box=el('section',{class:'account-panel save-panel',role:'dialog','aria-modal':'true','aria-labelledby':'save-title'});
 const input=el('input',{id:'save-name',type:'text',maxlength:'80',value:summary.split(' · ').slice(0,2).join(' · ')||'My build','aria-describedby':'save-where'}) as HTMLInputElement;
 const where=el('p',{id:'save-where',class:'account-muted',text:user?`Saved to ${user.email}'s profile, available on any device you sign in on.`:accounts?'Saved in this browser. Sign in with Google to keep builds in your profile on every device.':'Saved in this browser.'});
 const actions=el('div',{class:'account-actions'});
 const save=async(asNew:boolean)=>{const name=input.value.trim().replace(/[\u0000-\u001f]/g,'').slice(0,80);if(!name){input.focus();return;}const design=JSON.parse(pending!.design);
  let failed='';
  if(user){try{const r=await api<{build:BuildMeta}>('/api/builds/',{method:'POST',body:JSON.stringify({...(asNew||!currentBuild?{}:{id:currentBuild}),name,summary:pending!.summary,design})});currentBuild=r.build.id;close();say(`Saved “${name}” to your profile.`);return;}
   catch(e:any){if(e?.status!==401)failed=e?.status===409?'Your profile already holds 50 builds.':e?.status===413?'This build is too large for your profile.':'Your profile could not be reached.';else{user=null;renderProfileButton();}}}
  // The browser keeps up to 20 builds; a full list is never trimmed silently.
  const list=store.read();if(list.length>=LOCAL_LIMIT){say(`${failed?failed+' ':''}This browser already holds ${LOCAL_LIMIT} builds. Delete one in My builds to save another.`);return;}
  const id=(crypto as any).randomUUID?.()||String(Date.now());list.unshift({id,name,updated:new Date().toISOString(),summary:pending!.summary,design});if(!store.write(list)){say(`${failed?failed+' ':''}This browser has no room to save builds.`);return;}close();say(failed?`${failed} Saved “${name}” in this browser instead.`:`Saved “${name}” in this browser.`);};
 const close=()=>{shade.remove();pending=null;document.removeEventListener('keydown',esc);if(!panel)modalOpen(false);};
 const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')close();else trap(box,e);};document.addEventListener('keydown',esc);modalOpen(true);
 if(user&&currentBuild){actions.append(el('button',{class:'button primary',type:'button',text:'Update this build'}),el('button',{class:'button secondary',type:'button',text:'Save as new'}));(actions.children[0] as HTMLElement).onclick=()=>save(false);(actions.children[1] as HTMLElement).onclick=()=>save(true);}
 else{const b=el('button',{class:'button primary',type:'button',text:'Save build'});b.onclick=()=>save(true);actions.append(b);}
 const cancel=el('button',{class:'button secondary',type:'button',text:'Cancel'});cancel.onclick=close;actions.append(cancel);
 input.addEventListener('keydown',e=>{if(e.key==='Enter')(actions.firstElementChild as HTMLElement).click();});
 box.append(el('h2',{id:'save-title',text:'Save build'}),el('p',{class:'account-muted',text:summary}),el('label',{class:'field',for:'save-name'},'Build name',input),where,actions);
 shade.append(box);shade.addEventListener('click',e=>{if(e.target===shade)close();});document.body.append(shade);input.select();input.focus();
}

// ---------- Profile button and panel ----------
let panel:HTMLElement|null=null,shadeEl:HTMLElement|null=null,trigger:HTMLButtonElement|null=null;
function avatar(u:User|null){
 if(u?.picture){const img=el('img',{src:u.picture,alt:'',width:'32',height:'32',referrerpolicy:'no-referrer'});img.onerror=()=>img.replaceWith(el('span',{class:'avatar-initial',text:(u.name||u.email||'?')[0]!.toUpperCase()}));return img;}
 if(u)return el('span',{class:'avatar-initial',text:(u.name||u.email||'?')[0]!.toUpperCase()});
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.innerHTML='<circle cx="12" cy="8.5" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 20c1.4-3.6 4.3-5.4 7.5-5.4s6.1 1.8 7.5 5.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';return svg;
}
function renderProfileButton(){
 const slot=document.querySelector('.header-left');if(!slot)return;
 trigger??=el('button',{class:'profile-button',type:'button','aria-haspopup':'dialog','aria-expanded':'false'}) as HTMLButtonElement;
 trigger.onclick=()=>openPanel();
 trigger.replaceChildren(el('span',{class:'profile-avatar'},avatar(user)),el('span',{class:'profile-label',text:user?firstName(user):accounts?'Sign in':'Profile'}));
 trigger.setAttribute('aria-label',user?`Profile: ${user.name||user.email}`:'Profile and saved builds');
 if(trigger.parentElement!==slot){slot.replaceChildren(trigger);slot.classList.add('has-profile');}
}
function closePanel(){shadeEl?.remove();shadeEl=null;panel=null;if(!pending)modalOpen(false);trigger?.setAttribute('aria-expanded','false');document.removeEventListener('keydown',panelKeys);trigger?.focus();}
const panelKeys=(e:KeyboardEvent)=>{if(pending)return;if(e.key==='Escape')closePanel();else if(panel)trap(panel,e);};
function openPanel(focusBuilds=false){
 if(panel){if(focusBuilds)panel.querySelector('.build-list')?.scrollIntoView({block:'nearest'});return;}
 shadeEl=el('div',{class:'account-shade'});panel=el('section',{class:'account-panel profile-panel',role:'dialog','aria-modal':'true','aria-labelledby':'profile-title'});
 shadeEl.append(panel);shadeEl.addEventListener('click',e=>{if(e.target===shadeEl)closePanel();});document.body.append(shadeEl);document.addEventListener('keydown',panelKeys);modalOpen(true);trigger?.setAttribute('aria-expanded','true');
 renderPanel(focusBuilds);
}
async function renderPanel(focusBuilds=false){
 if(!panel)return;const p=panel;
 const close=el('button',{class:'close-modal',type:'button','aria-label':'Close profile',text:'×'});close.onclick=closePanel;
 const head=el('header',{class:'profile-head'},el('span',{class:'profile-avatar large'},avatar(user)),el('div',{},el('h2',{id:'profile-title',text:user?user.name||'Your profile':'Your profile'}),el('p',{class:'account-muted',text:user?user.email:accounts?'Sign in with Google to save builds to your profile and open them on any device.':'Builds you save are kept in this browser.'})),close);
 const body:Node[]=[head];
 if(!user&&accounts){const g=el('div',{class:'google-slot'});body.push(g);googleButton(g);}
 // units
 const metric=!!(globalThis as any).ufUnits?.metric();const units=el('div',{class:'units-switch',role:'group','aria-label':'Measurement units'},el('span',{text:'Units'}));
 for(const [value,label] of [['imperial','American · ft, in'],['metric','Metric · m, mm']] as const){const b=el('button',{type:'button','aria-pressed':String((value==='metric')===metric),text:label});b.onclick=()=>{engine?.set_units(value==='metric');(globalThis as any).ufBridge?.unitsChanged(value==='metric');renderPanel();};units.append(b);}
 body.push(units);
 // builds
 const save=el('button',{class:'button primary',type:'button',text:'Save current build'});save.onclick=()=>{closePanel();document.querySelector<HTMLElement>('[data-action="save-build"]')?.click();};
 const list=el('ul',{class:'build-list','aria-label':'Saved builds'},el('li',{class:'account-muted',text:'Loading your builds…'}));
 body.push(el('div',{class:'profile-section'},el('div',{class:'profile-section-head'},el('h3',{text:'Saved builds'}),save),list));
 if(user){const out=el('button',{class:'button secondary',type:'button',text:'Sign out'});out.onclick=async()=>{try{await api('/api/auth/logout/',{method:'POST'});}catch{}(window as any).google?.accounts?.id?.disableAutoSelect?.();user=null;currentBuild=null;renderProfileButton();renderPanel();say('Signed out.');};body.push(el('div',{class:'account-actions end'},out));}
 p.replaceChildren(...body);
 const builds=await listBuilds();if(panel!==p)return;
 list.replaceChildren(...(builds.length?builds.map(b=>{const open=el('button',{class:'button secondary',type:'button',text:'Open'});open.onclick=()=>openBuild(b);const del=el('button',{class:'button ghost',type:'button','aria-label':`Delete ${b.name}`,text:'Delete'});del.onclick=()=>deleteBuild(b);
  return el('li',{class:'build-item'+(b.id===currentBuild?' current':'')},el('div',{class:'build-text'},el('strong',{text:b.name}),el('span',{class:'account-muted',text:[(globalThis as any).ufUnits?.text(b.summary||'')??b.summary,when(b.updated),b.local?'this browser':''].filter(Boolean).join(' · ')})),el('div',{class:'build-actions'},open,del));}):[el('li',{class:'account-muted',text:'No saved builds yet. Use “Save build” to keep this design.'})]));
 if(focusBuilds)list.scrollIntoView({block:'nearest'});
 (p.querySelector('.close-modal') as HTMLElement)?.focus();
}

// ---------- Loading + sign-in screen ----------
// The loading screen doubles as the sign-in screen: account status is fetched while the engine loads, and a
// visitor who isn't signed in sees "Continue with Google" / "Explore without an account" right on it. The
// studio opens once the engine is ready and they have chosen (or immediately, when no choice is needed).
const boot:Promise<void>=(async()=>{
 try{const c=await api<{accounts:boolean;googleClientId:string|null}>('/api/config/');accounts=!!c.accounts&&!!c.googleClientId;clientId=c.googleClientId||'';}catch{accounts=false;}
 if(accounts){try{user=(await api<{user:User}>('/api/auth/me/')).user;}catch{user=null;}}
})();
let gate:'none'|'waiting'|'chosen'='none',engineReady=false,finishSplash:(()=>void)|null=null;
function leaveWelcome(){
 if(gate!=='waiting')return;gate='chosen';
 const splash=document.getElementById('splash');splash?.querySelector('.welcome-choice')?.remove();
 if(engineReady){finishSplash?.();finishSplash=null;}
 else if(splash){splash.classList.remove('welcome');splash.setAttribute('role','status');splash.removeAttribute('aria-modal');}
}
function showWelcome(){
 const splash=document.getElementById('splash');if(!splash||splash.classList.contains('done')||gate!=='none')return false;
 let seen=false;try{seen=localStorage.getItem(WELCOME_KEY)==='1';}catch{}
 if(!accounts||user||seen)return false;
 gate='waiting';
 const g=el('div',{class:'google-slot'});const skip=el('button',{class:'welcome-skip',type:'button',text:'Explore without an account'});
 skip.onclick=()=>{try{localStorage.setItem(WELCOME_KEY,'1');}catch{}leaveWelcome();};
 splash.classList.add('welcome');splash.setAttribute('role','dialog');splash.setAttribute('aria-modal','true');splash.setAttribute('aria-labelledby','welcome-title');
 splash.querySelector('img')?.after(el('div',{class:'welcome-choice'},
  el('h1',{id:'welcome-title',text:'Design your home. Keep every build.'}),
  el('p',{text:'Sign in with Google: no forms, no passwords. Your builds save to your profile and open on any device.'}),g,skip));
 googleButton(g,300);return true;
}
// Show the sign-in choice on the loading screen as soon as account status is known (never after 4 s, so a
// slow network can't pop it up over a studio that is already open).
export function prepareSplash(){Promise.race([boot.then(()=>true),new Promise<boolean>(r=>setTimeout(()=>r(false),4000))]).then(known=>{if(known&&!engineReady)showWelcome();});}

export async function initAccounts(app:Engine,finish:()=>void){
 engine=app;engineReady=true;finishSplash=finish;renderProfileButton();
 const known=await Promise.race([boot.then(()=>true),new Promise<boolean>(r=>setTimeout(()=>r(false),1500))]);
 if(known&&gate==='none')showWelcome();
 if(gate==='waiting'){const splash=document.getElementById('splash');splash?.querySelector('.splash-bar')?.remove();const note=splash?.querySelector(':scope > p');if(note)note.textContent='Your studio is ready';}
 else{finishSplash?.();finishSplash=null;}
 await boot;renderProfileButton();if(queued){say(queued);queued='';}
}
export function saveBuild(design:string,summary:string){saveDialog(design,summary);}
export function openBuilds(){openPanel(true);}
