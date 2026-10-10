use crate::*;

pub fn apply(c:&Config,m:&mut Value,t:&mut model::Takeoff){
    let style=if c.roof_edge_style!="Style matched"{c.roof_edge_style.as_str()}else{match c.home_style.as_str(){"Victorian"|"English cottage"=>"Victorian fretwork","Georgian"|"Colonial"=>"Dentil cornice","French country"|"Tudor"=>"Ogee cornice","Craftsman"|"Modern farmhouse"=>"Craftsman brackets","Cape Cod"|"Coastal"=>"Stepped cornice",_=>"Plain fascia"}};
    let (width,projection,profile,spacing):(f64,f64,usize,f64)=match style{"Stepped cornice"=>(0.65,0.35,6,0.),"Ogee cornice"=>(0.8,0.45,3,0.),"Dentil cornice"=>(0.85,0.5,5,0.7),"Craftsman brackets"=>(0.55,0.25,2,6.),"Victorian fretwork"=>(0.7,0.35,4,1.4),_=>(0.5,0.1,1,0.)};
    let oversized=if c.trim_size=="Oversized"{1.4}else{1.};let width=width*oversized;let projection=projection*oversized;
    let mut edges=vec![];let mut ornaments=vec![];
    for (index,edge)in m["roof"]["edges"].as_array().unwrap().iter().enumerate().filter(|(_,e)|["eave","rake"].contains(&s(e,"kind"))){
        let a:Vec<f64>=serde_json::from_value(edge["a"].clone()).unwrap();let b:Vec<f64>=serde_json::from_value(edge["b"].clone()).unwrap();let mid=[(a[0]+b[0])/2.,(a[1]+b[1])/2.,(a[2]+b[2])/2.];
        let normal=if near(a[0],b[0]){[if mid[0]<c.width/2.{-1.}else{1.},0.,0.]}else{[0.,0.,if mid[2]<c.depth/2.{-1.}else{1.}]};
        edges.push(json!({"id":format!("EDGE-{}",index),"a":[a[0],a[1]-width/2.,a[2]],"b":[b[0],b[1]-width/2.,b[2]],"normal":normal,"length":n(edge,"length"),"width":width,"projection":projection,"profile":profile,"kind":style}));
        if spacing>0.{let count=(n(edge,"length")/spacing).floor()as usize;for i in 0..count{let u=(i as f64+0.5)/count as f64;ornaments.push(json!({"kind":if style=="Dentil cornice"{"dentil"}else if style=="Craftsman brackets"{"bracket"}else{"fret"},"position":[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u-width-0.2,a[2]+(b[2]-a[2])*u],"normal":normal,"size":oversized}));}}
    }
    let accent=if c.gable_accent!="Style matched"{c.gable_accent.as_str()}else{match c.home_style.as_str(){"Victorian"|"Craftsman"|"English cottage"=>"Shingle panel","Tudor"=>"Tudor timber","Modern farmhouse"=>"Board and batten",_=>"None"}};
    let mut panels=vec![];
    if accent!="None"{for p in m["roof"]["profiles"].as_array().unwrap(){let points=p["points"].as_array().unwrap();let area:f64=points.windows(2).map(|q|(q[1][0].as_f64().unwrap()-q[0][0].as_f64().unwrap())*(q[0][1].as_f64().unwrap()+q[1][1].as_f64().unwrap())/2.).sum();if area<0.5{continue}panels.push(json!({"kind":accent,"x":p["x"],"z":p["z"],"axis":p["axis"],"points":points,"area":area,"baseY":c.wall_height}));}}
    let ornament=if c.finials!="Style matched"{c.finials.as_str()}else if c.home_style=="Victorian"{"Turned finials"}else{"None"};
    let mut finials=vec![];
    if ornament!="None"{for p in m["roof"]["profiles"].as_array().unwrap().iter().filter(|p|near(n(p,"z"),0.)){
        let points=p["points"].as_array().unwrap();for i in 1..points.len().saturating_sub(1){let at=points[i][0].as_f64().unwrap();let h=points[i][1].as_f64().unwrap();if h>0.5&&h>points[i-1][1].as_f64().unwrap()+0.05&&h>points[i+1][1].as_f64().unwrap()+0.05{finials.push(json!({"kind":ornament,"position":[n(p,"x")+if s(p,"axis")=="x"{at}else{0.},c.wall_height+h,n(p,"z")+if s(p,"axis")=="z"{at}else{0.}],"height":if ornament=="Roof spire"{3.}else{2.},"width":if ornament=="Roof spire"{0.65}else{0.4}}));}}
    }}
    if ornament!="None"&&finials.is_empty(){if let Some(e)=m["roof"]["edges"].as_array().unwrap().iter().find(|e|s(e,"kind")=="ridge"){finials.push(json!({"kind":ornament,"position":e["a"],"height":if ornament=="Roof spire"{3.}else{2.},"width":0.5}));}}
    finials.truncate(2);
    let lf:f64=edges.iter().map(|e|n(e,"length")).sum();let panel_area:f64=panels.iter().map(|p|n(p,"area")).sum();
    let old_pieces=m.get("allTrimPieces").and_then(Value::as_array).unwrap_or_else(||m["trimPieces"].as_array().unwrap());let removed:Vec<Value>=old_pieces.iter().filter(|p|["cornice","frieze"].contains(&s(p,"role"))).cloned().collect();let old_surface=trim::surface_area(&removed,&m["trimPackage"]);let old_fasteners:f64=removed.iter().map(|p|(n(p,"length")/(16./12.)).ceil()+1.).sum();
    m["items"].as_array_mut().unwrap().retain(|i|!["exterior-cornice","exterior-frieze"].contains(&s(i,"id")));
    for key in ["trimPieces","allTrimPieces"]{if let Some(pieces)=m[key].as_array_mut(){pieces.retain(|p|!["cornice","frieze"].contains(&s(p,"role")));}}
    if let Some(levels)=m["levels"].as_array_mut(){for level in levels{if let Some(pieces)=level["trimPieces"].as_array_mut(){pieces.retain(|p|!["cornice","frieze"].contains(&s(p,"role")));}}}
    let new_surface=lf*(width*2.+projection*2.)+panel_area*2.+ornaments.len()as f64*1.3+finials.len()as f64*4.;
    // Existing window/door/interior coating remains; replace only removed roof trim.
    for i in m["items"].as_array_mut().unwrap(){let reduction=match s(i,"id"){"trimsealer"=>old_surface*2./350.,"trimfasteners"=>old_fasteners/250.,_=>0.};if reduction>0.{i["rawNet"]=json!((n(i,"rawNet")-reduction).max(0.));pricing::recalc_item(i,c);}}
    m["trimSurfaceArea"]=json!(round((n(m,"trimSurfaceArea")-old_surface).max(0.)));
    if let Some(levels)=m["levels"].as_array_mut(){for level in levels{let area=trim::surface_area(level["trimPieces"].as_array().unwrap(),&level["trimPackage"])+trim::ornament_surface(level["trimOrnaments"].as_array().unwrap());level["trimSurfaceArea"]=json!(round(area));}}
    m["trimSurfaceArea"]=json!(if let Some(levels)=m["levels"].as_array(){round(levels.iter().map(|level|n(level,"trimSurfaceArea")).sum())}else{round(trim::surface_area(m["trimPieces"].as_array().unwrap(),&m["trimPackage"])+trim::ornament_surface(m["trimOrnaments"].as_array().unwrap()))});
    t.add("accent-roofedge","Architectural accents",&format!("Sealed wood {}",style),lf,"linear ft",(if style=="Plain fascia"{3.5}else{7.5})*oversized,"Sum of displayed eave/rake trim runs. Replaces the previous cornice/frieze allowance; weather flashing is separately included.","Modeled trim",true,false);
    for kind in ["dentil","bracket","fret"]{let count=ornaments.iter().filter(|o|s(o,"kind")==kind).count();if count>0{t.add(&format!("accent-{}",kind),"Architectural accents",&format!("Router-carved sealed wood {}",kind),count as f64,"pieces",if kind=="bracket"{38.}else if kind=="fret"{12.}else{4.},"One per actual displayed under-eave ornament. Decorative only; structural bracing not assumed.","Modeled ornament",false,true);}}
    if panel_area>0.{t.add("accent-gablepanels","Architectural accents",&format!("Sealed wood gable accent · {}",accent),panel_area,"sq ft",if accent=="Tudor timber"{5.5}else{7.},"Only modeled gable triangles above the wall plates. Applied facade overlay; no whole-wall panel squares.","Modeled gable area",true,false);}
    if !finials.is_empty(){t.add("accent-finials","Architectural accents",&format!("Sealed wood {} / mounting / flashing",ornament),finials.len()as f64,"sets",if ornament=="Roof spire"{220.}else{85.},"Actual roof-peak ornament count; positive attachment and waterproofing require detailing.","Modeled ornament",false,true);}
    t.add("accent-sealer","Architectural accents","Exterior roof / accent wood sealer · two coats",new_surface*2./350.,"gallons",65.,"Exposed and back faces of modeled roof trim and accent panels; approximate two-coat product coverage.","Surface allowance",true,true);
    let fasteners:f64=edges.iter().map(|e|(n(e,"length")/(16./12.)).ceil()+1.).sum::<f64>()+ornaments.len()as f64*2.+panel_area*2.+finials.len()as f64*4.;
    t.add("accent-fasteners","Architectural accents","Exterior accent fasteners · 250 pack",fasteners/250.,"packs",32.,"16 in roof-trim stations plus ornament and panel connection allowances. Final fastening and wind design pending.","Fastener allowance",true,true);
    let data=json!({"style":style,"edges":edges,"ornaments":ornaments,"panels":panels,"finials":finials,"gableAccent":accent,"surfaceArea":new_surface});m["roofAccents"]=data.clone();if c.stories>=2{m["levels"][c.stories-1]["roofAccents"]=data;}
}
