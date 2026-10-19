use crate::*;
// House shapes. The main block stays a rectangle; L, T and U homes add one-story wings off the rear wall,
// sized in 2-ft increments. Each wing gets its own rooms, walls, windows, gable roof, piers and pricing,
// and opens into the house through the rear wall. L and U wings reach past the side walls.
pub const SHAPES:[&str;4]=["Rectangle","L-shape","T-shape","U-shape"];
#[derive(Clone,Debug)]pub struct Wing{pub id:String,pub x:f64,pub z:f64,pub w:f64,pub d:f64}
fn snap(v:f64)->f64{(v/2.).floor()*2.}
/// Wing rectangles in house coordinates (x across the width, z from the front). A T's stem sits behind the
/// middle of the house. L and U wings reach half their width past the side walls, so the shape reads from the
/// street; the rest overlaps the rear wall for the way in, and a U keeps 4 ft of rear wall open between them.
pub fn rects(c:&Config)->Vec<Wing>{
 if !SHAPES[1..].contains(&c.shape.as_str()){return vec![]}
 let d=c.wing_depth;if d<8.{return vec![]}
 let wing=|i:usize,x:f64,w:f64|Wing{id:format!("wing{}",i),x,z:c.depth,w,d};
 if c.shape=="T-shape"{let w=snap(c.wing_width.min(c.width-4.));if w<8.{return vec![]}return vec![wing(0,snap((c.width-w)/2.),w)]}
 let u=c.shape=="U-shape";let w=snap(c.wing_width);let out=snap(w/2.);
 let inside=(w-out).min(snap(if u{(c.width-4.)/2.}else{c.width-4.}));if inside<6.||w<8.{return vec![]}
 let left=wing(0,-out,inside+out);let right=|i:usize|wing(i,c.width-inside,inside+out);
 if u{vec![left,right(1)]}else if c.garage_side=="Left"{vec![right(0)]}else{vec![left]}
}
/// The stretch of a wing that overlaps the house's rear wall.
pub fn overlap(c:&Config,g:&Wing)->(f64,f64){(g.x.max(0.),(g.x+g.w).min(c.width))}
/// How far a wing reaches past the house's side walls (both sides together).
fn reach(c:&Config,g:&Wing)->f64{(-g.x).max(0.)+(g.x+g.w-c.width).max(0.)}
pub fn floor_area(c:&Config)->f64{if c.active_floor!=0{return 0.}rects(c).iter().map(|g|g.w*g.d).sum()}
/// Exterior wall added: each wing's two sides and back, less the stretch of rear wall it covers.
pub fn added_perimeter(c:&Config)->f64{if c.active_floor!=0{return 0.}rects(c).iter().map(|g|2.*g.d+2.*reach(c,g)).sum()}
/// Rooms inside the wings: a family room, or in the second wing of a U a guest suite with its own bath.
/// On a blank slate each wing is one empty room for the visitor to lay out.
pub fn rooms(c:&Config)->Vec<Room>{
 let mut out=vec![];if c.active_floor!=0{return out}
 for(i,g)in rects(c).iter().enumerate(){
  // A traced plan's wing keeps the rooms read from the plan.
  if let Some(t)=traced::active(c).and_then(|t|t.wings.get(i)).filter(|t|!t.rooms.is_empty()){out.extend(traced::scale(&t.rooms,(t.w,t.d),(g.w,g.d),&format!("{}-",g.id),"").into_iter().map(|mut r|{r.x+=g.x;r.z+=g.z;r}));continue}
  if c.design_mode=="Blank slate"{out.push(Room{id:format!("{}-blank",g.id),name:"Empty addition".into(),kind:"blank".into(),x:g.x,z:g.z,w:g.w,d:g.d});continue}
  // A two-story house keeps its bedrooms upstairs, so its second U wing is a den rather than a guest suite.
  let suite=i==1&&g.w>=10.&&g.d>=14.&&c.stories==1;
  if i==1&&c.stories>1{out.push(Room{id:format!("{}-den",g.id),name:"Den".into(),kind:"flex".into(),x:g.x,z:g.z,w:g.w,d:g.d});continue}
  if suite{let bath=if g.d>=18.{6.}else{0.};out.push(Room{id:format!("{}-suite",g.id),name:"Guest suite".into(),kind:"bedroom".into(),x:g.x,z:g.z,w:g.w,d:g.d-bath});if bath>0.{out.push(Room{id:format!("{}-bath",g.id),name:"Guest bath".into(),kind:"bath".into(),x:g.x,z:g.z+g.d-bath,w:g.w,d:bath});}}
  else{out.push(Room{id:format!("{}-family",g.id),name:if c.shape=="T-shape"{"Great room"}else{"Family room"}.into(),kind:"living".into(),x:g.x,z:g.z,w:g.w,d:g.d});}
 }
 out
}
pub fn is_wing(id:&str)->bool{id.starts_with("wing")}
fn add(w:&mut Wall,num:&mut usize,kind:&str,at:f64,width:f64,bottom:f64,height:f64){*num+=1;w.openings.push(Opening{id:format!("{}-{}{}",w.id,if kind=="window"{"W"}else{"D"},num),kind:kind.into(),at,width,bottom,height});}
/// Wing walls (XL left, XR right, XB back: the prefix tells the viewer which way is outside), their windows
/// on an even bay grid, and the opening through the house's rear wall into each wing.
pub fn prepare_walls(c:&Config,rs:&[Room],mut ws:Vec<Wall>)->Vec<Wall>{
 if c.active_floor!=0{return ws}let h=c.wall_height;let wings=rects(c);if wings.is_empty(){return ws}
 let sill=|bath:bool|->(f64,f64){let oh=if bath{2.}else{4.};let want:f64=if bath{4.5}else{3.};(want.min(((h*12.-3.-9.25-oh*12.)*4.).floor()/48.),oh)};
 for g in &wings{
  // The rear wall behind the wing becomes interior: its windows and doors there go, and one opening leads in.
  if let Some(rear)=ws.iter_mut().find(|w|w.id=="E2"){
   let(lo,hi)=overlap(c,g);rear.openings.retain(|o|o.at+o.width<lo-0.3||o.at>hi+0.3);
   let suite=rs.iter().any(|r|is_wing(&r.id)&&r.kind=="bedroom"&&near(r.x,g.x));let width=if suite{38./12.}else{(hi-lo-3.).min(8.).max(3.)};
   let ok=|at:f64|{let mid=at+width/2.;rs.iter().filter(|r|!is_wing(&r.id)&&near(r.z+r.d,c.depth)&&mid>r.x&&mid<r.x+r.w).all(|r|!["bath","stairs"].contains(&r.kind.as_str()))};
   let centre=lo+(hi-lo-width)/2.;let mut best=None;let mut k=0;while k<=((hi-lo)*2.)as usize{for sign in [1.,-1.]{let at=centre+sign*k as f64*0.5;if best.is_none()&&at>=lo+0.5&&at+width<=hi-0.5&&ok(at){best=Some(at)}}k+=1;}
   let at=best.unwrap_or(centre);let num=rear.openings.len()+90;rear.openings.push(Opening{id:format!("E2-{}-{}",if suite{"D"}else{"P"},num),kind:if suite{"door"}else{"passage"}.into(),at,width,bottom:0.,height:82.5/12.});rear.openings.sort_by(|a,b|a.at.total_cmp(&b.at));
  }
  let mut num=0;
  // Where a wing reaches past a side wall, a short front wall (XF, facing the street) closes it.
  let mut sides=vec![(format!("XL-{}",g.id),"Wing left exterior",g.x,g.z,g.d,"z"),(format!("XR-{}",g.id),"Wing right exterior",g.x+g.w,g.z,g.d,"z"),(format!("XB-{}",g.id),"Wing rear exterior",g.x,g.z+g.d,g.w,"x")];
  if g.x<0.{sides.push((format!("XF-{}",g.id),"Wing front exterior",g.x,g.z,-g.x,"x"));}
  if g.x+g.w>c.width{sides.push((format!("XF{}-{}",2,g.id),"Wing front exterior",c.width,g.z,g.x+g.w-c.width,"x"));}
  for(id,name,x,z,len,axis)in sides{let front=id.starts_with("XF");
   let mut wall=Wall{id,name:name.into(),x,z,length:len,axis:axis.into(),exterior:true,openings:vec![]};
   // A side of the wing that runs along the house's own side wall continues that facade.
   let bays=((len/9.5).round()as usize).max(1);let bay=len/bays as f64;
   for i in 0..bays{let centre=bay*(i as f64+0.5);let(px,pz)=if axis=="x"{(x+centre,if front{z+0.5}else{z-0.5})}else{(x+if near(x,g.x){0.5}else{-0.5},z+centre)};
    let room=rs.iter().find(|r|is_wing(&r.id)&&px>=r.x&&px<=r.x+r.w&&pz>=r.z&&pz<=r.z+r.d);let Some(r)=room else{continue};let bath=r.kind=="bath";
    let room_lo=if axis=="x"{r.x}else{r.z}-if axis=="x"{x}else{z};let room_hi=room_lo+if axis=="x"{r.w}else{r.d};
    let ww=if bath{2.}else{((bay*0.44*2.).round()/2.).clamp(3.,6.)};let at=centre-ww/2.;if at<room_lo+0.6||at+ww>room_hi-0.6{continue}
    if bath&&wall.openings.iter().any(|o|o.width<2.5){continue}let(bottom,oh)=sill(bath);add(&mut wall,&mut num,"window",at,ww,bottom,oh);}
   ws.push(wall);
  }
 }
 // Walls between rooms of one wing (the guest suite and its bath).
 for g in &wings{let parts:Vec<&Room>=rs.iter().filter(|r|is_wing(&r.id)&&near(r.x,g.x)).collect();if parts.len()==2{let z=parts[0].z+parts[0].d;let mut wall=Wall{id:format!("XI-{}",g.id),name:"Guest suite / bath".into(),x:g.x,z,length:g.w,axis:"x".into(),exterior:false,openings:vec![]};wall.openings.push(Opening{id:format!("XI-{}-D1",g.id),kind:"door".into(),at:0.6,width:(30.0_f64/12.).min(g.w-1.2),bottom:0.,height:82.5/12.});ws.push(wall);}}
 ws
}
/// Rear-wall area now inside the house behind each wing (no siding or sheathing outside it).
pub fn shared_area(c:&Config,ws:&[Wall])->f64{
 if c.active_floor!=0{return 0.}let Some(rear)=ws.iter().find(|w|w.id=="E2")else{return 0.};
 rects(c).iter().map(|g|{let(lo,hi)=overlap(c,g);((hi-lo)*c.wall_height-rear.openings.iter().map(|o|(hi.min(o.at+o.width)-lo.max(o.at)).max(0.)*o.height).sum::<f64>()).max(0.)}).sum()
}
/// Wing roof pitch: the house pitch, flattened on a multi-story house so the wing ridge stays below the
/// upper-floor window sills.
pub fn pitch(c:&Config,g:&Wing)->f64{if c.stories<2{return c.pitch}let room=structural::floor_gap(c)+2.5;c.pitch.min((room/(g.w/2.+1.5)*12.).max(3.))}
/// A gable roof over one wing: the ridge runs out from the house, 18 in overhangs at the sides and back.
pub fn roof(c:&Config,g:&Wing)->Value{
 let h=c.wall_height;let slope=pitch(c,g)/12.;let(x0,x1,xr)=(g.x-1.5,g.x+g.w+1.5,g.x+g.w/2.);let(z0,z1)=(g.z,g.z+g.d+1.5);let height=|x:f64|h+(x-g.x).min(g.x+g.w-x)*slope;
 let rise=g.w/2.*slope;let run=(xr-x0)*(1.+slope*slope).sqrt();
 let mut rafters=vec![];let count=((g.d+1.5)/(16./12.)).floor()as usize;for i in 0..=count{let z=z0+i as f64*16./12.;for(side,a,b)in[("Left",x0,xr),("Right",xr,x1)]{let length=(b-a)*(1.+slope*slope).sqrt();rafters.push(json!({"id":format!("{}-R{}-{}",g.id,side,i),"x1":a,"x2":b,"x":a,"z1":z,"z2":z,"y1":height(a),"y2":height(b),"length":length,"stockLength":(length/2.).ceil()*2.,"side":side,"bay":1}));}}
 let mut edges=vec![json!({"a":[xr,height(xr),z0],"b":[xr,height(xr),z1],"kind":"ridge","length":z1-z0})];
 for x in [x0,x1]{edges.push(json!({"a":[x,height(x),z0],"b":[x,height(x),z1],"kind":"eave","length":z1-z0}));}
 for(a,b)in[(x0,xr),(xr,x1)]{edges.push(json!({"a":[a,height(a),z1],"b":[b,height(b),z1],"kind":"rake","length":run}));}
 json!({"type":"Wing gable","facets":[{"id":format!("{}-left",g.id),"points":[[x0,height(x0),z0],[xr,height(xr),z0],[xr,height(xr),z1],[x0,height(x0),z1]],"plane":[slope,0.,-g.x*slope]},{"id":format!("{}-right",g.id),"points":[[xr,height(xr),z0],[x1,height(x1),z0],[x1,height(x1),z1],[xr,height(xr),z1]],"plane":[-slope,0.,(g.x+g.w)*slope]}],
  "profiles":[{"x":g.x,"z":g.z+g.d,"axis":"x","points":[[0.,0.],[g.w/2.,rise],[g.w,0.]]},{"x":g.x,"z":g.z,"axis":"x","points":[[0.,0.],[g.w/2.,rise],[g.w,0.]]}],
  "edges":edges,"supports":[],"rafters":rafters,"area":2.*run*(z1-z0),"infillArea":g.w*rise/2.,"rise":rise,"pitch":pitch(c,g)})
}
pub fn roof_area(c:&Config)->f64{if c.active_floor!=0{return 0.}rects(c).iter().map(|g|n(&roof(c,g),"area")).sum()}
pub fn gable_area(c:&Config)->f64{if c.active_floor!=0{return 0.}rects(c).iter().map(|g|n(&roof(c,g),"infillArea")).sum()}
/// Wing outlines, roofs and quantities for the viewer and the takeoff; widens the site bounds.
pub fn apply(c:&Config,mut m:Value)->Value{
 let wings=rects(c);if wings.is_empty(){m["wings"]=json!([]);return m}
 let mut out=vec![];for g in &wings{out.push(json!({"id":g.id,"x":g.x,"z":g.z,"w":g.w,"d":g.d,"h":c.wall_height,"roof":roof(c,g),"area":g.w*g.d}));}
 m["wings"]=json!(out);
 if !m["siteBounds"].is_object(){m["siteBounds"]=json!({"minX":0.,"minZ":0.,"maxX":c.width,"maxZ":c.depth});}
 let back=wings.iter().map(|g|g.z+g.d+1.5).fold(0.,f64::max);if back>n(&m["siteBounds"],"maxZ"){m["siteBounds"]["maxZ"]=json!(back);}
 for g in &wings{if g.x-1.5<n(&m["siteBounds"],"minX"){m["siteBounds"]["minX"]=json!(g.x-1.5);}if g.x+g.w+1.5>n(&m["siteBounds"],"maxX"){m["siteBounds"]["maxX"]=json!(g.x+g.w+1.5);}}
 m["shape"]=json!(c.shape);m["wingArea"]=json!(round(wings.iter().map(|g|g.w*g.d).sum::<f64>()));
 m
}
/// Foundation and floor for the wings: their own pier lines and beams (sized like the house's), floor
/// panels, and roof framing. Walls, windows, roof covering and finishes flow through the house takeoff.
pub fn add_items(t:&mut model::Takeoff,c:&Config){
 let wings=rects(c);if wings.is_empty(){return}
 let mut piers=0.;let mut beam_lf=0.;let mut rafters=0.0_f64;let mut ridge=0.;let area:f64=wings.iter().map(|g|g.w*g.d).sum();
 for g in &wings{
  let mut wc=c.clone();wc.width=g.w;wc.depth=g.d;wc.stories=1;wc.shape="Rectangle".into();
  if c.foundation==piers::HELICAL{let l=piers::layout(&wc);piers+=(l.lines*(l.per_line-1))as f64;beam_lf+=l.lines as f64*g.d;}
  rafters+=roof(c,g)["rafters"].as_array().map_or(0,|v|v.len())as f64;ridge+=g.d+1.5;
 }
 if c.foundation==piers::HELICAL{
  t.add("wing-piers","Foundation","Wing helical piers · lead, extensions and cap",piers,"each",285.+210.*1.5+95.,"Each wing's own pier lines at 16 ft or closer; the row along the house's rear wall is shared with the house piers.","Pier foundation estimate",false,true);
  t.add("wing-beams","Foundation",if piers::steel(c){"Wing steel beams with treated 2×6 nailers"}else{"Wing LVL girders"},beam_lf,"linear ft",if piers::steel(c){22.*2.1+2.4}else{32.},"Beam lines under each wing, the same construction as the house.","Pier foundation estimate",true,false);
 }
 t.add("wing-floor-panels","Floor framing","Wing floor panels · 16 in I-joists, insulated, AdvanTech deck",area,"sq ft",14.5,"Factory floor panels sized to each wing, at the house's floor build-up.","Allowance",true,false);
 t.add("wing-rafters","Roof framing","Wing roof I-joist rafters at 16 in o.c.",rafters,"pieces",80.,"Gable roof framing over each wing; ridge, valley tie-in and bearings need engineering.","Allowance",true,true);
 t.add("wing-ridge","Roof framing","Wing LVL ridge beams",ridge,"linear ft",24.,"One ridge per wing, from the house wall to the rear gable.","Allowance",true,false);
 t.add("wing-valley","Roof framing","Wing-to-house roof tie-in · valley flashing, cricket and blocking",wings.len()as f64,"each",650.,"Where each wing roof meets the house wall and roof.","Allowance",false,true);
}
