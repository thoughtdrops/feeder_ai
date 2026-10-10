import fs from 'node:fs';

export function navigationRenderer(){
 let s=fs.readFileSync('web/scene.ts','utf8');
 const replace=(from,to)=>{if(!s.includes(from))throw Error('Navigation renderer anchor missing: '+from.slice(0,80));s=s.replace(from,to);};
 replace("import {attachEditor}","import {interiorNavigation} from './navigation';\nimport {attachEditor}");
 replace('const dt=Math.min(clock.getDelta(),.04);', 'const dt=Math.min(clock.getDelta(),.04);if(document.hidden)return;');
 replace('orbit.enabled=!walk;',"orbit.enabled=!walk;const navigate=interiorNavigation(camera,orbit,m,view);");
 replace('cleanup.select=editControls.select;', 'cleanup.navigate=navigate;cleanup.select=editControls.select;');
 replace('for(const f of m.furniture){','for(const f of m.furniture){if(f.kind===\'stairs\')continue;');
 s=s.replaceAll('(h+1.25)','(m.floorHeight||h+1.25)');
 replace('box(w/2,h+.625,z,w,1.25,.46,siding);','box(w/2,h+m.floorGap/2,z,w,m.floorGap,.46,siding);');
 replace('box(x,h+.625,d/2,.46,1.25,d,siding);','box(x,h+m.floorGap/2,d/2,.46,m.floorGap,d,siding);');
 fs.writeFileSync('web/scene.ts',s);
 let r=fs.readFileSync('web/report.ts','utf8').replaceAll('(m.h+1.25)','(m.floorHeight||m.h+1.25)');
 const anchor="pageStart('CIRCULATION PLANNING');";
 if(!r.includes(anchor))throw Error('Structural report anchor missing');
 r=r.replace(anchor,`pageStart('STRUCTURAL SCREENING');text(m.structural.status,true,12);text(m.structural.check);text('ForteWEB analysis: NOT RUN. '+m.structural.forte.reason,true);if(m.structural.floor){const f=m.structural.floor;text('Floor joists: '+f.axis+' direction / longest clear span '+f.maxClearSpan+' ft / '+f.spacingInches+' in OC / '+f.liveLoadPsf+' psf live / '+f.deadLoadPsf+' psf dead / '+f.deflection);text(f.candidate?'Preliminary candidate: '+f.candidate.series+' / '+f.candidate.depthInches+' in depth / table clear-span limit '+f.candidate.tableLimitFeet.toFixed(2)+' ft.':'NO TABLE CANDIDATE. Engineering solution required.',true);text('Bearing supports follow exterior walls and explicitly marked interior bearing walls. No automatic 16-foot support beams are assumed.');}for(const issue of m.structural.issues)text(issue);text(m.structural.basis);text('Manufacturer reference: '+m.structural.guide);${anchor}`);
 fs.writeFileSync('web/report.ts',r);
}
