use crate::*;
/// One orthogonal segment on the same two-foot grid as generated plans.
pub fn drawn_wall(id:String,c:&Config,x1:f64,z1:f64,x2:f64,z2:f64,ws:&[Wall])->Result<Wall,String>{
 if ![x1,z1,x2,z2].iter().all(|v|v.is_finite()){return Err("Choose a start and end inside the floor.".into())}
 if x1<0.||x2<0.||z1<0.||z2<0.||x1>c.width||x2>c.width||z1>c.depth||z2>c.depth{return Err("Keep both wall ends inside the house.".into())}
 let (x1,z1,x2,z2)=(grid(x1),grid(z1),grid(x2),grid(z2));
 if x1>c.width||x2>c.width||z1>c.depth||z2>c.depth{return Err("Keep both wall ends inside the house.".into())}
 let along=(x2-x1).abs()>=(z2-z1).abs();
 let wall=Wall{id,name:"Custom interior wall".into(),axis:if along{"x"}else{"z"}.into(),x:if along{x1.min(x2)}else{x1},z:if along{z1}else{z1.min(z2)},length:if along{(x2-x1).abs()}else{(z2-z1).abs()},exterior:false,openings:vec![]};
 if wall.length<2.{return Err("Draw at least one two-foot grid space.".into())}
 if ws.iter().any(|w|collinear_overlap(&wall,w)){return Err("A wall already occupies this grid line. Extend it with its end handle.".into())}
 if let Some(error)=accessibility::wall_error(&wall,c){return Err(error)}
 Ok(wall)
}
fn collinear_overlap(a:&Wall,b:&Wall)->bool{if a.axis!=b.axis{return false}let along=a.axis=="x";let (al,bl,ap,bp)=if along{(a.x,b.x,a.z,b.z)}else{(a.z,b.z,a.x,b.x)};near(ap,bp)&&al<bl+b.length-0.01&&bl<al+a.length-0.01}
pub fn moved_wall(w:&Wall,c:&Config,dx:f64,dz:f64,ws:&[Wall])->Result<Wall,String>{
 if w.exterior{return Err("Exterior walls define the house footprint. Use Dimensions to move its outside edges.".into())}
 let mut next=w.clone();next.x+=dx;next.z+=dz;
 if ![next.x,next.z].iter().all(|v|v.is_finite())||next.x<0.||next.z<0.||next.x+if next.axis=="x"{next.length}else{0.}>c.width||next.z+if next.axis=="z"{next.length}else{0.}>c.depth{return Err("Keep the wall inside the house.".into())}
 if ws.iter().any(|other|other.id!=w.id&&collinear_overlap(&next,other)){return Err("That move would overlap another wall.".into())}
 if let Some(error)=accessibility::wall_error(&next,c){return Err(error)}
 Ok(next)
}
/// Expanding a blank shell and adding a story must retain its custom work.
pub fn blank_edits_fit(c:&Config)->bool{
 c.added_walls.iter().all(|w|{let g=c.wall_adjustments.get(&w.id);let(x,z,l)=g.map(|g|(g.x,g.z,g.length)).unwrap_or((w.x,w.z,w.length));let axis=g.filter(|g|!g.axis.is_empty()).map(|g|g.axis.as_str()).unwrap_or(&w.axis);x>=0.&&z>=0.&&x+if axis=="x"{l}else{0.}<=c.width&&z+if axis=="z"{l}else{0.}<=c.depth})&&c.placed_furniture.iter().all(|f|f.x-f.w/2.>=0.&&f.z-f.d/2.>=0.&&f.x+f.w/2.<=c.width&&f.z+f.d/2.<=c.depth)
}
fn adjusted(w:&mut Wall,c:&Config){
 if let Some(g)=c.wall_adjustments.get(&w.id){let axis=if ["x","z"].contains(&g.axis.as_str()){g.axis.as_str()}else{w.axis.as_str()};if [g.x,g.z,g.length].iter().all(|v|v.is_finite())&&g.length>=0.5&&g.x>=0.&&g.z>=0.&&g.x+if axis=="x"{g.length}else{0.}<=c.width&&g.z+if axis=="z"{g.length}else{0.}<=c.depth{w.x=g.x;w.z=g.z;w.length=g.length;w.axis=axis.into();}}
 if let Some(os)=c.opening_overrides.get(&w.id){if model::valid_openings(os,w.length,c.wall_height){w.openings=os.clone();}}
}
pub fn resized_wall(w:&Wall,c:&Config,edge:&str,coordinate:f64)->Result<Wall,String>{
 if !coordinate.is_finite()||!["start","end"].contains(&edge){return Err("Choose a wall end and a valid position.".into())}
 let along=w.axis=="x";let start=if along{w.x}else{w.z};let end=start+w.length;let limit=if along{c.width}else{c.depth};
 let coordinate=coordinate.clamp(0.,limit);let mut next=w.clone();
 if edge=="start"{let delta=coordinate-start;next.length=end-coordinate;if along{next.x=coordinate}else{next.z=coordinate}for o in &mut next.openings{o.at-=delta;}}
 else{next.length=coordinate-start;}
 if next.length<0.5{return Err("Leave at least 6 inches of wall. Drag the other handle to extend it.".into())}
 if !model::valid_openings(&next.openings,next.length,c.wall_height){return Err("This end would cut through a door or window. Move or remove that opening first.".into())}
 if !next.exterior{if let Some(error)=accessibility::wall_error(&next,c){return Err(error)}}
 Ok(next)
}
pub fn rotated_wall(w:&Wall,c:&Config,turns:i32,ws:&[Wall])->Result<Wall,String>{
 if w.exterior{return Err("Exterior walls follow the footprint. Rotate an interior wall instead.".into())}
 let turns=turns.rem_euclid(4);let mut next=w.clone();let(cx,cz)=(w.x+if w.axis=="x"{w.length/2.}else{0.},w.z+if w.axis=="z"{w.length/2.}else{0.});
 if turns%2==1{next.axis=if w.axis=="x"{"z"}else{"x"}.into();}
 next.x=cx-if next.axis=="x"{next.length/2.}else{0.};next.z=cz-if next.axis=="z"{next.length/2.}else{0.};
 if turns==2||(turns==1&&w.axis=="z")||(turns==3&&w.axis=="x"){for o in &mut next.openings{o.at=next.length-o.at-o.width;}next.openings.sort_by(|a,b|a.at.total_cmp(&b.at));}
 moved_wall(&next,c,0.,0.,ws)
}
pub fn walls(mut ws:Vec<Wall>,c:&Config)->Vec<Wall>{
 ws.extend(c.added_walls.iter().filter(|w|tag_floor(&w.id)==c.active_floor&&w.length>=1.&&w.x>=0.&&w.z>=0.&&w.x+if w.axis=="x"{w.length}else{0.}<=c.width&&w.z+if w.axis=="z"{w.length}else{0.}<=c.depth).cloned());
 for w in &mut ws{adjusted(w,c);}
 ws=remove_sections(ws,c);
 ws=stairs::clear_upper_walls(ws,c);
 for w in &mut ws{adjusted(w,c);}
 // Upper walls cut by stairs remain editable like every other wall section.
 ws=remove_sections(ws,c);
 // Edits on surviving custom/split wall IDs apply after section deletion.
 for wall in &mut ws{if let Some(os)=c.opening_overrides.get(&wall.id){if model::valid_openings(os,wall.length,c.wall_height){wall.openings=os.clone();}}}
 ws
}
fn remove_sections(mut ws:Vec<Wall>,c:&Config)->Vec<Wall>{
 for removal in &c.wall_removals{
  let Some(index)=ws.iter().position(|w|w.id==removal.wall_id)else{continue};
  let wall=ws.remove(index);let lo=removal.at.max(0.).min(wall.length);let hi=(lo+removal.width).max(lo).min(wall.length);
  if hi-lo<0.05{ws.insert(index,wall);continue}
  let mut parts=vec![];
  for(part,start,end)in[("A",0.,lo),("B",hi,wall.length)]{if end-start<0.45{continue}let mut w=wall.clone();w.id=format!("{}-{}",wall.id,part);w.name=format!("{} · section {}",wall.name,part);w.x+=if w.axis=="x"{start}else{0.};w.z+=if w.axis=="z"{start}else{0.};w.length=end-start;w.openings=wall.openings.iter().filter(|o|o.at>=start+0.2&&o.at+o.width<=end-0.2).map(|o|{let mut o=o.clone();o.at-=start;o}).collect();parts.push(w);}
  for(part,mut w)in parts.into_iter().enumerate(){adjusted(&mut w,c);ws.insert(index+part,w);}
 }
 ws
}
pub fn item_dimensions(kind:&str)->(f64,f64){if let Some(o)=objects::find(kind){return(o.width,o.depth)}match kind{"stairs"=>(8.,16.),"sofa"=>(7.,3.),"bed"=>(5.,6.7),"toilet"=>(2.,2.6),"vanity"=>(3.,2.),"shower"=>(3.,3.),"kitchen"=>(6.,2.5),"island"=>(5.,3.),"counter-run"=>(6.,2.),"pantry-tower"=>(2.5,2.),"fridge"=>(2.7,2.7),"dining"=>(6.,5.),"chair"=>(2.,2.),"armchair"=>(3.,3.),"desk"=>(4.,2.),"wardrobe"=>(4.,2.),"laundry"=>(5.,2.7),"coffee"=>(3.5,2.),"nightstand"=>(1.8,1.5),"rug"=>(6.,4.),"plant"=>(1.3,1.3),"floorlamp"=>(1.6,1.6),"side-table"=>(2.,2.),"bench"=>(4.,1.6),"bookcase"=>(3.,1.1),"entry-console"=>(4.,1.2),"floor-vase"=>(1.,1.),"floor-mirror"=>(2.6,0.7),"tall-plant"=>(2.,2.),_=>(3.,2.)}}
pub fn rotate_item(f:&mut staging::Furniture,rotation:f64){let rotation=if f.kind=="stairs"{f.local_width=8.;f.local_depth=16.;(rotation/std::f64::consts::FRAC_PI_2).round()*std::f64::consts::FRAC_PI_2}else{rotation};f.rotation=rotation.rem_euclid(std::f64::consts::TAU);let(c,s)=(f.rotation.cos().abs(),f.rotation.sin().abs());f.w=f.local_width*c+f.local_depth*s;f.d=f.local_width*s+f.local_depth*c;}
fn corners(f:&staging::Furniture,pad:f64)->[[f64;2];4]{let(c,s)=(f.rotation.cos(),f.rotation.sin());let(w,d)=(f.local_width/2.+pad,f.local_depth/2.+pad);[[-w,-d],[w,-d],[w,d],[-w,d]].map(|[x,z]|[f.x+c*x-s*z,f.z+s*x+c*z])}
fn rectangle(r:[f64;4])->[[f64;2];4]{[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]]}
fn intersects(a:[[f64;2];4],b:[[f64;2];4])->bool{for polygon in [a,b]{for i in 0..4{let p=polygon[i];let q=polygon[(i+1)%4];let axis=[p[1]-q[1],q[0]-p[0]];let project=|ps:[[f64;2];4]|{let values=ps.map(|p|p[0]*axis[0]+p[1]*axis[1]);(values.iter().copied().fold(f64::INFINITY,f64::min),values.iter().copied().fold(f64::NEG_INFINITY,f64::max))};let(amin,amax)=project(a);let(bmin,bmax)=project(b);if amax<=bmin+1e-6||bmax<=amin+1e-6{return false}}}true}
pub fn item_intersects_rect(f:&staging::Furniture,r:[f64;4])->bool{intersects(corners(f,0.),rectangle(r))}
pub fn valid_item(f:&staging::Furniture,c:&Config,ws:&[Wall],others:&[staging::Furniture])->bool{
 item_error(f,c,ws,others).is_none()
}
pub fn item_error(f:&staging::Furniture,c:&Config,ws:&[Wall],others:&[staging::Furniture])->Option<String>{let(rs,_)=layout(c);let zones=accessibility::zones(c,&rs);item_error_with_zones(f,c,ws,others,&zones)}
fn item_error_with_zones(f:&staging::Furniture,c:&Config,ws:&[Wall],others:&[staging::Furniture],zones:&[accessibility::Clearance])->Option<String>{
 if ![f.x,f.z,f.w,f.d,f.rotation,f.local_width,f.local_depth].iter().all(|v|v.is_finite())||f.local_width<0.3||f.local_depth<0.3{return Some("Enter valid item dimensions and a position.".into())}
 let bounds=[f.x-f.w/2.,f.z-f.d/2.,f.x+f.w/2.,f.z+f.d/2.];
 if bounds[0]<0.28||bounds[1]<0.28||bounds[2]>c.width-0.28||bounds[3]>c.depth-0.28{return Some("The whole item must fit inside the house. Click farther from the outside edge.".into())}
 if f.kind=="stairs"{if let Some(error)=stairs::placement_error(f,c,ws,others){return Some(error)}}else if let Some(error)=accessibility::item_error(f,zones){return Some(error)}
 if !clear_of_walls(f,ws){return Some("Keep the item clear of walls and door maneuvering space.".into())}
 if f.kind!="rug"{if let Some(o)=others.iter().filter(|o|o.id!=f.id&&o.kind!="rug").find(|o|intersects(corners(f,0.),corners(o,0.05))){return Some(format!("This position overlaps a {}. Move outside its footprint.",o.kind))}}
 None
}
pub fn clear_of_walls(f:&staging::Furniture,ws:&[Wall])->bool{
 for wall in ws{let axis=wall.axis=="x";let mut start=0.;let mut openings=wall.openings.clone();openings.sort_by(|a,b|a.at.total_cmp(&b.at));for o in openings.iter().filter(|o|o.kind!="window").map(|o|(o.at,o.width)).chain(std::iter::once((wall.length,0.))){let a=if axis{[wall.x+start,wall.z-0.28,wall.x+o.0,wall.z+0.28]}else{[wall.x-0.28,wall.z+start,wall.x+0.28,wall.z+o.0]};if item_intersects_rect(f,a){return false}start=o.0+o.1;}
  if f.kind!="rug"{for o in openings.iter().filter(|o|o.kind!="window"){let mut areas=vec![];if o.kind=="door"{let at=if axis{wall.x+o.at}else{wall.z+o.at};areas.push(if axis{[at,wall.z+0.28,at+o.width+1.5,wall.z+5.]}else{[wall.x+0.28,at,wall.x+5.,at+o.width+1.5]});areas.push(if axis{[at,wall.z-4.,at+o.width+1.,wall.z-0.28]}else{[wall.x-4.,at,wall.x-0.28,at+o.width+1.]});}else{areas.push(if axis{[wall.x+o.at-0.2,wall.z-3.,wall.x+o.at+o.width+0.2,wall.z+3.]}else{[wall.x-3.,wall.z+o.at-0.2,wall.x+3.,wall.z+o.at+o.width+0.2]});}if areas.iter().any(|a|item_intersects_rect(f,*a)){return false}}}
 }true
}
pub fn overlap(a:[f64;4],b:[f64;4])->bool{a[0]<b[2]-0.001&&a[2]>b[0]+0.001&&a[1]<b[3]-0.001&&a[3]>b[1]+0.001}
pub fn snap_item(mut f:staging::Furniture,c:&Config,ws:&[Wall],others:&[staging::Furniture])->(staging::Furniture,bool,Option<String>){
 if ![f.x,f.z,f.rotation,f.local_width,f.local_depth].iter().all(|v|v.is_finite())||f.local_width<0.3||f.local_depth<0.3{return(f,false,Some("Enter valid item dimensions, position and rotation.".into()))}
 let rotation=f.rotation;rotate_item(&mut f,rotation);let requested=(f.x,f.z);let(rs,_)=layout(c);let zones=accessibility::zones(c,&rs);
 let error=item_error_with_zones(&f,c,ws,others,&zones);if error.is_none(){let grid=if f.kind=="stairs"{0.5}else{4.};f.x=(f.x*grid).round()/grid;f.z=(f.z*grid).round()/grid;if item_error_with_zones(&f,c,ws,others,&zones).is_none(){return(f.clone(),(f.x-requested.0).abs()+(f.z-requested.1).abs()>0.03,None)}}
 let origin=(requested.0.clamp(0.31+f.w/2.,(c.width-0.31-f.w/2.).max(0.31+f.w/2.)),requested.1.clamp(0.31+f.d/2.,(c.depth-0.31-f.d/2.).max(0.31+f.d/2.)));
 let radius=if f.kind=="stairs"{4.5}else{2.75};let spacing=if f.kind=="stairs"{2.}else{0.25};let cells=if f.kind=="stairs"{2}else{10};
 let mut candidates=vec![if f.kind=="stairs"{((origin.0/2.).round()*2.,(origin.1/2.).round()*2.)}else{origin}];for ix in -cells..=cells{for iz in -cells..=cells{if (ix as f64).hypot(iz as f64)*spacing<=radius{candidates.push(((origin.0/spacing).round()*spacing+ix as f64*spacing,(origin.1/spacing).round()*spacing+iz as f64*spacing));}}}
 for w in ws{let shift=if w.axis=="x"{f.d/2.+0.31}else{f.w/2.+0.31};for sign in [-1.,1.]{candidates.push(if w.axis=="x"{(origin.0,w.z+sign*shift)}else{(w.x+sign*shift,origin.1)});}}
 if f.kind=="stairs"{for p in &mut candidates{p.0=(p.0/2.).round()*2.;p.1=(p.1/2.).round()*2.;}}
 candidates.retain(|(x,z)|(x-origin.0).hypot(z-origin.1)<=radius);candidates.sort_by(|a,b|((a.0-requested.0).powi(2)+(a.1-requested.1).powi(2)).total_cmp(&((b.0-requested.0).powi(2)+(b.1-requested.1).powi(2))));
 for(x,z)in candidates{f.x=x;f.z=z;if item_error_with_zones(&f,c,ws,others,&zones).is_none(){return(f,true,None)}}
 // Nothing free right by the click (say, a stairwell corner): search outward for the nearest free spot.
 if f.kind!="stairs"{let mut wide=vec![];for ix in -20i32..=20{for iz in -20i32..=20{let(x,z)=(origin.0+ix as f64*0.5,origin.1+iz as f64*0.5);let dist=(x-origin.0).hypot(z-origin.1);if dist>radius&&dist<=10.{wide.push((dist,x,z));}}}wide.sort_by(|a,b|a.0.total_cmp(&b.0));for(_,x,z)in wide{f.x=x;f.z=z;if item_error_with_zones(&f,c,ws,others,&zones).is_none(){return(f,true,None)}}}
 f.x=requested.0;f.z=requested.1;let error=item_error_with_zones(&f,c,ws,others,&zones);(f,false,error)
}
