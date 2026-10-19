use crate::*;
use std::cell::{Cell,RefCell};
// Bump-outs: one-story pop-outs off the house walls, such as a bay off the living room, a box bay off a
// bedroom or a dining bump at the back. Each one opens into the room behind it through a wide cased opening
// and has its own small roof (shed, gable or hip), so the walls and roofline step in and out. On a one-story
// house the bump-out roof ties into the main roof slope with valleys. On taller houses it sits against the
// first-floor wall, below the upper windows.
// Bump-outs ride the wing machinery (rooms, walls, floor, roof, piers and pricing); see `wings::all`.
pub const CHOICES:[&str;6]=["None","Style matched","Front","Sides","Rear","All around"];
pub const SIDES:[&str;4]=["front","rear","left","right"];
#[derive(Clone,Debug,PartialEq)]pub struct Bump{
 /// Which house wall it pops out of, and where along that wall (from the wall's start), in feet.
 pub side:&'static str,pub lo:f64,pub hi:f64,pub depth:f64,
 pub roof:&'static str,
 /// The room behind it, which the bump-out enlarges.
 pub room:String,
 /// The main roof's slope where a one-story bump-out ties into it; 0 when it sits against a wall.
 pub tie:f64,
}
thread_local!{
 static BUSY:Cell<bool>=const{Cell::new(false)};
 static MEMO:RefCell<Option<(u64,Vec<Bump>)>>=const{RefCell::new(None)};
}
pub fn host_wall(side:&str)->&'static str{match side{"front"=>"E1","rear"=>"E2","left"=>"E3",_=>"E4"}}
fn wall_length(c:&Config,side:&str)->f64{if ["front","rear"].contains(&side){c.width}else{c.depth}}
/// Footprint as [x0,z0,x1,z1] in house coordinates.
pub fn rect(c:&Config,b:&Bump)->[f64;4]{match b.side{"front"=>[b.lo,-b.depth,b.hi,0.],"rear"=>[b.lo,c.depth,b.hi,c.depth+b.depth],"left"=>[-b.depth,b.lo,0.,b.hi],_=>[c.width,b.lo,c.width+b.depth,b.hi]}}
/// A point `u` along the bump-out and `v` out from the host wall, in house coordinates (x, z).
fn world(c:&Config,b:&Bump,u:f64,v:f64)->(f64,f64){match b.side{"front"=>(b.lo+u,-v),"rear"=>(b.lo+u,c.depth+v),"left"=>(-v,b.lo+u),_=>(c.width+v,b.lo+u)}}

/// The bump-outs this house has. Computed once per design: the choice needs the ground-floor rooms, doors
/// and porch, and those are built while the bump-outs are left out.
pub fn list(c:&Config)->Vec<Bump>{
 if c.bump_outs=="None"||c.design_mode=="Blank slate"||c.width<16.||c.depth<16.||BUSY.with(Cell::get){return vec![]}
 let mut g=c.clone();g.active_floor=0;
 let key={use std::hash::{Hash,Hasher};let mut h=std::collections::hash_map::DefaultHasher::new();serde_json::to_string(&g).unwrap_or_default().hash(&mut h);h.finish()};
 if let Some(v)=MEMO.with(|m|m.borrow().as_ref().filter(|(k,_)|*k==key).map(|(_,v)|v.clone())){return v}
 BUSY.with(|b|b.set(true));let v=plan(&g);BUSY.with(|b|b.set(false));
 MEMO.with(|m|*m.borrow_mut()=Some((key,v.clone())));v
}

/// Per style: which walls get bump-outs first, the roof they wear, and the front and side depths.
fn style(c:&Config)->(&'static [&'static str],&'static str,f64,f64){
 match c.home_style.as_str(){
  "Victorian"=>(&["front","left","right"],"Hip",4.,2.),
  "Georgian"|"Colonial"=>(&["left","right","rear"],"Hip",4.,2.),
  "Craftsman"=>(&["right","front","left"],"Gable",4.,2.),
  "Ranch"=>(&["front","rear","left"],"Gable",4.,4.),
  "Cape Cod"=>(&["rear","front"],"Gable",4.,2.),
  "Tudor"|"English cottage"=>(&["front","left","right"],"Gable",4.,2.),
  "French country"=>(&["front","right","left"],"Hip",4.,2.),
  "Contemporary"|"Mid-century"|"Scandinavian"|"Industrial"=>(&["front","rear","right","left"],"Shed",4.,2.),
  "Modern farmhouse"=>(&["left","right","front"],"Gable",4.,4.),
  "Coastal"=>(&["left","right","rear"],"Hip",4.,2.),
  _=>(&["left","right","front"],"Gable",4.,2.),
 }
}

fn plan(c:&Config)->Vec<Bump>{
 let(rs,_)=layout(c);let ws=model::walls(c,&rs);
 let porch=porch::design(c,&json!({"walls":ws,"garage":null}));
 // Keep clear of the porch, the attached garage, the rear deck or porch and a balcony's posts.
 let mut blocked:Vec<[f64;4]>=porch["rectangles"].as_array().map(|a|a.iter().map(|r|[n(r,"x"),n(r,"z"),n(r,"x")+n(r,"w"),n(r,"z")+n(r,"d")]).collect()).unwrap_or_default();
 blocked.extend(garage::footprint(c,&rs));
 if let Some(b)=additions::balconies::planned(c){blocked.push(if b.side=="Rear"{[b.x,c.depth,b.x+b.w,c.depth+b.d]}else{[c.width,0.,c.width+b.w,b.d]});}
 if additions::rear_kind(c)!="None"{blocked.push(rear_outdoor(c,&ws));}
 let blocked:Vec<[f64;4]>=blocked.into_iter().map(|r|[r[0]-1.5,r[1]-1.5,r[2]+1.5,r[3]+1.5]).collect();
 let main_roof=roof::build(c);
 let(order,roof,front_depth,side_depth)=style(c);
 let sides:Vec<&'static str>=match c.bump_outs.as_str(){"Front"=>vec!["front"],"Sides"=>vec!["left","right"],"Rear"=>vec!["rear"],"All around"=>vec!["front","left","right","rear"],_=>order.to_vec()};
 let style_matched=c.bump_outs=="Style matched"||c.bump_outs=="None";
 let most=if style_matched{(1+(c.seed%2)as usize+usize::from(c.width>=40.)).min(sides.len())}else{8};
 let per_side=if style_matched{1}else{2};
 let rear_free=wings::rects(c).is_empty();
 let mut out:Vec<Bump>=vec![];
 // A traced plan's bump-outs come from the plan, scaled to the house (none if the plan has none); a chosen
 // side, or any other house, gets them by the rules here.
 let wanted:Vec<(&'static str,Option<(f64,f64,f64)>)>=match traced::active(c).filter(|_|c.bump_outs=="Style matched"){
  Some(t)=>t.bumps.iter().filter_map(|b|{let side=*SIDES.iter().find(|s|**s==b.side)?;let k=if ["front","rear"].contains(&side){c.width/t.width}else{c.depth/t.depth};Some((side,Some((b.at*k,b.width*k,b.depth))))}).collect(),
  None=>sides.iter().flat_map(|s|std::iter::repeat_n((*s,None),per_side)).collect(),
 };
 for(side,want)in wanted{
  if out.len()>=most&&want.is_none(){break}
  if side=="rear"&&!rear_free{continue}
  if want.is_none()&&out.iter().filter(|b|b.side==side).count()>=per_side{continue}
  let Some(wall)=ws.iter().find(|w|w.id==host_wall(side))else{continue};let len=wall_length(c,side);
  let depth=want.map_or(if side=="front"||side=="rear"{front_depth}else{side_depth},|w|grid(w.2).clamp(2.,6.));
  // The rooms along this wall that a bump-out can open from, living spaces first, then bedrooms.
  let mut hosts:Vec<&Room>=rs.iter().filter(|r|!wings::is_wing(&r.id)&&match side{"front"=>near(r.z,0.),"rear"=>near(r.z+r.d,c.depth),"left"=>near(r.x,0.),_=>near(r.x+r.w,c.width)}&&host_kind(r)).collect();
  let span=|r:&Room|if ["front","rear"].contains(&side){(r.x,r.x+r.w)}else{(r.z,r.z+r.d)};
  hosts.sort_by(|a,b|rank(a).total_cmp(&rank(b)).then((span(b).1-span(b).0).total_cmp(&(span(a).1-span(a).0))));
  for r in hosts{
   let(r0,r1)=span(r);let(min_lo,max_hi)=((r0+2.).max(2.),(r1-2.).min(grid(len)-2.));
   let(lo,hi)=match want{
    Some((at,width,_))=>{let lo=grid(at).max(min_lo);let hi=grid(at+width).min(max_hi);if at+width/2.<r0||at+width/2.>r1{continue}(lo,hi)}
    None=>{let width=grid((if depth>=4.{10.0_f64}else{8.}).min(max_hi-min_lo));let lo=min_lo+grid(((max_hi-min_lo)-width)/2.).min((max_hi-min_lo-width).max(0.));(lo,lo+width)}
   };
   if hi-lo<(2.*depth).max(6.)-1e-6{continue}
   if wall.openings.iter().any(|o|o.kind!="window"&&o.at<hi+1.&&o.at+o.width>lo-1.){continue}
   // A bedroom keeps a window of its own outside the bump-out.
   if r.kind=="bedroom"&&!keeps_window(c,r,&ws,side,lo,hi){continue}
   let mut b=Bump{side,lo,hi,depth,roof,room:r.name.clone(),tie:0.};
   let fp=rect(c,&b);let pad=[fp[0]-1.5,fp[1]-1.5,fp[2]+1.5,fp[3]+1.5];
   if blocked.iter().any(|p|edit::overlap(pad,*p))||out.iter().any(|o|edit::overlap(pad,rect(c,o))){continue}
   // On a one-story house the bump-out roof ties into an eave side of the main roof; a gable end is a wall.
   let gable_end=main_roof["profiles"][["front","rear","left","right"].iter().position(|s|*s==side).unwrap()]["points"].as_array().is_some_and(|p|p.iter().any(|q|q[1].as_f64().unwrap_or(0.)>1.));
   if c.stories==1&&!gable_end{b.tie=c.pitch/12.;if b.roof=="Hip"{b.roof="Gable"}}
   if c.stories==1&&gable_end&&b.roof=="Shed"{b.roof="Hip"}
   out.push(b);break;
  }
 }
 out
}
/// Where the rear deck or covered porch goes (as additions::outdoor places it): centered on the rear door.
fn rear_outdoor(c:&Config,ws:&[Wall])->[f64;4]{
 let w=grid(c.rear_width.min(c.width)).max(4.);
 let center=ws.iter().find(|wl|wl.id=="E2").and_then(|wl|wl.openings.iter().find(|o|o.kind=="door")).map_or(c.width/2.,|o|o.at+o.width/2.);
 let x=grid(center-w/2.).clamp(0.,(c.width-w).max(0.));[x,c.depth,x+w,c.depth+c.rear_depth]
}
fn host_kind(r:&Room)->bool{let name=r.name.to_lowercase();match r.kind.as_str(){"living"|"dining"|"studio"|"bedroom"=>true,"flex"=>!["closet","pantry","laundry","utility","mud","storage"].iter().any(|k|name.contains(k)),_=>false}}
fn rank(r:&Room)->f64{match r.kind.as_str(){"living"|"studio"=>0.,"dining"=>1.,"bedroom"=>2.,_=>3.}}
fn keeps_window(c:&Config,r:&Room,ws:&[Wall],side:&str,lo:f64,hi:f64)->bool{
 ws.iter().filter(|w|w.exterior&&w.id.starts_with('E')).any(|w|w.openings.iter().filter(|o|o.kind=="window").any(|o|{
  let mid=o.at+o.width/2.;let on=match w.id.as_str(){"E1"=>near(r.z,0.)&&mid>r.x&&mid<r.x+r.w,"E2"=>near(r.z+r.d,c.depth)&&mid>r.x&&mid<r.x+r.w,"E3"=>near(r.x,0.)&&mid>r.z&&mid<r.z+r.d,_=>near(r.x+r.w,c.width)&&mid>r.z&&mid<r.z+r.d};
  on&&!(w.id==host_wall(side)&&o.at+o.width>lo-0.3&&o.at<hi+0.3)}))
}

/// Roof pitch: the house pitch where it ties into the main roof, lower for a shed, and flattened on a
/// taller house so the roof stays below the upper-floor window sills.
pub fn pitch(c:&Config,b:&Bump)->f64{
 let base=if b.roof=="Shed"{if b.tie>0.{(b.tie*12.*0.6).min(4.)}else{c.pitch.clamp(2.,4.)}}else{c.pitch.min(10.)};
 if c.stories<2{return base}
 let run=if b.roof=="Gable"{(b.hi-b.lo)/2.}else{b.depth};let room=structural::floor_gap(c)+2.;base.min(room/(run+1.)*12.).max(2.)
}
/// y = h + a·x + b·z + k through three points (the plane the viewer uses for roof ribs).
fn plane(p:&[[f64;3]],h:f64)->[f64;3]{
 let(a,b,c)=(p[0],p[1],p[2]);let det=a[0]*(b[2]-c[2])-a[2]*(b[0]-c[0])+(b[0]*c[2]-c[0]*b[2]);if det.abs()<1e-9{return [0.,0.,0.]}
 let(ya,yb,yc)=(a[1]-h,b[1]-h,c[1]-h);
 let pa=(ya*(b[2]-c[2])-a[2]*(yb-yc)+(yb*c[2]-yc*b[2]))/det;let pb=(a[0]*(yb-yc)-ya*(b[0]-c[0])+(b[0]*yc-c[0]*yb))/det;let pk=(a[0]*(b[2]*yc-c[2]*yb)-a[2]*(b[0]*yc-c[0]*yb)+ya*(b[0]*c[2]-c[0]*b[2]))/det;
 [pa,pb,pk]
}
/// A vertical infill above the plate along a straight run of local points (u, v, rise), in the viewer's
/// profile form: an origin, an axis and [distance, rise] pairs in increasing distance.
fn profile(c:&Config,b:&Bump,pts:&[(f64,f64,f64)])->Value{
 let world_pts:Vec<(f64,f64,f64)>=pts.iter().map(|(u,v,r)|{let(x,z)=world(c,b,*u,*v);(x,z,*r)}).collect();
 let along_x=(world_pts[0].1-world_pts[world_pts.len()-1].1).abs()<1e-9;
 let key=|q:&(f64,f64,f64)|if along_x{q.0}else{q.1};let mut sorted=world_pts.clone();sorted.sort_by(|a,b|key(a).total_cmp(&key(b)));
 let o=sorted[0];json!({"x":o.0,"z":o.1,"axis":if along_x{"x"}else{"z"},"points":sorted.iter().map(|q|[key(q)-key(&o),q.2]).collect::<Vec<_>>()})
}
/// The bump-out's roof in the same form as a wing roof: facets, edges, gable infill, rafters and areas.
pub fn roof(c:&Config,b:&Bump,id:&str)->Value{
 let h=c.wall_height;let s=pitch(c,b)/12.;let(w,p,o)=(b.hi-b.lo,b.depth,1.);let slope=(1.+s*s).sqrt();
 let pt=|u:f64,v:f64,y:f64|{let(x,z)=world(c,b,u,v);[x,y,z]};
 let mut facets:Vec<Vec<[f64;3]>>=vec![];let mut edges:Vec<(&str,[f64;3],[f64;3])>=vec![];let mut profiles=vec![];let mut infill=0.;
 // Where the roof ties into the main roof, it runs back past the wall line (v < 0) until it meets it.
 let tie=b.tie;
 match b.roof{
  "Shed"=>{
   let y=|v:f64|h+(p-v)*s;let back=if tie>s+1e-6{-(p*s)/(tie-s)}else{0.};
   facets.push(vec![pt(-o,back,y(back)),pt(w+o,back,y(back)),pt(w+o,p+o,y(p+o)),pt(-o,p+o,y(p+o))]);
   edges.push(("eave",pt(-o,p+o,y(p+o)),pt(w+o,p+o,y(p+o))));for u in [-o,w+o]{edges.push(("rake",pt(u,back,y(back)),pt(u,p+o,y(p+o))));}
   edges.push(("flashing",pt(-o,back,y(back)),pt(w+o,back,y(back))));
   // The triangles above the side walls, and where it runs back into the main roof, the cheeks under its rakes.
   for u in [0.,w]{profiles.push(profile(c,b,&[(u,0.,p*s),(u,p,0.)]));}
   if back<0.{for u in [-o,w+o]{profiles.push(profile(c,b,&[(u,back,(p-back)*s),(u,0.,p*s)]));}}
   infill=p*p*s+if back<0.{-back*(2.*p-back)*s}else{0.};
  }
  "Hip"=>{
   let eave=h-o*s;let top=h+p*s;
   facets.push(vec![pt(-o,p+o,eave),pt(w+o,p+o,eave),pt(w-p,0.,top),pt(p,0.,top)]);
   facets.push(vec![pt(-o,0.,eave),pt(p,0.,top),pt(-o,p+o,eave)]);
   facets.push(vec![pt(w+o,0.,eave),pt(w+o,p+o,eave),pt(w-p,0.,top)]);
   edges.push(("eave",pt(-o,p+o,eave),pt(w+o,p+o,eave)));edges.push(("eave",pt(-o,0.,eave),pt(-o,p+o,eave)));edges.push(("eave",pt(w+o,0.,eave),pt(w+o,p+o,eave)));
   edges.push(("hip",pt(-o,p+o,eave),pt(p,0.,top)));edges.push(("hip",pt(w+o,p+o,eave),pt(w-p,0.,top)));edges.push(("flashing",pt(p,0.,top),pt(w-p,0.,top)));
  }
  _=>{
   let y=|u:f64|h+(u.min(w-u))*s;let rise=w/2.*s;let back=if tie>0.{-rise/tie}else{0.};
   if tie>0.{
    // Cross gable: each slope runs back to a valley from the wall corner to the ridge's end in the main roof.
    facets.push(vec![pt(-o,p+o,y(-o)),pt(w/2.,p+o,y(w/2.)),pt(w/2.,back,y(w/2.)),pt(0.,0.,h),pt(-o,0.,y(-o))]);
    facets.push(vec![pt(w/2.,p+o,y(w/2.)),pt(w+o,p+o,y(w+o)),pt(w+o,0.,y(w+o)),pt(w,0.,h),pt(w/2.,back,y(w/2.))]);
    edges.push(("valley",pt(0.,0.,h),pt(w/2.,back,y(w/2.))));edges.push(("valley",pt(w,0.,h),pt(w/2.,back,y(w/2.))));
   }else{
    facets.push(vec![pt(-o,0.,y(-o)),pt(w/2.,0.,y(w/2.)),pt(w/2.,p+o,y(w/2.)),pt(-o,p+o,y(-o))]);
    facets.push(vec![pt(w/2.,0.,y(w/2.)),pt(w+o,0.,y(w+o)),pt(w+o,p+o,y(w+o)),pt(w/2.,p+o,y(w/2.))]);
   }
   edges.push(("ridge",pt(w/2.,back,y(w/2.)),pt(w/2.,p+o,y(w/2.))));
   for u in [-o,w+o]{edges.push(("eave",pt(u,0.,y(u)),pt(u,p+o,y(u))));}
   edges.push(("rake",pt(-o,p+o,y(-o)),pt(w/2.,p+o,y(w/2.))));edges.push(("rake",pt(w/2.,p+o,y(w/2.)),pt(w+o,p+o,y(w+o))));
   profiles.push(profile(c,b,&[(0.,p,0.),(w/2.,p,rise),(w,p,0.)]));infill=w*rise/2.;
  }
 }
 let back=facets.iter().flatten().map(|q|{let(x,z)=(q[0],q[2]);match b.side{"front"=>-z,"rear"=>z-c.depth,"left"=>-x,_=>x-c.width}}).fold(0.,f64::min);
 let area=(w+2.*o)*(p+o-back)*slope;
 let step=16./12.;let mut rafters=vec![];
 let runs:Vec<(f64,f64,f64,f64)>=if b.roof=="Gable"{let n=((p+o-back)/step).floor()as usize;(0..=n).flat_map(|i|{let v=back+i as f64*step;[(-o,v,w/2.,v),(w/2.,v,w+o,v)]}).collect()}else{let n=((w+2.*o)/step).floor()as usize;(0..=n).map(|i|{let u=-o+i as f64*step;(u,back,u,p+o)}).collect()};
 for(i,(u0,v0,u1,v1))in runs.into_iter().enumerate(){let height=|u:f64,v:f64|match b.roof{"Gable"=>h+u.min(w-u)*s,"Shed"=>h+(p-v)*s,_=>h-o*s+s*(u+o).min(w+o-u).min(p+o-v)};let(a,bb)=(pt(u0,v0,height(u0,v0)),pt(u1,v1,height(u1,v1)));let length=((a[0]-bb[0]).powi(2)+(a[1]-bb[1]).powi(2)+(a[2]-bb[2]).powi(2)).sqrt();
  rafters.push(json!({"id":format!("{}-R{}",id,i),"x1":a[0],"y1":a[1],"z1":a[2],"x2":bb[0],"y2":bb[1],"z2":bb[2],"x":a[0],"length":length,"stockLength":(length/2.).ceil()*2.}));}
 let facets:Vec<Value>=facets.iter().enumerate().map(|(i,f)|json!({"id":format!("{}-{}",id,i),"points":f,"plane":plane(f,h)})).collect();
 let edges:Vec<Value>=edges.iter().map(|(k,a,bb)|json!({"a":a,"b":bb,"kind":k,"length":((a[0]-bb[0]).powi(2)+(a[1]-bb[1]).powi(2)+(a[2]-bb[2]).powi(2)).sqrt()})).collect();
 json!({"type":format!("Bump-out {}",b.roof.to_lowercase()),"facets":facets,"profiles":profiles,"edges":edges,"supports":[],"rafters":rafters,"area":area,"infillArea":infill,"rise":if b.roof=="Gable"{w/2.*s}else{p*s},"pitch":s*12.})
}
