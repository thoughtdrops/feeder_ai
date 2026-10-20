use crate::*;
mod regions;
/// Defaults apply on an architecture selection; subsequent finish edits remain user controlled.
pub fn architecture_defaults(c:&mut Config){
 c.room_wallpapers.clear();
 let(scheme,walls,ceiling,drywall,general,bedroom)=match c.home_style.as_str(){
 "Georgian"=>("Classic · Pearl & brass","#e6ddcb","#ece6d8","Smooth finish","Sunlit damask","Ivory botanical"),
 "Victorian"=>("Classic · Rosewood room","#d8e0d4","#eee4d9","Smooth finish","Ivory botanical","Heritage floral"),
 "Modern farmhouse"=>("Natural · Linen house","#e6e0d1","#eee9df","Fine orange peel","None","Ivory botanical"),
 "Craftsman"=>("Natural · Forest retreat","#d5dcc4","#e8dfca","Fine orange peel","None","Ivory botanical"),
 "Tudor"=>("Classic · Warm library","#e5d7b9","#eee1cc","Limewash","None","Sunlit damask"),
 "Cape Cod"=>("Classic · Blue salon","#d9e3e1","#eee9dc","Fine orange peel","Sky blue toile","Ivory botanical"),
 "Colonial"=>("Classic · Sage drawing room","#e4dfce","#efe9da","Smooth finish","Sunlit damask","Sky blue toile"),
 "French country"=>("Refined · Champagne suite","#e8dec7","#eee5d4","Limewash","Ivory botanical","Sunlit damask"),
 "Scandinavian"=>("Natural · Sandstone","#e6e3d7","#eee9df","Smooth finish","None","None"),
 "Mid-century"=>("Modern · Walnut calm","#e4d9bf","#eae3d5","Smooth finish","None","None"),
 "Ranch"=>("Natural · Terracotta","#ded8c5","#ede7d7","Fine orange peel","None","Ivory botanical"),
 "English cottage"=>("Natural · Forest retreat","#e4e0c9","#eee5d4","Limewash","Ivory botanical","Heritage floral"),
 "Coastal"=>("Natural · Coastal driftwood","#dce9e5","#eeeade","Fine orange peel","Sky blue toile","Ivory botanical"),
 "Industrial"=>("Urban · Concrete atelier","#d2d0c5","#e3e1d7","Limewash","None","None"),
 _=>("Modern · Stone & oak","#e2e1d5","#eeeadf","Smooth finish","None","None")};
 c.interior_style=scheme.into();let i=lookup("interiorSchemes",scheme);c.floor=s(&i,"floor").into();
 for(k,v)in i["colors"].as_object().unwrap(){c.colors.insert(k.clone(),v.as_str().unwrap().into());}
 c.colors.insert("walls".into(),walls.into());c.colors.insert("ceiling".into(),ceiling.into());
 c.drywall=drywall.into();c.wallpaper=general.into();c.bedroom_wallpaper=bedroom.into();
}
pub fn rooms(c:&Config,rs:&[Room],ws:&[Wall])->Vec<Room>{regions::build(c,rs,ws).rooms}
pub fn faces(c:&Config,rs:&[Room],ws:&[Wall])->Vec<Value>{
 let regions=regions::build(c,rs,ws);let mut out=vec![];
 for wall in ws{let along=wall.axis=="x";let origin=if along{wall.x}else{wall.z};let line=if along{wall.z}else{wall.x};let sides:Vec<f64>=if wall.exterior{vec![if near(line,0.){1.}else{-1.}]}else{vec![-1.,1.]};
  let mut cuts=vec![0.,wall.length];if c.design_mode=="Blank slate"{for at in (2..wall.length.ceil()as usize).step_by(2){cuts.push(at as f64)}}for r in rs{for edge in if along{[r.x,r.x+r.w]}else{[r.z,r.z+r.d]}{if edge>origin&&edge<origin+wall.length{cuts.push(edge-origin);}}}cuts.sort_by(f64::total_cmp);cuts.dedup_by(|a,b|near(*a,*b));
  for side in sides{for interval in cuts.windows(2){let(at,len)=(interval[0],interval[1]-interval[0]);if len<0.001{continue}let mid=origin+at+len/2.;let(x,z)=if along{(mid,line+side*0.01)}else{(line+side*0.01,mid)};let room=regions.room(x,z);let bedroom=room.is_some_and(|r|r.kind=="bedroom");let override_paper=room.and_then(|r|c.room_wallpapers.get(&r.id));let opening_area:f64=wall.openings.iter().map(|o|((at+len).min(o.at+o.width)-at.max(o.at)).max(0.)*o.height).sum();out.push(json!({"wallId":wall.id,"side":side,"at":at,"length":len,"area":(len*c.wall_height-opening_area).max(0.),"group":if bedroom{"bedroom"}else{"general"},"roomId":room.map(|r|r.id.as_str()).unwrap_or("custom"),"roomOverride":override_paper.is_some(),"tile":if override_paper.is_some(){"None"}else{c.wall_tiles.get(if bedroom{"bedroom"}else{"general"}).map(String::as_str).unwrap_or("None")},"customTexture":override_paper.is_none()&&c.custom_textures.contains_key(if bedroom{"bedroom"}else{"general"}),"wallpaper":override_paper.unwrap_or(if bedroom{&c.bedroom_wallpaper}else{&c.wallpaper})}));}}
 }
 // Grid cells identify blank-slate rooms, but contiguous faces remain one
 // renderer surface, avoiding hundreds of extra meshes on mobile.
 let mut merged:Vec<Value>=vec![];for face in out{if let Some(last)=merged.last_mut(){if ["wallId","side","roomId","group","tile","customTexture","wallpaper","roomOverride"].iter().all(|key|last[*key]==face[*key])&&near(n(last,"at")+n(last,"length"),n(&face,"at")){last["length"]=json!(n(last,"length")+n(&face,"length"));last["area"]=json!(n(last,"area")+n(&face,"area"));continue}}merged.push(face);}merged
}

/// Floors by area: kitchens share the bathrooms' floor ("wet" areas), living areas and halls have one, bedrooms
/// another. An area left unset uses the house floor.
pub const ZONES:[(&str,&str);3]=[("wet","Kitchen & bathrooms"),("living","Living areas & halls"),("bedroom","Bedrooms")];
pub fn zone(kind:&str)->&'static str{match kind{"kitchen"|"bath"=>"wet","bedroom"=>"bedroom",_=>"living"}}
pub fn floor_for<'a>(c:&'a Config,kind:&str)->&'a str{c.zone_floors.get(zone(kind)).map(String::as_str).unwrap_or(&c.floor)}
pub fn validate_zones(c:&Config)->Result<(),String>{
 let floors=&catalog()["options"]["floor"];let known=|f:&str|floors.as_array().is_some_and(|a|a.iter().any(|v|v.as_str()==Some(f)));
 if c.zone_floors.len()>ZONES.len()||c.zone_floors.iter().any(|(k,v)|!ZONES.iter().any(|z|z.0==k)||!known(v)){return Err("Choose a listed floor for the kitchen and bathrooms, living areas or bedrooms.".into())}Ok(())
}
/// Rooms whose floor differs from the house floor, for the viewer to lay over the house floor.
pub fn zone_floors(c:&Config,rs:&[Room])->Value{
 json!(rs.iter().filter(|r|r.kind!="stairs"&&floor_for(c,&r.kind)!=c.floor).map(|r|json!({"roomId":r.id,"x":r.x,"z":r.z,"w":r.w,"d":r.d,"floor":floor_for(c,&r.kind),"zone":zone(&r.kind)})).collect::<Vec<_>>())
}
