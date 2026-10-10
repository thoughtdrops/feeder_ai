import {spawnSync} from 'node:child_process';
for(const [exe,args] of [['node',['scripts/rust-release.mjs','verify']],['node',['scripts/port-renderer.mjs']],['node',['node_modules/vite/bin/vite.js','build','--config','vite.rust.config.mjs']]]){const r=spawnSync(exe,args,{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
