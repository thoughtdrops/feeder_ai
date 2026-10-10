import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=resolve(root,'rust-app/release.json');
const mode=process.argv[2];
if(!['record','verify'].includes(mode)) throw new Error('Use rust-release.mjs record or verify.');
function files(directory) {
  return readdirSync(resolve(root,directory),{withFileTypes:true}).flatMap(entry=> {
    const name=`${directory}/${entry.name}`;
    return entry.isDirectory()?files(name):entry.isFile()?[name]:[];
  });
}
function digest(names) {
  const hash=createHash('sha256');
  for(const name of [...names].sort()) {
    const bytes=readFileSync(resolve(root,name));
    hash.update(`${name}\0${bytes.length}\0`).update(bytes);
  }
  return hash.digest('hex');
}
const sources=['rust-app/Cargo.toml','rust-app/Cargo.lock',...files('rust-app/src'),...files('rust-app/data')];
const outputs=['public/pkg/universal_frames.js','public/pkg/universal_frames_bg.wasm','public/pkg/universal_frames.d.ts','public/pkg/universal_frames_bg.wasm.d.ts'];
const wasm=readFileSync(resolve(root,outputs[1]));
if(!wasm.subarray(0,8).equals(Buffer.from([0,97,115,109,1,0,0,0]))) throw new Error('Rust engine is not a complete WebAssembly module.');
const current={version:1,source_sha256:digest(sources),output_sha256:digest(outputs)};
if(mode==='record') {
  writeFileSync(manifest,JSON.stringify(current,null,2)+'\n');
  console.log('Recorded Rust release fingerprints.');
} else {
  const saved=JSON.parse(readFileSync(manifest,'utf8'));
  if(saved.version!==current.version||saved.source_sha256!==current.source_sha256||saved.output_sha256!==current.output_sha256) {
    throw new Error('Rust sources or release artifacts changed. Run npm run build:engine before publishing.');
  }
  console.log('Verified Rust release sources and WebAssembly artifacts.');
}
