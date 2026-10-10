use crate::*;
type P=[f64;2];
fn polygon_area(p:&[P])->f64{if p.len()<3{return 0.} (0..p.len()).map(|i|p[i][0]*p[(i+1)%p.len()][1]-p[(i+1)%p.len()][0]*p[i][1]).sum::<f64>().abs()/2.}
fn clip(p:&[P],a:f64,b:f64,k:f64)->Vec<P>{
    let mut out=vec![];if p.len()<3{return out}
    for i in 0..p.len(){let u=p[i];let v=p[(i+1)%p.len()];let fu=a*u[0]+b*u[1]+k;let fv=a*v[0]+b*v[1]+k;if fu<=1e-8{out.push(u)}if (fu<0.)!=(fv<0.){let t=fu/(fu-fv);out.push([u[0]+t*(v[0]-u[0]),u[1]+t*(v[1]-u[1])]);}}
    out.dedup_by(|a,b|near(a[0],b[0])&&near(a[1],b[1]));out
}
fn subtract(poly:&[P],hole:&[P])->Vec<Vec<P>>{
    let signed=(0..hole.len()).map(|i|hole[i][0]*hole[(i+1)%hole.len()][1]-hole[(i+1)%hole.len()][0]*hole[i][1]).sum::<f64>();
    let mut remaining=poly.to_vec();let mut out=vec![];
    for i in 0..hole.len(){let p=hole[i];let q=hole[(i+1)%hole.len()];let sign=if signed>0.{1.}else{-1.};let a=(q[1]-p[1])*sign;let b=-(q[0]-p[0])*sign;let k=-a*p[0]-b*p[1];let outside=clip(&remaining,-a,-b,-k);if polygon_area(&outside)>1e-6{out.push(outside)}remaining=clip(&remaining,a,b,k);if polygon_area(&remaining)<1e-6{break}}
    out
}
fn inside(p:P,poly:&[P])->bool{let mut pos=false;let mut neg=false;for i in 0..poly.len(){let a=poly[i];let b=poly[(i+1)%poly.len()];let k=(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);pos|=k>1e-5;neg|=k< -1e-5;}!(pos&&neg)}
fn arr(v:&Value)->[f64;3]{[v[0].as_f64().unwrap(),v[1].as_f64().unwrap(),v[2].as_f64().unwrap()]}
fn poly(f:&Value)->Vec<P>{f["points"].as_array().unwrap().iter().map(|v|[v[0].as_f64().unwrap(),v[2].as_f64().unwrap()]).collect()}
fn y(plane:[f64;3],h:f64,p:P)->f64{h+plane[0]*p[0]+plane[1]*p[1]+plane[2]}

// Intersection of a line segment with a convex opening, parameterized 0..1.
fn interval(a:P,b:P,hole:&[P])->Option<(f64,f64)>{
    let signed=(0..hole.len()).map(|i|hole[i][0]*hole[(i+1)%hole.len()][1]-hole[(i+1)%hole.len()][0]*hole[i][1]).sum::<f64>();
    let sign=if signed>0.{1.}else{-1.};let(mut lo,mut hi)=(0_f64,1_f64);
    for i in 0..hole.len(){let p=hole[i];let q=hole[(i+1)%hole.len()];let f=|r:P|sign*((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]));let start=f(a);let delta=f(b)-start;
        if delta.abs()<1e-9{if start< -1e-8{return None}}else{let t=-start/delta;if delta>0.{lo=lo.max(t)}else{hi=hi.min(t)}}
    }
    if hi>lo+1e-8{Some((lo,hi))}else{None}
}

fn cut_rafters(stock:&[Value],holes:&[Vec<P>])->Vec<Value>{
    let mut result=vec![];
    for r in stock{let a=[n(r,"x1"),n(r,"z1")];let b=[n(r,"x2"),n(r,"z2")];let mut spans:Vec<(f64,f64)>=vec![(0.,1.)];
        for hole in holes{if let Some((lo,hi))=interval(a,b,hole){spans=spans.into_iter().flat_map(|(u,v)|{let mut out=vec![];if lo>u{out.push((u,v.min(lo)))}if hi<v{out.push((u.max(hi),v))}out}).filter(|(u,v)|v-u>1e-8).collect();}}
        let unchanged=spans.len()==1&&near(spans[0].0,0.)&&near(spans[0].1,1.);
        for(i,(u,v))in spans.iter().enumerate(){if (v-u)*n(r,"length")<0.1{continue}let mut piece=r.clone();
            for (start,end)in[("x1","x2"),("y1","y2"),("z1","z2")]{let lo=n(r,start);let delta=n(r,end)-lo;piece[start]=json!(lo+u*delta);piece[end]=json!(lo+v*delta);}
            piece["x"]=piece["x1"].clone();piece["length"]=json!((v-u)*n(r,"length"));piece["stockSourceId"]=r["id"].clone();piece["stockBasis"]=json!("Shared original rafter blank; interrupted cuts do not create additional full-stock orders.");
            if !unchanged{piece["id"]=json!(format!("{}-CUT{}",s(r,"id"),i+1));}result.push(piece);
        }
    }result
}

fn opening_members(id:&str,holes:&[Vec<P>],parent:[f64;3],height:f64)->Vec<Value>{
    let mut edges:Vec<(P,P)>=vec![];
    // Adjacent dormer facets share an internal edge; only the union boundary
    // receives doubled schematic LVL opening members.
    for hole in holes{for i in 0..hole.len(){let a=hole[i];let b=hole[(i+1)%hole.len()];let same=|p:P,q:P|near(p[0],q[0])&&near(p[1],q[1]);
        if let Some(index)=edges.iter().position(|(u,v)|(same(*u,a)&&same(*v,b))||(same(*u,b)&&same(*v,a))){edges.remove(index);}else{edges.push((a,b));}
    }}
    let mut out=vec![];
    for (edge,(a,b))in edges.iter().enumerate(){let plan_len=((b[0]-a[0]).powi(2)+(b[1]-a[1]).powi(2)).sqrt();if plan_len<0.1{continue}let normal=[-(b[1]-a[1])/plan_len,(b[0]-a[0])/plan_len];
        for ply in 0..2{let offset=(ply as f64-0.5)*1.75/12.;let pa=[a[0]+normal[0]*offset,y(parent,height,*a)-0.62,a[1]+normal[1]*offset];let pb=[b[0]+normal[0]*offset,y(parent,height,*b)-0.62,b[1]+normal[1]*offset];let length=(0..3).map(|i|(pa[i]-pb[i]).powi(2)).sum::<f64>().sqrt();
            out.push(json!({"id":format!("{}-OPEN{}-PLY{}",id,edge+1,ply+1),"wallId":id,"group":"Roof features","role":"Dormer roof-opening LVL ply","material":"LVL · grade/depth pending","x1":pa[0],"y1":pa[1],"z1":pa[2],"x2":pb[0],"y2":pb[1],"z2":pb[2],"width":1.75/12.,"depth":1.,"length":length,"stockLength":(length/2.).ceil()*2.,"status":"Schematic opening support; sizing, bearings and connections require engineering"}));
        }
    }out
}

pub fn apply(c:&Config,m:&mut Value,t:&mut model::Takeoff){
    let requested=if c.dormer_style=="None"{0}else{c.dormer_count};let mut notes=vec![];let mut dormers=vec![];
    if requested==0{m["dormers"]=json!([]);m["dormerNotes"]=json!([]);return}
    let original=m["roof"].clone();let base_facets=original["facets"].as_array().unwrap();let width=c.dormer_width;let depth=c.dormer_depth;
    let kind=if c.dormer_style=="Style matched"{if ["Ranch","Contemporary","Mid-century","Industrial","Coastal"].contains(&c.home_style.as_str()){"Shed"}else if c.home_style=="French country"{"Hip"}else{"Gable"}}else{&c.dormer_style};
    let roof_pitch=if kind=="Shed"{2./12.}else{(c.pitch/12.).clamp(0.25,0.75)};
    let min_head=if width<=2.{3.7}else{4.7};
    let mut candidates=vec![];
    for side in ["Front","Rear","Left","Right"]{
        if c.dormer_side!="Automatic"&&c.dormer_side!=side{continue}
        let (dir,tan,run,total) = match side{"Front"=>([0.,1.],[1.,0.],c.depth,c.width),"Rear"=>([0.,-1.],[-1.,0.],c.depth,c.width),"Left"=>([1.,0.],[0.,-1.],c.width,c.depth),_=>([-1.,0.],[0.,1.],c.width,c.depth)};
        if depth+4.>run||width+4.>total{continue}
        for facet in base_facets{
            let plane=arr(&facet["plane"]);let slope=plane[0]*dir[0]+plane[1]*dir[1];
            if slope<0.15||(plane[0]*tan[0]+plane[1]*tan[1]).abs()>1e-6{continue}
            let peak=if kind=="Gable"||kind=="Hip"{width/2.*roof_pitch}else{0.};
            let head=if kind=="Shed"{(slope-roof_pitch)*depth}else{slope*depth-peak};
            if head<min_head||head>12.{continue}
            for start in 2..=(total-width-2.).floor()as usize{
                let start=start as f64;
                let origin=match side{"Front"=>[start,2.],"Rear"=>[c.width-start,c.depth-2.],"Left"=>[2.,c.depth-start],_=>[c.width-2.,start]};
                let corners=[[0.,0.],[width,0.],[width,depth],[0.,depth]].map(|p|[origin[0]+tan[0]*p[0]+dir[0]*p[1],origin[1]+tan[1]*p[0]+dir[1]*p[1]]);
                // Collinear facets may be split by the architectural roof generator.
                let same:Vec<_>=base_facets.iter().filter(|f|arr(&f["plane"]).iter().zip(plane).all(|(a,b)|near(*a,b))).collect();
                let covered=|p:P|same.iter().any(|f|inside(p,&poly(f)));
                let sample_ok=(0..=4).all(|u|(0..=4).all(|v|covered([origin[0]+tan[0]*width*u as f64/4.+dir[0]*depth*v as f64/4.,origin[1]+tan[1]*width*u as f64/4.+dir[1]*depth*v as f64/4.])));
                if !sample_ok{continue}
                let score=(start+width/2.-total/2.).abs()+if side=="Front"{0.}else if side=="Rear"{50.}else{100.};
                candidates.push((score,side,origin,dir,tan,plane,head,corners));
            }
        }
    }
    // Select complete, centered rows before creating geometry. The old greedy
    // center-first choice clustered dormers and could make an asymmetric row.
    // Each row is on one compatible plane; existing coverage tests keep it clear
    // of hip/valley boundaries and its two-foot construction margin.
    let start_of=|side:&str,p:P|match side{"Front"=>p[0],"Rear"=>c.width-p[0],"Left"=>c.depth-p[1],_=>p[1]};
    candidates.sort_by(|a,b|a.0.total_cmp(&b.0));let mut selected=vec![];
    for side in ["Front","Rear","Left","Right"]{
        if selected.len()>=requested{break}let total=if ["Front","Rear"].contains(&side){c.width}else{c.depth};
        let rows:Vec<_>=candidates.iter().enumerate().filter(|(_,v)|v.1==side).collect();
        let capacity=((total-4.+2.)/(width+2.)).floor().max(0.)as usize;
        for count in (1..=(requested-selected.len()).min(capacity)).rev(){
            let mut best:Option<(f64,Vec<usize>)>=None;
            for (first_index,first) in &rows{
                let start=start_of(side,first.2);let max_step=if count==1{width+2.}else{(total-2.-width-start)/(count-1)as f64};
                for spacing in ((width+2.)as usize..=max_step.floor()as usize).step_by(2){
                    let mut row=vec![];for i in 0..count{let wanted=start+i as f64*spacing as f64;
                        if let Some((index,_))=rows.iter().find(|(_,v)|near(start_of(side,v.2),wanted)&&v.5.iter().zip(first.5).all(|(a,b)|near(*a,b))){row.push(*index)}
                    }
                    if row.len()!=count{continue}
                    let conflict=row.iter().any(|i|{let a=&candidates[*i].7;selected.iter().any(|j:&usize|{let b=&candidates[*j].7;let bounds=|ps:&[P;4],axis:usize|(ps.iter().map(|p|p[axis]).fold(f64::INFINITY,f64::min),ps.iter().map(|p|p[axis]).fold(f64::NEG_INFINITY,f64::max));let(ax,bx)=bounds(a,0);let(az,bz)=bounds(a,1);let(cx,dx)=bounds(b,0);let(cz,dz)=bounds(b,1);ax<dx+2.&&bx>cx-2.&&az<dz+2.&&bz>cz-2.})});
                    if conflict{continue}
                    let center=start+width/2.+(count-1)as f64*spacing as f64/2.;let balance=(center-total/2.).abs();
                    let ideal=total/(count+1)as f64;let score=balance*100.+(spacing as f64-ideal).abs();
                    if best.as_ref().is_none_or(|b|score<b.0){best=Some((score,row));}
                    if count==1{break}
                }
                let _=first_index;
            }
            if let Some((_,row))=best{selected.extend(row);break}
        }
    }
    let chosen:Vec<_>=selected.into_iter().map(|i|candidates[i].clone()).collect();
    for(_,side,origin,dir,tan,parent,head,corners)in chosen{
        if dormers.len()>=requested{break}
        let lo=[corners.iter().map(|p|p[0]).fold(f64::INFINITY,f64::min),corners.iter().map(|p|p[1]).fold(f64::INFINITY,f64::min)];let hi=[corners.iter().map(|p|p[0]).fold(f64::NEG_INFINITY,f64::max),corners.iter().map(|p|p[1]).fold(f64::NEG_INFINITY,f64::max)];
        if dormers.iter().any(|d:&Value|{let b=&d["bounds"];lo[0]<n(b,"maxX")+2.&&hi[0]>n(b,"minX")-2.&&lo[1]<n(b,"maxZ")+2.&&hi[1]>n(b,"minZ")-2.}){continue}
        let id=format!("DORMER-{}",dormers.len()+1);let base=y(parent,c.wall_height,origin);let slope=parent[0]*dir[0]+parent[1]*dir[1];
        let transform=|u:f64,v:f64,h:f64|[origin[0]+tan[0]*u+dir[0]*v,h,origin[1]+tan[1]*u+dir[1]*v];
        let ww=if width<=2.{1.}else if width<=4.{2.}else{4.};let wh=if width<=2.{2.}else{3.};let bottom=0.8;
        let openings=if width==16.{vec![Opening{id:format!("{}-W1",id),kind:"window".into(),at:2.,width:ww,bottom,height:wh},Opening{id:format!("{}-W2",id),kind:"window".into(),at:10.,width:ww,bottom,height:wh}]}else{vec![Opening{id:format!("{}-W1",id),kind:"window".into(),at:(width-ww)/2.,width:ww,bottom,height:wh}]};
        let local_planes=if kind=="Shed"{vec![[0.,roof_pitch,0.]]}else if kind=="Hip"{vec![[roof_pitch,0.,0.],[-roof_pitch,0.,width*roof_pitch],[0.,roof_pitch,0.]]}else{vec![[roof_pitch,0.,0.],[-roof_pitch,0.,width*roof_pitch]]};
        let mut facets=vec![];let mut holes=vec![];let mut area=0.;
        for(i,p)in local_planes.iter().enumerate(){
            let mut shape=vec![[0.,0.],[width,0.],[width,depth],[0.,depth]];
            for(qi,q)in local_planes.iter().enumerate(){if qi!=i{shape=clip(&shape,p[0]-q[0],p[1]-q[1],p[2]-q[2]);}}
            // The dormer roof stops exactly at its intersection with the main roof.
            shape=clip(&shape,-p[0],slope-p[1],-head-p[2]);if polygon_area(&shape)<1e-6{continue}
            let a=p[0]*tan[0]+p[1]*dir[0];let b=p[0]*tan[1]+p[1]*dir[1];let k=base+head+p[2]-c.wall_height-a*origin[0]-b*origin[1];
            let points:Vec<_>=shape.iter().map(|q|transform(q[0],q[1],base+head+p[0]*q[0]+p[1]*q[1]+p[2])).collect();
            area+=polygon_area(&shape)*(1.+p[0]*p[0]+p[1]*p[1]).sqrt();holes.push(shape.iter().map(|q|[origin[0]+tan[0]*q[0]+dir[0]*q[1],origin[1]+tan[1]*q[0]+dir[1]*q[1]]).collect::<Vec<_>>());
            facets.push(json!({"id":format!("{}-roof-{}",id,i),"points":points,"plane":[a,b,k],"area":polygon_area(&shape)*(1.+p[0]*p[0]+p[1]*p[1]).sqrt()}));
        }
        let side_depth=(head/slope).min(depth);let wall_area=width*head+side_depth*head;
        let gable_rise=if kind=="Gable"{width*roof_pitch/2.}else{0.};let front_infill=width*gable_rise/2.;
        let mut cc=c.clone();cc.width=width;cc.depth=side_depth;cc.wall_height=head;cc.stories=2;cc.active_floor=0;
        let ws=vec![Wall{id:format!("{}-FRONT",id),name:"Dormer front".into(),x:0.,z:0.,length:width,axis:"x".into(),exterior:true,openings:openings.clone()},Wall{id:format!("{}-LEFT",id),name:"Dormer left cheek".into(),x:0.,z:0.,length:side_depth,axis:"z".into(),exterior:true,openings:vec![]},Wall{id:format!("{}-RIGHT",id),name:"Dormer right cheek".into(),x:width,z:0.,length:side_depth,axis:"z".into(),exterior:true,openings:vec![]}];
        let mut members=vec![];
        for mut member in frame::build(&ws,&cc){
            if !member.wall_id.ends_with("FRONT"){
                if member.role=="Bottom plate"{member.y1=slope*member.z1;member.y2=slope*member.z2;}
                else if near(member.x1,member.x2)&&near(member.z1,member.z2){member.y1=member.y1.max(slope*member.z1+0.125);if member.y2-member.y1<0.015{continue}}
            }
            member.length=((member.x1-member.x2).powi(2)+(member.y1-member.y2).powi(2)+(member.z1-member.z2).powi(2)).sqrt();member.stock_length=[8.,10.,12.,16.,20.].into_iter().find(|l|*l>=member.length-1e-8).unwrap_or((member.length/2.).ceil()*2.);
            if tan[0].abs()<0.5&&near(member.x1,member.x2)&&near(member.z1,member.z2){std::mem::swap(&mut member.width,&mut member.depth);}
            let a=transform(member.x1,member.z1,base+member.y1);let b=transform(member.x2,member.z2,base+member.y2);member.x1=a[0];member.y1=a[1];member.z1=a[2];member.x2=b[0];member.y2=b[1];member.z2=b[2];
            let mut v=serde_json::to_value(member).unwrap();v["group"]=json!("Roof features");members.push(v);
        }
        if gable_rise>0.{for u in (2..width as usize).step_by(2){let u=u as f64;let len=roof_pitch*u.min(width-u);let a=transform(u,0.,base+head);let b=transform(u,0.,base+head+len);members.push(json!({"id":format!("{}-G{}",id,u),"wallId":format!("{}-FRONT",id),"role":"Gable","material":if c.stud_type=="LSL studs"{"LSL 2x6"}else{"2x6"},"group":"Roof features","x1":a[0],"y1":a[1],"z1":a[2],"x2":b[0],"y2":b[1],"z2":b[2],"width":if tan[0].abs()>0.5{0.125}else{5.5/12.},"depth":if tan[0].abs()>0.5{5.5/12.}else{0.125},"length":len,"stockLength":8.}));}}
        let mut rafters=vec![];for facet in &facets{
            let ps=arr(&facet["plane"]);let local=poly(facet);
            // Shed rafters run uphill; gable rafters run across their ridge.
            let run_tangent=(ps[0]*tan[0]+ps[1]*tan[1]).abs()>(ps[0]*dir[0]+ps[1]*dir[1]).abs();
            let (station_axis,run_axis,limit)=if run_tangent{(dir,tan,depth)}else{(tan,dir,width)};
            for station in 0..=(limit/(16./12.)).ceil()as usize{let v=(station as f64*(16./12.)).min(limit);let mut hits=vec![];
                for j in 0..local.len(){let a=local[j];let b=local[(j+1)%local.len()];let va=(a[0]-origin[0])*station_axis[0]+(a[1]-origin[1])*station_axis[1];let vb=(b[0]-origin[0])*station_axis[0]+(b[1]-origin[1])*station_axis[1];if near(va,vb){if near(v,va){hits.extend([a,b]);}}else{let t=(v-va)/(vb-va);if (0.0..=1.0).contains(&t){hits.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}}
                hits.sort_by(|a,b|(a[0]*run_axis[0]+a[1]*run_axis[1]).total_cmp(&(b[0]*run_axis[0]+b[1]*run_axis[1])));
                if hits.len()<2{continue}let a=hits[0];let b=*hits.last().unwrap();let ya=y(ps,c.wall_height,a);let yb=y(ps,c.wall_height,b);let length=((a[0]-b[0]).powi(2)+(a[1]-b[1]).powi(2)+(ya-yb).powi(2)).sqrt();if length>0.1{rafters.push(json!({"id":format!("{}-R{}",id,rafters.len()+1),"x1":a[0],"y1":ya,"z1":a[1],"x2":b[0],"y2":yb,"z2":b[1],"length":length,"stockLength":(length/2.).ceil()*2.}));}
            }
        }
        let cheek=|u:f64|vec![transform(u,0.,base),transform(u,side_depth,base+slope*side_depth),transform(u,0.,base+head)];
        let supports=opening_members(&id,&holes,parent,c.wall_height);
        dormers.push(json!({"id":id,"kind":kind,"side":side,"width":width,"depth":depth,"height":head,"baseY":base,"origin":origin,"direction":dir,"tangent":tan,"roofPitch":roof_pitch,"cheekDepth":side_depth,"openings":openings,"frontInfill":front_infill,"gableRise":gable_rise,"cheeks":[cheek(0.),cheek(width)],"facets":facets,"holes":holes,"roofArea":area,"wallArea":wall_area+front_infill,"members":members,"rafters":rafters,"supportMembers":supports,"bounds":{"minX":lo[0],"minZ":lo[1],"maxX":hi[0],"maxZ":hi[1]},"note":"Roof-space dormer; no extra habitable floor area assumed. Window escape capacity, supporting beams and weather detailing require final design."}));
    }
    if dormers.len()<requested{notes.push(format!("{} of {} dormers fit this roof. Try a smaller width, greater depth, steeper main pitch or Automatic placement. Modules must fit a continuous roof plane and meet it without a floating back wall.",dormers.len(),requested));}
    let mut main_facets=vec![];let mut removed_area=0.;
    for facet in base_facets{let ps=arr(&facet["plane"]);let mut shapes=vec![poly(facet)];let original_area=polygon_area(&shapes[0]);
        for d in &dormers{for hole in d["holes"].as_array().unwrap(){let hole:Vec<P>=serde_json::from_value(hole.clone()).unwrap();shapes=shapes.iter().flat_map(|p|subtract(p,&hole)).collect();}}
        let retained:f64=shapes.iter().map(|p|polygon_area(p)).sum();removed_area+=(original_area-retained).max(0.)*(1.+ps[0]*ps[0]+ps[1]*ps[1]).sqrt();
        for(shape_index,shape)in shapes.into_iter().enumerate(){if polygon_area(&shape)<1e-6{continue}main_facets.push(json!({"id":format!("{}-retained-{}",s(facet,"id"),shape_index),"points":shape.iter().map(|p|[p[0],y(ps,c.wall_height,*p),p[1]]).collect::<Vec<_>>(),"plane":ps,"area":polygon_area(&shape)*(1.+ps[0]*ps[0]+ps[1]*ps[1]).sqrt()}));}
    }
    let added_area:f64=dormers.iter().map(|d|n(d,"roofArea")).sum();let delta=added_area-removed_area;
    let mut adjusted=original.clone();adjusted["facets"]=json!(main_facets);adjusted["area"]=json!(n(&original,"area")-removed_area+added_area);
    let original_stock=original["rafters"].as_array().unwrap().clone();
    let holes:Vec<Vec<P>>=dormers.iter().flat_map(|d|d["holes"].as_array().unwrap()).map(|v|serde_json::from_value(v.clone()).unwrap()).collect();
    let retained_rafters=cut_rafters(&original_stock,&holes);adjusted["rafters"]=json!(retained_rafters);
    // Keep original stock for interrupted main rafters: cutting does not refund
    // already ordered blanks. Separate doubled opening headers/trimmers are added.
    for d in &dormers{
        let mut buckets:BTreeMap<(String,usize),usize>=BTreeMap::new();
        for member in d["members"].as_array().unwrap(){*buckets.entry((s(member,"material").into(),n(member,"stockLength")as usize)).or_default()+=1;}
        for((material,stock),count)in buckets{let rate=if material=="LSL 2x6"{1.8}else if material=="2x8"{1.6}else{1.1};
            t.add(&format!("{}-frame-{}-{}",s(d,"id"),material,stock),"Roof features",&format!("Dormer {} × {} ft stock blanks",material,stock),count as f64,"boards",stock as f64*rate,"One stock blank per enumerated member, no offcut reuse. Window header sizes are provisional; LSL selection applies to studs only.","Modeled members",true,true);
        }
        let mut stocks:BTreeMap<usize,usize>=BTreeMap::new();for r in d["rafters"].as_array().unwrap(){*stocks.entry(n(r,"stockLength")as usize).or_default()+=1;}
        for(stock,count)in stocks{t.add(&format!("{}-rafters-{}",s(d,"id"),stock),"Roof features",&format!("Dormer I-joist rafters · {} ft stock",stock),count as f64,"pieces",stock as f64*6.5,"16 in stations, 16 in depth, cut to actual roof planes; manufacturer sizing and bearing pending.","Modeled members",true,true);}
        let opening_lf:f64=d["supportMembers"].as_array().unwrap().iter().map(|r|n(r,"stockLength")).sum();
        let opening_area:f64=d["openings"].as_array().unwrap().iter().map(|o|n(o,"width")*n(o,"height")).sum();let wall_net=(n(d,"wallArea")-opening_area).max(0.);
        for(id,name,net,unit,price,whole)in[
            ("envelope",if n(&m["profile"],"continuousR")>0.{"Dormer ZIP-R R-6 wall panels · 4 × 8"}else{"Dormer ZIP wall panels · 4 × 8"},wall_net/32.,"sheets",if n(&m["profile"],"continuousR")>0.{85.}else{29.49},true),
            ("siding","Dormer cladding",wall_net,"sq ft",catalog()["claddingPrices"][&c.siding].as_f64().unwrap_or(4.5),false),
            ("insulation","Dormer R-21 kraft-faced fiberglass batts",wall_net*0.82,"sq ft",1.3,false),
            ("wall-drywall","Dormer 1/2 in pre-painted wall drywall · 4 × 16",wall_net/64.,"sheets",34.,true),
            ("ceiling-drywall","Dormer 5/8 in pre-painted ceiling drywall · 4 × 16",n(d,"roofArea")/64.,"sheets",44.,true),
            ("headers","Doubled LVL roof-opening header / trimmer stock",opening_lf,"ply linear ft",8.,false),
            ("flashing","Dormer step / head / valley flashing",2.*c.dormer_depth+c.dormer_width,"linear ft",12.,false),
            ("tape","Dormer ZIP / window flashing tape · 90 ft",(wall_net*0.375+2.*c.dormer_depth+4.*c.dormer_width)/90.,"rolls",43.,true),
            ("connectors","Dormer rafter / opening connection sets",d["rafters"].as_array().unwrap().len()as f64*2.+8.,"sets",18.,true),
            ("trim","Dormer window / rake / corner sealed wood trim",d["openings"].as_array().unwrap().iter().map(|o|2.*(n(o,"width")+n(o,"height"))).sum::<f64>()+2.*c.dormer_width+2.*c.dormer_depth+4.*n(d,"height"),"linear ft",5.5,false),
        ]{t.add(&format!("{}-{}",s(d,"id"),id),"Roof features",name,net,unit,price,if id=="insulation"{"82% of net dormer wall surface is a provisional cavity-area allowance; framing displacement and batt cutting need final detailing."}else{"Derived from displayed dormer geometry. Attic finish allowance; no added habitable area. Final roof opening, load path and weather/ventilation detailing require review."},"Dormer geometry allowance",true,whole);}
        t.add(&format!("{}-wallfasteners",s(d,"id")),"Roof features","Dormer ZIP wall fasteners · 2,000 pack",wall_net*2.5/2000.,"packs",75.,"2.5 fasteners per sq ft estimating allowance; engineer/manufacturer schedule pending.","Fastener allowance",true,true);
        t.add(&format!("{}-framenails",s(d,"id")),"Roof features","Dormer framing nails · 50 lb",(n(d,"width")+2.*n(d,"cheekDepth"))/220.,"boxes",65.,"Wall-run nail allowance, one 50 lb box per 220 linear ft; roof framing connections itemized separately.","Fastener allowance",true,true);
        t.add(&format!("{}-trimsealer",s(d,"id")),"Roof features","Dormer wood trim sealer · two coats",(2.*n(d,"width")+2.*n(d,"depth")+4.*n(d,"height")+d["openings"].as_array().unwrap().iter().map(|o|2.*(n(o,"width")+n(o,"height"))).sum::<f64>())*0.8*2./350.,"gallons",65.,"Nominal trim profile surface allowance on all faces, two coats at 350 sq ft per gallon; confirm profile and coating coverage.","Coating allowance",true,true);
        for o in d["openings"].as_array().unwrap(){t.add(&format!("{}-unit",s(o,"id")),"Roof features","Dormer window unit",1.,"unit",(n(o,"width")*n(o,"height")*65.).max(200.),"Actual dormer opening size; retail allowance, no bedroom escape claim.","Window allowance",false,true);}
    }
    for i in m["items"].as_array_mut().unwrap(){let change=match s(i,"id"){"ziproof"=>delta/32.,"roofmetal"|"underlay"=>delta,"roofclips"=>delta/2.,"zipfasteners"=>delta*2.5/2000.,"ziptape"=>delta*0.375/90.,_=>0.};if change.abs()>1e-6{i["rawNet"]=json!((n(i,"rawNet")+change).max(0.));pricing::recalc_item(i,c);}}
    let members:Vec<_>=dormers.iter().flat_map(|d|d["members"].as_array().unwrap().iter().cloned()).collect();
    let supports:Vec<_>=dormers.iter().flat_map(|d|d["supportMembers"].as_array().unwrap().iter().cloned()).collect();
    let child_rafters:Vec<_>=dormers.iter().flat_map(|d|d["rafters"].as_array().unwrap().iter().cloned()).collect();
    let stud=|v:&Value|["Common","King","Jack","Cripple","Corner backing","Gable"].contains(&s(v,"role"));
    for(key,extra)in[("studs",members.iter().filter(|v|stud(v)).count()),("exteriorStuds",members.iter().filter(|v|stud(v)).count()),("wallFramePieces",members.len()),("headerPlies",members.iter().filter(|v|s(v,"role")=="Header ply").count()),("sills",members.iter().filter(|v|s(v,"role")=="Rough sill").count()),("platePieces",members.iter().filter(|v|s(v,"role").contains("plate")).count()),("windows",dormers.iter().map(|d|d["openings"].as_array().unwrap().len()).sum()),("headers",dormers.iter().map(|d|d["openings"].as_array().unwrap().len()).sum())]{m["counts"][key]=json!(n(&m["counts"],key)+extra as f64);}
    for member in members.iter().filter(|v|stud(v)){m["piecesByRole"][s(member,"role")]=json!(n(&m["piecesByRole"],s(member,"role"))+1.);}
    m["counts"]["rafters"]=json!(n(&m["counts"],"rafters")-original_stock.len()as f64+retained_rafters.len()as f64+child_rafters.len()as f64);
    m["counts"]["mainRafterStockPieces"]=json!(original_stock.len());m["counts"]["dormerFramePieces"]=json!(members.len());m["counts"]["dormerOpeningPlies"]=json!(supports.len());
    let finish_walls:f64=dormers.iter().map(|d|{n(d,"wallArea")-d["openings"].as_array().unwrap().iter().map(|o|n(o,"width")*n(o,"height")).sum::<f64>()}).sum();
    let finish_area=finish_walls+added_area;
    for i in m["items"].as_array_mut().unwrap(){let extra=match s(i,"id"){"compound"=>finish_area/450.,"drywalltape"=>finish_area*0.35/500.,"drywallscrews"=>finish_area/1000.,"primer"=>finish_area/350.,"paint"=>finish_area*2./350.,_=>0.};if extra>0.{i["rawNet"]=json!(n(i,"rawNet")+extra);pricing::recalc_item(i,c);}}
    m["dormerDrywallArea"]=json!(finish_walls+added_area);m["drywallWalls"]=json!(round(n(m,"drywallWalls")+finish_walls));m["drywallCeiling"]=json!(round(n(m,"drywallCeiling")+added_area));m["drywallTotal"]=json!(round(n(m,"drywallWalls")+n(m,"drywallCeiling")));
    let top=c.stories-1;m["roof"]=adjusted.clone();m["roofArea"]=json!(round(n(m,"roofArea")+delta));m["rafters"]=json!(retained_rafters);m["mainRafterStock"]=json!(original_stock);m["dormerFrameMembers"]=json!(members);m["dormerOpeningMembers"]=json!(supports);m["dormerRafters"]=json!(child_rafters);m["dormers"]=json!(dormers);m["dormerPlacement"]=json!("Centered rows on continuous roof slopes, at least 2 ft between module envelopes and eave/ridge/hip boundaries; no seeded random placement.");m["dormerNotes"]=json!(notes);m["dormerRoofRemovedArea"]=json!(removed_area);
    if c.stories==2{m["levels"][top]["roof"]=adjusted;m["levels"][top]["roofArea"]=m["roof"]["area"].clone();for key in["dormers","rafters"]{m["levels"][top][key]=m[key].clone();}}
}
