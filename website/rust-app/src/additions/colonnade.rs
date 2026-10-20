use crate::*;
use super::character;
// Overhang pillars: columns that carry the main roof's eave overhang along whole sides of the house (a colonnade),
// not only at the entry porch. They stand just inside the overhang's edge, run from grade up to the soffit, keep
// clear of the porch, deck, garage, bump-outs, additions and the front door, and use the house's column style.
pub const CHOICES:[&str;4]=["None","Front","Front & rear","All around"];
pub fn validate(c:&Config)->Result<(),String>{if CHOICES.contains(&c.overhang_pillars.as_str()){Ok(())}else{Err("Choose overhang pillars: none, front, front and rear, or all around.".into())}}
/// Column positions as (x, z, top height above the ground floor), in house coordinates.
pub fn posts(c:&Config,m:&Value)->Vec<(f64,f64,f64)>{
 let sides:&[&str]=match c.overhang_pillars.as_str(){"Front"=>&["front"],"Front & rear"=>&["front","rear"],"All around"=>&["front","rear","left","right"],_=>return vec![]};
 let ground=if c.stories>=2{&m["levels"][0]}else{m};
 let roof=&m["roof"];let over=character::overhang(c).unwrap_or(n(roof,"overhangZ").max(1.)).max(1.);
 // A column needs room to stand under the soffit: at least 1 ft out from the wall, 6 in inside the eave's edge.
 let out=(over-0.5).max(1.);
 let fh=c.wall_height+structural::floor_gap(c);let plate=(c.stories.max(1)-1)as f64*fh+c.wall_height;let top=(plate-out*c.pitch/12.).max(c.wall_height);
 let mut g=c.clone();g.active_floor=0;let(rs,_)=layout(&g);
 let mut keep_out:Vec<[f64;4]>=vec![];
 for key in ["porch","rearOutdoor"]{let p=if ground[key].is_object(){&ground[key]}else{&m[key]};for r in p["rectangles"].as_array().into_iter().flatten(){keep_out.push([n(r,"x")-1.,n(r,"z")-1.,n(r,"x")+n(r,"w")+1.,n(r,"z")+n(r,"d")+1.]);}}
 if let Some(f)=garage::footprint(c,&rs){keep_out.push([f[0]-1.,f[1]-1.,f[2]+1.,f[3]+1.]);}
 for w in wings::all(c){keep_out.push([w.x-1.5,w.z-1.5,w.x+w.w+1.5,w.z+w.d+1.5]);}
 // Clear of every outside door's walk.
 for wall in ground["walls"].as_array().into_iter().flatten().filter(|w|w["exterior"]==true){for o in wall["openings"].as_array().into_iter().flatten().filter(|o|s(o,"kind")=="door"){let mid=n(o,"at")+n(o,"width")/2.;let(x,z)=if s(wall,"axis")=="x"{(n(wall,"x")+mid,n(wall,"z"))}else{(n(wall,"x"),n(wall,"z")+mid)};keep_out.push([x-2.5,z-2.5-out,x+2.5,z+2.5+out]);}}
 let profiles=roof["profiles"].as_array();
 let mut out_posts=vec![];
 for side in sides{
  // Only where the roof ends in an eave; a gable end's rake has no level soffit to carry.
  let i=["front","rear","left","right"].iter().position(|s|s==side).unwrap();
  if profiles.and_then(|p|p.get(i)).and_then(|p|p["points"].as_array()).is_some_and(|p|p.iter().any(|q|q[1].as_f64().unwrap_or(0.)>1.)){continue}
  let len=if ["front","rear"].contains(side){c.width}else{c.depth};let count=((len+2.*out)/9.).ceil().max(1.)as usize;
  for k in 0..=count{let u=-out+(len+2.*out)*k as f64/count as f64;let(x,z)=match *side{"front"=>(u,-out),"rear"=>(u,c.depth+out),"left"=>(-out,u),_=>(c.width+out,u)};
   if keep_out.iter().any(|r|x>r[0]&&x<r[2]&&z>r[1]&&z<r[3]){continue}
   if out_posts.iter().any(|(px,pz,_):&(f64,f64,f64)|(px-x).abs()<0.5&&(pz-z).abs()<0.5){continue}
   out_posts.push((x,z,top));}
 }
 out_posts
}
pub fn apply(c:&Config,m:&mut Value,t:&mut model::Takeoff){
 let posts=posts(c,m);let style=character::column(c);
 let data=json!({"columnStyle":style,"posts":posts.iter().map(|(x,z,h)|json!({"x":x,"z":z,"height":h})).collect::<Vec<_>>()});
 m["overhangPillars"]=data.clone();if c.stories>=2{m["levels"][0]["overhangPillars"]=data;}
 if posts.is_empty(){return}
 let tall=posts[0].2;
 t.add("overhang-columns","Exterior",&format!("Overhang pillars · {} · {:.0} ft · sealed wood",character::column_name(style),tall),posts.len()as f64,"pieces",character::column_price(style)*(tall/9.).max(1.),"Columns under the main roof's eave overhang, from grade to the soffit; sized by the porch column style and scaled for height.","Allowance",false,true);
 t.add("overhang-column-footings","Foundation","Overhang pillar footings · 12 in concrete pier with post base",posts.len()as f64,"each",165.,"One footing and standoff post base under each pillar; frost depth and uplift ties per local code.","Allowance",false,true);
 t.add("overhang-column-beam","Roof framing","Overhang carrying beam · LVL tied to the rafter tails",posts.windows(2).filter(|p|(p[0].0-p[1].0).abs()<0.01||(p[0].1-p[1].1).abs()<0.01).map(|p|((p[0].0-p[1].0).powi(2)+(p[0].1-p[1].1).powi(2)).sqrt()).sum::<f64>(),"linear ft",28.,"A beam along the column line under the soffit picks up the rafter tails; engineering to confirm size and connections.","Allowance",true,false);
}
