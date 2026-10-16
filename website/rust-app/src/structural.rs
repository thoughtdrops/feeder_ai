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
/// Floor-panel joints sit every 16 ft across the width; the foundation girders run under them (and under
/// both side walls), along the depth. Interior joint positions, in feet from the left wall.
pub fn panel_joints(c:&Config)->Vec<f64>{let mut out=vec![];let mut x=16.;while x<c.width-1e-6{out.push(x);x+=16.;}out}
/// Where a post under an upper-floor girder lands: on the pier rows (helical) or every 16 ft or less (crawlspace).
pub fn girder_posts(c:&Config)->Vec<f64>{if c.foundation==piers::HELICAL{let l=piers::layout(c);(1..l.per_line.saturating_sub(1)).map(|i|c.depth*i as f64/(l.per_line-1)as f64).collect()}else{let k=(c.depth/16.-1e-9).ceil().max(1.);(1..k as usize).map(|i|c.depth*i as f64/k).collect()}}
/// Joist spans at every 16-in station between supports. `girders` adds full-length girder lines (at x positions,
/// joists then span the width) to the walls marked bearing.
pub fn floor_spans(c:&Config,ws:&[Wall],girders:&[f64])->(bool,Vec<Value>){
 let along=!girders.is_empty()||c.width<=c.depth;let (length,stations) = if along{(c.width,c.depth)}else{(c.depth,c.width)};let mut out=vec![];
 let spacing=16./12.;for i in 0..=(stations/spacing).ceil()as usize{let station=(i as f64*spacing).min(stations);if i>0&&near(station,stations)&&near((i-1)as f64*spacing,stations){continue}
  let mut supports=vec![0.,length];supports.extend_from_slice(girders);for w in ws.iter().filter(|w|!w.exterior&&bearing(c,w)&&(w.axis=="z")==along){let start=if along{w.z}else{w.x};let coordinate=if along{w.x}else{w.z};let at=station-start;if at>=-0.001&&at<=w.length+0.001&&!w.openings.iter().any(|o|at>o.at-0.23&&at<o.at+o.width+0.23){supports.push(coordinate)}}supports.sort_by(f64::total_cmp);supports.dedup_by(|a,b|near(*a,*b));
  for pair in supports.windows(2){if pair[1]-pair[0]>0.1{out.push(json!({"station":station,"start":pair[0],"end":pair[1],"clearSpan":(pair[1]-pair[0]-5.5/12.).max(0.),"axis":if along{"x"}else{"z"}}));}}
 }(along,out)
}
pub struct Deck{pub along:bool,pub spans:Vec<Value>,pub product:Option<Product>,pub girders:Vec<f64>,pub max:f64}
fn table(c:&Config,max:f64)->Option<Product>{if c.floor_live_load<=40.&&c.floor_dead_load<=20.{PRODUCTS.iter().copied().find(|p|max<=p.limit+1e-8)}else{None}}
/// An upper floor deck. The walls below carry it where they can; when they leave a span outside the joist
/// tables, flush LVL girders are added over the foundation girder lines (under the floor-panel joints), on
/// posts that stack down to the piers, so no bay spans more than 16 ft.
pub fn floor_design(c:&Config,ws:&[Wall])->Deck{
 let max_of=|spans:&[Value]|spans.iter().map(|v|n(v,"clearSpan")).fold(0.,f64::max);
 let(along,spans)=floor_spans(c,ws,&[]);let max=max_of(&spans);let product=table(c,max);
 if product.is_none(){let lines=panel_joints(c);if !lines.is_empty(){let(along,spans)=floor_spans(c,ws,&lines);let max=max_of(&spans);let product=table(c,max);if product.is_some(){return Deck{along,spans,product,girders:lines,max}}}}
 Deck{along,spans,product,girders:vec![],max}
}
/// Wall stud grades. Sawn: SPF No. 2 2×6 with NDS size factors (Fb 875×1.3, Fc 1150×1.1). LSL: 1.55E laminated
/// strand lumber, approximate published values. (name, Fb, Fc parallel, Fc perpendicular, E, Emin, NDS c)
#[derive(Clone,Copy)]pub struct Grade{pub name:&'static str,pub fb:f64,pub fc:f64,pub fc_perp:f64,pub e:f64,pub emin:f64,pub c:f64}
pub const SAWN:Grade=Grade{name:"SPF No. 2 sawn 2×6",fb:875.*1.3,fc:1150.*1.1,fc_perp:425.,e:1.4e6,emin:0.51e6,c:0.8};
pub const LSL:Grade=Grade{name:"1.55E LSL 2×6",fb:2325.,fc:2050.,fc_perp:800.,e:1.55e6,emin:0.788e6,c:0.9};
pub fn grade(c:&Config)->Grade{if c.stud_type=="LSL studs"{LSL}else{SAWN}}
/// Allowable axial load on one 2×6 stud (lb) and what governs: NDS column stability about the strong axis
/// (sheathing braces the weak axis) or bearing on the plates (bearing-area factor 1.25). Plates match the studs.
pub fn stud_capacity(g:Grade,wall_height:f64)->(f64,&'static str){
 let area=1.5*5.5;let le=wall_height*12.-4.5;let fce=0.822*g.emin/(le/5.5).powi(2);let ratio=fce/g.fc;let a=(1.+ratio)/(2.*g.c);let cp=a-(a*a-ratio/g.c).sqrt();
 let column=cp*g.fc*area;let bearing=g.fc_perp*1.25*area;if column<bearing{(column,"column buckling")}else{(bearing,"bearing on the plates")}
}
/// Load on one lowest-story stud at 16 in o.c. under a bearing line: each floor above over half its clear span,
/// the roof (30 psf snow + 15 psf dead) over a quarter of the width plus the overhang, and 12 psf of wall per story above.
pub fn stud_demand(c:&Config,floor_span:f64)->f64{let floors=(c.stories-1)as f64;let plf=floors*(c.floor_live_load+c.floor_dead_load)*floor_span.min(c.width)/2.+45.*(c.width/4.+1.5)+floors*12.*c.wall_height;plf*16./12.}
pub fn studs(c:&Config,floor_span:f64)->Value{
 let(sawn,sawn_by)=stud_capacity(SAWN,c.wall_height);let(lsl,lsl_by)=stud_capacity(LSL,c.wall_height);let g=grade(c);let selected=if g.name==LSL.name{lsl}else{sawn};let demand=stud_demand(c,floor_span);
 json!({"selected":g.name,"sawn":{"name":SAWN.name,"capacityLb":sawn.round(),"governs":sawn_by},"lsl":{"name":LSL.name,"capacityLb":lsl.round(),"governs":lsl_by},
  "axialRatio":round(lsl/sawn),"bendingRatio":round(LSL.fb/SAWN.fb),"compressionRatio":round(LSL.fc/SAWN.fc),"stiffnessRatio":round(LSL.e/SAWN.e),"bucklingRatio":round(LSL.emin/SAWN.emin),
  "demandLb":demand.round(),"utilization":round(demand/selected),"floorSpanFeet":round(floor_span),
  "basis":"NDS column stability (le = wall height − 4.5 in, strong axis) and plate bearing (Cb 1.25); 16 in o.c.; 30 psf snow + 15 psf roof dead load assumed. LSL values are approximate published 1.55E values; confirm with the manufacturer and an engineer."})
}
pub fn floor_gap(_c:&Config)->f64{16./12.+0.25}
pub fn apply(c:&Config,mut m:Value)->Value{
 let mut issues=vec![];let mut floor=Value::Null;
 if c.stories>=2{if c.stories==3{issues.push("Three stories: the second-floor deck carries the third floor and roof through its walls; bearing lines must stack and every floor span needs engineering.".into());}let ws:Vec<Wall>=serde_json::from_value(m["levels"][0]["walls"].clone()).unwrap();let Deck{along,spans,product,girders,max}=floor_design(c,&ws);
  if !girders.is_empty(){issues.push(format!("Upper floor: {} flush LVL girder line{} over the foundation girders at the floor-panel joints carry the deck, on posts that stack down to the {}. Girder, post and connection sizes need engineering; place the posts inside walls where the plan allows.",girders.len(),if girders.len()==1{""}else{"s"},if c.foundation==piers::HELICAL{"piers"}else{"crawlspace girder piers"}));}
  if product.is_none(){issues.push(format!("Floor clear span {:.2} ft / selected loading is outside the implemented TJI span-table conditions. Add a bearing wall, change dimensions, or have a beam/joist solution engineered.",max));}
  if m["stair"].is_null(){issues.push("The upper story has no stairs. Use Place stairs on the main floor.".into());}else{issues.push("Stair opening headers, trimmers, reactions, headroom and guards need engineering and local review.".into());}
  for w in ws.iter().filter(|w|!w.exterior&&bearing(c,w)){issues.push(format!("{} is marked bearing: footing support and every opening header remain unverified.",w.name));}
  let upper:Vec<Wall>=(1..c.stories).flat_map(|f|serde_json::from_value::<Vec<Wall>>(m["levels"][f]["walls"].clone()).unwrap()).collect();if upper.iter().any(|w|!w.exterior&&bearing(c,w)){issues.push("Upper-floor bearing walls apply roof/point loads; the uniform-load floor table does not verify these additional loads.".into());}
  floor=json!({"axis":if along{"x"}else{"z"},"maxClearSpan":round(max),"liveLoadPsf":c.floor_live_load,"deadLoadPsf":c.floor_dead_load,"spacingInches":16,"deflection":"L/480 live load","candidate":product.map(|p|json!({"series":p.series,"depthInches":p.depth,"tableLimitFeet":p.limit,"tableDeadLoadPsf":20,"requiresStiffeners":max>19.+11./12.})),"girderLines":girders.iter().map(|x|round(*x)).collect::<Vec<_>>(),"spans":spans,"status":if product.is_some(){"Preliminary uniform-load table candidate"}else{"No table candidate"}});
 }
 let joints=panel_joints(c);let bay=std::iter::once(0.).chain(joints.iter().copied()).chain(std::iter::once(c.width)).collect::<Vec<_>>().windows(2).map(|w|w[1]-w[0]-5.5/12.).fold(0.,f64::max);
 let main=table(c,bay);let ground=json!({"girderLines":joints.len()+2,"maxClearSpan":round(bay),"candidate":main.map(|p|p.series),"basis":format!("Main floor panels span {:.2} ft or less between the {} foundation girder lines under the side walls and the 16-ft floor-panel joints.",bay,joints.len()+2)});
 let roof_max=m["rafters"].as_array().unwrap().iter().map(|r|n(r,"length")).fold(0.,f64::max);issues.push(format!("Roof I-joists (longest modeled segment {:.2} ft), four-ply LVL ridges and hip/valley beams need site snow/wind loads, verified bearings and member sizing.",roof_max));if roofing::kind(c)==roofing::SLATE{issues.push("Natural slate adds about 8–10 psf of dead load. Size the roof I-joists, LVL ridge, supports and foundation for the slate.".into());}if roof::cathedral(c){issues.push("Cathedral ceiling: with no ceiling joists to tie the walls, the four-ply LVL ridge must be a structural beam carried on posts down to the foundation.".into());}
 let ws=m["allWalls"].as_array().or_else(||m["walls"].as_array()).unwrap();let house=|w:&&Value|w["exterior"]==true&&s(w,"id").starts_with('E');let missing=ws.iter().filter(house).any(|w|n(w,"length")<if s(w,"axis")=="x"{c.width}else{c.depth}-0.01);if missing{issues.push("An exterior wall section is removed. Verify the floor/roof bearing and lateral load path across this gap.".into());}
 if m["garage"].is_object(){issues.push("Garage roof and 16-foot door header need independent capacity/bearing verification.".into());}
 if m["dormers"].as_array().is_some_and(|v|!v.is_empty()){issues.push("Dormer roof-opening LVL headers/trimmers, interrupted I-joists, bearings, connections and roof ventilation require engineering and manufacturer detailing.".into());}
 if m["rearOutdoor"].is_object(){issues.push("Rear deck/porch loads, ledger attachment, footings, guards and local setbacks require site review.".into());}
 if n(&m["profile"],"requiredAtticR")>49.{issues.push(format!("Specified R-49 roof panel is below the selected model-code R-{:.0} prescriptive target. Resolve the assembly or approved alternate path before construction.",n(&m["profile"],"requiredAtticR")));}if n(&m["profile"],"requiredContinuousR")>0.{issues.push("Specified 7/16 ZIP + R-21 batt wall has no continuous insulation. Verify an approved local energy-code compliance path; the panel default is retained.".into());}
 issues.push("Crawlspace panel-joint girders, piers, foam protection and ground moisture control need site-specific design. Batt nameplate totals do not certify installed/compressed R-value.".into());
 let span=if c.stories>=2{n(&floor,"maxClearSpan").max(1.)}else{0.};let stud=studs(c,span);if n(&stud,"utilization")>1.{issues.push(format!("Lowest-story bearing studs carry about {:.0} lb each, more than the {:.0} lb {} 2×6 capacity. Use LSL studs and plates, 12 in spacing, or an engineered wall.",n(&stud,"demandLb"),n(&stud,"demandLb")/n(&stud,"utilization"),s(&stud,"selected")));}
 let status="Engineering review required";
 m["structural"]=json!({"status":status,"studs":stud,"floor":floor,"mainFloor":ground,"issues":issues,"check":"Geometry + preliminary manufacturer span-table screening","forte":{"status":"Not connected","analysisRun":false,"reason":"Official SDK and authenticated ForteWEB integration are not configured.","url":"https://www.forteweb.com/","sdkUrl":"https://www.weyerhaeuser.com/woodproducts/software-learning/forte-software/weyerhaeuser-interoperability-license/"},"guide":GUIDE,"basis":"TJ-4000 July 2025, page 7. Assumed dry service, 16-in OC, rated glue-nailed subfloor, adequate bearing and no added roof/point loads. Marked bearing walls are proposed supports, not certified supports. Header, trimmer, uplift, shear, foundation, connection, long-term deflection and site-load checks remain open."});m
}
