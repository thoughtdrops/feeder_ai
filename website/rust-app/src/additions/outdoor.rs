use crate::*;

pub fn kind(c:&Config)->&str{
    if c.rear_outdoor!="None"&&super::balconies::planned(c).is_some_and(|b|!b.existing){return "Deck"}
    if c.rear_outdoor!="Style matched"{return &c.rear_outdoor}
    if c.design_mode=="Blank slate"||c.design_mode=="Affordable"||c.width<16.||c.depth<16.{return "None"}
    match c.home_style.as_str(){"Victorian"|"Colonial"|"Craftsman"|"English cottage"|"Modern farmhouse"|"Coastal"=>"Covered porch","Ranch"|"Mid-century"|"Contemporary"|"Scandinavian"=>"Deck",_=>"None"}
}

pub fn apply(c:&Config,m:&mut Value,t:&mut model::Takeoff){
    let kind=kind(c);if kind=="None"{m["rearOutdoor"]=Value::Null;return}
    let w=grid(c.rear_width.min(c.width)).max(4.);let d=c.rear_depth;let ground=if c.stories>=2{&m["levels"][0]}else{&*m};let center=ground["walls"].as_array().unwrap().iter().filter(|wall|s(wall,"axis")=="x"&&near(n(wall,"z"),c.depth)).flat_map(|wall|wall["openings"].as_array().unwrap()).find(|o|s(o,"kind")=="door").map(|o|n(o,"at")+n(o,"width")/2.).unwrap_or(c.width/2.);let x=grid(center-w/2.).clamp(0.,c.width-w);let z=c.depth;let deck_y=0.2;
    let count=(w/(16./12.)).ceil()as usize;let joists:Vec<_>=(0..=count).map(|i|json!({"a":[x+w*i as f64/count as f64,deck_y-0.33,z],"b":[x+w*i as f64/count as f64,deck_y-0.33,z+d],"length":d,"stockLength":(d/2.).ceil()*2.})).collect();
    let beam_rows=(d/8.).ceil()as usize;let stations=(w/8.).ceil()as usize;let mut posts=vec![];let mut beams=vec![];
    for row in 1..=beam_rows{let rz=z+d*row as f64/beam_rows as f64;beams.push(json!({"a":[x,deck_y-0.7,rz],"b":[x+w,deck_y-0.7,rz],"length":w}));for i in 0..=stations{posts.push(json!({"x":x+w*i as f64/stations as f64,"z":rz,"height":if kind=="Covered porch"{c.wall_height-0.4}else{3.2},"structuralHeight":if kind=="Covered porch"{c.wall_height-0.4}else{3.2}}));}}
    let step_w=4_f64.min(w);let step_x=x+(w-step_w)/2.;let mut rails=vec![];
    let mut rail=|a:[f64;3],b:[f64;3]|{let length=((a[0]-b[0]).powi(2)+(a[2]-b[2]).powi(2)).sqrt();if length>0.05{rails.push(json!({"a":a,"b":b,"length":length,"balusters":(length/(4./12.)).ceil().max(2.)as usize-1}));}};
    rail([x,3.2,z],[x,3.2,z+d]);rail([x+w,3.2,z],[x+w,3.2,z+d]);rail([x,3.2,z+d],[step_x,3.2,z+d]);rail([step_x+step_w,3.2,z+d],[x+w,3.2,z+d]);
    let mut roofs=vec![];
    if kind=="Covered porch"{let mut pc=c.clone();pc.width=w;pc.depth=d;pc.wall_height=c.wall_height-0.4;pc.pitch=3.;pc.home_style="Coastal".into();pc.stories=1;pc.active_floor=0;let roof=roof::build_with_overhang(&pc,0.25);roofs.push(json!({"x":x,"z":z,"w":w,"d":d,"h":pc.wall_height,"roof":roof}));}
    let roof_area:f64=roofs.iter().map(|r|n(&r["roof"],"area")).sum();let rail_lf:f64=rails.iter().map(|r|n(r,"length")).sum();let balusters:f64=rails.iter().map(|r|n(r,"balusters")).sum();let rafters:Vec<_>=roofs.iter().flat_map(|r|r["roof"]["rafters"].as_array().unwrap()).collect();
    let roof_edge:f64=roofs.iter().flat_map(|r|r["roof"]["edges"].as_array().unwrap()).filter(|e|["eave","rake"].contains(&s(e,"kind"))).map(|e|n(e,"length")).sum();
    let ground=if c.stories>=2{&m["levels"][0]}else{&*m};let doors:Vec<_>=ground["walls"].as_array().unwrap().iter().filter(|wall|s(wall,"axis")=="x"&&near(n(wall,"z"),c.depth)).flat_map(|wall|wall["openings"].as_array().unwrap()).filter(|o|s(o,"kind")=="door"&&n(o,"at")>=x&&n(o,"at")+n(o,"width")<=x+w).collect();
    let access=if doors.is_empty(){"Exterior-step access only; add a rear door in 3D if an indoor connection is wanted."}else{"Connected to the modeled rear door."};
    let data=json!({"kind":kind,"form":format!("Rear {}",kind),"columnStyle":if ["Victorian","English cottage"].contains(&c.home_style.as_str()){"turned"}else if c.home_style=="Craftsman"{"tapered"}else{"square"},"rectangles":[{"x":x,"z":z,"w":w,"d":d,"deckYs":[deck_y]}],"roofs":roofs,"area":w*d,"deckArea":w*d,"rimLF":2.*(w+d),"roofArea":roof_area,"posts":posts,"beams":beams,"rails":rails,"deckJoists":joists,"deckY":deck_y,"steps":{"x":step_x,"z":z+d,"w":step_w,"risers":2,"tread":1.,"direction":1.},"access":access,"basis":"Style-coordinated rear addition; assumed near-grade elevation. Footings, ledger attachment, deck loading, guards and site elevation require final design."});
    for(id,name,net,unit,rate,waste,whole)in[
        ("rear-deck","Rear sealed wood decking · 5/4 × 6",w*d/(5.5/12.),"linear ft",2.2,true,false),
        ("rear-joists","Rear deck treated 2×8 joist stock",joists.iter().map(|j|n(j,"stockLength")).sum(),"linear ft",2.4,true,false),
        ("rear-rim","Rear deck treated rim / ledger",2.*(w+d),"linear ft",2.4,true,false),
        ("rear-beams","Rear deck doubled treated beam plies",w*beam_rows as f64*2.,"linear ft",3.,true,false),
        ("rear-posts","Rear deck / porch exterior-rated posts",posts.len()as f64,"each",if kind=="Covered porch"{180.}else{45.},false,true),
        ("rear-footings","Rear post footing concrete · 24×24×12 in allowance",posts.len()as f64*4./27.,"cu yd",180.,true,false),
        ("rear-postbases","Rear post bases / anchors / connectors",posts.len()as f64,"sets",65.,false,true),
        ("rear-rails","Rear deck guard upper / lower rails",rail_lf*2.,"linear ft",4.,true,false),
        ("rear-balusters","Rear deck guard balusters",balusters,"each",8.,false,true),
        ("rear-steps","Rear step material / stringers",1.,"set",240.,false,true),
        ("rear-hangers","Rear deck joist / rafter connectors",(joists.len()+rafters.len())as f64*2.,"sets",12.,false,true),
        ("rear-screws","Rear decking / trim exterior screw packs",w*d/100.,"packs",38.,true,true),
        ("rear-sealer","Rear exterior wood sealer · two coats",(w*d*2.8+rail_lf*3.+posts.len()as f64*20.)*2./350.,"gal",65.,true,true),
        ("rear-roofjoists","Rear porch I-joist rafter stock",rafters.iter().map(|r|n(r,"stockLength")).sum(),"linear ft",6.5,true,false),
        ("rear-roofbeams","Rear porch protected LVL ridge / edge beam allowance",if roofs.is_empty(){0.}else{w*2.+d*2.},"assembly linear ft",36.,true,false),
        ("rear-ziproof","Rear porch ZIP roof panels · 4×8",roof_area/32.,"sheets",54.,true,true),
        ("rear-ziptape","Rear porch ZIP seam tape · 90 ft",roof_area*0.375/90.,"rolls",43.,true,true),
        ("rear-roofmetal","Rear porch metal roofing",roof_area,"sq ft",4.2,true,false),
        ("rear-rooftrim","Rear porch fascia / rake / cap",roof_edge,"linear ft",5.5,true,false),
        ("rear-flashing","Rear porch ledger / roof-wall flashing",w*if roofs.is_empty(){1.}else{2.},"linear ft",8.,true,false),
        ("rear-soffit","Rear porch soffit finish",if roofs.is_empty(){0.}else{(w+0.5)*(d+0.5)-w*d},"sq ft",4.,true,false),
    ]{if net>0.{t.add(id,"Outdoor living",name,net,unit,rate,"Derived from the displayed rear deck/porch, 16 in joist stations, support rows, posts, guard runs and roof planes. Final load/connection/site design pending.","Outdoor geometry allowance",waste,whole);}}
    m["rearOutdoor"]=data.clone();if c.stories>=2{m["levels"][0]["rearOutdoor"]=data;}
    super::add_bounds(m,c,x-0.25,z,w+0.5,d+2.25);m["outdoorArea"]=json!(n(m,"porchArea")+w*d);
}
