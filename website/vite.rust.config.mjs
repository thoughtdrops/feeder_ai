import {defineConfig} from 'vite';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const engineRevision=createHash('sha256').update(readFileSync(new URL('./public/pkg/universal_frames.js',import.meta.url))).update(readFileSync(new URL('./public/pkg/universal_frames_bg.wasm',import.meta.url))).digest('hex').slice(0,16);
export default defineConfig({define:{__UF_ENGINE_REVISION__:JSON.stringify(engineRevision)},build:{outDir:'dist',emptyOutDir:true,target:['safari15.4','chrome90','firefox90'],assetsInlineLimit:0,rollupOptions:{output:{manualChunks(id){if(id.includes('/three/'))return 'three';}}}},server:{host:'0.0.0.0',port:5173}});
