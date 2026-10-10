import {spawnSync} from 'node:child_process';
for (const args of [
  ['scripts/rust-tool.mjs','build','--release','--target','wasm32-unknown-unknown','--locked','--offline'],
  ['scripts/rust-release.mjs','record'],
]) {
  const result=spawnSync(process.execPath,args,{stdio:'inherit'});
  if(result.status!==0) process.exit(result.status||1);
}
