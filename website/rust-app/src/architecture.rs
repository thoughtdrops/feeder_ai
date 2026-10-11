use crate::*;
pub fn preset(name:&str)->(f64,f64,f64,&'static str,usize,&'static str){match name{
 "Georgian"=>(48.,40.,8.,"Hip",3,"Poplar Hill: balanced 8:12 hipped form, boxed dentil cornice and formal central circulation"),
 "Victorian"=>(26.,46.,12.,"Queen Anne",8,"Sears No. 114: steep 12:12 hipped mass with two unequal front gables"),
 "Modern farmhouse"=>(30.,32.,10.,"Cross gable",0,"Gordon-Van Tine No. 503 rooms under a steep 10:12 gabled farmhouse roof with tight eaves"),
 "Craftsman"=>(30.,38.,5.,"Cross gable",12,"Sears No. 146: low 5:12 intersecting bungalow gables, deep open eaves and knee braces"),
 "Tudor"=>(26.,28.,12.,"Cross gable",10,"Gordon-Van Tine No. 619: steep 12:12 cross gables, half-timbering and sheltered rooms"),
 "Cape Cod"=>(40.,30.,12.,"Gable",4,"Classic Cape: steep 12:12 side gable with close eaves; plan after the Solomon Howes House"),
 "Colonial"=>(40.,36.,9.,"Gable",5,"Gordon-Van Tine No. 604: 9:12 side gable, cornice returns, balanced facade and central hall"),
 "French country"=>(44.,40.,10.,"Hip",18,"Gordon-Van Tine No. 602: steep 10:12 hipped roof with flared eaves and tall openings"),
 "Scandinavian"=>(28.,44.,10.,"Front gable",21,"Villa Snellman: restrained Nordic classicism; a long 10:12 gable along the house with tight eaves"),
 "Mid-century"=>(54.,28.,0.25,"Low slope",15,"Farnsworth House: low roof, broad glazing and open horizontal form"),
 "Ranch"=>(48.,28.,4.,"Gable",22,"Historic ranch duplex: single-unit adaptation under a shallow side gable"),
 "English cottage"=>(24.,28.,12.,"Clipped gable",27,"Gordon-Van Tine No. 628: steep 12:12 clipped gables, eyebrow dormers and intimate rooms"),
 "Coastal"=>(40.,44.,8.,"Hip",24,"Historic coastal house: deep porch, broad eaves and an 8:12 hipped two-story form"),
 "Industrial"=>(40.,36.,0.25,"Low slope",2,"Historic steel-house precedent adapted to a low-roof wood frame"),
 _=>(52.,32.,0.25,"Low slope",16,"Wiener House: historic modernist precedent, glazing and a low roof")}}
pub fn minimum_depth(c:&Config)->f64{let split;let c=if c.stories==3{split=Config{bedrooms:floor_bedrooms(c,1),..c.clone()};&split}else{c};if c.catalog_plan{if c.width<32.{32_f64.max(c.bedrooms as f64*10.)}else{32_f64.max(((c.bedrooms/2+1)*10)as f64)}}else if c.width<32.{if c.bedrooms>=5{c.bedrooms as f64*12.}else if c.bedrooms==4{32.}else{28.}}else{28_f64.max(((c.bedrooms/2+1)*12)as f64)}}
pub fn reset_edits(c:&mut Config){c.room_wallpapers.clear();c.bearing_walls.clear();c.opening_overrides.clear();c.wall_adjustments.clear();c.wall_removals.clear();c.added_walls.clear();c.deleted_furniture.clear();c.placed_furniture.clear();}
pub fn apply(c:&mut Config,resize:bool){let(w,d,p,_,i,_)=preset(&c.home_style);if resize{c.width=w;c.depth=d;}c.pitch=p;c.layout=if c.catalog_plan{heritage::plan_name(&c.home_style)}else{s(&catalog()["layoutStyles"][i],"name").into()};if c.stories>=2{c.width=c.width.max(24.);c.depth=c.depth.max(minimum_depth(c));}reset_edits(c);}
pub fn info(c:&Config)->Value{let(_,_,_,roof,_,note)=preset(&c.home_style);json!({"source":heritage::source(&c.home_style),"catalogPlan":c.catalog_plan,"roofType":roof,"description":note,"stories":c.stories,"floorHeight":c.wall_height+1.25,"totalHeight":c.stories as f64*(c.wall_height+1.25)-1.25})}
pub fn floor_layout(c:&Config)->Option<(Vec<Room>,Value)>{if c.stories<2||c.design_mode=="Blank slate"{return None}if c.width<32.||c.design_mode=="Affordable"{return Some(compact_floor(c))}let(w,d)=(c.width,c.depth);let idx=n(&lookup("layoutStyles",&c.layout),"index")as usize;let variant=idx%3;let left=(grid((w-16.)*if idx/3%2==0{0.5}else{0.4})).clamp(8.,w-24.);let mut rs=vec![];let mut add=|id:&str,name:&str,kind:&str,x:f64,z:f64,rw:f64,rd:f64|{if rw>0.&&rd>0.{rs.push(Room{id:format!("{}{}",id,floor_tag(c.active_floor)),name:name.into(),kind:kind.into(),x,z,w:rw,d:rd});}};
 // A continuous four-foot hall bypasses the eight-foot switchback stair.
 add("gallery",if c.active_floor>0{"Upper landing"}else{"Entry gallery"},"hall",left,0.,4.,d);
 add("stair","Stairwell","stairs",left+4.,d-16.,8.,16.);
 add("foyer",if c.active_floor>0{"Front landing"}else{"Entry foyer"},"hall",left+4.,0.,8.,4.);add("landing","Stair landing","hall",left+4.,d-20.,8.,4.);add("study",if c.active_floor>0{"Reading room"}else{"Home office"},"flex",left+4.,4.,8.,d-24.);
 add("gallery-right",if c.active_floor>0{"Bedroom gallery"}else{"Side gallery"},"hall",left+12.,0.,4.,d);let wings=[(0.,left),(left+16.,w-left-16.)];
 if c.active_floor==0{for(side,(x,rw))in wings.into_iter().enumerate(){let split=grid(d*if variant==0{0.5}else if variant==1{0.4}else{0.6}).clamp(12.,d-12.);if side==0{add("living","Living room","living",x,0.,rw,split);add("dining","Dining room","dining",x,split,rw,d-split);}else{add("kitchen","Kitchen","kitchen",x,0.,rw,split);let back=d-split;let bw=4.;add("powder","Powder room","bath",x,split,bw,back);add("utility","Laundry & utility","flex",x+bw,split,rw-bw,back);}}}
 else{let bedrooms=c.bedrooms.max(1);let mut number=0;for(side,(x,rw))in wings.into_iter().enumerate(){let nb=if side==0{(bedrooms+1)/2}else{bedrooms/2};let cells=nb+if side==1{1}else{0};let cells=cells.max(1).min((d/8.)as usize);let mut start=0.;for j in 0..cells{let end=if j+1==cells{d}else{grid(d*(j+1)as f64/cells as f64)};if side==1&&j+1==cells{add("bath-upper","Family bathroom","bath",x,start,rw,end-start);}else if number<bedrooms{number+=1;add(&format!("bed{}",number),&format!("{}",if number==1{"Primary bedroom".into()}else{format!("Bedroom {}",number)}),"bedroom",x,start,rw,end-start);}else{add("study-upper","Upstairs study","flex",x,start,rw,end-start);}start=end;}}}
 if idx/3%3==1{for r in &mut rs{r.x=w-r.x-r.w;}}if idx/3%3==2{for r in &mut rs{r.z=d-r.z-r.d;}}
 let beds=rs.iter().filter(|r|r.kind=="bedroom").count();let baths=rs.iter().filter(|r|r.kind=="bath").count();Some((rs.clone(),json!({"rooms":rs,"style":lookup("layoutStyles",&c.layout),"bedrooms":beds,"baths":baths,"gridFeet":2,"program":if c.active_floor==0{"Main floor · living, kitchen, dining & utility"}else if c.active_floor==2{"Third floor · bedrooms, bath and flexible rooms"}else{"Upper floor · bedrooms & family bathroom"},"note":"Aligned switchback stairs and a continuous hall connect both floors. Room dimensions are nominal 2-foot grid dimensions."}))) }

// Eight-foot switchback stairs and a shared four-foot landing fit a 24-foot shell.
fn compact_floor(c:&Config)->(Vec<Room>,Value){
 let (w,d)=(c.width,c.depth);let idx=n(&lookup("layoutStyles",&c.layout),"index")as usize;
 let mut rs=vec![];let mut add=|id:&str,name:&str,kind:&str,x:f64,z:f64,rw:f64,rd:f64|{if rw>0.&&rd>0.{rs.push(Room{id:format!("{}{}",id,floor_tag(c.active_floor)),name:name.into(),kind:kind.into(),x,z,w:rw,d:rd});}};
 if c.bedrooms>=5{
  let wing=w-12.;add("gallery","Continuous gallery","hall",wing,0.,4.,d);add("stair","Stairwell","stairs",wing+4.,d-16.,8.,16.);
  if c.active_floor==0{let split=grid(d*0.5);add("living","Living & dining","living",0.,0.,wing,split);add("dining","Dining room","dining",0.,split,wing,d-split);add("kitchen","Kitchen","kitchen",wing+4.,0.,8.,d-28.);add("powder","Powder room","bath",wing+4.,d-28.,8.,8.);add("landing","Stair landing","hall",wing+4.,d-20.,8.,4.);}
  else{let mut z=0.;for j in 0..c.bedrooms{let end=if j+1==c.bedrooms{d}else{grid(d*(j+1)as f64/c.bedrooms as f64)};add(&format!("bed{}",j+1),&if j==0{"Primary bedroom".into()}else{format!("Bedroom {}",j+1)},"bedroom",0.,z,wing,end-z);z=end;}add("bath-upper","Family bathroom","bath",wing+4.,0.,8.,12.);add("study","Upstairs study","flex",wing+4.,12.,8.,d-32.);add("landing","Stair landing","hall",wing+4.,d-20.,8.,4.);}
 }else{
  let wing=w-8.;let front=d-20.;add("gallery",if c.active_floor==0{"Shared gallery"}else{"Upper landing"},"hall",0.,front,w,4.);add("stair","Stairwell","stairs",wing,d-16.,8.,16.);
  if c.active_floor==0{add("living","Living room","living",0.,0.,wing,front);add("kitchen","Kitchen","kitchen",wing,0.,8.,front);add("dining","Dining room","dining",0.,d-16.,wing,8.);add("utility","Laundry & utility","flex",0.,d-8.,wing-8.,8.);add("powder","Powder room","bath",wing-8.,d-8.,8.,8.);}
  else{let beds=c.bedrooms.max(1);let nf=if beds<=2{1}else{beds-2};let mut x=0.;for j in 0..nf{let end=if j+1==nf{wing}else{grid(wing*(j+1)as f64/nf as f64)};add(&format!("bed{}",j+1),&if j==0{"Primary bedroom".into()}else{format!("Bedroom {}",j+1)},"bedroom",x,0.,end-x,front);x=end;}add("bath-upper","Family bathroom","bath",wing,0.,8.,front);let nb=beds-nf;let cells=nb.max(1);let mut x=0.;for j in 0..cells{let end=if j+1==cells{wing}else{grid(wing*(j+1)as f64/cells as f64)};let id=if nb==0{"study".into()}else{format!("bed{}",nf+j+1)};let name=if nb==0{"Upstairs study".into()}else{format!("Bedroom {}",nf+j+1)};add(&id,&name,if nb==0{"flex"}else{"bedroom"},x,d-16.,end-x,16.);x=end;}}
 }
 if idx/3%2==1{for r in &mut rs{r.x=w-r.x-r.w;}}if idx/6%2==1{for r in &mut rs{r.z=d-r.z-r.d;}}
 let beds=rs.iter().filter(|r|r.kind=="bedroom").count();let baths=rs.iter().filter(|r|r.kind=="bath").count();(rs.clone(),json!({"rooms":rs,"style":lookup("layoutStyles",&c.layout),"bedrooms":beds,"baths":baths,"gridFeet":2,"program":if c.active_floor==0{"Main floor · living, kitchen, dining & utility"}else if c.active_floor==2{"Third floor · bedrooms, bath and flexible rooms"}else{"Upper floor · bedrooms & family bathroom"},"note":"Compact eight-foot switchback stair with a shared four-foot landing; bedrooms are upstairs. Nominal room dimensions follow the two-foot grid; clear dimensions and final stair details require local review."}))
}
