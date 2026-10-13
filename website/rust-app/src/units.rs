//! Display units. The engine always works in US customary units (feet, inches, pounds); visitors who
//! choose metric see every measurement converted on the way to the screen, and numbers they type in
//! metric are converted back before the engine sees them.
use std::cell::Cell;

thread_local! {static METRIC:Cell<bool>=const {Cell::new(false)};}
pub fn metric()->bool{METRIC.with(|m|m.get())}
pub fn set_metric(on:bool){METRIC.with(|m|m.set(on))}

pub const FT:f64=0.3048;
pub const SQFT:f64=0.092_903_04;
const IN_MM:f64=25.4;
pub const PSF_KPA:f64=0.047_880_26;
const KIP_KN:f64=4.448_222;
const LB_KG:f64=0.453_592_37;
const GAL_L:f64=3.785_411_8;
const SQIN_CM2:f64=6.4516;

/// Fixed decimals without trailing zeros (7.50 → 7.5, 12.00 → 12).
pub fn num(v:f64,decimals:usize)->String{
 let s=format!("{:.*}",decimals,v);
 if s.contains('.'){s.trim_end_matches('0').trim_end_matches('.').to_string()}else{s}
}
pub fn meters(ft:f64)->String{let m=ft*FT;num(m,if m.abs()<100.{2}else{1})}
fn sq_meters(sqft:f64)->String{let m=sqft*SQFT;num(m,if m.abs()<10.{2}else{1})}
fn millimeters(inches:f64)->String{let mm=inches*IN_MM;if mm.abs()>=1000.{format!("{} m",num(mm/1000.,2))}else{format!("{} mm",num(mm,0))}}

/// A quantity's unit and the factor to convert one of it to metric, for takeoff rows.
pub fn row_unit(unit:&str)->Option<(&'static str,f64)>{
 match unit{"sq ft"=>Some(("m²",SQFT)),"sq ft of batts"=>Some(("m² of batts",SQFT)),"linear ft"=>Some(("m",FT)),"ply linear ft"=>Some(("ply m",FT)),"assembly linear ft"=>Some(("assembly m",FT)),"lb"=>Some(("kg",LB_KG)),"gallons"=>Some(("litres",GAL_L)),"gal"=>Some(("L",GAL_L)),"cu yd"=>Some(("m³",0.764555)),_=>None}
}

fn is_word(c:char)->bool{c.is_alphanumeric()||c=='_'}
const FRACTIONS:[(char,f64);8]=[('¼',0.25),('½',0.5),('¾',0.75),('⅛',0.125),('⅜',0.375),('⅝',0.625),('⅞',0.875),('⅓',1./3.)];
fn frac(c:char)->Option<f64>{FRACTIONS.iter().find(|(f,_)|*f==c).map(|(_,v)|*v)}

/// The number that ends exactly at byte `end` of `s` (digits, commas, a decimal point, a vulgar
/// fraction, `a/b`, or `w-a/b`): its start and value.
fn number_before(s:&str,end:usize)->Option<(usize,f64)>{
 let head=&s[..end];let chars:Vec<(usize,char)>=head.char_indices().collect();if chars.is_empty(){return None}
 let mut k=chars.len();let mut tail=0.;
 if let Some(f)=frac(chars[k-1].1){tail=f;k-=1;}
 let mut j=k;while j>0&&(chars[j-1].1.is_ascii_digit()||chars[j-1].1==','||chars[j-1].1=='.'){j-=1;}
 if !chars[j..k].iter().any(|(_,c)|c.is_ascii_digit())&&tail==0.{return None}
 if j>0&&is_word(chars[j-1].1)&&!chars[j-1].1.is_ascii_digit(){return None}
 let digits:String=chars[j..k].iter().map(|(_,c)|*c).filter(|c|*c!=',').collect();
 let mut value=if digits.is_empty(){0.}else{digits.trim_end_matches('.').parse::<f64>().ok()?}+tail;let mut start=if j<chars.len(){chars[j].0}else{end};
 // a/b and w-a/b fractions
 if j>0&&chars[j-1].1=='/'&&tail==0.{let den=value;let mut a=j-1;while a>0&&chars[a-1].1.is_ascii_digit(){a-=1;}if a<j-1&&den>0.{let numer:f64=chars[a..j-1].iter().map(|(_,c)|*c).collect::<String>().parse().ok()?;value=numer/den;start=chars[a].0;
  if a>1&&(chars[a-1].1=='-'||chars[a-1].1==' ')&&chars[a-2].1.is_ascii_digit(){let mut w=a-1;while w>0&&chars[w-1].1.is_ascii_digit(){w-=1;}let whole:f64=chars[w..a-1].iter().map(|(_,c)|*c).collect::<String>().parse().ok()?;value+=whole;start=chars[w].0;}}}
 Some((start,value))
}

/// Replace the trailing number already written to `out` (possibly separated from the unit by tags or
/// spaces, as in `<strong>2296</strong><small>sq ft</small>`), returning its value.
fn rewrite_trailing_number(out:&mut String,convert:&dyn Fn(f64)->String)->bool{
 let mut end=out.len();
 loop{let t=out[..end].trim_end();end=t.len();if t.ends_with('>'){match t.rfind('<'){Some(p)=>{end=p;continue}None=>return false}}break}
 let Some((start,value))=number_before(out,end)else{return false};
 if start>0&&out[..start].ends_with('$'){return false}
 let text=convert(value);out.replace_range(start..end,&text);true
}

struct Unit{word:&'static str,needs_number:bool,to:fn(f64)->String,label:&'static str}
fn units()->[Unit;16]{[
 Unit{word:"square feet",needs_number:false,to:|v|format!("{} m²",sq_meters(v)),label:"m²"},
 Unit{word:"sq ft",needs_number:false,to:|v|format!("{} m²",sq_meters(v)),label:"m²"},
 Unit{word:"ft²",needs_number:false,to:|v|format!("{} m²",sq_meters(v)),label:"m²"},
 Unit{word:"linear ft",needs_number:false,to:|v|format!("{} m",meters(v)),label:"m"},
 Unit{word:"linear feet",needs_number:false,to:|v|format!("{} m",meters(v)),label:"m"},
 Unit{word:"feet",needs_number:false,to:|v|format!("{} m",meters(v)),label:"m"},
 Unit{word:"ft",needs_number:false,to:|v|format!("{} m",meters(v)),label:"m"},
 Unit{word:"in²",needs_number:false,to:|v|format!("{} cm²",num(v*SQIN_CM2,0)),label:"cm²"},
 Unit{word:"inches",needs_number:true,to:millimeters,label:"mm"},
 Unit{word:"in",needs_number:true,to:millimeters,label:"mm"},
 Unit{word:"psf",needs_number:false,to:|v|format!("{} kPa",num(v*PSF_KPA,2)),label:"kPa"},
 Unit{word:"kips",needs_number:false,to:|v|format!("{} kN",num(v*KIP_KN,1)),label:"kN"},
 Unit{word:"kip",needs_number:true,to:|v|format!("{} kN",num(v*KIP_KN,1)),label:"kN"},
 Unit{word:"lb",needs_number:true,to:|v|format!("{} kg",num(v*LB_KG,1)),label:"kg"},
 Unit{word:"gallons",needs_number:true,to:|v|format!("{} L",num(v*GAL_L,1)),label:"L"},
 Unit{word:"gal",needs_number:true,to:|v|format!("{} L",num(v*GAL_L,1)),label:"L"},
]}

/// Convert the measurements in a run of visible text, appending to `out`.
fn convert_text(text:&str,out:&mut String){
 let table=units();let mut i=0;let mut copied=0;let bytes=text.as_bytes();
 while i<text.len(){
  if !text.is_char_boundary(i){i+=1;continue}
  // Feet and inches written 24' 0" (or 24'0&quot;): one length.
  if bytes[i]==b'\''{if let Some((start,ft))=number_before(text,i){let rest=&text[i+1..];let sp=rest.len()-rest.trim_start().len();let r2=&rest[sp..];let digits=r2.chars().take_while(|c|c.is_ascii_digit()).count();
    let close=if r2[digits..].starts_with("&quot;"){6}else if r2[digits..].starts_with('"'){1}else{0};
    if digits>0&&close>0{let inches:f64=r2[..digits].parse().unwrap_or(0.);out.push_str(&text[copied..start]);out.push_str(&format!("{} m",meters(ft+inches/12.)));i=i+1+sp+digits+close;copied=i;continue}
    if start<i{out.push_str(&text[copied..start]);out.push_str(&format!("{} m",meters(ft)));i+=1;copied=i;continue}}}
  let before=text[..i].chars().next_back();
  if before.is_some_and(is_word){i+=1;continue}
  let mut hit=None;for u in table.iter(){if text[i..].starts_with(u.word){let after=text[i+u.word.len()..].chars().next();if after.is_some_and(|c|is_word(c)&&c!='²'){continue}hit=Some(u);break}}
  let Some(u)=hit else{i+=1;continue};
  // number right before the unit (one space, a hyphen or nothing between)
  let mut num_end=i;if text[..num_end].ends_with(' ')||text[..num_end].ends_with('-'){num_end-=1;}
  let found=if num_end>=copied{number_before(text,num_end).filter(|(s,_)|*s>=copied)}else{None};
  if let Some((start,value))=found{
   // a price per unit ("$2.80/sq ft") converts the other way
   if start>0&&text[..start].ends_with('$'){i+=u.word.len();continue}
   // dimension chains "26 × 46 ft" convert every number
   let mut chain_start=start;let mut chain=vec![];let mut probe=start;
   loop{let h=&text[..probe];let sep=[" × "," x ","×"," – ","–"," to "].iter().find(|s|h.ends_with(*s)).map(|s|s.len());let Some(sl)=sep else{break};match number_before(text,probe-sl){Some((s2,v2))if s2>=copied=>{chain.push(v2);chain_start=s2;probe=s2;}_=>break}}
   out.push_str(&text[copied..chain_start]);
   let label=(u.to)(value);let suffix=label.rsplit(' ').next().unwrap_or("").to_string();
   // keep each separator as written (× for sizes, – or "to" for ranges)
   let mut seps=vec![];{let mut q=start;for _ in &chain{let h=&text[..q];let sep=[" × "," x ","×"," – ","–"," to "].iter().find(|s|h.ends_with(*s)).copied().unwrap_or(" × ");seps.push(sep);let p2=number_before(text,q-sep.len()).map(|(s2,_)|s2).unwrap_or(q);q=p2;}}
   for (k,v) in chain.iter().enumerate().rev(){let t=(u.to)(*v);let end=format!(" {}",suffix);out.push_str(t.strip_suffix(end.as_str()).unwrap_or(&t));out.push_str(seps[k]);}
   out.push_str(&label);i+=u.word.len();copied=i;continue}
  if text[..i].ends_with('/'){if let Some((start,price))=number_before(text,i-1){if start>0&&text[..start].ends_with('$'){let factor=match u.label{"m²"=>SQFT,"m"=>FT,"kg"=>LB_KG,"L"=>GAL_L,_=>1.};out.push_str(&text[copied..start]);out.push_str(&format!("{}/{}",num(price/factor,2),u.label));i+=u.word.len();copied=i;continue}}}
  if text[copied..i].trim().is_empty()&&!u.needs_number{
   // unit at the start of a text run: its number may sit in the element before (<strong>2296</strong><small>sq ft</small>)
   out.push_str(&text[copied..i]);if !rewrite_trailing_number(out,&|v|{let t=(u.to)(v);t.rsplit_once(' ').map(|(n,_)|n.to_string()).unwrap_or(t)}){}
   out.push_str(u.label);i+=u.word.len();copied=i;continue}
  if !u.needs_number{out.push_str(&text[copied..i]);out.push_str(u.label);i+=u.word.len();copied=i;continue}
  i+=u.word.len();
 }
 out.push_str(&text[copied..]);
}

fn attr<'a>(tag:&'a str,name:&str)->Option<(usize,usize,&'a str)>{
 let key=format!(" {}=",name);let p=tag.find(&key)?;let v=p+key.len();let rest=&tag[v..];
 if let Some(q)=rest.strip_prefix('"'){let e=q.find('"')?;Some((v,v+e+2,&q[..e]))}else{let e=rest.find(|c:char|c==' '||c=='>').unwrap_or(rest.len());Some((v,v+e,&rest[..e]))}
}
fn set_attr(tag:&str,name:&str,value:&str)->String{
 match attr(tag,name){Some((s,e,_))=>format!("{}\"{}\"{}",&tag[..s],value,&tag[e..]),None=>{let at=tag.rfind('>').unwrap_or(tag.len());let at=if tag[..at].ends_with('/'){at-1}else{at};format!("{} {}=\"{}\"{}",&tag[..at],name,value,&tag[at..])}}
}
/// A number input under a "· ft" or "· psf" label: show metric, remember how to convert it back.
fn convert_input(tag:&str,unit:&str)->String{
 let factor=if unit=="psf"{PSF_KPA}else{FT};let digits=if unit=="psf"{2}else{2};
 let mut t=tag.to_string();
 let step=attr(tag,"step").and_then(|(_,_,v)|v.parse::<f64>().ok());
 for name in ["value","min","max"]{if let Some((_,_,v))=attr(&t.clone(),name){if let Ok(x)=v.parse::<f64>(){t=set_attr(&t,name,&num(x*factor,digits));}}}
 t=set_attr(&t,"step","0.01");t=set_attr(&t,"data-unit",unit);
 if let Some(s)=step.filter(|s|*s>=1.){t=set_attr(&t,"data-snap",&num(s,2));}
 // Loads round-trip to the nearest ½ psf, so 1.92 kPa is the 40 psf table load again (not 40.1).
 else if unit=="psf"{t=set_attr(&t,"data-snap","0.5");}
 t
}
fn label_unit(label_text:&str)->Option<&'static str>{
 let plain:String={let mut o=String::new();let mut tag=false;for c in label_text.chars(){if c=='<'{tag=true}else if c=='>'{tag=false}else if !tag{o.push(c)}}o};
 if plain.contains("· ft")||plain.ends_with(" ft"){Some("ft")}else if plain.contains("· psf"){Some("psf")}else{None}
}

/// Convert the visible measurements in a block of generated HTML (text only; tags pass through, except
/// number inputs and select options labelled in feet or psf, which are converted for editing).
pub fn metricize(src:&str)->String{
 let mut out=String::with_capacity(src.len()+src.len()/8);let mut i=0;let mut label_start:Option<usize>=None;let mut select_unit:Option<&'static str>=None;let mut in_option=false;
 while i<src.len(){
  if src.as_bytes()[i]==b'<'{
   let end=src[i..].find('>').map(|e|i+e).unwrap_or(src.len()-1);let tag=&src[i..=end];let lower=tag.to_ascii_lowercase();
   if lower.starts_with("<label"){label_start=Some(i);}
   if lower.starts_with("</label"){label_start=None;}
   if lower.starts_with("<input")&&!lower.contains("type=checkbox")&&!lower.contains("type=hidden"){if let Some(u)=label_start.and_then(|l|label_unit(&src[l..i])){out.push_str(&convert_input(tag,u));i=end+1;continue}}
   if lower.starts_with("<select"){select_unit=label_start.and_then(|l|label_unit(&src[l..i])).filter(|u|*u=="ft");}
   if lower.starts_with("</select"){select_unit=None;}
   if lower.starts_with("<option"){in_option=true;}if lower.starts_with("</option"){in_option=false;}
   out.push_str(tag);i=end+1;continue}
  let next=src[i..].find('<').map(|e|i+e).unwrap_or(src.len());let text=&src[i..next];
  if in_option&&select_unit.is_some(){match text.trim().parse::<f64>(){Ok(v)=>out.push_str(&format!("{} m",meters(v))),Err(_)=>convert_text(text,&mut out)}}else{convert_text(text,&mut out);}
  i=next;
 }
 out
}

/// A value typed into a converted input, back in the engine's units (snapped to its original step).
pub fn to_engine(value:&str,unit:&str,snap:Option<f64>)->String{
 let Ok(v)=value.trim().parse::<f64>()else{return value.to_string()};
 let factor=if unit=="psf"{PSF_KPA}else{FT};let mut x=v/factor;
 if let Some(s)=snap.filter(|s|*s>0.){x=(x/s).round()*s;}else{x=(x*1000.).round()/1000.;}
 num(x,4)
}

#[cfg(test)]
mod tests{
 use super::*;
 fn m(s:&str)->String{metricize(s)}
 #[test]fn lengths_areas_and_loads(){
  assert_eq!(m("26 × 46 ft · 2 story"),"7.92 × 14.02 m · 2 story");
  assert_eq!(m("<strong>2296</strong><small>sq ft</small>"),"<strong>213.3</strong><small>m²</small>");
  assert_eq!(m("Longest floor clear span 15.54 ft · 16 in O.C. · 40 psf live"),"Longest floor clear span 4.74 m · 406 mm O.C. · 1.92 kPa live");
  assert_eq!(m("23/32 in AdvanTech · 4 × 8 ft"),"18 mm AdvanTech · 1.22 × 2.44 m");
  assert_eq!(m("3-ply 1¾ × 11⅞ in LVL"),"3-ply 44 × 302 mm LVL");
  assert_eq!(m("about 216 kips"),"about 960.8 kN");
  assert_eq!(m("At 24' 0\" each pier"),"At 7.32 m each pier");
  assert_eq!(m("Width · ft"),"Width · m");
  assert_eq!(m("Built in 2021 · in the kitchen"),"Built in 2021 · in the kitchen");
  assert_eq!(m("$2.80/sq ft"),"$30.14/m²");
  assert_eq!(m("2x6 SPF #2 · 92-5/8 in precut"),"2x6 SPF #2 · 2.35 m precut");
  assert_eq!(m("8–100 ft, on a 2 ft grid."),"2.44–30.48 m, on a 0.61 m grid.");
  assert_eq!(m("American · f&#116;, in"),"American · f&#116;, in");
  assert_eq!(m("Garage 36 × 80 in exterior service door"),"Garage 914 mm × 2.03 m exterior service door");
  assert_eq!(row_unit("cu yd").unwrap().0,"m³");assert_eq!(row_unit("gal").unwrap().0,"L");
 }
 #[test]fn inputs_round_trip(){
  let html=m("<label class=field>Width · ft<input id=\"width\" type=number min=8 max=100 step=0.01 value=\"26\"></label>");
  assert!(html.contains("value=\"7.92\"")&&html.contains("data-unit=\"ft\"")&&html.contains("Width · m"),"{}",html);
  assert_eq!(to_engine("7.92",  "ft",Some(2.)),"26");
  assert_eq!(to_engine("4.88","ft",None),"16.01");
  let sel=m("<label class=field>Pier depth · ft<select data-field=\"pierDepth\"><option value=\"24\" selected>24</option></select></label>");
  assert!(sel.contains(">7.32 m</option>")&&sel.contains("value=\"24\""),"{}",sel);
 }
}
