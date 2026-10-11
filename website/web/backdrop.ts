import * as T from 'three';
import {roofMaterial,slopeUV} from './roofing';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
// A sunny neighborhood around the house: a painted sky dome with soft cumulus, a street with curbs,
// sidewalks and street trees, rows of neighboring homes, back fences and hazy hills. Everything is
// procedural and merged into a handful of draw calls; it frames the house and never covers its lot.
export const SKY={zenith:'#2f78cf',horizon:'#c4dbee',sun:new T.Vector3(-.42,.72,-.48).normalize()};
type Bounds={minX:number,minZ:number,maxX:number,maxZ:number};
function rng(seed:number){return()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};}

export function addSky(scene:T.Scene){
 const material=new T.ShaderMaterial({uniforms:{sunDir:{value:SKY.sun.clone()},zenith:{value:new T.Color(SKY.zenith)},horizon:{value:new T.Color(SKY.horizon)}},side:T.BackSide,depthWrite:false,fog:false,
  vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;gl_Position.z*=.99999;}`,
  fragmentShader:`uniform vec3 sunDir;uniform vec3 zenith;uniform vec3 horizon;varying vec3 vDir;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<6;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}
void main(){vec3 d=normalize(vDir);float y=max(d.y,0.);vec3 sky=mix(horizon,zenith,pow(y,.32));float s=max(dot(d,sunDir),0.);
sky+=vec3(1.,.9,.72)*(pow(s,10.)*.16+pow(s,90.)*.4)+vec3(1.,.98,.9)*smoothstep(.9994,.9997,s)*3.;
if(d.y>0.){vec2 uv=d.xz/(d.y+.1)*.42+vec2(3.1,7.4);float n=fbm(uv);float cover=smoothstep(.48,.72,n)*smoothstep(.0,.06,d.y);
float n2=fbm(uv+sunDir.xz*.05);float lit=clamp(.62+(n-n2)*5.,.3,1.12);vec3 cloud=mix(vec3(.62,.67,.75),vec3(1.,.995,.985),lit)+vec3(1.,.93,.8)*pow(s,6.)*.2;
sky=mix(sky,cloud,cover*.96);}
if(d.y<0.)sky=horizon;gl_FragColor=vec4(sky,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
 const dome=new T.Mesh(new T.SphereGeometry(500,48,24),material);dome.name='Sky';dome.frustumCulled=false;dome.renderOrder=-10;
 dome.onBeforeRender=(_r,_s,camera)=>{dome.position.copy(camera.position);dome.updateMatrixWorld();};
 scene.add(dome);scene.fog=new T.Fog(SKY.horizon,340,860);return dome;
}

// Geometry builder: flat-shaded triangles with vertex colors and UVs in feet.
class Mesh{pos:number[]=[];col:number[]=[];uv:number[]=[];
 tri(a:number[],b:number[],c:number[],color:T.Color,ua=[a[0]+a[2],a[1]],ub=[b[0]+b[2],b[1]],uc=[c[0]+c[2],c[1]]){this.pos.push(...a,...b,...c);for(let i=0;i<3;i++)this.col.push(color.r,color.g,color.b);this.uv.push(...ua,...ub,...uc);}
 quad(a:number[],b:number[],c:number[],d:number[],color:T.Color,uvs?:number[][]){this.tri(a,b,c,color,uvs?.[0],uvs?.[1],uvs?.[2]);this.tri(a,c,d,color,uvs?.[0],uvs?.[2],uvs?.[3]);}
 box(cx:number,cy:number,cz:number,sx:number,sy:number,sz:number,color:T.Color){const x0=cx-sx/2,x1=cx+sx/2,y0=cy-sy/2,y1=cy+sy/2,z0=cz-sz/2,z1=cz+sz/2;
  const f=(a:number[],b:number[],c:number[],d:number[],u:(p:number[])=>number[])=>this.quad(a,b,c,d,color,[u(a),u(b),u(c),u(d)]);
  f([x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0],p=>[p[0],p[1]]);f([x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[x0,y0,z1],p=>[p[0],p[1]]);
  f([x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[x0,y0,z0],p=>[p[2],p[1]]);f([x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1],p=>[p[2],p[1]]);
  f([x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],p=>[p[0],p[2]]);f([x0,y0,z1],[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],p=>[p[0],p[2]]);}
 geometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.pos,3));g.setAttribute('color',new T.Float32BufferAttribute(this.col,3));g.setAttribute('uv',new T.Float32BufferAttribute(this.uv,2));g.computeVertexNormals();return g;}
}
const canvases=new Map<string,HTMLCanvasElement>();
function pattern(kind:string){let cvs=canvases.get(kind);if(cvs)return cvs;cvs=document.createElement('canvas');cvs.width=cvs.height=256;const ctx=cvs.getContext('2d')!;const r=rng(kind.length*131+7);
 if(kind==='siding'){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,256,256);for(let y=0;y<256;y+=21){const g=ctx.createLinearGradient(0,y,0,y+21);g.addColorStop(0,'rgba(0,0,0,.16)');g.addColorStop(.25,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(255,255,255,.05)');ctx.fillStyle=g;ctx.fillRect(0,y,256,21);}}
 else if(kind==='asphalt'){ctx.fillStyle='#5d6064';ctx.fillRect(0,0,256,256);for(let i=0;i<9000;i++){const v=70+r()*70;ctx.fillStyle=`rgba(${v},${v},${v+4},.45)`;ctx.fillRect(r()*256,r()*256,1.2,1.2);}for(let i=0;i<5;i++){ctx.strokeStyle='rgba(30,30,32,.25)';ctx.lineWidth=1;ctx.beginPath();let x=r()*256,y=r()*256;ctx.moveTo(x,y);for(let k=0;k<6;k++){x+=(r()-.5)*40;y+=(r()-.5)*40;ctx.lineTo(x,y);}ctx.stroke();}}
 else if(kind==='leaves'){ctx.fillStyle='#b9c4a8';ctx.fillRect(0,0,256,256);for(let i=0;i<5200;i++){const v=r();ctx.fillStyle=v<.5?`rgba(60,80,45,${.25+r()*.35})`:`rgba(235,245,215,${.15+r()*.25})`;ctx.beginPath();ctx.ellipse(r()*256,r()*256,1.5+r()*3,1+r()*2,r()*3,0,Math.PI*2);ctx.fill();}}
 else{ctx.fillStyle='#c9c7c0';ctx.fillRect(0,0,256,256);for(let i=0;i<5000;i++){const v=170+r()*60;ctx.fillStyle=`rgba(${v},${v},${v-4},.35)`;ctx.fillRect(r()*256,r()*256,1.4,1.4);}ctx.fillStyle='rgba(80,80,78,.55)';ctx.fillRect(0,0,256,2);ctx.fillRect(0,0,2,256);}
 canvases.set(kind,cvs);return cvs;}
function texture(kind:string,textures:T.Texture[],rx=1,ry=1){const t=new T.CanvasTexture(pattern(kind));t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rx,ry);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;textures.push(t);return t;}

const SIDING=['#ece8df','#d9d4c6','#b9c0bd','#8f9c96','#a8b7c4','#6f7f8c','#c9b79a','#e4dccb','#7d8a78','#9b5a4a','#b7a99a','#f1efe8'];
const ROOFS=['#3b3d40','#4a4744','#2f3438','#5a5048','#454d52','#3d3a37'];
const DOORS=['#7c2a24','#22344a','#1f2a24','#5a3b23','#2b2b2b','#3f5b4a'];

/** Adds the neighborhood. `hero` is the house site in world coordinates (feet); the house front faces -Z. */
export function addNeighborhood(root:T.Object3D,o:{hero:Bounds,groundY:number,entryX:number|null,mobile:boolean,textures:T.Texture[],grass:T.MeshStandardMaterial,seed:number}){
 const {hero,groundY:gy,mobile,textures}=o;const r=rng(o.seed||4242);const group=new T.Group();group.name='Neighborhood backdrop';root.add(group);
 const walls=new Mesh(),roofs=new Mesh(),trim=new Mesh(),glass=new Mesh(),paving=new Mesh(),concrete=new Mesh(),wood=new Mesh();const col=(c:string)=>new T.Color(c);
 // Ground: a broad lawn with gentle color variation, fading into haze.
 const ground=new T.PlaneGeometry(1700,1700,mobile?48:96,mobile?48:96);ground.rotateX(-Math.PI/2);const gc:number[]=[];const pos=ground.getAttribute('position');
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);const n=.5+.25*Math.sin(x*.021+Math.cos(z*.017)*2)+.25*Math.sin(z*.029+x*.011);const shade=.82+n*.22;gc.push(shade*.98,shade,shade*.9);}
 ground.setAttribute('color',new T.Float32BufferAttribute(gc,3));const grass=o.grass.clone();grass.vertexColors=true;for(const key of ['map','normalMap','roughnessMap'] as const){const t=(o.grass as any)[key] as T.Texture|null;if(t){const c=t.clone();c.repeat.set(1700/4.59,1700/4.59);textures.push(c);(grass as any)[key]=c;}}
 const lawn=new T.Mesh(ground,grass);lawn.position.y=gy;lawn.receiveShadow=true;lawn.name='Lawns';group.add(lawn);
 // The street runs along X in front of the house: yard, sidewalk, planting strip, curb, two lanes.
 const front=hero.minZ-22;const walk=[front-5,front],strip=[front-10,front-5],road=[front-38,front-10],farStrip=[front-43,front-38],farWalk=[front-48,front-43];
 const y0=gy+.02,len=1400;
 const flat=(m:Mesh,z0:number,z1:number,y:number,color:T.Color,x0=-len/2,x1=len/2)=>m.quad([x0,y,z0],[x0,y,z1],[x1,y,z1],[x1,y,z0],color,[[x0/5,z0/5],[x0/5,z1/5],[x1/5,z1/5],[x1/5,z0/5]]);
 flat(paving,road[0],road[1],y0,col('#ffffff'));for(const s of [walk,farWalk])flat(concrete,s[0],s[1],y0+.12,col('#e6e3dc'));
 for(const z of [road[1],road[0]])concrete.box(0,y0+.25,z+(z===road[1]?.25:-.25),len,.5,.5,col('#d8d6cf'));
 if(o.entryX!==null)flat(concrete,front,hero.minZ,y0+.1,col('#e2dfd8'),o.entryX-2,o.entryX+2);
 // Faint center line dashes.
 for(let x=-len/2;x<len/2;x+=24)paving.quad([x,y0+.015,(road[0]+road[1])/2-.25],[x,y0+.015,(road[0]+road[1])/2+.25],[x+10,y0+.015,(road[0]+road[1])/2+.25],[x+10,y0+.015,(road[0]+road[1])/2-.25],col('#d9b24a'),[[0,0],[0,0],[0,0],[0,0]]);
 // Houses: one row each side of the hero lot, a row across the street and a row behind the back fences.
 const trees:{x:number,z:number,s:number,conifer:boolean,c:T.Color}[]=[];
 const house=(cx:number,z0:number,facing:1|-1,W:number,D:number)=>{
  const stories=r()<.55?2:1,H=stories*9+.5,base=gy;const zFront=z0,zBack=z0+facing*D,zc=(zFront+zBack)/2;const siding=col(SIDING[Math.floor(r()*SIDING.length)]),roofC=col(ROOFS[Math.floor(r()*ROOFS.length)]),white=col('#f3f1eb');
  walls.box(cx,base+H/2,zc,W,H,D,siding);concrete.box(cx,base+.4,zc,W+.4,1,D+.4,col('#b9b5ab'));
  // Roof: side gable, front gable or hip, 6:12–10:12 with a 1 ft overhang.
  const p=(6+Math.floor(r()*5))/12,ov=1,top=base+H,kind=r();const x0=cx-W/2-ov,x1=cx+W/2+ov,za=Math.min(zFront,zBack)-ov,zb=Math.max(zFront,zBack)+ov;
  const add=(pts:number[][],plane:number[])=>{const uv=pts.map(q=>{const [u,v]=slopeUV(q,plane);return [u/4,v/3.75];});if(pts.length===3)roofs.tri(pts[0],pts[1],pts[2],roofC,uv[0],uv[1],uv[2]);else roofs.quad(pts[0],pts[1],pts[2],pts[3],roofC,uv);};
  if(kind<.45){const rz=(za+zb)/2,ry=top+(D/2)*p,ey=top-ov*p;add([[x0,ey,za],[x0,ry,rz],[x1,ry,rz],[x1,ey,za]],[0,p,0]);add([[x1,ey,zb],[x1,ry,rz],[x0,ry,rz],[x0,ey,zb]],[0,-p,0]);for(const x of [cx-W/2,cx+W/2])walls.tri([x,top,Math.min(zFront,zBack)],[x,top+(D/2)*p,rz],[x,top,Math.max(zFront,zBack)],siding);}
  else if(kind<.75||W<D){const rx=cx,ry=top+(W/2)*p,ey=top-ov*p;add([[x0,ey,zb],[rx,ry,zb],[rx,ry,za],[x0,ey,za]],[p,0,0]);add([[x1,ey,za],[rx,ry,za],[rx,ry,zb],[x1,ey,zb]],[-p,0,0]);for(const z of [Math.min(zFront,zBack),Math.max(zFront,zBack)])walls.tri([cx-W/2,top,z],[cx,top+(W/2)*p,z],[cx+W/2,top,z],siding);}
  else{const half=Math.min(W,D)/2+ov,ry=top+(Math.min(W,D)/2)*p,ey=top-ov*p;const ix=W>=D?[x0+half,x1-half]:[cx,cx],iz=W>=D?[(za+zb)/2,(za+zb)/2]:[za+half,zb-half];
   add([[x0,ey,za],[ix[0],ry,iz[0]],[ix[1],ry,iz[1]],[x1,ey,za]],[0,p,0]);add([[x1,ey,zb],[ix[1],ry,iz[1]],[ix[0],ry,iz[0]],[x0,ey,zb]],[0,-p,0]);add([[x0,ey,zb],[ix[0],ry,iz[0]],[x0,ey,za]],[p,0,0]);add([[x1,ey,za],[ix[1],ry,iz[1]],[x1,ey,zb]],[-p,0,0]);}
  trim.box(cx,top-.15,zc,W+.5,.3,D+.5,white);for(const x of [cx-W/2,cx+W/2])for(const z of [zFront,zBack])trim.box(x,base+H/2,z,.55,H,.55,white);const shutters=r()<.5?col(['#1f2a33','#2d3b2f','#5b2a26','#3a3f45'][Math.floor(r()*4)]):null;
  if(r()<.4)walls.box(cx+(r()<.5?-1:1)*W*.3,top+(D/2)*p*.8,zc+facing*D*.15,2.4,(D/2)*p+3,2.4,col('#8a4f3e'));
  // Windows and a front door with trim; upper rows on two-story homes.
  const face=zFront-facing*.06,cols=Math.max(2,Math.round(W/9));for(let s=0;s<stories;s++)for(let i=0;i<cols;i++){const x=cx-W/2+(i+.5)*W/cols;if(s===0&&i===Math.floor(cols/2))continue;const y=base+s*9+3.2;trim.box(x,y+2.1,face,3.4,4.6,.25,white);glass.box(x,y+2.1,face-facing*.08,2.7,3.9,.12,col('#33424d'));if(shutters)for(const sx of [x-2.4,x+2.4])wood.box(sx,y+2.1,face-facing*.05,1.3,4.6,.15,shutters);}
  const dx=cx-W/2+(Math.floor(cols/2)+.5)*W/cols;trim.box(dx,base+3.6,face,3.8,7.4,.25,white);wood.box(dx,base+3.5,face-facing*.1,3.1,6.9,.15,col(DOORS[Math.floor(r()*DOORS.length)]));
  for(const x of [cx-W/2-.06,cx+W/2+.06])for(let s=0;s<stories;s++){const z=zc+(r()-.5)*D*.3;trim.box(x,base+s*9+5.3,z,.25,4.6,3.4,white);glass.box(x+(x<cx?-.08:.08),base+s*9+5.3,z,.12,3.9,2.7,col('#33424d'));}
  // Front porch on some homes; a driveway to the street on all homes on our street.
  if(r()<.45){const pz=zFront-facing*4;wood.box(dx,base+.6,pz,10,.5,8,col('#cfc8ba'));trim.box(dx,base+8.6,pz,11,.5,8.6,white);for(const x of [dx-4.6,dx+4.6])trim.box(x,base+4.6,zFront-facing*7.6,.5,8,.5,white);}
  return {stories,H};
 };
 const sideRow=(dir:1|-1,count:number)=>{let x=dir<0?hero.minX-30:hero.maxX+48;for(let i=0;i<count;i++){const W=28+Math.floor(r()*14),D=28+Math.floor(r()*10),gap=22+r()*10;const cx=x+dir*(W/2);const z0=front+20+r()*8;house(cx,z0,1,W,D);
   flat(concrete,front,z0,y0+.08,col('#d5d2ca'),cx+dir*(W/2-6)-5,cx+dir*(W/2-6)+5);trees.push({x:cx-dir*(W/2+gap/2),z:z0+D+18+r()*12,s:.9+r()*.6,conifer:r()<.25,c:col('#56783f')});
   wood.box(cx,gy+3,z0+D+30,W+gap,6,.3,col('#a68b6a'));x+=dir*(W+gap);}};
 const n=mobile?3:6;sideRow(-1,n);sideRow(1,n);
 // Hero back fence and the row of houses behind it.
 const back=Math.max(hero.maxZ,front+60)+28;wood.box((hero.minX+hero.maxX)/2,gy+3,back,hero.maxX-hero.minX+28,6,.3,col('#a68b6a'));
 for(let x=-260;x<260;x+=48+r()*10){const W=30+Math.floor(r()*10);house(x,back+70+r()*10,-1,W,30);}
 for(let x=-300;x<300;x+=44+r()*12){const W=28+Math.floor(r()*12);if(Math.abs(x)<8)continue;house(x,farWalk[0]-24-r()*6,-1,W,28+Math.floor(r()*8));}
 // Street trees in the planting strips, yard trees, and a far tree line.
 for(const z of [(strip[0]+strip[1])/2,(farStrip[0]+farStrip[1])/2])for(let x=-420+r()*20;x<420;x+=34+r()*12){if(z>front-8&&Math.abs(x-(o.entryX??1e9))<10)continue;trees.push({x,z,s:.85+r()*.45,conifer:false,c:col(r()<.5?'#4e7139':'#5f7f3f')});}
 for(let i=0;i<(mobile?60:150);i++){const a=r()*Math.PI*2,d=320+r()*260;trees.push({x:Math.cos(a)*d,z:Math.sin(a)*d,s:1.2+r()*1.6,conifer:r()<.35,c:col(['#3e5f31','#4d6e38','#5b7a40','#46663a'][Math.floor(r()*4)])});}
 for(let x=hero.minX-10;x<hero.maxX+10;x+=26)if(r()<.7)trees.push({x:x+r()*6,z:back+12+r()*10,s:1+r()*.5,conifer:r()<.4,c:col('#4a7536')});
 const siding=new T.MeshStandardMaterial({vertexColors:true,map:texture('siding',textures,1/7,1/7),roughness:.86});
 const shingles=roofMaterial('Architectural asphalt shingles','#ffffff',textures,8);shingles.vertexColors=true;shingles.color.set('#ffffff');
 const add=(m:Mesh,mat:T.Material,name:string,shadow=false)=>{if(!m.pos.length)return;const mesh=new T.Mesh(m.geometry(),mat);mesh.name=name;mesh.receiveShadow=true;mesh.castShadow=shadow;group.add(mesh);};
 add(walls,siding,'Neighbor homes');add(roofs,shingles,'Neighbor roofs');add(trim,new T.MeshStandardMaterial({vertexColors:true,roughness:.6}),'Neighbor trim');
 add(glass,new T.MeshStandardMaterial({vertexColors:true,roughness:.08,metalness:.6}),'Neighbor windows');add(wood,new T.MeshStandardMaterial({vertexColors:true,roughness:.8}),'Fences, porches and doors');
 add(paving,new T.MeshStandardMaterial({vertexColors:true,map:texture('asphalt',textures,1,1),roughness:.95}),'Street');add(concrete,new T.MeshStandardMaterial({vertexColors:true,map:texture('concrete',textures,1,1),roughness:.9}),'Sidewalks, curbs and drives');
 // Trees: instanced trunks and leafy canopies (three blobs each), conifers as stacked cones.
 const leafy=trees.filter(t=>!t.conifer),cones=trees.filter(t=>t.conifer);const dummy=new T.Object3D();
 const trunks=new T.InstancedMesh(new T.CylinderGeometry(.45,.7,1,7),new T.MeshStandardMaterial({color:'#5b4636',roughness:.95}),trees.length);
 trees.forEach((t,i)=>{const h=(t.conifer?6:9)*t.s;dummy.position.set(t.x,gy+h/2,t.z);dummy.scale.set(t.s,h,t.s);dummy.rotation.set(0,0,0);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);});trunks.name='Tree trunks';group.add(trunks);
 const blob=mergeVertices(new T.IcosahedronGeometry(1,3));const bp=blob.getAttribute('position');for(let i=0;i<bp.count;i++){const x=bp.getX(i),y=bp.getY(i),z=bp.getZ(i);const k=.88+.12*Math.sin(x*5.1+y*3.3)*Math.cos(z*4.7-y*2.1)+.05*Math.sin(x*13+z*11);bp.setXYZ(i,x*k,y*k*.88,z*k);}blob.computeVertexNormals();
 const leaves=texture('leaves',textures,3,2);const canopy=new T.InstancedMesh(blob,new T.MeshStandardMaterial({color:'#ffffff',map:leaves,bumpMap:leaves,bumpScale:3,roughness:.95}),leafy.length*4);let k=0;
 for(const t of leafy){for(let j=0;j<4;j++){const s=t.s*(4.6+r()*2.4);dummy.position.set(t.x+(r()-.5)*6*t.s,gy+9*t.s+s*.5+(j>=2?3.2*t.s:0),t.z+(r()-.5)*6*t.s);dummy.scale.set(s,s*.85,s);dummy.rotation.set(r(),r()*3,0);dummy.updateMatrix();canopy.setMatrixAt(k,dummy.matrix);canopy.setColorAt(k,t.c.clone().offsetHSL((r()-.5)*.03,(r()-.5)*.1,(r()-.5)*.08));k++;}}
 canopy.name='Tree canopies';canopy.receiveShadow=true;group.add(canopy);
 const cone=new T.ConeGeometry(1,1,12,3);const conifers=new T.InstancedMesh(cone,new T.MeshStandardMaterial({color:'#ffffff',map:leaves,roughness:.92}),Math.max(1,cones.length*2));k=0;
 for(const t of cones){for(let j=0;j<2;j++){const h=14*t.s*(j?.7:1),rad=4.2*t.s*(j?.75:1);dummy.position.set(t.x,gy+5*t.s+h/2+j*6*t.s,t.z);dummy.scale.set(rad,h,rad);dummy.rotation.set(0,r()*3,0);dummy.updateMatrix();conifers.setMatrixAt(k,dummy.matrix);conifers.setColorAt(k,col(r()<.5?'#2f5530':'#3a6236').offsetHSL(0,0,(r()-.5)*.06));k++;}}
 conifers.count=k;conifers.name='Conifers';group.add(conifers);
 // Low hills on the horizon, softened by the haze.
 const segs=96,hills=new T.BufferGeometry(),hp:number[]=[],hc:number[]=[];const hillColor=new T.Color('#5d7b55');
 for(let i=0;i<segs;i++){const a0=i/segs*Math.PI*2,a1=(i+1)/segs*Math.PI*2;const hgt=(a:number)=>18+14*Math.sin(a*3+1)+9*Math.sin(a*7+2)+5*Math.sin(a*13);
  const p=(a:number,rad:number,y:number)=>[Math.cos(a)*rad,y,Math.sin(a)*rad];const q=[p(a0,600,gy),p(a1,600,gy),p(a1,700,gy+hgt(a1)),p(a0,700,gy+hgt(a0))];
  for(const v of [q[0],q[1],q[2],q[0],q[2],q[3]]){hp.push(...v);hc.push(hillColor.r,hillColor.g,hillColor.b);}}
 hills.setAttribute('position',new T.Float32BufferAttribute(hp,3));hills.setAttribute('color',new T.Float32BufferAttribute(hc,3));hills.computeVertexNormals();
 const ridge=new T.Mesh(hills,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}));ridge.name='Distant hills';group.add(ridge);
 return group;
}
