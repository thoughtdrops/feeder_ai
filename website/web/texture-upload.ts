type Pattern={name:string;dataUrl:string;repeatFeet:number};
const MAX_BYTES=12*1024*1024,MAX_ENCODED=200000;
export function validateTextureFile(file:File){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPEG, PNG or WebP image.');
 if(!file.size||file.size>MAX_BYTES)throw Error('Choose an image under 12 MB.');
}
export async function normalizeTexture(file:File,repeatFeet:number):Promise<Pattern>{
 validateTextureFile(file);if(!Number.isFinite(repeatFeet)||repeatFeet<.25||repeatFeet>16)throw Error('Repeat size must be 0.25–16 ft.');
 const url=URL.createObjectURL(file);const image=new Image();
 try{image.src=url;await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('The image could not be decoded.'));});
  if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>64_000_000)throw Error('Choose an image with fewer than 64 million pixels.');
  const canvas=document.createElement('canvas'),context=canvas.getContext('2d');if(!context)throw Error('Image processing is unavailable in this browser.');
  let edge=1024,dataUrl='';
  for(let attempt=0;attempt<6;attempt++){const scale=Math.min(1,edge/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));context.fillStyle='#e1ded4';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);dataUrl=canvas.toDataURL('image/jpeg',.8-attempt*.06);if(dataUrl.length<=MAX_ENCODED)break;edge=Math.round(edge*.8);}
  if(!dataUrl.startsWith('data:image/jpeg;base64,')||dataUrl.length>MAX_ENCODED)throw Error('Choose a smaller or less detailed pattern image.');
  return {name:Array.from(file.name.replace(/[\x00-\x1f\x7f]/g,'')).slice(0,100).join(''),dataUrl,repeatFeet};
 }finally{URL.revokeObjectURL(url);image.src='';}
}
export function bindTextureUploads(app:()=>any){let busy=false;const listener=async(event:Event)=>{
 const input=event.target;if(!(input instanceof HTMLInputElement)||!input.matches('[data-texture-upload]'))return;
 const file=input.files?.[0];if(!file||busy)return;const target=input.dataset.textureUpload!;
 const repeat=Number(document.querySelector<HTMLInputElement>('[data-texture-repeat="'+target+'"]')?.value||2);
 busy=true;input.disabled=true;app()?.show_status('Preparing your repeating texture…');
 try{const pattern=await normalizeTexture(file,repeat);app()?.apply_texture(JSON.stringify({target,pattern}));}
 catch(error){app()?.show_status(error instanceof Error?error.message:'Texture upload failed.');}
 finally{busy=false;input.disabled=false;input.value='';}
 };document.addEventListener('change',listener);return()=>document.removeEventListener('change',listener);}
