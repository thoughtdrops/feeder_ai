use crate::*;
use crate::model::Takeoff;

const SIZE: f64 = 24.;
/// Garage frontage: 24 ft for two cars, 34 ft for three (a 16 ft double door plus a 9 ft single).
pub fn frontage(c: &Config) -> f64 { if c.garage_size == "Three-car" { 34. } else { SIZE } }
const DOOR: f64 = 16.;
const HEADER: f64 = 11.875 / 12.;

#[derive(Clone)]
struct Placement { x: f64, z: f64, left: bool, entry: Option<f64> }

/// A garage at (x, z) must not overlap an L or U wing that reaches past the side wall.
fn clear_of_wings(c: &Config, x: f64, z: f64) -> bool {
    crate::wings::rects(c).iter().all(|g| x + frontage(c) <= g.x + 1e-6 || x >= g.x + g.w - 1e-6 || z + SIZE <= g.z + 1e-6 || z >= g.z + g.d - 1e-6)
}

fn placement(c: &Config, rooms: &[Room]) -> Placement {
    if c.garage != "Attached" {
        let left=c.garage_side=="Left";return Placement { x: if left{-frontage(c)-8.}else{c.width+8.}, z: 0., left, entry: None };
    }
    // A garage the visitor positioned stays there; its door goes into the best room it borders.
    if let Some(z)=c.garage_offset{
        let left=c.garage_side=="Left";let z=((z/2.).round()*2.).clamp(-16.,(c.depth-8.).max(0.));
        let entry=rooms.iter().filter(|r|!["bedroom","stairs"].contains(&r.kind.as_str())&&near(if left{r.x}else{r.x+r.w},if left{0.}else{c.width})).filter_map(|r|{
            let lo=r.z.max(z).max(0.)+0.4;let hi=(r.z+r.d).min(z+SIZE).min(c.depth)-0.4;
            (hi-lo>=38./12.).then(||{let rank:f64=match r.kind.as_str(){"hall"=>0.,"flex"=>1.,"kitchen"=>2.,"living"|"studio"=>3.,"bath"=>5.,_=>4.};(rank,(r.z+r.d/2.-19./12.).clamp(lo,hi-38./12.))})
        }).min_by(|a,b|a.0.total_cmp(&b.0)).map(|v|v.1);
        return Placement{x:if left{-frontage(c)}else{c.width},z,left,entry};
    }
    if c.design_mode=="Blank slate" {
        let left=c.garage_side=="Left";
        let entry=rooms.iter().filter(|r|r.kind!="stairs"&&near(if left{r.x}else{r.x+r.w},if left{0.}else{c.width})).find_map(|r|{
            let lo=r.z.max(0.)+0.4;let hi=(r.z+r.d).min(SIZE).min(c.depth)-0.4;
            (hi-lo>=38./12.).then(||(r.z+r.d/2.-19./12.).clamp(lo,hi-38./12.))
        });
        return Placement{x:if left{-frontage(c)}else{c.width},z:0.,left,entry};
    }
    // Put the protected connection in a social/utility room, never a bedroom.
    // The garage can project forward of a small home instead of covering bedrooms.
    let mut candidates = vec![];
    for r in rooms.iter().filter(|r| !["bedroom", "bath", "stairs"].contains(&r.kind.as_str())) {
        for left in [false, true] {
            if c.garage_side!="Automatic"&&left!=(c.garage_side=="Left"){continue}
            if !(if left { near(r.x, 0.) } else { near(r.x + r.w, c.width) }) { continue }
            let z = grid(r.z + r.d - SIZE).clamp(-16., (c.depth - 8.).max(0.));
            if !clear_of_wings(c, if left { -frontage(c) } else { c.width }, z) { continue }
            let lo = r.z.max(z).max(0.) + 0.4;
            let hi = (r.z + r.d).min(z + SIZE).min(c.depth) - 0.4;
            if hi - lo < 38. / 12. { continue }
            let at = (r.z + r.d / 2. - 19. / 12.).clamp(lo, hi - 38. / 12.);
            let rank = match r.kind.as_str() { "hall" => 0., "flex" => 1., "kitchen" => 2., "living" | "studio" => 3., _ => 4. };
            // A garage over a bedroom's side wall takes away its windows (and its escape opening), so any
            // placement that leaves every bedroom its daylight wins over the best connecting room.
            let covered = rooms.iter().filter(|b| b.kind == "bedroom" && near(if left { b.x } else { b.x + b.w }, if left { 0. } else { c.width }) && b.z < z + SIZE && b.z + b.d > z.max(0.)).count() as f64;
            candidates.push((covered * 10000. + rank * 100. + r.z + if left { 0.1 } else { 0. }, Placement { x: if left { -frontage(c) } else { c.width }, z, left, entry: Some(at) }));
        }
    }
    candidates.sort_by(|a, b| a.0.total_cmp(&b.0));
    candidates.first().map(|v| v.1.clone()).unwrap_or(Placement { x: if c.garage_side=="Left"{-frontage(c)}else{c.width}, z: 0., left: c.garage_side=="Left", entry: None })
}

fn shared_range(c: &Config, p: &Placement) -> (f64, f64) { (p.z.max(0.), (p.z + SIZE).min(c.depth)) }
fn on_shared(c: &Config, p: &Placement, w: &Wall) -> bool {
    w.exterior && w.axis == "z" && near(w.x, if p.left { 0. } else { c.width })
}

pub fn prepare_walls(c: &Config, rooms: &[Room], mut walls: Vec<Wall>) -> Vec<Wall> {
    if c.garage != "Attached" || c.active_floor != 0 { return walls }
    let p = placement(c, rooms);
    let (lo, hi) = shared_range(c, &p);
    for w in walls.iter_mut().filter(|w| on_shared(c, &p, w)) {
        // Openings in a house/garage separation cannot remain exterior windows.
        w.openings.retain(|o| w.z + o.at + o.width <= lo || w.z + o.at >= hi);
        let moved=c.opening_overrides.get(&w.id).and_then(|os|os.iter().find(|o|o.id=="G-HOUSE-DOOR"));
        let at=moved.filter(|o|connection_error(o,w,c,rooms).is_none()).map(|o|w.z+o.at).or(p.entry);
        if let Some(at) = at {
            if at >= w.z + 0.4 && at + 38. / 12. <= w.z + w.length - 0.4 {
                w.openings.push(Opening { id: "G-HOUSE-DOOR".into(), kind: "door".into(), at: at - w.z, width: 38. / 12., bottom: 0., height: 82.5 / 12. });
            }
        }
        w.openings.sort_by(|a, b| a.at.total_cmp(&b.at));
    }
    walls
}

/// A connection stays on the actual shared wall and out of bedrooms, bathrooms
/// and stair approaches. Editing its position never relocates the garage.
pub fn connection_error(o:&Opening,w:&Wall,c:&Config,rooms:&[Room])->Option<String>{
    if o.id!="G-HOUSE-DOOR"{return None}
    let p=placement(c,rooms);let(lo,hi)=shared_range(c,&p);
    if c.garage!="Attached"||!on_shared(c,&p,w)||o.kind!="door"||o.width<38./12.-1e-8||!near(o.bottom,0.)||w.z+o.at<lo+0.4||w.z+o.at+o.width>hi-0.4{return Some("Keep the garage connection inside its shared wall, with a protected door at least 38 in wide in the rough opening.".into())}
    let a=w.z+o.at;let b=a+o.width;
    // IRC R302.5.1: no garage opening into a room used for sleeping; stair runs stay clear for safety.
    if rooms.iter().any(|r|["bedroom","stairs"].contains(&r.kind.as_str())&&near(if p.left{r.x}else{r.x+r.w},w.x)&&a<r.z+r.d&&b>r.z){return Some("A garage door can't open into a bedroom (IRC R302.5.1) or onto a stair run.".into())}
    None
}

/// Door centers (ft from the house front) where the house-garage door may go, as continuous spans.
pub fn connection_spans(c:&Config,rooms:&[Room],walls:&[Wall])->Vec<(f64,f64)>{
    let Some(w)=walls.iter().find(|w|w.openings.iter().any(|o|o.id=="G-HOUSE-DOOR"))else{return vec![]};
    let mut spans:Vec<(f64,f64)>=vec![];let mut k=0;
    loop{let center=w.z+k as f64*0.25;if center>w.z+w.length{break}k+=1;let mut os=w.openings.clone();let o=os.iter_mut().find(|o|o.id=="G-HOUSE-DOOR").unwrap();o.at=center-w.z-o.width/2.;
        if rules::opening_error(&os,w,c,rooms).is_none(){match spans.last_mut(){Some(s) if (center-s.1-0.25).abs()<1e-6=>s.1=center,_=>spans.push((center,center))}}}
    spans
}
/// Move the house-garage door to `center`. A blocked spot snaps to the nearest allowed one; the note
/// says so. Errors only when no spot on the shared wall can take the door.
pub fn move_connection(c:&mut Config,rooms:&[Room],walls:&[Wall],center:f64)->Result<Option<String>,String>{
    let Some(w)=walls.iter().find(|w|w.openings.iter().any(|o|o.id=="G-HOUSE-DOOR"))else{return Err("No shared house / garage doorway fits this layout.".into())};
    if !center.is_finite(){return Err("Enter the door position in feet from the front of the house.".into())}
    let spans=connection_spans(c,rooms,walls);if spans.is_empty(){return Err("No spot on the shared wall can take the door. Move the garage or change the adjoining rooms.".into())}
    let target=spans.iter().map(|&(a,b)|center.clamp(a,b)).min_by(|x,y|(x-center).abs().total_cmp(&(y-center).abs())).unwrap();
    let mut os=w.openings.clone();let o=os.iter_mut().find(|o|o.id=="G-HOUSE-DOOR").unwrap();o.at=target-w.z-o.width/2.;
    if let Some(error)=rules::opening_error(&os,w,c,rooms){return Err(error)}
    c.opening_overrides.insert(w.id.clone(),os);
    Ok(((target-center).abs()>0.1).then(||format!("Moved to the nearest allowed spot, {:.2} ft from the front: a garage door can't open into a bedroom or onto a stair run.",target)))
}

pub fn shared_area(c: &Config, rooms: &[Room], walls: &[Wall]) -> f64 {
    if c.garage != "Attached" || c.active_floor != 0 { return 0. }
    let p = placement(c, rooms); let (lo, hi) = shared_range(c, &p);
    walls.iter().filter(|w| on_shared(c, &p, w)).map(|w| {
        let a = lo.max(w.z); let b = hi.min(w.z + w.length);
        ((b - a).max(0.) * c.wall_height - w.openings.iter().map(|o| {
            ((b.min(w.z + o.at + o.width) - a.max(w.z + o.at)).max(0.)) * o.height
        }).sum::<f64>()).max(0.)
    }).sum()
}

fn roof(c: &Config, attached: bool, left: bool) -> Value {
    let h = c.wall_height; let slope = c.pitch / 12.; let wd = frontage(c); let mid = wd / 2.;
    let xmin = if attached && !left { 0. } else { -1.5 };
    let xmax = if attached && left { wd } else { wd + 1.5 };
    let height = |x: f64| h + x.min(wd - x) * slope;
    let mut rafters = vec![];
    for i in 0..=18 {
        for (side, a, b) in [("Left", xmin, mid), ("Right", mid, xmax)] {
            let length = (b - a) * (1. + slope * slope).sqrt();
            rafters.push(json!({"id":format!("G-R{}-{}",side,i),"x1":a,"x2":b,"x":a,"z1":i as f64*(16./12.),"z2":i as f64*(16./12.),"y1":height(a),"y2":height(b),"length":length,"stockLength":(length/2.).ceil()*2.,"side":side,"bay":1}));
        }
    }
    let mut edges = vec![json!({"a":[mid,height(mid),-1.5],"b":[mid,height(mid),25.5],"kind":"ridge","length":27.})];
    for x in [xmin, xmax] { edges.push(json!({"a":[x,height(x),-1.5],"b":[x,height(x),25.5],"kind":"eave","length":27.})); }
    for z in [-1.5, 25.5] { for (a,b) in [(xmin,mid),(mid,xmax)] { edges.push(json!({"a":[a,height(a),z],"b":[b,height(b),z],"kind":"rake","length":(b-a)*(1.+slope*slope).sqrt()})); } }
    json!({"type":"Front gable","facets":[{"id":"G-left","points":[[xmin,height(xmin),-1.5],[mid,height(mid),-1.5],[mid,height(mid),25.5],[xmin,height(xmin),25.5]],"plane":[slope,0.,0.]},{"id":"G-right","points":[[mid,height(mid),-1.5],[xmax,height(xmax),-1.5],[xmax,height(xmax),25.5],[mid,height(mid),25.5]],"plane":[-slope,0.,wd*slope]}],"profiles":[{"x":0.,"z":0.,"axis":"x","points":[[0.,0.],[mid,mid*slope],[wd,0.]]},{"x":0.,"z":24.,"axis":"x","points":[[0.,0.],[mid,mid*slope],[wd,0.]]}],"edges":edges,"supports":[],"rafters":rafters,"area":(xmax-xmin)*27.*(1.+slope*slope).sqrt(),"rise":mid*slope,"infillArea":mid*mid*2.*slope,"ridgeLF":27.,"eaveLF":54.,"rakeLF":2.*(xmax-xmin)*(1.+slope*slope).sqrt()})
}

fn move_roof(v: &mut Value, p: &Placement) {
    for f in v["facets"].as_array_mut().unwrap() { for pt in f["points"].as_array_mut().unwrap() { pt[0] = json!(pt[0].as_f64().unwrap()+p.x); pt[2] = json!(pt[2].as_f64().unwrap()+p.z); } let a=f["plane"][0].as_f64().unwrap();let b=f["plane"][1].as_f64().unwrap();f["plane"][2]=json!(f["plane"][2].as_f64().unwrap()-a*p.x-b*p.z); }
    for e in v["edges"].as_array_mut().unwrap() { for key in ["a","b"] { e[key][0]=json!(e[key][0].as_f64().unwrap()+p.x);e[key][2]=json!(e[key][2].as_f64().unwrap()+p.z); } }
    for f in v["profiles"].as_array_mut().unwrap() { f["x"]=json!(n(f,"x")+p.x);f["z"]=json!(n(f,"z")+p.z); }
    for r in v["rafters"].as_array_mut().unwrap() { for key in ["x","x1","x2"] {r[key]=json!(n(r,key)+p.x);}for key in ["z1","z2"] {r[key]=json!(n(r,key)+p.z);} }
}

pub fn apply(c: &Config, mut m: Value) -> Value {
    if c.garage == "None" { m["garage"]=Value::Null; return m }
    let mut ground_c=c.clone();ground_c.active_floor=0;
    let (rooms, _)=layout(&ground_c);let p=placement(&ground_c,&rooms);let attached=c.garage=="Attached";
    let mut gc=c.clone();gc.garage="None".into();gc.width=frontage(c);gc.depth=SIZE;gc.wall_height=c.wall_height.max(9.);gc.pitch=c.pitch.clamp(3.,6.);gc.home_style="Craftsman".into();gc.stories=1;gc.active_floor=0;
    let wd=frontage(c);let area=wd*SIZE;let three=wd>SIZE;let h=gc.wall_height; let (lo,hi)=shared_range(c,&p);let shared=if attached{(hi-lo).max(0.)}else{0.};
    let mut ws=vec![];
    for (id,name,x,z,len,axis) in [("G1","Garage front",0.,0.,wd,"x"),("G2","Garage rear",0.,24.,wd,"x")] {
        ws.push(Wall{id:id.into(),name:name.into(),x,z,length:len,axis:axis.into(),exterior:true,openings:vec![]});
    }
    ws[0].openings.push(Opening{id:"G-OVERHEAD".into(),kind:"door".into(),at:4.,width:DOOR,bottom:0.,height:7.});
    // The third bay gets its own 9 ft single door beside the double.
    if three{ws[0].openings.push(Opening{id:"G-OVERHEAD-2".into(),kind:"door".into(),at:22.5,width:9.,bottom:0.,height:7.});}
    for (id,x) in [("G3",0.),("G4",wd)] {
        let inner=attached && ((p.left && x==wd)||(!p.left&&x==0.));
        let intervals=if inner{vec![(0.,lo-p.z),(hi-p.z,SIZE)]}else{vec![(0.,SIZE)]};
        for (index,(start,end)) in intervals.into_iter().enumerate(){if end-start>0.01{ws.push(Wall{id:format!("{}{}",id,if inner{index.to_string()}else{String::new()}),name:if inner{"Garage exposed return"}else if x==0.{"Garage left"}else{"Garage right"}.into(),x,z:start,length:end-start,axis:"z".into(),exterior:true,openings:vec![]});}}
    }
    let outside=ws.iter_mut().find(|w|w.axis=="z"&&near(w.x,if p.left{0.}else{wd})).unwrap();
    outside.openings.push(Opening{id:"G-SERVICE".into(),kind:"door".into(),at:18.,width:38./12.,bottom:0.,height:82.5/12.});
    outside.openings.push(Opening{id:"G-WINDOW".into(),kind:"window".into(),at:8.,width:4.,bottom:3.,height:3.});
    let mut members=frame::build(&ws,&gc);
    // A double garage opening needs continuous engineered header geometry.
    // Never splice the base house's 16-ft 2x8 placeholder across this opening.
    members.retain(|v| !(v.opening_id.as_deref()==Some("G-OVERHEAD")&&v.role=="Header ply"));
    for member in members.iter_mut().filter(|v|v.opening_id.as_deref()==Some("G-OVERHEAD")) {
        if member.role=="Cripple" { member.y1=7.+HEADER;member.length=(h-0.25-member.y1).max(0.);member.y2=member.y1+member.length; }
        if member.role=="King" {member.x1+=if member.x1<12.{-0.125}else{0.125};member.x2=member.x1;}
    }
    members.retain(|v|v.length>0.015);
    for (i,x) in [3.8125,20.1875].into_iter().enumerate(){members.push(frame::Member{id:format!("G1-JACK-{}",i),wall_id:"G1".into(),opening_id:Some("G-OVERHEAD".into()),role:"Jack".into(),material:if c.stud_type=="LSL studs"{"LSL 2x6"}else{"2x6"}.into(),group:"Exterior framing".into(),x1:x,y1:0.125,z1:0.,x2:x,y2:7.,z2:0.,width:0.125,depth:5.5/12.,length:6.875,stock_length:8.});}
    for (i,z) in [-0.15,0.15].into_iter().enumerate(){members.push(frame::Member{id:format!("G1-LVL-{}",i),wall_id:"G1".into(),opening_id:Some("G-OVERHEAD".into()),role:"Header ply".into(),material:"LVL 1.75x11.875 · provisional".into(),group:"Exterior framing".into(),x1:3.75,y1:7.+HEADER/2.,z1:z,x2:20.25,y2:7.+HEADER/2.,z2:z,width:1.75/12.,depth:HEADER,length:16.5,stock_length:18.});}
    let perimeter=2.*(wd+SIZE)-shared;let opening_area: f64=ws.iter().flat_map(|w|&w.openings).map(|o|o.width*o.height).sum();
    let local_roof=roof(&gc,attached,p.left);let roof_area=n(&local_roof,"area");let wall_area=perimeter*h-opening_area;let cladding=wall_area+n(&local_roof,"infillArea");
    let opening_lf:f64=ws.iter().flat_map(|w|&w.openings).map(|o|2.*(o.width+o.height)).sum();
    let ground=if let Some(levels)=m["levels"].as_array(){levels[0].clone()}else{m.clone()};
    let house_walls:Vec<Wall>=serde_json::from_value(ground["walls"].clone()).unwrap();
    let connection=house_walls.iter().flat_map(|w|w.openings.iter()).any(|o|o.id=="G-HOUSE-DOOR");
    let shared_net=shared_area(&ground_c,&rooms,&house_walls);
    let mut shared_walls=vec![];
    if attached{for w in house_walls.iter().filter(|w|on_shared(c,&p,w)){let start=lo.max(w.z);let end=hi.min(w.z+w.length);if end<=start{continue}let mut wall=w.clone();wall.z=start;wall.length=end-start;wall.name="Protected house / garage separation".into();wall.openings.retain(|o|w.z+o.at>=start&&w.z+o.at+o.width<=end);for o in &mut wall.openings{o.at+=w.z-start;}shared_walls.push(wall);}}
    let mut t=Takeoff{items:vec![],c};
    macro_rules! allowance {($id:expr,$name:expr,$net:expr,$unit:expr,$rate:expr,$basis:expr)=>{t.add($id,"Garage",$name,$net as f64,$unit,$rate as f64,$basis,"Allowance",true,true)};}
    macro_rules! count {($id:expr,$name:expr,$net:expr,$unit:expr,$rate:expr,$basis:expr)=>{t.add($id,"Garage",$name,$net as f64,$unit,$rate as f64,$basis,"Modeled count",false,true)};}
    t.add("garage-slab","Garage","Garage 4 in concrete slab",area/81.,"cu yd",180.,&format!("{} × 24 ft slab; slab thickness, reinforcement, frost/soil and slope to vehicle opening require site design.",wd),"Allowance",true,false);
    t.add("garage-footings","Garage","Garage perimeter footing concrete",perimeter*2./27.,"cu yd",180.,"24 × 12 in concept strip below new garage walls; house shared wall is counted once.","Allowance",true,false);
    t.add("garage-base","Garage","Garage 4 in compacted aggregate",area/81.,"cu yd",55.,"Compacted volume; earthwork and grading excluded.","Allowance",true,false);
    allowance!("garage-reinforcing","Garage slab reinforcing mesh",area,"sq ft",0.65,"Reinforcement is a concept allowance, not structural design.");
    count!("garage-anchors","Garage anchor bolts",(perimeter/6.).ceil()+8.,"each",5,"Concept spacing; portal-frame anchorage and wind/shear design pending.");
    let mut buckets:BTreeMap<(String,usize,bool),usize>=BTreeMap::new();
    for v in &members{*buckets.entry((v.material.clone(),v.stock_length as usize,v.role=="Bottom plate")).or_default()+=1;}
    for((mat,stock,treated),qty)in buckets{let engineered=mat.starts_with("LVL");let id=security::item_id(&format!("garage-frame-{}-{}-{}",mat,stock,treated));let rate=if engineered{8.}else if mat=="LSL 2x6"{1.8}else if mat=="2x12"{2.4}else if mat=="2x10"{2.0}else if treated{1.5}else{1.1};allowance!(&id,&format!("Garage {}{} · {} ft stock",if treated{"treated "}else{""},mat,stock),qty,"boards",stock as f64*rate,"One stock blank per enumerated piece; no offcut reuse. Overhead LVL header size, jambs and connections are provisional, requiring an engineer.");}
    allowance!("garage-nails","Garage framing nails · 50 lb",perimeter/220.,"boxes",65,"New wall length allowance.");
    let mut rafter_stock:BTreeMap<usize,usize>=BTreeMap::new();for r in local_roof["rafters"].as_array().unwrap(){*rafter_stock.entry(n(r,"stockLength")as usize).or_default()+=1;}
    for(stock,qty)in rafter_stock{allowance!(&format!("garage-rafters{}",stock),&format!("Garage I-joist rafters · {} ft stock",stock),qty,"pieces",stock as f64*6.5,"38 enumerated 16-in-deep slope rafters at 16 in O.C.; series, bearing and capacity require engineering.");}
    allowance!("garage-ridgebeam","Garage engineered ridge beam",27.,"linear ft",32,"Clear vehicle bay; end bearing/load path into gable and overhead header require engineering.");
    count!("garage-rafterhangers","Garage I-joist rafter connectors",76,"sets",16,"Two bearing connections per enumerated rafter; product detailing pending.");
    allowance!("garage-blocking","Garage roof blocking / web stiffeners",76,"sets",13.5,"Rafter bearing-line allowance.");
    allowance!("garage-ceilingjoists",&format!("Garage ceiling I-joists · {} ft stock",(wd/2.).ceil()*2.),19,"pieces",(wd/2.).ceil()*2.*5.5,"19 clear-span joists at 16 in O.C.; no center post obstructs parking. Product series/depth and capacity must be selected by an engineer.");
    count!("garage-ceilinghangers","Garage ceiling joist connections",38,"sets",14,"Two bearing sets per ceiling joist; no trusses.");
    allowance!("garage-zipwall","Garage ZIP 7/16 in wall panels · 4 × 8 ft",cladding/32.,"sheets",39,"New exterior walls and two gables; shared house wall excluded.");
    allowance!("garage-ziproof","Garage ZIP 5/8 in roof panels · 4 × 8 ft",roof_area/32.,"sheets",54,"Actual gable planes; 18 in overhangs with no overhang into the attached house.");
    allowance!("garage-ziptape","Garage ZIP flashing tape · 90 ft roll",((perimeter*h+n(&local_roof,"infillArea")+roof_area)*0.375+perimeter+opening_lf)/90.,"rolls",35,"Panel seams, corners and rough opening perimeters.");
    allowance!("garage-zipstretch","Garage ZIP stretch tape · 20 ft roll",ws.iter().flat_map(|w|&w.openings).map(|o|o.width+2.).sum::<f64>()/20.,"rolls",88,"Rough sills with return allowance.");
    allowance!("garage-zipliquid","Garage ZIP liquid flashing · 20 oz",perimeter/30.,"tubes",29,"Transitions and penetrations.");
    allowance!("garage-sheathingnails","Garage sheathing nails · 2,000 pack",(cladding+roof_area)*2.5/2000.,"packs",75,"Engineering fastener schedule pending.");
    allowance!("garage-siding",&format!("Garage {} siding",c.siding),cladding,"sq ft",catalog()["claddingPrices"][&c.siding].as_f64().unwrap_or(4.5),"Matches the house; no cladding on the shared wall.");
    allowance!("garage-sidingtrim","Garage starter, corner and opening trim",perimeter+8.*h+opening_lf,"linear ft",2.2,"Opening and wall transition allowance.");
    allowance!("garage-sidingscrews","Garage siding screws · 250 pack",cladding*1.5/250.,"packs",22,"Product fastening schedule pending.");
    allowance!("garage-roofmetal","Garage standing seam metal roof",roof_area,"sq ft",4.2,"Actual roof plane area, matching house roof color.");
    allowance!("garage-roofclips","Garage metal roof clips / screws",roof_area/2.,"sets",0.45,"Product schedule pending.");
    allowance!("garage-underlay","Garage roof underlayment / ice barrier allowance",roof_area,"sq ft",0.6,"Roofing and local ice protection requirements pending.");
    allowance!("garage-ridgecap","Garage ridge cap",27.,"linear ft",8,"Vented ridge insert counted separately.");
    allowance!("garage-raketrim","Garage rake / eave trim",54.+n(&local_roof,"rakeLF"),"linear ft",3.5,"Enumerated roof edges.");
    allowance!("garage-soffit","Garage soffit",if attached{(wd+1.5)*27.-area}else{(wd+3.)*27.-area},"sq ft",3,"Plan overhang area, excluding the attached side.");
    allowance!("garage-gutters","Garage gutters",if attached{27.}else{54.},"linear ft",5,"Attached side uses wall flashing rather than a hidden gutter.");
    count!("garage-downspouts","Garage downspouts",if attached{2}else{4},"each",60,"Two per exposed eave.");
    if attached{allowance!("garage-wallflashing","Garage / house roof step and counterflashing",24.,"linear ft",12,"Roof-to-wall junction; existing roof intersection and water management need construction detailing.");}
    let nfa=area*144./150.;let exhaust=nfa/2.;let ridge_len=(exhaust/c.ridge_vent_nfa).min(24.);let box_vents=((exhaust-ridge_len*c.ridge_vent_nfa).max(0.)/c.roof_vent_nfa).ceil();let exhaust_actual=ridge_len*c.ridge_vent_nfa+box_vents*c.roof_vent_nfa;let intake=(exhaust_actual/c.soffit_vent_nfa).ceil();
    allowance!("garage-ridgevent","Garage ridge vent insert",ridge_len,"linear ft",8,"1:150 attic NFA basis, using selected product ratings.");count!("garage-boxvents","Garage roof box vents",box_vents,"each",35,"Supplemental exhaust when selected ridge product cannot supply half of NFA.");count!("garage-soffitvents","Garage soffit intake vents",intake,"each",12,"Balanced intake using selected product NFA; installation review pending.");
    allowance!("garage-drywall","Garage 1/2 in pre-painted wall drywall · 4 × 16 ft",(wall_area+shared_net)/64.,"sheets",34,"Finished garage-side new walls plus attached house separation, less openings. No habitable rooms above garage.");
    allowance!("garage-ceilingdrywall","Garage 5/8 in pre-painted ceiling drywall · 4 × 16 ft",area/64.,"sheets",44,"Finished ceiling beneath unconditioned roof attic; no bedrooms above garage.");
    let drywall=wall_area+shared_net+area;
    allowance!("garage-compound","Garage joint compound · 4.5 gal",drywall/450.,"pails",23,"450 sq ft per pail allowance.");allowance!("garage-drywalltape","Garage drywall tape · 500 ft",drywall*0.35/500.,"rolls",8,"Joint coverage allowance.");allowance!("garage-drywallscrews","Garage drywall screws · 5 lb",drywall/1000.,"boxes",25,"Fastener allowance.");allowance!("garage-primer","Garage drywall primer",drywall/350.,"gal",22,"One coat at 350 sq ft per gallon.");allowance!("garage-paint","Garage wall and ceiling paint",drywall*2./350.,"gal",35,"Two coats; unconditioned garage has no wallpaper or vinyl flooring.");
    count!("garage-overheaddoor","Garage 16 × 7 ft insulated sectional door & tracks",1,"set",2200,"Double-car overhead door with springs, tracks, weather seals and hardware; installed labor excluded.");if three{count!("garage-overheaddoor-single","Garage 9 × 7 ft insulated sectional door & tracks · third bay",1,"set",1300,"Single-car overhead door for the third bay; springs, tracks, seals and hardware. Installed labor excluded.");}
    count!("garage-opener","Garage door opener & safety sensors",if three{2}else{1},"set",380,"Photo eyes, controls and release kit; product selection pending.");count!("garage-servicedoor","Garage 36 × 80 in exterior service door & hardware",1,"set",650,"38 × 82.5 in rough opening.");count!("garage-window","Garage 4 × 3 ft window",1,"unit",450,"3 ft rough sill; product ratings and glazing requirements pending.");
    if connection{count!("garage-firedoor-upgrade","House / garage protected door upgrade",1,"set",400,"Replaces the ordinary house exterior-door budget with an additional 20-minute-rated, self-closing/latching door allowance. No door into a bedroom; local adoption and assembly approval pending.");}
    count!("garage-receptacles","Garage GFCI receptacles",3,"sets",32,"Two parking-bay receptacles plus a ceiling opener outlet; local NEC/AHJ review pending.");count!("garage-circuit","Garage dedicated 20A circuit materials",1,"set",85,"Panel protection / circuit allowance; routing and load calculations pending.");allowance!("garage-wiring","Garage branch-circuit cable",attached.then_some(150.).unwrap_or(200.),"linear ft",0.65,"Concept routing length; not an electrical wiring plan.");count!("garage-lights","Garage LED ceiling lights",2,"units",65,"One per parking bay.");count!("garage-switch","Garage lighting switch & box",1,"set",18,"Entry lighting control.");count!("garage-outdoorlight","Garage exterior entry light",1,"unit",55,"Vehicle entrance lighting.");
    if !attached{count!("garage-feeder","Detached garage feeder / disconnect allowance",1,"set",450,"Concept feeder, disconnect and grounding allowance; length, trench, conductor size and site design pending.");}
    let garage_subtotal=round(t.items.iter().map(|i|i.total).sum());
    for w in &mut ws{w.x+=p.x;w.z+=p.z;}for v in &mut members{v.x1+=p.x;v.x2+=p.x;v.z1+=p.z;v.z2+=p.z;v.group="Garage framing".into();}
    let mut roof=local_roof;move_roof(&mut roof,&p);
    let ceiling:Vec<_>=(0..=18).map(|i|json!({"id":format!("G-C{}",i),"wallId":"G-CEILING","role":"Garage ceiling I-joist","group":"Garage roof framing","material":"16 in I-joist · series pending","x1":p.x,"y1":h-0.75,"z1":p.z+i as f64*(16./12.),"x2":p.x+wd,"y2":h-0.75,"z2":p.z+i as f64*(16./12.),"width":2.3125/12.,"depth":16./12.,"length":wd,"stockLength":(wd/2.).ceil()*2.})).collect();
    let garage_studs=members.iter().filter(|v|frame::stud(v)).count();
    for(key,extra)in [("studs",garage_studs),("exteriorStuds",garage_studs),("headers",3),("headerPlies",members.iter().filter(|v|v.role=="Header ply").count()),("sills",members.iter().filter(|v|v.role=="Rough sill").count()),("platePieces",members.iter().filter(|v|v.role.contains("plate")).count()),("wallFramePieces",members.len()),("rafters",38),("windows",1),("doors",2)]{m["counts"][key]=json!(n(&m["counts"],key)+extra as f64);}
    for v in members.iter().filter(|v|frame::stud(v)){m["piecesByRole"][&v.role]=json!(n(&m["piecesByRole"],&v.role)+1.);}
    if m["allFrameMembers"].is_null(){m["allFrameMembers"]=m["frameMembers"].clone();}m["allFrameMembers"].as_array_mut().unwrap().extend(members.iter().map(|v|serde_json::to_value(v).unwrap()));
    if m["allWalls"].is_null(){m["allWalls"]=m["walls"].clone();}m["allWalls"].as_array_mut().unwrap().extend(ws.iter().map(|v|serde_json::to_value(v).unwrap()));
    m["items"].as_array_mut().unwrap().extend(t.items.iter().map(|v|serde_json::to_value(v).unwrap()));
    let items=m["items"].as_array().unwrap();let subtotal=round(items.iter().map(|i|n(i,"total")).sum());let tax=round(subtotal*c.tax/100.);let mut cats:BTreeMap<String,f64>=BTreeMap::new();for i in items{*cats.entry(s(i,"category").into()).or_default()+=n(i,"total");}for value in cats.values_mut(){*value=round(*value);}
    m["counts"]["drywallSheets"]=json!(items.iter().filter(|i|s(i,"unit")=="sheets"&&(s(i,"id").starts_with("drywall")||["garage-drywall","garage-ceilingdrywall"].contains(&s(i,"id")))).map(|i|n(i,"qty")).sum::<f64>());
    m["subtotal"]=json!(subtotal);m["tax"]=json!(tax);m["total"]=json!(round(subtotal+tax));m["categoryTotals"]=json!(cats);
    for(key,extra)in [("roofArea",roof_area),("claddingArea",cladding),("drywallWalls",wall_area+shared_net),("drywallCeiling",area),("drywallTotal",drywall),("ceilingJoists",19.)]{m[key]=json!(round(n(&m,key)+extra));}
    m["garageArea"]=json!(area);m["totalCoveredArea"]=json!(n(&m,"area")+area);
    m["siteBounds"]=json!({"minX":p.x.min(0.),"minZ":p.z.min(0.),"maxX":(p.x+wd).max(c.width),"maxZ":(p.z+24.).max(c.depth)});
    let openings:Vec<_>=ws.iter().flat_map(|w|w.openings.iter().map(move |o|{let mut v=serde_json::to_value(o).unwrap();v["wallId"]=json!(w.id);v})).collect();
    let spans:Vec<_>=openings.iter().map(|o|json!({"id":o["id"],"name":format!("Garage {}",s(o,"kind")),"span":o["width"],"basis":"Garage header and load path require structural engineering"})).collect();
    m["spans"].as_array_mut().unwrap().extend(spans.clone());
    if let Some(all)=m["allSpans"].as_array_mut(){all.extend(spans);}
    m["garage"]=json!({"kind":c.garage,"cars":if three{3}else{2},"w":wd,"d":24.,"h":h,"x":p.x,"z":p.z,"area":area,"pitch":gc.pitch,"sharedLength":shared,"sharedWallArea":shared_net,"sharedWalls":shared_walls,"connection":connection,"openings":openings,"walls":ws,"frameMembers":members,"roof":roof,"ceilingMembers":ceiling,"wallArea":wall_area+shared_net,"drywallTotal":drywall,"subtotal":garage_subtotal,"counts":{"studs":garage_studs,"wallFramePieces":members.len(),"rafters":38,"ceilingJoists":19},"ventilation":{"requiredNfa":nfa,"exhaustNfa":exhaust_actual,"intakeNfa":intake*c.soffit_vent_nfa},"note":format!("{} × 24 ft nominal {}-car, unconditioned garage; 16 × 7 ft sectional door{}, 36 × 80 in service door, concrete floor and simple front-gable I-joist roof. Nominal dimensions include wall lines, not clear parking dimensions. Shared house wall is framed once. The protected attached connection is never into a bedroom. Garage opening header, clear-span joists, portal bracing, foundations, roof junctions and electrical/site requirements need professional design; budgets are editable material allowances. The 8 ft detached gap is a layout preview, not a verified property setback.",wd,if three{"three"}else{"two"},if three{" plus a 9 × 7 ft single door for the third bay"}else{""})});
    m
}
