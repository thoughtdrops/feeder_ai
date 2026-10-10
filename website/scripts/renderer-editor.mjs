import fs from 'node:fs';
import {enhanceFinishes} from './renderer-finishes.mjs';
export function enhanceRenderer(){
 let source=fs.readFileSync('web/scene.ts','utf8');
 const replace=(from,to)=>{if(!source.includes(from))throw Error('3D editor renderer anchor missing: '+from.slice(0,80));source=source.replace(from,to);};
 replace("import catalog from '../rust-app/data/catalog.json';","import catalog from '../rust-app/data/catalog.json';\nimport {attachEditor} from './editor';\nimport {addRealFurniture,addDiningChairs} from './furniture';\ntype Wall=any;");
 replace('const keys={current:new Set<string>()};','const keys={current:new Set<string>()};let editTarget:any=null;');
 replace('o.castShadow=true;o.receiveShadow=true;scene.add(o);if(solid)', 'o.castShadow=true;o.receiveShadow=true;if(editTarget)o.userData.editTarget={...editTarget};scene.add(o);if(solid)');
 replace('box(w/2,.14,d/2,w,.14,d,floorMat);', "editTarget={kind:'floor'};box(w/2,.14,d/2,w,.14,d,floorMat);editTarget=null;");
 source=source.replaceAll('450/6.56','450/4.59');
 replace("const hasEntry=m.walls[0].openings.some(o=>o.kind==='door'); const entry=m.walls[0].openings.find(o=>o.kind==='door')||{at:w/2-1.5};", "const front=m.walls.find((wall:any)=>wall.exterior&&wall.axis==='x'&&wall.z===0&&wall.openings.some((o:any)=>o.kind==='door'));const hasEntry=!!front;const frontDoor=front?.openings.find((o:any)=>o.kind==='door');const entry={at:frontDoor?front.x+frontDoor.at:w/2-1.5};");
 const interiorTrim=`
 const woodTrim=[2,5,9].includes(trimPackage.profile),trimColors=['#373e40','#b8b5a9','#956b44','#c7c0af','#c8baa1','#624637','#ad8b56','#c4b6a2','#a9bdb8','#92734d'];
 const interiorTrim=new T.MeshStandardMaterial({color:trimColors[trimPackage.profile]||'#b9b3a6',roughness:woodTrim?.48:.61,metalness:trimPackage.profile===6?.25:0,normalMap:loadMap('oak-nor_gl.jpg',1,1),normalScale:new T.Vector2(woodTrim?.23:.035,woodTrim?.23:.035)});
 if(woodTrim){interiorTrim.map=loadMap('oak-diff.jpg',1,1,true);interiorTrim.roughnessMap=loadMap('oak-rough.jpg',1,1);}
 const selectedWallpaper=wallpapers.find(p=>p.name===config.wallpaper);
 if(selectedWallpaper){paint.color.set('#ffffff');paint.map=loadMap('wallpaper/'+selectedWallpaper.file,1,1,true);paint.map.wrapS=paint.map.wrapT=T.MirroredRepeatWrapping;paint.normalScale.set(.07,.07);paint.roughness=.88;}
 `;
 replace(' const sidingTexture=',interiorTrim+'\n const sidingTexture=');
 replace("function wallBox(wall:Wall,start:number,length:number,bottom:number,height:number){if(length<=0||height<=0)return;", "function wallBox(wall:Wall,start:number,length:number,bottom:number,height:number){if(length<=0||height<=0)return;editTarget={kind:'wall',wallId:wall.id};");
 replace('wallPaint(length,height,start,bottom));}}','wallPaint(length,height,start,bottom));}editTarget=null;}');
 source=source.replaceAll("wall.id==='E1'||wall.id==='E3'", "wall.id.startsWith('E1')||wall.id.startsWith('E3')");
 replace("const x=wall.x+(wall.axis==='x'?o.at+o.width/2:0),z=", "editTarget={kind:'opening',id:o.id,wallId:wall.id};const x=wall.x+(wall.axis==='x'?o.at+o.width/2:0),z=");
 const openingStart=source.indexOf("  if(o.kind==='window'&&!cut)");
 const openingEnd=source.indexOf('\n }\n wallBox(wall,cursor',openingStart);
 if(openingStart<0||openingEnd<0)throw Error('Opening geometry anchor missing');
 source=source.slice(0,openingStart)+`
  const visibleHeight=Math.max(0,Math.min(o.height,wh-o.bottom));
  if(o.kind==='window'&&visibleHeight>0){box(x,o.bottom+visibleHeight/2,z,along?o.width:.10,visibleHeight,along?.10:o.width,glass);for(const offset of [-o.width/2,o.width/2,...(homeStyle.windowGrid>=6?[-o.width/6,o.width/6]:homeStyle.windowGrid?[0]:[])])box(x+(along?offset:0),o.bottom+visibleHeight/2,z+(along?0:offset),along?.10:.4,visibleHeight,along?.4:.10,trim);for(const yy of [o.bottom,...(o.bottom+o.height<wh?[o.bottom+o.height]:[])])box(x,yy,z,along?o.width+.15:.4,.10,along?.4:o.width+.15,trim);box(x,o.bottom-.09,z,along?o.width+.3:.65,.1,along?.65:o.width+.3,interiorTrim);}
  if(o.kind!=='window'){for(const side of [-1,1])box(x+(along?side*(o.width/2+.06):0),Math.min(o.height,wh)/2,z+(along?0:side*(o.width/2+.06)),along?.12:.57,Math.min(o.height,wh),along?.57:.12,wall.exterior?trim:interiorTrim);if(o.height<wh)box(x,o.height+.06,z,along?o.width+.25:.57,.12,along?.57:o.width+.25,wall.exterior?trim:interiorTrim);if(o.kind==='door'){
   const doorMaterial=woodTrim||wall.exterior?oak:interiorTrim;const leafHeight=Math.min(o.height-.08,wh);const leaf=box(x,leafHeight/2+.04,z,along?o.width-.13:.16,leafHeight,along?.16:o.width-.13,doorMaterial,false,.025);
   if(!wall.exterior||cut||walk){const hinge=new T.Group();hinge.position.set(wall.x+(along?o.at:0)-w/2,0,wall.z+(along?0:o.at)-d/2);leaf.position.set(along?(o.width-.13)/2:0,leafHeight/2+.04,along?0:(o.width-.13)/2);hinge.add(leaf);hinge.rotation.y=along?-Math.PI*.42:Math.PI*.42;hinge.userData.editTarget={kind:'opening',id:o.id,wallId:wall.id};scene.add(hinge);}else box(x+o.width*.34,3.3,z-.14,.06,.55,.07,bronze);
  }}
  if(visibleHeight>0){const hitArea=box(x,o.bottom+visibleHeight/2,z,along?o.width:.045,visibleHeight,along?.045:o.width,new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));hitArea.name='Opening hit area';hitArea.castShadow=false;hitArea.receiveShadow=false;}
  editTarget=null;
 `+source.slice(openingEnd);
 const trimStart=source.indexOf(' // Baseboard, chair rail');const trimEnd=source.indexOf('\n }\n }else{',trimStart);
 let trimBlock=source.slice(trimStart,trimEnd).replaceAll(',ceiling)',',interiorTrim)');
 trimBlock=trimBlock.replace('const runTrim=',"editTarget={kind:'wall',wallId:wall.id};const runTrim=");
 trimBlock=trimBlock.replace('wall.axis===\'z\'?end-start:projection,interiorTrim);',"wall.axis==='z'?end-start:projection,tiledMaterial(interiorTrim,end-start,height,start,0,4.6),false,.015);");
 trimBlock+=`\n if(trimPackage.profile===3||trimPackage.profile===5||trimPackage.profile===7){for(const side of sides){let last=0;for(const opening of [...passages,{at:wall.length,width:0}]){const length=opening.at-last;if(length>.03){const shape=new T.Shape();const hh=.11;shape.moveTo(0,0);shape.bezierCurveTo(.07,0,.015,hh*.7,.07,hh);shape.lineTo(0,hh);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:length,bevelEnabled:false,curveSegments:8});const detail=new T.Mesh(geo,interiorTrim);detail.rotation.y=wall.axis==='x'?Math.PI/2:0;detail.position.set(wall.x+(wall.axis==='x'?last:side*.29)-w/2,trimPackage.baseHeight+.11,wall.z+(wall.axis==='z'?last:side*.29)-d/2);detail.userData.editTarget={kind:'wall',wallId:wall.id};scene.add(detail);}last=opening.at+opening.width;}}}\n editTarget=null;\n`;
 source=source.slice(0,trimStart)+trimBlock+source.slice(trimEnd);
 replace('new Set(m.frameMembers.map(p=>p.role))','new Set<string>(m.frameMembers.map((p:any)=>p.role))');
 replace('instances.castShadow=true;instances.receiveShadow=true;scene.add(instances);', 'instances.instanceMatrix.needsUpdate=true;instances.computeBoundingBox();instances.computeBoundingSphere();instances.userData.frameMembers=pieces;instances.name=role;instances.castShadow=true;instances.receiveShadow=true;scene.add(instances);');
 replace(" }\n if(!cut&&!frame){", `
  // An empty rough opening stays visible and clickable in framing view.
  for(const wall of m.walls)for(const opening of wall.openings){const along=wall.axis==='x';const center=new T.Vector3(wall.x+(along?opening.at+opening.width/2:0)-w/2,opening.bottom+opening.height/2,wall.z+(along?0:opening.at+opening.width/2)-d/2);const bounds=new T.Box3().setFromCenterAndSize(center,new T.Vector3(along?opening.width:.5,opening.height,along?.5:opening.width));const outline=new T.Box3Helper(bounds,new T.Color(opening.kind==='window'?'#69b9d7':'#edc55b'));scene.add(outline);const plane=new T.Mesh(new T.BoxGeometry(along?opening.width:.05,opening.height,along?.05:opening.width),new T.MeshBasicMaterial({color:opening.kind==='window'?'#69b9d7':'#edc55b',transparent:true,opacity:.065,depthWrite:false}));plane.position.copy(center);plane.userData.editTarget={kind:'opening',id:opening.id,wallId:wall.id};scene.add(plane);}
 }
 if(!cut&&!frame){`);
 replace(' for(const f of m.furniture){\n  const before='," for(const f of m.furniture){\n  if(addRealFurniture(scene,f,m,interior,()=>active))continue;\n  editTarget={kind:'furniture',id:f.id};\n  if(f.kind==='dining')addDiningChairs(scene,f,m,interior,()=>active);\n  const before=");
 replace("chair(x*tw*.28,z*(td/2+.8),z<0?0:Math.PI);",'');
 replace("   case 'plant':plant(0,0,.8);break;", `
   case 'rug':{const rug=material(interior.fabric,.99);rug.bumpMap=surface('plaster');rug.bumpScale=.022;box(0,.23,0,fw,.035,fd,rug,false,.04);break;}
   case 'floorlamp':{cyl(0,.28,0,.62,.12,bronze);cyl(0,2.6,0,.055,4.6,bronze);mesh(new T.CylinderGeometry(.55,.75,1.05,32,1,true),linen,0,4.9,0);sphere(0,4.75,0,.18,white);break;}
   case 'side-table':{cyl(0,1.95,0,.94,.15,oak);for(const a of [0,Math.PI*2/3,Math.PI*4/3])cyl(Math.cos(a)*.62,1.1,Math.sin(a)*.62,.065,1.65,bronze);break;}
   case 'bench':{box(0,1.55,0,fw,.3,fd,linen,false,.12);for(const x of [-1,1])for(const z of [-1,1])box(x*(fw/2-.25),.9,z*(fd/2-.22),.12,1.2,.12,oak,false,.03);break;}
   case 'bookcase':{for(const x of [-1,1])box(x*(fw/2-.07),3.05,0,.12,5.6,fd,oak);box(0,3.05,-fd/2+.04,fw,5.6,.08,oak);for(const yy of [.32,1.65,3.,4.35,5.85]){box(0,yy,0,fw,.1,fd,oak);if(yy<5.8)for(let i=0;i<7;i++){const cover=material(['#315e5b','#af7959','#c2aa75','#4e5871'][i%4],.9);box(-fw/2+.3+i*(fw-.6)/7,yy+.45,-.08,.2,.76,.63,cover,false,.015);}}break;}
   case 'entry-console':{box(0,2.65,0,fw,.16,fd,oak,false,.035);box(0,2.35,0,fw-.15,.45,fd-.1,oak,false,.04);for(const x of [-1,1])for(const z of [-1,1])box(x*(fw/2-.2),1.45,z*(fd/2-.17),.1,2.15,.1,bronze);cyl(.6,2.96,0,.12,.5,white);sphere(.6,3.2,0,.2,white);break;}
   case 'floor-vase':{mesh(new T.LatheGeometry([new T.Vector2(.25,0),new T.Vector2(.4,.25),new T.Vector2(.46,.7),new T.Vector2(.35,1.2),new T.Vector2(.17,1.5),new T.Vector2(.2,1.65)],36),material('#aa8165',.7),0,.23,0);break;}
   case 'floor-mirror':{const mirror=material('#c0d5dc',.12,.85);box(0,3.2,0,fw,5.8,.12,oak,false,.065);box(0,3.2,-.085,fw-.28,5.5,.035,mirror,false,.05);for(const x of [-1,1])box(x*(fw/2-.17),.55,.1,.1,.65,fd,oak);break;}
   case 'tall-plant':{cyl(0,.7,0,.7,1.,material('#aaa193',.87));cyl(0,2.1,0,.06,2.4,oak);const leaves=material('#386e41',.86);for(let i=0;i<14;i++){const a=i*2.4,leaf=sphere(Math.cos(a)*.53,1.8+i*.21,Math.sin(a)*.53,.38,leaves);leaf.scale.set(.65,1.6,.25);leaf.rotation.z=Math.sin(a)*.6;}break;}
   case 'plant':plant(0,0,.8);break;`);
 replace("case 'toilet': cyl(0,.7,.1,.44,1.1,white);const bowl=sphere(0,1.2,.25,.52,white);bowl.scale.set(1,.45,1.3);box(0,1.8,-.62,1.1,1.3,.42,white,false,.12);break;", `case 'toilet':{const body=mesh(new T.LatheGeometry([new T.Vector2(.34,0),new T.Vector2(.39,.12),new T.Vector2(.29,.52),new T.Vector2(.4,.95),new T.Vector2(.62,1.23),new T.Vector2(.65,1.42),new T.Vector2(.54,1.46),new T.Vector2(.48,1.22),new T.Vector2(.2,1.03)],40),white,0,.23,.21);body.scale.z=1.25;const seat=mesh(new T.TorusGeometry(.56,.055,12,48),white,0,1.73,.21);seat.rotation.x=Math.PI/2;seat.scale.y=1.25;box(0,1.95,-.77,1.2,1.55,.58,white,false,.12);box(0,2.74,-.77,1.27,.1,.65,white,false,.04);cyl(.38,2.76,-.76,.05,.045,stainless);break;}`);
 replace("group.rotation.y=-f.rotation+(f.kind==='bed'?Math.PI:0);","group.updateMatrixWorld(true);const furnitureBounds=new T.Box3().setFromObject(group),furnitureSize=furnitureBounds.getSize(new T.Vector3());group.scale.x=Math.min(1,fw/furnitureSize.x);group.scale.z=Math.min(1,fd/furnitureSize.z);group.rotation.y=-f.rotation+(f.kind==='bed'?Math.PI:0);");
 replace('group.position.set(f.x-w/2,0,f.z-d/2);scene.add(group);',"group.position.set(f.x-w/2,0,f.z-d/2);group.userData.editTarget={kind:'furniture',id:f.id};scene.add(group);editTarget=null;");
 const paperStart=source.indexOf(' const pattern=wallpapers.find');const paperEnd=source.indexOf(' if(!cut){for(const wall',paperStart);
 if(paperStart<0||paperEnd<0)throw Error('Wallpaper anchor missing');
 source=source.slice(0,paperStart)+' // Wallpaper covers all interior wall faces, including both sides of partitions.\n'+source.slice(paperEnd);
 replace(' let yaw=0,pitch=0;'," const editControls=attachEditor(el,renderer.domElement,scene,camera,m,(target:any)=>(globalThis as any).ufBridge?.pickScene(target),(change:any)=>(globalThis as any).ufBridge?.resizeWall(change),(dragging:boolean)=>{orbit.enabled=!dragging&&!walk;},view,(change:any)=>(globalThis as any).ufBridge?.drawWall(change));editControls.select(payload.selection);\n let yaw=0,pitch=0;");
 replace(' let dragging=false,lastX=0,lastY=0;'," if(payload.cameraPose){camera.position.fromArray(payload.cameraPose.position);orbit.target.fromArray(payload.cameraPose.target);yaw=payload.cameraPose.yaw;pitch=payload.cameraPose.pitch;if(walk){camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);}else orbit.update();}\n let dragging=false,lastX=0,lastY=0;");
 replace(" return()=>{document.removeEventListener('pointerdown',pad);active=false;", " const cleanup:any=()=>{editControls.dispose();document.removeEventListener('pointerdown',pad);active=false;");
 replace('keys.current.clear();};\n\n}', 'keys.current.clear();};cleanup.select=editControls.select;cleanup.setMode=editControls.setMode;cleanup.getPose=()=>({position:camera.position.toArray(),target:orbit.target.toArray(),yaw,pitch});return cleanup;\n\n}');
 replace("const kd=(e:KeyboardEvent)=>{if(!walk||/INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement).tagName))return;", "const kd=(e:KeyboardEvent)=>{if(e.defaultPrevented||/INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement).tagName)||(e.target as HTMLElement).isContentEditable||e.ctrlKey||e.metaKey||e.altKey)return;if(!walk&&!e.key.startsWith('Arrow'))return;");
 replace("s=Number(keys.current.has('d'))-Number(keys.current.has('a'));yaw+=(Number(keys.current.has('arrowleft'))-Number(keys.current.has('arrowright')))*dt*1.5;", "s=Number(keys.current.has('d')||keys.current.has('arrowright'))-Number(keys.current.has('a')||keys.current.has('arrowleft'));");
 replace('}else orbit.update();renderer.render(scene,camera);', "}else{const dx=(Number(keys.current.has('arrowright'))-Number(keys.current.has('arrowleft')))*dt*12,dz=(Number(keys.current.has('arrowup'))-Number(keys.current.has('arrowdown')))*dt*12;if(dx||dz){camera.position.x+=dx;camera.position.z+=dz;orbit.target.x+=dx;orbit.target.z+=dz;}orbit.update();}renderer.render(scene,camera);");
 fs.writeFileSync('web/scene.ts',enhanceFinishes(source));
}
