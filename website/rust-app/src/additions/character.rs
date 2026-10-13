use crate::*;

// Facade character: porch columns, guard railings, shutters, window grilles, the entry door and its
// surround, and the roof overhang depth. "Style matched" resolves from the home style, so every style
// arrives with a coherent set; each choice is drawn in 3D and priced once here.
pub const COLUMNS:[&str;8]=["Style matched","Square post","Tapered Craftsman","Classical round","Fluted Doric","Turned Victorian","Stone pier & post","Timber post & brace"];
pub const RAILINGS:[&str;7]=["Style matched","Square spindles","Turned spindles","Chippendale","Horizontal boards","Cable","Glass panel"];
pub const SHUTTERS:[&str;5]=["Style matched","None","Louvered","Raised panel","Board and batten"];
pub const GRILLES:[&str;6]=["Style matched","None","Colonial","Prairie","Craftsman","Diamond"];
pub const DOORS:[&str;6]=["Style matched","Six-panel","Craftsman glass","Full-glass modern","Dutch door","Plank & strap"];
pub const SURROUNDS:[&str;6]=["Style matched","Simple casing","Pilasters & pediment","Craftsman header","Arched fanlight","Bracketed hood"];
pub const OVERHANGS:[&str;6]=["Style matched","Tight · 6 in","Standard · 12 in","Generous · 18 in","Deep · 24 in","Extra deep · 36 in"];

pub fn validate(c:&Config)->Result<(),String>{
    for(value,allowed,label)in[(&c.column_style,&COLUMNS[..],"column"),(&c.railing_style,&RAILINGS[..],"railing"),(&c.shutters,&SHUTTERS[..],"shutter"),(&c.window_grilles,&GRILLES[..],"window grille"),(&c.entry_door,&DOORS[..],"entry door"),(&c.entry_surround,&SURROUNDS[..],"entry surround"),(&c.eave_overhang,&OVERHANGS[..],"roof overhang")]{
        if !allowed.contains(&value.as_str()){return Err(format!("Choose a listed {} option.",label));}
    }
    Ok(())
}

/// Porch / covered-porch / balcony column key used by the 3D view and pricing.
pub fn column(c:&Config)->&'static str{
    match c.column_style.as_str(){
        "Square post"=>"square","Tapered Craftsman"=>"tapered","Classical round"=>"classical","Fluted Doric"=>"fluted","Turned Victorian"=>"turned","Stone pier & post"=>"stone","Timber post & brace"=>"timber",
        _=>match c.home_style.as_str(){"Victorian"=>"turned","Craftsman"=>"tapered","Georgian"=>"fluted","Colonial"|"French country"|"Coastal"|"Cape Cod"=>"classical","English cottage"|"Tudor"=>"timber","Ranch"=>"stone",_=>"square"},
    }
}
pub fn column_price(key:&str)->f64{match key{"tapered"=>320.,"classical"=>380.,"fluted"=>460.,"turned"=>260.,"stone"=>600.,"timber"=>340.,_=>180.}}
pub fn column_name(key:&str)->&'static str{match key{"tapered"=>"tapered Craftsman columns on paneled pedestals","classical"=>"classical round columns","fluted"=>"fluted Doric columns","turned"=>"turned Victorian posts","stone"=>"timber posts on stone piers","timber"=>"timber posts with curved braces",_=>"square posts"}}

pub fn railing(c:&Config)->&'static str{
    match c.railing_style.as_str(){
        "Square spindles"=>"square","Turned spindles"=>"turned","Chippendale"=>"chippendale","Horizontal boards"=>"boards","Cable"=>"cable","Glass panel"=>"glass",
        _=>match c.home_style.as_str(){"Victorian"|"English cottage"=>"turned","Georgian"|"Colonial"=>"chippendale","Contemporary"|"Industrial"=>"cable","Mid-century"|"Scandinavian"=>"boards",_=>"square"},
    }
}
fn railing_upgrade(key:&str)->(f64,&'static str){match key{"turned"=>(6.,"turned spindles"),"chippendale"=>(14.,"Chippendale lattice panels"),"boards"=>(5.,"horizontal board infill"),"cable"=>(22.,"stainless cable infill"),"glass"=>(55.,"tempered glass panels"),_=>(0.,"square spindles")}}

pub fn shutters(c:&Config)->&'static str{
    match c.shutters.as_str(){
        "None"=>"none","Louvered"=>"louvered","Raised panel"=>"panel","Board and batten"=>"batten",
        _=>match c.home_style.as_str(){"Colonial"|"Cape Cod"|"Victorian"|"French country"|"Coastal"=>"louvered","Georgian"=>"panel","Modern farmhouse"|"English cottage"=>"batten",_=>"none"},
    }
}
pub fn grilles(c:&Config)->&'static str{
    match c.window_grilles.as_str(){
        "None"=>"none","Colonial"=>"colonial","Prairie"=>"prairie","Craftsman"=>"craftsman","Diamond"=>"diamond",
        _=>match c.home_style.as_str(){"Colonial"|"Georgian"|"Cape Cod"|"French country"|"Victorian"=>"colonial","Craftsman"|"Modern farmhouse"=>"craftsman","Tudor"|"English cottage"=>"diamond","Ranch"=>"prairie",_=>"none"},
    }
}
pub fn door(c:&Config)->&'static str{
    match c.entry_door.as_str(){
        "Six-panel"=>"six-panel","Craftsman glass"=>"craftsman","Full-glass modern"=>"glass","Dutch door"=>"dutch","Plank & strap"=>"plank",
        _=>match c.home_style.as_str(){"Craftsman"|"Modern farmhouse"=>"craftsman","Contemporary"|"Mid-century"|"Industrial"|"Scandinavian"=>"glass","Coastal"=>"dutch","Tudor"|"English cottage"=>"plank",_=>"six-panel"},
    }
}
pub fn surround(c:&Config)->&'static str{
    match c.entry_surround.as_str(){
        "Simple casing"=>"casing","Pilasters & pediment"=>"pediment","Craftsman header"=>"craftsman","Arched fanlight"=>"fanlight","Bracketed hood"=>"hood",
        _=>match c.home_style.as_str(){"Georgian"|"Colonial"=>"pediment","Craftsman"=>"craftsman","French country"=>"fanlight","Victorian"|"Cape Cod"=>"hood",_=>"casing"},
    }
}
/// Eave depth chosen by the visitor, in feet (None keeps each style's historic overhang).
pub fn overhang(c:&Config)->Option<f64>{
    match c.eave_overhang.as_str(){"Tight · 6 in"=>Some(0.5),"Standard · 12 in"=>Some(1.),"Generous · 18 in"=>Some(1.5),"Deep · 24 in"=>Some(2.),"Extra deep · 36 in"=>Some(3.),_=>None}
}

/// A generated home arrives with the character of its own style.
pub fn match_style(c:&mut Config){for v in [&mut c.column_style,&mut c.railing_style,&mut c.shutters,&mut c.window_grilles,&mut c.entry_door,&mut c.entry_surround,&mut c.eave_overhang]{*v="Style matched".into();}}

pub fn data(c:&Config)->Value{
    json!({"column":column(c),"railing":railing(c),"shutters":shutters(c),"grilles":grilles(c),"door":door(c),"surround":surround(c)})
}

pub fn apply(c:&Config,m:&mut Value,t:&mut model::Takeoff){
    let data=data(c);m["character"]=data.clone();
    if let Some(levels)=m["levels"].as_array_mut(){for level in levels{level["character"]=data.clone();}}
    let walls=m.get("allWalls").and_then(Value::as_array).unwrap_or_else(||m["walls"].as_array().unwrap()).clone();
    // Shutters hang beside every exterior window wide enough to read as a pair (not narrow bath lites).
    let windows:Vec<&Value>=walls.iter().filter(|w|w["exterior"]==true).flat_map(|w|w["openings"].as_array().unwrap().iter()).filter(|o|s(o,"kind")=="window"&&!s(o,"id").starts_with("G-")).collect();
    let shuttered=windows.iter().filter(|o|n(o,"width")>=2.).count()as f64;
    let shutter=shutters(c);
    if shutter!="none"&&shuttered>0.{
        let(price,name)=match shutter{"panel"=>(190.,"raised-panel"),"batten"=>(150.,"board-and-batten"),_=>(160.,"louvered")};
        t.add("character-shutters","Architectural accents",&format!("Exterior {} shutters · composite, pair with hardware",name),shuttered,"pairs",price,"One sized pair beside each exterior window at least 2 ft wide; decorative, fixed with shutter dogs.","Modeled count",false,true);
    }
    let grille=grilles(c);
    if grille!="none"&&!windows.is_empty(){
        let(price,name)=match grille{"prairie"=>(55.,"prairie perimeter"),"craftsman"=>(40.,"Craftsman upper-sash"),"diamond"=>(85.,"diamond leaded"),_=>(45.,"colonial")};
        t.add("character-grilles","Openings",&format!("Simulated divided-lite grilles · {} pattern",name),windows.len()as f64,"windows",price,"Exterior-applied grille bars on every modeled exterior window; order with the windows.","Modeled count",false,true);
    }
    let entry=walls.iter().filter(|w|w["exterior"]==true).flat_map(|w|w["openings"].as_array().unwrap().iter()).filter(|o|s(o,"kind")=="door").count();
    if entry>0{
        let(door_price,door_name)=match door(c){"craftsman"=>(450.,"Craftsman glass-lite"),"glass"=>(600.,"full-glass modern"),"dutch"=>(700.,"Dutch split"),"plank"=>(500.,"plank-and-strap"),_=>(0.,"six-panel")};
        if door_price>0.{t.add("character-entrydoor","Openings",&format!("Front entry door upgrade · {} slab",door_name),1.,"door",door_price,"Upgrade over the standard insulated six-panel entry slab; hardware and glazing ratings to be selected.","Allowance",false,true);}
        let(surround_price,surround_name)=match surround(c){"pediment"=>(650.,"fluted pilasters with triangular pediment"),"craftsman"=>(380.,"Craftsman lintel header with brackets"),"fanlight"=>(520.,"arched fanlight with keystone"),"hood"=>(560.,"bracketed entry hood"),_=>(0.,"")};
        if surround_price>0.{t.add("character-surround","Architectural accents",&format!("Entry surround · {}",surround_name),1.,"set",surround_price,"Sealed exterior millwork around the front door; flashing and attachment detailing pending.","Allowance",false,true);}
    }
    // Guard railings: the upgrade over square spindles, priced on every modeled rail run.
    let(rate,name)=railing_upgrade(railing(c));
    let rail_lf:f64=["porch","rearOutdoor","balcony"].iter().flat_map(|k|m[*k]["rails"].as_array().cloned().unwrap_or_default()).map(|r|n(&r,"length")).sum();
    if rate>0.&&rail_lf>0.{t.add("character-railing","Architectural accents",&format!("Guard railing upgrade · {}",name),rail_lf,"linear ft",rate,"Upgrade over square-spindle infill along every modeled porch, deck and balcony guard. Guard height and load design pending.","Modeled rail length",true,false);}
}
