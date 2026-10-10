export function enhanceFinishes(source){
 const replace=(from,to)=>{if(!source.includes(from))throw Error('Finish renderer anchor missing: '+from.slice(0,90));source=source.replace(from,to);};
 replace("import {attachEditor} from './editor';","import {attachEditor} from './editor';\nimport {addWallMoulding,addOpeningMoulding,addCornerMoulding,createTrimMaterial} from './trim';");
 const p=source.indexOf(' const selectedWallpaper='),q=source.indexOf(' const sidingTexture=',p);
 if(p<0||q<0)throw Error('Wallpaper material anchor missing');
 source=source.slice(0,p)+`
 const finishPaint=new Map<string,T.MeshStandardMaterial>();finishPaint.set('None',paint);
 for(const name of [config.wallpaper,config.bedroomWallpaper]){if(!name||finishPaint.has(name))continue;const pattern=wallpapers.find(p=>p.name===name);if(!pattern)continue;const mat=paint.clone();mat.color.set((pattern as any).bright?'#ffffff':'#ddd9cb');mat.map=loadMap('wallpaper/'+pattern.file,1,1,true);mat.map.wrapS=mat.map.wrapT=T.MirroredRepeatWrapping;mat.normalScale.set(.09,.09);mat.roughness=.88;finishPaint.set(name,mat);}
`+source.slice(q);
 source=source.replaceAll('woodTrim?.23:.035','woodTrim?.36:.16');
 replace("if(woodTrim){interiorTrim.map=loadMap('oak-diff.jpg',1,1,true);interiorTrim.roughnessMap=loadMap('oak-rough.jpg',1,1);}","interiorTrim.roughnessMap=loadMap('oak-rough.jpg',1,1);if(woodTrim){interiorTrim.map=loadMap('oak-diff.jpg',1,1,true);}");
 const materialStart=source.indexOf(' const woodTrim='),materialEnd=source.indexOf(' const finishPaint=',materialStart);
 if(materialStart<0||materialEnd<0)throw Error('Trim material anchor missing');
 source=source.slice(0,materialStart)+" const woodTrim=[2,5,9].includes(trimPackage.profile);\n const interiorTrim=createTrimMaterial(trimPackage.profile,textures,()=>active);\n\n"+source.slice(materialEnd);
 const a=source.indexOf(' function wallBox('),b=source.indexOf('\n if(!frame)',a);
 if(a<0||b<0)throw Error('Wall rendering anchor missing');
 source=source.slice(0,a)+`
 function wallBox(wall:Wall,start:number,length:number,bottom:number,height:number){
  if(length<=0||height<=0)return;editTarget={kind:'wall',wallId:wall.id};const along=wall.axis==='x',x=wall.x+(along?start+length/2:0),z=wall.z+(along?0:start+length/2);
  box(x,bottom+height/2,z,along?length:thickness,height,along?thickness:length,wall.exterior?tiledMaterial(siding,length,height,start,bottom,sidingTile):wallPaint(length,height,start,bottom),true);
  for(const face of m.wallFaces.filter((f:any)=>f.wallId===wall.id)){const lo=Math.max(start,face.at),hi=Math.min(start+length,face.at+face.length);if(hi-lo<.001)continue;const mat=finishPaint.get(face.wallpaper)||paint,offset=face.side*(thickness/2+.014);
   const overlay=box(wall.x+(along?(lo+hi)/2:offset),bottom+height/2,wall.z+(along?offset:(lo+hi)/2),along?hi-lo:.018,height,along?.018:hi-lo,tiledMaterial(mat,hi-lo,height,lo,bottom,3.28));overlay.userData.wallFace={group:face.group,side:face.side,roomId:face.roomId,wallpaper:face.wallpaper};
  }editTarget=null;
 }
`+source.slice(b);
 const rt=source.indexOf("const runTrim=(start:number"),rte=source.indexOf('\n let last=0;',rt);
 if(rt<0||rte<0)throw Error('Trim run anchor missing');
 source=source.slice(0,rt)+`const runTrim=(start:number,end:number,yy:number,height:number,projection:number)=>{if(end-start<.03||yy-height/2>=wh)return;for(const side of sides)addWallMoulding(scene,wall,start,end,yy,Math.min(height,wh-(yy-height/2)),projection*trimPackage.projectionScale,side,tiledMaterial(interiorTrim,end-start,height,start,0,4.6),m,trimPackage.profile);};`+source.slice(rte);
 source=source.replaceAll('trimPackage.baseHeight+.17,.06,.09','trimPackage.baseHeight+.17*trimPackage.sizeScale,.06*trimPackage.sizeScale,.09').replaceAll('o.at,.25,.07,.10','o.at,.2+.05*trimPackage.sizeScale,.07*trimPackage.sizeScale,.10');
 source=source.replaceAll('h-.06,.12,.17','h-.06*trimPackage.sizeScale,.12*trimPackage.sizeScale,.17').replaceAll('h-trimPackage.crown,.065,.075','h-trimPackage.crown,.065*trimPackage.sizeScale,.075');
 source=source.replaceAll('o.bottom<3.1&&o.bottom+o.height>3.1','o.bottom<trimPackage.railHeight&&o.bottom+o.height>trimPackage.railHeight').replaceAll('o.at,3.1,.13,.075','o.at,trimPackage.railHeight,trimPackage.chairRail,.075').replaceAll('wall.length,3.1,.13,.075','wall.length,trimPackage.railHeight,trimPackage.chairRail,.075');
 const railStart=source.indexOf(' if(trimPackage.chairRail)'),railEnd=source.indexOf(' if(trimPackage.panels)',railStart);
 if(railStart<0||railEnd<0)throw Error('Chair rail anchor missing');
 source=source.slice(0,railStart)+source.slice(railEnd);
 const panelStart=source.indexOf(' if(trimPackage.panels){let at=0;'),panelEnd=source.indexOf('\n for(const o of wall.openings)',panelStart);
 if(panelStart<0||panelEnd<0)throw Error('Panel renderer anchor missing');
 source=source.slice(0,panelStart)+" for(const corner of m.trimCorners.filter((p:any)=>p.wallId===wall.id))addCornerMoulding(scene,wall,corner,interiorTrim,m,trimPackage,wh);"+source.slice(panelEnd);
 const ct=source.indexOf(' for(const o of wall.openings){const cw=trimPackage.casingWidth'),ce=source.indexOf('\n editTarget=null;',ct);
 if(ct<0||ce<0)throw Error('Opening trim anchor missing');
 source=source.slice(0,ct)+` for(const o of wall.openings.filter((o:any)=>o.kind!=='window'))for(const side of sides)addOpeningMoulding(scene,wall,o,side,interiorTrim,m,trimPackage,wh);\n`+source.slice(ce);
 return source;
}
