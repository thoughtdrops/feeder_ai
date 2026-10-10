use crate::*;
mod dormers;
mod outdoor;
mod accents;
pub mod balconies;

pub fn validate(c:&Config)->Result<(),String>{
    for(value,allowed,label)in[
        (&c.dormer_style,vec!["None","Style matched","Gable","Shed","Hip"],"dormer roof"),
        (&c.dormer_side,vec!["Automatic","Front","Rear","Left","Right"],"dormer side"),
        (&c.balcony,vec!["Style matched","None","Rear balcony"],"upper balcony"),
        (&c.rear_outdoor,vec!["Style matched","None","Deck","Covered porch"],"rear outdoor space"),
        (&c.window_style,vec!["Style matched","Double hung","Casement","Picture"],"window style"),
        (&c.window_size,vec!["Style matched","Medium","Large"],"window size"),
        (&c.roof_edge_style,vec!["Style matched","Plain fascia","Stepped cornice","Ogee cornice","Dentil cornice","Craftsman brackets","Victorian fretwork"],"roof edge"),
        (&c.gable_accent,vec!["Style matched","None","Shingle panel","Board and batten","Tudor timber"],"gable accent"),
        (&c.finials,vec!["Style matched","None","Turned finials","Roof spire"],"roof ornament"),
    ]{if !allowed.contains(&value.as_str()){return Err(format!("Choose a listed {} option.",label));}}
    if ![2.,4.,8.,16.].contains(&c.dormer_width)||![2.,4.,8.,16.].contains(&c.dormer_depth)||c.dormer_count>6{return Err("Dormers use 2, 4, 8 or 16 ft modules, with up to six dormers.".into());}
    if ![c.rear_width,c.rear_depth].iter().all(|v|v.is_finite()&&*v>=2.&&*v<=32.&&near(*v/2.,(*v/2.).round())){return Err("Rear decks and porches use 2 ft increments from 2 to 32 ft.".into());}
    Ok(())
}

pub fn rear_kind(c:&Config)->&str{outdoor::kind(c)}

pub fn window_type(c:&Config)->&str{
    if c.window_style!="Style matched"{return &c.window_style;}
    if ["Contemporary","Mid-century","Industrial","Ranch"].contains(&c.home_style.as_str()){"Picture"}
    else if ["Tudor","English cottage","French country","Scandinavian"].contains(&c.home_style.as_str()){"Casement"}
    else{"Double hung"}
}

pub fn apply(c:&Config,mut m:Value)->Value{
    let mut t=model::Takeoff{items:vec![],c};
    dormers::apply(c,&mut m,&mut t);
    outdoor::apply(c,&mut m,&mut t);
    balconies::apply(c,&mut m,&mut t);
    accents::apply(c,&mut m,&mut t);
    // Window prices scale with actual opening size and selected operating type.
    m["items"].as_array_mut().unwrap().retain(|i|s(i,"id")!="windows");
    let escape_ids= m["openingChecks"]["schedule"].as_array().unwrap().iter().filter(|o|o["bedroomEscapeCandidate"]==true).map(|o|s(o,"id").to_string()).collect::<std::collections::BTreeSet<_>>();
    let mut schedule=vec![];
    let mut windows:BTreeMap<String,(f64,f64,f64,String)>=BTreeMap::new();
    let walls=m.get("allWalls").and_then(Value::as_array).unwrap_or_else(||m["walls"].as_array().unwrap());
    for wall in walls.iter().filter(|w|w["exterior"]==true){for o in wall["openings"].as_array().unwrap().iter().filter(|o|s(o,"kind")=="window"){
        let (w,h)=(n(o,"width"),n(o,"height"));let kind=if window_type(c)=="Picture"&&escape_ids.contains(s(o,"id")){"Casement"}else{window_type(c)};
        schedule.push(json!({"id":o["id"],"wallId":wall["id"],"width":w,"height":h,"type":kind,"bedroomEscapeCandidate":escape_ids.contains(s(o,"id"))}));
        let key=format!("windows-{}-{}-{}",kind,w,h);let entry=windows.entry(key).or_insert((0.,w,h,kind.into()));entry.0+=1.;
    }}
    for(id,(count,w,h,kind))in windows{t.add(&id,"Openings",&format!("{} window · {} × {} ft rough opening",kind,w,h),count,"units",(w*h*if kind=="Casement"{65.}else if kind=="Picture"{48.}else{55.}).max(220.),"Actual modeled opening size; retail allowance. Confirm product U-factor, design pressure, rough opening and bedroom escape dimensions.","Size-based retail allowance",false,true);}
    if c.stories>=2{
        let area=(c.stories-1)as f64*(c.width*c.depth-if m["stair"].is_object(){n(&m["stair"]["opening"],"w")*n(&m["stair"]["opening"],"d")}else{0.}).max(0.);
        t.add("floor-batts","Insulation","R-19 unfaced fiberglass floor / inter-story sound batts",area,"sq ft",0.85,"Inter-story floor area minus stair opening. Sound allowance for conditioned floors, not a thermal code requirement; no kraft facing between conditioned floors.","Area allowance",true,false);
    }
    let mut interior_cavity=0.;
    let levels=m["levels"].as_array().cloned().unwrap_or_else(||vec![m.clone()]);
    for level in levels{let mut cc=c.clone();cc.active_floor=n(&level,"floorIndex")as usize;let walls:Vec<Wall>=serde_json::from_value(level["walls"].clone()).unwrap();let members=frame::build(&walls,&cc);let cavity_walls:Vec<_>=walls.into_iter().filter(|w|!w.exterior).map(|mut w|{w.exterior=true;w}).collect();interior_cavity+=frame::cavity(&cavity_walls,&members,c.wall_height);}
    t.add("interior-batts","Insulation","Unfaced fiberglass interior wall sound batts",interior_cavity,"sq ft",0.75,"One cavity face per interior partition, less the union of actual framing and door/opening areas. Sound allowance; product sizing and batt cutting remain to be selected.","Modeled cavity area",true,false);
    m["items"].as_array_mut().unwrap().extend(t.items.iter().map(|i|serde_json::to_value(i).unwrap()));
    m["counts"]["drywallSheets"]=json!(m["items"].as_array().unwrap().iter().filter(|i|s(i,"unit")=="sheets"&&["drywallwalls","drywallceiling","garage-drywall","garage-ceilingdrywall"].contains(&s(i,"id"))||s(i,"unit")=="sheets"&&s(i,"id").starts_with("DORMER-")&&s(i,"id").ends_with("-drywall")).map(|i|n(i,"qty")).sum::<f64>());
    m["interiorCavityArea"]=json!(round(interior_cavity));
    let subtotal=round(m["items"].as_array().unwrap().iter().map(|i|n(i,"total")).sum());m["subtotal"]=json!(subtotal);m["tax"]=json!(round(subtotal*c.tax/100.));m["total"]=json!(round(subtotal+n(&m,"tax")));
    m["insulationAssemblies"]=json!({"exteriorWalls":"R-21 kraft-faced fiberglass batts + model-code ZIP-R continuous insulation where required","interiorWalls":"Unfaced fiberglass sound batts","floor":"Unfaced fiberglass inter-story sound batts; ground-floor slab insulation follows the location profile","roof":"Kraft-faced fiberglass roof / ceiling batts; R-value follows the location profile","facingReview":"Facing placement, roof ventilation and local vapor-retarder requirements require assembly review. ZIP does not by itself determine these requirements."});
    m["windowSchedule"]=json!(schedule);
    m["windowType"]=json!(window_type(c));m["windowSize"]=json!(c.window_size);
    let schedule=m["windowSchedule"].clone();
    if let Some(levels)=m["levels"].as_array_mut(){for level in levels{level["windowSchedule"]=schedule.clone();level["windowType"]=json!(window_type(c));}}
    m
}

pub(super) fn add_bounds(m:&mut Value,c:&Config,x:f64,z:f64,w:f64,d:f64){
    if !m["siteBounds"].is_object(){m["siteBounds"]=json!({"minX":0.,"minZ":0.,"maxX":c.width,"maxZ":c.depth});}
    for (key,v) in [("minX",x),("minZ",z),("maxX",x+w),("maxZ",z+d)]{m["siteBounds"][key]=json!(if key.starts_with("min"){n(&m["siteBounds"],key).min(v)}else{n(&m["siteBounds"],key).max(v)});}
}
