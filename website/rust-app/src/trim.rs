use crate::*;
pub fn library()->&'static Value{static L:OnceLock<Value>=OnceLock::new();L.get_or_init(||serde_json::from_str(include_str!("../data/millwork.json")).unwrap())}
pub fn profiles()->&'static Vec<Value>{library()["profiles"].as_array().unwrap()}
pub fn part_allowed(role:&str,p:&Value)->bool{match role{"base"=>s(p,"role")=="baseboard","cap"=>s(p,"role")=="base-cap","shoe"=>s(p,"role")=="base-shoe","casing"|"window"=>s(p,"role")=="casing","crown"|"cornice"=>["crown","sprung-cove","bed-moulding"].contains(&s(p,"role")),"corner"|"frieze"=>["casing","bed-moulding"].contains(&s(p,"role")),"hood"=>s(p,"role")=="drip-cap",_=>false}}
pub fn selected(c:&Config)->Value{
 let mut trim=lookup("trimPackages",&c.trim_package);let index=n(&trim,"profile")as usize;let oversized=c.trim_size=="Oversized";let scale=if oversized{1.5}else{1.};
 let finishes=["Sealed smoked oak","Sealed pale oak","Sealed honey oak","Sealed ivory-tinted oak","Sealed golden oak","Sealed dark walnut tone","Sealed amber oak","Sealed washed oak","Sealed seafoam-tinted oak","Sealed cedar tone"];
 let defaults=[(8417,8308,0,8283),(8417,8309,8024,8283),(8426,8304,8032,8284),(8419,8293,8000,8285),(8424,8299,8001,8286),(8415,8315,8013,8287),(8428,8300,8016,8284),(8421,8323,8021,8286),(8417,8329,8025,8284),(8426,8308,8031,8284)];let(base,casing,crown,hood)=defaults[index.min(9)];let mut parts=serde_json::Map::new();
 for(role,number)in[("base",base),("cap",0),("shoe",0),("casing",casing),("window",casing),("crown",crown),("corner",8308),("frieze",8308),("hood",hood),("cornice",if [0,1,6].contains(&index){8031}else{crown})]{
  let override_id=c.trim_overrides.get(role);if override_id.is_some_and(|id|id=="none"){parts.insert(role.into(),Value::Null);continue}
  let profile=override_id.and_then(|id|profiles().iter().find(|p|s(p,"id")==id&&part_allowed(role,p))).or_else(||profiles().iter().find(|p|n(p,"catalogNumber")==number as f64&&part_allowed(role,p)));
  if let Some(p)=profile{let mut part=p.clone();let mut height=n(p,"installedHeightInches");let mut projection=n(p,"installedProjectionInches");if override_id.is_none(){if role=="base"&&index<=1{height=if index==0{3.0}else{4.0};}if role=="casing"&&index<=1{height=3.0;}if role=="corner"{height=1.5;}if role=="frieze"{height=4.0;}}
   // Exterior surrounds use deeper carved stock; interior source sections stay
   // at their selected dimensions. Overrides retain their own section sizes.
   if role=="window"&&override_id.is_none(){let(hw,pd)=match c.home_style.as_str(){"Victorian"=>(5.5,1.75),"Georgian"=>(6.,1.5),"Colonial"=>(4.75,1.25),"French country"=>(5.5,1.625),"Craftsman"=>(5.,1.5),"Tudor"|"English cottage"=>(5.,1.875),"Coastal"=>(4.5,1.25),"Modern farmhouse"=>(4.5,1.125),_ =>(3.25,1.)};height=hw;projection=pd;}
   height=(height*scale).min(c.wall_height*12.*0.12);projection*=scale;part["width"]=json!(height/12.);part["projection"]=json!(projection/12.);part["installedHeightInches"]=json!(height);part["installedProjectionInches"]=json!(projection);part["priceLF"]=json!(round((1.1+height/12.*5.+projection/12.*4.+if index>=3{0.65}else{0.})*if oversized{1.3}else{1.}));parts.insert(role.into(),part);
  }else{parts.insert(role.into(),Value::Null);}
 }
 trim["parts"]=Value::Object(parts);trim["finish"]=json!(finishes[index.min(9)]);trim["material"]=json!("Sealed wood");trim["libraryCount"]=json!(100);trim["source"]=json!("Rockwell Millwork Catalogue · 1904");trim["sourceUrl"]=library()["sourceUrl"].clone();trim["size"]=json!(c.trim_size);trim["sizeScale"]=json!(scale);trim["projectionScale"]=json!(scale);trim["panels"]=json!(false);trim["chairRail"]=json!(0.);trim["railHeight"]=json!(0.);trim["textureIndex"]=json!(index);trim["baseHeight"]=trim["parts"]["base"]["width"].clone();trim["casingWidth"]=trim["parts"]["casing"]["width"].clone();trim["crown"]=trim["parts"]["crown"]["width"].clone();trim["cornerWidth"]=trim["parts"]["corner"]["width"].clone();for(k,role)in[("basePrice","base"),("casingPrice","casing"),("crownPrice","crown"),("cornerPrice","corner")]{trim[k]=trim["parts"][role]["priceLF"].clone();}trim
}
fn segment(out:&mut Vec<Value>,t:&Value,role:&str,mut a:[f64;3],mut b:[f64;3],normal:[f64;3],exterior:bool,wall:&str,opening:&str){let part=&t["parts"][role];if part.is_null(){return}let dx=b[0]-a[0];let dy=b[1]-a[1];let dz=b[2]-a[2];let length=(dx*dx+dy*dy+dz*dz).sqrt();if length<0.01{return}if dz*normal[0]-dx*normal[2]< -1e-8{std::mem::swap(&mut a,&mut b);}out.push(json!({"id":format!("TRIM-{}",out.len()+1),"role":role,"name":part["name"],"profileId":part["id"],"a":a,"b":b,"normal":normal,"length":length,"width":part["width"],"projection":part["projection"],"exterior":exterior,"wallId":wall,"openingId":opening}));}
fn point(w:&Wall,at:f64,y:f64,side:f64)->[f64;3]{if w.axis=="x"{[w.x+at,y,w.z+side*0.255]}else{[w.x+side*0.255,y,w.z+at]}}
fn normal(w:&Wall,side:f64)->[f64;3]{if w.axis=="x"{[0.,0.,side]}else{[side,0.,0.]}}
pub fn schedule(c:&Config,ws:&[Wall],roof:&Value,t:&Value)->Vec<Value>{let mut out=vec![];
 for w in ws{let interior_side=if near(if w.axis=="x"{w.z}else{w.x},0.){1.}else{-1.};let sides=if w.exterior{vec![interior_side]}else{vec![-1.,1.]};
  for side in sides{let norm=normal(w,side);let mut cuts=vec![(0.,w.length)];for o in w.openings.iter().filter(|o|o.kind!="window"){let mut next=vec![];for(a,b)in cuts{if o.at>b||o.at+o.width<a{next.push((a,b));}else{if a<o.at{next.push((a,o.at));}if b>o.at+o.width{next.push((o.at+o.width,b));}}}cuts=next;}
   for(a,b)in cuts{for role in["base","cap","shoe"]{let part=&t["parts"][role];let y=match role{"cap"=>0.2+n(&t["parts"]["base"],"width")+n(part,"width")/2.,_=>0.2+n(part,"width")/2.};segment(&mut out,t,role,point(w,a,y,side),point(w,b,y,side),norm,false,&w.id,"");}}
   let crown_y=c.wall_height-n(&t["parts"]["crown"],"width")/2.;segment(&mut out,t,"crown",point(w,0.,crown_y,side),point(w,w.length,crown_y,side),norm,false,&w.id,"");
   for o in w.openings.iter().filter(|o|o.kind!="window"){let cw=n(&t["parts"]["casing"],"width");let top=o.bottom+o.height;for at in[o.at-cw/2.,o.at+o.width+cw/2.]{segment(&mut out,t,"casing",point(w,at,0.2,side),point(w,at,top,side),norm,false,&w.id,&o.id);}segment(&mut out,t,"casing",point(w,o.at-cw,top+cw/2.,side),point(w,o.at+o.width+cw,top+cw/2.,side),norm,false,&w.id,&o.id);}
  }
  if w.exterior{let side=-interior_side;let norm=normal(w,side);for o in &w.openings{let cw=n(&t["parts"]["window"],"width");let top=o.bottom+o.height;let bottom=o.bottom.max(0.2);for at in[o.at-cw/2.,o.at+o.width+cw/2.]{segment(&mut out,t,"window",point(w,at,bottom,side),point(w,at,top,side),norm,true,&w.id,&o.id);}segment(&mut out,t,"window",point(w,o.at-cw,top+cw/2.,side),point(w,o.at+o.width+cw,top+cw/2.,side),norm,true,&w.id,&o.id);if o.kind=="window"{segment(&mut out,t,"window",point(w,o.at-cw,o.bottom-cw/2.,side),point(w,o.at+o.width+cw,o.bottom-cw/2.,side),norm,true,&w.id,&o.id);}let hh=n(&t["parts"]["hood"],"width");segment(&mut out,t,"hood",point(w,o.at-cw,top+cw+hh/2.,side),point(w,o.at+o.width+cw,top+cw+hh/2.,side),norm,true,&w.id,&o.id);}}
 }
 for corner in corners(c,ws,t){if let Some(w)=ws.iter().find(|w|w.id==s(&corner,"wallId")){let side=n(&corner,"side");segment(&mut out,t,"corner",point(w,n(&corner,"at"),n(&corner,"bottom"),side),point(w,n(&corner,"at"),n(&corner,"top"),side),normal(w,side),false,&w.id,"");}}
 if top_floor(c){for e in roof["edges"].as_array().unwrap().iter().filter(|e|["eave","rake"].contains(&s(e,"kind"))){let to_point=|v:&Value|[v[0].as_f64().unwrap(),v[1].as_f64().unwrap(),v[2].as_f64().unwrap()];let a=to_point(&e["a"]);let b=to_point(&e["b"]);let mid=[(a[0]+b[0])/2.,(a[1]+b[1])/2.,(a[2]+b[2])/2.];let norm=if near(a[0],b[0]){[if mid[0]<c.width/2.{-1.}else{1.},0.,0.]}else{[0.,0.,if mid[2]<c.depth/2.{-1.}else{1.}]};for role in["cornice","frieze"]{let offset=if role=="frieze"{n(&t["parts"]["cornice"],"width")}else{0.};let width=n(&t["parts"][role],"width");let mut aa=a;let mut bb=b;aa[1]-=offset+width/2.;bb[1]-=offset+width/2.;segment(&mut out,t,role,aa,bb,norm,true,"","");}}}
 // IDs include floor, making the combined schedule unambiguous.
 if c.active_floor>0{for p in &mut out{p["id"]=json!(format!("{}{}",s(p,"id"),floor_tag(c.active_floor)));}}out
}
pub fn surface_area(pieces:&[Value],t:&Value)->f64{pieces.iter().map(|piece|{let part=&t["parts"][s(piece,"role")];let ps=part["points"].as_array().unwrap();let w=n(piece,"width");let d=n(piece,"projection");let mut perimeter=0.;let mut area=0.;for i in 0..ps.len(){let p=&ps[i];let q=&ps[(i+1)%ps.len()];let x=p[0].as_f64().unwrap()*d;let y=p[1].as_f64().unwrap()*w;let xx=q[0].as_f64().unwrap()*d;let yy=q[1].as_f64().unwrap()*w;perimeter+=((xx-x).powi(2)+(yy-y).powi(2)).sqrt();area+=x*yy-xx*y;}perimeter*n(piece,"length")+area.abs()}).sum()}
pub fn costs(t:&mut model::Takeoff,pieces:&[Value],trim:&Value,ornaments:&[Value]){
 for(id,role,exterior,cat,label)in[("baseboard","base",false,"Interior","Baseboard"),("basecap","cap",false,"Interior","Base cap"),("baseshoe","shoe",false,"Interior","Base shoe"),("casing","casing",false,"Interior","Entrance casing"),("crown","crown",false,"Interior","Crown molding"),("cornertrim","corner",false,"Interior","Corner trim"),("exterior-windowtrim","window",true,"Exterior wood trim","Window & door surround"),("exterior-driptrim","hood",true,"Exterior wood trim","Opening drip cap"),("exterior-cornice","cornice",true,"Exterior wood trim","Eave and rake cornice"),("exterior-frieze","frieze",true,"Exterior wood trim","Under-overhang frieze")]{let part=&trim["parts"][role];let net=pieces.iter().filter(|p|s(p,"role")==role&&p["exterior"]==exterior).map(|p|n(p,"length")).sum();t.add(id,cat,&format!("{} · {} · {}",label,if part.is_null(){"None"}else{s(part,"name")},s(trim,"finish")),net,"linear ft",n(part,"priceLF"),"Sum of displayed molding segment lengths; openings deducted, end caps and ordering waste separate. Historic section dimensions are reference approximations.","Modeled geometry",true,false);}
 for kind in ["rosette","dentil","keystone","layered-cap","bead"]{let count=ornaments.iter().filter(|p|s(p,"kind")==kind).count();if count>0{t.add(&format!("trim-{}",kind),"Exterior wood trim",&format!("Carved wood {} · {}",kind,s(trim,"finish")),count as f64,"pieces",match kind{"rosette"=>18.,"keystone"=>24.,"layered-cap"=>12.,_=>4.},"Counted relief pieces in the displayed window/door assemblies; sealed wood, source-informed ornament rather than fabrication tooling dimensions.","Modeled relief count",false,true);}}
 let area=surface_area(pieces,trim)+ornament_surface(ornaments);t.add("trimsealer","Wood trim coating","Wood sealer · two coats, all faces and ends",area*2./350.,"gallons",65.,"Profile perimeter × run plus end faces and relief-piece bounding surfaces; 2 coats at sample 350 sq ft/gal. Confirm chosen exterior coating coverage and renewals.","Coating allowance",true,true);
 let fasteners=pieces.iter().map(|p|(n(p,"length")/(16./12.)).ceil()+1.).sum::<f64>();t.add("trimfasteners","Fasteners","Corrosion-resistant wood trim fasteners · 250 pack",fasteners/250.,"packs",32.,"One fastener at each segment end and nominal 16 in stations; final exterior species/product fastening to be specified.","Allowance",true,true);
}
// Only vertical corner legs are added to the perimeter and doorway mouldings.
// This schedule is shared by the renderer and material takeoff.
pub fn corners(c:&Config,ws:&[Wall],trim:&Value)->Vec<Value>{
 let mut out=vec![];let width=n(trim,"cornerWidth");
 for wall in ws{for end in [false,true]{
  let at=if end{wall.length}else{0.};let x=wall.x+if wall.axis=="x"{at}else{0.};let z=wall.z+if wall.axis=="z"{at}else{0.};
  let joined=ws.iter().any(|other|other.id!=wall.id&&other.axis!=wall.axis&&if other.axis=="x"{near(other.z,z)&&x>=other.x-1e-8&&x<=other.x+other.length+1e-8}else{near(other.x,x)&&z>=other.z-1e-8&&z<=other.z+other.length+1e-8});
  if !joined||wall.length<width*2.{continue}let center=if end{wall.length-width/2.}else{width/2.};
  if wall.openings.iter().any(|o|o.at<center+width/2.&&o.at+o.width>center-width/2.){continue}
  let sides=if wall.exterior{vec![if near(if wall.axis=="x"{wall.z}else{wall.x},0.){1.}else{-1.}]}else{vec![-1.,1.]};
  for side in sides{out.push(json!({"wallId":wall.id,"at":center,"side":side,"width":width,"bottom":0.2,"top":c.wall_height,"length":c.wall_height-0.2}));}
 }}out
}

pub fn ornaments(c:&Config,ws:&[Wall],t:&Value)->Vec<Value>{
    let mut out=vec![];let cw=n(&t["parts"]["window"],"width");let projection=n(&t["parts"]["window"],"projection");
    if cw<=0.||projection<=0.{return out}
    let scale=n(t,"sizeScale");let mut add=|kind:&str,w:&Wall,o:&Opening,at:f64,y:f64,width:f64,height:f64,depth:f64,norm:[f64;3],side:f64|{
        if y+height/2.>c.wall_height+0.01||y-height/2.<0.1{return}
        out.push(json!({"id":format!("RELIEF-{}{}",out.len()+1,floor_tag(c.active_floor)),"kind":kind,"position":point(w,at,y,side),"normal":norm,"width":width,"height":height,"depth":depth,"wallId":w.id,"openingId":o.id}));
    };
    for w in ws.iter().filter(|w|w.exterior){let interior_side=if near(if w.axis=="x"{w.z}else{w.x},0.){1.}else{-1.};let side=-interior_side;let norm=normal(w,side);
        for o in &w.openings{let top=o.bottom+o.height;let y=top+cw/2.;
            match c.home_style.as_str(){
                "Victorian"=>{for at in[o.at-cw/2.,o.at+o.width+cw/2.]{add("rosette",w,o,at,y,cw*1.18,cw*1.18,projection+0.06,norm,side);}}
                "Georgian"|"Colonial"|"French country"=>{
                    let span=o.width+cw*2.;let count=(span/0.45).floor()as usize;
                    if !t["parts"]["hood"].is_null(){for i in 0..count{add("dentil",w,o,o.at-cw+(i as f64+0.5)*span/count as f64,top+cw+0.04,0.15*scale,0.16*scale,projection+0.05,norm,side);}}
                    add("keystone",w,o,o.at+o.width/2.,y,cw*0.7,cw*1.25,projection+0.09,norm,side);
                }
                "Craftsman"|"Tudor"|"English cottage"=>{
                    add("layered-cap",w,o,o.at+o.width/2.,top+cw*0.85,o.width+cw*2.6,cw*0.24,projection+0.06,norm,side);
                }
                "Coastal"=>{let count=((o.width+cw)/0.32).floor()as usize;for i in 0..count{add("bead",w,o,o.at-cw/2.+(i as f64+0.5)*(o.width+cw)/count as f64,y,0.11*scale,0.11*scale,projection+0.025,norm,side);}}
                _=>{}
            }
        }
    }
    out
}
pub fn ornament_surface(ornaments:&[Value])->f64{
    ornaments.iter().map(|o|{let(w,h,d)=(n(o,"width"),n(o,"height"),n(o,"depth"));2.*(w*h+w*d+h*d)}).sum()
}
