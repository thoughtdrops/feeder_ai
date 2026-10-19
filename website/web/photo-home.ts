// Model from photos: the visitor adds photos of a home they like (real houses, rooms or generated
// renders). /api/photo-design has Claude read them into the studio's own choices, and the engine builds
// a simpler, buildable rendition with the same style, size, roof, cladding, colors, porch, garage and
// staging. Photos are shrunk in the browser first and are never stored by the site.
type Engine={apply_photo(read:string):string;show_status(text:string):void};
type PhotoConfig={available:boolean;signIn:boolean};
type Photo={file:File;url:string};

const MAX_PHOTOS=8,KEY_STORE='uf-anthropic-key';
// Vercel accepts request bodies up to 4.5 MB; leave room for JSON and notes.
const BODY_BUDGET=3_600_000;
const SIZES:[number,number][]=[[1568,.85],[1280,.82],[1024,.78],[800,.72]];

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
/** Every photo, shrunk as far as needed for the whole set to fit one request. */
async function encodeAll(photos:Photo[]):Promise<string[]>{
 for(const [edge,quality] of SIZES){const out=await Promise.all(photos.map(p=>encode(p.file,edge,quality)));if(out.reduce((n,d)=>n+d.length,0)<=BODY_BUDGET)return out;}
 throw new Error('These photos are too large together. Remove a few and try again.');
}

let open=false;
export async function openPhotoHome(engine:Engine){
 if(open)return;open=true;
 const photos:Photo[]=[];let busy:AbortController|null=null;
 const shade=el('div',{class:'account-shade'});
 const box=el('section',{class:'account-panel photo-panel',role:'dialog','aria-modal':'true','aria-labelledby':'photo-title'});
 const closeX=el('button',{class:'close-modal',type:'button','aria-label':'Close',text:'×'});
 const input=el('input',{id:'photo-files',type:'file',accept:'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif',multiple:'',class:'visually-hidden'}) as HTMLInputElement;
 const drop=el('label',{class:'photo-drop',for:'photo-files'},el('strong',{text:'Add photos'}),el('span',{text:`Front, sides, rooms or AI renders · up to ${MAX_PHOTOS}`}));
 const grid=el('ul',{class:'photo-grid','aria-label':'Photos to read'});
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
 box.append(el('header',{class:'photo-head'},el('div',{},el('h2',{id:'photo-title',text:'Model a home from photos'}),el('p',{class:'account-muted',text:'Claude reads the style, size, roof, cladding, colors, porch, garage and room staging, and the studio builds a simpler, buildable version you can keep editing.'})),closeX),
  input,drop,grid,el('label',{class:'field',for:'photo-notes'},'Notes',notes),keyBox,status,result,el('div',{class:'account-actions'},go,cancel),
  el('p',{class:'account-muted photo-fine',text:'Photos are sent to Anthropic to be read and are not saved by this site. The result is a starting design: an engineer and your local building department still review every plan.'}));
 shade.append(box);document.body.append(shade);document.documentElement.classList.add('account-modal-open');
 // The dialog covers the studio: pause the 3D view so photo shrinking and reading get the device to themselves.
 (globalThis as any).__ufPauseScene=true;

 const close=()=>{busy?.abort();photos.forEach(p=>URL.revokeObjectURL(p.url));shade.remove();document.removeEventListener('keydown',keys);document.documentElement.classList.remove('account-modal-open');(globalThis as any).__ufPauseScene=false;window.dispatchEvent(new KeyboardEvent('keydown'));open=false;document.querySelector<HTMLElement>('[data-action="photo-home"]')?.focus();};
 const keys=(e:KeyboardEvent)=>{if(e.key==='Escape'){close();return}if(e.key!=='Tab')return;const items=[...box.querySelectorAll<HTMLElement>('button,input:not(.visually-hidden),textarea,summary,a[href],label.photo-drop')].filter(x=>!x.hasAttribute('disabled')&&x.getClientRects().length>0);if(!items.length)return;const first=items[0]!,last=items[items.length-1]!,active=document.activeElement as HTMLElement|null;if(e.shiftKey&&active===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&active===last){e.preventDefault();first.focus();}};
 document.addEventListener('keydown',keys);closeX.onclick=close;cancel.onclick=close;shade.addEventListener('click',e=>{if(e.target===shade&&!busy)close();});
 drop.tabIndex=0;drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.click();}});

 const say=(text:string,error=false)=>{status.textContent=text;status.classList.toggle('error',error);};
 const draw=()=>{grid.replaceChildren(...photos.map((p,i)=>{const del=el('button',{type:'button','aria-label':`Remove photo ${i+1}`,text:'×'});del.onclick=()=>{URL.revokeObjectURL(p.url);photos.splice(i,1);draw();};return el('li',{},el('img',{src:p.url,alt:`Photo ${i+1}: ${p.file.name}`}),del);}));
  drop.classList.toggle('full',photos.length>=MAX_PHOTOS);go.disabled=!photos.length||!!busy;};
 const add=(files:FileList|File[])=>{let skipped=0;for(const f of Array.from(files)){if(!f.type.startsWith('image/')){skipped++;continue}if(photos.length>=MAX_PHOTOS){say(`Up to ${MAX_PHOTOS} photos at a time.`);break}photos.push({file:f,url:URL.createObjectURL(f)});}if(skipped)say('Only image files can be read.',true);draw();};
 input.onchange=()=>{if(input.files)add(input.files);input.value='';};
 drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('over');});drop.addEventListener('dragleave',()=>drop.classList.remove('over'));
 drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');if(e.dataTransfer?.files)add(e.dataTransfer.files);});
 draw();

 const config=await photoConfig();
 if(!config.available){keyBox.open=true;keyBox.querySelector('summary')!.textContent='Anthropic API key (needed to read photos)';}
 else if(config.signIn)keyBox.after(el('p',{class:'account-muted',text:'Signed-in visitors use this site’s photo reader. Not signed in? Add your own key above.'}));

 go.onclick=async()=>{
  if(!photos.length||busy)return;
  const key=keyInput.value.trim();
  if(key&&!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key)){keyBox.open=true;say('That does not look like an Anthropic API key (it starts with sk-ant-).',true);keyInput.focus();return;}
  if(!key&&!config.available){keyBox.open=true;say('Add an Anthropic API key to read photos.',true);keyInput.focus();return;}
  rememberKey(remember.checked?key:'');
  busy=new AbortController();go.disabled=true;result.replaceChildren();box.classList.add('working');
  try{
   say('Preparing your photos…');
   const data=await encodeAll(photos);
   say(`Reading ${photos.length===1?'your photo':`${photos.length} photos`}… this usually takes 20–60 seconds.`);
   const r=await fetch('/api/photo-design/',{method:'POST',credentials:'same-origin',signal:busy.signal,headers:{Accept:'application/json','Content-Type':'application/json','X-UF-Request':'1',...(key?{'X-Anthropic-Key':key}:{})},body:JSON.stringify({photos:data.map(d=>({mediaType:'image/jpeg',data:d})),notes:notes.value})});
   const body=(r.headers.get('content-type')||'').includes('json')?await r.json():null;
   if(!r.ok||!body?.read){if(r.status===401||r.status===503)keyBox.open=true;throw new Error(body?.error||(r.status===404?'Photo modeling is not available on this site yet.':'The photo reader is unavailable right now. Please try again.'));}
   say('Building your home…');
   const built=JSON.parse(engine.apply_photo(JSON.stringify(body.read))) as {ok:boolean;notes?:string[];error?:string};
   if(!built.ok)throw new Error(built.error||'The studio could not build that home.');
   const extra=Array.isArray(body.read.notes)?body.read.notes.filter((n:unknown)=>typeof n==='string'&&n.trim()).slice(0,6):[];
   const [headline,...adjusted]=built.notes||[];
   result.replaceChildren(el('h3',{text:headline||'Your home is ready'}),...(typeof body.read.summary==='string'?[el('p',{text:body.read.summary})]:[]),
    ...([...adjusted,...extra].length?[el('ul',{},...[...adjusted,...extra].map(n=>el('li',{text:String(n)})))]:[]),
    el('p',{class:'account-muted',text:'Everything stays editable in Layout and Finishes. Undo returns to your previous design.'}));
   say('Done. Your home is in the studio.');engine.show_status('Built a home from your photos. Undo returns to your previous design.');
   go.textContent='Read again';cancel.textContent='Close';cancel.focus();
  }catch(e:any){if(e?.name==='AbortError')return;say(e?.message||'Something went wrong. Please try again.',true);}
  finally{busy=null;box.classList.remove('working');draw();}
 };
 drop.focus();
}
