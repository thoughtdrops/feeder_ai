use crate::*;
// The design handed to the process simulator (public/process): everything it needs to build this
// house on its job site, in feet, using the studio's own plan coordinates (x across the front, z back).
pub const HANDOFF_KEY:&str="uf-process-design";
pub const RETURN_KEY:&str="uf-return-design";
fn wall(w:&Value)->Value{json!({"id":w["id"],"axis":w["axis"],"x":w["x"],"z":w["z"],"length":w["length"],"exterior":w["exterior"],
 "openings":w["openings"].as_array().map(|os|os.iter().map(|o|json!({"kind":o["kind"],"at":o["at"],"width":o["width"],"bottom":o["bottom"],"height":o["height"]})).collect::<Vec<_>>()).unwrap_or_default()})}
fn room(r:&Value)->Value{json!({"name":r["name"],"type":r["type"],"x":r["x"],"z":r["z"],"w":r["w"],"d":r["d"]})}
pub fn handoff(c:&Config,m:&Value)->Value{
 let levels=m["levels"].as_array().cloned().unwrap_or_else(||vec![m.clone()]);
 let roof=&m["roof"];let stories=match c.stories{1=>"1 story".to_string(),n=>format!("{} stories",n)};
 json!({"version":1,"label":format!("{} · {} × {} ft · {}",c.home_style,c.width,c.depth,stories),"style":c.home_style,"seed":c.seed,
  "width":c.width,"depth":c.depth,"stories":c.stories,"wallHeight":c.wall_height,"floorGap":structural::floor_gap(c),"pitch":c.pitch,
  "bedrooms":c.bedrooms,"area":m["area"],"materialsTotal":m["total"],"roofType":roof["type"],"foundation":m["foundation"],
  "stair":if m["stair"].is_object(){m["stair"]["opening"].clone()}else{Value::Null},
  "levels":levels.iter().enumerate().map(|(f,l)|json!({"floor":f,
   "walls":l["walls"].as_array().map(|ws|ws.iter().map(wall).collect::<Vec<_>>()).unwrap_or_default(),
   "rooms":l["rooms"].as_array().map(|rs|rs.iter().map(room).collect::<Vec<_>>()).unwrap_or_default()})).collect::<Vec<_>>(),
  "roof":{"facets":roof["facets"].as_array().map(|fs|fs.iter().map(|f|f["points"].clone()).collect::<Vec<_>>()).unwrap_or_default(),
   "edges":roof["edges"].as_array().map(|es|es.iter().map(|e|json!({"kind":e["kind"],"a":e["a"],"b":e["b"]})).collect::<Vec<_>>()).unwrap_or_default(),
   "profiles":roof["profiles"].clone(),"rise":roof["rise"]}})
}
