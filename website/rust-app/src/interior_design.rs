use crate::*;

// Kitchen and living-room design choices. "Style matched" resolves from the interior scheme family
// (Modern, Classic, Natural, Urban, Collected, Refined), so every scheme arrives as a coherent show home;
// each choice is drawn in 3D and its cost difference is priced here.
pub const CABINETS:[&str;6]=["Style matched","Shaker","Flat slab","Raised panel","Beadboard","Fluted oak"];
pub const COUNTERS:[&str;7]=["Style matched","White quartz","Calacatta marble","Butcher block","Black granite","Concrete","Soapstone"];
pub const BACKSPLASHES:[&str;7]=["Style matched","Subway tile","Chevron","Zellige","Hexagon","Full-height slab","None"];
pub const RANGES:[&str;4]=["Style matched","30 in slide-in","36 in pro range","48 in pro range"];
pub const HOODS:[&str;4]=["Style matched","Stainless chimney","Plaster hood","Wood mantel hood"];
pub const SINKS:[&str;3]=["Style matched","Undermount stainless","Farmhouse apron"];
pub const UPPERS:[&str;4]=["Style matched","Upper cabinets","Glass-front uppers","Open shelving"];
pub const HARDWARE:[&str;4]=["Style matched","Brushed nickel","Brass","Matte black"];
pub const ISLANDS:[&str;5]=["Style matched","Waterfall island","Seating island & stools","Butcher block work island","None"];
pub const PENDANTS:[&str;5]=["Style matched","Dome","Glass globe","Lantern","Linear chandelier"];
pub const FRIDGES:[&str;3]=["Style matched","Stainless French door","Panel-ready built-in"];
pub const SEATING:[&str;7]=["Style matched","Wraparound U sectional","L-shaped sectional","Sofa & lounge chairs","Chesterfield sofa","Curved sofa","Mid-century sofa"];
pub const MEDIA:[&str;5]=["Style matched","TV console","Fireplace & TV","Built-in shelves & TV","Fireplace & art"];
pub const COFFEE:[&str;5]=["Style matched","Walnut rectangle","Round marble","Upholstered ottoman","Glass & brass"];
pub const RUGS:[&str;5]=["Style matched","Trellis wool","Vintage Persian","Natural jute","Solid plush"];

/// Every choice as (config field, label, options, current value).
pub fn fields(c:&Config)->[(&'static str,&'static str,&'static [&'static str],&str);15]{[
    ("kitchenCabinets","Cabinet doors",&CABINETS,&c.kitchen_cabinets),
    ("kitchenCounter","Countertops",&COUNTERS,&c.kitchen_counter),
    ("kitchenBacksplash","Backsplash",&BACKSPLASHES,&c.kitchen_backsplash),
    ("kitchenRange","Range",&RANGES,&c.kitchen_range),
    ("kitchenHood","Range hood",&HOODS,&c.kitchen_hood),
    ("kitchenSink","Sink",&SINKS,&c.kitchen_sink),
    ("kitchenUppers","Wall storage",&UPPERS,&c.kitchen_uppers),
    ("kitchenHardware","Hardware & faucet finish",&HARDWARE,&c.kitchen_hardware),
    ("kitchenIsland","Island",&ISLANDS,&c.kitchen_island),
    ("kitchenPendants","Island lighting",&PENDANTS,&c.kitchen_pendants),
    ("kitchenFridge","Refrigerator",&FRIDGES,&c.kitchen_fridge),
    ("livingSeating","Seating",&SEATING,&c.living_seating),
    ("livingMedia","Media wall",&MEDIA,&c.living_media),
    ("livingCoffee","Coffee table",&COFFEE,&c.living_coffee),
    ("livingRug","Area rug",&RUGS,&c.living_rug),
]}

/// A generated home arrives with the kitchen and living room of its interior scheme.
pub fn match_style(c:&mut Config){for v in [&mut c.kitchen_cabinets,&mut c.kitchen_counter,&mut c.kitchen_backsplash,&mut c.kitchen_range,&mut c.kitchen_hood,&mut c.kitchen_sink,&mut c.kitchen_uppers,&mut c.kitchen_hardware,&mut c.kitchen_island,&mut c.kitchen_pendants,&mut c.kitchen_fridge,&mut c.living_seating,&mut c.living_media,&mut c.living_coffee,&mut c.living_rug]{*v="Style matched".into();}}

pub fn validate(c:&Config)->Result<(),String>{
    for(_,label,options,value)in fields(c){if !options.contains(&value){return Err(format!("Choose a listed {} option.",label.to_lowercase()));}}
    Ok(())
}

/// The scheme family's show-home kitchen and living room, in `fields` order.
fn matched(c:&Config)->[&'static str;15]{
    match c.interior_style.split(" · ").next().unwrap_or(""){
        "Modern"=>["Flat slab","White quartz","Full-height slab","36 in pro range","Plaster hood","Undermount stainless","Upper cabinets","Matte black","Waterfall island","Linear chandelier","Panel-ready built-in","L-shaped sectional","TV console","Walnut rectangle","Solid plush"],
        "Classic"=>["Raised panel","Calacatta marble","Subway tile","48 in pro range","Wood mantel hood","Farmhouse apron","Glass-front uppers","Brass","Seating island & stools","Lantern","Stainless French door","Chesterfield sofa","Fireplace & TV","Round marble","Vintage Persian"],
        "Natural"=>["Shaker","Butcher block","Zellige","30 in slide-in","Plaster hood","Farmhouse apron","Open shelving","Brushed nickel","Butcher block work island","Dome","Stainless French door","Sofa & lounge chairs","Built-in shelves & TV","Upholstered ottoman","Natural jute"],
        "Urban"=>["Flat slab","Concrete","Subway tile","36 in pro range","Stainless chimney","Undermount stainless","Open shelving","Matte black","Waterfall island","Glass globe","Stainless French door","Wraparound U sectional","TV console","Glass & brass","Solid plush"],
        "Collected"=>["Beadboard","Soapstone","Hexagon","48 in pro range","Wood mantel hood","Farmhouse apron","Glass-front uppers","Brass","Seating island & stools","Lantern","Stainless French door","Curved sofa","Fireplace & art","Round marble","Vintage Persian"],
        "Refined"=>["Fluted oak","Calacatta marble","Full-height slab","48 in pro range","Plaster hood","Undermount stainless","Glass-front uppers","Brass","Waterfall island","Glass globe","Panel-ready built-in","Wraparound U sectional","Fireplace & TV","Round marble","Trellis wool"],
        _=>["Shaker","White quartz","Subway tile","30 in slide-in","Stainless chimney","Undermount stainless","Upper cabinets","Brushed nickel","Waterfall island","Dome","Stainless French door","L-shaped sectional","TV console","Walnut rectangle","Trellis wool"],
    }
}

/// Resolved choices keyed by config field (no "Style matched" left).
pub fn resolved(c:&Config)->BTreeMap<&'static str,&str>{
    let defaults=matched(c);fields(c).into_iter().zip(defaults).map(|((key,_,_,value),fallback)|(key,if value=="Style matched"{fallback}else{value})).collect()
}
fn get<'a>(c:&'a Config,key:&str)->&'a str{resolved(c).get(key).copied().unwrap_or("")}

/// Living-room seating that needs a footprint wider and deeper than a single sofa.
pub fn wide_seating(c:&Config)->Option<&'static str>{
    match get(c,"livingSeating"){"Wraparound U sectional"=>Some("u"),"L-shaped sectional"=>Some("l"),"Sofa & lounge chairs"=>Some("chairs"),_=>None}
}
pub fn seating_price(c:&Config)->(&'static str,f64){
    match get(c,"livingSeating"){"Wraparound U sectional"=>("Wraparound U sectional sofa",3600.),"L-shaped sectional"=>("L-shaped sectional sofa",2600.),"Sofa & lounge chairs"=>("Sofa with two lounge chairs",2700.),_=>("Sectional sofa",2600.)}
}

pub fn cabinet_name(c:&Config)->String{let uppers=get(c,"kitchenUppers");format!("{} doors{}",get(c,"kitchenCabinets"),match uppers{"Open shelving"=>" · open shelving above","Glass-front uppers"=>" · glass-front uppers",_=>""})}
pub fn cabinet_rate(c:&Config)->f64{
    let door=match get(c,"kitchenCabinets"){"Flat slab"=>1.05,"Raised panel"=>1.25,"Beadboard"=>1.1,"Fluted oak"=>1.4,_=>1.};
    // Open shelving drops the upper boxes (about 15% of a run's cabinetry); the shelves are priced on their own line.
    210.*door*if get(c,"kitchenUppers")=="Open shelving"{0.85}else{1.}
}
pub fn counter_name(c:&Config)->&str{get(c,"kitchenCounter")}
pub fn counter_rate(c:&Config)->f64{45.*match get(c,"kitchenCounter"){"Calacatta marble"=>1.6,"Butcher block"=>0.8,"Black granite"=>1.1,"Concrete"=>1.4,"Soapstone"=>1.5,_=>1.}}
pub fn sink_name(c:&Config)->&'static str{if get(c,"kitchenSink")=="Farmhouse apron"{"Farmhouse apron sink & bridge faucet"}else{"Undermount stainless sink & faucet"}}
pub fn sink_rate(c:&Config)->f64{if get(c,"kitchenSink")=="Farmhouse apron"{1070.}else{420.}}
pub fn backsplash_name(c:&Config)->String{match get(c,"kitchenBacksplash"){"None"=>"Kitchen backsplash · painted wall (no tile)".into(),"Full-height slab"=>format!("Kitchen backsplash · {} full-height slab",get(c,"kitchenCounter").to_lowercase()),v=>format!("Kitchen backsplash · {}",v.to_lowercase())}}
pub fn backsplash_rate(c:&Config)->f64{match get(c,"kitchenBacksplash"){"Chevron"=>16.,"Zellige"=>26.,"Hexagon"=>14.,"Full-height slab"=>counter_rate(c)*1.1,"None"=>0.,_=>9.}}
pub fn hardware_name(c:&Config)->String{format!("Cabinet pulls / hinges · {}",get(c,"kitchenHardware").to_lowercase())}
pub fn hardware_rate(c:&Config)->f64{match get(c,"kitchenHardware"){"Brass"=>18.,"Matte black"=>13.,_=>10.}}

/// Drops an island the visitor turned off, and gives wide seating its footprint where the room allows it
/// (back on the sofa's wall, coffee table inside, clear of doors, walls, clearances and other pieces).
pub fn stage(c:&Config,rs:&[Room],ws:&[Wall],fs:&mut Vec<staging::Furniture>)->Vec<String>{let mut notes=vec![];
    if get(c,"kitchenIsland")=="None"{fs.retain(|f|f.kind!="island");}
    let media=get(c,"livingMedia");
    if ["Fireplace & TV","Fireplace & art","Built-in shelves & TV"].contains(&media){
        let consoles:Vec<String>=fs.iter().filter(|f|f.kind=="console").map(|f|f.id.clone()).collect();
        for id in consoles{
            let Some(i)=fs.iter().position(|f|f.id==id)else{continue};let base=fs[i].clone();let Some(room)=rs.iter().find(|r|r.id==base.room_id)else{continue};
            if glass_behind(&base,ws){notes.push(format!("The {} media wall is in front of a window, so it keeps the console; move it to a solid wall for the {}.",room.name.to_lowercase(),if media.starts_with("Fireplace"){"fireplace"}else{"built-ins"}));continue}
            let widths:&[f64]=if media.starts_with("Fireplace"){&[7.,6.,5.]}else{&[9.,8.,7.,6.]};let (sin,cos)=(base.rotation.sin(),base.rotation.cos());
            'wide:for &width in widths{for slide in [0.,-1.,1.,-2.,2.]{
                let mut f=base.clone();f.local_width=width;f.x=base.x+cos*slide;f.z=base.z+sin*slide;edit::rotate_item(&mut f,base.rotation);
                if f.x-f.w/2.<room.x+0.25||f.z-f.d/2.<room.z+0.25||f.x+f.w/2.>room.x+room.w-0.25||f.z+f.d/2.>room.z+room.d-0.25||glass_behind(&f,ws){continue}
                let others:Vec<staging::Furniture>=fs.iter().filter(|o|o.id!=base.id).cloned().collect();if edit::item_error(&f,c,ws,&others).is_some(){continue}
                fs[i]=f;break 'wide;
            }}
        }
    }
    let Some(kind)=wide_seating(c)else{return notes};
    let sofas:Vec<String>=fs.iter().filter(|f|f.kind=="sofa"&&f.id.ends_with("-sofa")).map(|f|f.id.clone()).collect();
    for id in sofas{
        let Some(i)=fs.iter().position(|f|f.id==id)else{continue};let sofa=fs[i].clone();let Some(room)=rs.iter().find(|r|r.id==sofa.room_id)else{continue};
        let coffee=fs.iter().find(|f|f.kind=="coffee"&&f.room_id==sofa.room_id).map(|f|f.id.clone());
        let widths:&[f64]=match kind{"u"=>&[12.,11.,10.,9.5],"l"=>&[10.,9.,8.,7.5],_=>&[11.,10.,9.5]};
        // Lamps, plants, side tables and spare lounge chairs make way for the bigger seating group.
        let movable=|o:&staging::Furniture|o.room_id==sofa.room_id&&["armchair","floorlamp","plant","tall-plant","side-table","floor-vase","bookcase"].contains(&o.kind.as_str());
        let (sin,cos)=(sofa.rotation.sin(),sofa.rotation.cos());
        let mut placed=false;
        'size:for (width,depth) in widths.iter().flat_map(|&w|[(w,if kind=="l"{6.5}else{7.}),(w,6.)]){
            // Forward from the sofa's back line, then slide along the wall if the centred spot is blocked.
            let forward=(depth-sofa.local_depth)/2.;
            for slide in [0.,-1.,1.,-2.,2.]{
                let mut f=sofa.clone();f.kind="sectional".into();f.local_width=width;f.local_depth=depth;
                f.x=sofa.x-sin*forward+cos*slide;f.z=sofa.z+cos*forward+sin*slide;edit::rotate_item(&mut f,sofa.rotation);
                if f.x-f.w/2.<room.x+0.25||f.z-f.d/2.<room.z+0.25||f.x+f.w/2.>room.x+room.w-0.25||f.z+f.d/2.>room.z+room.d-0.25{continue}
                let others:Vec<staging::Furniture>=fs.iter().filter(|o|o.id!=sofa.id&&Some(&o.id)!=coffee.as_ref()&&!movable(o)).cloned().collect();
                if edit::item_error(&f,c,ws,&others).is_some(){continue}
                // The coffee table must sit inside the seating, not under a return.
                if let Some(table)=fs.iter().find(|o|Some(&o.id)==coffee.as_ref()){
                    let lx=(table.x-f.x)*cos+(table.z-f.z)*sin;let inner=match kind{"l"=>(-width/2.+0.4,width/2.-2.6),_=>(-width/2.+2.6,width/2.-2.6)};
                    if lx-table.local_width/2.<inner.0+0.6||lx+table.local_width/2.>inner.1-0.6{continue}
                }
                placed=true;let pad=[f.x-f.w/2.-0.3,f.z-f.d/2.-0.3,f.x+f.w/2.+0.3,f.z+f.d/2.+0.3];fs[i]=f;fs.retain(|o|!(movable(o)&&o.x-o.w/2.<pad[2]&&o.x+o.w/2.>pad[0]&&o.z-o.d/2.<pad[3]&&o.z+o.d/2.>pad[1]));break 'size;
            }
        }
        if !placed{notes.push(format!("The {} has no room for a {} with clear walkways and doorways, so a sofa is staged.",room.name.to_lowercase(),get(c,"livingSeating").to_lowercase()));}
    }
    notes
}

/// A window in the wall behind the piece, between 2½ and 7 ft (where a TV, mantel or shelves would go).
pub fn glass_behind(f:&staging::Furniture,ws:&[Wall])->bool{
    let(sin,cos)=(f.rotation.sin(),f.rotation.cos());let(bx,bz)=(f.x+sin*f.local_depth/2.,f.z-cos*f.local_depth/2.);let along_x=sin.abs()<0.5;
    ws.iter().filter(|w|(w.axis=="x")==along_x).any(|w|{let(line,start,at)=if along_x{(w.z,w.x,bx)}else{(w.x,w.z,bz)};let gap=if along_x{(bz-line).abs()}else{(bx-line).abs()};
        gap<1.6&&at>=start-1.&&at<=start+w.length+1.&&w.openings.iter().any(|o|o.kind=="window"&&o.bottom<7.&&o.bottom+o.height>2.5&&start+o.at<at+f.local_width/2.-0.3&&start+o.at+o.width>at-f.local_width/2.+0.3)})
}

/// Resolved design for the 3D view, plus the priced upgrades over the standard kitchen.
pub fn apply(c:&Config,m:&mut Value,t:&mut model::Takeoff){
    let mut data=json!({});for(key,value)in resolved(c){data[key]=json!(value);}
    if let Some(kind)=wide_seating(c){data["seatingKind"]=json!(kind);}
    m["interiorDesign"]=data.clone();
    if let Some(levels)=m["levels"].as_array_mut(){for level in levels{level["interiorDesign"]=data.clone();}}
    let all=m.get("allFurniture").and_then(Value::as_array).or_else(||m["furniture"].as_array()).cloned().unwrap_or_default();
    let count=|kind:&str|all.iter().filter(|f|s(f,"kind")==kind).count()as f64;
    let(kitchens,islands,fridges)=(count("kitchen"),count("island"),count("fridge").max(count("kitchen")));
    // Fireplaces and built-ins are priced only where the media wall is solid (the 3D view keeps the console otherwise).
    let levels:Vec<&Value>=match m["levels"].as_array(){Some(list)=>list.iter().collect(),None=>vec![&*m]};
    let consoles:f64=levels.iter().map(|level|{let ws:Vec<Wall>=serde_json::from_value(level["walls"].clone()).unwrap_or_default();let fs:Vec<staging::Furniture>=serde_json::from_value(level["furniture"].clone()).unwrap_or_default();fs.iter().filter(|f|f.kind=="console"&&!glass_behind(f,&ws)).count()as f64}).sum();
    let run_lf:f64=all.iter().filter(|f|s(f,"kind")=="kitchen").map(|f|n(f,"localWidth")).sum();
    if kitchens>0.{
        match get(c,"kitchenRange"){"36 in pro range"=>t.add("kitchen-range-upgrade","Kitchen & bath","Range upgrade · 36 in professional range, six burners",kitchens,"units",3200.,"Upgrade over the standard 30 in slide-in in the appliance package; gas or induction to be selected.","Allowance",false,true),
            "48 in pro range"=>t.add("kitchen-range-upgrade","Kitchen & bath","Range upgrade · 48 in dual-fuel professional range with griddle",kitchens,"units",7400.,"Upgrade over the standard 30 in slide-in; 48 in base module and dedicated circuit and gas line required.","Allowance",false,true),_=>{}}
        match get(c,"kitchenHood"){"Plaster hood"=>t.add("kitchen-hood-surround","Kitchen & bath","Custom plaster range hood surround over insert",kitchens,"units",1900.,"Framed, plastered hood shell around the included hood insert; finish and venting route pending.","Allowance",false,true),
            "Wood mantel hood"=>t.add("kitchen-hood-surround","Kitchen & bath","Wood mantel range hood surround over insert",kitchens,"units",1600.,"Furniture-grade wood surround with mantel shelf around the included hood insert.","Allowance",false,true),_=>{}}
        match get(c,"kitchenUppers"){"Glass-front uppers"=>t.add("kitchen-glass-uppers","Kitchen & bath","Glass-front upper doors with interior lighting",run_lf,"linear ft",95.,"Upgrade over solid upper doors along modeled cabinet runs.","Allowance",false,false),
            "Open shelving"=>t.add("kitchen-open-shelves","Kitchen & bath","Floating oak shelves with hidden brackets",run_lf*2.,"linear ft",42.,"Two shelves along modeled cabinet runs in place of upper cabinets; blocking required.","Allowance",true,false),_=>{}}
    }
    if fridges>0.&&get(c,"kitchenFridge")=="Panel-ready built-in"{t.add("kitchen-fridge-builtin","Kitchen & bath","Built-in refrigerator upgrade · panel-ready with matching cabinet panels",fridges,"units",6500.,"Upgrade over the standard French-door refrigerator; built-in opening and panels pending.","Allowance",false,true);}
    if islands>0.{
        let(name,price,per)=match get(c,"kitchenPendants"){"Glass globe"=>("Glass globe pendants",240.,3.),"Lantern"=>("Lantern pendants",290.,3.),"Linear chandelier"=>("Linear island chandelier",780.,1.),_=>("Dome pendants",180.,3.)};
        t.add("kitchen-pendants","Kitchen & bath",&format!("Island lighting · {}",name.to_lowercase()),islands*per,"fixtures",price,"Over each modeled island; junction boxes, dimmer and fixture heights pending.","Allowance",false,true);
        if get(c,"kitchenIsland")=="Seating island & stools"{t.add("furniture-counter-stools","Furniture","Counter stools",islands*3.,"pieces",210.,"Three stools at each modeled seating island.","Allowance",false,true);}
    }
    if consoles>0.{
        match get(c,"livingMedia"){"Fireplace & TV"|"Fireplace & art"=>t.add("living-fireplace","Interior","Linear electric fireplace with finished surround and mantel",consoles,"units",3400.,"One per modeled media wall; dedicated circuit and wall framing pending.","Allowance",false,true),
            "Built-in shelves & TV"=>t.add("living-builtins","Interior","Built-in media cabinetry with open shelves",consoles,"units",4200.,"Painted built-ins flanking the TV on each modeled media wall.","Allowance",false,true),_=>{}}
    }
}

