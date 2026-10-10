export type Room={id:string;name:string;type:string;x:number;z:number;w:number;d:number};
export type LayoutStyle={name:string;family:string;variant:number;index:number;description:string;hallways:boolean};
const recipes=[
 ['Great room · no hall',['Rear bedrooms','Screened kitchen','Dining divide'],'Bedrooms and services open directly from the shared living space.',false],
 ['Central spine',['Straight spine','Offset spine','Wide gallery'],'A longitudinal hall divides two private wings.',true],
 ['Cross gallery',['Front hall','Middle hall','Rear hall'],'A transverse hall separates social and private room groups.',true],
 ['L-shaped hall',['Left turn','Right turn','Deep turn'],'A side passage turns across two private room groups.',true],
 ['Corner rooms · no hall',['Social cross','Dining hub','Screened hub'],'Private corner rooms surround connected social spaces.',false],
 ['Twin wings · no hall',['Family center','Dining center','Studio center'],'Private wings open into a central shared room.',false],
 ['H-shaped gallery',['Balanced wings','Offset wings','Broad wings'],'Two parallel halls connect through a central gallery.',true],
 ['Long living · no hall',['Kitchen end','Kitchen side','Dining end'],'A full-depth social room links private rooms without a corridor.',false],
 ['Entry T-hall',['Centered entry','Offset entry','Double lounge'],'An entry passage joins a cross hall and private rear rooms.',true],
 ['Stepped gallery',['Left step','Right step','Alternating step'],'Successive room groups connect through an offset passage.',true],
] as const;
export const layoutStyles:LayoutStyle[]=recipes.flatMap(([family,names,description,hallways],f)=>names.map((name,variant)=>({name:`${family} · ${name}`,family,variant,index:f*3+variant,description,hallways})));
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export function createLayout(width:number,depth:number,requestedBedrooms:number,name:string){
 const style=layoutStyles.find(s=>s.name===name)||layoutStyles[0],f=Math.floor(style.index/3),v=style.variant,rotated=depth>width,U=Math.max(width,depth),V=Math.min(width,depth),area=width*depth,rooms:Room[]=[],cells:Room[]=[];let n=0;
 const add=(id:string,name:string,type:string,x:number,z:number,w:number,d:number)=>{if(w>.01&&d>.01)rooms.push({id,name,type,x,z,w,d})};
 const cell=(x:number,z:number,w:number,d:number)=>{const r={id:`cell-${++n}`,name:'Flexible room',type:'flex',x,z,w,d};rooms.push(r);cells.push(r)};
 const row=(x:number,z:number,w:number,d:number,count:number)=>{let at=x;for(let i=0;i<count;i++){const cw=i===count-1?x+w-at:w/count*(i===(v%count)?1.04:1-(.04/(Math.max(2,count)-1)));cell(at,z,cw,d);at+=cw;}};
 const social=(x:number,z:number,w:number,d:number)=>{if(w<12||d<9){add('living','Living / sleeping studio','studio',x,z,w,d);return;}const kitchen=w*(.30+v*.045),left=v===1;if(v===2&&w>36){add('living','Lounge','living',x,z,w*.44,d);add('dining','Dining room','dining',x+w*.44,z,w-kitchen-w*.44,d);add('kitchen','Kitchen','kitchen',x+w-kitchen,z,kitchen,d);}else{add('living','Living & dining','living',x+(left?kitchen:0),z,w-kitchen,d);add('kitchen','Kitchen','kitchen',x+(left?0:w-kitchen),z,kitchen,d);}};
 let program='Full home',note=style.description;
 if(area<144||U<17){add('living','Multipurpose studio','studio',0,0,U,V);program='Micro studio';note='A foldaway bed and compact kitchenette share one room. This footprint has no separate bedroom or bathroom.';}
 else if(V<24||U<32){
  program='Compact home';const end=clamp(U*(.24+v*.035),5.5,Math.min(9,U*.42)),front=U-end;
  if(V>=14&&U>=34&&style.hallways){const publicEnd=clamp(U*.42,14,24),hall=3.5;social(0,0,publicEnd,V);add('hall','Side hall','hall',publicEnd,0,U-publicEnd,hall);const count=Math.max(2,Math.floor((U-publicEnd)/11));for(let i=0;i<count;i++)cell(publicEnd+i*(U-publicEnd)/count,hall,(U-publicEnd)/count,V-hall);}
  else if(V>=14&&U>=30){const wing=Math.max(10,U*(.42+v*.035));add('living','Living & sleeping','studio',0,0,wing,V);add('kitchen','Kitchen & dining','kitchen',wing,0,U-wing,V*.48);row(wing,V*.48,U-wing,V*.52,Math.min(2,Math.floor((U-wing)/5)));}
  else{add('living','Living / sleeping studio','studio',0,0,front,V);cell(front,0,end,V);}
  note=style.hallways&&rooms.some(r=>r.type==='hall')?'Compact rooms have a shared side hall.':'A compact, direct-access arrangement uses shared living space for circulation.';
 }else{
  const hall=4,front=clamp(V*(.39+v*.055),11,V-10),columns=Math.max(2,Math.min(7,Math.floor(U/9.5),requestedBedrooms+1||2));
  if(f===0){social(0,0,U,front);row(0,front,U,V-front,columns);}
  if(f===1){const top=clamp(V*(.27+v*.04),10,V-10),left=(U-hall)*(.43+v*.06),right=U-left-hall,bands=Math.max(2,Math.floor((V-top)/11));social(0,0,U,top);add('hall','Central spine','hall',left,top,hall,V-top);for(let b=0;b<bands;b++){const bd=(V-top)/bands;cell(0,top+b*bd,left,bd);cell(left+hall,top+b*bd,right,bd);}}
  if(f===2){const z=v===0?front:V*(v===1?.48:.65);social(0,0,U,z);add('hall','Cross gallery','hall',0,z,U,hall);row(0,z+hall,U,V-z-hall,columns);}
  if(f===3){const top=V*(.28+v*.035),sideLeft=v!==1,x=sideLeft?hall:0,usable=U-hall,turn=top+(V-top)*(.44+v*.045);social(0,0,U,top);add('spine','Side passage','hall',sideLeft?0:U-hall,top,hall,V-top);add('hall','Turning hall','hall',x,turn,usable,hall);row(x,top,usable,turn-top,Math.max(2,Math.min(3,columns)));row(x,turn+hall,usable,V-turn-hall,Math.max(2,columns));}
  if(f===4){const a=U*(.29+v*.025),b=V*(.28+v*.035),mx=U-2*a,mz=V-2*b;cell(0,0,a,b);cell(U-a,0,a,b);cell(0,V-b,a,b);cell(U-a,V-b,a,b);add('kitchen','Kitchen','kitchen',a,0,mx,b);add('living','Central lounge','living',a,b,mx,mz);add('dining','Dining room','dining',a,V-b,mx,b);add('left-social','Reading lounge','flex',0,b,a,mz);add('right-social','Family lounge','flex',U-a,b,a,mz);}
  if(f===5){const top=clamp(V*.31,11,V-12),side=U*(.28+v*.035),center=U-2*side,bands=Math.max(2,Math.floor((V-top)/12));social(0,0,U,top);add('wing-center',v===0?'Family room':v===1?'Shared dining room':'Project studio','flex',side,top,center,V-top);for(let b=0;b<bands;b++){const bd=(V-top)/bands;cell(0,top+b*bd,side,bd);cell(U-side,top+b*bd,side,bd);}}
  if(f===6){const side=U*(.25+v*.018),middle=U-2*side-2*hall,z=V*(.43+v*.045),top=z,back=V-z-hall;cell(0,0,side,top);cell(U-side,0,side,top);cell(0,z+hall,side,back);cell(U-side,z+hall,side,back);add('left-hall','West gallery','hall',side,0,hall,V);add('right-hall','East gallery','hall',U-side-hall,0,hall,V);add('hall','Connecting gallery','hall',side+hall,z,middle,hall);add('west-link','West cross hall','hall',0,z,side,hall);add('east-link','East cross hall','hall',U-side,z,side,hall);social(side+hall,0,middle,z);add('rear-social','Family room','flex',side+hall,z+hall,middle,back);}
  if(f===7){const main=U*(.45+v*.055),right=U-main,bands=Math.max(2,Math.min(7,Math.floor(V/10)));social(0,0,main,V);for(let b=0;b<bands;b++){const bd=V/bands;cell(main,b*bd,right,bd);}}
  if(f===8){const top=clamp(V*(.42+v*.04),12,V-10),left=(U-hall)*(.42+v*.07);add('entry-hall','Entry hall','hall',left,0,hall,top);add('living','Living & dining','living',0,0,left,top);add('east-living','Kitchen / family room','kitchen',left+hall,0,U-left-hall,top);add('hall','Private cross hall','hall',0,top,U,hall);row(0,top+hall,U,V-top-hall,columns);}
  if(f===9){const bands=Math.max(2,Math.min(4,Math.floor(V/12))),bd=V/bands;for(let b=0;b<bands;b++){const offset=(U-hall)*(v===2?[.44,.68,.32,.55][b]:((b+v)%2?.61:.34));add(`step-hall-${b}`,'Stepped hall '+(b+1),'hall',offset,b*bd,hall,bd);if(b===0){add('living','Living & dining','living',0,0,offset,bd);add('step-kitchen','Kitchen','kitchen',offset+hall,0,U-offset-hall,bd);}else{cell(0,b*bd,offset,bd);cell(offset+hall,b*bd,U-offset-hall,bd);}}
   // Open transition strips join the staggered hall sections.
   for(let b=1;b<bands;b++){const z=b*bd,previous=rooms.filter(r=>r.id===`step-hall-${b-1}`)[0],current=rooms.filter(r=>r.id===`step-hall-${b}`)[0];const x=Math.min(previous.x,current.x),end=Math.max(previous.x,current.x)+hall;for(const r of [...rooms].filter(r=>Math.abs(r.z-z)<.001&&r.type!=='hall')){const ix=Math.max(x,r.x),ir=Math.min(end,r.x+r.w);if(ir>ix){const idx=rooms.indexOf(r),ci=cells.indexOf(r);rooms.splice(idx,1);if(ci>=0)cells.splice(ci,1);if(ix>r.x)cell(r.x,r.z,ix-r.x,r.d);if(ir<r.x+r.w)cell(ir,r.z,r.x+r.w-ir,r.d);if(r.d>hall)cell(ix,r.z+hall,ir-ix,r.d-hall);add(`step-link-${b}-${r.id}`,'Cross passage','hall',ix,r.z,ir-ix,hall);}}}
  }
 }
 // Assign bedrooms only to cells with an exterior wall. Baths use an available cell.
 const exteriorCells=cells.filter(r=>r.w>=7&&r.d>=7&&(r.x<.001||r.z<.001||Math.abs(r.x+r.w-U)<.001||Math.abs(r.z+r.d-V)<.001));
 const beds=Math.min(requestedBedrooms,Math.max(0,cells.length-1),exteriorCells.length);let bed=0;
 for(const r of exteriorCells.slice(0,beds)){r.id=bed===0?'primary':`bed-${bed}`;r.name=bed===0?'Primary bedroom':`Bedroom ${bed+1}`;r.type='bedroom';bed++;}
 let bath=0,flex=0;const bathTarget=area<144?0:Math.min(3,Math.max(1,Math.floor(area/2100)),cells.length-beds);
 for(const r of cells.filter(r=>r.type!=='bedroom')){if(bath<bathTarget){r.id=`bath-${bath}`;r.name=bath===0?'Bathroom':`Bathroom ${bath+1}`;r.type='bath';bath++;}else{r.name=['Office','Utility / laundry','Family room','Dressing room'][flex%4]+(flex>=4?' '+(Math.floor(flex/4)+1):'');r.type='flex';flex++;}}
 if(rotated)for(const r of rooms){[r.x,r.z]=[r.z,r.x];[r.w,r.d]=[r.d,r.w];}
 return {rooms,style,program,note,bedrooms:bed,baths:bath,rotated};
}
