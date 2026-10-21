use crate::*;
// ForteWEB job file (.4te): plain XML in Weyerhaeuser's Forte file format (schema version 5.5, from the Forte File
// Format Utility). It hands the studio's own framing to ForteWEB for member design: every distinct floor-joist span on
// each floor, the upper-floor flush girders, a header for each door and window size on each outside wall (with the roof,
// floor and wall loads it carries) and the common roof rafters. Every problem carries the same nodes the utility's own
// default problems do (floor performance, two connector slots, the multi-ply fastener list), because ForteWEB's
// importer expects them. Lengths are in inches and loads in psi over a tributary width in inches, as Forte stores them.
// Product lists are left empty, so ForteWEB considers every product.

// Code values from the Forte schema.
const JOIST:(u8,&str)=(1,"joist");const FLUSH_BEAM:(u8,&str)=(2,"flushbeam");const DROP_BEAM:(u8,&str)=(4,"dropbeam");const HEADER:(u8,&str)=(31,"header");
const FLOOR:u8=1;const ROOF:u8=2;const WALL:u8=3;
const UNIFORM_AREA:u8=3;
const SNOW:usize=0;const ROOF_LIVE:usize=3;const FLOOR_LIVE:usize=4;const DEAD:usize=5;
/// Roof loads the studio's own checks assume, in psf.
const ROOF_LIVE_PSF:f64=20.;const SNOW_PSF:f64=30.;const ROOF_DEAD_PSF:f64=15.;const WALL_DEAD_PSF:f64=10.;

#[derive(Clone,Copy)]struct Support{kind:u8,material:u8,length:f64,hanger:bool}
// Support types and materials (Forte codes): a 2×6 stud wall of SPF, a face-mount hanger on an LVL beam, a steel beam
// with a treated nailer, an LVL girder, a post, a jack stud under a header and a beveled plate under a rafter.
const STUD_WALL:Support=Support{kind:6,material:6,length:5.5,hanger:false};
const HANGER_ON_LVL:Support=Support{kind:0,material:2,length:3.5,hanger:true};
const STEEL_NAILER:Support=Support{kind:1,material:10,length:5.5,hanger:false};
const LVL_GIRDER:Support=Support{kind:0,material:2,length:3.5,hanger:false};
const POST:Support=Support{kind:9,material:5,length:3.5,hanger:false};
const JACK:Support=Support{kind:10,material:6,length:1.5,hanger:false};
const BEVELED_PLATE:Support=Support{kind:11,material:6,length:5.5,hanger:false};

/// One uniform area load over the full member: psf by load class (snow, wind, seismic, roof live, floor live, dead) over
/// a tributary width in feet (0 for joists and rafters, which ForteWEB loads by their spacing).
struct Load{psf:[f64;6],trib:f64,comment:String}
fn load(comment:impl Into<String>,trib:f64,classes:&[(usize,f64)])->Load{let mut psf=[0.;6];for(k,v)in classes{psf[*k]+=v;}Load{psf,trib,comment:comment.into()}}
struct Member{name:String,member:(u8,&'static str),system:u8,notes:String,pitch:f64,live:u32,total:u32,spans:Vec<f64>,supports:Vec<Support>,loads:Vec<Load>}

/// The .4te file for a design, and how many members it holds.
pub fn export(c:&Config,m:&Value)->(String,usize){
 let levels:Vec<&Value>=m["levels"].as_array().map(|l|l.iter().collect()).unwrap_or_else(||vec![m]);
 let mut containers:Vec<(String,Vec<Member>)>=vec![];
 let floor=&m["structural"]["floor"];let joist_depth=n(&floor["candidate"],"depthInches").max(9.5);
 let live=c.floor_live_load;let dead=c.floor_dead_load;let fh=c.wall_height+structural::floor_gap(c);
 // The studio's own preliminary span-table pick, noted on each joist; ForteWEB makes the real choice.
 let pick=match s(&floor["candidate"],"series"){""=>String::new(),series=>format!(" Studio's preliminary pick: {} in {series}.",num(joist_depth))};
 let joist=|name:String,notes:String,spans:Vec<f64>,supports:Vec<Support>|Member{name,member:JOIST,system:FLOOR,notes:notes+&pick,pitch:0.,live:480,total:240,spans,supports,
  loads:vec![load("Floor live and dead",0.,&[(FLOOR_LIVE,live),(DEAD,dead)])]};
 // Joists run across the width between support lines; each distinct bay becomes one member (×count in the notes).
 let bays=|lines:&[f64]|->Vec<(f64,f64)>{let mut all=vec![0.];all.extend(lines.iter().copied().filter(|x|*x>0.1&&*x<c.width-0.1));all.push(c.width);all.sort_by(f64::total_cmp);all.dedup_by(|a,b|near(*a,*b));all.windows(2).map(|w|(w[0],w[1])).collect()};
 let ft=|v:f64|{let i=(v*12.).round();if i%12.==0.{format!("{:.0} ft",i/12.)}else{format!("{:.0} ft {:.0} in",(i/12.).floor(),i%12.)}};
 // Main floor: crawlspace floor panels between the foundation girders (steel beams with nailers, or LVL girders).
 {let mut ms=vec![];let joints=structural::panel_joints(c);let steel=c.foundation==piers::HELICAL&&piers::steel(c);let girder=if c.foundation!=piers::HELICAL{STUD_WALL}else if steel{STEEL_NAILER}else{LVL_GIRDER};
  let mut seen:Vec<f64>=vec![];
  for(a,b)in bays(&joints){let len=b-a;if seen.iter().any(|v|near(*v,len)){continue}seen.push(len);let count=bays(&joints).iter().filter(|(x,y)|near(y-x,len)).count();
   ms.push(joist(format!("Main floor joist · {}",ft(len)),format!("{count} bay(s) of {} between foundation girders, 16 in o.c.; {:.0} psf live / {:.0} psf dead.",ft(len),live,dead),vec![len*12.-girder.length],vec![girder,girder]));}
  if c.foundation==piers::HELICAL&&!steel{let l=piers::layout(c);let posts:Vec<f64>=(1..l.per_line.saturating_sub(1)).map(|i|c.depth*i as f64/(l.per_line-1)as f64).collect();
   let mut lines=vec![0.];lines.extend(joints.iter().copied());lines.push(c.width);
   for(i,x)in lines.iter().enumerate(){let trib=if i==0{lines[1]-x}else if i+1==lines.len(){x-lines[i-1]}else{lines[i+1]-lines[i-1]}/2.;
    ms.push(beam(format!("Foundation girder at {}",ft(*x)),DROP_BEAM,FLOOR,format!("LVL girder on the pier caps under the main floor, {:.1} ft tributary. Posts from the floors above add point loads; add them in ForteWEB.",trib),c.depth,&posts,POST,POST,trib,live,dead));}}
  containers.push(("Main floor".into(),ms));}
 // Upper floors: joists between the walls and the flush LVL girders, which sit on posts down to the piers.
 let girders:Vec<f64>=floor["girderLines"].as_array().map(|g|g.iter().filter_map(Value::as_f64).collect()).unwrap_or_default();
 let deck:Vec<(f64,f64)>={let mut v:Vec<(f64,f64)>=floor["spans"].as_array().into_iter().flatten().map(|sp|(n(sp,"start"),n(sp,"end"))).collect();v.sort_by(|a,b|a.0.total_cmp(&b.0).then(a.1.total_cmp(&b.1)));v.dedup_by(|a,b|near(a.0,b.0)&&near(a.1,b.1));v};
 let along_x=s(floor,"axis")!="z";let deck_len=if along_x{c.width}else{c.depth};
 for f in 1..c.stories{
  let mut ms=vec![];let mut seen:Vec<(f64,bool,bool)>=vec![];
  for(a,b)in &deck{let len=b-a;let at=|x:f64|if girders.iter().any(|g|near(*g,x)){HANGER_ON_LVL}else{STUD_WALL};let(sa,sb)=(at(*a),at(*b));
   if seen.iter().any(|(l,x,y)|near(*l,len)&&*x==sa.hanger&&*y==sb.hanger){continue}seen.push((len,sa.hanger,sb.hanger));
   let count=deck.iter().filter(|(x,y)|near(y-x,len)&&at(*x).hanger==sa.hanger&&at(*y).hanger==sb.hanger).count();
   let ends=|s:&Support|if s.hanger{"a hanger on the LVL girder"}else{"a stud wall"};
   let kind=|s:&Support|if s.hanger{"girder"}else{"wall"};ms.push(joist(format!("{} joist · {} {} to {}",floor_name(f),ft(len),kind(&sa),kind(&sb)),format!("{count} bay(s) of {}, from {} to {}; 16 in o.c.; {:.0} psf live / {:.0} psf dead.",ft(len),ends(&sa),ends(&sb),live,dead),vec![len*12.-(sa.length+sb.length)/2.],vec![sa,sb]));}
  let posts=structural::girder_posts(c);let mut lines=vec![0.];lines.extend(girders.iter().copied());lines.push(deck_len);
  for(i,x)in lines.iter().enumerate().skip(1).take(girders.len()){let trib=(lines[i+1]-lines[i-1])/2.;
   ms.push(beam(format!("{} girder at {}",floor_name(f),ft(*x)),FLUSH_BEAM,FLOOR,format!("Flush LVL girder, {} in deep to match the joists, carrying {:.1} ft of floor tributary, on posts that stack down to the piers.",num(joist_depth),trib),if along_x{c.depth}else{c.width},&posts,STUD_WALL,POST,trib,live,dead));}
  containers.push((floor_name(f).into(),ms));
 }
 // Headers: one per opening size on each outside wall, with what it carries above.
 let profiles=m["roof"]["profiles"].as_array();
 let gable_end=|side:usize|profiles.and_then(|p|p.get(side)).and_then(|p|p["points"].as_array()).is_some_and(|p|p.iter().any(|q|q[1].as_f64().unwrap_or(0.)>1.));
 let overhang=n(&m["roof"],"overhangZ").max(n(&m["roof"],"overhangX")).max(1.);
 for(f,l)in levels.iter().enumerate(){
  let Some(ms)=containers.get_mut(f).map(|c|&mut c.1)else{continue};let mut groups:BTreeMap<(String,i64),(String,f64,usize)>=BTreeMap::new();
  for w in l["walls"].as_array().into_iter().flatten().filter(|w|w["exterior"]==true){let id=s(w,"id");let base=id.split("-L").next().unwrap_or("");
   if !["E1","E2","E3","E4"].contains(&base){continue}
   for o in w["openings"].as_array().into_iter().flatten(){let width=n(o,"width");if width<1.{continue}
    let e=groups.entry((base.to_string(),(width*48.).round()as i64)).or_insert((s(o,"kind").to_string(),width,0));e.2+=1;}}
  for((base,_),(kind,width,count))in groups{let side=match base.as_str(){"E1"=>0,"E2"=>1,"E3"=>2,_=>3};let wall_name=["front","rear","left","right"][side];
   // Roof: the eave walls carry half the roof run plus the overhang. Floors above: walls the joists bear on carry
   // half the end bay. Walls above add their own weight.
   let roof_trib=if gable_end(side){0.}else{(if side<2{c.depth}else{c.width})/2.+overhang};let bears=if along_x{side>=2}else{side<2};
   let end_bay=if bears{deck.iter().map(|(a,b)|b-a).next().unwrap_or(deck_len)/2.}else{0.};let above=c.stories-1-f;
   let floor_trib=end_bay*above as f64;
   let mut loads=vec![];
   if roof_trib>0.{loads.push(load(format!("Roof, {:.1} ft of roof",roof_trib),roof_trib,&[(ROOF_LIVE,ROOF_LIVE_PSF),(SNOW,SNOW_PSF),(DEAD,ROOF_DEAD_PSF)]));}
   if floor_trib>0.{loads.push(load(format!("Floor, {:.1} ft from {} floor(s) above",end_bay,above),floor_trib,&[(FLOOR_LIVE,live),(DEAD,dead)]));}
   if above>0{loads.push(load(format!("{} wall(s) above",above),c.wall_height*above as f64,&[(DEAD,WALL_DEAD_PSF)]));}
   if loads.is_empty(){loads.push(load("Wall above the opening",2.,&[(DEAD,WALL_DEAD_PSF)]));}
   let jack=if width>6.{Support{length:3.,..JACK}}else{JACK};
   ms.push(Member{name:format!("{} header · {} {} · {}",floor_name(f),wall_name,kind,ft(width)),member:HEADER,system:WALL,notes:format!("{count} opening(s) {} wide in the {wall_name} wall; on jack studs in a 2×6 wall.",ft(width)),pitch:0.,live:360,total:240,
    spans:vec![width*12.],supports:vec![jack,jack],loads});}
 }
 // Roof: common I-joist rafters from the eave wall to the ridge beam, 16 in o.c.
 {let ridge_along_x=gable_end(2)||gable_end(3)||!(gable_end(0)||gable_end(1));let run=if ridge_along_x{c.depth}else{c.width}/2.;
  let rafter=Member{name:format!("Roof rafter · {} run",ft(run)),member:JOIST,system:ROOF,notes:format!("I-joist rafter 16 in o.c. at {:.0}:12 from the eave wall to the ridge beam; {:.0} psf roof live, {:.0} psf snow, {:.0} psf dead. Eave overhang ({}) not modeled; add it in ForteWEB.",c.pitch,ROOF_LIVE_PSF,SNOW_PSF,ROOF_DEAD_PSF,ft(overhang)),
   pitch:c.pitch.min(12.),live:240,total:180,spans:vec![run*12.-(BEVELED_PLATE.length+HANGER_ON_LVL.length)/2.],supports:vec![BEVELED_PLATE,HANGER_ON_LVL],
   loads:vec![load("Roof live, snow and dead",0.,&[(ROOF_LIVE,ROOF_LIVE_PSF),(SNOW,SNOW_PSF),(DEAD,ROOF_DEAD_PSF)])]};
  containers.push(("Roof".into(),vec![rafter]));}
 let count=containers.iter().map(|(_,ms)|ms.len()).sum();
 (write(c,&containers,fh),count)
}
fn floor_name(f:usize)->&'static str{match f{0=>"Main floor",1=>"Upper floor",_=>"Third floor"}}
/// A beam along a girder line: supported at both ends and on each post, carrying a tributary strip of floor.
#[allow(clippy::too_many_arguments)]
fn beam(name:String,member:(u8,&'static str),system:u8,notes:String,length:f64,posts:&[f64],end:Support,mid:Support,trib:f64,live:f64,dead:f64)->Member{
 let mut stations=vec![0.];stations.extend(posts.iter().copied().filter(|p|*p>0.5&&*p<length-0.5));stations.push(length);
 let supports:Vec<Support>=stations.iter().enumerate().map(|(i,_)|if i==0||i+1==stations.len(){end}else{mid}).collect();
 let spans:Vec<f64>=stations.windows(2).enumerate().map(|(i,w)|(w[1]-w[0])*12.-(supports[i].length+supports[i+1].length)/2.).collect();
 Member{name,member,system,notes,pitch:0.,live:360,total:240,spans,supports,loads:vec![load(format!("Floor, {:.1} ft tributary",trib),trib,&[(FLOOR_LIVE,live),(DEAD,dead)])]}
}

struct X(String);
impl X{
 fn open(&mut self,tag:&str){self.0.push_str(&format!("<{tag}>"));}
 fn close(&mut self,tag:&str){self.0.push_str(&format!("</{tag}>"));}
 fn v(&mut self,tag:&str,value:impl std::fmt::Display){let text=value.to_string();if text.is_empty(){self.0.push_str(&format!("<{tag} />"))}else{self.0.push_str(&format!("<{tag}>{}</{tag}>",xml_escape(&text)))}}
 fn f(&mut self,tag:&str,value:f64){self.v(tag,num(value))}
}
fn xml_escape(s:&str)->String{s.replace('&',"&amp;").replace('<',"&lt;").replace('>',"&gt;").replace('"',"&quot;").replace('\'',"&apos;")}
fn num(v:f64)->String{let r=(v*1e6).round()/1e6;let s=format!("{r:.6}");s.trim_end_matches('0').trim_end_matches('.').to_string()}
fn trimmed(s:&str,max:usize)->String{s.chars().take(max).collect()}

/// The rim board, blocking or nothing at a support, as the utility's default problems set it.
fn accessory(mb:&Member,sp:&Support)->u8{
 if sp.hanger||sp.kind==POST.kind||sp.kind==JACK.kind{return 0}
 match(mb.member.0,mb.system){(1,ROOF)=>2,(1,_)=>4,(4,_)=>2,(2,_)=>4,_=>0}
}
/// Overall member length: the clear spans plus every bearing.
fn length(mb:&Member)->f64{mb.spans.iter().map(|s|s.max(1.)).sum::<f64>()+mb.supports.iter().map(|s|s.length.clamp(1.5,14.)).sum::<f64>()}

fn write(c:&Config,containers:&[(String,Vec<Member>)],fh:f64)->String{
 let mut x=X(String::from("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n"));
 x.0.push_str("<Project xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:xsd=\"http://www.w3.org/2001/XMLSchema\">");
 x.v("Version","5.5");x.v("PAEVersion","");x.v("JobNameReset","");
 // Project settings: the utility's defaults (IBC, 90 mph wind, Simpson hangers, standard load duration factors).
 x.open("ForteSettings");
 x.v("Notes",trimmed(&format!("Exported from the Universal Frame studio (design UF-{}). {} × {} ft, {} stor{}, {:.0}:12 roof. Preliminary loads and member layout for ForteWEB design; set the building code, site snow, wind and seismic loads, and verify bearings and connections.",c.seed,c.width,c.depth,c.stories,if c.stories==1{"y"}else{"ies"},c.pitch),1000));
 x.v("SoftwareOperator","Universal Frame studio");x.v("DoNotApplyWindLoad",false);x.v("OccupancyCategory",1);x.v("IsHurricaneProneRegion",false);x.v("BasicWindSpeed","90 mph");
 x.v("NbccSelectedRegion",0);x.v("NbccSelectedLocation",0);x.v("LoadApplicationOption",0);x.v("CustomWindPressure","1.5");x.v("SlopeAdjustRoofDeadLoadsValue",1);
 x.v("UOMSetting",1);x.v("ConnectorManufacturer",2);x.v("BuildingCode",5);x.v("IBC2015Selected",false);x.v("RepetitiveMemberIncrease",true);
 x.v("WSEndSupports",false);x.v("WSIntermediateSupports",true);x.v("CantileverReinforcement",false);x.v("MPDisplay",0);
 for(tag,v)in[("LDFDead",0.9),("LDFFloor",1.),("LDFSnow",1.15),("LDFRoof",1.25),("LDFWind",1.6),("LDFSeismic",1.6)]{x.f(tag,v);}
 x.close("ForteSettings");
 x.open("ProblemContainers");
 let plate=(c.stories.max(1)-1)as f64*fh+c.wall_height;let rise=c.pitch/12.*c.width.min(c.depth)/2.;
 let mut idtag=0;
 for(ci,(name,members))in containers.iter().enumerate(){
  x.0.push_str(&format!("<ProblemContainer containerid=\"{ci}\">"));
  x.v("Name",trimmed(name,50));x.v("BuildingClass",11);x.v("ImportanceCategoryType",1);x.v("LOverValue",120);x.v("ExposureCategory",0);
  x.f("MeanRoofHeight",((plate+rise/2.)*12.).clamp(0.,720.));x.v("LOverValueNBCC",180);x.v("ExposureCategoryNBCC",0);
  x.f("RidgeHeight",((plate+rise)*12.).clamp(39.37,787.36));x.f("EaveHeight",(plate*12.).clamp(39.37,787.36));x.f("DistanceChange",600.);
  x.open("Problems");
  for(pi,mb)in members.iter().enumerate(){
   x.0.push_str(&format!("<Problem containerid=\"{ci}\" problemid=\"{pi}\" idtag=\"{idtag}\">"));idtag+=1;
   x.v("Name",trimmed(&mb.name,50));x.v("MemberType",mb.member.0);x.v("MemberTypeStringTag",mb.member.1);x.v("StructuralSystem",mb.system);x.v("Notes",trimmed(&mb.notes,1000));
   x.f("MemberPitchRise",mb.pitch);x.v("LiveDeflectionRatio",mb.live);x.v("TotalDeflectionRatio",mb.total);x.v("DeflectionCriteriaSetting",0);
   x.v("ApplyFlatRoofRecommendedDeflectionCriteria",false);x.v("AllowNegativeSupportRemoval",false);x.v("IsMemberWindSill",false);x.v("ProblemIsDesignable",true);x.v("ProblemIsDesigned",false);
   // Floor performance: the utility sets it on every horizontal member (it only applies to floor joists).
   x.open("FloorPerformance");x.v("MinimumTJProRating",40);x.v("SheathingAttachment",0);x.v("UseTJIBlocking",false);x.v("Strapping",0);x.v("PourFlooringOverlay",false);
   x.v("Perpendicularpartitions",false);x.v("CeilingType",0);x.v("TJProRatingAny",false);x.v("DeckingID",4026);x.close("FloorPerformance");
   // Spans and supports: clear spans between the faces of the supports.
   x.open("SpansAndSupports");x.open("SpansData");x.v("HasLeftOverHang",false);x.v("HasRightOverHang",false);x.open("Spans");
   for sp in &mb.spans{x.open("Span");x.f("Length",sp.max(1.));x.close("Span");}x.close("Spans");x.close("SpansData");
   x.open("SupportsData");x.v("DimensionerTemplate",1);x.open("Supports");
   for sp in &mb.supports{x.open("Support");x.v("Justification",4);x.f("Length",sp.length.clamp(1.5,14.));
    x.v("Configuration",if sp.hanger{2}else{0});x.v("SupportType",sp.kind);x.v("Material",sp.material);x.v("Accessory",accessory(mb,sp));x.v("LateralConnectorSelection",2);x.close("Support");}
   x.close("Supports");x.close("SupportsData");x.close("SpansAndSupports");
   // Vertical loads in the base load group; no lateral (wind) loads.
   x.open("NonVerticalMemberLoadData");x.open("YAxisLoadData");loads(&mut x,mb);x.close("YAxisLoadData");x.open("LinkedReactions");x.close("LinkedReactions");
   x.open("ZAxisLoadData");load_data(&mut x);x.open("LoadGroups");x.open("LoadGroup");x.v("LoadGroupNumber",0);x.open("LoadDefs");x.close("LoadDefs");x.close("LoadGroup");x.close("LoadGroups");x.close("ZAxisLoadData");x.close("NonVerticalMemberLoadData");
   x.open("Holes");x.close("Holes");x.open("LocationAnalysisPoints");x.close("LocationAnalysisPoints");
   x.open("MultiPlyData");x.v("ErrorCode",0);x.v("SelectedDisplayType",0);x.open("SelectedFasteners");x.close("SelectedFasteners");x.close("MultiPlyData");
   // Empty product lists: ForteWEB considers every product.
   x.open("ProductGroups");x.close("ProductGroups");
   x.open("ConsideredProducts");for tag in["ConsideredSeries","ConsideredDepths","ConsideredPlies","ConsideredSpacings"]{x.open(tag);x.close(tag);}
   x.v("ConsideredOrientation",0);x.f("CustomDepth",0.);x.f("CustomSpacing",0.);x.v("SelectedPreservativeTreatment",0);x.close("ConsideredProducts");
   // Two connector slots, for the first and last support; a hanger end names its support.
   x.open("Connectors");
   for(slot,i)in[0,mb.supports.len().saturating_sub(1)].into_iter().enumerate(){let id=if mb.supports.get(i).is_some_and(|s|s.hanger)&&(slot==0||i>0){i as i64}else{-1};
    x.open("Connector");x.v("SupportID",id);x.v("ConcealedFlanges",false);x.v("NailerThickness",0);x.v("OffSetFlange",0);x.f("SkewAngle",0.);x.f("SupportDepth",0.);
    x.v("SupportedPlies",1);x.v("SupportDepthMatchesMemberDepth",true);x.v("HangerSeatIsFlat",false);x.close("Connector");}
   x.close("Connectors");
   x.open("SelectedDesignResultsProperty");
   x.v("SelectedProductID",0);x.v("SelectedProductSeries",0);x.v("SelectedServiceLevel",0);x.f("SelectedProductDepth",0.);
   x.v("SelectedProductPlies",0);x.f("SelectedProductSpacing",0.);x.v("SelectedProductLabel","");x.open("SelectedConnectors");x.close("SelectedConnectors");x.v("SelectedProductIsPlank",false);
   x.close("SelectedDesignResultsProperty");
   x.open("SolutionsDataProperty");x.v("SolutionListSortItem",0);x.v("SortOrder",0);x.v("ShowAllProducts",true);x.close("SolutionsDataProperty");
   x.open("MemberReactionLinks");x.close("MemberReactionLinks");
   x.close("Problem");
  }
  x.close("Problems");x.close("ProblemContainer");
 }
 x.close("ProblemContainers");x.close("Project");x.0
}
fn load_data(x:&mut X){x.v("LoadsAreConsolidated",true);x.v("AdjustDeadLoads",true);x.f("RoofSlope",0.);x.f("ConcentratedLiveLoadMagnitude",0.);x.v("ConcentratedLiveLoadSharing",false);x.f("ConcentratedLiveLoadTributaryWidth",0.);x.v("ConcentratedLiveLoadComment","");}
/// Each load is one full-length uniform area load listing all six load classes, in psi, over its tributary width in
/// inches (12 in for joists and rafters, as in the utility's own default load).
fn loads(x:&mut X,mb:&Member){
 load_data(x);
 x.open("LoadGroups");x.open("LoadGroup");x.v("LoadGroupNumber",0);x.open("LoadDefs");
 let end=length(mb);
 for(i,l)in mb.loads.iter().enumerate(){let trib=if l.trib>0.{(l.trib*12.).clamp(1.,1199.)}else{12.};
  x.open("LoadDef");x.v("LoadType",UNIFORM_AREA);x.v("LoadFullLength",true);x.v("LoadOffMember",false);x.v("DisableEditing",false);x.f("StartTribWidth",trib);x.f("EndTribWidth",trib);
  x.v("AdjustSlope",false);x.f("StartLocation",0.);x.f("EndLocation",end);x.v("Comments",trimmed(&l.comment,100));x.f("RoofSlope",0.);x.v("ViewPosition",i);x.v("LoadPlacement",0);x.v("LoadCombine",false);
  x.open("Loads");for(class,psf)in l.psf.iter().enumerate(){x.open("Load");x.v("LoadClass",class);x.f("StartMagnitude",psf/144.);x.f("EndMagnitude",psf/144.);x.close("Load");}x.close("Loads");x.close("LoadDef");}
 x.close("LoadDefs");x.close("LoadGroup");x.close("LoadGroups");
}
