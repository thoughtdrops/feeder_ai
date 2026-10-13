use crate::*;
// Roof covering choices. Ribbed metal over purlins is the panel system's original covering; shingle
// coverings nail straight to the 5/8 in ZIP roof deck. Minimum slopes follow IRC R905:
// asphalt 2:12 (double underlayment below 4:12), wood shingles 3:12, slate 4:12.
pub const METAL:&str="Ribbed metal";
pub const ASPHALT:&str="Architectural asphalt shingles";
pub const CEDAR:&str="Cedar shingles";
pub const SLATE:&str="Natural slate";
pub const CHOICES:[&str;5]=["Style matched",METAL,ASPHALT,CEDAR,SLATE];
pub fn min_pitch(kind:&str)->f64{match kind{ASPHALT=>2.,CEDAR=>3.,SLATE=>4.,_=>0.25}}
/// The covering each style was historically built with.
pub fn style_default(style:&str)->&'static str{match style{"Georgian"|"Victorian"|"Tudor"|"French country"=>SLATE,"Cape Cod"|"English cottage"|"Coastal"=>CEDAR,"Craftsman"|"Colonial"|"Ranch"=>ASPHALT,_=>METAL}}
/// The covering actually built: a style-matched shingle falls back to metal on a roof too flat for it.
pub fn kind(c:&Config)->&'static str{if c.roofing=="Style matched"{let k=style_default(&c.home_style);if c.pitch+1e-9>=min_pitch(k){k}else{METAL}}else{CHOICES.iter().find(|k|**k==c.roofing).copied().unwrap_or(METAL)}}
pub fn validate(c:&Config)->Result<(),String>{
 if !CHOICES.contains(&c.roofing.as_str()){return Err("Choose a listed roof covering.".into())}
 if !["Flat ceiling","Cathedral"].contains(&c.ceiling.as_str()){return Err("Choose a flat ceiling or a cathedral ceiling.".into())}
 if c.roofing!="Style matched"&&c.pitch+1e-9<min_pitch(&c.roofing){return Err(format!("{} requires at least a {}:12 roof pitch. Choose a steeper pitch or another covering.",c.roofing,min_pitch(&c.roofing)))}
 Ok(())
}
type P=[f64;2];
fn clip(poly:&[P],axis:usize,bound:f64,keep_above:bool)->Vec<P>{let mut out=vec![];for i in 0..poly.len(){let a=poly[i];let b=poly[(i+1)%poly.len()];let inside=|p:P|if keep_above{p[axis]>=bound}else{p[axis]<=bound};if inside(a){out.push(a)}if inside(a)!=inside(b){let t=(bound-a[axis])/(b[axis]-a[axis]);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}out}
fn area(p:&[P])->f64{if p.len()<3{return 0.}(0..p.len()).map(|i|p[i][0]*p[(i+1)%p.len()][1]-p[(i+1)%p.len()][0]*p[i][1]).sum::<f64>().abs()/2.}
/// Factory roof panels are at most 32 ft along the eave and 22 ft up the slope. Pieces of one roof
/// plane (split by valleys or dormer openings) share a grid, so a panel is counted once per cell.
pub fn panel_count(roof:&Value)->usize{
 let mut planes:BTreeMap<String,(f64,f64,Vec<Vec<P>>)>=BTreeMap::new();
 for f in roof["facets"].as_array().into_iter().flatten(){let a=f["plane"][0].as_f64().unwrap_or(0.);let b=f["plane"][1].as_f64().unwrap_or(0.);let k=f["plane"][2].as_f64().unwrap_or(0.);
  let poly:Vec<P>=f["points"].as_array().into_iter().flatten().map(|p|[p[0].as_f64().unwrap_or(0.),p[2].as_f64().unwrap_or(0.)]).collect();
  planes.entry(format!("{:.4}/{:.4}/{:.4}",a,b,k)).or_insert((a,b,vec![])).2.push(poly);}
 let mut count=0;
 for(_,(a,b,polys))in planes{let slope_axis=if a.abs()>b.abs(){0}else{1};let eave_axis=1-slope_axis;let run=22./(1.+a*a+b*b).sqrt();
  let lo=|axis:usize|polys.iter().flatten().map(|p|p[axis]).fold(f64::INFINITY,f64::min);let hi=|axis:usize|polys.iter().flatten().map(|p|p[axis]).fold(f64::NEG_INFINITY,f64::max);
  let(e0,e1,s0,s1)=(lo(eave_axis),hi(eave_axis),lo(slope_axis),hi(slope_axis));let ne=((e1-e0)/32.-1e-9).ceil().max(1.)as usize;let ns=((s1-s0)/run-1e-9).ceil().max(1.)as usize;
  for i in 0..ne{for j in 0..ns{let(ea,eb)=(e0+i as f64*32.,(e0+(i+1)as f64*32.).min(e1));let(sa,sb)=(s0+j as f64*run,(s0+(j+1)as f64*run).min(s1));
   let cell:f64=polys.iter().map(|p|{let mut q=clip(p,eave_axis,ea,true);q=clip(&q,eave_axis,eb,false);q=clip(&q,slope_axis,sa,true);q=clip(&q,slope_axis,sb,false);area(&q)}).sum();if cell>=1.{count+=1;}}}}
 count
}
pub fn apply(c:&Config,mut m:Value)->Value{
 let k=kind(c);let roof=m["roof"].clone();let area=n(&roof,"area");let(eave,rake,ridge,hip,valley)=(n(&roof,"eaveLF"),n(&roof,"rakeLF"),n(&roof,"ridgeLF"),n(&roof,"hipLF"),n(&roof,"valleyLF"));
 // Dormer roofs flatter than the covering allows (shed dormers at 2:12, eyebrow back slopes) are
 // standing-seam metal instead; lapped ribbed panels also stop at 3:12 (IRC R905.10.2).
 let dormer_pitch=|d:&Value|match s(d,"kind"){"Shed"=>2.,"Eyebrow"=>(c.pitch-3.).max(1.).round(),_=>n(d,"roofPitch")*12.};
 let dormers:Vec<Value>=m["dormers"].as_array().cloned().unwrap_or_default();let lowest=if k==METAL{3.}else{min_pitch(k)};
 let low=dormers.iter().filter(|d|dormer_pitch(d)+1e-9<lowest).map(|d|n(d,"roofArea")).sum::<f64>().min(area);
 let shallow_asphalt=if k==ASPHALT&&c.pitch>=4.{dormers.iter().filter(|d|{let p=dormer_pitch(d);p+1e-9>=lowest&&p<4.}).map(|d|n(d,"roofArea")).sum::<f64>()}else{0.};
 let full_area=area;let area=area-low;let seam=k==METAL&&c.pitch<3.;
 let squares=area/100.;// Same strip the Ice & Water Shield line buys (24 in inside the wall, up the slope), so underlay never overlaps it.
 let eave_strip=((n(&roof,"overhangZ").max(n(&roof,"overhangX"))+2.)*(1.+(c.pitch/12.).powi(2)).sqrt()).max(3.);let ice=(eave*eave_strip+valley*3.).min(area);let panels=panel_count(&roof);
 let item_qty=|m:&Value,pred:&dyn Fn(&str)->bool|m["items"].as_array().unwrap().iter().filter(|i|pred(s(i,"id"))).map(|i|n(i,"qty")).sum::<f64>();
 let sheets=item_qty(&m,&|id|id=="ziproof");let rafters=item_qty(&m,&|id|id.starts_with("rafter")&&id[6..].bytes().all(|b|b.is_ascii_digit()));
 let mut t=model::Takeoff{items:vec![],c};
 macro_rules! add{($id:expr,$name:expr,$net:expr,$unit:expr,$price:expr,$basis:expr,$whole:expr)=>{t.add($id,"Roof",$name,$net as f64,$unit,$price as f64,$basis,"Roof covering estimate",true,$whole)};}
 if k!=METAL{
  m["items"].as_array_mut().unwrap().retain(|i|!["roofmetal","roofclips","ridge","metalclosure","roof-purlins","underlay","roof-snowguards","rake"].contains(&s(i,"id")));
  let double=k==ASPHALT&&c.pitch<4.;
  add!("underlay",&format!("Synthetic roofing underlayment · 10-square roll{}",if double{" · two layers"}else{""}),((area-ice).max(0.)*if double{2.}else{1.}+shallow_asphalt)/1000.,"rolls",125.,if double{"Roof area outside the ice-barrier strips. Two layers below 4:12 per IRC R905.1.1 for asphalt shingles."}else{"Roof area outside the ice-barrier strips; laps, fastening and the shingle maker's requirements govern."},true);
  add!("roof-dripedge",&format!("{} drip edge · 10 ft",if k==SLATE{"16 oz copper"}else{"Aluminum"}),(eave+rake)/10.,"pieces",if k==SLATE{48.}else{11.},"Every eave and rake; drip edge goes under the underlayment at eaves and over it at rakes.",true);
 }
 match k{
  ASPHALT=>{
   add!("roof-shingles","Architectural laminated asphalt shingles · 3 bundles per square",squares*3.,"bundles",46.,"Actual roof plane areas including overhangs and dormer roofs; 3 bundles cover 100 sq ft. Hips, ridges and starter are listed separately.",true);
   add!("roof-starter","Asphalt starter strip shingles · about 105 ft per bundle",(eave+rake)/105.,"bundles",62.,"Eaves and rakes, so the first course and rake edges are sealed.",true);
   add!("roof-hipridge","Hip & ridge cap shingles · about 25 ft per bundle",(ridge+hip)/25.,"bundles",78.,"Modeled ridge and hip length; vented ridge sections use the same caps.",true);
   add!("roof-nails","1-1/4 in galvanized coil roofing nails · 7,200 count",squares*400./7200.,"boxes",58.,"Six-nail high-wind pattern, about 400 nails per square.",true);
  },
  CEDAR=>{
   let exposure=if c.pitch>=4.{5.5}else{4.25};
   add!("roof-shingles",&format!("#1 western red cedar shingles · 18 in, {} in exposure",exposure),squares*4.*5.5/exposure,"bundles",125.,"Four bundles per square at 5-1/2 in exposure (IRC R905.7: 4-1/4 in below 4:12). Spaced 1/4–3/8 in, joints offset at least 1-1/2 in.",true);
   add!("roof-starter","Cedar starter course · doubled at the eaves",eave/20.,"bundles",125.,"Doubled first course along every eave.",true);
   add!("roof-hipridge","Factory cedar hip & ridge units · about 16 ft per bundle",(ridge+hip)/16.,"bundles",95.,"Modeled ridge and hip length, alternating overlap.",true);
   add!("roof-nails","Stainless steel ring-shank shingle nails · 5 lb box",squares*2.5/5.,"boxes",62.,"Two nails per shingle, about 2-1/2 lb per square; stainless steel resists cedar's tannins.",true);
   add!("roof-breather","Ventilating drainage mat under cedar · 3-D drying layer",area,"sq ft",1.05,"Lets cedar dry from below on the solid ZIP deck; full roof area.",false);
  },
  SLATE=>{
   let headlap=if c.pitch<8.{4.}else if c.pitch<20.{3.}else{2.};let exposure=(20.-headlap)/2.;let pieces=squares*14400./(exposure*10.);
   add!("roof-shingles",&format!("Natural roofing slate · 20 × 10 in, 3/16–1/4 in thick, {} in headlap",headlap),pieces,"slates",4.75,&format!("{:.1} in exposure gives {:.0} slates per square (IRC R905.6.5 headlap for this pitch). Two copper nails per slate.",exposure,14400./(exposure*10.)),true);
   add!("roof-starter","Slate starter course",eave*1.2,"slates",4.75,"One starter slate per 10 in of eave.",true);
   add!("roof-hipridge","Combed slate ridge / hip with copper ridge roll",ridge+hip,"linear ft",26.,"Modeled ridge and hip length.",false);
   add!("roof-nails","Copper slating nails · 1-1/2 in · per lb (about 150)",pieces*2./150.,"lb",18.,"Two nails per slate; copper or stainless only.",true);
   add!("roof-snowguards","Copper slate snow guards",eave*4./3.,"each",9.,"Two staggered rows along every eave, about 18 in apart; final layout depends on snow load.",true);
  },
  _=>{}
 }
 if k==METAL{for i in m["items"].as_array_mut().unwrap().iter_mut().filter(|i|s(i,"id")=="roofmetal"){
   if seam{i["name"]=json!("24-gauge mechanically seamed standing-seam metal roofing");if !c.prices.contains_key("roofmetal"){i["price"]=json!(round(n(i,"price")*1.6));}i["basis"]=json!("Actual roof planes including overhangs. Below 3:12 lapped ribbed panels are not permitted (IRC R905.10.2); standing seam is approved down to 1/4:12.");}
   else if low>0.{i["rawNet"]=json!((n(i,"rawNet")-low).max(0.));}pricing::recalc_item(i,c);}}
 if low>0.&&!seam{add!("roof-lowslope","24-gauge standing-seam metal on low-slope dormer roofs",low,"sq ft",6.7,&format!("{:.0} sq ft of dormer roof is flatter than {}:12, the least this covering may be laid at, so it is standing seam over its own underlayment.",low,lowest),false);}
 if c.home_style=="Craftsman"{if let Some(i)=m["items"].as_array_mut().unwrap().iter_mut().find(|i|s(i,"id")=="soffit"){i["name"]=json!("Open-eave tongue-and-groove eave boards over exposed rafter tails");i["basis"]=json!("Plan overhang area. Craftsman eaves stay open, so the boards are the finished underside; screened rim vents still apply.");pricing::recalc_item(i,c);}}
 add!("roof-panelkits",&format!("Factory roof panel joint, gasket & lifting kits · {} panels",panels),panels,"kits",85.,&format!("Roof panels (up to 32 ft along the eave × 22 ft up the slope) are assembled from the {:.0} ZIP roof sheets and {:.0} I-joist rafters already listed; this line adds only per-panel joint screws, gaskets and lifting straps. Dormer roofs are framed on site.",sheets,rafters),true);
 m["items"].as_array_mut().unwrap().extend(t.items.iter().map(|i|serde_json::to_value(i).unwrap()));
 let note=[if k==SLATE{"Slate weighs about 8–10 psf. Roof I-joists, the LVL ridge and supports must be designed for it."}else{""},if seam{"Below 3:12 the metal roof is standing seam; lapped ribbed panels need at least 3:12."}else{""},if low>0.&&!seam{"Low-slope dormer roofs are standing-seam metal."}else{""}].iter().filter(|t|!t.is_empty()).copied().collect::<Vec<_>>().join(" ");
 m["roofing"]=json!({"kind":k,"choice":c.roofing,"minPitch":min_pitch(k),"panels":panels,"deadLoadPsf":match k{SLATE=>9.,CEDAR=>3.,ASPHALT=>2.5,_=>1.5},"lowSlopeArea":round(low),"roofArea":round(full_area),"note":note});
 let info=m["roofing"].clone();if let Some(l)=m["levels"].as_array_mut().and_then(|l|l.last_mut()){l["roofing"]=info;}
 let mut cats:BTreeMap<String,f64>=BTreeMap::new();for i in m["items"].as_array().unwrap(){*cats.entry(s(i,"category").into()).or_default()+=n(i,"total");}
 let subtotal=round(cats.values().sum());for total in cats.values_mut(){*total=round(*total)}m["categoryTotals"]=json!(cats);m["subtotal"]=json!(subtotal);m["tax"]=json!(round(subtotal*c.tax/100.));m["total"]=json!(round(subtotal+n(&m,"tax")));m
}
