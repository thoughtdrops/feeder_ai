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
    // A floor plan sets the exact size, stories and rooms; the engine builds those rooms as read.
    let mut planned=next.clone();
    if traced(&read["floorPlan"],&mut planned,&mut notes){
        match validate(&planned){
            Ok(())=>{notes.insert(0,format!("{} · {} {} · {} bedroom{} · {:.0} × {:.0} ft, traced from your floor plan.",style,planned.stories,if planned.stories==1{"story"}else{"stories"},planned.bedrooms,if planned.bedrooms==1{""}else{"s"},planned.width,planned.depth));return Ok((planned,notes))}
            Err(e)=>notes.push(format!("The floor plan could not be used as drawn ({}), so the rooms follow the style's plan.",e)),
        }
    }
    // Without a plan, a listing's living area sets the footprint (per floor), keeping the photos' proportions.
    if let Some(area)=read["livingAreaSqft"].as_f64().filter(|a|a.is_finite()&&(300.0..=20000.0).contains(a)){
        let per=area/next.stories as f64;let aspect=(next.width/next.depth).clamp(0.4,2.5);
        let w=grid((per*aspect).sqrt()).clamp(16.,100.);let d=grid(per/w).clamp(16.,100.);
        next.width=if next.stories>=2{w.max(24.)}else{w};next.depth=d;notes.push(format!("Sized to the listing's {:.0} sq ft of living space.",area));
    }
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

/// Room types a plan reading may use, mapped to engine room kinds and a default name.
fn room_kind(t:&str)->Option<(&'static str,&'static str)>{Some(match t{
 "living"=>("living","Living room"),"family"=>("living","Family room"),"kitchen"=>("kitchen","Kitchen"),"dining"=>("dining","Dining room"),
 "bedroom"=>("bedroom","Bedroom"),"bath"=>("bath","Bathroom"),"powder"=>("bath","Powder room"),"hall"=>("hall","Hall"),"foyer"=>("foyer","Foyer"),
 "stairs"=>("stairs","Stair"),"laundry"=>("flex","Laundry room"),"closet"=>("flex","Closet"),"pantry"=>("flex","Pantry"),"office"=>("flex","Office"),
 "den"=>("flex","Den"),"mudroom"=>("flex","Mudroom"),"utility"=>("flex","Utility room"),"bonus"=>("flex","Bonus room"),"other"=>("flex","Room"),
 _=>return None})}
/// Room types that are outside the heated house: they set features instead of rooms.
const OUTSIDE:[&str;5]=["garage","porch","deck","patio","balcony"];

/// A floor-plan reading made into the design's traced plan: exact width and depth (2-ft grid), stories,
/// bedroom count, the stair in the same place on every floor, and rear wings for L, T and U plans.
fn traced(plan:&Value,c:&mut Config,notes:&mut Vec<String>)->bool{
 let Some(floors)=plan["floors"].as_array()else{return false};
 let raw_floors:Vec<Vec<traced::Raw>>=floors.iter().take(3).map(|f|f["rooms"].as_array().map(|rs|rs.iter().filter_map(|r|{
  let t=r["type"].as_str()?;if OUTSIDE.contains(&t){return None}let(kind,default)=room_kind(t)?;
  let[x,z,w,d]=["x","z","w","d"].map(|k|r[k].as_f64().unwrap_or(f64::NAN));if ![x,z,w,d].iter().all(|v|v.is_finite())||w<=0.||d<=0.{return None}
  let name:String=r["name"].as_str().map(|n|n.chars().filter(|ch|!ch.is_control()).take(40).collect::<String>()).filter(|n|!n.trim().is_empty()).unwrap_or(default.into());
  Some(traced::Raw{name:name.trim().into(),kind:kind.into(),x,z,w,d})}).collect()).unwrap_or_default()).filter(|f:&Vec<traced::Raw>|!f.is_empty()).collect();
 if raw_floors.iter().map(Vec::len).sum::<usize>()<2{return false}
 // The main block: the plan's stated size, else the rooms' extent on the first floor.
 let extent=|f:&[traced::Raw],axis:bool|f.iter().map(|r|if axis{r.x+r.w}else{r.z+r.d}).fold(0.,f64::max);
 let size=|key:&str,fallback:f64|plan[key].as_f64().filter(|v|v.is_finite()&&*v>=8.).unwrap_or(fallback);
 let stories=raw_floors.len().clamp(1,3);
 let mut w=grid(size("mainWidthFt",extent(&raw_floors[0],true))).clamp(16.,100.);let d=grid(size("mainDepthFt",extent(&raw_floors[0],false))).clamp(16.,100.);
 if stories>=2&&w<24.{notes.push("Two-story homes here start at 24 ft wide, so the plan is widened to 24 ft.".into());w=24.;}
 // Rooms past the rear wall form wings on the first floor; everything else stays inside the main block.
 let mut wing_rooms=vec![];let mut floors_raw=vec![];
 for(i,f)in raw_floors.into_iter().enumerate(){let mut keep=vec![];for r in f{if i==0&&r.z+r.d/2.>d+1.&&r.kind!="stairs"{wing_rooms.push(r);continue}
  let x0=r.x.clamp(0.,w);let z0=r.z.clamp(0.,d);let x1=(r.x+r.w).clamp(0.,w);let z1=(r.z+r.d).clamp(0.,d);if x1-x0>=1.&&z1-z0>=1.{keep.push(traced::Raw{x:x0,z:z0,w:x1-x0,d:z1-z0,..r});}}floors_raw.push(keep);}
 // One stair, 8 × 16 ft, in the same place on every floor of a multi-story home.
 let stair=floors_raw.iter().flatten().find(|r|r.kind=="stairs").map(|r|(r.x+r.w/2.,r.z+r.d/2.));
 let fixed=if stories>=2&&w>=8.&&d>=16.{let(cx,cz)=stair.unwrap_or((w/2.,d/2.));vec![traced::Raw{name:"Stair".into(),kind:"stairs".into(),x:grid(cx-4.).clamp(0.,w-8.),z:grid(cz-8.).clamp(0.,d-16.),w:8.,d:16.}]}else{vec![]};
 let floors_tiled:Vec<Vec<Room>>=floors_raw.iter().map(|f|{let rooms:Vec<traced::Raw>=f.iter().filter(|r|r.kind!="stairs"||fixed.is_empty()).map(|r|if r.kind=="stairs"{traced::Raw{kind:"flex".into(),..r.clone()}}else{r.clone()}).collect();traced::tile(&rooms,&fixed,w,d)}).collect();
 // Wings: one centered (T), one at a side (L) or one at each side (U), sized from the plan.
 let mut wings_out=vec![];
 if !wing_rooms.is_empty(){
  let span=|rs:&[&traced::Raw]|(rs.iter().map(|r|r.x).fold(f64::MAX,f64::min),rs.iter().map(|r|r.x+r.w).fold(f64::MIN,f64::max),rs.iter().map(|r|r.z+r.d).fold(d,f64::max));
  let left:Vec<&traced::Raw>=wing_rooms.iter().filter(|r|r.x+r.w/2.<w/2.).collect();let right:Vec<&traced::Raw>=wing_rooms.iter().filter(|r|r.x+r.w/2.>=w/2.).collect();
  let all:Vec<&traced::Raw>=wing_rooms.iter().collect();let(ax0,ax1,_)=span(&all);
  let groups:Vec<Vec<&traced::Raw>>=if !left.is_empty()&&!right.is_empty()&&span(&left).1<w/2.+2.&&span(&right).0>w/2.-2.{c.shape="U-shape".into();vec![left,right]}
   else if ((ax0+ax1)/2.-w/2.).abs()<w*0.2{c.shape="T-shape".into();vec![all]}
   else{c.shape="L-shape".into();let on_right=(ax0+ax1)/2.>w/2.;if on_right!=(c.garage_side=="Left"){if c.garage=="None"||c.garage_side=="Automatic"{c.garage_side=if on_right{"Left"}else{"Right"}.into();}else{notes.push("The wing is on the other side from the plan, so it clears the garage.".into());}}vec![all]};
  let(gx0,gx1,gz1)=span(&groups[0]);c.wing_width=grid(gx1-gx0).clamp(8.,40.);c.wing_depth=grid(gz1-d).clamp(8.,40.);
  let mut sized=c.clone();sized.width=w;sized.depth=d;
  for(g,group)in wings::rects(&sized).iter().zip(&groups){let(x0,x1,z1)=span(group);let(sx,sz)=(g.w/(x1-x0).max(1.),g.d/(z1-d).max(1.));
   let local:Vec<traced::Raw>=group.iter().map(|r|traced::Raw{x:(r.x-x0)*sx,z:(r.z-d).max(0.)*sz,w:r.w*sx,d:r.d*sz,..(*r).clone()}).collect();
   wings_out.push(traced::TracedWing{w:g.w,d:g.d,rooms:traced::tile(&local,&[],g.w,g.d)});}
  if wings_out.is_empty(){c.shape="Rectangle".into();notes.push("Rooms behind the house were too small for a wing and were left out.".into());}
 }else{c.shape="Rectangle".into();}
 let bedrooms=floors_tiled.iter().flatten().chain(wings_out.iter().flat_map(|g|g.rooms.iter())).filter(|r|r.kind=="bedroom").count();
 let rooms=floors_tiled.iter().map(Vec::len).sum::<usize>()+wings_out.iter().map(|g|g.rooms.len()).sum::<usize>();
 c.width=w;c.depth=d;c.stories=stories;c.active_floor=0;c.bedrooms=bedrooms.min(6);c.catalog_plan=false;c.design_mode="Custom".into();
 c.traced_plan=Some(traced::TracedPlan{width:w,depth:d,floors:floors_tiled,wings:wings_out});
 notes.push(format!("{} rooms traced to the nearest 2 ft; their walls, doors and furniture follow the plan.",rooms));
 true
}
