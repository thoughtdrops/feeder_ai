// Bakes ez-tree (MIT, Daniel Greenheck) presets into one compact binary for the modeled neighborhood.
// Usage: node scripts/backdrop/bake_trees.mjs <ez-tree src/lib copy> public/neighborhood/trees.bin
// The lib copy needs `.js` on its relative imports, textures.js stubbed (no browser loaders in Node) and the
// app's preset JSONs copied into <lib>/presets. Leaf and bark images are served from public/neighborhood.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const lib=path.resolve(process.argv[2]),out=process.argv[3];
const {Tree}=await import(pathToFileURL(path.join(lib,'tree.js')).href);
const picks=[['oak','oak_large'],['ash','ash_large'],['aspen','aspen_large'],['bush','bush_1']];
const chunks=[];let offset=0;const header={variants:[]};
const push=(typed)=>{const pad=(4-offset%4)%4;if(pad){chunks.push(new Uint8Array(pad));offset+=pad;}const bytes=new Uint8Array(typed.buffer,typed.byteOffset,typed.byteLength);chunks.push(bytes);const at=offset;offset+=bytes.byteLength;return at;};
function pack(g,leaf=false){
 const pos=g.attributes.position.array,nor=g.attributes.normal.array,uv=g.attributes.uv.array,n=pos.length/3;
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<n;i++)for(let k=0;k<3;k++){min[k]=Math.min(min[k],pos[i*3+k]);max[k]=Math.max(max[k],pos[i*3+k]);}
 const q=new Uint16Array(n*3);for(let i=0;i<n;i++)for(let k=0;k<3;k++)q[i*3+k]=Math.round((pos[i*3+k]-min[k])/Math.max(max[k]-min[k],1e-6)*65535);
 // Leaves carry no normals (the viewer derives soft canopy normals) and only 0/1 corner UVs.
 const qn=leaf?null:new Int8Array(n*3);if(qn)for(let i=0;i<n*3;i++)qn[i]=Math.round(Math.max(-1,Math.min(1,nor[i]))*127);
 let umax=0;for(const v of uv)umax=Math.max(umax,Math.abs(v));const us=Math.max(1,Math.ceil(umax));const qu=leaf?Uint8Array.from(uv,v=>Math.round(v*255)):new Int16Array(n*2);if(!leaf)for(let i=0;i<n*2;i++)qu[i]=Math.round(uv[i]/us*32767);
 const idx=g.index?g.index.array:null;const qi=idx?(n<65536?Uint16Array.from(idx):Uint32Array.from(idx)):null;
 return {count:n,min,max,uvScale:us,pos:push(q),nor:qn?push(qn):-1,uv:push(qu),uv8:leaf,index:qi?push(qi):-1,indexCount:qi?qi.length:0,index32:qi instanceof Uint32Array};
}
// Leaves: one record per leaf (origin, up and right directions, size); the viewer rebuilds both crossed cards.
function packLeaves(g,double){
 const pos=g.attributes.position.array,per=double?8:4,count=pos.length/3/per;
 const o=[],up=[],rt=[],sz=[];
 for(let i=0;i<count;i++){const b=i*per*3;const v=k=>[pos[b+k*3],pos[b+k*3+1],pos[b+k*3+2]];const v0=v(0),v1=v(1),v2=v(2);
  const org=[(v1[0]+v2[0])/2,(v1[1]+v2[1])/2,(v1[2]+v2[2])/2],u=[v0[0]-v1[0],v0[1]-v1[1],v0[2]-v1[2]],r=[v2[0]-v1[0],v2[1]-v1[1],v2[2]-v1[2]];
  const L=Math.hypot(...u);o.push(...org);up.push(...u.map(x=>x/L));rt.push(...r.map(x=>x/L));sz.push(L);}
 const min=[0,1,2].map(k=>Math.min(...o.filter((_,j)=>j%3===k))),max=[0,1,2].map(k=>Math.max(...o.filter((_,j)=>j%3===k)));
 const qo=new Uint16Array(count*3);for(let i=0;i<count*3;i++){const k=i%3;qo[i]=Math.round((o[i]-min[k])/Math.max(max[k]-min[k],1e-6)*65535);}
 const qd=new Int8Array(count*6);for(let i=0;i<count;i++)for(let k=0;k<3;k++){qd[i*6+k]=Math.round(up[i*3+k]*127);qd[i*6+3+k]=Math.round(rt[i*3+k]*127);}
 const smax=Math.max(...sz);const qs=Uint8Array.from(sz,v=>Math.round(v/smax*255));
 return {count,min,max,sizeMax:smax,double,origin:push(qo),dirs:push(qd),size:push(qs)};
}
for(const [name,preset] of picks){
 const json=JSON.parse(fs.readFileSync(path.join(lib,'presets',preset+'.json')));
 const t=new Tree();t.loadFromJson(json);
 header.variants.push({name,bark:json.bark.type,leaf:json.leaves.type,barkScale:json.bark.textureScale,branches:pack(t.branchesMesh.geometry),leaves:packLeaves(t.leavesMesh.geometry,json.leaves.billboard==='double')});
}
const hj=new TextEncoder().encode(JSON.stringify(header));const hlen=new Uint32Array([hj.length]);
const body=new Uint8Array(offset);let at=0;for(const c of chunks){body.set(c,at);at+=c.byteLength;}
const pad=(4-(4+hj.length)%4)%4;
fs.writeFileSync(out,Buffer.concat([Buffer.from(hlen.buffer),Buffer.from(hj),Buffer.alloc(pad),Buffer.from(body)]));
console.log('wrote',out,4+hj.length+pad+body.length,'bytes; header',hj.length,'pad',pad);
