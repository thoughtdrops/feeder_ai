import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {graphicsAsset} from './graphics';

// Cross-sections have recessed grooves, beads, steps and ogee curves.
export function profileShape(height:number,depth:number,profile:any){
 if(profile?.points){const shape=new T.Shape();for(let i=0;i<profile.points.length;i++){const [x,y]=profile.points[i];if(i===0)shape.moveTo(x*depth,y*height);else shape.lineTo(x*depth,y*height);}shape.closePath();return shape;}
 const s=new T.Shape();const point=(x:number,y:number)=>s.lineTo(x*depth,y*height);s.moveTo(0,0);point(.88,0);point(1,.07);
 if(profile===0){point(.46,.09);point(.46,.79);point(.19,.79);point(.19,.95);point(.26,1);}
 else if(profile===1){point(1,.86);s.quadraticCurveTo(depth,height,depth*.82,height);point(.18,1);}
 else if(profile===2){for(const[x,y]of [[1,.15],[.72,.15],[.72,.69],[.89,.69],[.89,.82],[.53,.82],[.53,1]])point(x,y);}
 else if(profile===3){point(.88,.17);s.bezierCurveTo(depth*.21,height*.20,depth*.18,height*.37,depth*.77,height*.45);point(.85,.52);s.bezierCurveTo(depth*.99,height*.65,depth*.23,height*.70,depth*.4,height*.9);point(.4,1);}
 else if(profile===4){point(.84,.16);point(.48,.2);point(.48,.35);s.quadraticCurveTo(depth*.94,height*.43,depth*.58,height*.53);point(.32,.57);s.bezierCurveTo(depth*.15,height*.74,depth*.83,height*.79,depth*.72,height*.93);point(.48,1);}
 else if(profile===5){point(.9,.13);s.bezierCurveTo(depth*.1,height*.14,depth*.1,height*.26,depth*.76,height*.29);point(.92,.35);point(.36,.4);point(.36,.48);point(.85,.54);s.bezierCurveTo(depth*1.08,height*.66,depth*.1,height*.72,depth*.45,height*.85);s.quadraticCurveTo(depth*.95,height*.97,depth*.35,height);point(.13,1);}
 else if(profile===6){for(const[x,y]of [[1,.12],[.82,.12],[.82,.36],[.65,.36],[.65,.61],[.43,.61],[.43,.84],[.25,.84],[.25,1]])point(x,y);}
 else if(profile===7){point(.91,.15);s.quadraticCurveTo(depth*.4,height*.18,depth*.5,height*.31);s.bezierCurveTo(depth*.81,height*.4,depth*.24,height*.53,depth*.35,height*.65);s.quadraticCurveTo(depth*.95,height*.79,depth*.58,height*.9);point(.66,.96);point(.32,1);}
 else if(profile===8){for(const center of [.22,.5,.78]){point(.64,center-.1);s.quadraticCurveTo(depth*1.02,height*center,depth*.64,height*(center+.1));}point(.42,1);}
 else{point(.91,.25);point(.97,.27);point(.97,.66);point(.9,.68);point(.9,.88);point(.59,1);}
 point(0,1);point(0,0);return s;
}
export function addTrimSegment(scene:T.Object3D,a:T.Vector3,b:T.Vector3,width:number,projection:number,outward:T.Vector3,profile:any,material:T.Material,tag:any){
 const direction=b.clone().sub(a),length=direction.length();if(length<.01||width<=0||projection<=0)return;direction.normalize();
 const localY=direction.clone().cross(outward).normalize(),basis=new T.Matrix4().makeBasis(outward,localY,direction),origin=a.clone().addScaledVector(localY,-width/2);
 const geo=new T.ExtrudeGeometry(profileShape(width,projection,profile),{depth:length,bevelEnabled:false,curveSegments:14,steps:1});
 const pos=geo.getAttribute('position'),uv=geo.getAttribute('uv');for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getZ(i)/4,pos.getY(i)/1.5);uv.needsUpdate=true;
 const mesh=new T.Mesh(geo,material);mesh.setRotationFromMatrix(basis);mesh.position.copy(origin);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=profile?.name||'Carved trim profile '+profile;mesh.userData.editTarget=tag;mesh.userData.trimProfile=profile?.catalogNumber??profile;mesh.userData.profileId=profile?.id;scene.add(mesh);return mesh;
}
export function addWallMoulding(scene:T.Scene,wall:any,start:number,end:number,y:number,height:number,projection:number,side:number,mat:T.Material,m:any,profile:number){
 const along=wall.axis==='x',outward=new T.Vector3(along?0:side,0,along?side:0);
 const a=new T.Vector3(wall.x+(along?start:side*.245)-m.w/2,y,wall.z+(along?side*.245:start)-m.d/2),b=a.clone().add(new T.Vector3(along?end-start:0,0,along?0:end-start));
 const reverse=along?side>0:side<0;addTrimSegment(scene,reverse?b:a,reverse?a:b,height,projection,outward,profile,mat,{kind:'wall',wallId:wall.id});
}
export function addOpeningMoulding(scene:T.Scene,wall:any,opening:any,side:number,mat:T.Material,m:any,trim:any,visibleHeight:number){
 const along=wall.axis==='x',cw=trim.casingWidth,outward=new T.Vector3(along?0:side,0,along?side:0),tag={kind:'opening',id:opening.id,wallId:wall.id};
 const point=(at:number,y:number)=>new T.Vector3(wall.x+(along?at:side*.25)-m.w/2,y,wall.z+(along?side*.25:at)-m.d/2);
 const bottom=Math.max(.2,opening.bottom),top=Math.min(opening.bottom+opening.height,visibleHeight);
 if(top<=bottom)return;
 for(const at of [opening.at-cw/2,opening.at+opening.width+cw/2])addTrimSegment(scene,point(at,bottom),point(at,top),cw,.10*trim.projectionScale,outward,trim.profile,mat,tag);
 if(opening.bottom+opening.height+cw/2<visibleHeight)addTrimSegment(scene,point(opening.at-cw,opening.bottom+opening.height+cw/2),point(opening.at+opening.width+cw,opening.bottom+opening.height+cw/2),cw,.12*trim.projectionScale,outward,trim.profile,mat,tag);
}

const finishes=[
 {name:'Sealed smoked oak',color:'#636966'}, {name:'Sealed pale oak',color:'#c5b799'},
 {name:'Sealed honey oak',color:'#cca56e'}, {name:'Sealed ivory-tinted oak',color:'#e2d8bc'},
 {name:'Sealed golden oak',color:'#c5a567'}, {name:'Sealed dark walnut tone',color:'#705442'},
 {name:'Sealed amber oak',color:'#b58c54'}, {name:'Sealed washed oak',color:'#b8af9d'},
 {name:'Sealed seafoam-tinted oak',color:'#aac4bb'}, {name:'Sealed cedar tone',color:'#b48357'}
];
export function createTrimMaterial(profile:number,textures:T.Texture[],isActive:()=>boolean){
 const index=T.MathUtils.clamp(profile,0,9),finish=finishes[index];
 const placeholder=(color:string)=>{const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d')!;ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return c;};
 const maps=['oak-diff.jpg','oak-nor_gl.jpg','oak-rough.jpg'].map((file,i)=>{
  const texture:T.Texture<HTMLImageElement|HTMLCanvasElement>=new T.Texture<HTMLImageElement|HTMLCanvasElement>(placeholder(i===1?'#8080ff':'#ffffff'));texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;texture.needsUpdate=true;texture.userData={file,url:graphicsAsset('/materials/'+file)};if(i===0)texture.colorSpace=T.SRGBColorSpace;textures.push(texture);
  // A new Source for the photo: the 1×1 placeholder's GPU storage is immutable, so re-uploading into it fails.
  // Each texture releases its placeholder upload first, so three's per-source cache stays consistent.
  new T.ImageLoader().load(texture.userData.url,image=>{if(!isActive())return;const old=texture.source,source=new T.Source(image);for(const map of textures)if(map.source===old){map.dispose();map.source=source;map.needsUpdate=true;}},undefined,()=>{});return texture;
 });
 const mat=new T.MeshStandardMaterial({color:finish.color,map:maps[0],normalMap:maps[1],normalScale:new T.Vector2(.34,.34),roughnessMap:maps[2],roughness:.48,metalness:0});mat.name=finish.name;mat.userData={trimFinish:finish.name,textureCell:index,trimProfile:profile};return mat;
}

export function addScheduledTrim(scene:T.Object3D,m:any,interior:T.Material,exterior:T.Material,visibleHeight:number,roofVisible:boolean){
 addWindowRelief(scene,m,exterior,visibleHeight);
 for(const piece of m.trimPieces||[]){
  const roofPart=['cornice','frieze'].includes(piece.role);if(roofPart&&!roofVisible)continue;if(piece.role==='crown'&&visibleHeight<m.h-.01)continue;
  const a=new T.Vector3(piece.a[0]-m.w/2,piece.a[1],piece.a[2]-m.d/2),b=new T.Vector3(piece.b[0]-m.w/2,piece.b[1],piece.b[2]-m.d/2);
  if(!roofPart){if(Math.min(a.y,b.y)-piece.width/2>=visibleHeight)continue;if(Math.abs(a.y-b.y)>.01){a.y=Math.min(a.y,visibleHeight);b.y=Math.min(b.y,visibleHeight);}}
  const profile=m.trimPackage.parts[piece.role],tag=piece.openingId?{kind:'opening',id:piece.openingId,wallId:piece.wallId}:piece.wallId?{kind:'wall',wallId:piece.wallId}:undefined;
  const mesh=addTrimSegment(scene,a,b,piece.width,piece.projection,new T.Vector3(...piece.normal as [number,number,number]),profile,piece.exterior?exterior:interior,tag);
  if(mesh){mesh.userData.trimPiece=piece;mesh.userData.trimExterior=piece.exterior;if(piece.role==='corner')mesh.userData.trimCorner=piece;}
 }
}

export function addCornerMoulding(scene:T.Scene,wall:any,corner:any,material:T.Material,m:any,trim:any,visibleHeight:number){
 const along=wall.axis==='x',side=corner.side,top=Math.min(corner.top,visibleHeight),outward=new T.Vector3(along?0:side,0,along?side:0);
 const point=(y:number)=>new T.Vector3(wall.x+(along?corner.at:side*.245)-m.w/2,y,wall.z+(along?side*.245:corner.at)-m.d/2);
 const mesh=addTrimSegment(scene,point(corner.bottom),point(top),corner.width,.075*trim.projectionScale,outward,trim.profile,material,{kind:'wall',wallId:wall.id});
 if(mesh)mesh.userData.trimCorner=corner;
}

// Raised carving sits in front of the source-traced moulding. Every relief block
// comes from the Rust schedule and is included in its piece count and coating.
function addWindowRelief(scene:T.Object3D,m:any,material:T.Material,visibleHeight:number){
 const geometryCache=new Map<string,T.BufferGeometry>();
 for(const item of m.trimOrnaments||[]){
  if(item.position[1]+item.height/2>visibleHeight+.01)continue;
  const g=new T.Group(),normal=new T.Vector3(...item.normal as [number,number,number]);
  g.name='Carved window '+item.kind;g.position.set(item.position[0]-m.w/2,item.position[1],item.position[2]-m.d/2);g.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal);g.userData.editTarget={kind:'opening',id:item.openingId,wallId:item.wallId};g.userData.trimExterior=true;g.userData.trimOrnament=item;
  const key=[item.kind,item.width,item.height,item.depth].join(':');const cached=geometryCache.get(key);
  if(cached){const object=new T.Mesh(cached,material);object.castShadow=object.receiveShadow=true;object.userData.editTarget=g.userData.editTarget;object.userData.trimExterior=true;g.add(object);scene.add(g);continue;}
  const mesh=(geometry:T.BufferGeometry,x=0,y=0,z=0)=>{const object=new T.Mesh(geometry,material);object.position.set(x,y,z);object.castShadow=object.receiveShadow=true;object.userData.editTarget=g.userData.editTarget;object.userData.trimExterior=true;g.add(object);return object;};
  const w=item.width,h=item.height,d=item.depth;
  if(item.kind==='rosette'){
   // Chamfered square plinth and concentric rings with eight carved petals.
   mesh(new T.BoxGeometry(w,h,d*.58),0,0,d*.29);
   for(const [radius,tube,depth]of [[w*.39,w*.025,.61],[w*.32,w*.035,.66]])mesh(new T.TorusGeometry(radius,tube,6,24),0,0,d*depth);
   for(let i=0;i<8;i++){const angle=i*Math.PI/4;const petal=mesh(new T.SphereGeometry(w*.105,8,6),Math.cos(angle)*w*.18,Math.sin(angle)*h*.18,d*.73);petal.scale.set(1,1,.45);}
   const center=mesh(new T.SphereGeometry(w*.115,10,6),0,0,d*.77);center.scale.z=.45;
  }else if(item.kind==='keystone'){
   const shape=new T.Shape();shape.moveTo(-w*.32,-h/2);shape.lineTo(w*.32,-h/2);shape.lineTo(w/2,h/2);shape.lineTo(-w/2,h/2);shape.closePath();
   mesh(new T.ExtrudeGeometry(shape,{depth:d*.85,bevelEnabled:true,bevelSize:Math.min(w,h)*.045,bevelThickness:d*.08,bevelSegments:2,steps:1}),0,0,d*.05);
   for(const side of [-1,1])mesh(new T.BoxGeometry(w*.07,h*.72,d*.1),side*w*.22,0,d*.96);
  }else if(item.kind==='bead'){
   const bead=mesh(new T.SphereGeometry(w/2,10,7),0,0,d*.82);bead.scale.z=.55;
  }else if(item.kind==='layered-cap'){
   mesh(new T.BoxGeometry(w,h*.4,d*.68),0,-h*.3,d*.34);mesh(new T.BoxGeometry(w*1.015,h*.3,d*.85),0,h*.05,d*.425);mesh(new T.BoxGeometry(w*1.035,h*.3,d),0,h*.35,d*.5);
  }else{
   mesh(new T.BoxGeometry(w,h,d),0,0,d*.5);
   mesh(new T.BoxGeometry(w*.72,h*.12,d*.06),0,-h*.1,d*1.025);
  }
  const geometries=g.children.map(object=>{const part=object as T.Mesh;part.updateMatrix();const source=part.geometry;const geometry=(source.index?source.toNonIndexed():source.clone()).applyMatrix4(part.matrix);source.dispose();return geometry;});
  const merged=mergeGeometries(geometries,false);for(const geometry of geometries)geometry.dispose();
  if(merged){geometryCache.set(key,merged);g.clear();const object=new T.Mesh(merged,material);object.castShadow=object.receiveShadow=true;object.userData.editTarget=g.userData.editTarget;object.userData.trimExterior=true;g.add(object);}
  scene.add(g);
 }
}
