// Model from photos: the visitor adds photos of a home they like (real houses, rooms or generated
// renders), its floor plan, and/or a listing link. /api/photo-design has Claude read the photos into the
// studio's own choices and trace the floor plan into rooms (both at once), and the engine builds the home:
// the plan's exact rooms and size, with the photos' style, cladding, colors, porch, garage and staging.
// Photos are shrunk in the browser first and are never stored by the site.
type Engine={apply_photo(read:string):string;show_status(text:string):void};
type PhotoConfig={available:boolean;signIn:boolean};
type Photo={file:File;url:string};
type Listing={found:boolean;reason:string;address:string;sqftSource?:string;livingAreaSqft:number;bedrooms:number;bathrooms:number;stories:number;yearBuilt:number;description:string;photoUrls:string[];floorPlanUrls:string[]};

const MAX_PHOTOS=8,MAX_PLANS=3,MAX_PDF=3_600_000,KEY_STORE='uf-anthropic-key';
// Vercel accepts request bodies up to 4.5 MB; leave room for JSON and notes.
const BODY_BUDGET=3_600_000;
const SIZES:[number,number][]=[[1568,.85],[1280,.82],[1024,.78],[800,.72]];
// Floor plans keep their dimension labels legible: larger and sharper first.
const PLAN_SIZES:[number,number][]=[[2400,.9],[2000,.88],[1600,.85],[1280,.82]];

function el<K extends keyof HTMLElementTagNameMap>(tag:K,props:Record<string,string>={},...children:(Node|string)[]){const e=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='text')e.textContent=v;else e.setAttribute(k,v);}e.append(...children);return e;}
const storedKey=()=>{try{return localStorage.getItem(KEY_STORE)||'';}catch{return '';}};
const rememberKey=(key:string)=>{try{if(key)localStorage.setItem(KEY_STORE,key);else localStorage.removeItem(KEY_STORE);}catch{}};
async function photoConfig():Promise<PhotoConfig>{
 try{const r=await fetch('/api/config/',{credentials:'same-origin',headers:{Accept:'application/json'}});if(!(r.headers.get('content-type')||'').includes('json'))throw 0;const c=await r.json();return {available:!!c?.photo?.available,signIn:!!c?.photo?.signIn};}
 catch{return {available:false,signIn:false};}
}

/** A photo as JPEG base64, its long edge at most `edge` px. */
async function encode(file:File,edge:number,quality:number):Promise<string>{
 const bitmap=await createImageBitmap(file);
 try{
  const scale=Math.min(1,edge/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  // A CPU-backed canvas: the 3D view keeps the GPU busy, and a GPU canvas readback would wait on it.
  const g=canvas.getContext('2d',{willReadFrequently:true});if(!g)throw new Error('canvas');g.fillStyle='#fff';g.fillRect(0,0,canvas.width,canvas.height);g.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/jpeg',quality));if(!blob)throw new Error('encode');
  const bytes=new Uint8Array(await blob.arrayBuffer());let bin='';for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(bin);
 }finally{bitmap.close();}
}
/** Every photo, shrunk as far as needed for the whole set to fit one request. PDFs (floor plans) go as they are. */
async function encodeAll(photos:Photo[],sizes=SIZES):Promise<{mediaType:string;data:string}[]>{
 const pdfs=await Promise.all(photos.filter(p=>p.file.type==='application/pdf').map(async p=>{if(p.file.size>MAX_PDF)throw new Error(`${p.file.name} is too large. Save the floor plan page as an image, or use a PDF under 3.5 MB.`);const bytes=new Uint8Array(await p.file.arrayBuffer());let bin='';for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return {mediaType:'application/pdf',data:btoa(bin)};}));
 const images=photos.filter(p=>p.file.type!=='application/pdf');const used=pdfs.reduce((n,d)=>n+d.data.length,0);
 for(const [edge,quality] of sizes){let out:string[];try{out=await Promise.all(images.map(p=>encode(p.file,edge,quality)));}catch{throw new Error('One of these pictures could not be opened. Use JPEG, PNG or WebP files.');}if(used+out.reduce((n,d)=>n+d.length,0)<=BODY_BUDGET)return [...pdfs,...out.map(data=>({mediaType:'image/jpeg',data}))];}
 throw new Error('These pictures are too large together. Remove a few and try again.');
}
const post=async(path:string,body:unknown,key:string,signal:AbortSignal)=>{
 const r=await fetch(path,{method:'POST',credentials:'same-origin',signal,headers:{Accept:'application/json','Content-Type':'application/json','X-UF-Request':'1',...(key?{'X-Anthropic-Key':key}:{})},body:JSON.stringify(body)});
 const out=(r.headers.get('content-type')||'').includes('json')?await r.json():null;
 if(!r.ok)throw Object.assign(new Error(out?.error||(r.status===404?'Photo modeling is not available on this site yet.':'The photo reader is unavailable right now. Please try again.')),{status:r.status});
 return out;
};

let open=false;
export async function openPhotoHome(engine:Engine){
 if(open)return;open=true;
 const photos:Photo[]=[],plans:Photo[]=[];let busy:AbortController|null=null,listing:Listing|null=null;
 const shade=el('div',{class:'account-shade'});
 const box=el('section',{class:'account-panel photo-panel',role:'dialog','aria-modal':'true','aria-labelledby':'photo-title'});
 const closeX=el('button',{class:'close-modal',type:'button','aria-label':'Close',text:'×'});
 const input=el('input',{id:'photo-files',type:'file',accept:'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif',multiple:'',class:'visually-hidden'}) as HTMLInputElement;
 const drop=el('label',{class:'photo-drop',for:'photo-files'},el('strong',{text:'Add photos'}),el('span',{text:`Front, sides, rooms or AI renders · up to ${MAX_PHOTOS}`}));
 const grid=el('ul',{class:'photo-grid','aria-label':'Photos to read'});
 const planInput=el('input',{id:'plan-files',type:'file',accept:'image/jpeg,image/png,image/webp,image/gif,application/pdf',multiple:'',class:'visually-hidden'}) as HTMLInputElement;
 const planDrop=el('label',{class:'photo-drop plan-drop',for:'plan-files'},el('strong',{text:'Add floor plan'}),el('span',{text:'Listing floor plan, blueprint or sketch · image or PDF · one per floor'}));
 const planGrid=el('ul',{class:'photo-grid','aria-label':'Floor plans to trace'});
 const link=el('input',{id:'photo-link',type:'url',inputmode:'url',autocomplete:'off',placeholder:'https://www.zillow.com/homedetails/…'}) as HTMLInputElement;
 const find=el('button',{class:'button secondary',type:'button',text:'Find photos'}) as HTMLButtonElement;
 const found=el('p',{class:'account-muted photo-found',role:'status'});
 const linkBox=el('div',{class:'photo-link'},el('label',{class:'field',for:'photo-link'},'Listing link (optional)',el('span',{class:'photo-link-row'},link,find)),found);
 const notes=el('textarea',{id:'photo-notes',maxlength:'500',rows:'2',placeholder:'Optional: anything to keep, e.g. four bedrooms, no garage'}) as HTMLTextAreaElement;
 const keyInput=el('input',{id:'photo-key',type:'password',autocomplete:'off',spellcheck:'false',placeholder:'sk-ant-…',value:storedKey()}) as HTMLInputElement;
 const remember=el('input',{id:'photo-remember',type:'checkbox'}) as HTMLInputElement;remember.checked=!!storedKey();
 const keyBox=el('details',{class:'photo-key'},el('summary',{text:'Use my own Anthropic API key'}),
  el('label',{class:'field',for:'photo-key'},'Anthropic API key',keyInput),
  el('label',{class:'check',for:'photo-remember'},remember,'Remember this key on this device'),
  el('p',{class:'account-muted'},'Your key is sent with this request only and never stored by the site. Create one in the ',el('a',{href:'https://console.anthropic.com/settings/keys',target:'_blank',rel:'noopener noreferrer',text:'Claude Console'}),'.'));
 const status=el('p',{class:'photo-status',role:'status','aria-live':'polite'});
 const result=el('div',{class:'photo-result'});
 const go=el('button',{class:'button primary',type:'button',text:'Build my home'}) as HTMLButtonElement;
 const cancel=el('button',{class:'button secondary',type:'button',text:'Cancel'}) as HTMLButtonElement;
 box.append(el('header',{class:'photo-head'},el('div',{},el('h2',{id:'photo-title',text:'Model a home from photos'}),el('p',{class:'account-muted',text:'Add photos, the floor plan, or a listing link. The floor plan sets the exact size and every room and wall; the photos set the style, colors, porch, garage and staging.'})),closeX),
  linkBox,input,drop,grid,planInput,planDrop,planGrid,el('label',{class:'field',for:'photo-notes'},'Notes',notes),keyBox,status,result,el('div',{class:'account-actions'},go,cancel),
  el('p',{class:'account-muted photo-fine',text:'Photos are sent to Anthropic to be read and are not saved by this site. The result is a starting design: an engineer and your local building department still review every plan.'}));
 shade.append(box);document.body.append(shade);document.documentElement.classList.add('account-modal-open');
 // The dialog covers the studio: pause the 3D view so photo shrinking and reading get the device to themselves.
 (globalThis as any).__ufPauseScene=true;

 const close=()=>{busy?.abort();[...photos,...plans].forEach(p=>URL.revokeObjectURL(p.url));shade.remove();document.removeEventListener('keydown',keys);document.documentElement.classList.remove('account-modal-open');(globalThis as any).__ufPauseScene=false;window.dispatchEvent(new KeyboardEvent('keydown'));open=false;document.querySelector<HTMLElement>('[data-action="photo-home"]')?.focus();};
 const keys=(e:KeyboardEvent)=>{if(e.key==='Escape'){close();return}if(e.key!=='Tab')return;const items=[...box.querySelectorAll<HTMLElement>('button,input:not(.visually-hidden),textarea,summary,a[href],label.photo-drop')].filter(x=>!x.hasAttribute('disabled')&&x.getClientRects().length>0);if(!items.length)return;const first=items[0]!,last=items[items.length-1]!,active=document.activeElement as HTMLElement|null;if(e.shiftKey&&active===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&active===last){e.preventDefault();first.focus();}};
 document.addEventListener('keydown',keys);closeX.onclick=close;cancel.onclick=close;shade.addEventListener('click',e=>{if(e.target===shade&&!busy)close();});
 for(const [zone,picker] of [[drop,input],[planDrop,planInput]] as const){zone.tabIndex=0;zone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();picker.click();}});}

 const say=(text:string,error=false)=>{status.textContent=text;status.classList.toggle('error',error);};
 const tiles=(list:Photo[],label:string)=>list.map((p,i)=>{const del=el('button',{type:'button','aria-label':`Remove ${label} ${i+1}`,text:'×'});del.onclick=()=>{URL.revokeObjectURL(p.url);list.splice(i,1);draw();};
  return el('li',{},p.file.type==='application/pdf'?el('span',{class:'photo-pdf',text:`PDF · ${p.file.name}`}):el('img',{src:p.url,alt:`${label} ${i+1}: ${p.file.name}`}),del);});
 const sources=()=>photos.length+plans.length+(listing?listing.photoUrls.length+listing.floorPlanUrls.length+(listing.livingAreaSqft?1:0):0);
 const draw=()=>{grid.replaceChildren(...tiles(photos,'photo'));planGrid.replaceChildren(...tiles(plans,'floor plan'));
  drop.classList.toggle('full',photos.length>=MAX_PHOTOS);planDrop.classList.toggle('full',plans.length>=MAX_PLANS);go.disabled=!sources()||!!busy;find.disabled=!!busy;};
 const add=(list:Photo[],max:number,files:FileList|File[],pdf:boolean)=>{let skipped=0;for(const f of Array.from(files)){if(!f.type.startsWith('image/')&&!(pdf&&f.type==='application/pdf')){skipped++;continue}if(list.length>=max){say(`Up to ${max} at a time.`);break}list.push({file:f,url:URL.createObjectURL(f)});}if(skipped)say(pdf?'Floor plans can be images or PDFs.':'Only image files can be read.',true);draw();};
 for(const [zone,picker,list,max,pdf] of [[drop,input,photos,MAX_PHOTOS,false],[planDrop,planInput,plans,MAX_PLANS,true]] as const){
  picker.onchange=()=>{if(picker.files)add(list,max,picker.files,pdf);picker.value='';};
  zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('over');});zone.addEventListener('dragleave',()=>zone.classList.remove('over'));
  zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('over');if(e.dataTransfer?.files)add(list,max,e.dataTransfer.files,pdf);});}
 draw();

 const config=await photoConfig();
 if(!config.available){keyBox.open=true;keyBox.querySelector('summary')!.textContent='Anthropic API key (needed to read photos)';}
 else if(config.signIn)keyBox.after(el('p',{class:'account-muted',text:'Signed-in visitors use this site’s photo reader. Not signed in? Add your own key above.'}));

 // The key to use, or null after telling the visitor what is missing.
 const keyFor=()=>{const key=keyInput.value.trim();
  if(key&&!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key)){keyBox.open=true;say('That does not look like an Anthropic API key (it starts with sk-ant-).',true);keyInput.focus();return null}
  if(!key&&!config.available){keyBox.open=true;say('Add an Anthropic API key to read photos.',true);keyInput.focus();return null}
  rememberKey(remember.checked?key:'');return key;};
 const fail=(e:any)=>{if(e?.status===401||e?.status===503)keyBox.open=true;};
 const findPhotos=async()=>{
  if(busy)return;const url=link.value.trim();if(!/^https:\/\/\S+\.\S+/.test(url)){say('Paste the full https:// link to the listing.',true);link.focus();return}
  const key=keyFor();if(key===null)return;
  busy=new AbortController();box.classList.add('working');draw();listing=null;found.textContent='';
  try{say('Opening the listing… this usually takes 10–30 seconds.');const out=await post('/api/listing/',{url},key,busy.signal);const l=out?.listing as Listing;
   const size=(x:Listing)=>[x.address,x.livingAreaSqft&&`${Math.round(x.livingAreaSqft).toLocaleString()} sq ft`,x.bedrooms&&`${x.bedrooms} bd`,x.bathrooms&&`${x.bathrooms} ba`].filter(Boolean).join(' · ');
   if(!l?.found){
    // The page was blocked, but facts found for its address still size the home.
    if(l?.livingAreaSqft){listing={...l,photoUrls:[],floorPlanUrls:[]};found.textContent=`The listing page could not be opened, but its size was found${l.sqftSource?` (${l.sqftSource})`:''}: ${size(l)}. Save the listing's photos and floor plan and add them below.`;}
    else found.textContent=`${l?.reason||'The listing could not be read.'} Save its photos and floor plan from the page and add them below.`;
    say('');draw();return}
   listing=l;const facts=size(l);
   found.textContent=`Found ${l.photoUrls.length} photo${l.photoUrls.length===1?'':'s'} and ${l.floorPlanUrls.length||'no'} floor plan${l.floorPlanUrls.length===1?'':'s'}${facts?` · ${facts}`:''}. They are added to your build.`;say('');}
  catch(e:any){if(e?.name==='AbortError')return;fail(e);say(e?.message||'The listing could not be read.',true);}
  finally{busy=null;box.classList.remove('working');draw();}
 };
 find.onclick=findPhotos;link.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();findPhotos();}});

 go.onclick=async()=>{
  if(!sources()||busy)return;
  const key=keyFor();if(key===null)return;
  busy=new AbortController();draw();result.replaceChildren();box.classList.add('working');
  try{
   say('Preparing your pictures…');
   const [photoData,planData]=await Promise.all([encodeAll(photos),encodeAll(plans,PLAN_SIZES)]);
   const photoUrls=(listing?.photoUrls||[]).slice(0,Math.max(0,12-photoData.length)),planUrls=listing?.floorPlanUrls||[];
   const facts=listing?{livingAreaSqft:listing.livingAreaSqft,bedrooms:listing.bedrooms,bathrooms:listing.bathrooms,stories:listing.stories,yearBuilt:listing.yearBuilt,description:listing.description}:undefined;
   const hasPhotos=photoData.length+photoUrls.length>0,hasPlan=planData.length+planUrls.length>0;
   say(`Reading ${[hasPhotos&&'the photos',hasPlan&&'the floor plan'].filter(Boolean).join(' and ')}… this usually takes 20–60 seconds.`);
   // The photos and the floor plan are read at the same time; either one alone still builds a home.
   const signal=busy.signal;
   const [home,plan]=await Promise.allSettled([
    hasPhotos?post('/api/photo-design/',{task:'home',photos:photoData,imageUrls:photoUrls,listing:facts,notes:notes.value},key,signal):Promise.resolve(null),
    hasPlan?post('/api/photo-design/',{task:'plan',photos:planData,imageUrls:planUrls,notes:notes.value},key,signal):Promise.resolve(null)]);
   for(const r of [home,plan])if(r.status==='rejected'&&r.reason?.name==='AbortError')return;
   const homeRead=home.status==='fulfilled'?home.value?.read:null,planRead=plan.status==='fulfilled'?plan.value?.read:null;
   const problems:string[]=[];
   if(home.status==='rejected'){fail(home.reason);problems.push(`The photos could not be read: ${home.reason?.message||'unknown error'}`);}
   if(plan.status==='rejected'){fail(plan.reason);problems.push(`The floor plan could not be read: ${plan.reason?.message||'unknown error'}`);}
   else if(planRead&&!planRead.found)problems.push('No floor plan was found in those pictures, so the rooms follow the style\u2019s plan.');
   if(!homeRead&&!planRead?.found&&!listing?.livingAreaSqft)throw new Error(problems.join(' ')||'Nothing could be read from those pictures.');
   const read={...(homeRead||{}),...(planRead?.found?{floorPlan:planRead}:{}),
    ...(!homeRead?.livingAreaSqft&&listing?.livingAreaSqft?{livingAreaSqft:listing.livingAreaSqft}:{}),...(!homeRead&&listing?.stories?{stories:listing.stories}:{}),...(!homeRead&&listing?.bedrooms?{bedrooms:listing.bedrooms}:{})};
   say('Building your home…');
   const built=JSON.parse(engine.apply_photo(JSON.stringify(read))) as {ok:boolean;notes?:string[];error?:string};
   if(!built.ok)throw new Error(built.error||'The studio could not build that home.');
   const extra=[...(Array.isArray(homeRead?.notes)?homeRead.notes:[]),...(Array.isArray(planRead?.notes)?planRead.notes:[])].filter((n:unknown)=>typeof n==='string'&&n.trim()).slice(0,8);
   const [headline,...adjusted]=[...(built.notes||[]),...problems];
   result.replaceChildren(el('h3',{text:headline||'Your home is ready'}),...(typeof homeRead?.summary==='string'?[el('p',{text:homeRead.summary})]:[]),
    ...([...adjusted,...extra].length?[el('ul',{},...[...adjusted,...extra].map(n=>el('li',{text:String(n)})))]:[]),
    el('p',{class:'account-muted',text:'Everything stays editable in Layout and Finishes. Undo returns to your previous design.'}));
   say('Done. Your home is in the studio.');engine.show_status(planRead?.found?'Built your home from its floor plan and photos. Undo returns to your previous design.':'Built a home from your photos. Undo returns to your previous design.');
   go.textContent='Read again';cancel.textContent='Close';cancel.focus();
  }catch(e:any){if(e?.name==='AbortError')return;say(e?.message||'Something went wrong. Please try again.',true);}
  finally{busy=null;box.classList.remove('working');draw();}
 };
 link.focus();
}
