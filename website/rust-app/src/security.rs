use crate::*;

pub const MAX_DESIGN_BYTES:usize=1_048_576;
pub fn parse(input:&str)->Result<Config,String>{
 if input.len()>MAX_DESIGN_BYTES{return Err("Design data exceeds the 1 MB limit.".into())}
 let c:Config=serde_json::from_str(input).map_err(|_|"Design data must be valid JSON with the expected field types.".to_string())?;
 validate(&c)?;Ok(c)
}
fn id(v:&str)->bool{!v.is_empty()&&v.len()<=96&&v.bytes().all(|b|b.is_ascii_alphanumeric()||b"-_".contains(&b))}
fn text(v:&str)->bool{v.len()<=512&&!v.chars().any(char::is_control)}
fn opening(o:&Opening)->bool{id(&o.id)&&["door","window","passage"].contains(&o.kind.as_str())&&[o.at,o.width,o.bottom,o.height].iter().all(|v|v.is_finite()&&*v>=0.&&*v<=100.)&&o.width>0.&&o.height>0.}
pub fn validate_design(c:&Config)->Result<(),String>{
 if c.added_walls.len()>128||c.wall_adjustments.len()>256||c.wall_removals.len()>128||c.placed_furniture.len()>256||c.deleted_furniture.len()>512||c.bearing_walls.len()>256||c.opening_overrides.len()>256||c.prices.len()>256||c.colors.len()>16||c.trim_overrides.len()>16{return Err("This design has too many edits. Use at most 128 added walls and 256 placed objects.".into())}
 if [&c.home_style,&c.interior_style,&c.trim_package,&c.siding,&c.floor,&c.drywall,&c.layout,&c.wallpaper,&c.bedroom_wallpaper,&c.county,&c.state,&c.zip,&c.jurisdiction,&c.energy_code,&c.electrical_code,&c.building_code,&c.facing,&c.stud_type].iter().any(|v|!text(v)){return Err("Design text is too long or contains invalid control characters.".into())}
 if c.jurisdiction.chars().count()>160||(!c.zip.is_empty()&&(c.zip.len()!=5||!c.zip.bytes().all(|b|b.is_ascii_digit()))){return Err("Use a five-digit ZIP and a jurisdiction name of at most 160 characters.".into())}
 if c.colors.iter().any(|(k,v)|!id(k)||v.len()!=7||!v.starts_with('#')||!v[1..].bytes().all(|b|b.is_ascii_hexdigit())){return Err("Material colors must be six-digit hex values, such as #206443.".into())}
 if c.prices.iter().any(|(k,v)|!id(k)||!v.is_finite()||*v<0.||*v>100000.){return Err("Unit prices must be between $0 and $100,000.".into())}
 if c.trim_overrides.iter().any(|(k,v)|!id(k)||!id(v)){return Err("Invalid trim profile identifier.".into())}
 if c.deleted_furniture.iter().chain(c.bearing_walls.iter()).any(|v|!id(v)){return Err("Invalid object identifier.".into())}
 if c.wall_adjustments.iter().any(|(k,g)|!id(k)||!["","x","z"].contains(&g.axis.as_str())||![g.x,g.z,g.length].iter().all(|v|v.is_finite()&&*v>=0.&&*v<=100.)||g.length<=0.){return Err("Wall dimensions must be finite values within 0–100 feet.".into())}
 if c.wall_removals.iter().any(|r|!id(&r.wall_id)||![r.at,r.width].iter().all(|v|v.is_finite()&&*v>=0.&&*v<=100.)){return Err("Invalid wall removal dimensions.".into())}
 if c.traced_plan.as_ref().is_some_and(|t|!traced::valid(t)){return Err("The traced floor plan has invalid rooms or sizes.".into())}
 let count=c.opening_overrides.values().map(Vec::len).sum::<usize>()+c.added_walls.iter().map(|w|w.openings.len()).sum::<usize>();
 if count>512||c.opening_overrides.iter().any(|(k,os)|!id(k)||os.len()>32||os.iter().any(|o|!opening(o))){return Err("Openings must have valid identifiers and dimensions; use at most 32 per wall.".into())}
 let mut seen=std::collections::BTreeSet::new();
 for w in &c.added_walls{if !id(&w.id)||!seen.insert(&w.id)||!text(&w.name)||!["x","z"].contains(&w.axis.as_str())||w.exterior||![w.x,w.z,w.length].iter().all(|v|v.is_finite()&&*v>=0.&&*v<=100.)||w.length<=0.||w.openings.iter().any(|o|!opening(o)){return Err("Custom walls must be unique interior walls with valid geometry.".into())}}
 let mut seen=std::collections::BTreeSet::new();
 for f in &c.placed_furniture{if !id(&f.id)||!seen.insert(&f.id)||!id(&f.kind)||!id(&f.room_id)||![f.x,f.z,f.w,f.d,f.rotation,f.local_width,f.local_depth].iter().all(|v|v.is_finite()&&v.abs()<=1000.)||f.w<=0.||f.d<=0.||f.local_width<=0.||f.local_depth<=0.||f.w>100.||f.d>100.{return Err("Placed objects must have unique identifiers and finite, positive dimensions.".into())}}
 Ok(())
}

pub fn item_id(text:&str)->String{text.chars().map(|c|if c.is_ascii_alphanumeric()||c=='-'||c=='_'{c}else{'-'}).collect()}
