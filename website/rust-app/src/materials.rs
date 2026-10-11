use crate::*;
use model::Takeoff;
// Every allowance states its estimating basis; local selections are not inferred.
pub fn extend(t:&mut Takeoff,c:&Config,rs:&[Room],ws:&[Wall],fs:&[staging::Furniture],area:f64,perimeter:f64,roof_area:f64,cladding:f64,partition:f64,electrical:&Value)->Value{
 let modeled=|kind:&str|fs.iter().filter(|f|f.kind==kind).count()as f64;
 let kitchens=modeled("kitchen");let baths=rs.iter().filter(|r|r.kind=="bath").count()as f64;
 let toilets=modeled("toilet");let basins=modeled("vanity")+modeled("double-vanity")*2.;let showers=modeled("shower")+modeled("bathtub");let laundry=modeled("laundry");let cabinet_lf:f64=fs.iter().filter(|f|f.kind=="kitchen"||f.kind=="island").map(|f|f.local_width).sum();
 macro_rules! allow{($id:expr,$cat:expr,$name:expr,$n:expr,$unit:expr,$price:expr,$basis:expr,$whole:expr)=>{t.add($id,$cat,$name,$n as f64,$unit,$price,$basis,"Allowance",true,$whole)}}
 macro_rules! count{($id:expr,$cat:expr,$name:expr,$n:expr,$price:expr,$basis:expr)=>{t.add($id,$cat,$name,$n as f64,"each",$price,$basis,"Basis count",false,true)}}
 let required=area/150.*144.;let roof=roof::build(c);let ridge_length=(n(&roof,"ridgeLF")-3.).max(0.);let ridge_nfa=ridge_length*c.ridge_vent_nfa;let cathedral=roof::cathedral(c);let boxes=if cathedral{0.}else{((required/2.-ridge_nfa).max(0.)/c.roof_vent_nfa-1e-9).max(0.).ceil()};let exhaust=ridge_nfa+boxes*c.roof_vent_nfa;let intake_units=(exhaust/c.soffit_vent_nfa-1e-9).max(0.).ceil();let intake=intake_units*c.soffit_vent_nfa;
 t.add("ridgevent","Roof ventilation","Continuous ridge vent insert",ridge_length,"linear ft",7.5,&format!("{:.2} in² NFA/ft selected product rating; heated ridge length only. Confirm rating and ridge slot detail.",c.ridge_vent_nfa),"Geometry / product-rating basis",false,false);
 count!("roofvents","Roof ventilation","Supplemental roof box vents",boxes,68.,&format!("{:.2} in² NFA each; covers exhaust shortfall beyond ridge vent for a 1:150 vented attic basis.",c.roof_vent_nfa));
 count!("soffitvents","Roof ventilation","Soffit intake vent inserts",intake_units,14.,&format!("{:.2} in² NFA each; intake at least exhaust. Net opening ratings and installation spacing must be confirmed.",c.soffit_vent_nfa));
 count!("ventscreen","Roof ventilation","Vent insect / weather screens",boxes+intake_units,3.5,"One per box/intake vent; omit if included in chosen product.");
 count!("attichatch","Insulation","Insulated attic access hatch & gasket",1.,150.,"One access assembly allowance; location, clear size and roof clearance pending.");
 allow!("sillgasket","Foundation","Sill gasket / capillary break",perimeter,"linear ft",0.45,"Exterior bottom-plate length; ZIP remains the exterior weather barrier.",false);
 allow!("footingrebar","Foundation","Footing rebar · 20 ft lengths",perimeter*2./20.,"bars",19.,"Two continuous bars, plus selected waste; bar size, laps and footing design require engineering.",true);
 allow!("rebarsupports","Foundation","Rebar ties / chairs",perimeter/3.,"sets",1.8,"One support set per 3 ft of concept footing; engineering allowance.",true);
 allow!("slabjoints","Foundation","Slab isolation / expansion joint",perimeter,"linear ft",0.9,"Perimeter isolation allowance; joint locations require slab design.",false);
 count!("anchorwashers","Foundation","Anchor bolt washers / nuts",(perimeter/6.).ceil()+8.,1.6,"One set per modeled anchor bolt; hardware grade and spacing pending.");
 allow!("termite","Foundation","Termite treatment material allowance",perimeter,"linear ft",1.2,"Perimeter basis; use only the locally required treatment and qualified application.",false);
 allow!("holddowns","Connections","Wall hold-down hardware",8.,"sets",95.,"Concept corner allowance only; final shear/uplift design determines count and rating.",true);
 allow!("framingadhesive","Fasteners","Construction adhesive · 28 oz",(perimeter+partition)/30.,"tubes",8.,"One tube per 30 ft of modeled walls; connection-product allowance.",true);
 allow!("metalclosure","Roof","Standing seam eave / ridge closures",n(&roof,"eaveLF")+n(&roof,"ridgeLF"),"linear ft",2.4,"Two eaves plus ridge; system-specific closures, overlaps and sealant pending.",false);
 allow!("roofsealant","Roof","Roof compatible sealant / butyl",(n(&roof,"eaveLF")+n(&roof,"rakeLF"))/30.,"tubes / rolls",12.,"One unit per 30 ft of roof perimeter trim; confirm manufacturer compatibility.",true);
 allow!("roofboots","Roof","Plumbing vent roof boots",(baths+kitchens).max(1.),"sets",32.,"One vent penetration per fitted wet group; routing may combine stacks.",true);
 allow!("guttermounts","Roof","Gutter hangers",n(&roof,"eaveLF")/2.,"each",3.,"2 ft nominal hanger spacing along both eaves; load/product schedule pending.",true);
 count!("gutterends","Roof","Gutter end caps & outlets",8.,8.,"Four caps and four outlets for the four modeled downspouts.");
 count!("downspoutstraps","Roof","Downspout straps / elbows",12.,7.,"Three assemblies per modeled downspout; height and discharge routing pending.");
 count!("splashblocks","Roof","Downspout splash blocks",4.,22.,"One per downspout; drainage design can replace with buried piping.");
 allow!("caulkexterior","Exterior finishes","Exterior joint sealant",(perimeter+ws.iter().filter(|w|w.exterior).flat_map(|w|&w.openings).map(|o|2.*(o.width+o.height)).sum::<f64>())/25.,"tubes",9.,"Perimeter and opening perimeter at 25 ft/tube; product-dependent allowance.",true);
 allow!("rainscreen","Exterior finishes","Rainscreen / furring strips",cladding/2.,"linear ft",0.75,"24 in support spacing allowance; cladding-specific support/vent detailing pending.",false);
 let doors:Vec<_>=ws.iter().flat_map(|w|w.openings.iter().filter(|o|o.kind=="door").map(move|o|(w,o))).collect();let exterior_doors=doors.iter().filter(|(w,_)|w.exterior).count();
 count!("doorstops","Openings","Door stops",doors.len(),6.,"One per modeled door; existing door line includes lock/hinge hardware.");
 count!("weatherstrip","Openings","Exterior door weather seals / thresholds",exterior_doors,45.,"One assembly per exterior door; credit any included in the selected door kit.");
 allow!("openingfoam","Openings","Low-expansion opening foam",ws.iter().flat_map(|w|&w.openings).count()as f64/3.,"cans",12.,"One can per three openings; product coverage allowance.",true);
 count!("windowscreens","Openings","Window insect screens",ws.iter().flat_map(|w|&w.openings).filter(|o|o.kind=="window").count(),28.,"One per modeled window; credit any included in the selected package.");
 allow!("cornerbead","Interior","Drywall corner bead · 8 ft sticks",(ws.len()as f64*2.*c.wall_height)/8.,"sticks",4.5,"Two vertical corner runs per wall segment; corner topology and bead type pending.",true);
 allow!("trimsealant","Interior","Trim caulk / wood filler",(perimeter+2.*partition)/80.,"tubes",6.,"One tube per 80 ft of trim; field-joint allowance.",true);
 allow!("floorleveler","Interior","Floor patch / leveling compound",area/200.,"bags",34.,"One bag per 200 sq ft concept allowance; actual slab condition determines usage.",true);
 allow!("floortransitions","Interior","Floor transition / threshold strips",doors.iter().map(|(_,o)|o.width).sum::<f64>(),"linear ft",4.,"One strip across each modeled door opening.",false);
 allow!("cabinetpulls","Kitchen & bath","Cabinet pulls / hinges allowance",(cabinet_lf/2.).ceil()*2.,"sets",10.,"Two hardware sets per nominal 2 ft cabinet module; base cabinets exclude accessories.",true);
 allow!("backsplash","Kitchen & bath","Kitchen backsplash finish",fs.iter().filter(|f|f.kind=="kitchen").map(|f|f.local_width*1.5).sum::<f64>(),"sq ft",9.,"18 in backsplash along modeled cabinet runs; islands excluded.",false);
 count!("bathmirrors","Kitchen & bath","Vanity mirrors",basins,95.,"One mirror per modeled vanity.");
 count!("bathaccessories","Kitchen & bath","Towel / toilet-paper accessories",toilets,75.,"One set per modeled toilet.");
 allow!("showerbacker","Kitchen & bath","Shower backer board",fs.iter().filter(|f|f.kind=="shower").map(|f|(2.*f.local_depth+f.local_width)*7.).sum::<f64>()/32.,"4 x 8 sheets",38.,"Three 7 ft shower walls; product and enclosure sides need detailing.",true);
 allow!("showerwaterproof","Kitchen & bath","Shower waterproofing / seam system",fs.iter().filter(|f|f.kind=="shower").map(|f|(2.*f.local_depth+f.local_width)*7.+f.local_width*f.local_depth).sum::<f64>(),"sq ft",2.4,"Three walls plus base; wet-area waterproofing is distinct from excluded vapor barriers.",false);
 allow!("showertile","Kitchen & bath","Shower wall tile / grout / setting material",fs.iter().filter(|f|f.kind=="shower").map(|f|(2.*f.local_depth+f.local_width)*7.).sum::<f64>(),"sq ft",7.5,"Three 7 ft shower walls; shower fixture kit excludes finishes.",false);
 count!("showerglass","Kitchen & bath","Shower door / curtain enclosure",showers,380.,"One per modeled shower; chosen enclosure type pending.");
 t.items.retain(|i|i.id!="appliances");
 count!("range","Appliances","Range / compact cooking appliance",kitchens,if area<144.{450.}else{950.},"One cooking appliance per modeled kitchen run.");
 count!("rangehood","Mechanical ventilation","Range hood",kitchens,350.,"One per kitchen run; capture, airflow and appliance clearances pending.");
 count!("dishwasher","Appliances","Dishwasher",if area<144.{0.}else{kitchens},650.,"One per modeled kitchen, excluded in micro studios.");
 count!("bathfan","Mechanical ventilation","Bathroom exhaust fan",baths,105.,"One per modeled bathroom; fan rating and ventilation design require confirmation.");
 count!("dryerhood","Mechanical ventilation","Dryer exhaust hood / connection",laundry,45.,"One per modeled laundry pair; duct path and equivalent length pending.");
 allow!("exhaustduct","Mechanical ventilation","Exhaust duct / fittings · caps separate",(baths+kitchens+laundry)*((c.width.min(c.depth)/2.).min(16.)+4.),"linear ft",4.2,"Wet/appliance group count times estimated nearest-exterior route plus 4 ft; actual routing pending.",false);
 count!("exhaustcaps","Mechanical ventilation","Dedicated exhaust termination caps",baths+kitchens,32.,"One per bath/kitchen exhaust; dryer cap separately counted.");
 let wet=wet_routes(c,fs);
 allow!("pexcold","Plumbing","Cold-water PEX distribution",wet.cold,"linear ft",1.2,"Manhattan path from front-center service entry to each fixture plus 4 ft/connection; piping design pending.",false);
 allow!("pexhot","Plumbing","Hot-water PEX distribution",wet.hot,"linear ft",1.2,"Concept routes for sinks, showers and laundry; toilets excluded.",false);
 allow!("dwvpipe","Plumbing","DWV drain / vent pipe",wet.drain,"linear ft",3.5,"Concept fixture routes plus one wall-height vent rise/fixture; sizes, slopes and routing pending.",false);
 count!("fixturestops","Plumbing","Fixture shutoff valves",toilets+2.*(kitchens+basins+laundry),12.,"One cold stop/toilet; hot/cold stops at sinks and laundry; shower mixing kits included in fixtures.");
 count!("ptraps","Plumbing","Sink / laundry traps",kitchens+basins+laundry,18.,"One per basin/laundry drain; shower trap included in shower fitting kit.");
 count!("waterheater","Plumbing","Water heater",1.,900.,"One equipment allowance; fuel, capacity and installation selection pending.");
 count!("waterheaterkit","Plumbing","Water-heater expansion / safety connection kit",1.,120.,"One kit allowance; actual expansion, relief/discharge and local details pending.");
 count!("watermainkit","Plumbing","Water service meter / main shutoff assembly",1.,220.,"One service-entry allowance; utility-supplied components may be credited.");
 allow!("pipefittings","Plumbing","Pipe fittings / clamps / supports",wet.connections*6.,"sets",5.,"Six concept fitting/support sets per fixture; exact fittings require routed drawings.",true);
 count!("servicepanel","Electrical distribution","Load center / main disconnect",1.,450.,"One concept panel; service rating and load calculation pending.");
 count!("grounding","Electrical distribution","Grounding / bonding material kit",1.,160.,"One system allowance; electrode type and conductor sizing require electrical design.");
 count!("circuitbreakers","Electrical distribution","Branch breaker / protection allowance",((area/150.).ceil()+wet.connections+4.).max(6.),38.,"Area branch allowance plus fixture/appliance groups; final circuits/protection pending.");
 allow!("branchwire","Electrical distribution","Branch cable / raceway allowance",area*0.7+n(electrical,"total")*8.,"linear ft",0.75,"0.7 ft/sq ft plus 8 ft/planned receptacle; routed circuits and conductor sizes pending.",false);
 count!("deviceboxes","Electrical distribution","Device / fixture boxes",n(electrical,"total")+rs.len()as f64+2.+rs.iter().filter(|r|r.kind!="hall").count()as f64+2.,3.,"Planned receptacles + switches + lights; service equipment boxes excluded.");
 count!("coverplates","Electrical distribution","Device cover plates",n(electrical,"total")+rs.len()as f64+2.,1.8,"Planned receptacles + switches; fixture trims included in lighting allowance.");
 count!("applianceoutlets","Electrical distribution","Dedicated appliance receptacle / disconnect allowance",kitchens*2.+modeled("fridge")+laundry*2.+1.,28.,"Cooking/dishwasher provision, refrigerator, laundry and water-heater provision; actual loads pending.");
 let supply_rooms=rs.iter().filter(|r|r.kind!="hall"&&r.kind!="bath").count()as f64;
 count!("hvacequipment","HVAC","Heating / cooling equipment allowance",(area/1800.).ceil().max(1.),2800.,"One provisional system/1,800 sq ft; not a capacity or Manual J/S result.");
 count!("hvacsupply","HVAC","Supply registers / boots",supply_rooms,30.,"One register per non-hall/non-bath room; airflow/room loads pending.");
 count!("hvacreturns","HVAC","Return grilles / filter boxes",(supply_rooms/4.).ceil().max(1.),65.,"One return allowance/four served rooms; pressure balance and layout pending.");
 allow!("hvacduct","HVAC","Supply duct / insulation / fittings",supply_rooms*(c.width.min(c.depth)/3.+5.),"linear ft",8.,"Served-room count times concept route length; Manual D and actual routing pending.",false);
 count!("thermostats","HVAC","Thermostats / controls",(area/1800.).ceil().max(1.),110.,"One per provisional equipment system.");
 allow!("hvacrefrigerant","HVAC","Refrigerant / condensate line sets",(area/1800.).ceil().max(1.)*(c.width.min(c.depth)/2.+8.),"linear ft",7.,"System count times concept outdoor-unit route; equipment/condensate details pending.",false);
 count!("wholehousevent","Mechanical ventilation","Whole-house ventilation equipment allowance",1.,650.,"One system allowance; selected method, required airflow and controls pending.");
 count!("closetshelving","Interior","Closet storage / rail kits",rs.iter().filter(|r|r.kind=="bedroom").count(),125.,"One storage allowance per bedroom; location and closet walls pending.");
 json!({"ratio":150,"requiredNfaSquareInches":required,"ridgeLength":ridge_length,"ridgeNfa":ridge_nfa,"boxVentCount":boxes,"exhaustNfa":exhaust,"intakeVentCount":intake_units,"intakeNfa":intake,"totalNfa":exhaust+intake,"passesArea":exhaust+intake+1e-8>=required,"passesBalance":intake+1e-8>=exhaust,"cathedral":cathedral,"basis":if cathedral{"Vented cathedral ceiling: each rafter bay breathes from soffit to ridge vent (box vents cannot reach the bays). IRC R806.2 1:150 basis; a short ridge may need an unvented (closed-cell foam) roof assembly instead."}else{"IRC R806.2 1:150 vented attic; no 1:300 exception assumed. Product NFA ratings and installation must be confirmed."},"source":"https://codes.iccsafe.org/s/IRC2021P3/chapter-8-roof-ceiling-construction/IRC2021P3-Pt03-Ch08-SecR806.2","roofArea":roof_area})
}
struct Wet{cold:f64,hot:f64,drain:f64,connections:f64}
fn wet_routes(c:&Config,fs:&[staging::Furniture])->Wet{let mut out=Wet{cold:0.,hot:0.,drain:0.,connections:0.};for f in fs.iter().filter(|f|["kitchen","vanity","double-vanity","shower","bathtub","toilet","laundry","dishwasher"].contains(&f.kind.as_str())){let route=(f.x-c.width/2.).abs()+f.z+4.;out.cold+=route;if f.kind!="toilet"{out.hot+=route}out.drain+=route+c.wall_height;out.connections+=1.;}out}
