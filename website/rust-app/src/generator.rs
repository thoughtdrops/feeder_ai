use crate::*;

struct Random(u32);
impl Random {
    fn pick(&mut self, count: usize) -> usize {
        self.0 = self.0.wrapping_mul(1664525).wrapping_add(1013904223);
        (self.0 as usize) % count
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

pub fn generate(current: &Config, mode: &str, seed: u32, keep_size: bool) -> Result<Config,String> {
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
            let dimensions: &[(f64,f64)] = if c.stories == 2 {
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
            let (w,d) = dimensions[random.pick(dimensions.len())]; c.width = w; c.depth = d;
        }
        c.home_style = if c.stories == 2 {"Colonial"} else {"Ranch"}.into();
        c.pitch = 4.; c.wall_height = 8.09375; c.stud_type = "Sawn lumber".into();
        c.trim_package = "Minimal shadow line".into(); c.trim_size = "Normal".into();
        c.wallpaper = "None".into(); c.bedroom_wallpaper = "None".into();
        c.siding = "Corrugated metal".into();
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
