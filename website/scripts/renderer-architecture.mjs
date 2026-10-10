import fs from 'node:fs';
export function architectureRenderer(){let s=fs.readFileSync('web/scene.ts','utf8');s=s.replace("import {attachEditor}","import {addRoof,addRoofFrame,addFloorFrame,addFloor,addStairs,addRoofOrnament} from './architecture';\nimport {addPorch} from './porch';\nimport {attachEditor}");
s=s.replace("const bounds=m.garage&&(view==='exterior'||view==='framing'||!config.activeFloor)?m.siteBounds:null","const bounds=m.siteBounds&&(view==='exterior'||view==='framing'||!config.activeFloor)?m.siteBounds:null");
s=s.replace('const span=Math.max(w,d,h+m.ridgeRise)','const span=Math.max(w,d,h*(config.stories||1)+m.ridgeRise)');
const begin=s.indexOf(' function mesh('),end=s.indexOf(' if(frame&&frameOpening)');if(begin<0||end<0)throw Error('Architecture renderer boundaries changed');let body=s.slice(begin,end);
body=body.replace('box(w/2,-.25,d/2,w+.7,.7,d+.7,material(\'#a39f90\',.92));editTarget={kind:\'floor\'};box(w/2,.14,d/2,w,.14,d,floorMat);editTarget=null;',`if(!m.floorIndex||(view!=='exterior'&&view!=='framing'))box(w/2,-.25,d/2,w+.7,.7,d+.7,material('#a39f90',.92));if(!frame)addFloor(scene,m,floorMat);`);
body=body.replace('box(w/2,-.7,d/2,450,.3,450,ground);',`if(!m.floorIndex||(view!=='exterior'&&view!=='framing'))box(w/2,-.7,d/2,450,.3,450,ground);`);
let a=body.indexOf(' // Vertical gable end infill'),b=body.indexOf(' // Metal profiles stop',a);if(a<0||b<0)throw Error('Roof section changed');body=body.slice(0,a)+` if(topFloor)addRoof(scene,m,roof,siding,trim);addFloor(scene,m,ceiling,h-.08,!topFloor);\n`+body.slice(b);
// Exterior floor band closes the rim zone between stacked wall plates.
body=body.replace(' // Entry downlights',` if(m.stories===2&&!m.floorIndex){for(const z of [0,d])box(w/2,h+.625,z,w,1.25,.46,siding);for(const x of [0,w])box(x,h+.625,d/2,.46,1.25,d,siding);}
 // Entry downlights`);
body=body.replace('box(entry.at-1,5.6,-.36','if(hasEntry)box(entry.at-1,5.6,-.36').replace('box(entry.at-1,5.6,-.46','if(hasEntry)box(entry.at-1,5.6,-.46').replace('pd=5.5,pp=config.pitch/12','pd=5.5,pp=Math.min(config.pitch,4)/12');
const ornamentStart=body.indexOf(' for(const xx of [-.26,w+.26])'),ornamentEnd=body.indexOf(" if(['midcentury'",ornamentStart);if(ornamentStart<0||ornamentEnd<0)throw Error('Ornament boundaries changed');body=body.slice(0,ornamentStart)+` if(topFloor)addRoofOrnament(scene,m,trim,homeStyle.feature);\n`+body.slice(ornamentEnd);
const porchStart=body.indexOf(' if(hasEntry&&homeStyle.porch');
const porchEnd=body.indexOf(' if(topFloor)addRoofOrnament',porchStart);
if(porchStart<0||porchEnd<0)throw Error('Porch boundaries changed');
body=body.slice(0,porchStart)+body.slice(porchEnd);
a=body.indexOf(' if(frame&&frameRoof)');b=body.indexOf(' if(!frame){',a);if(a<0||b<0)throw Error('Roof framing section changed');body=body.slice(0,a)+` if(!m.floorIndex)addPorch(scene,m,frame,interiorTrim,roof,siding); if(frame&&frameRoof&&topFloor)addRoofFrame(scene,m,material('#b49970',.85));if(frame&&!m.floorIndex)addFloorFrame(scene,m,material('#b49970',.85));if(!frame)addStairs(scene,m,oak,bronze);\n`+body.slice(b);
const wrapped=` const mainScene=scene;const levelModels=(view==='exterior'||view==='framing')?(m.levels||[m]):[m.levels?.[config.activeFloor||0]||m];\n for(const levelModel of levelModels){const m=levelModel;const topFloor=!m.stories||m.stories===1||m.floorIndex===1;const scene=new T.Group() as any;scene.name='House level '+(m.floorIndex||0);scene.position.y=(view==='exterior'||view==='framing')?(m.floorIndex||0)*(h+1.25):0;mainScene.add(scene);\n${body}\n }\n`;
s=s.slice(0,begin)+wrapped+s.slice(end);
s=s.replace("wood.map=loadMap('oak-diff.jpg',1,1,true);const instances","wood.map=loadMap('oak-diff.jpg',1,1,true);if((m.floorIndex||0)!==(config.activeFloor||0)){wood.transparent=true;wood.opacity=.22;wood.depthWrite=false;}const instances");
s=s.replace("if(frame&&frameOpening){","const activeBase=frame?(config.activeFloor||0)*(h+1.25):0;if(frame){orbit.target.y=activeBase+h*.45;camera.position.y+=activeBase;}\n if(frame&&frameOpening){");
s=s.replace("orbit.target.set(x,o.bottom+o.height*.6,z)","orbit.target.set(x,activeBase+o.bottom+o.height*.6,z)").replace("o.bottom+o.height*.6+3,z+","activeBase+o.bottom+o.height*.6+3,z+");s=s.replace("orbit.target.set(0,h*.45,0)","orbit.target.set(0,h*(view==='exterior'?(config.stories||1):1)*.45,0)");
fs.writeFileSync('web/scene.ts',s);
let r=fs.readFileSync('web/report.ts','utf8');
r=r.replaceAll('${c.pitch}:12 gable','${c.pitch}:12 ${m.roof.type}').replace('Gable roof only, ${c.pitch}:12 pitch and 18 in overhangs. Single-story slab-on-grade assumption.','${c.stories||1} stories, ${m.roof.type} roof, ${c.pitch}:12 pitch and 18 in overhangs. Slab-on-grade foundation allowance.').replace(' (single-story gable edition)','');
r=r.replaceAll('m.frameMembers.map','[...(m.allFrameMembers||m.frameMembers),...(m.floorFrameMembers||[])].map').replace('s.x1,s.y1,s.z1,s.x2,s.y2,s.z2','s.x1,s.y1+(s.floorIndex||0)*(m.h+1.25),s.z1,s.x2,s.y2+(s.floorIndex||0)*(m.h+1.25),s.z2').replace('24,r.x,r.y1,r.z1,r.x,r.y2,r.z2','24,r.x1??r.x,r.y1+((c.stories||1)-1)*(m.h+1.25),r.z1,r.x2??r.x,r.y2+((c.stories||1)-1)*(m.h+1.25),r.z2');
r=r.replaceAll('x,m.h-.75,','x,m.h-.75+((c.stories||1)-1)*(m.h+1.25),').replaceAll('m.walls.map','(m.allWalls||m.walls).map').replaceAll('m.walls.filter(w=>w.openings.length)','(m.allWalls||m.walls).filter(w=>w.openings.length)');
const start=r.indexOf("pageStart('FLOOR PLAN & OPENINGS');"),stop=r.indexOf("text('OPENING HEIGHT GUARDRAILS'",start);
if(start<0||stop<0)throw Error('Report floor plan boundaries changed');
const drawing=r.slice(start,stop).replace("pageStart('FLOOR PLAN & OPENINGS');","pageStart('FLOOR PLAN · '+(m.floorIndex===1?'UPPER FLOOR':'MAIN FLOOR'));");
r=r.slice(0,start)+"for(const floorModel of m.levels||[m]){const m=floorModel;"+drawing+"}\n"+r.slice(stop);
r=r.replace('The model divides each slope into ${m.roofBays} provisional support bays (up to 16 ft horizontal run), with ${m.roofPosts} post/connection allowances.','Roof shape: ${m.roof.type}. Enumerated rafters follow the actual roof planes; ${m.roof.hipLF.toFixed(2)} ft hips and ${m.roof.valleyLF.toFixed(2)} ft valleys require supported engineered beams.');
fs.writeFileSync('web/report.ts',r);}
