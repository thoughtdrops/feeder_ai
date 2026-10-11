use crate::*;

struct Random(u32);
impl Random {
    fn pick(&mut self, count: usize) -> usize {
        self.0 = self.0.wrapping_mul(1664525).wrapping_add(1013904223);
        // The high bits: an LCG's low bits cycle quickly (pick(2) would simply alternate).
        ((self.0 >> 16) as usize) % count
    }
}

fn scheme(c: &mut Config, name: &str) {
    c.interior_style = name.into();
    let interior = lookup("interiorSchemes", name);
    c.floor = s(&interior, "floor").into();
    c.drywall = s(&interior, "drywall").into();
    for (key, value) in interior["colors"].as_object().unwrap() {
        c.colors.insert(key.clone(), value.as_str().unwrap().into());
    }
}

// This screens a usable room/fixture program. It is not a structural analysis
// or a claim that a local authority has approved the generated dwelling.
pub fn practical(c: &Config, m: &Value) -> bool {
    let rooms = m["allRooms"].as_array().or_else(|| m["rooms"].as_array()).unwrap();
    let furniture = m["allFurniture"].as_array().or_else(|| m["furniture"].as_array()).unwrap();
    if n(&m["counts"], "bedrooms") < c.bedrooms as f64 || n(&m["counts"], "baths") < 1. {
        return false;
    }
    if m["openingChecks"]["allHeightGuardrailsPass"] != true { return false; }
    let in_room = |id: &str, kind: &str| furniture.iter().any(|f| s(f,"roomId") == id && s(f,"kind") == kind);
    let has_living = rooms.iter().any(|r| ["living","studio"].contains(&s(r,"type")) && n(r,"w") >= 8. && n(r,"d") >= 8. && n(r,"w")*n(r,"d") >= 120.);
    let has_kitchen = rooms.iter().any(|r| s(r,"type") == "kitchen" && in_room(s(r,"id"),"kitchen")) || furniture.iter().any(|f| s(f,"kind") == "kitchen");
    has_living && has_kitchen && rooms.iter().all(|r| {
        let id = s(r,"id");
        match s(r,"type") {
            "bedroom" => n(r,"w") >= 8. && n(r,"d") >= 8. && n(r,"w")*n(r,"d") >= 80. && in_room(id,"bed"),
            "bath" => in_room(id,"toilet") && in_room(id,"vanity") && (s(r,"name").contains("Powder") || in_room(id,"shower")),
            "living" | "dining" => n(r,"w") >= 8. && n(r,"d") >= 8.,
            _ => true
        }
    })
}

/// Affordable / Premium / Blank slate. A candidate that cannot hold the room program is retried with
/// another draw, then with a slightly larger footprint, so the buttons give a home instead of an error.
pub fn generate(current: &Config, mode: &str, seed: u32, keep_size: bool) -> Result<Config,String> {
    let mut last = Err("No design fit.".to_string());
    for grow in [0., 4., 8.] {
        if grow > 0. && (keep_size || mode != "Affordable") { break }
        for attempt in 0..12u32 {
            last = generate_once(current, mode, seed.wrapping_add(attempt.wrapping_mul(7919)), keep_size, grow);
            if last.is_ok() || mode == "Blank slate" || last.as_ref().is_err_and(|e| !e.starts_with("These dimensions")) { return last }
        }
    }
    last
}
fn generate_once(current: &Config, mode: &str, seed: u32, keep_size: bool, grow: f64) -> Result<Config,String> {
    let mut c = current.clone();
    c.design_mode = mode.into();
    c.active_floor = 0;
    c.catalog_plan = true; c.trim_overrides.clear();
    c.seed = seed;
    architecture::reset_edits(&mut c);
    let mut random = Random(seed);
    if mode == "Blank slate" { validate(&c)?; return Ok(c); }
    if !["Affordable","Premium"].contains(&mode) { return Err("Choose Affordable or Premium.".into()); }
    if mode == "Affordable" {
        if !keep_size {
            let dimensions: &[(f64,f64)] = if c.stories >= 2 {
                match c.bedrooms {
                    0..=3 => &[(24.,32.),(24.,36.),(28.,36.)],
                    4 => &[(24.,40.),(28.,40.),(32.,40.)],
                    _ => &[(32.,48.),(36.,48.),(40.,48.)]
                }
            } else {
                match c.bedrooms {
                    0..=1 => &[(24.,32.),(24.,36.),(28.,32.)],
                    2 => &[(24.,32.),(24.,36.),(28.,32.)],
                    3 => &[(28.,36.),(28.,40.),(32.,36.)],
                    4 => &[(32.,44.),(36.,44.),(36.,48.)],
                    5 => &[(36.,48.),(40.,48.),(40.,52.)],
                    _ => &[(40.,52.),(44.,52.),(48.,56.)]
                }
            };
            let (w,d) = dimensions[random.pick(dimensions.len())]; c.width = w + grow; c.depth = d + grow;
        }
        // Budget-friendly styles with simple roofs and economical cladding; never the same style twice in a row.
        let pool: &[&str] = if c.stories >= 2 {&["Colonial","Modern farmhouse","Scandinavian","Contemporary","Coastal"]} else {&["Ranch","Craftsman","Mid-century","Contemporary","Industrial","Modern farmhouse"]};
        let choices: Vec<&str> = pool.iter().copied().filter(|p| *p != current.home_style).collect();
        c.home_style = choices[random.pick(choices.len())].into();
        c.pitch = architecture::preset(&c.home_style).2; c.wall_height = 8.09375; c.stud_type = "Sawn lumber".into();
        c.trim_package = "Minimal shadow line".into(); c.trim_size = "Normal".into();
        c.wallpaper = "None".into(); c.bedroom_wallpaper = "None".into();
        c.siding = s(&lookup("homeStyles",&c.home_style),"cladding").into();
        scheme(&mut c, ["Modern · Stone & oak","Natural · Linen house","Modern · Clay & linen","Modern · Olive daylight"][random.pick(4)]);
        c.floor = "Natural oak".into(); c.drywall = "Smooth finish".into();
        let palettes = [("#72817b","#343b3d","#d3cbbc"),("#555f68","#293138","#d5c9b5"),("#8d9c92","#3b4440","#dad4c4")];
        let (siding,roof,trim) = palettes[random.pick(palettes.len())];
        for (key,value) in [("siding",siding),("roof",roof),("trim",trim)] { c.colors.insert(key.into(),value.into()); }
    } else {
        c.home_style = ["Victorian","Georgian","French country","Tudor","Craftsman"][random.pick(5)].into();
        architecture::apply(&mut c,!keep_size);
        let home = lookup("homeStyles",&c.home_style);
        c.siding = s(&home,"cladding").into();
        for (key,source) in [("siding","siding"),("roof","roof"),("trim","exteriorTrim")] { c.colors.insert(key.into(),s(&home,source).into()); }
        c.wall_height = [9.,10.][random.pick(2)];
        c.trim_package = ["Georgian grand","Victorian ornate","French panelled"][random.pick(3)].into();
        c.trim_size = "Oversized".into();
        scheme(&mut c,["Refined · Champagne suite","Refined · Emerald accents","Classic · Pearl & brass","Refined · Chocolate & cream"][random.pick(4)]);
        let wallpapers = ["Peacock chinoiserie","Plum baroque","Blue medallion","Marble filigree","Teal lattice"];
        c.bedroom_wallpaper = wallpapers[random.pick(wallpapers.len())].into();
        c.wallpaper = wallpapers[random.pick(wallpapers.len())].into();
    }
    validate(&c)?;
    c.layout=heritage::plan_name(&c.home_style);
    if practical(&c,&model::build(&c)){Ok(c)}else{Err("These dimensions do not fit the selected source-based room program and fixtures. Increase the footprint or reduce bedrooms, or use Blank slate to create your own layout.".into())}
}

/// "Generate another home": a complete, visibly different design on every click — style, size,
/// stories, bedrooms, roof covering, dormers, garage, ceiling, exterior palette and interior.
/// Candidates are screened with the same validation and room-program checks as hand edits, and the
/// first one that passes is returned, so the button never just shows an error.
pub fn surprise(current:&Config, seed:u32, keep_size:bool) -> Result<Config,String> {
    let mode=if ["Affordable","Premium"].contains(&current.design_mode.as_str()){current.design_mode.clone()}else{"Custom".to_string()};
    let pool:&[&str]=match mode.as_str(){"Affordable"=>&["Ranch","Colonial","Cape Cod","Modern farmhouse","Scandinavian","Contemporary","Craftsman"],"Premium"=>&["Victorian","Georgian","French country","Tudor","Craftsman","Coastal","English cottage"],_=>&["Contemporary","Georgian","Victorian","Modern farmhouse","Craftsman","Tudor","Cape Cod","Colonial","French country","Scandinavian","Mid-century","Ranch","English cottage","Coastal","Industrial"]};
    let palettes=[("#ece7dc","#2f3438","#ffffff"),("#5b6e5d","#2e3132","#efe9dc"),("#2f3e4e","#3a3b3c","#f2efe6"),("#a34e3c","#343434","#efe6d6"),("#d8c7a3","#4a4038","#f6f2ea"),("#7d8f9b","#2b2f33","#f1efe9"),("#f3efe6","#4f4a45","#2f3b33"),("#8a9a7b","#3a3f3a","#f4f0e6")];
    let schemes:Vec<String>=catalog()["interiorSchemes"].as_array().unwrap().iter().map(|v|s(v,"name").to_string()).collect();
    let trims:Vec<String>=catalog()["options"]["trimPackage"].as_array().unwrap().iter().filter_map(|v|v.as_str().map(str::to_string)).collect();
    let papers=["Peacock chinoiserie","Plum baroque","Blue medallion","Marble filigree","Teal lattice","Botanical silk","Heritage floral","Linen toile"];
    let mut last=String::new();
    for attempt in 0..40u32 {
        let mut r=Random(seed.wrapping_add(attempt.wrapping_mul(7919)));
        let mut c=current.clone();c.design_mode=mode.clone();c.seed=seed;c.active_floor=0;c.catalog_plan=true;c.trim_overrides.clear();architecture::reset_edits(&mut c);
        let style=loop{let pick=pool[r.pick(pool.len())];if pick!=current.home_style||attempt>20{break pick}};c.home_style=style.into();
        let home=lookup("homeStyles",style);c.siding=s(&home,"cladding").into();c.trim_package=s(&home,"trim").into();
        for(key,src)in[("siding","siding"),("roof","roof"),("trim","exteriorTrim")]{c.colors.insert(key.into(),s(&home,src).into());}
        finishes::architecture_defaults(&mut c);
        let single=["Ranch","Mid-century","Contemporary","Cape Cod","Craftsman","Industrial"].contains(&style);
        c.stories=if keep_size{current.stories}else if single{[1,1,2][r.pick(3)]}else{[2,2,3,1][r.pick(4)]};
        c.bedrooms=match mode.as_str(){"Affordable"=>2+r.pick(3),"Premium"=>3+r.pick(3),_=>2+r.pick(4)};
        let(w,d)=(c.width,c.depth);architecture::apply(&mut c,!keep_size);
        if keep_size{c.width=w.max(if c.stories>=2{24.}else{8.});c.depth=d;}else{c.width=(c.width+(r.pick(5)as f64*2.-4.)).clamp(24.,100.);c.depth=(c.depth+(r.pick(5)as f64*2.-4.)).clamp(24.,100.);}
        if c.stories>=2{c.depth=c.depth.max(architecture::minimum_depth(&c));}
        // Keep my dimensions means exactly that: a program that needs a deeper house is skipped, not stretched.
        if keep_size&&(!near(c.width,w)||!near(c.depth,d)){last="The kept dimensions are too small for that program.".into();continue}
        scheme(&mut c,&schemes[r.pick(schemes.len())]);
        if mode=="Affordable"{c.wallpaper="None".into();c.bedroom_wallpaper="None".into();c.trim_size="Normal".into();}
        else{c.trim_package=trims[r.pick(trims.len())].clone();let(a,b)=(r.pick(papers.len()),r.pick(papers.len()));c.wallpaper=if mode=="Premium"||r.pick(2)==0{papers[a].into()}else{"None".into()};c.bedroom_wallpaper=papers[b].into();c.trim_size=if mode=="Premium"{"Oversized".into()}else{"Normal".into()};}
        if r.pick(2)==0{let(sd,rf,tr)=palettes[r.pick(palettes.len())];for(key,value)in[("siding",sd),("roof",rf),("trim",tr)]{c.colors.insert(key.into(),value.into());}}
        let coverings=[roofing::METAL,roofing::ASPHALT,roofing::CEDAR,roofing::SLATE];c.roofing=if r.pick(10)<7{"Style matched".into()}else{let k=coverings[r.pick(4)];if c.pitch>=roofing::min_pitch(k){k.into()}else{"Style matched".into()}};
        c.dormer_style=if c.pitch>=8.&&r.pick(10)<4{"Style matched".into()}else{"None".into()};c.dormer_count=2;c.dormer_width=4.;c.dormer_depth=8.;c.dormer_side="Automatic".into();
        c.garage=if r.pick(10)<3{"Attached".into()}else{"None".into()};c.garage_side="Automatic".into();
        c.ceiling=if roof::cathedral_ok(&c)&&r.pick(10)<3{"Cathedral".into()}else{"Flat ceiling".into()};
        c.rear_outdoor="Style matched".into();c.balcony="Style matched".into();c.window_style="Style matched".into();c.window_size="Style matched".into();
        c.layout=heritage::plan_name(&c.home_style);
        match validate(&c){Err(e)=>{last=e;continue}Ok(())=>{}}
        if practical(&c,&model::build(&c)){return Ok(c)}last="The room program did not fit.".into();
    }
    Err(format!("No design fit after several tries ({}). Turn off Keep my dimensions or adjust the size.",last))
}
