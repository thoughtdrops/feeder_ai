use crate::*;

// Reference porch footprints, scaled with the house. They are adaptations of the
// selected catalog drawing, not construction/engineering approval of that plan.
pub fn design(c: &Config, ground: &Value) -> Value {
    if c.design_mode == "Blank slate" || c.width < 12. || c.depth < 12. { return Value::Null; }
    let entry = ground["walls"].as_array().unwrap().iter().find(|w|s(w,"id")=="E1")
        .and_then(|w|w["openings"].as_array().unwrap().iter().find(|o|s(o,"kind")=="door"));
    let Some(entry) = entry else { return Value::Null; };
    let center = n(entry,"at") + n(entry,"width") / 2.;
    let (ratio, original_depth, form, column, railing, return_side):(f64,f64,&str,&str,bool,&str) = match c.home_style.as_str() {
        "Victorian" => (24./26., 7., "Hipped front veranda", "turned", true, ""),
        "Craftsman" => (1., 8., "Wraparound veranda", "tapered", true, "Left"),
        "Modern farmhouse" => (1., 8., "Wraparound farmhouse porch", "square", true, "Right"),
        "Colonial" => (0.2, 3., "Two-level side veranda and hooded entrance", "classical", true, "Right"),
        "English cottage" => (0.25, 4., "Gabled entry and side veranda", "timber", true, "Right"),
        "Tudor" => (0.28, 4., "Sheltered gabled entrance", "timber", false, ""),
        "French country" => (0.23, 4., "Hipped entry portico", "classical", false, ""),
        "Coastal" => (1., 8., "Deep coastal veranda", "classical", true, ""),
        "Ranch" => (0.48, 6., "Low front porch", "square", false, ""),
        // Styles whose selected reference lacks a veranda retain their entrance surround.
        _ => return Value::Null,
    };
    let width = grid(c.width * ratio).clamp(5.,c.width);
    let depth = original_depth.min((c.depth / 3.).max(4.));
    let x = if ratio > 0.85 {(c.width-width)/2.} else {(center-width/2.).clamp(0.,c.width-width)};
    let garage=&ground["garage"];
    let garage_same_side=garage.is_object()&&if return_side=="Left"{n(garage,"x")+24.<=0.01}else{n(garage,"x")>=c.width-0.01};
    let wrap = !return_side.is_empty() && !garage_same_side;
    let mut rectangles=vec![json!({"x":x,"z":-depth,"w":width,"d":depth,"roofType":"Hip","deckYs":[0.2]})];
    if wrap {
        let rw=match c.home_style.as_str(){"Colonial"=>12_f64.min(c.width/3.),"English cottage"=>8.,_=>depth.min(8.)};
        let rd=match c.home_style.as_str(){"Colonial"=>c.depth*28./36.,"English cottage"=>c.depth*19./28.,_ =>(c.depth*0.45).min(20.)};
        if !["Colonial","English cottage"].contains(&c.home_style.as_str()){
            rectangles[0]["x"]=json!(if return_side=="Left"{-rw}else{x});rectangles[0]["w"]=json!(width+rw);
        }
        let deck_ys=if c.home_style=="Colonial"&&c.stories>=2{vec![0.2,0.2+c.wall_height+structural::floor_gap(c)]}else{vec![0.2]};
        rectangles.push(json!({"x":if return_side=="Left"{-rw}else{c.width},"z":0.,"w":rw,"d":rd,"roofType":"Hip","deckYs":deck_ys}));
    }
    let roof_height=c.wall_height-0.3;
    let mut area=0.;let mut deck_area=0.;let mut rim_lf=0.;let mut roof_area=0.;let mut posts:Vec<Value>=vec![];let mut rails:Vec<Value>=vec![];
    let mut roofs=vec![];let mut deck_joists=vec![];
    let step_width=5_f64.min(width-0.5);let step_x=(center-step_width/2.).clamp(x+0.25,x+width-step_width-0.25);
    let mut add_rail=|a:[f64;3],b:[f64;3]|{let length=((a[0]-b[0]).powi(2)+(a[2]-b[2]).powi(2)).sqrt();if length>0.2{rails.push(json!({"a":a,"b":b,"length":length,"balusters":(length/(4./12.)).ceil().max(2.) as usize-1}));}};
    for (i,r) in rectangles.iter().enumerate(){
        let(rx,rz,rw,rd)=(n(r,"x"),n(r,"z"),n(r,"w"),n(r,"d"));area+=rw*rd;
        let mut pc=c.clone();pc.width=rw;pc.depth=rd;pc.wall_height=roof_height+if r["deckYs"].as_array().unwrap().len()>1{c.wall_height+structural::floor_gap(c)}else{0.};pc.pitch=if ["Tudor","English cottage","Colonial"].contains(&c.home_style.as_str())&&i==0{6.}else{3.};pc.stories=1;pc.active_floor=0;pc.design_mode="Custom".into();pc.home_style=if ["Tudor","English cottage","Colonial"].contains(&c.home_style.as_str())&&i==0{"Colonial"}else{"Modern farmhouse"}.into();
        let roof=roof::build_with_overhang(&pc,0.25);roof_area+=n(&roof,"area");
        roofs.push(json!({"x":rx,"z":rz,"w":rw,"d":rd,"h":pc.wall_height,"roof":roof}));
        let stations=(rw/(16./12.)).ceil()as usize;
        for deck_y in r["deckYs"].as_array().unwrap(){let dy=deck_y.as_f64().unwrap();deck_area+=rw*rd;rim_lf+=2.*(rw+rd);
            for j in 0..=stations{deck_joists.push(json!({"a":[rx+rw*j as f64/stations as f64,dy-0.33,rz],"b":[rx+rw*j as f64/stations as f64,dy-0.33,rz+rd],"length":rd,"stockLength":(rd/2.).ceil()*2.}));}
        }
        if i==0 {
            let lo=rx+0.25;let hi=rx+rw-0.25;let stations=((hi-lo)/8.).ceil()as usize;
            for j in 0..=stations{let px=lo+(hi-lo)*j as f64/stations as f64;if px>step_x-0.5&&px<step_x+step_width+0.5{continue}posts.push(json!({"x":px,"z":rz+0.3,"height":pc.wall_height-0.35}));}
            // Frame the entrance gap explicitly; no column or baluster in it.
            for px in [step_x-0.2,step_x+step_width+0.2]{if px>=lo&&px<=hi{posts.push(json!({"x":px,"z":rz+0.3,"height":pc.wall_height-0.35}));}}
            if railing{add_rail([lo,3.,rz+0.3],[step_x-0.2,3.,rz+0.3]);add_rail([step_x+step_width+0.2,3.,rz+0.3],[hi,3.,rz+0.3]);
                if !wrap||return_side!="Left"{add_rail([lo,3.,rz+0.3],[lo,3.,-0.3]);}
                if !wrap||return_side!="Right"{add_rail([hi,3.,rz+0.3],[hi,3.,-0.3]);}}
        }else{
            let edge=if return_side=="Left"{rx+0.25}else{rx+rw-0.25};
            let stations=(rd/8.).ceil()as usize;for j in 0..=stations{posts.push(json!({"x":edge,"z":0.3+(rd-0.6)*j as f64/stations as f64,"height":pc.wall_height-0.35}));}
            if railing{for deck_y in r["deckYs"].as_array().unwrap(){let y=deck_y.as_f64().unwrap()+3.5;add_rail([edge,y,0.3],[edge,y,rd-0.3]);add_rail([rx+0.3,y,rd-0.3],[rx+rw-0.3,y,rd-0.3]);}}
        }
    }
    posts.sort_by(|a,b|n(a,"x").total_cmp(&n(b,"x")).then(n(a,"z").total_cmp(&n(b,"z"))));posts.dedup_by(|a,b|near(n(a,"x"),n(b,"x"))&&near(n(a,"z"),n(b,"z")));
    json!({"form":form,"columnStyle":column,"rectangles":rectangles,"roofs":roofs,"area":area,"deckArea":deck_area,"rimLF":rim_lf,"roofArea":roof_area,"posts":posts,"rails":rails,"deckJoists":deck_joists,"deckY":0.2,"steps":{"x":step_x,"z":-depth,"w":step_width,"risers":2,"tread":1.},"basis":"Source-informed porch proportion and column type. Wood structure, connection, footing, snow/wind loads and coating details require final design."})
}

pub fn apply(c:&Config,mut m:Value)->Value{
    let ground=if c.stories>=2{&m["levels"][0]}else{&m};
    let mut ground=ground.clone();ground["garage"]=m["garage"].clone();
    let porch=design(c,&ground);m["porch"]=porch.clone();
    if c.stories>=2{m["levels"][0]["porch"]=porch.clone();}
    if porch.is_null(){return m}
    let mut t=model::Takeoff{items:vec![],c};let area=n(&porch,"area");let deck_area=n(&porch,"deckArea");let roof_area=n(&porch,"roofArea");
    let posts=porch["posts"].as_array().unwrap().len()as f64;
    let rails=porch["rails"].as_array().unwrap();let rail_lf:f64=rails.iter().map(|r|n(r,"length")).sum();let balusters:f64=rails.iter().map(|r|n(r,"balusters")).sum();
    let joists=porch["deckJoists"].as_array().unwrap();let deck_joist_lf:f64=joists.iter().map(|r|n(r,"stockLength")).sum();
    let roofs=porch["roofs"].as_array().unwrap();let rafters:Vec<_>=roofs.iter().flat_map(|r|r["roof"]["rafters"].as_array().unwrap()).collect();
    let rafter_lf:f64=rafters.iter().map(|r|n(r,"stockLength")).sum();
    let roof_edges:f64=roofs.iter().map(|r|n(&r["roof"],"eaveLF")).sum();
    let ridge_hips:f64=roofs.iter().map(|r|n(&r["roof"],"ridgeLF")+n(&r["roof"],"hipLF")).sum();
    let post_surface:f64=porch["posts"].as_array().unwrap().iter().map(|p|(n(p,"height")-0.2)*2.+0.5).sum();
    let wood_surface=deck_area/(5.5/12.)*2.*(6.5/12.)+deck_joist_lf*2.*(8.75/12.)+post_surface+rail_lf*2.+balusters*2.35*0.28+roof_edges*1.25;
    let perimeter=n(&porch,"rimLF");
    for(id,name,net,unit,price,waste,whole)in[
        ("porch-deck","Sealed wood porch decking · 5/4 × 6",deck_area/ (5.5/12.),"linear ft",2.2,true,false),
        ("porch-joists","Porch deck joists · treated 2 × 8",deck_joist_lf,"linear ft",2.4,true,false),
        ("porch-rim","Porch deck rim / ledger · treated 2 × 8",perimeter,"linear ft",2.4,true,false),
        ("porch-columns","Porch columns · source-matched sealed wood",posts,"pieces",if s(&porch,"columnStyle")=="turned"{260.}else{180.},false,true),
        ("porch-footings","Porch column footing concrete · 24 × 24 × 12 in allowance",posts*4./27.,"cu yd",180.,true,false),
        ("porch-postbases","Porch post bases / anchors / top connectors",posts,"sets",65.,false,true),
        ("porch-rafters","Porch roof I-joists · protected roof assembly",rafter_lf,"linear ft",6.5,true,false),
        ("porch-beams","Porch ridge / hip / edge beams · four-ply LVL allowance",ridge_hips+roof_edges,"assembly linear ft",36.,true,false),
        ("porch-ziproof","Porch ZIP roof sheathing · 4 × 8",roof_area/32.,"sheets",45.,true,true),
        ("porch-ziptape","Porch ZIP seam tape · 90 ft roll",roof_area*0.75/90.,"rolls",32.,true,true),
        ("porch-roof","Porch metal roofing",roof_area,"sq ft",3.5,true,false),
        ("porch-flashing","Porch roof / wall flashing",porch["rectangles"].as_array().unwrap().iter().map(|r|n(r,"w")).sum(),"linear ft",8.,true,false),
        ("porch-fascia","Porch carved fascia / eave trim · sealed wood",roof_edges,"linear ft",5.5,true,false),
        ("porch-soffit","Porch wood soffit",roof_edges*0.25,"sq ft",4.,true,false),
        ("porch-rails","Porch top / bottom rail",rail_lf*2.,"linear ft",4.,true,false),
        ("porch-balusters","Porch balusters · 4 in maximum center spacing",balusters,"pieces",8.,false,true),
        ("porch-steps","Porch entry steps / stringer material",1.,"sets",240.,false,true),
        ("porch-hardware","Porch joist hangers / roof rafter connectors",(joists.len()+rafters.len())as f64*2.,"sets",12.,false,true),
        ("porch-screws","Porch decking / trim corrosion-resistant screw packs",deck_area/100.,"packs",38.,true,true),
        ("porch-sealer","Porch wood sealer · two coats / all wood faces",wood_surface*2./350.,"gallons",65.,true,true),
    ]{t.add(id,"Porch",name,net,unit,price,"Derived from the displayed porch footprint, roof planes, posts, rail runs and joist schedule. Preliminary material/stock allowance; verify exterior-rated assemblies and connections.","Preliminary porch takeoff",waste,whole);}
    m["porch"]["rafterCount"]=json!(rafters.len());m["porch"]["deckJoistCount"]=json!(joists.len());
    let mut items=m["items"].as_array().unwrap().clone();items.extend(t.items.iter().map(|i|serde_json::to_value(i).unwrap()));m["items"]=json!(items);
    let subtotal=round(m["items"].as_array().unwrap().iter().map(|i|n(i,"total")).sum());let tax=round(subtotal*c.tax/100.);m["subtotal"]=json!(subtotal);m["tax"]=json!(tax);m["total"]=json!(round(subtotal+tax));
    m["categoryTotals"]["Porch"]=json!(round(t.items.iter().map(|i|i.total).sum()));
    let mut bounds=if m["siteBounds"].is_object(){m["siteBounds"].clone()}else{json!({"minX":0.,"minZ":0.,"maxX":c.width,"maxZ":c.depth})};
    for r in porch["rectangles"].as_array().unwrap(){bounds["minX"]=json!(n(&bounds,"minX").min(n(r,"x")-0.25));bounds["minZ"]=json!(n(&bounds,"minZ").min(n(r,"z")-2.));bounds["maxX"]=json!(n(&bounds,"maxX").max(n(r,"x")+n(r,"w")+0.25));bounds["maxZ"]=json!(n(&bounds,"maxZ").max(n(r,"z")+n(r,"d")+0.25));}
    m["siteBounds"]=bounds;m["porchArea"]=json!(round(area));m["totalCoveredArea"]=json!(n(&m,"area")+n(&m,"garageArea")+area);m
}
