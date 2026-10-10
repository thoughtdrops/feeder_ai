use crate::*;

#[derive(Clone)]
pub struct Spec{pub side:&'static str,pub at:f64,pub x:f64,pub z:f64,pub w:f64,pub d:f64,pub existing:bool}
pub fn planned(c:&Config)->Option<Spec>{
 if c.stories<2||c.balcony=="None"||c.width<16.||c.depth<16.{return None}
 if c.balcony=="Style matched"&&(c.design_mode=="Blank slate"||c.design_mode=="Affordable"||!["Victorian","Colonial","French country","Coastal"].contains(&c.home_style.as_str())){return None}
 let existing=c.balcony=="Style matched"&&c.home_style=="Colonial"&&(c.garage!="Attached"||c.garage_side=="Left");
 let side=if existing{"Right"}else{"Rear"};let mut cc=c.clone();cc.active_floor=1;let(rs,_)=layout(&cc);
 let room=rs.iter().filter(|r|!["stairs","bath"].contains(&r.kind.as_str())&&if existing{near(r.x+r.w,c.width)&&r.d>=4.5&&r.z+r.d/2.<c.depth*28./36.-2.}else{near(r.z+r.d,c.depth)&&r.w>=4.5}).min_by(|a,b|{
  let rank=|r:&Room|(if r.kind=="hall"{0.}else if r.kind=="flex"{50.}else if r.kind=="bedroom"{100.}else{20.})+(if existing{r.z+r.d/2.-c.depth/2.}else{r.x+r.w/2.-c.width/2.}).abs();rank(a).total_cmp(&rank(b))
 })?;
 let center=if existing{room.z+room.d/2.}else{room.x+room.w/2.};let at=center-19./12.;
 if existing{let width=12_f64.min(c.width/3.);return Some(Spec{side,at,x:c.width,z:0.,w:width,d:c.depth*28./36.,existing})}
 let w=if c.home_style=="Coastal"{12_f64.min(c.width-4.)}else{8_f64.min(c.width-4.)};let d=if c.home_style=="Coastal"{6.}else{4.};
 Some(Spec{side,at,x:(center-w/2.).clamp(0.,c.width-w),z:c.depth,w,d,existing:false})
}
pub fn prepare_walls(c:&Config,mut ws:Vec<Wall>)->Vec<Wall>{
 if c.active_floor!=1{return ws}let Some(b)=planned(c)else{return ws};
 for wall in &mut ws{let matches=wall.exterior&&if b.side=="Right"{wall.axis=="z"&&near(wall.x,c.width)}else{wall.axis=="x"&&near(wall.z,c.depth)};if !matches{continue}
  if c.opening_overrides.contains_key(&wall.id){continue}
  let origin=if wall.axis=="x"{wall.x}else{wall.z};let at=b.at-origin;let width=38./12.;
  if at<0.4||at+width>wall.length-0.4{continue}
  wall.openings.retain(|o|o.at+o.width+0.4<=at||o.at>=at+width+0.4);
  wall.openings.push(Opening{id:"BALCONY-DOOR-L2".into(),kind:"door".into(),at,width,bottom:0.,height:82.5/12.});wall.openings.sort_by(|a,b|a.at.total_cmp(&b.at));
 }
 ws
}
pub fn apply(c:&Config,m:&mut Value,t:&mut model::Takeoff){
 let Some(mut b)=planned(c)else{m["balcony"]=Value::Null;return};
 let upper=&m["levels"][1];let door=upper["walls"].as_array().unwrap().iter().find_map(|w|w["openings"].as_array().unwrap().iter().find(|o|s(o,"id")=="BALCONY-DOOR-L2").map(|o|(w,o)));
 let Some((wall,door))=door else{m["balcony"]=Value::Null;m["balconyNote"]=json!("A balcony needs an upper-floor exterior door. The edited wall has no connected balcony opening.");return};
 if b.existing&&!m["porch"]["rectangles"].as_array().is_some_and(|rs|rs.iter().any(|r|near(n(r,"x"),c.width)&&r["deckYs"].as_array().unwrap().len()==2)){m["balcony"]=Value::Null;return}
 if !b.existing{let center=n(wall,"x")+n(door,"at")+n(door,"width")/2.;b.x=(center-b.w/2.).clamp(0.,c.width-b.w);}
 let deck_y=c.wall_height+structural::floor_gap(c)+0.2;let stations=(b.w/(16./12.)).ceil()as usize;
 let joists:Vec<_>=(0..=stations).map(|i|json!({"a":[b.x+b.w*i as f64/stations as f64,deck_y-0.33,b.z],"b":[b.x+b.w*i as f64/stations as f64,deck_y-0.33,b.z+b.d],"length":b.d,"stockLength":(b.d/2.).ceil()*2.})).collect();
 let posts:Vec<_>=(0..=(b.w/8.).ceil()as usize).map(|i|json!({"x":b.x+b.w*i as f64/(b.w/8.).ceil(),"z":b.z+b.d,"height":deck_y-0.67})).collect();
 let rails:Vec<_>=[([b.x,deck_y+3.5,b.z],[b.x,deck_y+3.5,b.z+b.d]),([b.x,deck_y+3.5,b.z+b.d],[b.x+b.w,deck_y+3.5,b.z+b.d]),([b.x+b.w,deck_y+3.5,b.z+b.d],[b.x+b.w,deck_y+3.5,b.z])].into_iter().map(|(a,b)|{let len=((b[0]-a[0]).powi(2)+(b[2]-a[2]).powi(2)).sqrt();json!({"a":a,"b":b,"length":len,"balusters":(len/(4./12.)).ceil()as usize})}).collect();
 let rail_lf:f64=rails.iter().map(|r|n(r,"length")).sum();let count=posts.len()as f64;let area=b.w*b.d;
 if !b.existing{
  for(id,name,net,unit,rate,whole)in[
   ("deck","Balcony sealed exterior decking",area/(5.5/12.),"linear ft",2.2,false),
   ("joists","Balcony exterior-rated treated 2×8 joist stock",joists.iter().map(|j|n(j,"stockLength")).sum(),"linear ft",2.4,false),
   ("ledger","Balcony exterior-rated rim / flashed ledger",2.*(b.w+b.d),"linear ft",2.4,false),
   ("beam","Balcony doubled exterior beam stock",b.w*2.,"ply linear ft",3.,false),
   ("posts","Balcony exterior-rated 6×6 support posts",count,"posts",180.,true),
   ("footings","Balcony post concrete footings · concept",count*4./27.,"cu yd",180.,false),
   ("postbases","Balcony rated post bases / beam caps",count*2.,"sets",65.,true),
   ("guards","Balcony 42 in guard upper / lower rails",rail_lf*2.,"linear ft",4.,false),
   ("balusters","Balcony sealed wood balusters",rails.iter().map(|r|n(r,"balusters")).sum(),"pieces",8.,true),
   ("hangers","Balcony exterior joist hanger sets",joists.len()as f64*2.,"sets",18.,true),
   ("flashing","Balcony ledger / sill flashing",b.w+n(door,"width")+2.,"linear ft",9.,false),
   ("bolts","Balcony ledger structural fastener allowance",(b.w/2.).ceil()*2.,"sets",12.,true),
   ("screws","Balcony exterior decking screws · 5 lb",area/100.,"boxes",38.,true),
   ("sealer","Balcony wood sealer · two coats",(area*2.8+rail_lf*3.+count*deck_y*2.)*2./350.,"gal",65.,true),
  ]{t.add(&format!("balcony-{}",id),"Outdoor living",name,net,unit,rate,"Displayed balcony geometry. Joist/member selections, elevated live load, ledger, guards, footings, drainage and weather exposure require engineering and local review.","Balcony geometry allowance",true,whole);}
 }
 let data=json!({"side":b.side,"x":b.x,"z":b.z,"w":b.w,"d":b.d,"deckY":deck_y,"area":area,"doorId":door["id"],"wallId":wall["id"],"existingGallery":b.existing,"columnStyle":if c.home_style=="Victorian"{"turned"}else{"square"},"joists":joists,"posts":posts,"rails":rails,"guardHeightInches":42,"note":if b.existing{"Upper veranda is counted in the existing reference porch schedule; its upper-floor doorway is connected."}else{"Post-supported balcony with a connected upper-floor door, exterior-rated framing and flashed ledger. Final structural/site detailing pending."}});
 m["balcony"]=data.clone();for level in m["levels"].as_array_mut().unwrap(){level["balcony"]=data.clone();}
 m["balconyArea"]=json!(area);super::add_bounds(m,c,b.x,b.z,b.w,b.d);
}
