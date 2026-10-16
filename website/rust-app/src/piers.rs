use crate::*;
// Helical pier foundation, matching the process simulator (public/process): same example soil
// torque profile, shaft rating, Kt and house loads, so the studio and the simulation agree.
pub const HELICAL:&str="Helical piers";
pub const CONCRETE:&str="Concrete crawlspace";
/// What the floor sits on between pier caps. Steel is the default: wide-flange beams bolted into the cap
/// saddles, a treated nailer bolted along the top flange, and the floor panels fastened to the nailer.
pub const BEAMS:[&str;2]=["Steel W10×22 beam","Engineered LVL girder"];
pub fn steel(c:&Config)->bool{c.pier_beam!=BEAMS[1]}
const SOIL_T:[(f64,f64);10]=[(0.,250.),(12.,450.),(48.,800.),(96.,1300.),(168.,2100.),(240.,3300.),(288.,5000.),(320.,6600.),(350.,7800.),(420.,9200.)];
const T_MAX:f64=8000.;const KT:f64=9.;const SAFETY:f64=2.;
const LEAD_FT:f64=7.;const EXT_FT:f64=10.;const SHORT_FT:f64=5.;const REVEAL_FT:f64=1.;const MAX_SPACING:f64=16.;
// Service loads the simulator uses for a 32 × 32 ft panelized house, by story count (kips).
fn house_kips_per_sqft(stories:usize)->f64{(match stories{1=>120.,2=>185.,_=>250.})/1024.}
fn torque_at(depth_in:f64)->f64{for w in SOIL_T.windows(2){let((d0,t0),(d1,t1))=(w[0],w[1]);if depth_in<=d1{return t0+(t1-t0)*(depth_in-d0)/(d1-d0)}}SOIL_T[SOIL_T.len()-1].1}
/// Allowable kips per pier: installation torque (95% of the profile, capped by the shaft rating) × Kt, over a safety factor of 2.
pub fn pier_kips(depth_ft:f64)->f64{(0.95*torque_at(depth_ft*12.)).min(T_MAX)*KT/SAFETY/1000.}
pub struct Layout{pub lines:usize,pub per_line:usize,pub spacing:f64,pub piers:usize,pub needed:usize,pub load:f64,pub capacity:f64,pub ext10:usize,pub ext5:usize}
/// Girder lines sit under both side walls and every 16-ft floor-panel joint; piers along each line at 16 ft or closer, added until they carry the house.
pub fn layout(c:&Config)->Layout{
 let load=c.width*c.depth*house_kips_per_sqft(c.stories);let capacity=pier_kips(c.pier_depth);let needed=(load/capacity-1e-9).ceil().max(0.) as usize;
 let lines=(c.width/MAX_SPACING-1e-9).ceil() as usize+1;let mut per_line=(c.depth/MAX_SPACING-1e-9).ceil() as usize+1;
 while lines*per_line<needed{per_line+=1;}
 let rest=(c.pier_depth+REVEAL_FT-LEAD_FT).max(0.);let mut ext10=(rest/EXT_FT+1e-9).floor() as usize;let left=rest-ext10 as f64*EXT_FT;let mut ext5=0;
 if left>1e-6{if left<=SHORT_FT{ext5=1}else{ext10+=1}}
 Layout{lines,per_line,spacing:c.depth/(per_line-1) as f64,piers:lines*per_line,needed,load,capacity,ext10,ext5}
}
pub fn summary(c:&Config)->Value{
 if c.foundation!=HELICAL{return json!({"type":c.foundation})}
 let l=layout(c);
 json!({"type":c.foundation,"beam":if steel(c){"steel"}else{"lvl"},"piers":l.piers,"girderLines":l.lines,"piersPerLine":l.per_line,"spacingFeet":round(l.spacing),"depthFeet":c.pier_depth,"kipsPerPier":round(l.capacity),"houseKips":round(l.load),"piersNeeded":l.needed,"tenFootExtensions":l.ext10,"fiveFootExtensions":l.ext5,
  "basis":"Example soil torque profile and loads from the process simulator; installation torque × Kt 9 ÷ 2. A site soil report, the installer's torque logs and an engineer set the final count and depth."})
}
pub fn add_items(t:&mut model::Takeoff,c:&Config){
 let l=layout(c);let p=l.piers as f64;
 macro_rules! count{($id:expr,$name:expr,$n:expr,$unit:expr,$price:expr,$basis:expr)=>{t.add($id,"Foundation",$name,$n as f64,$unit,$price,$basis,"Pier foundation estimate",false,true)};}
 let basis=format!("{} piers on {} girder lines, about {:.1} ft apart, driven to {} ft. Each carries about {:.1} kips against a {:.0} kip house load. Final count and depth require site soil data and engineering.",l.piers,l.lines,l.spacing,c.pier_depth,l.capacity,l.load);
 count!("pier-leads","Helical pier lead sections · 2-7/8 in shaft · 7 ft",p,"each",285.,&basis);
 count!("pier-ext10","Helical pier extensions · 10 ft",p*l.ext10 as f64,"each",210.,"Extensions to reach the set depth plus a 1 ft reveal; the offcut is plasma-cut at the laser line.");
 count!("pier-ext5","Helical pier extensions · 5 ft",p*l.ext5 as f64,"each",125.,"A short extension is used where it reaches the set depth, so finished piers don't stand tall.");
 count!("pier-couplers","Extension coupler bolt sets · two 3/4 in bolts",p*(l.ext10+l.ext5) as f64,"sets",12.,"One bolted coupler per extension joint.");
 let lf=l.lines as f64*c.depth;
 if steel(c){
  count!("pier-caps","New-construction pier cap brackets · steel beam saddle",p,"each",95.,"One bolted cap per pier with a saddle sized for the beam flange.");
  t.add("pier-beams","Foundation","Pier-line steel beams · W10×22 wide flange, shop primed",lf,"linear ft",46.,"Steel beams under both side walls and each 16-ft floor-panel joint, seated in the pier-cap saddles; splices at caps. Sizing and spans require engineering.","Pier foundation estimate",true,false);
  t.add("pier-nailers","Foundation","Beam-top nailer · pressure-treated 2×6 on the top flange",lf,"linear ft",2.4,"A continuous treated nailer along every beam; the floor panels are fastened down to it.","Pier foundation estimate",true,false);
  count!("pier-nailer-bolts","Nailer-to-flange bolts · ½ in with washers, 24 in on center",(lf/2.).ceil(),"each",2.2,"Two-foot spacing along each beam, staggered across the flange.");
  count!("pier-connections","Beam-to-cap bolted saddle connection sets",p,"sets",42.,"One bolted saddle connection per pier cap, uplift-rated.");
 }else{
  count!("pier-caps","New-construction pier cap brackets",p,"each",85.,"One bolted cap per pier, ready for the girder.");
  t.add("pier-girders","Foundation","Pier-line girders · 3-ply 1¾ × 11⅞ in LVL",lf,"linear ft",32.,"Girders under both side walls and each 16-ft floor-panel joint; sizing, splices and spans require engineering.","Pier foundation estimate",true,false);
  count!("pier-connections","Girder-to-cap uplift connection sets",p,"sets",28.,"One connection set per pier cap.");
 }
}
