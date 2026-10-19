use crate::*;
// Every room gets its full set of pieces. After the core staging (beds, sofas, kitchens, baths) each room is
// offered the rest of the pieces its type calls for, from the full item catalog: nightstands and a dresser
// in a bedroom, a sideboard in a dining room, a console and coat stand in a foyer, a hamper in a bath. Each
// piece goes with its back to a wall where it fits: inside the room, clear of doors, walkways, windows (for
// tall pieces) and every other piece. The same rules run in every house, traced plans included.

/// The pieces each room type is offered, most important first.
fn wanted(r:&Room)->&'static [&'static str]{
 let name=r.name.to_lowercase();
 match r.kind.as_str(){
  "bedroom"=>&["nightstand","dresser","bench","accent-chair","floorlamp","plant"],
  "living"|"studio"=>&["side-table","accent-chair","bookcase","floorlamp","plant","ottoman"],
  "dining"=>&["sideboard","china-cabinet","plant"],
  "kitchen"=>&["kitchen-trolley","plant"],
  "bath"=>&["towel-stand","hamper","plant"],
  "foyer"=>&["entry-console","coat-stand","storage-bench","shoe-cabinet","plant"],
  "flex" if name.contains("laundry")||name.contains("mudroom")||name.contains("utility")=>&["laundry","linen-cabinet","storage-bench","coat-stand"],
  "flex" if name.contains("office")||name.contains("study")||name.contains("den")=>&["desk","office-chair","bookcase","filing-cabinet","floorlamp"],
  "flex" if name.contains("closet")||name.contains("pantry")=>&[],
  "flex"=>&["loveseat","reading-shelf","floorlamp","plant"],
  _=>&[],
 }
}
/// Pieces that would block a window if stood in front of one.
const TALL:[&str;10]=["bookcase","china-cabinet","dresser","linen-cabinet","shoe-cabinet","coat-stand","reading-shelf","filing-cabinet","laundry","wardrobe"];

fn rect(f:&staging::Furniture,pad:f64)->[f64;4]{[f.x-f.w/2.-pad,f.z-f.d/2.-pad,f.x+f.w/2.+pad,f.z+f.d/2.+pad]}

/// A spot for `kind` in room `r`, with its back to one of the room's walls, or None.
fn spot(kind:&str,r:&Room,ws:&[Wall],fs:&[staging::Furniture],zones:&[accessibility::Clearance])->Option<staging::Furniture>{
 let(lw,ld)=edit::item_dimensions(kind);let inset=0.3;
 // Back against the front, right, back and left walls of the room in turn.
 for side in 0..4{
  let rotation=[0.,std::f64::consts::FRAC_PI_2,std::f64::consts::PI,3.*std::f64::consts::FRAC_PI_2][side];
  let along_x=side%2==0;let(span0,span1)=if along_x{(r.x+inset+lw/2.,r.x+r.w-inset-lw/2.)}else{(r.z+inset+lw/2.,r.z+r.d-inset-lw/2.)};
  if span1<span0{continue}
  let fixed=match side{0=>r.z+inset+ld/2.,1=>r.x+r.w-inset-ld/2.,2=>r.z+r.d-inset-ld/2.,_=>r.x+inset+ld/2.};
  let steps=((span1-span0)/0.5).floor()as usize;
  for i in 0..=steps{
   let along=span0+i as f64*0.5;let(x,z)=if along_x{(along,fixed)}else{(fixed,along)};
   let mut f=staging::Furniture{id:String::new(),kind:kind.into(),room_id:r.id.clone(),x,z,w:lw,d:ld,rotation:0.,local_width:lw,local_depth:ld};edit::rotate_item(&mut f,rotation);
   let b=rect(&f,0.);if b[0]<r.x+0.25||b[1]<r.z+0.25||b[2]>r.x+r.w-0.25||b[3]>r.z+r.d-0.25{continue}
   if accessibility::item_error(&f,zones).is_some()||!edit::clear_of_walls(&f,ws){continue}
   if TALL.contains(&kind)&&interior_design::glass_behind(&f,ws){continue}
   let pad=rect(&f,0.15);
   if fs.iter().any(|o|edit::overlap(pad,rect(o,0.))||staging::work_zone(o).is_some_and(|z|edit::overlap(rect(&f,0.),z))){continue}
   if staging::work_zone(&f).is_some_and(|z|fs.iter().any(|o|edit::overlap(z,rect(o,0.)))){continue}
   return Some(f);
  }
 }
 None
}

/// Adds the pieces each room is still missing, wherever they fit.
pub fn fill(c:&Config,rs:&[Room],ws:&[Wall],fs:&mut Vec<staging::Furniture>){
 if c.design_mode=="Blank slate"{return}
 let zones=accessibility::zones(c,rs);
 for r in rs{for kind in wanted(r){
  if fs.iter().any(|f|f.room_id==r.id&&f.kind==*kind){continue}
  if *kind=="office-chair"&&!fs.iter().any(|f|f.room_id==r.id&&f.kind=="desk"){continue}
  if let Some(mut f)=spot(kind,r,ws,fs,&zones){f.id=format!("{}-{}",r.id,kind);fs.push(f);}
 }}
}
