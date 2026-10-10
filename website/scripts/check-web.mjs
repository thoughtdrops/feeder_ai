import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=fs.readdirSync('web').filter(name=>name.endsWith('.ts')).map(name=>'web/'+name);
const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit','--strict','--skipLibCheck','--target','ES2022','--module','ESNext','--moduleResolution','Bundler','--resolveJsonModule','--allowSyntheticDefaultImports','--lib','ES2022,DOM,DOM.Iterable',...files],{stdio:'inherit'});
process.exit(result.status??1);
