import * as T from 'three';
export function addNorthArrow(scene:T.Object3D,m:any,bearing:number,textures:T.Texture[]){
 const g=new T.Group();g.name='North arrow';g.position.set(Math.max(m.w,m.garage&&m.garage.x>=m.w?m.garage.x+24:m.w)-m.w/2+7,-.47,0);g.rotation.y=(180-bearing)*Math.PI/180;
 const gold=new T.MeshStandardMaterial({color:'#f1c747',roughness:.7});
 const shaft=new T.Mesh(new T.BoxGeometry(.25,.07,3.2),gold);shaft.position.z=-.6;g.add(shaft);
 const head=new T.Mesh(new T.ConeGeometry(.7,1.3,3),gold);head.rotation.x=Math.PI/2;head.position.z=1.5;g.add(head);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,128,128);ctx.fillStyle='#f8d96a';ctx.font='bold 95px sans-serif';ctx.textAlign='center';ctx.fillText('N',64,101);
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;textures.push(map);const label=new T.Mesh(new T.PlaneGeometry(1.5,1.5),new T.MeshBasicMaterial({map,transparent:true,side:T.DoubleSide,depthWrite:false}));label.rotation.x=-Math.PI/2;label.position.set(0,.08,3.1);g.add(label);scene.add(g);return g;
}
export function watchHeading(camera:T.Camera,bearing:number,root:HTMLElement){
 const vector=new T.Vector3(),directions=['N','NE','E','SE','S','SW','W','NW'];let last='';
 return {update(){camera.getWorldDirection(vector);const degrees=((Math.atan2(vector.x,vector.z)*180/Math.PI+bearing+180)%360+360)%360;const text='Looking '+directions[Math.round(degrees/45)%8]+' · '+Math.round(degrees)%360+'°';const badge=root.querySelector<HTMLElement>('.camera-heading')||document.querySelector<HTMLElement>('.camera-heading');if(badge&&(badge.textContent!==text||text!==last)){badge.textContent=text;last=text;}},dispose(){const badge=document.querySelector<HTMLElement>('.camera-heading');if(badge)badge.textContent='';}};
}
