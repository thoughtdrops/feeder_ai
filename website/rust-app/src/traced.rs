use crate::*;
// Traced floor plans. A home read from a floor-plan picture keeps its own rooms: their sizes and positions
// become the walls, doors follow the usual room rules, and staging furnishes each room by its type. Rooms are
// stored for the size they were traced at and scale with the house when its width or depth is edited.

pub const KINDS:[&str;10]=["living","kitchen","dining","bedroom","bath","hall","foyer","stairs","flex","studio"];
#[derive(Clone,Serialize,Deserialize,Debug,Default)]#[serde(rename_all="camelCase",default)]
pub struct TracedWing{pub w:f64,pub d:f64,pub rooms:Vec<Room>}
#[derive(Clone,Serialize,Deserialize,Debug,Default)]#[serde(rename_all="camelCase",default)]
pub struct TracedPlan{pub width:f64,pub depth:f64,pub floors:Vec<Vec<Room>>,pub wings:Vec<TracedWing>}

/// The traced plan in effect: catalog homes and blank slates use their own layouts.
pub fn active(c:&Config)->Option<&TracedPlan>{if c.catalog_plan||c.design_mode=="Blank slate"{None}else{c.traced_plan.as_ref()}}

/// Rooms traced at `from` (width, depth), scaled to `to` on the 2-ft grid. Shared edges scale to the same
/// line, so rooms that tiled the traced floor still tile the new one.
pub fn scale(rooms:&[Room],from:(f64,f64),to:(f64,f64),prefix:&str,tag:&str)->Vec<Room>{
 let fx=|v:f64|if from.0>0.{grid(v*to.0/from.0).min(to.0)}else{v};let fz=|v:f64|if from.1>0.{grid(v*to.1/from.1).min(to.1)}else{v};
 rooms.iter().filter_map(|r|{let(x,z,x1,z1)=(fx(r.x),fz(r.z),fx(r.x+r.w),fz(r.z+r.d));(x1-x>=2.&&z1-z>=2.).then(||Room{id:format!("{}{}{}",prefix,r.id,tag),name:r.name.clone(),kind:r.kind.clone(),x,z,w:x1-x,d:z1-z})}).collect()
}

pub fn valid(t:&TracedPlan)->bool{
 let room=|r:&Room|!r.id.is_empty()&&r.id.len()<=48&&r.id.bytes().all(|b|b.is_ascii_alphanumeric()||b"-_".contains(&b))&&r.name.chars().count()<=60&&!r.name.chars().any(char::is_control)&&KINDS.contains(&r.kind.as_str())&&[r.x,r.z,r.w,r.d].iter().all(|v|v.is_finite()&&*v>=0.&&*v<=100.);
 [t.width,t.depth].iter().all(|v|v.is_finite()&&*v>=8.&&*v<=100.)&&t.floors.len()<=3&&t.floors.iter().all(|f|f.len()<=64&&f.iter().all(room))
  &&t.wings.len()<=2&&t.wings.iter().all(|g|[g.w,g.d].iter().all(|v|v.is_finite()&&*v>=0.&&*v<=100.)&&g.rooms.len()<=16&&g.rooms.iter().all(room))
}

/// A room as read from a plan, in feet.
#[derive(Clone,Debug)]pub struct Raw{pub name:String,pub kind:String,pub x:f64,pub z:f64,pub w:f64,pub d:f64}

/// The largest free rectangle of cells inside [x0,x1)×[z0,z1), as [x0,z0,x1,z1].
fn best_free(owner:&[i32],nx:usize,area:[usize;4])->Option<[usize;4]>{
 let[x0,z0,x1,z1]=area;let mut h=vec![0usize;nx];let mut best:Option<([usize;4],usize)>=None;
 for z in z0..z1{for x in x0..x1{h[x]=if owner[z*nx+x]<0{h[x]+1}else{0};}
  for a in x0..x1{let mut m=usize::MAX;for b in a..x1{m=m.min(h[b]);if m==0{break}let s=m*(b-a+1);if best.as_ref().is_none_or(|(_,bs)|s>*bs){best=Some(([a,z+1-m,b+1,z+1],s));}}}}
 best.map(|(r,_)|r)
}

/// Rooms read from a plan, made to tile a w × d floor exactly on the 2-ft grid. Overlaps go to the
/// smaller room (baths and closets keep their size), rooms grow evenly into gaps they border, and any space
/// left over becomes a hall or closet. `fixed` rooms (the stair) are placed first and never move.
pub fn tile(raw:&[Raw],fixed:&[Raw],w:f64,d:f64)->Vec<Room>{
 let(nx,nz)=((w/2.).round()as usize,(d/2.).round()as usize);if nx==0||nz==0{return vec![]}
 let snap=|v:f64,n:usize|((v/2.).round().max(0.)as usize).min(n);
 let cells=|r:&Raw|[snap(r.x,nx),snap(r.z,nz),snap(r.x+r.w,nx),snap(r.z+r.d,nz)];
 let mut owner=vec![-1i32;nx*nz];let mut placed:Vec<(Raw,[usize;4])>=vec![];
 let claim=|owner:&mut Vec<i32>,id:usize,r:[usize;4]|{for z in r[1]..r[3]{for x in r[0]..r[2]{owner[z*nx+x]=id as i32;}}};
 for f in fixed{let r=cells(f);if r[2]>r[0]&&r[3]>r[1]{claim(&mut owner,placed.len(),r);placed.push((f.clone(),r));}}
 let mut order:Vec<&Raw>=raw.iter().collect();order.sort_by(|a,b|(a.w*a.d).total_cmp(&(b.w*b.d)));
 // Each room keeps a workable minimum (a bath fits a toilet and vanity, a bedroom a bed), centred on its read spot.
 let least=|kind:&str|match kind{"bath"=>3usize,"bedroom"|"kitchen"=>4,"living"|"dining"=>4,_=>1};
 let widen=|a:usize,b:usize,min:usize,n:usize|{if b-a>=min||min>n{return(a,b)}let extra=min-(b-a);let a2=a.saturating_sub(extra/2);let b2=(a2+min).min(n);(b2-min,b2)};
 for r in order{let mut want=cells(r);if want[2]<=want[0]||want[3]<=want[1]{continue}let m=least(&r.kind);(want[0],want[2])=widen(want[0],want[2],m,nx);(want[1],want[3])=widen(want[1],want[3],m,nz);let size=(want[2]-want[0])*(want[3]-want[1]);
  if let Some(got)=best_free(&owner,nx,want){if (got[2]-got[0])*(got[3]-got[1])*5>=size*2{claim(&mut owner,placed.len(),got);placed.push((r.clone(),got));}}}
 // Grow one cell row at a time, room by room, so neighbors share a gap instead of one room taking it all.
 let locked=fixed.len();let mut changed=true;while changed{changed=false;for i in locked..placed.len(){let[x0,z0,x1,z1]=placed[i].1;
  let free=|o:&Vec<i32>,xs:std::ops::Range<usize>,zs:std::ops::Range<usize>|zs.clone().all(|z|xs.clone().all(|x|o[z*nx+x]<0));
  let grown=if x0>0&&free(&owner,x0-1..x0,z0..z1){Some([x0-1,z0,x1,z1])}else if x1<nx&&free(&owner,x1..x1+1,z0..z1){Some([x0,z0,x1+1,z1])}
   else if z0>0&&free(&owner,x0..x1,z0-1..z0){Some([x0,z0-1,x1,z1])}else if z1<nz&&free(&owner,x0..x1,z1..z1+1){Some([x0,z0,x1,z1+1])}else{None};
  if let Some(g)=grown{claim(&mut owner,i,g);placed[i].1=g;changed=true;}}}
 while let Some(r)=best_free(&owner,nx,[0,0,nx,nz]){let(fw,fd)=(((r[2]-r[0])*2)as f64,((r[3]-r[1])*2)as f64);
  let(name,kind)=if fw*fd<=36.{("Closet","flex")}else if fw.min(fd)<=6.{("Hall","hall")}else{("Open area","flex")};
  claim(&mut owner,placed.len(),r);placed.push((Raw{name:name.into(),kind:kind.into(),x:0.,z:0.,w:0.,d:0.},r));}
 placed.iter().enumerate().map(|(i,(r,c))|Room{id:format!("t{}-{}",i,r.kind),name:r.name.clone(),kind:r.kind.clone(),x:(c[0]*2)as f64,z:(c[1]*2)as f64,w:((c[2]-c[0])*2)as f64,d:((c[3]-c[1])*2)as f64}).collect()
}
