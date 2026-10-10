use crate::*;
use model::Takeoff;

/// Factory module sizes do not change the customer's nominal footprint.
/// Boundary modules are cut to fit; every stock purchase keeps its own waste basis.
pub fn definitions(c:&Config)->Value{json!([
 {"id":"exterior","name":"Exterior wall panel","module":"8 × 32 ft; end panel 8 × 31 ft 1 in","layers":["2×6 SPF #2, 24 in O.C.; 92-5/8 in precuts for the standard panel","One factory bottom and first top plate; second top plate installed on site","Two 2×10 / 2×12 header estimating candidates with 2 in rigid foam; adopted header table and site loads pending","Wire / pipe hole coordination; cabinet, shower and grab-bar blocking","7/16 in ZIP wall sheathing; taped seams, opening flashing and sill stretch tape","Horizontal 1×4 furring, 24 in O.C.; 2 in drainage breaks every 4 ft; top / bottom insect screen","29-gauge ribbed metal siding and opening / corner trim","On site: R-21 kraft-faced fiberglass, paper toward the room","On site: 1/2 in pre-painted 4 × 16 drywall, batten / reveal joints"]},
 {"id":"interior","name":"Interior wall panel","module":"Nonbearing 2×6 panel; wet wall accommodates a coordinated 3 in drain stack","layers":["2×6 SPF #2 at 24 in O.C.; single flat 2×6 door headers","Pre-coordinated wire / pipe holes; cabinet, TV and folding-track blocking","Optional R-13 unfaced bedroom / bath sound batts","On site: 1/2 in pre-painted 4 × 16 drywall on both faces"]},
 {"id":"floor","name":"First floor · crawlspace panel","module":"16 × 32 ft; 16 in I-joists at 16 in O.C.","layers":["7/16 in OSB bottom protective board (your permitted alternative to 1/4 in plywood)","1 in polyiso; foil seams taped","16 in I-joists, LSL rims and coordinated wet-wall sleeves","R-30 + R-19 unfaced fiberglass; installed thickness / subfloor contact must match selected products","23/32 in AdvanTech, glued and nailed","On site: vinyl underlayment and sheet vinyl, or selected tile installation system"]},
 {"id":"upper","name":"Upper floor panel","module":"16 × 32 ft; 16 in I-joists at 16 in O.C.","layers":["16 in I-joists with LSL rim boards","Blocking / nailers under partitions and folding tracks","23/32 in AdvanTech, glued and nailed","Optional R-19 unfaced sound batts","Ceiling below: 5/8 in pre-painted 4 × 16 drywall"]},
 {"id":"roof","name":"Roof panel","module":"22 × 32 ft; 16 in I-joist rafters at 16 in O.C.","layers":["On site: 5/8 in pre-painted 4 × 16 ceiling drywall",format!("On site: {} fiberglass; kraft paper down on the innermost layer only",c.roof_insulation),"At least 1-1/2 in continuous vent channel, baffles in every bay","16 in I-joists; manufacturer web stiffeners and screened eave / ridge rim openings","5/8 in ZIP roof sheathing; seams taped","Grace Ice & Water Shield at eaves / valleys; roofing-maker-required underlayment","Horizontal 1×4 purlins at 24 in O.C.; product-specific end spacing","29-gauge metal roofing, drip edge and snow guards above exterior doors"]}
])}

fn member(id:String,role:&str,mat:&str,a:[f64;3],b:[f64;3],width:f64,depth:f64)->Value{
 let length=(0..3).map(|i|(b[i]-a[i]).powi(2)).sum::<f64>().sqrt();
 json!({"id":id,"wallId":"CRAWL-FLOOR","role":role,"material":mat,"group":"Floor framing","x1":a[0],"y1":a[1],"z1":a[2],"x2":b[0],"y2":b[1],"z2":b[2],"width":width,"depth":depth,"length":length,"stockLength":(length/2.).ceil()*2.})
}
pub fn first_floor(c:&Config)->Vec<Value>{
 let mut out=vec![];let y=-16./24.-0.1;let spacing=16./12.;
 for ix in 0..(c.width/16.).ceil()as usize{for iz in 0..(c.depth/32.).ceil()as usize{
  let x=ix as f64*16.;let z=iz as f64*32.;let w=(c.width-x).min(16.);let d=(c.depth-z).min(32.);let id=format!("FP-{}-{}",ix,iz);
  let rim=1.125/12.;let edge=rim+2.3125/24.;
  for i in 0..=(d/spacing).ceil()as usize{let station=(i as f64*spacing).min(d).clamp(edge,d-edge);out.push(member(format!("{}-J{}",id,i),"Crawlspace floor I-joist","16 in I-joist · series / bearings pending",[x+rim,y,z+station],[x+w-rim,y,z+station],2.3125/12.,16./12.));}
  for (i,a,b) in [(0,[x,y,z+rim/2.],[x+w,y,z+rim/2.]),(1,[x,y,z+d-rim/2.],[x+w,y,z+d-rim/2.]),(2,[x+rim/2.,y,z+rim],[x+rim/2.,y,z+d-rim]),(3,[x+w-rim/2.,y,z+rim],[x+w-rim/2.,y,z+d-rim])]{out.push(member(format!("{}-R{}",id,i),"Panel LSL rim board","16 in LSL rim board",a,b,1.125/12.,16./12.));}
 }}out
}
fn rows<'a>(m:&'a Value)->Vec<&'a Value>{m["levels"].as_array().map(|v|v.iter().collect()).unwrap_or_else(||vec![m])}
/// Clip roof planes to conditioned wall lines, so garages, porches and
/// overhangs cannot inflate the house's batt quantities.
pub fn roof_panel_area(c:&Config,m:&Value)->f64{
 let mut total=0.;
 let facets=m["roof"]["facets"].as_array().into_iter().flatten().chain(m["dormers"].as_array().into_iter().flatten().flat_map(|d|d["facets"].as_array().into_iter().flatten()));
 for facet in facets{
  let mut pts:Vec<[f64;2]>=facet["points"].as_array().unwrap().iter().map(|p|[p[0].as_f64().unwrap(),p[2].as_f64().unwrap()]).collect();
  for (axis,bound,greater) in [(0,0.,true),(0,c.width,false),(1,0.,true),(1,c.depth,false)]{
   let old=pts;pts=vec![];if old.is_empty(){break}
   for i in 0..old.len(){let a=old[i];let b=old[(i+1)%old.len()];let inside=|p:[f64;2]|if greater{p[axis]>=bound}else{p[axis]<=bound};
    if inside(a){pts.push(a)}if inside(a)!=inside(b){let t=(bound-a[axis])/(b[axis]-a[axis]);pts.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
   }
  }
  if pts.len()<3{continue}let area=(0..pts.len()).map(|i|{let a=pts[i];let b=pts[(i+1)%pts.len()];a[0]*b[1]-b[0]*a[1]}).sum::<f64>().abs()/2.;
  let a=facet["plane"][0].as_f64().unwrap();let b=facet["plane"][1].as_f64().unwrap();total+=area*(1.+a*a+b*b).sqrt();
 }total
}
fn partition_sound(c:&Config,level:&Value,ws:&[Wall],rs:&[Room])->f64{
 if !c.interior_sound{return 0.}let mut members=frame::build(ws,c);let furniture:Vec<staging::Furniture>=serde_json::from_value(level["furniture"].clone()).unwrap_or_default();frame::add_backing(&mut members,ws,c,&furniture);let faces=level["wallFaces"].as_array().unwrap();let mut total=0.;
 for wall in ws.iter().filter(|w|!w.exterior){
  let mut runs:Vec<_>=faces.iter().filter(|f|s(f,"wallId")==wall.id&&rs.iter().any(|r|s(f,"roomId")==r.id&&["bedroom","bath"].contains(&r.kind.as_str()))).map(|f|(n(f,"at"),n(f,"at")+n(f,"length"))).collect();runs.sort_by(|a,b|a.0.total_cmp(&b.0));
  let mut merged:Vec<(f64,f64)>=vec![];for(a,b)in runs{if let Some(last)=merged.last_mut(){if a<=last.1+1e-8{last.1=last.1.max(b);continue}}merged.push((a,b));}
  for(a,b)in merged{let mut segment=wall.clone();segment.exterior=true;segment.length=b-a;if wall.axis=="x"{segment.x+=a}else{segment.z+=a}
   segment.openings=wall.openings.iter().filter_map(|o|{let lo=o.at.max(a);let hi=(o.at+o.width).min(b);if hi<=lo{return None}let mut o=o.clone();o.at=lo-a;o.width=hi-lo;Some(o)}).collect();
   total+=frame::cavity(&[segment],&members,c.wall_height);
  }
 }total
}
pub fn apply(c:&Config,mut m:Value)->Value{
 let footprint=c.width*c.depth;let perimeter=2.*(c.width+c.depth);let floor_area=n(&m,"area");
 let upper_area=if c.stories>=2{(floor_area-footprint).max(0.)}else{0.};
 let main_ceiling=roof_panel_area(c,&json!({"roof":m["roof"]}));
 let roof_ceiling=roof_panel_area(c,&m);let lower_ceiling=if c.stories>=2{upper_area}else{0.};
 m["drywallCeiling"]=json!(round(roof_ceiling+lower_ceiling+if m["garage"].is_object(){576.}else{0.}));
 m["drywallTotal"]=json!(round(n(&m,"drywallWalls")+n(&m,"drywallCeiling")));
 if let Some(i)=m["items"].as_array_mut().unwrap().iter_mut().find(|i|s(i,"id")=="drywallceiling"){
  i["rawNet"]=json!((main_ceiling+lower_ceiling)/64.);i["name"]=json!("5/8 in pre-painted roof / lower-floor ceiling drywall · 4 × 16 ft");i["basis"]=json!("Clipped sloped roof-panel area inside house wall lines, plus flat ceiling under an upper floor with the stairwell deducted. Dormer ceilings and garage ceiling are counted separately.");pricing::recalc_item(i,c);
 }
 let ground=first_floor(c);let joists:Vec<_>=ground.iter().filter(|p|s(p,"role")=="Crawlspace floor I-joist").collect();
 let mut t=Takeoff{items:vec![],c};
 macro_rules! add{($id:expr,$cat:expr,$name:expr,$net:expr,$unit:expr,$price:expr,$basis:expr,$whole:expr)=>{t.add($id,$cat,$name,$net as f64,$unit,$price,$basis,"Panel assembly estimate",true,$whole)};}
 let mut stocks:BTreeMap<usize,usize>=BTreeMap::new();for j in &joists{*stocks.entry(n(j,"stockLength")as usize).or_default()+=1;}
 for(stock,qty)in stocks{add!(&format!("crawl-joist{}",stock),"Floor framing",&format!("16 in crawlspace I-joist · {} ft stock",stock),qty,"pieces",stock as f64*7.5,"16-in stations in each cut-to-fit 16 × 32 panel, including its two edge joists; series, bearings and support design pending.",true);}
 add!("crawl-rim","Floor framing","16 in LSL panel rim board",ground.iter().filter(|p|s(p,"role")=="Panel LSL rim board").map(|p|n(p,"length")).sum::<f64>(),"linear ft",6.5,"Four panel edges, including paired rims at factory module joins.",false);
 add!("crawl-bottom","Floor panels","7/16 in OSB crawlspace bottom board · 4 × 8",footprint/32.,"sheets",16.5,"Full panel bottom; foam protection details and crawlspace access conditions require local review.",true);
 add!("crawl-polyiso","Floor panels","1 in foil-faced polyiso · 4 × 8",footprint/32.,"sheets",29.,"Continuous layer below I-joists; no thermal value credited without the selected product.",true);
 add!("crawl-foiltape","Floor panels","Polyiso foil seam tape · 150 ft roll",footprint*0.375/150.,"rolls",21.,"4 × 8 panel grid joint allowance; approved foil tape and laps pending.",true);
 for (id,r,price) in [("crawl-r30",30,1.25),("crawl-r19",19,0.85)]{add!(id,"Insulation",&format!("Crawlspace R-{} unfaced fiberglass batts · 16 in O.C.",r),footprint,"sq ft of batts",price,"Each of the two layers covers the first-floor footprint; framing cuts are retained in ordering. Product thickness, compression and contact with subfloor require verification.",false);}
 add!("crawl-subfloor","Floor panels","23/32 in AdvanTech T&G subfloor · 4 × 8",footprint/32.,"sheets",59.,"First-floor surface only; upper-floor sheets are counted separately.",true);
 add!("crawl-glue","Floor panels","Subfloor adhesive · 28 oz",footprint/48.,"tubes",8.,"Glue-nailed assembly; manufacturer coverage allowance.",true);
 add!("crawl-nails","Fasteners","Subfloor ring-shank nails · 2,000 pack",footprint*2.5/2000.,"packs",62.,"Estimated 2.5 fasteners/sq ft; final edge and field schedule pending.",true);
 add!("crawl-bottomfixings","Fasteners","Bottom board / foam retention screw and washer kits",footprint/32.,"kits",9.,"One kit per 4 × 8 bottom panel; attachment detail pending.",true);
 add!("crawl-bearing","Floor framing","Crawlspace joist bearing / connector sets",joists.len()*2,"sets",18.,"Two per modeled joist; supplier connection and panel assembly details pending.",true);
 if c.foundation==piers::CONCRETE{
 add!("crawl-sill","Foundation","Treated foundation sill · 2×6",perimeter,"linear ft",1.5,"Separate foundation sill beneath factory SPF wall/floor panels.",false);
 add!("crawl-sillseal","Foundation","Sill gasket · 50 ft roll",perimeter/50.,"rolls",13.,"Perimeter foundation joint.",true);
 add!("crawl-wall","Foundation","8 in crawlspace concrete stem wall · 3 ft estimating height",perimeter*(8./12.)*3./27.,"cu yd",180.,"Editable concept volume; soil, frost, reinforcing, crawl height and access require site design.",false);
 add!("crawl-rebar","Foundation","Crawlspace stem-wall reinforcement allowance",perimeter*4.,"linear ft",0.85,"Four estimating runs; this is not a reinforcement schedule.",false);
 add!("crawl-damp","Foundation","Foundation exterior dampproofing allowance",perimeter*3.,"sq ft",1.1,"Stem-wall concept surface; grading and drainage design pending.",false);
 let girder_lines=(c.width/16.).ceil()-1.;let girder_lf=girder_lines*c.depth;
 add!("crawl-girder","Foundation","Crawlspace panel-joint engineered girder allowance",girder_lf,"linear ft",32.,"Proposed girder under each 16-ft panel joint; sizing, reactions and foundations pending.",false);
 add!("crawl-piers","Foundation","Crawlspace girder pier / pad material allowance",girder_lines*((c.depth/8.).ceil()+1.),"sets",145.,"Proposed supports up to 8 ft apart; no load capacity assigned.",true);
 t.add("crawl-access","Foundation","Crawlspace access hatch / weather seals",1.,"set",160.,"One access assembly; ordering waste does not apply. Access size and location require local construction detailing.","Panel assembly estimate",false,true);
 }else{piers::add_items(&mut t,c);}
 t.add("crawl-moisture","Foundation","Crawlspace moisture / ventilation system allowance",1.,"set",650.,"One system allowance; ordering waste does not apply. Placeholder for an approved vented or conditioned crawlspace strategy; ground moisture control is not supplied by ZIP wall sheathing.","Panel assembly estimate",false,true);
 if !surfaces::tile(&c.floor).is_some(){add!("vinylunderlay","Interior","Vinyl underlayment · 1/4 in 4 × 8 panel",floor_area/32.,"sheets",24.,"All usable finished floors; staircase void deducted.",true);}
 let levels=rows(&m);let mut sound=0.;let mut furring=0.;let mut screen=0.;let mut joints=0.;let mut sleeve_count=0;
 for level in &levels{
  let ws:Vec<Wall>=serde_json::from_value(level["walls"].clone()).unwrap();
  let rs:Vec<Room>=serde_json::from_value(level["rooms"].clone()).unwrap();
  sound+=partition_sound(c,level,&ws,&rs);
  for wall in &ws{
   if wall.exterior{
    screen+=wall.length*2.;let runs=(c.wall_height/2.).ceil()+1.;furring+=wall.length*runs*(1.-2./48.);
   }
  }
  joints+=n(level,"drywallWalls")*(1./4.+1./16.);
  sleeve_count+=rs.iter().filter(|r|r.kind=="bath"||r.kind=="kitchen").count();
 }
 add!("soundinsulation","Insulation","R-13 unfaced bedroom / bath partition sound batts",sound,"sq ft",0.75,"Union of bedroom/bath partition cavities, less framing and openings; shared walls are counted once. Optional.",false);
 add!("floorsound","Insulation","Upper-floor R-19 unfaced sound batts",if c.upper_sound{upper_area}else{0.},"sq ft",0.85,"Optional upper-floor cavity layer; stairwell excluded.",false);
 add!("rainscreen","Exterior finishes","Horizontal 1×4 furring · 24 in O.C.",furring,"linear ft",0.85,"Full wall rows, including top / bottom; 2 in interruptions at each 4-ft drainage module. Opening cutouts/offcuts retained as stock allowance.",false);
 add!("rainscreen-screen","Exterior finishes","Rainscreen insect screen · top and bottom",screen,"linear ft",0.9,"Two screen runs along every exterior wall, including garage-facing envelope before separation review.",false);
 add!("rainscreen-fasteners","Fasteners","Furring structural screw allowance",furring/2.,"each",0.35,"At nominal 24-in stud intersections; metal siding attachment must be product-approved.",true);
 add!("panel-reveals","Interior","Pre-painted drywall joint batten / reveal strips",joints+(n(&m,"drywallCeiling")/16.)+n(&m["garage"],"wallArea")*(1./4.+1./16.),"linear ft",1.2,"4 × 16 board-grid joints with shared edges counted once; cutting/joint layout allowance, trim counted separately.",false);
 add!("panel-sleeves","Plumbing","Coordinated wet-wall floor sleeve sets",sleeve_count*2,"sets",16.,"Drain and supply sleeve coordination per wet room; no drilling through I-joist flanges assumed.",true);
 add!("panel-holeplates","Fasteners","Wire / pipe hole protector plate allowance",sleeve_count*6,"each",1.1,"Coordinated penetrations only; drilling and nail-plate locations require installation drawings.",true);
 add!("panel-nailers","Floor framing","Upper-floor partition / track LSL nailers",(1..c.stories).map(|f|n(&m["levels"][f],"partitionLength")).sum::<f64>(),"linear ft",2.75,"Continuous attachment allowance under upper partitions; track point loads need engineering.",false);
 let roof_area=n(&m["roof"],"area");let insulated_roof=roof_panel_area(c,&m);
 for(id,name,price) in if c.roof_insulation=="R-49"{vec![("atticinsulation","R-49 kraft-faced roof fiberglass · paper down",2.1)]}else{vec![("atticinsulation","R-38 high-density kraft-faced roof fiberglass · paper down",1.8),("roof-r11","R-11 unfaced roof overlay fiberglass",0.65)]}{add!(id,"Insulation",name,insulated_roof,"sq ft of batts",price,"Sloped roof area over conditioned footprint, excluding overhangs; only the innermost layer is faced. Installed R-value requires the selected product/thickness; R-46 is not assumed.",false);}
 let rafter_count=m["rafters"].as_array().map_or(0,Vec::len);let channel_count=rafter_count.saturating_sub(m["roof"]["facets"].as_array().map_or(0,Vec::len));
 add!("baffles","Insulation","Continuous roof vent baffles · minimum 1½ in channel",insulated_roof,"sq ft",0.65,"Continuous bay coverage from screened eave intake to exhaust; slope planes and intersections need installation details.",false);
 add!("roof-rimscreen","Roof ventilation","Screened eave / ridge rim vent openings",n(&m["roof"],"eaveLF")+n(&m["roof"],"ridgeLF"),"linear ft",2.,"Screened rim ventilation, separate from selected vent product NFA and ridge cap.",false);
 add!("roof-purlins","Roof framing","1×4 roof purlins · 24 in O.C.",roof_area/2.+n(&m["roof"],"eaveLF")+n(&m["roof"],"ridgeLF"),"linear ft",0.85,"Roof surface/2-ft row pitch plus end rows; closer eave/ridge spacing remains supplier-dependent.",false);
 let ice_area=(n(&m["roof"],"eaveLF")*3.+n(&m["roof"],"valleyLF")*3.).min(roof_area);
 add!("roof-icewater","Roof","Grace Ice & Water Shield · 200 sq ft roll",ice_area/200.,"rolls",225.,"3-ft eave and valley estimating strips; overlaps retained. Actual ice-barrier reach inside heated wall and metal compatibility must be specified.",true);
 add!("underlay","Roof","Metal-maker-required roof underlayment allowance",(roof_area-ice_area).max(0.),"sq ft",0.4,"Remaining roof area; omit or change unit rate only after the selected roofing manufacturer's written requirements.",false);
 let doors=levels.iter().flat_map(|l|l["walls"].as_array().unwrap()).filter(|w|w["exterior"]==true).flat_map(|w|w["openings"].as_array().unwrap()).filter(|o|s(o,"kind")=="door").count();
 add!("roof-snowguards","Roof","Snow-retention rail / door protection allowance",doors,"sets",125.,"One estimating set per exterior door; snow loads, rail placement and metal manufacturer attachment must be designed.",true);
 drop(levels);
 let floor_tile=surfaces::tile(&c.floor);
 let mut tiled_walls=0.;let mut custom_walls=0.;
 for (group,key,_wallkey) in [("bedroom","Bedroom","bedroomWallArea"),("general","Rest of house","generalWallArea")]{let area:f64=m["levels"].as_array().map(|ls|ls.iter().collect::<Vec<_>>()).unwrap_or_else(||vec![&m]).iter().flat_map(|l|l["wallFaces"].as_array().unwrap()).filter(|f|s(f,"group")==group&&f["roomOverride"]!=true).map(|f|n(f,"area")).sum();if let Some(pattern)=c.custom_textures.get(group){custom_walls+=area;add!(&format!("custom-{}",group),"Interior",&format!("{} custom wallpaper · {}",key,pattern.name),area,"sq ft",2.5,"Custom image is a visual pattern; price is an editable printed-wallcovering material allowance, not a supplier quote.",false);}
 else if let Some(tile)=c.wall_tiles.get(group).and_then(|name|surfaces::tile(name)){tiled_walls+=area;add!(&format!("tile-{}",group),"Interior",&format!("{} wall tile · {}",key,s(tile,"name")),area,"sq ft",n(tile,"price"),"All wall faces in the chosen room group, with openings deducted. Drywall remains the specified base; wet-area substrate design must be selected.",false);}}
 if custom_walls>0.{add!("custom-paste","Interior","Custom wallcovering adhesive / liner",custom_walls/250.,"kits",35.,"Custom patterned wallcovering installation allowance.",true);}
 let tile_floor=if floor_tile.is_some(){floor_area}else{0.};let tile_area=tile_floor+tiled_walls;
 if let Some(tile)=floor_tile{add!("tile-floor","Interior",&format!("Tile floor · {}",s(tile,"name")),tile_floor,"sq ft",n(tile,"price"),"All usable house floors, staircase void excluded; measured area plus selected ordering waste.",false);add!("tile-underlay","Interior","Tile floor backer / decoupling installation system",tile_floor,"sq ft",1.5,"Product-rated underlay over AdvanTech; verify joist/subfloor deflection for the chosen tile.",false);}
 if tile_area>0.{add!("tile-thinset","Interior","Tile mortar · 50 lb bags",tile_area/50.,"bags",26.,"50 sq ft/bag estimating coverage; trowel size and selected product determine actual coverage.",true);add!("tile-grout","Interior","Tile grout · 25 lb bags",tile_area/200.,"bags",32.,"200 sq ft/bag estimating coverage; tile size/joint depth determine final quantity.",true);add!("tile-edge","Interior","Tile edge / transition trim",tile_floor.sqrt()*4.+tiled_walls/c.wall_height,"linear ft",3.5,"Floor perimeter-equivalent plus selected wall-run termination allowance; detailed room transitions pending.",false);}
 m["foundation"]=piers::summary(c);m["tileFloorArea"]=json!(tile_floor);m["tileWallArea"]=json!(round(tiled_walls));m["customWallArea"]=json!(round(custom_walls));
 let concrete_only=["footings","footingrebar","rebarsupports","anchors","anchorwashers"];
 let removed=["slab","mesh","base","slabedge","slabjoints","sillgasket","soundinsulation","floorsound","floorinsulation","floor-batts","interior-batts","rainscreen","atticinsulation","baffles","underlay","compound","drywalltape","paint","primer","subfloorscrews","garage-compound","garage-drywalltape","garage-primer","garage-paint","ceilingjoists","ceilingsupport","ceilinghangers"];
 m["items"].as_array_mut().unwrap().retain(|i|!removed.contains(&s(i,"id"))&&!(c.foundation!=piers::CONCRETE&&concrete_only.contains(&s(i,"id")))&&!(floor_tile.is_some()&&["vinyl","adhesive","floorleveler"].contains(&s(i,"id"))));
 for i in m["items"].as_array_mut().unwrap(){match s(i,"id"){
  "roofmetal"=>{i["name"]=json!("29-gauge ribbed metal roofing");i["basis"]=json!("Actual roof planes including overhangs; material gauge, coatings and fastening require the selected roofing product.");},
  "siding" if c.siding=="Corrugated metal"=>i["name"]=json!("29-gauge ribbed metal siding"),
  "headerspacer"=>{i["name"]=json!("2 in rigid foam between exterior header plies");},
  "subfloor"=>i["name"]=json!("23/32 in AdvanTech T&G upper subfloor · 4 × 8"),
  "floorrim"=>i["name"]=json!("16 in LSL upper-floor rim board"),
  _=>{}
 }}
 m["items"].as_array_mut().unwrap().extend(t.items.iter().map(|i|serde_json::to_value(i).unwrap()));
 m["counts"]["drywallSheets"]=json!(m["items"].as_array().unwrap().iter().filter(|i|s(i,"unit")=="sheets"&&s(i,"name").contains("drywall")).map(|i|n(i,"qty")).sum::<f64>());
 m["ceilingBays"]=json!(0);m["ceilingJoists"]=json!(0);
 m["crawlFloorFrameMembers"]=json!(ground);m["panelAssemblies"]=definitions(c);
 m["insulationAssemblies"]=json!({"exteriorWalls":"R-21 kraft-faced batts; 7/16 ZIP, no house wrap; energy compliance requires selected site review","interiorWalls":"Optional R-13 unfaced bedroom/bath partition sound batts","floor":"Crawlspace: R-30 + R-19 unfaced, 1 in polyiso; upper: optional R-19 unfaced sound batts","roof":format!("{} batts; innermost kraft facing down; at least 1½ in continuous ventilation",c.roof_insulation),"facingReview":"Product thickness, compression, vapor control and adopted code must be verified; no installed R-46 assumption."});
 m["panelSummary"]=json!({"wallStudSpacingInches":24,"standardPrecutStudInches":92.625,"standardPlateHeightInches":97.125,"selectedWallHeightInches":c.wall_height*12.,"usesStandardPrecuts":near(c.wall_height,8.09375),"floorJoistDepthInches":16,"floorJoistSpacingInches":16,"roofJoistDepthInches":16,"roofJoistSpacingInches":16,"roofVentChannelInches":1.5,"roofBattAvailableDepthInches":14.5,"roofInstalledRValue":Value::Null,"roofBattsNameplateR":49,"wallSheathing":"7/16 ZIP","roofSheathing":"5/8 ZIP","drywallSheetAreaSqFt":64,"crawlFloorPanelCount":(c.width/16.).ceil()*(c.depth/32.).ceil(),"roofVentBayEstimate":channel_count,"review":"Factory dimensions are module references; boundary panels are cut to fit. Header tables, I-joist series, holes, bearings, vent flow, compression and local approval require product/site review."});
 if let Some(levels)=m["levels"].as_array_mut(){for level in levels{level["ceilingBays"]=json!(0);level["ceilingJoists"]=json!(0);level["panelAssemblies"]=definitions(c);if n(level,"floorIndex")==0.{level["crawlFloorFrameMembers"]=json!(ground);}}}
 let mut cats:BTreeMap<String,f64>=BTreeMap::new();for i in m["items"].as_array().unwrap(){*cats.entry(s(i,"category").into()).or_default()+=n(i,"total");}
 let subtotal=round(cats.values().sum());for total in cats.values_mut(){*total=round(*total)}m["categoryTotals"]=json!(cats);m["subtotal"]=json!(subtotal);m["tax"]=json!(round(subtotal*c.tax/100.));m["total"]=json!(round(subtotal+n(&m,"tax")));m
}
