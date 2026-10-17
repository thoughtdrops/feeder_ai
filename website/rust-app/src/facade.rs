use crate::*;
// Street-front window and door composition for each style, read from the catalog house it adapts
// (architecture-sources.json). Symmetric styles hang an odd number of bays round a centre door, the way
// Poplar Hill, the Gordon-Van Tine Colonial and the Solomon Howes Cape do. Picturesque and modern styles
// compose room by room: the Sears Victorian's tall parlor group, the Craftsman's ribbon of three, the
// Tudor's leaded casement band, the Ranch picture window, the Farnsworth House glass wall. Scandinavian
// and Industrial fronts keep the even rhythm of identical windows seen on Villa Snellman and the steel house.
#[derive(Clone,Copy,PartialEq)]pub enum Mode{Symmetric,Rhythm,Rooms}
#[derive(Clone,Copy)]pub struct Look{pub mode:Mode,pub bay:f64,pub unit:f64,pub height:f64,pub main:usize,pub other:usize,pub main_unit:f64}
const MULLION:f64=0.4;
// Corner boards and quoins keep front windows this far from the house corners.
const CORNER:f64=1.5;
pub fn look(style:&str)->Look{let l=|mode,bay,unit,height,main,other,main_unit|Look{mode,bay,unit,height,main,other,main_unit};match style{
 "Georgian"=>l(Mode::Symmetric,7.,3.,5.5,1,1,3.),"Colonial"=>l(Mode::Symmetric,8.,3.,5.,1,1,3.),"French country"=>l(Mode::Symmetric,9.,3.,6.,1,1,3.),
 "Coastal"=>l(Mode::Symmetric,10.,3.,5.,2,2,3.),"Cape Cod"=>l(Mode::Symmetric,8.,3.,4.5,1,1,3.),
 "Victorian"=>l(Mode::Rooms,9.,2.5,6.,3,1,2.5),"Craftsman"=>l(Mode::Rooms,10.,2.5,4.5,3,2,2.5),"Tudor"=>l(Mode::Rooms,10.,2.,4.5,4,2,2.),
 "English cottage"=>l(Mode::Rooms,9.,2.,4.,3,2,2.),"Modern farmhouse"=>l(Mode::Rooms,10.,3.,5.,2,2,3.),"Ranch"=>l(Mode::Rooms,12.,4.,3.5,1,1,8.),
 "Mid-century"=>l(Mode::Rooms,12.,6.,9.,0,1,6.),"Contemporary"=>l(Mode::Rooms,12.,5.,5.5,2,1,5.),
 "Scandinavian"=>l(Mode::Rhythm,6.5,3.,4.5,1,1,3.),"Industrial"=>l(Mode::Rhythm,8.,5.,5.5,1,1,5.),
 _=>l(Mode::Rooms,9.5,3.,4.,1,1,3.)}}
/// "Style matched" keeps the historic sizes; Medium and Large open the same composition up with wider,
/// taller units.
pub fn scale(c:&Config)->(f64,f64){match c.window_size.as_str(){"Medium"=>(1.3,0.75),"Large"=>(1.6,1.5),_=>(1.,0.)}}
/// Sill and head for a window of the wanted height under this wall's plate and header.
pub fn vertical(c:&Config,bath:bool,want:f64)->(f64,f64){let h=c.wall_height;let room=h-0.25-9.25/12.;if bath{return((4.5_f64).min(((room-2.)*4.).floor()/4.),2.)}
 let height=(want+scale(c).1).min(room-2.);let bottom=(3.0_f64).min(((room-height)*4.).floor()/4.).max(2.);(bottom,((room-bottom).min(height)*4.).floor()/4.)}
fn quiet(r:&Room)->bool{["hall","foyer"].contains(&r.kind.as_str())}
fn social_room(r:&Room)->bool{["living","studio","dining"].contains(&r.kind.as_str())}
/// The front room that holds the span [a,b] with room for the casing either side.
fn holder<'a>(rs:&'a [Room],len:f64,a:f64,b:f64,taken:&[(f64,f64)])->Option<&'a Room>{if a<CORNER||b>len-CORNER||taken.iter().any(|(s,e)|a<e+0.6&&b>s-0.6){return None}
 rs.iter().find(|r|near(r.z,0.)&&r.kind!="stairs"&&a>=r.x+0.6-1e-9&&b<=r.x+r.w-0.6+1e-9)}
fn group_width(n:usize,unit:f64)->f64{n as f64*unit+(n.max(1)-1)as f64*MULLION}
/// Windows for one front-wall span: one opening per ganged unit, MULLION apart.
fn units(centre:f64,n:usize,unit:f64)->Vec<(f64,f64)>{let total=group_width(n,unit);(0..n).map(|i|(centre-total/2.+i as f64*(unit+MULLION),unit)).collect()}
pub struct Front{pub windows:Vec<(f64,f64,bool,f64)>}
/// Bedroom windows stay at least 36 x 48 in rough so one can serve as the escape opening.
pub fn escape(kind:&str,width:f64,height:f64)->(f64,f64){if kind=="bedroom"{(width.max(3.),height.max(4.))}else{(width,height)}}
/// Front-wall windows (at, width, bath, wanted height) for `rs`, the current floor. `floors` holds every floor's rooms so
/// a bay that cannot open on one floor shifts the same way on all of them and windows stack.
pub fn front(c:&Config,rs:&[Room],floors:&[Vec<Room>],door:(f64,f64),ground:bool)->Front{
 let lk=look(&c.home_style);let len=c.width;let(k,_)=scale(c);let unit=lk.unit*k;let(door_at,door_w)=door;let centre=door_at+door_w/2.;
 let door_span=|g:bool|if g{vec![(door_at,door_at+door_w)]}else{vec![]};
 let mut out=vec![];
 match lk.mode{Mode::Symmetric|Mode::Rhythm=>{
  // Candidate bay counts near the style's bay width; the one whose bays open on most floors wins.
  let n0=((len/lk.bay).round()as usize).max(3);let cands:Vec<usize>=if lk.mode==Mode::Symmetric{let odd=if n0%2==1{n0}else{n0-1};[odd,odd+2,odd.saturating_sub(2)].into_iter().filter(|n|*n>=3).collect()}else{[n0,n0+1,n0-1].into_iter().filter(|n|*n>=2).collect()};
  let group=lk.main.max(1);let gw=group_width(group,lk.unit);
  // Bay centres (paired with their mirror for symmetric fronts) for a count n.
  let bays=|n:usize|->Vec<Vec<f64>>{if lk.mode==Mode::Symmetric{let bay=len/n as f64;(1..=n).map(|i|vec![centre-i as f64*bay,centre+i as f64*bay]).map(|p|p.into_iter().filter(|x|*x-gw/2.>=CORNER-2.&&*x+gw/2.<=len-CORNER+2.).collect::<Vec<_>>()).filter(|p:&Vec<f64>|!p.is_empty()).collect()}else{(0..n).map(|i|vec![len*(i as f64+0.5)/n as f64]).collect()}};
  let fits=|floor:&[Room],g:bool,x:f64,w:f64|holder(floor,len,x-w/2.,x+w/2.,&door_span(g)).map(|r|r.kind.clone());
  // Medium and Large units step back toward the historic width where a bay is too narrow for them.
  let widths:Vec<f64>={let mut v=vec![unit];let mut u=unit-0.5;while u>lk.unit+1e-9{v.push(u);u-=0.5;}if unit>lk.unit+1e-9{v.push(lk.unit);}v};
  let mut best:Option<(f64,Vec<(Vec<f64>,f64)>)>=None;
  // The style's own bay count is preferred; another count wins only by opening clearly more of its bays.
  for(rank,n)in cands.iter().enumerate(){let sets=bays(*n);let total:usize=sets.iter().map(|x|x.len()).sum::<usize>().max(1);let mut score=-(rank as f64)*15.;let mut chosen=vec![];
   for set in sets{let mut pick:Option<(usize,Vec<f64>,f64,f64)>=None;for &uw in &widths{if pick.is_some(){break}let gw=group_width(group,uw);for step in 0..=8{for sign in [1.,-1.]{let d=sign*step as f64*0.25;if step==0&&sign<0.{continue}
     // A pair moves in mirror image so the front stays symmetric; the smallest shift that opens on the
     // most floors wins, and only a bay whose whole set opens on the ground floor is kept.
     let xs:Vec<f64>=set.iter().map(|x|if *x<centre{x-d}else{x+d}).collect();let hits:usize=floors.iter().enumerate().map(|(f,fl)|xs.iter().filter(|x|fits(fl,f==0,**x,gw).is_some()).count()).sum();
     let base=xs.iter().all(|x|fits(&floors[0],true,*x,gw).is_some())||xs.iter().all(|x|floors.iter().skip(1).all(|fl|fits(fl,false,*x,gw).is_some())&&floors.len()>1);
     if base&&hits>0&&pick.as_ref().is_none_or(|(h,_,_,_)|hits>*h){pick=Some((hits,xs,d,uw));}}}}
    if let Some((hits,xs,d,uw))=pick{score+=100.*hits as f64/(floors.len()*total)as f64-d.abs();chosen.push((xs,uw));}}
   if best.as_ref().is_none_or(|(s,_)|score>*s){best=Some((score,chosen));}}
  let(_,chosen)=best.unwrap_or((0.,vec![]));
  for(xs,uw)in chosen{let gw=group_width(group,uw);for x in xs{if let Some(kind)=fits(rs,ground,x,gw){if kind=="bath"{out.push((x-1.,2.,true,2.));}else{let(u,hh)=escape(&kind,uw,lk.height);let(u,n)=if u>uw&&group>1{(uw,group)}else{(u,group)};if holder(rs,len,x-group_width(n,u)/2.,x+group_width(n,u)/2.,&door_span(ground)).is_none(){continue}for(at,w)in units(x,n,u){out.push((at,w,false,hh));}}}}}
  // Upper floors of a symmetric front carry one window over the door.
  if !ground&&lk.mode==Mode::Symmetric&&holder(rs,len,centre-unit/2.,centre+unit/2.,&[]).is_some()&&!out.iter().any(|(a,w,_,_)|*a<centre+unit/2.+0.6&&a+w>centre-unit/2.-0.6){out.push((centre-unit/2.,unit,false,lk.height));}
 },Mode::Rooms=>{
  for r in rs.iter().filter(|r|near(r.z,0.)&&r.kind!="stairs"){let room_len=r.w;let taken=door_span(ground);
   if r.kind=="bath"{let x=r.x+r.w/2.;if holder(rs,len,x-1.,x+1.,&taken).is_some(){out.push((x-1.,2.,true,2.));}continue}
   if quiet(r){if ground{continue}let x=if door_at>=r.x&&door_at+door_w<=r.x+r.w{centre}else{r.x+r.w/2.};let u=lk.unit*k;if room_len>=u+1.2&&holder(rs,len,x-u/2.,x+u/2.,&[]).is_some(){out.push((x-u/2.,u,false,lk.height));}continue}
   let main=social_room(r);let(u,hh)=escape(&r.kind,if main{lk.main_unit*k}else{unit},lk.height);
   // The usable run: inside the room's casings and clear of the house corners.
   let(lo,hi)=((r.x+0.6).max(CORNER),(r.x+r.w-0.6).min(len-CORNER));let room=hi-lo;if room<2.{continue}
   // Mid-century glass walls fill the room; the others repeat their group once per bay of room length.
   let want=if main{lk.main}else{lk.other};let n=if want==0{(((room+MULLION)/(u+MULLION)).floor()as usize).max(1)}else{want};
   let mut n=n;while n>1&&group_width(n,u)>room{n-=1;}let u=if group_width(n,u)>room{room}else{u};if u<2.{continue}let gw=group_width(n,u);
   let groups=if want==0{1}else{((room_len/(lk.bay*1.6)).round()as usize).clamp(1,((room+2.4)/(gw+2.4)).floor().max(1.)as usize)};
   for g in 0..groups{let mut x=lo+room*(g as f64+0.5)/groups as f64;
    // Slide off the door, then give up on this group if it still collides.
    for _ in 0..8{if taken.iter().any(|(s,e)|x-gw/2.<e+0.6&&x+gw/2.>s-0.6){x+=if x<centre{-0.5}else{0.5};}}
    x=x.clamp(lo+gw/2.,hi-gw/2.);if holder(rs,len,x-gw/2.,x+gw/2.,&taken).is_none(){continue}
    for(at,w)in units(x,n,u){out.push((at,w,false,hh));}}}
 }}
 Front{windows:out}}
