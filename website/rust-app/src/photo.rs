// Used by the studio (WebAssembly) and the tests only.
#![cfg_attr(not(any(target_arch="wasm32",test)),allow(dead_code))]
use crate::*;
// Photos to a home. Claude reads a set of photos (exterior, interior, generated renders) into the
// studio's own choices; this turns that read into a complete design the engine can build. Every value
// is checked against the same option lists as the menus, sizes snap to the 2-ft grid, and a room
// program that does not fit grows the footprint (then trims bedrooms) instead of failing.

/// Choice fields a photo read may set directly, as (config field, options).
fn choice_fields()->Vec<(&'static str,Vec<&'static str>)>{
    let mut v:Vec<(&'static str,Vec<&'static str>)>=vec![
        ("shape",wings::SHAPES.to_vec()),
        ("roofing",roofing::CHOICES.to_vec()),
        ("ceiling",vec!["Flat ceiling","Cathedral"]),
        ("dormerStyle",vec!["None","Style matched","Gable","Shed","Hip","Arched","Eyebrow"]),
        ("frontPorch",porch::FORMS.to_vec()),
        ("columnStyle",additions::character::COLUMNS.to_vec()),
        ("railingStyle",additions::character::RAILINGS.to_vec()),
        ("rearOutdoor",vec!["Style matched","None","Deck","Covered porch"]),
        ("balcony",vec!["Style matched","None","Rear balcony"]),
        ("garage",vec!["None","Attached","Detached"]),
        ("garageSize",vec!["Two-car","Three-car"]),
        ("garageSide",vec!["Automatic","Left","Right"]),
        ("windowStyle",vec!["Style matched","Double hung","Casement","Picture"]),
        ("windowSize",vec!["Style matched","Medium","Large"]),
        ("windowGrilles",additions::character::GRILLES.to_vec()),
        ("shutters",additions::character::SHUTTERS.to_vec()),
        ("entryDoor",additions::character::DOORS.to_vec()),
        ("entrySurround",additions::character::SURROUNDS.to_vec()),
        ("eaveOverhang",additions::character::OVERHANGS.to_vec()),
        ("roofEdgeStyle",vec!["Style matched","Plain fascia","Crown fascia","Stepped cornice","Ogee cornice","Dentil cornice","Modillion cornice","Scrolled corbels","Craftsman brackets","Exposed beam ends","Boxed eave & frieze","Victorian fretwork"]),
        ("gableAccent",vec!["Style matched","None","Shingle panel","Board and batten","Tudor timber"]),
        ("finials",vec!["Style matched","None","Turned finials","Roof spire"]),
    ];
    let c=Config::default();
    for(key,_,options,_)in interior_design::fields(&c){v.push((key,options.to_vec()));}
    v
}
fn listed(key:&str)->Vec<String>{catalog()["options"][key].as_array().map(|a|a.iter().filter_map(|v|v.as_str().map(str::to_string)).collect()).unwrap_or_default()}
fn schemes()->Vec<String>{catalog()["interiorSchemes"].as_array().unwrap().iter().map(|v|s(v,"name").to_string()).collect()}

/// Every option list a photo read can use, keyed by field. The photo API builds its answer schema
/// from this (website/api/_lib/photo-options.json, kept in step by a test).
pub fn options()->Value{
    let mut o=serde_json::Map::new();
    o.insert("homeStyle".into(),json!(listed("homeStyle")));
    o.insert("interiorStyle".into(),json!(schemes()));
    for key in ["siding","floor","trimPackage"]{o.insert(key.into(),json!(listed(key)));}
    o.insert("wallpaper".into(),json!(listed("wallpaper")));
    o.insert("bedroomWallpaper".into(),json!(listed("wallpaper")));
    for(key,options)in choice_fields(){o.insert(key.into(),json!(options));}
    Value::Object(o)
}

fn text<'a>(read:&'a Value,key:&str)->Option<&'a str>{read[key].as_str().map(str::trim).filter(|v|!v.is_empty())}
fn color(read:&Value,key:&str)->Option<String>{let v=text(read,key)?.to_ascii_lowercase();(v.len()==7&&v.starts_with('#')&&v[1..].chars().all(|c|c.is_ascii_hexdigit())).then_some(v)}
fn count(read:&Value,key:&str)->Option<usize>{let v=read[key].as_f64()?;(v.is_finite()&&v>=0.).then(||v.round() as usize)}
fn feet(read:&Value,key:&str)->Option<f64>{let v=read[key].as_f64()?;(v.is_finite()&&v>0.).then(||grid(v).clamp(16.,100.))}

/// The design for a photo read, built on the visitor's current project (location, prices and costs
/// stay), plus plain-language notes on what was matched and what had to be adjusted.
pub fn design(current:&Config,read:&Value)->Result<(Config,Vec<String>),String>{
    if !read.is_object(){return Err("The photo reading came back empty. Try again with clearer photos.".into())}
    let mut notes=vec![];
    let mut c=current.clone();
    c.design_mode="Custom".into();c.catalog_plan=true;c.active_floor=0;c.trim_overrides.clear();
    architecture::reset_edits(&mut c);additions::character::match_style(&mut c);interior_design::match_style(&mut c);
    // The style sets the plan, roof form, cladding, trim and colors; the photo's own details go on top.
    let styles=listed("homeStyle");
    let style=text(read,"homeStyle").filter(|v|styles.iter().any(|s|s==v)).unwrap_or(&current.home_style).to_string();
    c.home_style=style.clone();
    let home=lookup("homeStyles",&style);c.siding=s(&home,"cladding").into();c.trim_package=s(&home,"trim").into();c.cladding_variant.clear();
    for(key,src)in[("siding","siding"),("roof","roof"),("trim","exteriorTrim")]{c.colors.insert(key.into(),s(&home,src).into());}
    finishes::architecture_defaults(&mut c);
    c.stories=count(read,"stories").filter(|n|(1..=3).contains(n)).unwrap_or(heritage::default_stories(&style));
    c.bedrooms=count(read,"bedrooms").map(|n|n.min(6)).unwrap_or(heritage::default_bedrooms(&style));
    if c.stories>=2{c.bedrooms=c.bedrooms.max(1);}
    architecture::apply(&mut c,true);
    let low=architecture::preset(&style).3=="Low slope";
    if let Some(p)=read["roofPitch"].as_f64().filter(|p|p.is_finite()){c.pitch=if low&&p<1.{0.25}else{p.round().clamp(if low{1.}else{2.},12.)};}
    if let Some(w)=feet(read,"widthFt"){c.width=w;}
    if let Some(d)=feet(read,"depthFt"){c.depth=d;}
    if c.stories>=2{c.width=c.width.max(24.);c.depth=c.depth.max(architecture::minimum_depth(&c));}
    // Menu choices: a value outside the list is skipped and the style-matched default stays.
    let mut v=serde_json::to_value(&c).map_err(|e|e.to_string())?;
    for(key,options)in choice_fields(){if let Some(x)=text(read,key){if options.contains(&x){v[key]=json!(x);}}}
    for key in ["trimPackage","floor","wallpaper","bedroomWallpaper"]{if let Some(x)=text(read,key){if listed(if key=="bedroomWallpaper"{"wallpaper"}else{key}).iter().any(|o|o==x){v[key]=json!(x);}}}
    let siding=text(read,"siding").filter(|x|listed("siding").iter().any(|o|o==x)).map(str::to_string);
    if let Some(x)=&siding{v["siding"]=json!(x);v["claddingVariant"]=json!("");}
    let mut next:Config=serde_json::from_value(v).map_err(|e|e.to_string())?;
    if let Some(name)=text(read,"interiorStyle").filter(|x|schemes().iter().any(|o|o==x)){
        // The scheme sets floor and wall colors; a floor read from the photos still wins.
        let floor=next.floor.clone();let explicit=text(read,"floor").is_some_and(|x|x==floor);
        generator::scheme(&mut next,name);if explicit{next.floor=floor;}
    }
    for(read_key,key)in[("sidingColor","siding"),("roofColor","roof"),("trimColor","trim")]{if let Some(x)=color(read,read_key){next.colors.insert(key.into(),x);}}
    if let Some(n)=count(read,"dormerCount"){next.dormer_count=n.clamp(1,6);}
    // Keep the read consistent with what the engine can build.
    if next.roofing!="Style matched"&&next.pitch+1e-9<roofing::min_pitch(roofing::kind(&next)){notes.push(format!("{} needs a steeper roof, so the style's own roofing is used.",next.roofing));next.roofing="Style matched".into();}
    if next.ceiling=="Cathedral"&&!roof::cathedral_ok(&next){next.ceiling="Flat ceiling".into();}
    if next.stories<2&&next.balcony=="Rear balcony"{next.balcony="None".into();}
    next.layout=heritage::plan_name(&style);
    // The room program has to fit: grow the depth, then the width, then trim bedrooms.
    let(w0,d0,b0)=(next.width,next.depth,next.bedrooms);
    let mut fitted=None;let mut last=String::new();
    'outer:for bedrooms in (b0.min(6).saturating_sub(3)..=b0).rev(){
        if next.stories>=2&&bedrooms==0{continue}
        for grow in [0.,4.,8.,12.,16.,24.]{
            let mut t=next.clone();t.bedrooms=bedrooms;t.width=(w0+grow/2.).min(100.);t.depth=(d0+grow).min(100.);
            if t.stories>=2{t.depth=t.depth.max(architecture::minimum_depth(&t)).min(100.);}
            t.width=grid(t.width);t.depth=grid(t.depth);
            match validate(&t){Err(e)=>{last=e;continue}Ok(())=>{}}
            if generator::practical(&t,&model::build(&t)){fitted=Some(t);break 'outer}
            last="The room program did not fit.".into();
        }
    }
    let Some(done)=fitted else{return Err(format!("These photos read as a home the studio could not fit ({}). Try photos that show the whole house, or fewer bedrooms.",last))};
    if done.bedrooms<b0{notes.push(format!("{} bedrooms fit this footprint, so the plan has {} instead of {}.",done.bedrooms,done.bedrooms,b0));}
    if !near(done.width,w0)||!near(done.depth,d0){notes.push(format!("The footprint is {:.0} × {:.0} ft so every room keeps working space (the photos suggested about {:.0} × {:.0} ft).",done.width,done.depth,w0,d0));}
    notes.insert(0,format!("{} · {} {} · {} bedroom{} · {:.0} × {:.0} ft.",style,done.stories,if done.stories==1{"story"}else{"stories"},done.bedrooms,if done.bedrooms==1{""}else{"s"},done.width,done.depth));
    Ok((done,notes))
}
