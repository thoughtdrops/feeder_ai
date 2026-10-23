use crate::*;
use super::character;
// Overhang pillars: a colonnade along whole sides of the house, not only at the entry porch. The columns carry a
// covered walk (a beam and a shallow shed roof back to the house), keep clear of the porch, deck, garage, bump-outs,
// additions and the outside doors, and use the house's column style.
pub const CHOICES:[&str;4]=["None","Front","Front & rear","All around"];
pub fn validate(c:&Config)->Result<(),String>{if CHOICES.contains(&c.overhang_pillars.as_str()){Ok(())}else{Err("Choose overhang pillars: none, front, front and rear, or all around.".into())}}
/// Column positions as (x, z, top height above the ground floor), in house coordinates.
pub fn posts(c:&Config,m:&Value)->Vec<(f64,f64,f64)>{plan(c,m).0}
/// The covered walk the pillars carry: columns at its outer edge about 8 ft apart, a beam along their tops and a
/// shallow shed roof back to the house (under the eaves of a one-story house, at the floor band of a taller one), so
/// the pillars read as a real colonnade rather than posts hugging the corners. Returns the columns and, for each
/// unbroken run of them, the walk's roof: side, start and end along the wall, depth out, height at the wall and at the
/// beam.
pub fn plan(c:&Config,m:&Value)->(Vec<(f64,f64,f64)>,Vec<Value>){
 let sides:&[&str]=match c.overhang_pillars.as_str(){"Front"=>&["front"],"Front & rear"=>&["front","rear"],"All around"=>&["front","rear","left","right"],_=>return (vec![],vec![])};
 let ground=if c.stories>=2{&m["levels"][0]}else{m};
 let one=c.stories<=1;let out=if one{5.}else{6.};let slope=if one{1.5/12.}else{2./12.};
 // Height at the wall: just under the main eave on one story; at the floor band between the first and second floor.
 let attach=if one{c.wall_height-0.15}else{c.wall_height+1.};let beam_top=attach-out*slope;let beam=0.6;let top=beam_top-beam;
 let mut g=c.clone();g.active_floor=0;let(rs,_)=layout(&g);
 let mut keep_out:Vec<[f64;4]>=vec![];
 for key in ["porch","rearOutdoor"]{let p=if ground[key].is_object(){&ground[key]}else{&m[key]};for r in p["rectangles"].as_array().into_iter().flatten(){keep_out.push([n(r,"x")-1.,n(r,"z")-1.,n(r,"x")+n(r,"w")+1.,n(r,"z")+n(r,"d")+1.]);}}
 if let Some(f)=garage::footprint(c,&rs){keep_out.push([f[0]-1.,f[1]-1.,f[2]+1.,f[3]+1.]);}
 for w in wings::all(c){keep_out.push([w.x-1.5,w.z-1.5,w.x+w.w+1.5,w.z+w.d+1.5]);}
 // Clear of every outside door's walk.
 for wall in ground["walls"].as_array().into_iter().flatten().filter(|w|w["exterior"]==true){for o in wall["openings"].as_array().into_iter().flatten().filter(|o|s(o,"kind")=="door"){let mid=n(o,"at")+n(o,"width")/2.;let(x,z)=if s(wall,"axis")=="x"{(n(wall,"x")+mid,n(wall,"z"))}else{(n(wall,"x"),n(wall,"z")+mid)};keep_out.push([x-2.5,z-2.5-out,x+2.5,z+2.5+out]);}}
 let mut posts=vec![];let mut runs=vec![];
 for side in sides{
  let len=if ["front","rear"].contains(side){c.width}else{c.depth};
  // Front and rear walks run to the outer corners; side walks run between them, so the corners are not doubled.
  let(u0,u1)=if ["front","rear"].contains(side)||sides.len()<3{(-out,len+out)}else{(0.,len)};
  let count=((u1-u0)/8.).ceil().max(1.)as usize;let mut run:Vec<f64>=vec![];
  let close=|run:&mut Vec<f64>,runs:&mut Vec<Value>|{if run.len()>=2{runs.push(json!({"side":side,"from":run[0],"to":run[run.len()-1],"depth":out,"attach":attach,"beamTop":beam_top,"beam":beam}));}run.clear();};
  for k in 0..=count{let u=u0+(u1-u0)*k as f64/count as f64;let(x,z)=match *side{"front"=>(u,-out),"rear"=>(u,c.depth+out),"left"=>(-out,u),_=>(c.width+out,u)};
   let corner=u<0.||u>len;
   if keep_out.iter().any(|r|x>r[0]&&x<r[2]&&z>r[1]&&z<r[3]){close(&mut run,&mut runs);continue}
   run.push(u);
   if !(corner&&posts.iter().any(|(px,pz,_):&(f64,f64,f64)|(px-x).abs()<0.5&&(pz-z).abs()<0.5)){posts.push((x,z,top));}
  }
  close(&mut run,&mut runs);
 }
 (posts,runs)
}
pub fn apply(c:&Config,m:&mut Value,t:&mut model::Takeoff){
 let(posts,runs)=plan(c,m);let style=character::column(c);
 let data=json!({"columnStyle":style,"posts":posts.iter().map(|(x,z,h)|json!({"x":x,"z":z,"height":h})).collect::<Vec<_>>(),"runs":runs});
 m["overhangPillars"]=data.clone();if c.stories>=2{m["levels"][0]["overhangPillars"]=data;}
 if posts.is_empty(){return}
 let tall=posts[0].2;
 t.add("overhang-columns","Exterior",&format!("Overhang pillars · {} · {:.0} ft · sealed wood",character::column_name(style),tall),posts.len()as f64,"pieces",character::column_price(style)*(tall/9.).max(1.),"Columns along a covered walk, from grade to the walk's beam; sized by the porch column style and scaled for height.","Allowance",false,true);
 t.add("overhang-column-footings","Foundation","Overhang pillar footings · 12 in concrete pier with post base",posts.len()as f64,"each",165.,"One footing and standoff post base under each pillar; frost depth and uplift ties per local code.","Allowance",false,true);
 let run_len:f64=runs.iter().map(|r|n(r,"to")-n(r,"from")).sum();let walk_area:f64=runs.iter().map(|r|(n(r,"to")-n(r,"from"))*(n(r,"depth")+0.5)).sum();
 t.add("overhang-column-beam","Roof framing","Covered-walk beam · LVL on the pillars",run_len,"linear ft",28.,"A beam along the column tops carries the walk's roof rafters; engineering to confirm size and connections.","Allowance",true,false);
 t.add("overhang-walk-roof","Roof","Covered-walk roof · shed rafters, sheathing, roofing and soffit",walk_area,"sq ft",14.,"Low-slope shed roof from a ledger on the house to the pillar beam, with a finished soffit beneath.","Allowance",true,false);
}
