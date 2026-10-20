use crate::*;

pub fn custom(c: &Config) -> Option<&staging::Furniture> {
    if c.stories < 2 { return None }
    c.placed_furniture.iter().find(|f| f.kind == "stairs")
}
pub fn bounds(f: &staging::Furniture, rect: [f64;4]) -> [f64;4] {
    let (cos,sin)=(f.rotation.cos(),f.rotation.sin());
    let points=[[rect[0],rect[1]],[rect[2],rect[1]],[rect[2],rect[3]],[rect[0],rect[3]]].map(|[x,z]|[f.x+cos*(x-4.)-sin*(z-8.),f.z+sin*(x-4.)+cos*(z-8.)]);
    [points.iter().map(|p|p[0]).fold(f64::INFINITY,f64::min),points.iter().map(|p|p[1]).fold(f64::INFINITY,f64::min),points.iter().map(|p|p[0]).fold(f64::NEG_INFINITY,f64::max),points.iter().map(|p|p[1]).fold(f64::NEG_INFINITY,f64::max)]
}
pub fn approach(f:&staging::Furniture)->[f64;4]{bounds(f,[1.5,-5.3,6.5,-0.3])}
/// The floor opening above a stair, in its local 8 × 16 ft frame: a straight run tops out at the open end and its
/// opening follows the run; the turning stairs open over everything past the top landing.
pub fn opening_local(c:&Config,risers:usize)->[f64;4]{if style(c)=="Straight"{[0.,0.,4.,(risers.saturating_sub(1))as f64*straight_tread(risers)]}else{[0.,4.,8.,16.]}}
/// A straight run's tread depth: 10 in, shortened only if the run would leave less than about 3.5 ft of landing.
pub fn straight_tread(risers:usize)->f64{(10.0_f64/12.).min(12.4/(risers.max(2)-1)as f64)}

pub fn placement_error(f:&staging::Furniture,c:&Config,ws:&[Wall],others:&[staging::Furniture])->Option<String>{
    if c.stories<2{return Some("Choose two or three stories before adding stairs.".into())}
    if c.design_mode!="Blank slate"{return catalog_error(f,c,others)}
    if f.id=="preview"&&c.active_floor!=0{return Some("Place stairs on the main floor. The upper opening is cleared automatically.".into())}
    if f.id=="preview"&&custom(c).is_some(){return Some("Click the existing stairs to move, rotate or delete them.".into())}
    let b=approach(f);
    if b[0]<0.3||b[1]<0.3||b[2]>c.width-0.3||b[3]>c.depth-0.3{return Some("Leave a 5 ft clear approach at the stair entrance. Move the stairs inward or rotate them 90°.".into())}

    // Upstairs is cleared by the stair opening. First-floor walls and furniture stay intact.
    if c.active_floor==0{
        let landing=staging::Furniture{id:f.id.clone(),kind:"rug".into(),room_id:"stairs".into(),x:(b[0]+b[2])/2.,z:(b[1]+b[3])/2.,w:b[2]-b[0],d:b[3]-b[1],rotation:0.,local_width:b[2]-b[0],local_depth:b[3]-b[1]};
        if !edit::clear_of_walls(&landing,ws){return Some("Move first-floor walls out of the 5 ft stair approach. Upstairs clears automatically.".into())}
        if others.iter().any(|o|o.id!=f.id&&edit::item_intersects_rect(o,b)){return Some("Move first-floor items out of the 5 ft stair approach. Upstairs clears automatically.".into())}
    }
    None
}

/// Derive the upper clearance from the current stairs, so move/delete/Undo also restore it.
/// All wall finishes, openings, framing and quantities consume these same cut segments.
pub fn clear_upper_walls(mut ws:Vec<Wall>,c:&Config)->Vec<Wall>{
    if c.active_floor==0{return ws}
    let Some(f)=custom(c)else{return ws};
    let body=[f.x-f.w/2.-0.3,f.z-f.d/2.-0.3,f.x+f.w/2.+0.3,f.z+f.d/2.+0.3];
    let mut landing=approach(f);landing[0]-=0.3;landing[1]-=0.3;landing[2]+=0.3;landing[3]+=0.3;
    for rect in [body,landing]{
        ws=ws.into_iter().flat_map(|wall|{
            let along=wall.axis=="x";let line=if along{wall.z}else{wall.x};
            let (start,low,high,across_low,across_high)=if along{(wall.x,rect[0],rect[2],rect[1],rect[3])}else{(wall.z,rect[1],rect[3],rect[0],rect[2])};
            let lo=(low-start).clamp(0.,wall.length);let hi=(high-start).clamp(0.,wall.length);
            if wall.exterior||line<=across_low||line>=across_high||hi-lo<0.01{return vec![wall]}
            let mut parts=vec![];
            for (suffix,a,b) in [("A",0.,lo),("B",hi,wall.length)]{
                if b-a<0.5{continue}
                let mut part=wall.clone();part.id=format!("{}-STAIR-{}",wall.id,suffix);part.length=b-a;
                if along{part.x+=a}else{part.z+=a}
                part.openings=wall.openings.iter().filter(|o|o.at>=a+0.2&&o.at+o.width<=b-0.2).map(|o|{let mut o=o.clone();o.at-=a;o}).collect();
                parts.push(part);
            }
            parts
        }).collect();
    }
    ws
}
/// A catalog home's stairs can move anywhere their 5 ft approach stays inside the house, as long as they don't
/// cut through a kitchen, bathroom or bedroom on any floor; the rooms they land in are rebuilt around them.
fn catalog_error(f:&staging::Furniture,c:&Config,others:&[staging::Furniture])->Option<String>{
    if f.id=="preview"{return Some("This home already has stairs. Click them to move or turn them.".into())}
    let a=approach(f);
    if a[0]<0.3||a[1]<0.3||a[2]>c.width-0.3||a[3]>c.depth-0.3{return Some("Leave a 5 ft clear approach at the stair entrance. Move the stairs inward or rotate them 90°.".into())}
    let body=[f.x-f.w/2.,f.z-f.d/2.,f.x+f.w/2.,f.z+f.d/2.];
    let hit=|r:&Room,b:[f64;4]|r.x<b[2]-0.01&&r.x+r.w>b[0]+0.01&&r.z<b[3]-0.01&&r.z+r.d>b[1]+0.01;
    for floor in 0..c.stories{
        let mut cc=c.clone();cc.active_floor=floor;cc.placed_furniture.retain(|o|o.kind!="stairs");let(rs,_)=layout(&cc);
        if let Some(r)=rs.iter().find(|r|hit(r,body)&&["kitchen","bath","bedroom"].contains(&r.kind.as_str())){
            return Some(format!("Stairs can't cut through the {}{}. Try a hall, living area or study.",r.name.to_lowercase(),if floor>0{" upstairs"}else{""}))}
        // The approach must be open floor: one room, or halls with no walls between them.
        if floor==0{let under:Vec<&Room>=rs.iter().filter(|r|hit(r,a)).collect();
            let open=|r:&&Room|["hall","foyer","stairs"].contains(&r.kind.as_str());
            if under.len()>1&&!under.iter().all(open){return Some("Face the stairs into one open room or hall so the 5 ft approach isn't split by a wall.".into())}
            if under.iter().any(|r|["kitchen","bath","bedroom"].contains(&r.kind.as_str())){return Some("Face the stairs into a hall or living area, not a kitchen, bathroom or bedroom.".into())}}
    }
    if let Some(o)=others.iter().filter(|o|o.id!=f.id&&o.id.starts_with("F-U")).find(|o|edit::item_intersects_rect(o,body)||edit::item_intersects_rect(o,a)){return Some(format!("Move the {} you placed out of the way first.",o.kind))}
    None
}
/// Rebuild a catalog floor around moved stairs: each room they land in keeps its largest piece, the strips left
/// beside the stairs open onto it as hall space, and the old stairwell becomes open hall.
pub fn carve(rs:&mut Vec<Room>,s:&Room){
    let mut out=vec![];
    for r in rs.drain(..){
        let r=if r.kind=="stairs"{Room{kind:"hall".into(),name:"Open hall".into(),..r}}else{r};
        let(x0,z0,x1,z1)=(s.x.max(r.x),s.z.max(r.z),(s.x+s.w).min(r.x+r.w),(s.z+s.d).min(r.z+r.d));
        if x1-x0<0.01||z1-z0<0.01{out.push(r);continue}
        let mut pieces=vec![(r.x,r.z,r.w,z0-r.z),(r.x,z1,r.w,r.z+r.d-z1),(r.x,z0,x0-r.x,z1-z0),(x1,z0,r.x+r.w-x1,z1-z0)];
        pieces.retain(|p|p.2>0.4&&p.3>0.4);
        let big=pieces.iter().enumerate().max_by(|a,b|(a.1.2*a.1.3).total_cmp(&(b.1.2*b.1.3))).map(|(i,_)|i);
        for(i,p)in pieces.into_iter().enumerate(){let mut q=r.clone();(q.x,q.z,q.w,q.d)=p;
            if Some(i)!=big{q.id=format!("{}-entry-return-stair{}",r.id.split("-entry-return").next().unwrap(),i);if !["hall","foyer"].contains(&q.kind.as_str()){q.kind="hall".into();q.name="Stair side".into();}}
            out.push(q);}
    }
    out.push(s.clone());*rs=out;
}
pub fn room(c:&Config)->Option<Room>{let f=custom(c)?;Some(Room{id:format!("custom-stairs{}",floor_tag(c.active_floor)),name:"Stairwell".into(),kind:"stairs".into(),x:f.x-f.w/2.,z:f.z-f.d/2.,w:f.w,d:f.d})}
pub const STYLES:[&str;5]=["Style matched","Straight","L-shaped","U-shaped switchback","Spiral"];
/// The stair built: the visitor's pick, or the one the house style calls for.
pub fn style(c:&Config)->&'static str{
 if let Some(s)=STYLES[1..].iter().find(|s|**s==c.stair_style){return s}
 match c.home_style.as_str(){"Contemporary"|"Mid-century"|"Industrial"|"Scandinavian"|"Modern farmhouse"=>"Straight","Craftsman"|"Tudor"|"Cape Cod"|"English cottage"|"Ranch"=>"L-shaped",_=>"U-shaped switchback"}
}
pub fn info(c:&Config,rooms:&Value,floor_height:f64)->Value {
    let (x,z,w,d,cx,cz,rotation,id)=if let Some(f)=custom(c){(f.x-f.w/2.,f.z-f.d/2.,f.w,f.d,f.x,f.z,f.rotation,Some(f.id.clone()))}else if c.design_mode!="Blank slate" {let Some(r)=rooms.as_array().unwrap().iter().find(|r|s(r,"type")=="stairs")else{return Value::Null};let(x,z,w,d)=(n(r,"x"),n(r,"z"),n(r,"w"),n(r,"d"));(x,z,w,d,x+4.,z+8.,if z<1.{std::f64::consts::PI}else{0.},(near(w,8.)&&near(d,16.)&&c.active_floor==0).then(||"catalog-stairs".to_string()))}else{return Value::Null};
    let f=staging::Furniture{id:id.clone().unwrap_or_default(),kind:"stairs".into(),room_id:"stairs".into(),x:cx,z:cz,w,d,rotation,local_width:8.,local_depth:16.};
    let risers=(floor_height*12./7.75).ceil()as usize;let b=bounds(&f,opening_local(c,risers));
    json!({"x":x,"z":z,"w":w,"d":d,"centerX":cx,"centerZ":cz,"rotation":rotation,"itemId":id,"floorHeight":floor_height,"style":style(c),"risers":risers,"treads":match style(c){"Straight"|"Spiral"=>risers-1,_=>risers-2},"riserInches":floor_height*12./risers as f64,"treadInches":10.,"flightWidth":3.5,"landingDepth":4.,"reversed":rotation.cos()<0.,"opening":{"x":b[0],"z":b[1],"w":b[2]-b[0],"d":b[3]-b[1],"area":(b[2]-b[0])*(b[3]-b[1])}})
}
