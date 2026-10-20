use crate::*;

pub fn custom(c: &Config) -> Option<&staging::Furniture> {
    if c.stories < 2 || c.design_mode != "Blank slate" { return None }
    c.placed_furniture.iter().find(|f| f.kind == "stairs")
}
pub fn bounds(f: &staging::Furniture, rect: [f64;4]) -> [f64;4] {
    let (cos,sin)=(f.rotation.cos(),f.rotation.sin());
    let points=[[rect[0],rect[1]],[rect[2],rect[1]],[rect[2],rect[3]],[rect[0],rect[3]]].map(|[x,z]|[f.x+cos*(x-4.)-sin*(z-8.),f.z+sin*(x-4.)+cos*(z-8.)]);
    [points.iter().map(|p|p[0]).fold(f64::INFINITY,f64::min),points.iter().map(|p|p[1]).fold(f64::INFINITY,f64::min),points.iter().map(|p|p[0]).fold(f64::NEG_INFINITY,f64::max),points.iter().map(|p|p[1]).fold(f64::NEG_INFINITY,f64::max)]
}
pub fn approach(f:&staging::Furniture)->[f64;4]{bounds(f,[1.5,-5.3,6.5,-0.3])}
/// A straight stair's bottom step is at the far end of its run: it needs 3 ft clear beyond it to step onto it.
pub fn bottom_landing(f:&staging::Furniture,c:&Config)->Option<[f64;4]>{(style(c)=="Straight").then(||bounds(f,[0.,16.3,4.,19.3]))}

pub fn placement_error(f:&staging::Furniture,c:&Config,ws:&[Wall],others:&[staging::Furniture])->Option<String>{
    if c.stories<2{return Some("Choose two or three stories before adding stairs.".into())}
    if c.design_mode!="Blank slate"{return Some("This layout already includes stairs. Use blank slate to place your own.".into())}
    if f.id=="preview"&&c.active_floor!=0{return Some("Place stairs on the main floor. The upper opening is cleared automatically.".into())}
    if f.id=="preview"&&custom(c).is_some(){return Some("Click the existing stairs to move, rotate or delete them.".into())}
    let b=approach(f);
    if b[0]<0.3||b[1]<0.3||b[2]>c.width-0.3||b[3]>c.depth-0.3{return Some("Leave a 5 ft clear approach at the stair entrance. Move the stairs inward or rotate them 90°.".into())}
    if let Some(l)=bottom_landing(f,c){
        if l[0]<0.3||l[1]<0.3||l[2]>c.width-0.3||l[3]>c.depth-0.3{return Some("Leave 3 ft clear past the bottom step of the straight stair. Move the stairs inward or turn them.".into())}
        let spot=staging::Furniture{id:f.id.clone(),kind:"rug".into(),room_id:"stairs".into(),x:(l[0]+l[2])/2.,z:(l[1]+l[3])/2.,w:l[2]-l[0],d:l[3]-l[1],rotation:0.,local_width:l[2]-l[0],local_depth:l[3]-l[1]};
        if c.active_floor==0&&(!edit::clear_of_walls(&spot,ws)||others.iter().any(|o|o.id!=f.id&&edit::item_intersects_rect(o,l))){return Some("Keep 3 ft clear past the bottom step of the straight stair: move walls or items, or turn the stairs.".into())}
    }
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
pub fn room(c:&Config)->Option<Room>{let f=custom(c)?;Some(Room{id:format!("custom-stairs{}",floor_tag(c.active_floor)),name:"Stairwell".into(),kind:"stairs".into(),x:f.x-f.w/2.,z:f.z-f.d/2.,w:f.w,d:f.d})}
pub const STYLES:[&str;5]=["Style matched","Straight","L-shaped","U-shaped switchback","Spiral"];
/// The stair built: the visitor's pick, or the one the house style calls for.
pub fn style(c:&Config)->&'static str{
 if let Some(s)=STYLES[1..].iter().find(|s|**s==c.stair_style){return s}
 match c.home_style.as_str(){"Contemporary"|"Mid-century"|"Industrial"|"Scandinavian"|"Modern farmhouse"=>"Straight","Craftsman"|"Tudor"|"Cape Cod"|"English cottage"|"Ranch"=>"L-shaped",_=>"U-shaped switchback"}
}
pub fn info(c:&Config,rooms:&Value,floor_height:f64)->Value {
    let (x,z,w,d,cx,cz,rotation,id)=if let Some(f)=custom(c){(f.x-f.w/2.,f.z-f.d/2.,f.w,f.d,f.x,f.z,f.rotation,Some(f.id.clone()))}else if c.design_mode!="Blank slate" {let Some(r)=rooms.as_array().unwrap().iter().find(|r|s(r,"type")=="stairs")else{return Value::Null};let(x,z,w,d)=(n(r,"x"),n(r,"z"),n(r,"w"),n(r,"d"));(x,z,w,d,x+4.,z+8.,if z<1.{std::f64::consts::PI}else{0.},None)}else{return Value::Null};
    let f=staging::Furniture{id:id.clone().unwrap_or_default(),kind:"stairs".into(),room_id:"stairs".into(),x:cx,z:cz,w,d,rotation,local_width:8.,local_depth:16.};
    let b=bounds(&f,[0.,4.,8.,16.]);let risers=(floor_height*12./7.75).ceil()as usize;
    json!({"x":x,"z":z,"w":w,"d":d,"centerX":cx,"centerZ":cz,"rotation":rotation,"itemId":id,"floorHeight":floor_height,"style":style(c),"risers":risers,"treads":match style(c){"Straight"|"Spiral"=>risers-1,_=>risers-2},"riserInches":floor_height*12./risers as f64,"treadInches":10.,"flightWidth":3.5,"landingDepth":4.,"reversed":rotation.cos()<0.,"opening":{"x":b[0],"z":b[1],"w":b[2]-b[0],"d":b[3]-b[1],"area":96.}})
}
