use crate::*;

#[derive(Clone,Serialize)]#[serde(rename_all="camelCase")]
pub struct Clearance {pub id:String,pub name:String,pub kind:String,pub x:f64,pub z:f64,pub w:f64,pub d:f64}
impl Clearance {pub fn rect(&self)->[f64;4]{[self.x,self.z,self.x+self.w,self.z+self.d]}}
pub fn zones(c:&Config,rs:&[Room])->Vec<Clearance>{
 let mut out=vec![];
 for r in rs {
  let room_clear=[r.x+0.3,r.z+0.3,r.w-0.6,r.d-0.6];
  let kind=if r.kind=="stairs"{"stairwell"}else if r.kind=="hall"{"route"}else if r.kind=="foyer"{"turning"}else{continue};
  let(x,z,w,d)=if kind=="turning"&&(r.w>=5.6&&r.d>=5.6){(r.x+(r.w-5.)/2.,r.z+(r.d-5.)/2.,5.,5.)}else{(room_clear[0],room_clear[1],room_clear[2],room_clear[3])};
  out.push(Clearance{id:format!("clear-{}",r.id),name:if kind=="stairwell"{"Stairwell".into()}else if r.name.to_lowercase().contains("landing"){"Stair landing / turning space".into()}else{r.name.clone()},kind:kind.into(),x,z,w,d});
  if r.kind=="stairs"{
   let z=if r.z<1.{r.z+r.d+0.3}else{r.z-5.3};
   if let Some(f)=stairs::custom(c){let b=stairs::bounds(f,[1.5,-5.3,6.5,-0.3]);out.push(Clearance{id:format!("approach-{}",r.id),name:if c.active_floor==0{"Lower stair entrance · 5 ft clear"}else{"Upper stair exit · 5 ft clear"}.into(),kind:"landing".into(),x:b[0],z:b[1],w:b[2]-b[0],d:b[3]-b[1]});
    if c.active_floor==0{if let Some(l)=stairs::bottom_landing(f,c){out.push(Clearance{id:format!("bottom-{}",r.id),name:"Bottom step · 3 ft clear".into(),kind:"landing".into(),x:l[0],z:l[1],w:l[2]-l[0],d:l[3]-l[1]});}}continue}
   out.push(Clearance{id:format!("approach-{}",r.id),name:if c.active_floor==0{"Lower stair entrance · 5 ft clear"}else{"Upper stair exit · 5 ft clear"}.into(),kind:"landing".into(),x:r.x+(r.w-5.)/2.,z,w:5.,d:5.});
  }
 }
 out
}
pub fn wall_error(w:&Wall,c:&Config)->Option<String>{
 if c.stories<2||(c.design_mode=="Blank slate"&&stairs::custom(c).is_none()){return None}
 let(rs,_)=layout(c);let bounds=if w.axis=="x"{[w.x,w.z-0.27,w.x+w.length,w.z+0.27]}else{[w.x-0.27,w.z,w.x+0.27,w.z+w.length]};
 zones(c,&rs).iter().filter(|z|["stairwell","landing"].contains(&z.kind.as_str())).find(|z|edit::overlap(bounds,z.rect())).map(|z|format!("Keep {} free of walls. Move the wall outside the blue clearance area.",z.name))
}
pub fn item_error(f:&staging::Furniture,zones:&[Clearance])->Option<String>{
 zones.iter().filter(|z|f.kind!="rug"||["stairwell","landing"].contains(&z.kind.as_str())).find(|z|edit::item_intersects_rect(f,z.rect())).map(|z|format!("Keep {} clear. Snap outside the blue circulation area.",z.name))
}
pub fn report(c:&Config,rs:&[Room],ws:&[Wall],fs:&[staging::Furniture])->Value{
 let zones=zones(c,rs);let mut issues=vec![];
 for r in rs.iter().filter(|r|r.kind=="hall"){if r.w.min(r.d)-0.56<3.-0.01{issues.push(format!("{} has less than the 36-inch route-width target after wall finishes.",r.name));}}
 for r in rs.iter().filter(|r|r.kind=="foyer"){if r.w<5.6||r.d<5.6{issues.push(format!("{} cannot contain a 60-inch turning space; enlarge this entry.",r.name));}}
 for z in zones.iter().filter(|z|z.kind=="landing"){
  if z.x<0.3||z.z<0.3||z.x+z.w>c.width-0.3||z.z+z.d>c.depth-0.3{issues.push(format!("{} extends beyond the usable floor; enlarge or replan the stair approach.",z.name));}
  if fs.iter().any(|f|edit::item_intersects_rect(f,z.rect())){issues.push(format!("{} is obstructed by a modeled item.",z.name));}
  if ws.iter().any(|w|{let b=if w.axis=="x"{[w.x,w.z-0.27,w.x+w.length,w.z+0.27]}else{[w.x-0.27,w.z,w.x+0.27,w.z+w.length]};edit::overlap(b,z.rect())}){issues.push(format!("{} crosses a wall; review the opening and approach.",z.name));}
 }
 if c.stories>=2{issues.push("Stairs do not provide wheelchair access upstairs. A lift/elevator or an accessible ground-floor program requires separate design.".into());}
 json!({"routeTargetInches":36,"turningTargetInches":60,"stairApproachTargetFeet":5,"zones":zones,"issues":issues,"status":"Circulation planning targets · full accessibility review pending","sources":["https://www.access-board.gov/ada/chapter/ch03/","https://www.access-board.gov/ada/chapter/ch04/"],"note":"Protects modeled circulation and stair approaches. Door hardware, actual clear openings, maneuvering direction, bathroom fixture clearances, thresholds and step-free access need project-specific verification; this is not an ADA certification."})
}
