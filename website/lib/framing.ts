export type Opening={id:string;kind:'window'|'door'|'passage';at:number;width:number;bottom:number;height:number};
export type Wall={id:string;name:string;x:number;z:number;length:number;axis:'x'|'z';exterior:boolean;openings:Opening[]};
export type Stud={id:string;wallId:string;at:number;bottom:number;length:number;role:'Common'|'King'|'Jack'|'Cripple'|'Corner backing'|'Intersection backing'|'Gable';x:number;z:number;axis:'x'|'z'};
export type FrameMember={id:string;wallId:string;openingId?:string;role:string;material:'2x6'|'2x8';group:'Exterior framing'|'Interior framing';x1:number;y1:number;z1:number;x2:number;y2:number;z2:number;width:number;depth:number;length:number;stockLength:number};
const stock=(n:number)=>[8,10,12,16,20].find(s=>s+1e-6>=n)||Math.ceil(n/2)*2;
const round=(n:number)=>Math.round(n*1e6)/1e6;
export function buildFraming(walls:Wall[],h:number,pitch:number,d:number){
 const studs:Stud[]=[],members:FrameMember[]=[],counters:Record<string,number>={},headerDepth=7.25/12,thickness=5.5/12;
 const id=(wall:Wall)=>`${wall.id}-F${counters[wall.id]=(counters[wall.id]||0)+1}`;
 const point=(wall:Wall,at:number,y:number)=>({x:wall.x+(wall.axis==='x'?at:0),y,z:wall.z+(wall.axis==='z'?at:0)});
 function member(wall:Wall,role:string,a:{x:number;y:number;z:number},b:{x:number;y:number;z:number},width:number,depth:number,material:FrameMember['material']='2x6',openingId?:string){const length=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);if(length<.015)return;members.push({id:id(wall),wallId:wall.id,openingId,role,material,group:wall.exterior?'Exterior framing':'Interior framing',x1:a.x,y1:a.y,z1:a.z,x2:b.x,y2:b.y,z2:b.z,width,depth,length:round(length),stockLength:stock(length)});}
 function stud(wall:Wall,at:number,bottom:number,length:number,role:Stud['role'],openingId?:string){if(length<.015)return;const a=point(wall,at,bottom),b=point(wall,at,bottom+length);member(wall,role,a,b,wall.axis==='x'?.125:thickness,wall.axis==='x'?thickness:.125,'2x6',openingId);const m=members[members.length-1];studs.push({id:m.id,wallId:wall.id,at:round(at),bottom:round(bottom),length:round(length),role,x:a.x,z:a.z,axis:wall.axis});}
 function horizontal(wall:Wall,role:string,start:number,end:number,y:number,depth=.125,material:FrameMember['material']='2x6',openingId?:string,side=0,offsetSeams=false){let at=start,first=true;while(at<end-.001){const next=Math.min(end,at+(offsetSeams&&first?8:16)),a=point(wall,at,y),b=point(wall,next,y);if(wall.axis==='x'){a.z+=side;b.z+=side}else{a.x+=side;b.x+=side}member(wall,role,a,b,material==='2x8'?.125:thickness,depth,material,openingId);at=next;first=false;}}
 for(const wall of walls){
  const os=[...wall.openings].sort((a,b)=>a.at-b.at),endOffset=wall.exterior&&wall.axis==='z'?thickness/2+.0625:.0625,grid=[endOffset];for(let at=2;at<wall.length-endOffset;at+=2)grid.push(at);if(wall.length>endOffset*2)grid.push(wall.length-endOffset);
  for(const at of grid){const o=os.find(o=>at>o.at-.3125&&at<o.at+o.width+.3125);if(!o)stud(wall,at,.125,h-.375,'Common');else if(at>o.at+.125&&at<o.at+o.width-.125){stud(wall,at,o.bottom+o.height+headerDepth,h-.25-o.bottom-o.height-headerDepth,'Cripple',o.id);if(o.kind==='window')stud(wall,at,.125,o.bottom-.25,'Cripple',o.id);}}
  for(const o of os){for(const side of [-1,1]){const at=side<0?o.at-.1875:o.at+o.width+.1875;stud(wall,at,.125,h-.375,'King',o.id);stud(wall,side<0?o.at-.0625:o.at+o.width+.0625,.125,o.bottom+o.height-.125,'Jack',o.id);horizontal(wall,'Header ply',o.at-.125,o.at+o.width+.125,o.bottom+o.height+headerDepth/2,headerDepth,'2x8',o.id,side*(thickness-.125)/2);}
   if(o.kind==='window')horizontal(wall,'Rough sill',o.at,o.at+o.width,o.bottom-.0625,.125,'2x6',o.id);
  }
  let cursor=0;for(const o of os.filter(o=>o.kind!=='window')){horizontal(wall,'Bottom plate',cursor,o.at,.0625);cursor=o.at+o.width;}horizontal(wall,'Bottom plate',cursor,wall.length,.0625);
  horizontal(wall,'Lower top plate',0,wall.length,h-.1875);horizontal(wall,'Upper top plate',0,wall.length,h-.0625,.125,'2x6',undefined,0,true);
 }
 // Three-stud corner convention: one extra backing stud joins the two wall-end studs.
 // Gable-wall end studs are inset to meet, rather than overlap, the front/rear wall thickness.
 for(const wall of walls.filter(w=>w.exterior&&w.axis==='x'))for(const end of [0,wall.length])stud(wall,end===0?.1875:end-.1875,.125,h-.375,'Corner backing');
 // Add a single backing stud at actual perpendicular junctions, not at every arbitrary wall segment.
 const junctions=new Set<string>();
 for(const wall of walls.filter(w=>!w.exterior))for(const at of [0,wall.length]){const p=point(wall,at,0),touch=walls.some(other=>other.id!==wall.id&&other.axis!==wall.axis&&Math.abs((other.axis==='x'?p.z-other.z:p.x-other.x))<.001&&(other.axis==='x'?p.x>=other.x-.001&&p.x<=other.x+other.length+.001:p.z>=other.z-.001&&p.z<=other.z+other.length+.001));const key=`${wall.id}:${at}`;if(touch&&!junctions.has(key)){junctions.add(key);stud(wall,at===0?.1875:wall.length-.1875,.125,h-.375,'Intersection backing');}}
 const rise=d/2*pitch/12;
 for(const wall of walls.filter(w=>w.exterior&&w.axis==='z')){
  for(let z=2;z<d;z+=2){const total=Math.max(0,Math.min(z,d-z)*pitch/12-.125);let base=0;while(base<total-.015){const end=Math.min(total,(Math.floor(base/8)+1)*8);stud(wall,z,h+base,Math.max(0,end-base-(end<total?.125:0)),'Gable');base=end;}}
  for(let tier=8;tier<rise;tier+=8){const start=tier/(pitch/12),end=d-start;horizontal(wall,'Gable tier blocking',start,end,h+tier-.0625);}
  for(const [a,b]of [[0,d/2],[d/2,d]]){const pa=point(wall,a,h+Math.min(a,d-a)*pitch/12-.0625),pb=point(wall,b,h+Math.min(b,d-b)*pitch/12-.0625),length=Math.hypot(pb.y-pa.y,pb.z-pa.z),parts=Math.ceil(length/16);for(let i=0;i<parts;i++){const t=i/parts,u=(i+1)/parts;member(wall,'Gable rake plate',{x:pa.x,y:pa.y+(pb.y-pa.y)*t,z:pa.z+(pb.z-pa.z)*t},{x:pb.x,y:pa.y+(pb.y-pa.y)*u,z:pa.z+(pb.z-pa.z)*u},thickness,.125);}}
 }
 return {studs,members,headerDepth};
}
