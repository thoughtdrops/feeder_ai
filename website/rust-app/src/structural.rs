use crate::*;

// TJ-4000, July 2025, pp. 7/18. L/480, 16-in OC. Uniform floor
// 40 psf live / 20 psf dead; 22/24-in rows use the conservative 25 psf dead column.
// These are preliminary table candidates, never a complete structural approval.
pub const GUIDE:&str="https://www.weyerhaeuser.com/application/files/5617/5451/8519/TJ-4000.pdf";
#[derive(Clone,Copy)]pub struct Product{pub series:&'static str,pub depth:f64,pub limit:f64,pub flange:f64,pub rate:f64}
// Fixed 16-in panel depth; TJ-4000 p.7, L/480, 16-in OC, 40 live / 20 dead.
const PRODUCTS:[Product;5]=[
 Product{series:"TJI 110",depth:16.,limit:20.+7./12.,flange:1.75,rate:6.5},
 Product{series:"TJI 210",depth:16.,limit:22.+6./12.,flange:2.3125,rate:7.},
 Product{series:"TJI 230",depth:16.,limit:23.+9./12.,flange:2.3125,rate:7.5},
 Product{series:"TJI 360",depth:16.,limit:26.+3./12.,flange:2.5,rate:8.5},
 Product{series:"TJI 560",depth:16.,limit:29.+8./12.,flange:3.5,rate:9.5}];
pub fn bearing(c:&Config,w:&Wall)->bool{w.exterior||c.bearing_walls.contains(&w.id)||c.bearing_walls.iter().any(|id|w.id.starts_with(&format!("{}-S",id)))}
pub fn floor_spans(c:&Config,ws:&[Wall])->(bool,Vec<Value>){
 let along=c.width<=c.depth;let (length,stations) = if along{(c.width,c.depth)}else{(c.depth,c.width)};let mut out=vec![];
 let spacing=16./12.;for i in 0..=(stations/spacing).ceil()as usize{let station=(i as f64*spacing).min(stations);if i>0&&near(station,stations)&&near((i-1)as f64*spacing,stations){continue}
  let mut supports=vec![0.,length];for w in ws.iter().filter(|w|!w.exterior&&bearing(c,w)&&(w.axis=="z")==along){let start=if along{w.z}else{w.x};let coordinate=if along{w.x}else{w.z};let at=station-start;if at>=-0.001&&at<=w.length+0.001&&!w.openings.iter().any(|o|at>o.at-0.23&&at<o.at+o.width+0.23){supports.push(coordinate)}}supports.sort_by(f64::total_cmp);supports.dedup_by(|a,b|near(*a,*b));
  for pair in supports.windows(2){if pair[1]-pair[0]>0.1{out.push(json!({"station":station,"start":pair[0],"end":pair[1],"clearSpan":(pair[1]-pair[0]-5.5/12.).max(0.),"axis":if along{"x"}else{"z"}}));}}
 }(along,out)
}
pub fn floor_design(c:&Config,ws:&[Wall])->(bool,Vec<Value>,Option<Product>){let(along,spans)=floor_spans(c,ws);let max=spans.iter().map(|v|n(v,"clearSpan")).fold(0.,f64::max);let product=if c.floor_live_load<=40.&&c.floor_dead_load<=20.{PRODUCTS.iter().copied().find(|p|max<=p.limit+1e-8)}else{None};(along,spans,product)}
pub fn floor_gap(_c:&Config)->f64{16./12.+0.25}
pub fn apply(c:&Config,mut m:Value)->Value{
 let mut issues=vec![];let mut floor=Value::Null;
 if c.stories>=2{if c.stories==3{issues.push("Three stories: the second-floor deck carries the third floor and roof through its walls; bearing lines must stack and every floor span needs engineering.".into());}let ws:Vec<Wall>=serde_json::from_value(m["levels"][0]["walls"].clone()).unwrap();let(along,spans,product)=floor_design(c,&ws);let max=spans.iter().map(|v|n(v,"clearSpan")).fold(0.,f64::max);
  if product.is_none(){issues.push(format!("Floor clear span {:.2} ft / selected loading is outside the implemented TJI span-table conditions. Add a bearing wall, change dimensions, or have a beam/joist solution engineered.",max));}
  if m["stair"].is_null(){issues.push("The upper story has no stairs. Use Place stairs on the main floor.".into());}else{issues.push("Stair opening headers, trimmers, reactions, headroom and guards need engineering and local review.".into());}
  for w in ws.iter().filter(|w|!w.exterior&&bearing(c,w)){issues.push(format!("{} is marked bearing: footing support and every opening header remain unverified.",w.name));}
  let upper:Vec<Wall>=(1..c.stories).flat_map(|f|serde_json::from_value::<Vec<Wall>>(m["levels"][f]["walls"].clone()).unwrap()).collect();if upper.iter().any(|w|!w.exterior&&bearing(c,w)){issues.push("Upper-floor bearing walls apply roof/point loads; the uniform-load floor table does not verify these additional loads.".into());}
  floor=json!({"axis":if along{"x"}else{"z"},"maxClearSpan":round(max),"liveLoadPsf":c.floor_live_load,"deadLoadPsf":c.floor_dead_load,"spacingInches":16,"deflection":"L/480 live load","candidate":product.map(|p|json!({"series":p.series,"depthInches":p.depth,"tableLimitFeet":p.limit,"tableDeadLoadPsf":20,"requiresStiffeners":max>19.+11./12.})),"spans":spans,"status":if product.is_some(){"Preliminary uniform-load table candidate"}else{"No table candidate"}});
 }
 let roof_max=m["rafters"].as_array().unwrap().iter().map(|r|n(r,"length")).fold(0.,f64::max);issues.push(format!("Roof I-joists (longest modeled segment {:.2} ft), four-ply LVL ridges and hip/valley beams need site snow/wind loads, verified bearings and member sizing.",roof_max));if roofing::kind(c)==roofing::SLATE{issues.push("Natural slate adds about 8–10 psf of dead load. Size the roof I-joists, LVL ridge, supports and foundation for the slate.".into());}if roof::cathedral(c){issues.push("Cathedral ceiling: with no ceiling joists to tie the walls, the four-ply LVL ridge must be a structural beam carried on posts down to the foundation.".into());}
 let ws=m["allWalls"].as_array().or_else(||m["walls"].as_array()).unwrap();let missing=ws.iter().filter(|w|w["exterior"]==true).map(|w|if s(w,"axis")=="x"{(0.,c.width)}else{(0.,c.depth)}).zip(ws.iter().filter(|w|w["exterior"]==true)).any(|((_,length),w)|n(w,"length")<length-0.01);if missing{issues.push("An exterior wall section is removed. Verify the floor/roof bearing and lateral load path across this gap.".into());}
 if m["garage"].is_object(){issues.push("Garage roof and 16-foot door header need independent capacity/bearing verification.".into());}
 if m["dormers"].as_array().is_some_and(|v|!v.is_empty()){issues.push("Dormer roof-opening LVL headers/trimmers, interrupted I-joists, bearings, connections and roof ventilation require engineering and manufacturer detailing.".into());}
 if m["rearOutdoor"].is_object(){issues.push("Rear deck/porch loads, ledger attachment, footings, guards and local setbacks require site review.".into());}
 if n(&m["profile"],"requiredAtticR")>49.{issues.push(format!("Specified R-49 roof panel is below the selected model-code R-{:.0} prescriptive target. Resolve the assembly or approved alternate path before construction.",n(&m["profile"],"requiredAtticR")));}if n(&m["profile"],"requiredContinuousR")>0.{issues.push("Specified 7/16 ZIP + R-21 batt wall has no continuous insulation. Verify an approved local energy-code compliance path; the panel default is retained.".into());}
 issues.push("Crawlspace panel-joint girders, piers, foam protection and ground moisture control need site-specific design. Batt nameplate totals do not certify installed/compressed R-value.".into());
 let status="Engineering review required";
 m["structural"]=json!({"status":status,"floor":floor,"issues":issues,"check":"Geometry + preliminary manufacturer span-table screening","forte":{"status":"Not connected","analysisRun":false,"reason":"Official SDK and authenticated ForteWEB integration are not configured.","url":"https://www.forteweb.com/","sdkUrl":"https://www.weyerhaeuser.com/woodproducts/software-learning/forte-software/weyerhaeuser-interoperability-license/"},"guide":GUIDE,"basis":"TJ-4000 July 2025, page 7. Assumed dry service, 16-in OC, rated glue-nailed subfloor, adequate bearing and no added roof/point loads. Marked bearing walls are proposed supports, not certified supports. Header, trimmer, uplift, shear, foundation, connection, long-term deflection and site-load checks remain open."});m
}
