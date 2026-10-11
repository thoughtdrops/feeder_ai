use crate::*;
fn fixture()->Config{let mut c=Config::default();c.stories=1;c.wall_height=9.;c.width=48.;c.depth=36.;c.pitch=8.;c.catalog_plan=false;c.layout="Cross gallery · Rear hall".into();c}

#[test]fn panel_modules_pre_cuts_and_orders_match_the_requested_assemblies(){
 let mut c=Config::default();c.stories=1;c.width=16.;c.depth=32.;c.design_mode="Blank slate".into();c.garage="None".into();c.dormer_style="None".into();c.rear_outdoor="None".into();c.waste=0.;
 let m=model::build(&c);assert_eq!(n(&m["panelSummary"],"standardPrecutStudInches"),92.625);assert_eq!(c.wall_height*12.,97.125);
 let common:Vec<_>=m["frameMembers"].as_array().unwrap().iter().filter(|p|s(p,"role")=="Common").collect();assert!(!common.is_empty());assert!(common.iter().all(|p|near(n(p,"length")*12.,92.625)));
 let ground=m["crawlFloorFrameMembers"].as_array().unwrap();assert_eq!(ground.iter().filter(|p|s(p,"role")=="Crawlspace floor I-joist").count(),25);assert_eq!(ground.iter().filter(|p|s(p,"role")=="Panel LSL rim board").count(),4);
 let items=m["items"].as_array().unwrap();let row=|id:&str|items.iter().find(|p|s(p,"id")==id).unwrap();
 for id in ["crawl-bottom","crawl-polyiso","crawl-subfloor"]{assert_eq!(n(row(id),"rawNet"),16.);}
 assert_eq!(n(row("crawl-r30"),"rawNet"),512.);assert_eq!(n(row("crawl-r19"),"rawNet"),512.);
 assert_eq!(n(row("drywallwalls"),"rawNet"),2.*48.*c.wall_height/64.);assert_eq!(n(row("drywallceiling"),"rawNet"),c.width*c.depth/64.,"a flat ceiling covers the footprint");let mut vault=c.clone();vault.ceiling="Cathedral".into();let v=model::build(&vault);assert_eq!(n(v["items"].as_array().unwrap().iter().find(|p|s(p,"id")=="drywallceiling").unwrap(),"rawNet"),panels::roof_panel_area(&vault,&v)/64.,"a cathedral ceiling follows the roof");
 assert!(items.iter().all(|i|!["slab","floor-batts","interior-batts"].contains(&s(i,"id"))));assert!(items.iter().any(|i|s(i,"id")=="ceilingjoists"),"a flat ceiling is framed");assert!(v["items"].as_array().unwrap().iter().all(|i|!["ceilingjoists","attichatch","roofvents"].contains(&s(i,"id"))),"a cathedral roof has no attic");
 assert_eq!(items.len(),items.iter().map(|i|s(i,"id")).collect::<std::collections::BTreeSet<_>>().len());
 assert_eq!(n(&m["counts"],"drywallSheets"),items.iter().filter(|i|s(i,"unit")=="sheets"&&s(i,"name").contains("drywall")).map(|i|n(i,"qty")).sum::<f64>());
 let mut g=c.clone();g.garage="Attached".into();let garage=model::build(&g);assert!(near(n(row("atticinsulation"),"rawNet"),n(garage["items"].as_array().unwrap().iter().find(|i|s(i,"id")=="atticinsulation").unwrap(),"rawNet")));
}
#[test]fn blank_stairs_leave_garage_position_fixed_for_both_sides_and_floors(){
 for kind in ["Attached","Detached"]{for side in ["Left","Right"]{let mut c=Config::default();c.width=32.;c.depth=40.;c.design_mode="Blank slate".into();c.garage=kind.into();c.garage_side=side.into();let before=model::build(&c);let p=(n(&before["garage"],"x"),n(&before["garage"],"z"));
  for turn in 0..4{let mut stair=staging::Furniture{id:"F-panel-stairs".into(),kind:"stairs".into(),room_id:"custom".into(),x:16.,z:20.,w:8.,d:16.,local_width:8.,local_depth:16.,rotation:0.};edit::rotate_item(&mut stair,turn as f64*std::f64::consts::FRAC_PI_2);c.placed_furniture=vec![stair];for floor in [0,1]{c.active_floor=floor;let m=model::build(&c);assert!(!m["stair"].is_null());assert_eq!((n(&m["garage"],"x"),n(&m["garage"],"z")),p);}}c.placed_furniture.clear();assert_eq!(model::build(&c)["garage"],before["garage"]);
 }}
}
#[test]fn tile_and_custom_patterns_update_only_the_selected_finishes_and_costs(){
 let mut c=fixture();let base=model::build(&c);c.floor="Carrara marble tile".into();assert!(surfaces::tile(&c.floor).is_some());c.wall_tiles.insert("bedroom".into(),"Teal glazed subway tile".into());let m=model::build(&c);assert_eq!(n(&m,"tileFloorArea"),c.width*c.depth);assert_eq!(n(&m,"tileWallArea"),n(&m,"bedroomWallArea"));assert!(m["items"].as_array().unwrap().iter().all(|i|s(i,"id")!="vinyl"));assert!(n(&m,"total")>n(&base,"total"));
 let pattern=surfaces::TexturePattern{name:"my-pattern.jpg".into(),data_url:"data:image/jpeg;base64,/9j/AAAAAAAAAAAAAA==".into(),repeat_feet:2.};c.custom_textures.insert("general".into(),pattern);assert!(validate(&c).is_ok());let m=model::build(&c);assert_eq!(n(&m,"customWallArea"),n(&m,"generalWallArea"));
 let serialized=serde_json::to_string(&c).unwrap();let restored:Config=serde_json::from_str(&serialized).unwrap();assert_eq!(restored.custom_textures["general"].data_url,c.custom_textures["general"].data_url);
 c.custom_textures.get_mut("general").unwrap().data_url="data:image/svg+xml,<svg onload=alert(1)>".into();assert!(validate(&c).is_err());c.custom_textures.get_mut("general").unwrap().data_url=format!("data:image/jpeg;base64,/9j/{}","A".repeat(200000));assert!(validate(&c).is_err());
}
#[test]fn forty_staging_objects_have_valid_placement_dimensions_and_itemized_prices(){
 assert_eq!(objects::all().len(),40);let mut c=fixture();c.width=24.;c.depth=24.;c.design_mode="Blank slate".into();
 for obj in objects::all(){let(w,d)=edit::item_dimensions(&obj.kind);assert_eq!((w,d),(obj.width,obj.depth));c.placed_furniture=vec![staging::Furniture{id:format!("F-test-{}",obj.kind),kind:obj.kind.clone(),room_id:"custom".into(),x:12.,z:12.,w,d,local_width:w,local_depth:d,rotation:0.}];let m=model::build(&c);assert_eq!(m["furniture"].as_array().unwrap().len(),1,"{}",obj.kind);let row=m["items"].as_array().unwrap().iter().find(|i|s(i,"id")==format!("stage-{}",obj.kind)).unwrap();assert_eq!(n(row,"qty"),1.);assert!(n(row,"price")>0.);}
}


#[test]
fn garages_use_actual_geometry_and_shared_walls_once(){
 for(stories,w,d)in[(1,8.,8.),(1,24.,32.),(1,48.,36.),(1,100.,100.),(2,48.,36.)]{
  for kind in ["Attached","Detached"]{
   let mut c=fixture();c.stories=stories;c.width=w;c.depth=d;c.garage=kind.into();c.waste=0.;c.tax=6.;
   let m=model::build(&c);let g=&m["garage"];
   assert_eq!(n(g,"area"),576.);assert_eq!(n(g,"w"),24.);assert_eq!(n(g,"d"),24.);
   assert_eq!(g["roof"]["rafters"].as_array().unwrap().len(),38);assert_eq!(g["ceilingMembers"].as_array().unwrap().len(),19);
   let ws:Vec<Wall>=serde_json::from_value(g["walls"].clone()).unwrap();
   assert!(near(ws.iter().map(|v|v.length).sum(),96.-n(g,"sharedLength")));
   let overhead=g["openings"].as_array().unwrap().iter().find(|v|s(v,"id")=="G-OVERHEAD").unwrap();assert_eq!(n(overhead,"width"),16.);assert_eq!(n(overhead,"height"),7.);
   let members=g["frameMembers"].as_array().unwrap();let headers:Vec<_>=members.iter().filter(|v|s(v,"openingId")=="G-OVERHEAD"&&s(v,"role")=="Header ply").collect();
   assert_eq!(headers.len(),2);assert!(headers.iter().all(|v|n(v,"length")==16.5&&s(v,"material").starts_with("LVL")));
   assert_eq!(members.iter().filter(|v|s(v,"openingId")=="G-OVERHEAD"&&s(v,"role")=="Jack").count(),4);
   let all=m["allFrameMembers"].as_array().unwrap();let ids:std::collections::BTreeSet<_>=all.iter().map(|v|s(v,"id")).collect();assert_eq!(ids.len(),all.len());
   let studs=all.iter().filter(|v|["Common","King","Jack","Cripple","Corner backing","Intersection backing","Gable"].contains(&s(v,"role"))).count();assert_eq!(n(&m["counts"],"studs"),studs as f64);
   let items=m["items"].as_array().unwrap();assert_eq!(round(items.iter().map(|v|n(v,"total")).sum()),n(&m,"subtotal"));assert_eq!(n(&m,"total"),round(n(&m,"subtotal")+n(&m,"tax")));
   assert_eq!(n(&m,"tax"),round(n(&m,"subtotal")*0.06));assert!(items.iter().all(|v|n(v,"total")==round(n(v,"qty")*n(v,"price"))));
   assert_eq!(n(items.iter().find(|v|s(v,"id")=="garage-slab").unwrap(),"rawNet"),576./81.);
   assert_eq!(n(items.iter().find(|v|s(v,"id")=="garage-ziproof").unwrap(),"rawNet"),n(&g["roof"],"area")/32.);
   assert_eq!(n(&m["counts"],"drywallSheets"),items.iter().filter(|v|s(v,"unit")=="sheets"&&(s(v,"id").starts_with("drywall")||["garage-drywall","garage-ceilingdrywall"].contains(&s(v,"id")))).map(|v|n(v,"qty")).sum::<f64>());
   if kind=="Attached"{assert!(n(g,"sharedLength")>0.);assert_eq!(g["connection"],json!(true));let ground=if stories==2{&m["levels"][0]}else{&m};let rooms:Vec<Room>=serde_json::from_value(ground["rooms"].clone()).unwrap();let walls:Vec<Wall>=serde_json::from_value(ground["walls"].clone()).unwrap();let (wall,door)=walls.iter().find_map(|v|v.openings.iter().find(|o|o.id=="G-HOUSE-DOOR").map(|o|(v,o))).unwrap();let z=wall.z+door.at+door.width/2.;assert!(!rooms.iter().any(|r|r.kind=="bedroom"&&z>r.z&&z<r.z+r.d&&(near(wall.x,r.x)||near(wall.x,r.x+r.w))));}
   else{assert_eq!(n(g,"sharedLength"),0.);assert_eq!(g["connection"],json!(false));assert_eq!(n(g,"x"),w+8.);}
   if stories==2{let mut upper=c.clone();upper.active_floor=1;let upper=model::build(&upper);assert_eq!(upper["garage"],m["garage"]);assert_eq!(n(&upper,"total"),n(&m,"total"));}
  }
 }
}

#[test]
fn garage_material_prices_waste_and_removal_recalculate(){
 let mut c=fixture();let base=model::build(&c);assert!(base["garage"].is_null());
 c.garage="Attached".into();let with=model::build(&c);assert!(n(&with,"total")>n(&base,"total"));
 let door=with["items"].as_array().unwrap().iter().find(|v|s(v,"id")=="garage-overheaddoor").unwrap();assert_eq!(n(door,"qty"),1.);
 c.prices.insert("garage-overheaddoor".into(),3000.);let edited=model::build(&c);assert_eq!(n(&edited,"subtotal"),n(&with,"subtotal")+800.);
 c.waste=20.;let waste=model::build(&c);assert!(n(&waste,"subtotal")>n(&edited,"subtotal"));assert_eq!(n(waste["items"].as_array().unwrap().iter().find(|v|s(v,"id")=="garage-overheaddoor").unwrap(),"qty"),1.);
 c.garage="None".into();c.waste=10.;assert_eq!(model::build(&c),base);
 c.garage="Invalid".into();assert!(validate(&c).is_err());
}
#[test]fn trim_sizes_and_corner_costs_match_the_visible_trim(){
 for package in catalog()["trimPackages"].as_array().unwrap(){for(w,d)in[(8.,8.),(48.,36.),(100.,100.)]{
  let mut c=fixture();c.width=w;c.depth=d;c.trim_package=s(package,"name").into();let normal=model::build(&c);c.trim_size="Oversized".into();let big=model::build(&c);
  assert!(near(n(&big["trimPackage"],"baseHeight"),n(&normal["trimPackage"],"baseHeight")*1.5));assert!(near(n(&big["trimPackage"],"cornerWidth"),n(&normal["trimPackage"],"cornerWidth")*1.5));assert_eq!(normal["counts"]["studs"],big["counts"]["studs"]);assert!(n(&big["trimPackage"],"casingPrice")>n(&normal["trimPackage"],"casingPrice"));
  for m in [normal,big]{
   assert_eq!(m["trimPackage"]["panels"],false);assert_eq!(n(&m["trimPackage"],"chairRail"),0.);assert!(m.get("trimPanels").is_none());
   let rows=m["items"].as_array().unwrap();assert!(!rows.iter().any(|i|["paneltrim","panelinfill","chairrail"].contains(&s(i,"id"))));let corners=m["trimCorners"].as_array().unwrap();assert!(!corners.is_empty());
   let row=rows.iter().find(|i|s(i,"id")=="cornertrim").unwrap();assert!(near(n(row,"rawNet"),corners.iter().map(|p|n(p,"length")).sum()));assert!(near(n(&m,"subtotal"),round(rows.iter().map(|i|n(i,"total")).sum())));
   for corner in corners{let wall=m["walls"].as_array().unwrap().iter().find(|w|s(w,"id")==s(corner,"wallId")).unwrap();let width=n(corner,"width");assert!(n(corner,"at")>=width/2.-1e-8&&n(corner,"at")+width/2.<=n(wall,"length")+1e-8);assert!(near(n(corner,"length"),c.wall_height-0.2));}
   let casing=rows.iter().find(|i|s(i,"id")=="casing").unwrap();let expected:f64=m["walls"].as_array().unwrap().iter().map(|w|w["openings"].as_array().unwrap().iter().filter(|o|s(o,"kind")!="window").map(|o|(2.*(n(o,"height")-0.2)+n(o,"width")+2.*n(&m["trimPackage"],"casingWidth"))*if w["exterior"]==true{1.}else{2.}).sum::<f64>()).sum();assert!(near(n(casing,"rawNet"),expected));
  }
 }}let mut c=fixture();c.trim_size="Invalid".into();assert!(validate(&c).is_err());
}
#[test]fn every_generated_room_uses_the_two_foot_grid_without_gaps_or_overlaps(){
 for w in (8..=100).step_by(2){for d in (8..=100).step_by(2){for style in catalog()["layoutStyles"].as_array().unwrap(){let mut c=fixture();c.width=w as f64;c.depth=d as f64;c.layout=s(style,"name").into();let(rs,_)=layout(&c);assert!(!rs.is_empty());assert!(near(rs.iter().map(|r|r.w*r.d).sum(),c.width*c.depth));for(i,r)in rs.iter().enumerate(){for n in [r.x,r.z,r.w,r.d]{assert!(near(n/2.,(n/2.).round()));}assert!(r.w>=2.&&r.d>=2.&&r.x>=0.&&r.z>=0.&&r.x+r.w<=c.width&&r.z+r.d<=c.depth);for other in &rs[i+1..]{assert!((r.x+r.w).min(other.x+other.w)<=r.x.max(other.x)+1e-8||(r.z+r.d).min(other.z+other.d)<=r.z.max(other.z)+1e-8);}}}}}
}
#[test]fn detailed_takeoff_reconciles_with_geometry_rounded_prices_waste_tax_and_categories(){
 for(w,d)in[(8.,8.),(24.,32.),(48.,36.),(100.,100.)]{let mut c=fixture();c.width=w;c.depth=d;c.tax=7.25;c.waste=13.;c.wallpaper="Midnight damask".into();c.bedroom_wallpaper="Botanical silk".into();c.prices.insert("counter".into(),45.125);c.roofing=roofing::METAL.into();let m=model::build(&c);let items=m["items"].as_array().unwrap();let mut ids=std::collections::BTreeSet::new();let mut categories=BTreeMap::<String,f64>::new();for i in items{assert!(ids.insert(s(i,"id")));let raw=n(i,"rawNet");let ordered=raw*(1.+n(i,"wastePercent")/100.);let expected=if s(i,"rounding")=="Whole purchase units"{(ordered-1e-9).max(0.).ceil()}else{round(ordered)};assert!(near(n(i,"net"),round(raw)));assert!(near(n(i,"qty"),expected));assert!(near(n(i,"price"),round(n(i,"price"))));assert!(near(n(i,"total"),round(n(i,"qty")*n(i,"price"))));*categories.entry(s(i,"category").into()).or_default()+=n(i,"total");}assert!(near(n(&m,"subtotal"),round(items.iter().map(|i|n(i,"total")).sum())));assert!(near(n(&m,"tax"),round(n(&m,"subtotal")*c.tax/100.)));assert!(near(n(&m,"total"),round(n(&m,"subtotal")+n(&m,"tax"))));for(cat,total)in categories{assert!(near(m["categoryTotals"][cat].as_f64().unwrap(),total));}
 let row=|id:&str|items.iter().find(|i|s(i,"id")==id).unwrap();assert!(near(n(row("roofmetal"),"rawNet"),(w+2.*n(&m["roof"],"overhangX"))*(d+2.*n(&m["roof"],"overhangZ"))*(1.+(c.pitch/12.).powi(2)).sqrt()));assert!(near(n(row("counter"),"rawNet"),m["furniture"].as_array().unwrap().iter().filter(|f|["kitchen","island"].contains(&s(f,"kind"))).map(|f|n(f,"localWidth")*n(f,"localDepth")).sum()));let faces=m["wallFaces"].as_array().unwrap();assert!((faces.iter().map(|f|n(f,"area")).sum::<f64>()-n(&m,"drywallWalls")).abs()<0.011);assert!((n(&m,"wallpaperBedroomArea")+n(&m,"wallpaperGeneralArea")-n(&m,"wallpaperArea")).abs()<0.021);assert!(m["ventilation"]["passesArea"]==true&&m["ventilation"]["passesBalance"]==true);assert!(!items.iter().any(|i|["electrical","plumbing","hvac","appliances"].contains(&s(i,"id"))));}
}
#[test]fn opening_heights_reject_invalid_sills_and_keep_product_approval_explicit(){
 for(w,d)in[(8.,8.),(8.,100.),(100.,8.),(24.,32.),(48.,36.),(100.,100.)]{for style in catalog()["layoutStyles"].as_array().unwrap(){for h in [8.,9.,10.]{let mut c=fixture();c.width=w;c.depth=d;c.wall_height=h;c.layout=s(style,"name").into();let(rs,_)=layout(&c);let ws=model::walls(&c,&rs);for wall in &ws{assert!(rules::opening_error(&wall.openings,wall,&c,&rs).is_none(),"{} x {} / {} / {} ft: {} {:?}",w,d,c.layout,h,wall.name,rules::opening_error(&wall.openings,wall,&c,&rs));}}}}
 let c=fixture();let(rs,_)=layout(&c);let ws=model::walls(&c,&rs);for w in &ws{assert!(model::valid_openings(&w.openings,w.length,c.wall_height));assert!(rules::opening_error(&w.openings,w,&c,&rs).is_none());}let checks=rules::opening_schedule(&c,&rs,&ws);assert!(checks["allHeightGuardrailsPass"]==true);let(w,window)=ws.iter().filter(|w|w.exterior).find_map(|w|w.openings.iter().find(|o|o.kind=="window"&&rules::adjacent_rooms(o,w,&rs).iter().any(|r|r.kind=="bedroom")).map(|o|(w,o))).unwrap();let mut wrong=window.clone();wrong.bottom=4.;assert!(rules::opening_error(&[wrong],w,&c,&rs).unwrap().contains("42 in"));let mut low=window.clone();low.bottom=1.;assert!(!model::valid_openings(&[low],w.length,c.wall_height));let mut door=ws[0].openings.iter().find(|o|o.kind=="door").unwrap().clone();door.height=6.4;assert!(!model::valid_openings(&[door],ws[0].length,c.wall_height));
}
#[test]fn resized_walls_keep_openings_in_place_and_update_the_takeoff(){
 let mut c=fixture();let wall=Wall{id:"I-C-resize".into(),name:"Resizable wall".into(),x:5.,z:5.,length:10.,axis:"x".into(),exterior:false,openings:vec![Opening{id:"resize-window".into(),kind:"window".into(),at:3.,width:3.,bottom:3.,height:4.}]};c.added_walls.push(wall.clone());let before=model::build(&c);
 let extended=edit::resized_wall(&wall,&c,"end",17.).unwrap();c.wall_adjustments.insert(wall.id.clone(),WallGeometry{x:extended.x,z:extended.z,length:extended.length,axis:String::new()});c.opening_overrides.insert(wall.id.clone(),extended.openings.clone());let after=model::build(&c);assert!((n(&after,"drywallWalls")-n(&before,"drywallWalls")-36.).abs()<0.01);assert_ne!(after["total"],before["total"]);
 let shifted=edit::resized_wall(&extended,&c,"start",7.).unwrap();assert_eq!(shifted.x+shifted.openings[0].at,8.);c.wall_adjustments.insert(wall.id.clone(),WallGeometry{x:shifted.x,z:shifted.z,length:shifted.length,axis:String::new()});c.opening_overrides.insert(wall.id.clone(),shifted.openings.clone());let after=model::build(&c);let ws:Vec<Wall>=serde_json::from_value(after["walls"].clone()).unwrap();let actual=ws.iter().find(|w|w.id==wall.id).unwrap();assert_eq!(actual.x,7.);assert_eq!(actual.length,10.);assert_eq!(actual.x+actual.openings[0].at,8.);assert_eq!(after["frameMembers"].as_array().unwrap().iter().filter(|f|s(f,"openingId")=="resize-window"&&s(f,"role")=="Flat door header").count(),1);
 assert!(edit::resized_wall(&shifted,&c,"start",9.).is_err());assert!(edit::resized_wall(&shifted,&c,"end",10.).is_err());assert!(edit::resized_wall(&shifted,&c,"end",7.25).is_err());
}
#[test]fn resized_split_wall_remains_resized_after_another_section_edit(){
 let mut c=fixture();c.added_walls.push(Wall{id:"I-C-split".into(),name:"Split".into(),x:5.,z:5.,length:10.,axis:"z".into(),exterior:false,openings:vec![]});c.wall_removals.push(WallRemoval{wall_id:"I-C-split".into(),at:4.,width:2.});c.wall_adjustments.insert("I-C-split-B".into(),WallGeometry{x:5.,z:10.,length:8.,axis:String::new()});c.wall_removals.push(WallRemoval{wall_id:"I-C-split-B".into(),at:2.,width:1.});let m=model::build(&c);let ws=m["walls"].as_array().unwrap();let last=ws.iter().find(|w|s(w,"id")=="I-C-split-B-B").unwrap();assert_eq!(n(last,"z"),13.);assert_eq!(n(last,"length"),5.);
}
#[test]fn all_layouts_and_sizes_have_consistent_quantities(){for(w,d)in[(8.,8.),(8.,100.),(100.,8.),(24.,32.),(48.,36.),(100.,100.)]{for style in catalog()["layoutStyles"].as_array().unwrap(){let mut c=fixture();c.width=w;c.depth=d;c.layout=s(style,"name").into();validate(&c).unwrap();let m=model::build(&c);let rs=m["rooms"].as_array().unwrap();assert!((rs.iter().map(|r|n(r,"w")*n(r,"d")).sum::<f64>()-w*d).abs()<0.1);for r in rs{assert!(n(r,"x")>=0.&&n(r,"z")>=0.&&n(r,"x")+n(r,"w")<=w+0.01&&n(r,"z")+n(r,"d")<=d+0.01);}let items=m["items"].as_array().unwrap();assert!((round(items.iter().map(|i|n(i,"total")).sum())-n(&m,"subtotal")).abs()<0.01);assert!(items.iter().all(|i|n(i,"net")>=0.&&n(i,"qty")>=0.&&n(i,"total").is_finite()));assert_eq!(n(&m["counts"],"studs"),n(&m["counts"],"exteriorStuds")+n(&m["counts"],"interiorStuds"));assert_eq!(n(&m["counts"],"headerPlies"),2.*m["walls"].as_array().unwrap().iter().filter(|w|w["exterior"]==true).map(|w|w["openings"].as_array().unwrap().len()).sum::<usize>()as f64);assert!(n(&m,"cavityArea")>0.&&n(&m,"cavityArea")<n(&m,"perimeter")*c.wall_height);}}}
#[test]fn edits_update_openings_framing_and_cost(){let mut c=fixture();let before=model::build(&c);let ws=model::walls(&c,&layout(&c).0);let wall=&ws[0];c.opening_overrides.insert(wall.id.clone(),vec![]);let after=model::build(&c);assert!(after["walls"][0]["openings"].as_array().unwrap().is_empty());assert!(n(&after["counts"],"headers")<n(&before["counts"],"headers"));assert!(n(&after,"drywallTotal")>n(&before,"drywallTotal"));assert_ne!(n(&after,"total"),n(&before,"total"));c.opening_overrides.insert("E1".into(),vec![Opening{id:"U1".into(),kind:"door".into(),at:4.,width:3.,bottom:0.,height:7.}]);let after=model::build(&c);assert_eq!(after["walls"][0]["openings"].as_array().unwrap().len(),1);assert_eq!(after["frameMembers"].as_array().unwrap().iter().filter(|m|s(m,"openingId")=="U1"&&s(m,"role")=="Header ply").count(),2);}
#[test]fn lsl_changes_cost_and_schedule_without_changing_piece_count(){let mut c=fixture();let a=model::build(&c);c.stud_type="LSL studs".into();let b=model::build(&c);assert_eq!(a["counts"]["studs"],b["counts"]["studs"]);assert!(n(&b,"total")>n(&a,"total"));assert!(b["frameMembers"].as_array().unwrap().iter().any(|x|s(x,"material")=="LSL 2x6"));}
#[test]fn counties_and_insulation_profiles_change(){let miami=rules::locate(25.77,-80.19).unwrap();let minneapolis=rules::locate(44.98,-93.26).unwrap();assert_eq!(s(&miami,"zone"),"1A");let mut c=fixture();c.county=s(&miami,"id").into();let a=rules::profile(&c);c.county=s(&minneapolis,"id").into();let b=rules::profile(&c);assert!(n(&a,"requiredAtticR")<n(&b,"requiredAtticR"));assert_eq!(s(&a,"facing"),"Kraft faced");assert_eq!(s(&b,"facing"),"Kraft faced");assert_eq!(n(&b,"requiredContinuousR"),6.);c.facing="Unfaced".into();assert_eq!(s(&rules::profile(&c),"facing"),"Kraft faced");}
#[test]fn staged_furniture_stays_in_its_room_and_clear_of_openings(){for size in [8.,24.,48.,100.]{for i in 0..30{let mut c=fixture();c.width=size;c.depth=size;c.layout=s(&catalog()["layoutStyles"][i],"name").into();let(rs,_)=layout(&c);let ws=model::walls(&c,&rs);let(fs,_)=staging::build(&rs,&ws);for f in &fs{let r=rs.iter().find(|r|r.id==f.room_id).unwrap();assert!(f.x-f.w/2.>=r.x&&f.x+f.w/2.<=r.x+r.w&&f.z-f.d/2.>=r.z&&f.z+f.d/2.<=r.z+r.d);assert!(!(f.kind=="sofa"&&r.kind=="kitchen"));let a=[f.x-f.w/2.,f.z-f.d/2.,f.x+f.w/2.,f.z+f.d/2.];for b in staging::aprons(r,&ws){assert!(!(a[0]<b[2]-0.001&&a[2]>b[0]+0.001&&a[1]<b[3]-0.001&&a[3]>b[1]+0.001));}}}}}
#[test]fn reject_invalid_dimensions_and_openings(){let mut c=fixture();c.width=7.9;assert!(validate(&c).is_err());c.width=100.1;assert!(validate(&c).is_err());assert!(!model::valid_openings(&[Opening{id:"x".into(),kind:"door".into(),at:2.,width:3.,bottom:0.,height:8.}],10.,8.));}
#[test]fn zip_only_and_no_duplicate_electrical_device_allowance(){let m=model::build(&fixture());let items=m["items"].as_array().unwrap();assert!(items.iter().any(|i|s(i,"id")=="zipwall"));assert!(!items.iter().any(|i|["wallosb","roofosb","wrap","vapor"].contains(&s(i,"id"))));let outlets=items.iter().find(|i|s(i,"id")=="outlets").unwrap();assert_eq!(n(outlets,"net"),n(&m["electrical"],"total"));}
#[test]fn wall_sections_custom_walls_and_wallpaper_share_geometry(){
 let mut c=fixture();let before=model::build(&c);c.wallpaper="Midnight damask".into();c.bedroom_wallpaper="Midnight damask".into();
 let paper=model::build(&c);assert!((n(&paper,"wallpaperArea")-n(&paper,"drywallWalls")).abs()<0.01);
 c.wall_removals.push(WallRemoval{wall_id:"E3".into(),at:13.,width:4.});
 let after=model::build(&c);assert!(n(&after,"drywallWalls")<n(&before,"drywallWalls"));
 assert!(after["walls"].as_array().unwrap().iter().all(|w|s(w,"id")!="E3"));
 for f in after["frameMembers"].as_array().unwrap().iter().filter(|f|s(f,"wallId").starts_with("E3")){assert!(n(f,"z1")>=-0.001&&n(f,"z2")<=c.depth+0.001);assert!(!(n(f,"z1")>13.001&&n(f,"z1")<16.999));}
 c.added_walls.push(Wall{id:"I-C-test".into(),name:"Custom".into(),x:10.,z:10.,length:6.,axis:"x".into(),exterior:false,openings:vec![]});
 let custom=model::build(&c);assert!((n(&custom,"partitionLength")-n(&after,"partitionLength")-6.).abs()<0.001);
 assert!((n(&custom,"drywallWalls")-n(&after,"drywallWalls")-108.).abs()<0.01);
 assert!(custom["frameMembers"].as_array().unwrap().iter().any(|f|s(f,"wallId")=="I-C-test"));
 let ws:Vec<Wall>=serde_json::from_value(custom["walls"].clone()).unwrap();let fs:Vec<staging::Furniture>=serde_json::from_value(custom["furniture"].clone()).unwrap();assert!(fs.iter().all(|f|edit::clear_of_walls(f,&ws)));
}
#[test]fn every_opening_has_the_matching_rough_framing(){
 for i in 0..30{let mut c=fixture();c.layout=s(&catalog()["layoutStyles"][i],"name").into();let m=model::build(&c);let frames=m["frameMembers"].as_array().unwrap();for opening in m["openings"].as_array().unwrap(){let group:Vec<_>=frames.iter().filter(|f|s(f,"openingId")==s(opening,"id")).collect();let bearing=m["walls"].as_array().unwrap().iter().find(|w|w["id"]==opening["wallId"]).unwrap()["exterior"]==true;for(role,count)in [("Header ply",if bearing{2}else{0}),("Flat door header",if bearing{0}else{1}),("King",2),("Jack",if bearing{2}else{0})]{assert_eq!(group.iter().filter(|f|s(f,"role")==role).count(),count);}assert_eq!(group.iter().filter(|f|s(f,"role")=="Rough sill").count(),usize::from(s(opening,"kind")=="window"));}}
}

#[test]fn architecture_changes_footprints_wall_plans_and_roof_topology(){
 let mut signatures=std::collections::BTreeSet::new();for name in catalog()["options"]["homeStyle"].as_array().unwrap(){let mut c=fixture();c.home_style=name.as_str().unwrap().into();architecture::apply(&mut c,true);validate(&c).unwrap();let m=model::build(&c);assert!(!c.layout.is_empty());signatures.insert(format!("{}:{}:{}:{}",c.width,c.depth,c.layout,m["roof"]["type"]));let roof=&m["roof"];assert!(n(roof,"area")>c.width*c.depth);assert!(!roof["facets"].as_array().unwrap().is_empty());for r in m["rafters"].as_array().unwrap(){for suffix in ["1","2"]{let x=n(r,&format!("x{}",suffix));let z=n(r,&format!("z{}",suffix));let y=n(r,&format!("y{}",suffix));assert!((y-c.wall_height-roof::height(&c,x,z)).abs()<1e-5,"{} {:?}",c.home_style,r);}let len=((n(r,"x2")-n(r,"x1")).powi(2)+(n(r,"z2")-n(r,"z1")).powi(2)+(n(r,"y2")-n(r,"y1")).powi(2)).sqrt();assert!((len-n(r,"length")).abs()<1e-6);}
 let projected:f64=roof["facets"].as_array().unwrap().iter().map(|f|{let p=f["plane"].as_array().unwrap();n(f,"area")/(1.+p[0].as_f64().unwrap().powi(2)+p[1].as_f64().unwrap().powi(2)).sqrt()}).sum();let expected=(c.width+2.*n(roof,"overhangX"))*(c.depth+2.*n(roof,"overhangZ"));assert!((projected-expected).abs()<1e-5,"Roof plane area must cover the entire footprint exactly once");if s(roof,"type")=="Hip"{assert!(n(roof,"hipLF")>0.);assert_eq!(n(roof,"infillArea"),0.);}if s(roof,"type")=="Cross gable"{assert!(n(roof,"valleyLF")>0.);} }
 assert_eq!(signatures.len(),15);
}
#[test]fn two_storeys_have_connected_programs_and_single_roof_foundation(){for name in ["Victorian","Georgian","Ranch","Scandinavian","Contemporary"]{let mut c=fixture();c.home_style=name.into();c.stories=2;architecture::apply(&mut c,true);let m=model::build(&c);let ls=m["levels"].as_array().unwrap();assert_eq!(ls.len(),2);assert_eq!(n(&ls[0]["counts"],"bedrooms"),0.);assert_eq!(n(&ls[1]["counts"],"bedrooms"),3.);assert!(!ls[0]["furniture"].as_array().unwrap().iter().any(|f|["bed","wallbed"].contains(&s(f,"kind"))));assert!(!ls[1]["furniture"].as_array().unwrap().iter().any(|f|["kitchen","sofa"].contains(&s(f,"kind"))));for l in ls{let rs:Vec<Room>=serde_json::from_value(l["rooms"].clone()).unwrap();assert_eq!(rs.iter().map(|r|r.w*r.d).sum::<f64>(),c.width*c.depth);for r in &rs{assert!([r.x,r.z,r.w,r.d].iter().all(|x|near(*x/2.,(*x/2.).round())));}let ws:Vec<Wall>=serde_json::from_value(l["walls"].clone()).unwrap();for r in rs.iter().filter(|r|["bedroom","bath","stairs"].contains(&r.kind.as_str())){assert!(!staging::aprons(r,&ws).is_empty(),"No access for {} in {}",r.name,name);}}
 let items=m["items"].as_array().unwrap();assert!(!items.iter().any(|i|s(i,"id")=="slab"));assert!((n(items.iter().find(|i|s(i,"id")=="crawl-subfloor").unwrap(),"rawNet")-c.width*c.depth/32.).abs()<1e-6);assert!((n(items.iter().find(|i|s(i,"id")=="ziproof").unwrap(),"rawNet")-n(&m,"roofArea")/32.).abs()<1e-6);assert_eq!(m["allFrameMembers"].as_array().unwrap().len(),ls.iter().map(|l|l["frameMembers"].as_array().unwrap().len()).sum::<usize>());assert!(n(&m["stair"],"riserInches")<=7.75);assert!(m["floorFrameMembers"].as_array().unwrap().len()>20);let sum=round(items.iter().map(|i|n(i,"total")).sum());assert_eq!(sum,n(&m,"subtotal"));c.active_floor=1;let upper=model::build(&c);assert_eq!(upper["total"],m["total"]);assert!(upper["walls"].as_array().unwrap().iter().all(|w|s(w,"id").contains("-L2")));}}

#[test]
fn compact_two_story_programs_fit_24_foot_shells_and_both_tiers() {
 for (beds,depth) in [(1,32.),(2,32.),(3,32.),(4,40.),(5,60.),(6,72.)] {
  for width in [24.,28.] {
   let mut c=fixture();c.width=width;c.depth=depth;c.stories=2;c.bedrooms=beds;
   validate(&c).unwrap();
   for mode in ["Affordable","Premium"] {
    let next=generator::generate(&c,mode,400+beds as u32,true).unwrap_or_else(|e|panic!("{} {}x{} beds {}: {}",mode,width,depth,beds,e));
    let m=model::build(&next);assert!(generator::practical(&next,&m));
    assert_eq!(next.width,width);assert_eq!(next.depth,depth);
    for level in m["levels"].as_array().unwrap() {
     let rs:Vec<Room>=serde_json::from_value(level["rooms"].clone()).unwrap();
     assert!(near(rs.iter().map(|r|r.w*r.d).sum(),width*depth));
     for (i,r) in rs.iter().enumerate() {
      assert!([r.x,r.z,r.w,r.d].iter().all(|v|near(*v/2.,(*v/2.).round())));
      for other in &rs[i+1..] {assert!((r.x+r.w).min(other.x+other.w)<=r.x.max(other.x)+1e-8||(r.z+r.d).min(other.z+other.d)<=r.z.max(other.z)+1e-8);}
     }
    }
    assert_eq!(n(&m["counts"],"bedrooms"),beds as f64);
    assert_eq!(n(&m["levels"][0]["counts"],"bedrooms"),0.);
   }
  }
 }
 let mut c=fixture();c.width=20.;c.stories=2;assert!(validate(&c).is_err());
 c.width=24.;c.depth=28.;c.bedrooms=4;assert!(validate(&c).is_err());
}

#[test]
fn project_allowances_are_added_once_after_house_floors_and_garage() {
 for stories in [1,2] {for garage in ["None","Attached","Detached"] {
  let mut c=fixture();c.stories=stories;c.garage=garage.into();c.tax=7.25;c.waste=15.;
  let before=model::build(&c);assert_eq!(n(&before,"projectCostTotal"),32000.);
  assert!(near(n(&before,"projectTotal"),round(n(&before,"total")+32000.)));
  c.labor_cost=12500.;c.land_cost=23000.;c.permit_cost=9000.;c.survey_cost=4500.;
  let after=model::build(&c);assert_eq!(after["items"],before["items"]);assert_eq!(after["tax"],before["tax"]);
  assert_eq!(n(&after,"projectCostTotal"),49000.);
  assert!(near(n(&after,"projectTotal")-n(&before,"projectTotal"),17000.));
  if stories==2 {c.active_floor=1;assert_eq!(model::build(&c)["projectTotal"],after["projectTotal"]);}
 }}
 let mut c=fixture();c.labor_cost=-1.;assert!(validate(&c).is_err());
 c.labor_cost=0.;c.land_cost=f64::NAN;assert!(validate(&c).is_err());
}

#[test]
fn blank_shells_and_four_ply_ridge_quantities_follow_their_geometry() {
 for stories in [1,2] {
  let mut c=fixture();c.width=24.;c.depth=28.;c.stories=stories;c.design_mode="Blank slate".into();
  let m=model::build(&c);let levels=m["levels"].as_array().cloned().unwrap_or_else(||vec![m.clone()]);
  for level in levels {assert_eq!(level["walls"].as_array().unwrap().len(),4);assert!(level["furniture"].as_array().unwrap().is_empty());assert!(level["openings"].as_array().unwrap().is_empty());}
  assert_eq!(n(&m,"area"),c.width*c.depth*stories as f64);assert_eq!(n(&m,"partitionLength"),0.);
  if stories==2 {assert!(m["stair"].is_null());assert!(near(n(m["items"].as_array().unwrap().iter().find(|v|s(v,"id")=="subfloor").unwrap(),"rawNet"),c.width*c.depth/32.));}
 }
 let mut c=fixture();c.home_style="Craftsman".into();let m=model::build(&c);
 let ridge=&m["roof"];let members=ridge["ridgeMembers"].as_array().unwrap();
 assert_eq!(members.len(),ridge["edges"].as_array().unwrap().iter().filter(|v|s(v,"kind")=="ridge").count()*4);
 let row=m["items"].as_array().unwrap().iter().find(|v|s(v,"id")=="ridgebeam").unwrap();
 assert!(near(n(row,"rawNet"),members.iter().map(|v|n(v,"length")).sum()));
 assert_eq!(n(&ridge["ridgeAssembly"],"widthInches"),7.);
}

#[test]
fn drawn_walls_use_the_plan_grid_and_reject_duplicate_lines() {
 let mut c=fixture();c.design_mode="Blank slate".into();c.width=32.;c.depth=32.;
 let w=edit::drawn_wall("I-C1".into(),&c,8.,12.,24.,12.4,&[]).unwrap();
 assert_eq!((w.x,w.z,w.length,w.axis.as_str()),(8.,12.,16.,"x"));
 assert!(edit::drawn_wall("I-C2".into(),&c,12.,12.,28.,12.,std::slice::from_ref(&w)).is_err());
 assert!(edit::drawn_wall("I-C3".into(),&c,8.,8.,8.4,8.4,&[]).is_err());
 assert!(edit::drawn_wall("I-C4".into(),&c,8.,8.,40.,8.,&[]).is_err());
 let next=edit::moved_wall(&w,&c,0.,4.,&[]).unwrap();assert_eq!(next.z,16.);
 c.added_walls.push(next);assert!(edit::blank_edits_fit(&c));c.depth=12.;assert!(!edit::blank_edits_fit(&c));
}

#[test]
fn architecture_defaults_offer_bright_period_and_modern_wall_finishes() {
 for name in catalog()["options"]["homeStyle"].as_array().unwrap(){let mut c=fixture();c.home_style=name.as_str().unwrap().into();finishes::architecture_defaults(&mut c);
  for (key,value) in [("interiorStyle",&c.interior_style),("drywall",&c.drywall),("wallpaper",&c.wallpaper),("wallpaper",&c.bedroom_wallpaper)]{assert!(catalog()["options"][key].as_array().unwrap().iter().any(|v|v.as_str()==Some(value.as_str())));}
  assert!(c.colors["walls"].starts_with('#'));let m=model::build(&c);assert!(m["wallFaces"].as_array().unwrap().iter().all(|f|s(f,"wallpaper")==if s(f,"group")=="bedroom"{&c.bedroom_wallpaper}else{&c.wallpaper}));
 }
}

#[test]fn heritage_defaults_and_named_source_plans_are_consistent(){
 let initial=Config::default();assert_eq!((initial.width,initial.depth,initial.stories),(26.,46.,2));assert_eq!(initial.layout,heritage::plan_name("Victorian"));let mut signatures=std::collections::BTreeSet::new();
 for name in catalog()["options"]["homeStyle"].as_array().unwrap(){let name=name.as_str().unwrap();let mut c=Config::default();c.home_style=name.into();c.stories=heritage::default_stories(name);c.bedrooms=heritage::default_bedrooms(name);architecture::apply(&mut c,true);validate(&c).unwrap();let m=model::build(&c);let levels=m["levels"].as_array().cloned().unwrap_or_else(||vec![m.clone()]);assert!(m["openingChecks"]["allHeightGuardrailsPass"]==true,"{}: {:?}",name,m["openingChecks"]);assert_eq!(n(&m["counts"],"bedrooms"),c.bedrooms as f64,"{} bedrooms",name);
  for l in &levels{let rs:Vec<Room>=serde_json::from_value(l["rooms"].clone()).unwrap();assert!(near(rs.iter().map(|r|r.w*r.d).sum(),c.width*c.depth),"{} floor {} area {} expected {} rooms {:?}",name,n(l,"floorIndex"),rs.iter().map(|r|r.w*r.d).sum::<f64>(),c.width*c.depth,rs);for r in &rs{assert!([r.x,r.z,r.w,r.d].iter().all(|v|near(*v/2.,(*v/2.).round())));}
   if n(l,"floorIndex")==0.{let foyer=rs.iter().find(|r|r.kind=="foyer").expect("enclosed foyer");let ws:Vec<Wall>=serde_json::from_value(l["walls"].clone()).unwrap();let doors:Vec<_>=ws.iter().flat_map(|w|w.openings.iter().map(move|o|(w,o))).filter(|(w,o)|o.kind=="door"&&rules::adjacent_rooms(o,w,&rs).iter().any(|r|r.id==foyer.id)).collect();assert!(doors.iter().any(|(w,_)|w.exterior),"{} entry foyer outside door",name);assert!(doors.iter().any(|(w,_)|!w.exterior),"{} foyer isolation door",name);}
  }
  let plan=layout(&c).0;let seed=c.seed;c.seed=seed+100;assert_eq!(serde_json::to_value(&plan).unwrap(),serde_json::to_value(layout(&c).0).unwrap());signatures.insert(format!("{:?}",plan));assert!(s(&heritage::source(name),"sourceUrl").starts_with("https://"));
 }
 assert_eq!(signatures.len(),15);
}
#[test]fn hundred_source_sections_have_physical_dimensions_and_role_checks(){
 let profiles=trim::profiles();assert_eq!(profiles.len(),100);let mut ids=std::collections::BTreeSet::new();let mut shapes=std::collections::BTreeSet::new();for p in profiles{assert!(ids.insert(s(p,"id")));assert!(shapes.insert(p["points"].to_string()));assert!(n(p,"installedHeightInches")>0.&&n(p,"installedProjectionInches")>0.);assert!(p["points"].as_array().unwrap().len()>=4);assert!(p["points"].as_array().unwrap().iter().all(|a|a.as_array().unwrap().iter().all(|v|(0.0..=1.0).contains(&v.as_f64().unwrap()))));}
 let mut c=Config::default();let normal=trim::selected(&c);c.trim_overrides.insert("base".into(),"rockwell-8000".into());assert_eq!(normal["parts"]["base"],trim::selected(&c)["parts"]["base"]);c.trim_overrides.insert("crown".into(),"rockwell-8023".into());assert_eq!(n(&trim::selected(&c)["parts"]["crown"],"catalogNumber"),8023.);c.trim_overrides.insert("crown".into(),"none".into());assert!(trim::selected(&c)["parts"]["crown"].is_null());
}
#[test]fn trim_schedule_and_roof_stock_never_double_count(){
 let c=Config::default();let m=model::build(&c);let levels=m["levels"].as_array().unwrap();let pieces=m["allTrimPieces"].as_array().unwrap();let mut ids=std::collections::BTreeSet::new();for p in pieces{assert!(ids.insert(s(p,"id")));let a=p["a"].as_array().unwrap();let b=p["b"].as_array().unwrap();let length=(0..3).map(|i|(a[i].as_f64().unwrap()-b[i].as_f64().unwrap()).powi(2)).sum::<f64>().sqrt();assert!(near(length,n(p,"length")));}
 for(role,id)in[("base","baseboard"),("casing","casing"),("crown","crown"),("corner","cornertrim"),("hood","exterior-driptrim")]{let expected=pieces.iter().filter(|p|s(p,"role")==role).map(|p|n(p,"length")).sum();let row=m["items"].as_array().unwrap().iter().find(|i|s(i,"id")==id).unwrap();assert!(near(n(row,"rawNet"),expected));}assert!(!levels[0]["trimPieces"].as_array().unwrap().iter().any(|p|s(p,"role")=="cornice"));assert!(near(n(&m,"trimSurfaceArea"),round(levels.iter().map(|l|n(l,"trimSurfaceArea")).sum())));let rows=m["items"].as_array().unwrap();assert_eq!(rows.iter().filter(|i|s(i,"id")=="trimfasteners").count(),1);assert!(!rows.iter().any(|i|s(i,"id")=="trimfinish"));assert!(!rows.iter().any(|i|["exterior-cornice","exterior-frieze"].contains(&s(i,"id"))));let accent=rows.iter().find(|i|s(i,"id")=="accent-roofedge").unwrap();assert!(near(n(accent,"rawNet"),m["roofAccents"]["edges"].as_array().unwrap().iter().map(|v|n(v,"length")).sum()));
 for name in ["Victorian","Craftsman","Cape Cod","Industrial"]{let mut c=c.clone();c.home_style=name.into();architecture::apply(&mut c,true);let roof=roof::build(&c);let rs=roof["rafters"].as_array().unwrap();for(i,a)in rs.iter().enumerate(){for b in &rs[i+1..]{if a["plane"]!=b["plane"]{continue}let ax=n(a,"x1");let az=n(a,"z1");let bx=n(b,"x1");let bz=n(b,"z1");if near(ax,n(a,"x2"))&&near(bx,n(b,"x2"))&&near(ax,bx){assert!(n(a,"z2")<=bz+1e-6||n(b,"z2")<=az+1e-6);}else if near(az,n(a,"z2"))&&near(bz,n(b,"z2"))&&near(az,bz){assert!(n(a,"x2")<=bx+1e-6||n(b,"x2")<=ax+1e-6);}}}}
}

#[test]fn rotated_items_and_nearby_snaps_use_real_oriented_footprints(){
 let mut c=fixture();c.design_mode="Blank slate".into();c.width=32.;c.depth=32.;
 let mut f=staging::Furniture{id:"preview".into(),kind:"bench".into(),room_id:"custom".into(),x:0.1,z:0.1,w:4.,d:1.6,rotation:45_f64.to_radians(),local_width:4.,local_depth:1.6};
 let angle=f.rotation;edit::rotate_item(&mut f,angle);assert!((f.w-5.6/2_f64.sqrt()).abs()<1e-9);assert!(near(f.w,f.d));
 let(rs,_)=layout(&c);let ws=model::walls(&c,&rs);let(snapped,changed,error)=edit::snap_item(f.clone(),&c,&ws,&[]);assert!(changed&&error.is_none());assert!(edit::valid_item(&snapped,&c,&ws,&[]));assert!(snapped.x>=snapped.w/2.+0.28);assert!(!edit::item_intersects_rect(&snapped,[snapped.x+1.7,snapped.z+1.7,snapped.x+1.9,snapped.z+1.9]),"SAT must allow empty corners of the rotated bounding box");
 f.x=f64::NAN;assert!(edit::snap_item(f,&c,&ws,&[]).2.is_some());
}
#[test]fn wall_quarter_turns_preserve_center_openings_and_frame_geometry(){
 let mut c=fixture();c.design_mode="Blank slate".into();c.width=32.;c.depth=32.;
 let original=Wall{id:"I-C-turn".into(),name:"Rotating wall".into(),axis:"x".into(),exterior:false,x:12.,z:12.,length:6.,openings:vec![Opening{id:"test-window".into(),kind:"window".into(),at:0.8,width:2.,bottom:3.,height:4.}]};
 let mut w=original.clone();for _ in 0..4{w=edit::rotated_wall(&w,&c,1,&[]).unwrap();}
 assert!(near(w.x,original.x)&&near(w.z,original.z));assert_eq!(w.axis,original.axis);assert_eq!(w.openings.len(),1);assert!(near(w.openings[0].at,original.openings[0].at));
 let turned=edit::rotated_wall(&original,&c,1,&[]).unwrap();c.added_walls.push(original);c.wall_adjustments.insert(w.id.clone(),WallGeometry{x:turned.x,z:turned.z,length:turned.length,axis:turned.axis.clone()});c.opening_overrides.insert(w.id.clone(),turned.openings.clone());let m=model::build(&c);let actual=m["walls"].as_array().unwrap().iter().find(|w|s(w,"id")=="I-C-turn").unwrap();assert_eq!(s(actual,"axis"),"z");assert_eq!(actual["openings"].as_array().unwrap().len(),1);assert_eq!(m["frameMembers"].as_array().unwrap().iter().filter(|f|s(f,"openingId")=="test-window"&&s(f,"role")=="Flat door header").count(),1);
}
#[test]fn generated_stairs_keep_both_approaches_free_of_furniture_and_wall_edits(){
 for name in ["Victorian","Georgian","Tudor","Colonial","Scandinavian"]{let mut c=Config::default();c.home_style=name.into();architecture::apply(&mut c,true);let m=model::build(&c);for level in m["levels"].as_array().unwrap(){c.active_floor=n(level,"floorIndex")as usize;let rs:Vec<Room>=serde_json::from_value(level["rooms"].clone()).unwrap();let fs:Vec<staging::Furniture>=serde_json::from_value(level["furniture"].clone()).unwrap();let zones=accessibility::zones(&c,&rs);let z=zones.iter().find(|z|z.kind=="landing").unwrap();assert_eq!((z.w,z.d),(5.,5.));assert!(z.x>=0.3&&z.z>=0.3&&z.x+z.w<=c.width-0.3&&z.z+z.d<=c.depth-0.3);assert!(fs.iter().all(|f|accessibility::item_error(f,&zones).is_none()));let wall=Wall{id:"block-stair".into(),name:"Blocked approach".into(),axis:"x".into(),x:z.x,z:z.z+2.,length:5.,exterior:false,openings:vec![]};assert!(accessibility::wall_error(&wall,&c).is_some());let f=staging::Furniture{id:"blocked-chair".into(),kind:"chair".into(),room_id:"custom".into(),x:z.x+2.5,z:z.z+2.5,w:2.,d:2.,rotation:0.,local_width:2.,local_depth:2.};assert!(accessibility::item_error(&f,&zones).is_some());}}
}

#[test]fn blank_stairs_connect_both_floors_and_update_opening_frame_and_cost(){
 let mut c=fixture();c.design_mode="Blank slate".into();c.stories=2;c.active_floor=0;c.width=32.;c.depth=32.;architecture::reset_edits(&mut c);let empty=model::build(&c);let base=n(&empty,"total");
 for turn in 0..4{let mut f=staging::Furniture{id:"F-U-stairs".into(),kind:"stairs".into(),room_id:"custom".into(),x:16.,z:16.,w:8.,d:16.,rotation:0.,local_width:8.,local_depth:16.};edit::rotate_item(&mut f,turn as f64*std::f64::consts::FRAC_PI_2);c.placed_furniture=vec![f];let m=model::build(&c);let stair=&m["stair"];assert!(!stair.is_null());assert!(near(n(&stair["opening"],"area"),96.));assert!(n(stair,"riserInches")<=7.75);assert_eq!(m["floorFrameMembers"].as_array().unwrap().iter().filter(|v|s(v,"role")=="Stair opening header").count(),2);assert_eq!(m["floorFrameMembers"].as_array().unwrap().iter().filter(|v|s(v,"role")=="Stair opening trimmer").count(),2);let subfloor=m["items"].as_array().unwrap().iter().find(|i|s(i,"id")=="subfloor").unwrap();assert!(near(n(subfloor,"rawNet"),(1024.-96.)/32.));assert!(n(&m,"total")>base);for level in m["levels"].as_array().unwrap(){assert_eq!(level["stair"],*stair);assert!(near(level["rooms"].as_array().unwrap().iter().map(|r|n(r,"w")*n(r,"d")).sum::<f64>(),1024.));assert_eq!(level["furniture"].as_array().unwrap().iter().filter(|f|s(f,"kind")=="stairs").count(),1);}c.active_floor=1;assert_eq!(model::build(&c)["total"],m["total"]);c.active_floor=0;}
 c.placed_furniture.clear();assert!(model::build(&c)["stair"].is_null());
}
#[test]fn upper_floor_spans_use_bearing_walls_then_girder_lines_over_the_foundation(){
 let beams=|m:&Value|m["floorFrameMembers"].as_array().unwrap().iter().filter(|v|s(v,"role")=="Floor support beam").count();
 let posts=|m:&Value|m["floorFrameMembers"].as_array().unwrap().iter().filter(|v|s(v,"role")=="Girder post").count();
 let mut c=fixture();c.design_mode="Blank slate".into();c.stories=2;c.width=40.;c.depth=40.;architecture::reset_edits(&mut c);
 // No bearing walls: flush girders at the 16 ft floor-panel joints (x = 16, 32) carry the deck on posts over the pier rows.
 let open=model::build(&c);let f=&open["structural"]["floor"];assert_eq!(f["girderLines"],json!([16.,32.]));assert!(near(n(f,"maxClearSpan"),15.54));assert_eq!(s(&f["candidate"],"series"),"TJI 110");
 assert_eq!(beams(&open),2);let rows=piers::layout(&c).per_line;assert_eq!(posts(&open),2*(rows-2));
 let item=|m:&Value,id:&str|m["items"].as_array().unwrap().iter().find(|i|s(i,"id")==id).map(|i|n(i,"rawNet")).unwrap_or(0.);assert!(near(item(&open,"floorbeams"),80.));assert!(item(&open,"girderposts")>0.);
 assert!(open["structural"]["issues"].as_array().unwrap().iter().any(|v|v.as_str().unwrap().starts_with("Upper floor: 2 flush LVL girder lines")));
 let g=&open["structural"]["mainFloor"];assert_eq!(n(g,"girderLines"),4.);assert!(near(n(g,"maxClearSpan"),15.54));assert_eq!(s(g,"candidate"),"TJI 110");
 // An unmarked partition is not a support; a marked bearing wall is, and then no girders are needed.
 c.added_walls.push(Wall{id:"I-C-bearing".into(),name:"Center support".into(),x:20.,z:0.,length:40.,axis:"z".into(),exterior:false,openings:vec![]});assert_eq!(beams(&model::build(&c)),2,"A partition cannot silently shorten a structural span");
 c.bearing_walls.push("I-C-bearing".into());let supported=model::build(&c);assert!(near(n(&supported["structural"]["floor"],"maxClearSpan"),19.54));assert_eq!(s(&supported["structural"]["floor"]["candidate"],"series"),"TJI 110");assert_eq!(beams(&supported),0);assert_eq!(posts(&supported),0);assert!(!supported["structural"]["forte"]["analysisRun"].as_bool().unwrap());
 c.wall_adjustments.insert("I-C-bearing".into(),WallGeometry{x:2.,z:0.,length:40.,axis:"z".into()});let moved=model::build(&c);assert_eq!(beams(&moved),2,"Moving a support brings the girders back");assert!(near(n(&moved["structural"]["floor"],"maxClearSpan"),15.54));
 c.wall_adjustments.clear();c.floor_live_load=80.;let heavy=model::build(&c);assert!(heavy["structural"]["floor"]["candidate"].is_null(),"Unsupported load cases cannot pass the floor table");assert!(heavy["structural"]["mainFloor"]["candidate"].is_null());
 // Crawlspace: posts every 16 ft or less along each girder, landing on the crawlspace girder piers.
 c.floor_live_load=40.;c.bearing_walls.clear();c.added_walls.clear();c.foundation=piers::CONCRETE.into();let crawl=model::build(&c);assert_eq!(beams(&crawl),2);assert_eq!(posts(&crawl),2*2);
}
#[test]fn garage_side_overrides_place_attached_and_detached_on_the_selected_side(){
 for kind in ["Attached","Detached"]{let mut c=fixture();c.garage=kind.into();c.garage_side="Left".into();let left=model::build(&c);assert!(n(&left["garage"],"x")<0.);assert!(n(&left["siteBounds"],"minX")<0.);c.garage_side="Right".into();let right=model::build(&c);assert!(n(&right["garage"],"x")>=c.width);for m in [&left,&right]{assert!(near(n(&m["garage"],"w"),24.));assert_eq!(round(m["items"].as_array().unwrap().iter().map(|i|n(i,"total")).sum()),n(m,"subtotal"));}}
}

#[test]
fn design_validation_bounds_untrusted_data_before_calculation(){
 let c=Config::default();assert!(security::parse(&serde_json::to_string(&c).unwrap()).is_ok());
 assert!(security::parse(&" ".repeat(security::MAX_DESIGN_BYTES+1)).is_err());
 assert!(security::parse("{\"width\":\"script\"}").is_err());
 let mut bad=c.clone();bad.colors.insert("walls".into(),"\" onfocus=alert(1)".into());assert!(validate(&bad).is_err());
 let mut bad=c.clone();bad.prices.insert("studs".into(),100001.);assert!(validate(&bad).is_err());
 let mut bad=c.clone();bad.jurisdiction="a".repeat(161);assert!(validate(&bad).is_err());
 let mut bad=c.clone();bad.zip="../us".into();assert!(validate(&bad).is_err());
 let mut bad=c.clone();bad.bearing_walls=vec!["E1".into();257];assert!(validate(&bad).is_err());
 let wall=Wall{id:"USER-1".into(),name:"Custom wall".into(),x:4.,z:4.,length:8.,axis:"x".into(),exterior:false,openings:vec![]};
 let mut bad=c.clone();bad.added_walls=vec![wall.clone();2];assert!(validate(&bad).is_err());
 let mut bad=c.clone();let mut wall=wall.clone();wall.id="x\" onclick=alert(1)".into();bad.added_walls.push(wall);assert!(validate(&bad).is_err());
 let mut bad=c.clone();bad.wall_adjustments.insert("E1".into(),WallGeometry{x:0.,z:0.,length:f64::INFINITY,axis:"x".into()});assert!(validate(&bad).is_err());
 let mut bad=c.clone();bad.opening_overrides.insert("E1".into(),vec![Opening{id:"U1".into(),kind:"window".into(),at:2.,width:f64::NAN,bottom:3.,height:3.}]);assert!(validate(&bad).is_err());
}

#[test]
fn stair_placement_clears_upper_work_preserves_main_floor_and_restores_on_removal(){
 let mut c=fixture();c.design_mode="Blank slate".into();c.stories=2;c.active_floor=0;c.width=32.;c.depth=32.;c.added_walls.clear();c.wall_removals.clear();c.wall_adjustments.clear();c.opening_overrides.clear();c.placed_furniture.clear();c.deleted_furniture.clear();
 let upper_wall=Wall{id:"I-above-L2".into(),name:"Upper partition".into(),x:4.,z:16.,length:24.,axis:"x".into(),exterior:false,openings:vec![]};c.added_walls.push(upper_wall.clone());
 let bed=staging::Furniture{id:"F-above-L2".into(),kind:"bed".into(),room_id:"custom".into(),x:16.,z:22.,w:5.,d:6.7,rotation:0.,local_width:5.,local_depth:6.7};
 let chair=staging::Furniture{id:"F-main".into(),kind:"chair".into(),room_id:"custom".into(),x:28.,z:4.,w:2.,d:2.,rotation:0.,local_width:2.,local_depth:2.};c.placed_furniture=vec![bed.clone(),chair.clone()];
 let before=model::build(&c);let ws:Vec<Wall>=serde_json::from_value(before["walls"].clone()).unwrap();let fs:Vec<staging::Furniture>=serde_json::from_value(before["furniture"].clone()).unwrap();
 for turn in 0..4{
  let mut stair=staging::Furniture{id:"preview".into(),kind:"stairs".into(),room_id:"custom".into(),x:16.,z:16.,w:8.,d:16.,rotation:0.,local_width:8.,local_depth:16.};edit::rotate_item(&mut stair,turn as f64*std::f64::consts::FRAC_PI_2);
  let(f,_,error)=edit::snap_item(stair,&c,&ws,&fs);assert!(error.is_none(),"Upper-floor work blocked a first-floor preview: {:?}",error);let mut f=f;f.id="F-stairs".into();c.placed_furniture.push(f.clone());
  let m=model::build(&c);assert!(near(n(&m["stair"]["opening"],"area"),96.));assert_eq!(m["levels"][0]["walls"],before["levels"][0]["walls"]);assert!(m["levels"][0]["furniture"].as_array().unwrap().iter().any(|v|s(v,"id")==chair.id));
  let upper_ws:Vec<Wall>=serde_json::from_value(m["levels"][1]["walls"].clone()).unwrap();assert!(!upper_ws.iter().any(|w|w.id==upper_wall.id));assert!(upper_ws.iter().any(|w|w.id.starts_with("I-above-L2-STAIR-")));
  if turn==0{let cut=upper_ws.iter().find(|w|w.id.starts_with("I-above-L2-STAIR-")).unwrap();let mut edited=c.clone();edited.wall_adjustments.insert(cut.id.clone(),WallGeometry{x:cut.x,z:cut.z,length:2.,axis:cut.axis.clone()});let revised=model::build(&edited);assert!(revised["levels"][1]["walls"].as_array().unwrap().iter().any(|w|s(w,"id")==cut.id&&near(n(w,"length"),2.)),"Cut upper wall must still resize");edited.wall_removals.push(WallRemoval{wall_id:cut.id.clone(),at:0.,width:2.});let removed=model::build(&edited);assert!(!removed["levels"][1]["walls"].as_array().unwrap().iter().any(|w|s(w,"id")==cut.id),"Cut upper wall must still delete");}
  assert!(edit::clear_of_walls(&f,&upper_ws));assert!(!m["levels"][1]["furniture"].as_array().unwrap().iter().any(|v|s(v,"id")==bed.id));assert!(m["levels"][1]["furniture"].as_array().unwrap().iter().any(|v|s(v,"id")==f.id));
  let mut upper_c=c.clone();upper_c.active_floor=1;assert_eq!(m["levels"][1]["frameMembers"].as_array().unwrap().len(),frame::build(&upper_ws,&upper_c).len());assert_eq!(round(m["items"].as_array().unwrap().iter().map(|i|n(i,"total")).sum()),n(&m,"subtotal"));
  c.placed_furniture.retain(|v|v.kind!="stairs");let restored=model::build(&c);assert_eq!(restored["levels"][1]["walls"],before["levels"][1]["walls"]);assert!(restored["levels"][1]["furniture"].as_array().unwrap().iter().any(|v|s(v,"id")==bed.id));
 }
 c.width=24.;c.depth=24.;c.added_walls.clear();c.placed_furniture.clear();let(rs,_)=layout(&c);let ws=model::walls(&c,&rs);
 let stair=staging::Furniture{id:"preview".into(),kind:"stairs".into(),room_id:"custom".into(),x:12.,z:12.,w:8.,d:16.,rotation:0.,local_width:8.,local_depth:16.};let(f,snapped,error)=edit::snap_item(stair,&c,&ws,&[]);assert!(snapped&&error.is_none());assert!(near(f.x/2.,(f.x/2.).round())&&near(f.z/2.,(f.z/2.).round()));let b=stairs::approach(&f);assert!(b[0]>=0.3&&b[1]>=0.3&&b[2]<=23.7&&b[3]<=23.7);
 let wall=Wall{id:"I-blocked".into(),name:"Main wall".into(),x:4.,z:f.z,length:16.,axis:"x".into(),exterior:false,openings:vec![]};assert!(edit::item_error(&f,&c,&[wall],&[]).is_some(),"First-floor walls must never be silently removed");
}

#[test]
fn reference_porches_and_carved_surrounds_match_their_live_takeoff(){
 for name in ["Victorian","Craftsman","Modern farmhouse","Tudor","Colonial","French country","English cottage","Coastal","Ranch"]{
  for stories in [1,2]{
   let mut c=Config::default();c.home_style=name.into();c.stories=stories;c.active_floor=0;c.width=40.;c.depth=40.;
   let m=model::build(&c);let p=&m["porch"];assert!(p.is_object(),"{} porch missing",name);
   let rects=p["rectangles"].as_array().unwrap();let footprint:f64=rects.iter().map(|r|n(r,"w")*n(r,"d")).sum();assert!(near(n(p,"area"),footprint));
   let decking:f64=rects.iter().map(|r|n(r,"w")*n(r,"d")*r["deckYs"].as_array().unwrap().len()as f64).sum();assert!(near(n(p,"deckArea"),decking));
   let roof_area:f64=p["roofs"].as_array().unwrap().iter().map(|r|n(&r["roof"],"area")).sum();assert!(near(n(p,"roofArea"),roof_area));
   let items=m["items"].as_array().unwrap();assert_eq!(items.iter().filter(|i|s(i,"id")=="porch-columns").count(),1);
   assert!(near(n(items.iter().find(|i|s(i,"id")=="porch-columns").unwrap(),"rawNet"),p["posts"].as_array().unwrap().len()as f64));
   assert!(near(n(items.iter().find(|i|s(i,"id")=="porch-deck").unwrap(),"rawNet"),decking/(5.5/12.)));
   assert!(near(n(&m,"subtotal"),round(items.iter().map(|i|n(i,"total")).sum())));
   assert!(near(n(&m,"projectTotal"),round(n(&m,"total")+32000.)));
   let step=&p["steps"];assert!(p["posts"].as_array().unwrap().iter().all(|post|n(post,"z")>n(step,"z")+1.||n(post,"x")<=n(step,"x")||n(post,"x")>=n(step,"x")+n(step,"w")),"Porch column blocks the entrance");
   let ornaments=if stories==2{m["allTrimOrnaments"].as_array().unwrap()}else{m["trimOrnaments"].as_array().unwrap()};
   for kind in ["rosette","keystone","dentil","layered-cap","bead"]{let count=ornaments.iter().filter(|o|s(o,"kind")==kind).count();if count>0{assert!(near(n(items.iter().find(|i|s(i,"id")==format!("trim-{}",kind)).unwrap(),"net"),count as f64));}}
  }
 }
 let c=Config::default();let m=model::build(&c);assert!(near(n(&m["porch"]["rectangles"][0],"w"),24.));assert!(near(n(&m["porch"]["rectangles"][0],"d"),7.));
 let mut blank=c.clone();blank.design_mode="Blank slate".into();assert!(model::build(&blank)["porch"].is_null());
 let mut tiny=c.clone();tiny.width=8.;tiny.depth=8.;tiny.stories=1;assert!(model::build(&tiny)["porch"].is_null());
 let mut garage=c.clone();garage.home_style="Craftsman".into();garage.garage="Attached".into();garage.garage_side="Left".into();let m=model::build(&garage);assert_eq!(m["porch"]["rectangles"].as_array().unwrap().len(),1,"Do not place a side porch inside the attached garage");
}

#[test]fn dormer_openings_cut_the_real_roof_and_have_matching_stock(){
 let mut c=fixture();c.home_style="Colonial".into();c.width=40.;c.depth=48.;c.pitch=10.;c.dormer_style="Gable".into();c.dormer_side="Automatic".into();c.dormer_width=4.;c.dormer_depth=8.;c.dormer_count=2;c.rear_outdoor="None".into();
 let roof=roof::build(&c);let m=model::build(&c);let ds=m["dormers"].as_array().unwrap();assert_eq!(ds.len(),2);assert!(m["dormerNotes"].as_array().unwrap().is_empty());
 let triangle_area=|points:&Value|{let points=points.as_array().unwrap();let p=|i:usize,j:usize|points[i][j].as_f64().unwrap();(1..points.len()-1).map(|i|{let a=[p(i,0)-p(0,0),p(i,1)-p(0,1),p(i,2)-p(0,2)];let b=[p(i+1,0)-p(0,0),p(i+1,1)-p(0,1),p(i+1,2)-p(0,2)];let cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];cross.iter().map(|v|v*v).sum::<f64>().sqrt()/2.}).sum::<f64>()};
 let surface=m["roof"]["facets"].as_array().unwrap().iter().chain(ds.iter().flat_map(|d|d["facets"].as_array().unwrap())).map(|f|triangle_area(&f["points"])).sum::<f64>();assert!((surface-n(&m,"roofArea")).abs()<0.006,"visible roof triangles must reconcile to the (cent-rounded) sheathing area: {} vs {}",surface,n(&m,"roofArea"));
 assert_eq!(m["mainRafterStock"],roof["rafters"]);assert!(m["rafters"].as_array().unwrap().iter().any(|r|s(r,"id").contains("CUT")));
 let stock_qty:f64=m["items"].as_array().unwrap().iter().filter(|i|s(i,"id").starts_with("rafter")&&s(i,"unit")=="pieces"&&s(i,"id")!="rafterblocking").map(|i|n(i,"rawNet")).sum();assert!(near(stock_qty,roof["rafters"].as_array().unwrap().len()as f64));
 for d in ds{let front=d["members"].as_array().unwrap();for o in d["openings"].as_array().unwrap(){let oid=s(o,"id");assert_eq!(front.iter().filter(|v|s(v,"openingId")==oid&&s(v,"role")=="King").count(),2);assert_eq!(front.iter().filter(|v|s(v,"openingId")==oid&&s(v,"role")=="Jack").count(),2);assert_eq!(front.iter().filter(|v|s(v,"openingId")==oid&&s(v,"role")=="Header ply").count(),2);assert_eq!(front.iter().filter(|v|s(v,"openingId")==oid&&s(v,"role")=="Rough sill").count(),1);}
  assert!(d["supportMembers"].as_array().unwrap().len()>=8);let row=m["items"].as_array().unwrap().iter().find(|i|s(i,"id")==format!("{}-headers",s(d,"id"))).unwrap();assert!(near(n(row,"rawNet"),d["supportMembers"].as_array().unwrap().iter().map(|v|n(v,"stockLength")).sum()));
 }
 c.width=8.;c.depth=8.;let tiny=model::build(&c);assert!(tiny["dormers"].as_array().unwrap().is_empty());assert!(!tiny["dormerNotes"].as_array().unwrap().is_empty());assert!(!tiny["items"].as_array().unwrap().iter().any(|i|s(i,"id").starts_with("DORMER-")));
 for module in [2.,4.,8.,16.]{c.width=100.;c.depth=100.;c.dormer_width=module;c.dormer_depth=if module<=4.{8.}else{16.};validate(&c).unwrap();let m=model::build(&c);for d in m["dormers"].as_array().unwrap(){assert_eq!(n(d,"width"),module);assert!(n(d,"height")>=n(&d["openings"][0],"bottom")+n(&d["openings"][0],"height")+7.25/12.+0.25);}}
 c.dormer_width=3.;assert!(validate(&c).is_err());
}
#[test]fn shed_rafters_run_uphill_and_roof_features_keep_the_top_floor(){
 let mut c=Config::default();c.home_style="Colonial".into();c.width=40.;c.depth=48.;c.pitch=9.;c.dormer_style="Shed".into();c.dormer_depth=16.;c.dormer_width=4.;let m=model::build(&c);assert!(!m["dormers"].as_array().unwrap().is_empty());assert_eq!(m["levels"][1]["dormers"],m["dormers"]);assert_eq!(m["levels"][1]["rafters"],m["rafters"]);
 for d in m["dormers"].as_array().unwrap(){for r in d["rafters"].as_array().unwrap(){assert!((n(r,"y1")-n(r,"y2")).abs()>0.1);let dir=&d["direction"];let tan=&d["tangent"];let dx=n(r,"x2")-n(r,"x1");let dz=n(r,"z2")-n(r,"z1");assert!(near(dx*tan[0].as_f64().unwrap()+dz*tan[1].as_f64().unwrap(),0.));assert!(dx*dir[0].as_f64().unwrap()+dz*dir[1].as_f64().unwrap()>0.);}}
 assert_eq!(n(&m["counts"],"dormerFramePieces"),m["dormerFrameMembers"].as_array().unwrap().len()as f64);
}
#[test]fn category_budgets_preserve_calculated_quantities_and_separate_project_costs(){
 let mut c=fixture();let base=model::build(&c);let category=s(&base["categoryBudgets"][0],"name").to_string();let actual=n(&base["categoryBudgets"][0],"calculated");c.category_budgets.insert(category.clone(),1234.56);let edited=model::build(&c);
 assert_eq!(base["items"],edited["items"]);assert_eq!(base["total"],edited["total"]);assert_eq!(n(&edited,"budgetOverrideCount"),1.);assert!(near(n(&edited,"budgetSubtotal"),round(n(&base,"subtotal")-actual+1234.56)));assert!(near(n(&edited,"budgetTax"),round(n(&edited,"budgetSubtotal")*c.tax/100.)));assert!(near(n(&edited,"projectTotal"),round(n(&edited,"materialsBudgetTotal")+n(&edited,"projectCostTotal"))));
 c.category_budgets.insert(category.clone(),0.);assert!(n(&model::build(&c),"materialsBudgetTotal")<n(&edited,"materialsBudgetTotal"));c.category_budgets.clear();assert_eq!(model::build(&c)["materialsBudgetTotal"],base["total"]);
 c.category_budgets.insert(category,f64::NAN);assert!(validate(&c).is_err());
}
#[test]fn bulk_pricing_obeys_quantity_tiers_and_never_stacks_discounts(){
 let mut c=fixture();c.width=100.;c.depth=100.;c.county=s(&rules::locate(25.77,-80.19).unwrap(),"id").into();c.pricing_mode="Wholesale estimate".into();let m=model::build(&c);let row=|m:&Value|m["items"].as_array().unwrap().iter().find(|i|s(i,"id")=="zipwall").unwrap().clone();let z=row(&m);assert!(n(&z,"qty")>=80.);assert_eq!(n(&z,"retailPrice"),29.49);assert_eq!(n(&z,"price"),26.54);
 c.bulk_discounts.insert("ZIP envelope".into(),20.);let override_row=row(&model::build(&c));assert_eq!(n(&override_row,"price"),round(29.49*0.8));assert_eq!(n(&override_row,"discountPercent"),20.);c.prices.insert("zipwall".into(),40.);assert_eq!(n(&row(&model::build(&c)),"price"),32.);
 c.pricing_mode="Retail".into();let retail=model::build(&c);assert_eq!(n(&row(&retail),"price"),40.);assert_eq!(n(&retail,"volumeSavings"),0.);c.pricing_mode="Wholesale estimate".into();c.bulk_discounts.clear();c.width=8.;c.depth=8.;c.prices.clear();let tiny=row(&model::build(&c));assert!(n(&tiny,"qty")<80.);assert_eq!(n(&tiny,"discountPercent"),0.);c.bulk_discounts.insert("Roof".into(),81.);assert!(validate(&c).is_err());
}
#[test]fn rear_additions_windows_and_insulation_scale_from_live_geometry(){
 let mut c=fixture();c.home_style="Ranch".into();c.width=40.;c.depth=48.;c.rear_outdoor="Deck".into();c.window_size="Large".into();c.window_style="Picture".into();let m=model::build(&c);let p=&m["rearOutdoor"];assert!(s(p,"access").starts_with("Connected"));assert_eq!(p["roofs"],json!([]));let rect=&p["rectangles"][0];assert_eq!(n(rect,"w"),16.);assert_eq!(n(rect,"d"),8.);assert!(n(&m["siteBounds"],"maxZ")>=56.);assert!(n(&m,"interiorCavityArea")<n(&m,"partitionLength")*c.wall_height);
 for w in m["windowSchedule"].as_array().unwrap(){if w["bedroomEscapeCandidate"]==true{assert_eq!(s(w,"type"),"Casement");}assert!([2.,4.].contains(&n(w,"width")));}
 c.rear_outdoor="Covered porch".into();let covered=model::build(&c);assert!(n(&covered["rearOutdoor"],"roofArea")>0.);assert!(n(&covered,"total")>n(&m,"total"));c.rear_outdoor="Style matched".into();c.width=8.;c.depth=8.;let tiny=model::build(&c);assert!(tiny["rearOutdoor"].is_null());assert!(n(&tiny,"total")<n(&m,"total"));
 c=Config::default();let two=model::build(&c);let batts=two["items"].as_array().unwrap();assert!(s(batts.iter().find(|i|s(i,"id")=="soundinsulation").unwrap(),"name").contains("unfaced"));assert!(s(batts.iter().find(|i|s(i,"id")=="floorsound").unwrap(),"name").contains("unfaced"));assert!(s(batts.iter().find(|i|s(i,"id")=="atticinsulation").unwrap(),"name").contains("kraft"));
}
#[test]
fn room_finishes_use_both_sides_and_enclosed_blank_rooms_without_double_billing(){
 let mut c=Config::default();c.stories=1;c.design_mode="Blank slate".into();c.width=32.;c.depth=32.;c.balcony="None".into();c.rear_outdoor="None".into();
 c.added_walls.push(Wall{id:"I-ROOMS".into(),name:"Room divider".into(),axis:"z".into(),x:16.,z:0.,length:32.,exterior:false,openings:vec![Opening{id:"U-D".into(),kind:"door".into(),at:6.,width:38./12.,bottom:0.,height:82.5/12.}]});
 let m=model::build(&c);let rooms=m["finishRooms"].as_array().unwrap();assert_eq!(rooms.len(),2);let left=s(&rooms[0],"id").to_string();let right=s(&rooms[1],"id").to_string();
 c.room_wallpapers.insert(left.clone(),"Dahlia damask".into());c.room_wallpapers.insert(right.clone(),"None".into());c.wall_tiles.insert("general".into(),"Teal glazed subway tile".into());
 let m=model::build(&c);let faces=m["wallFaces"].as_array().unwrap();assert!(faces.iter().any(|f|s(f,"wallId")=="I-ROOMS"&&s(f,"roomId")==left&&s(f,"wallpaper")=="Dahlia damask"));assert!(faces.iter().any(|f|s(f,"wallId")=="I-ROOMS"&&s(f,"roomId")==right&&s(f,"wallpaper")=="None"));
 let area:f64=faces.iter().filter(|f|s(f,"roomId")==left).map(|f|n(f,"area")).sum();assert!((n(&m,"wallpaperArea")-area).abs()<0.01);assert_eq!(n(&m,"tileWallArea"),0.);assert!(faces.len()<12,"Contiguous grid cells merge into full faces");
 let paper=m["items"].as_array().unwrap().iter().find(|i|s(i,"id")==format!("wallpaper-room-{}",left)).unwrap();assert!((n(paper,"rawNet")-area).abs()<0.01);assert!(validate(&c).is_ok());
 c.room_wallpapers.insert("bad".into(),"Not a wallpaper".into());assert!(validate(&c).is_err());
}

#[test]
fn garage_connection_moves_without_moving_the_building_and_keeps_the_same_frame(){
 let mut c=Config::default();c.design_mode="Blank slate".into();c.stories=1;c.width=32.;c.depth=32.;c.garage="Attached".into();c.garage_side="Right".into();let before=model::build(&c);
 let rs:Vec<Room>=serde_json::from_value(before["rooms"].clone()).unwrap();let ws:Vec<Wall>=serde_json::from_value(before["walls"].clone()).unwrap();garage::move_connection(&mut c,&rs,&ws,7.).unwrap();let after=model::build(&c);
 assert_eq!(before["garage"]["x"],after["garage"]["x"]);assert_eq!(before["garage"]["z"],after["garage"]["z"]);
 let door=after["openings"].as_array().unwrap().iter().find(|o|s(o,"id")=="G-HOUSE-DOOR").unwrap();assert!((n(door,"at")+n(door,"width")/2.-7.).abs()<1e-8);assert!(after["frameMembers"].as_array().unwrap().iter().any(|p|s(p,"openingId")=="G-HOUSE-DOOR"&&s(p,"role")=="Header ply"));
 assert!(garage::move_connection(&mut c,&rs,&ws,30.).is_err());
}

#[test]
fn six_dormers_form_a_symmetric_row_and_are_independent_of_seed(){
 let mut c=Config::default();c.home_style="Colonial".into();c.width=100.;c.depth=100.;c.pitch=8.;c.dormer_style="Gable".into();c.dormer_side="Front".into();c.dormer_count=6;c.dormer_width=4.;c.dormer_depth=16.;c.balcony="None".into();let m=model::build(&c);
 let ds=m["dormers"].as_array().unwrap();assert_eq!(ds.len(),6);let centers:Vec<_>=ds.iter().map(|d|d["origin"][0].as_f64().unwrap()+n(d,"width")/2.).collect();let spacing=centers[1]-centers[0];for pair in centers.windows(2){assert!(near(pair[1]-pair[0],spacing));assert!(spacing>=6.);}assert!(near(centers[0]+centers[5],c.width));
 c.seed=912_834;let other=model::build(&c);assert_eq!(m["dormers"],other["dormers"]);c.dormer_count=7;assert!(validate(&c).is_err());
}

#[test]
fn balconies_have_an_actual_upper_door_supports_and_itemized_materials(){
 let mut c=Config::default();c.balcony="Rear balcony".into();let m=model::build(&c);assert!(m["balcony"].is_object());assert!(m["levels"][1]["openings"].as_array().unwrap().iter().any(|o|s(o,"id")=="BALCONY-DOOR-L2"));assert_eq!(n(&m["balcony"],"guardHeightInches"),42.);
 assert!(m["levels"][1]["frameMembers"].as_array().unwrap().iter().any(|p|s(p,"openingId")=="BALCONY-DOOR-L2"&&s(p,"role")=="Header ply"));let item=m["items"].as_array().unwrap().iter().find(|i|s(i,"id")=="balcony-joists").unwrap();let lf:f64=m["balcony"]["joists"].as_array().unwrap().iter().map(|j|n(j,"stockLength")).sum();assert!(near(n(item,"rawNet"),lf));
 assert!(m["rearOutdoor"]["roofs"].as_array().unwrap().is_empty(),"A porch roof cannot cut through the balcony deck");
 c.stories=1;c.active_floor=0;let single=model::build(&c);assert!(single["balcony"].is_null());assert!(!single["items"].as_array().unwrap().iter().any(|i|s(i,"id").starts_with("balcony-")));
}
#[test]fn crawlspace_takeoff_has_no_slab_leftovers_or_doubled_single_assemblies(){
 let mut c=Config::default();c.waste=10.;c.foundation=piers::CONCRETE.into();let m=model::build(&c);let items=m["items"].as_array().unwrap();
 let row=|id:&str|items.iter().find(|i|s(i,"id")==id);
 // The crawlspace floor has no slab, and its own sill gasket replaces the slab-era line.
 for id in ["slab","slabjoints","sillgasket"]{assert!(row(id).is_none(),"{id} should not be ordered for a crawlspace floor");}
 assert!(near(n(row("crawl-sillseal").unwrap(),"rawNet"),n(&m,"perimeter")/50.));
 // Ordering waste must not round one access hatch or one moisture system up to two.
 for id in ["crawl-access","crawl-moisture"]{let i=row(id).unwrap();assert_eq!(n(i,"qty"),1.);assert_eq!(n(i,"wastePercent"),0.);}
}
#[test]fn helical_pier_foundation_is_the_default_and_replaces_concrete_lines(){
 let c=Config::default();assert_eq!(c.foundation,piers::HELICAL);let m=model::build(&c);let items=m["items"].as_array().unwrap();
 let row=|id:&str|items.iter().find(|i|s(i,"id")==id);
 for id in ["footings","footingrebar","rebarsupports","anchors","anchorwashers","crawl-wall","crawl-rebar","crawl-damp","crawl-girder","crawl-piers","crawl-sill","crawl-sillseal","crawl-access"]{assert!(row(id).is_none(),"{id} belongs to the concrete foundation");}
 // 26 x 46 ft, two stories: 1,196 sq ft x 185/1,024 = 216.1 kips; 24 ft piers hold 0.95 x 5,000 ft-lb x 9 / 2 = 21.4 kips, so 11 are needed.
 let f=&m["foundation"];assert_eq!(n(f,"piersNeeded"),11.);assert_eq!(n(f,"girderLines"),3.);assert_eq!(n(f,"piersPerLine"),4.);assert_eq!(n(f,"piers"),12.);assert!(near(n(f,"kipsPerPier"),21.38));
 assert!(n(f,"piers")*n(f,"kipsPerPier")>=n(f,"houseKips"));
 // 24 ft depth + 1 ft reveal - 7 ft lead = 18 ft: two 10 ft extensions, each joint bolted.
 assert_eq!(n(row("pier-leads").unwrap(),"qty"),12.);assert_eq!(n(row("pier-ext10").unwrap(),"qty"),24.);assert_eq!(n(row("pier-ext5").unwrap(),"qty"),0.);assert_eq!(n(row("pier-couplers").unwrap(),"qty"),24.);assert_eq!(n(row("pier-caps").unwrap(),"qty"),12.);
 assert!(near(n(row("pier-girders").unwrap(),"rawNet"),3.*46.));
 // A shallower, weaker pier needs more of them: 14 ft gives 0.95 x 2,100 x 9 / 2 = 9 kips, so 25 piers carry 216 kips.
 let mut shallow=c.clone();shallow.pier_depth=14.;let f=piers::summary(&shallow);assert_eq!(n(&f,"piersNeeded"),25.);assert!(n(&f,"piers")>=25.);
 let mut concrete=c.clone();concrete.foundation=piers::CONCRETE.into();let m=model::build(&concrete);assert!(m["items"].as_array().unwrap().iter().any(|i|s(i,"id")=="crawl-wall"));assert!(!m["items"].as_array().unwrap().iter().any(|i|s(i,"id").starts_with("pier-")));
 let mut bad=c.clone();bad.foundation="Slab".into();assert!(validate(&bad).is_err());bad=c.clone();bad.pier_depth=40.;assert!(validate(&bad).is_err());
}
#[test]fn three_story_homes_stack_floors_stairs_and_one_roof(){
 let styles:Vec<String>=catalog()["homeStyles"].as_array().unwrap().iter().map(|v|s(v,"name").to_string()).collect();
 let mut checked=0;
 for style in &styles{for catalog_plan in [true,false]{for beds in [1usize,3,4]{
  let mut c=Config::default();c.home_style=style.clone();architecture::apply(&mut c,true);c.catalog_plan=catalog_plan;c.stories=3;c.bedrooms=beds;c.width=c.width.max(28.);c.depth=c.depth.max(architecture::minimum_depth(&c)).max(36.);
  if validate(&c).is_err(){continue}
  let m=model::build(&c);let levels=m["levels"].as_array().unwrap();assert_eq!(levels.len(),3,"{style}");checked+=1;
  // Floor-specific ids: ground untagged, second "-L2", third "-L3".
  for(f,level)in levels.iter().enumerate(){for r in level["rooms"].as_array().unwrap(){assert_eq!(tag_floor(s(r,"id")),f,"{style} room {} on floor {f}",s(r,"id"));}}
  // The stairwell is in the same place on every floor.
  let stair=|l:&Value|l["rooms"].as_array().unwrap().iter().find(|r|s(r,"type")=="stairs").map(|r|(n(r,"x"),n(r,"z"),n(r,"w"),n(r,"d")));
  assert!(stair(&levels[0]).is_some(),"{style}: no stair");assert_eq!(stair(&levels[0]),stair(&levels[1]),"{style} {catalog_plan} {beds}");assert_eq!(stair(&levels[1]),stair(&levels[2]),"{style} {catalog_plan} {beds}");
  // Bedrooms split across the two upper floors.
  let beds_on=|f:usize|levels[f]["rooms"].as_array().unwrap().iter().filter(|r|s(r,"type")=="bedroom").count();
  assert!(beds_on(1)+beds_on(2)<=beds&&beds_on(1)>=1,"{style} {catalog_plan} {beds}: {} + {}",beds_on(1),beds_on(2));
 }}}
 assert!(checked>=20,"only {checked} three-story combinations validated");
 // One roof, one foundation, two floor decks and two stair flights.
 let mut c=Config::default();c.stories=3;let m3=model::build(&c);let mut c2=c.clone();c2.stories=2;let m2=model::build(&c2);
 let item=|m:&Value,id:&str|m["items"].as_array().unwrap().iter().find(|i|s(i,"id")==id).map(|i|n(i,"rawNet")).unwrap_or(0.);
 assert!(near(item(&m3,"roofmetal"),item(&m2,"roofmetal")));assert!(near(item(&m3,"pier-leads"),n(&m3["foundation"],"piers")));
 assert!(near(item(&m3,"stairrisers"),2.*item(&m2,"stairrisers")));assert!(near(item(&m3,"subfloor"),2.*item(&m2,"subfloor")));
 let hole=c.width*c.depth*2.-n(&m2,"area");assert!(near(n(&m3,"area"),c.width*c.depth*3.-2.*hole));
 let decks:std::collections::BTreeSet<i64>=m3["floorFrameMembers"].as_array().unwrap().iter().map(|v|(n(v,"y1")*100.).round()as i64).collect();assert_eq!(decks.len(),2,"joists sit at two deck heights");
 assert!(n(&m3["foundation"],"houseKips")>n(&m2["foundation"],"houseKips"));
 // Walls and exterior skin grow with the third story; there is still one water heater and service panel.
 assert!(item(&m3,"zipwall")>item(&m2,"zipwall")*1.3);assert!(near(item(&m3,"waterheater"),1.));assert!(near(item(&m3,"servicepanel"),1.));
 let mut bad=c.clone();bad.stories=4;assert!(validate(&bad).is_err());
}
#[test]fn process_handoff_carries_the_whole_design(){
 for stories in [1usize,2,3]{let mut c=Config::default();c.stories=stories;if stories==1{c.width=40.;c.depth=32.;}let m=model::build(&c);let h=process::handoff(&c,&m);
  assert_eq!(n(&h,"width"),c.width);assert_eq!(n(&h,"stories"),stories as f64);let levels=h["levels"].as_array().unwrap();assert_eq!(levels.len(),stories);
  for l in levels{let ws=l["walls"].as_array().unwrap();assert!(ws.iter().filter(|w|w["exterior"]==true).count()>=4);assert!(!l["rooms"].as_array().unwrap().is_empty());}
  assert!(levels[0]["walls"].as_array().unwrap().iter().any(|w|w["openings"].as_array().unwrap().iter().any(|o|s(o,"kind")=="door")),"front door");
  assert!(!h["roof"]["facets"].as_array().unwrap().is_empty());assert!(h["roof"]["facets"][0].as_array().unwrap().len()>=3);
  assert_eq!(h["stair"].is_object(),stories>1);assert!(n(&h["foundation"],"piers")>0.);
  assert!(security::parse(&serde_json::to_string(&c).unwrap()).is_ok(),"the return copy restores");}
}
#[test]fn roof_coverings_follow_each_style_and_swap_their_takeoff(){
 for name in catalog()["options"]["homeStyle"].as_array().unwrap(){let mut c=fixture();c.home_style=name.as_str().unwrap().into();architecture::apply(&mut c,true);validate(&c).unwrap();let m=model::build(&c);let items=m["items"].as_array().unwrap();let has=|id:&str|items.iter().any(|i|s(i,"id")==id);
  let kind=s(&m["roofing"],"kind");let expected=roofing::style_default(&c.home_style);assert_eq!(kind,if c.pitch>=roofing::min_pitch(expected){expected}else{roofing::METAL},"{}",c.home_style);
  if kind==roofing::METAL{assert!(has("roofmetal")&&has("roof-purlins")&&!has("roof-shingles"));}else{assert!(has("roof-shingles")&&has("roof-hipridge")&&has("roof-dripedge")&&has("underlay"));assert!(!has("roofmetal")&&!has("roof-purlins")&&!has("roofclips"),"{} keeps no metal roofing",c.home_style);}
  let kits=items.iter().find(|i|s(i,"id")=="roof-panelkits").unwrap();assert!(n(kits,"rawNet")>=1.);assert_eq!(n(kits,"rawNet"),n(&m["roofing"],"panels"));assert!(s(kits,"basis").contains("already listed"),"panel kits do not repeat sheathing or I-joists");}
 let mut c=fixture();c.home_style="Victorian".into();architecture::apply(&mut c,true);assert_eq!(c.pitch,12.);assert_eq!(architecture::preset("Cape Cod").3,"Gable");assert_eq!(architecture::preset("Scandinavian").3,"Front gable");
 let mut k=fixture();k.home_style="Craftsman".into();architecture::apply(&mut k,true);let roof=roof::build(&k);assert_eq!(n(&roof,"overhangZ"),2.5);assert_eq!(n(&roof,"overhangX"),2.);
 let mut r=fixture();r.home_style="Ranch".into();architecture::apply(&mut r,true);r.roofing=roofing::SLATE.into();assert!(validate(&r).is_ok());r.home_style="Mid-century".into();architecture::apply(&mut r,true);assert!(validate(&r).unwrap_err().contains("4:12"));
 let mut a=fixture();a.home_style="Ranch".into();architecture::apply(&mut a,true);a.pitch=3.;a.roofing=roofing::ASPHALT.into();let m=model::build(&a);assert!(s(m["items"].as_array().unwrap().iter().find(|i|s(i,"id")=="underlay").unwrap(),"name").contains("two layers"),"asphalt below 4:12 needs double underlayment");
 let mut sl=fixture();sl.roofing=roofing::SLATE.into();sl.pitch=8.;let m=model::build(&sl);let row=m["items"].as_array().unwrap().iter().find(|i|s(i,"id")=="roof-shingles").unwrap();assert!(s(row,"name").contains("3 in headlap"));assert!(near(n(row,"rawNet"),n(&m["roof"],"area")/100.*14400./85.));
}
#[test]fn cathedral_ceilings_are_offered_only_on_roofs_that_can_vault(){
 let mut c=fixture();c.home_style="Colonial".into();architecture::apply(&mut c,true);c.ceiling="Cathedral".into();let m=model::build(&c);assert_eq!(m["cathedral"],true);assert!(s(&m["panelAssemblies"][5],"name").contains("Cathedral"));
 c.ceiling="Flat ceiling".into();let f=model::build(&c);assert_eq!(f["cathedral"],false);let row=|m:&Value,id:&str|n(m["items"].as_array().unwrap().iter().find(|i|s(i,"id")==id).unwrap(),"rawNet");assert!(row(&m,"drywallceiling")>row(&f,"drywallceiling"),"a vault has more ceiling than a flat ceiling");assert_eq!(row(&f,"atticinsulation"),c.width*c.depth);
 let mut low=fixture();low.home_style="Mid-century".into();architecture::apply(&mut low,true);low.ceiling="Cathedral".into();validate(&low).unwrap();assert_eq!(model::build(&low)["cathedral"],false,"a low-slope roof cannot vault");
 let mut two=fixture();two.stories=2;two.home_style="Tudor".into();architecture::apply(&mut two,true);two.ceiling="Cathedral".into();validate(&two).unwrap();let m=model::build(&two);assert_eq!(m["levels"][1]["cathedral"],true);assert_eq!(n(&m["levels"][1],"ceilingBays"),0.);
}
#[test]fn eyebrow_and_arched_dormers_are_built_and_priced(){
 for(style,kind)in[("English cottage","Eyebrow"),("French country","Arched")]{let mut c=fixture();c.home_style=style.into();architecture::apply(&mut c,true);c.width=c.width.max(32.);c.depth=c.depth.max(32.);c.dormer_style="Style matched".into();c.dormer_width=if kind=="Arched"{4.}else{8.};c.dormer_depth=8.;c.dormer_count=2;c.rear_outdoor="None".into();validate(&c).unwrap();let m=model::build(&c);
  let ds=m["dormers"].as_array().unwrap();assert!(!ds.is_empty(),"{} dormers fit: {:?}",kind,m["dormerNotes"]);for d in ds{assert_eq!(s(d,"kind"),kind);assert!(n(&d["arch"],"rise")>=1.);assert!(!d["facets"].as_array().unwrap().is_empty());assert!(!d["rafters"].as_array().unwrap().is_empty());for f in d["facets"].as_array().unwrap(){for p in f["points"].as_array().unwrap(){assert!(p.as_array().unwrap().iter().all(|v|v.as_f64().unwrap().is_finite()));}}}
  let items=m["items"].as_array().unwrap();assert!(items.iter().any(|i|s(i,"id").ends_with("-archheader")));assert!(items.iter().any(|i|s(i,"name").contains(if kind=="Eyebrow"{"eyebrow window"}else{"Arched-top"})));if kind=="Arched"{assert!(items.iter().any(|i|s(i,"id").ends_with("-ribs")));}else{assert!(ds.iter().all(|d|d["cheeks"].as_array().unwrap().is_empty()),"eyebrows have no cheek walls");}}
}
#[test]#[ignore]fn bench_model_build(){
 for(name,stories,w,d)in[("Victorian",2,26.,46.),("Victorian",3,26.,46.),("Georgian",2,48.,40.),("Georgian",3,100.,100.)]{let mut c=Config::default();c.home_style=name.into();architecture::apply(&mut c,true);c.stories=stories;c.width=w;c.depth=d;if validate(&c).is_err(){c.catalog_plan=false;}
  let t=std::time::Instant::now();let mut len=0;for _ in 0..5{len=model::build(&c).to_string().len();}let ms=t.elapsed().as_secs_f64()*1000./5.;
  let m=model::build(&c);let mut sizes:Vec<(String,usize)>=m.as_object().unwrap().iter().map(|(k,v)|(k.clone(),v.to_string().len())).collect();sizes.sort_by(|a,b|b.1.cmp(&a.1));
  println!("{} {} {}x{}: {:.1} ms, JSON {} KB; biggest: {:?}",name,stories,w,d,ms,len/1024,sizes.iter().take(8).map(|(k,s)|format!("{}={}KB",k,s/1024)).collect::<Vec<_>>());}
}
#[test]#[ignore]fn bench_model_stages(){
 let mut c=Config::default();c.home_style="Georgian".into();architecture::apply(&mut c,true);c.stories=2;
 let time=|label:&str,f:&dyn Fn()->Value|{let t=std::time::Instant::now();for _ in 0..5{std::hint::black_box(f());}println!("{:<28}{:>8.1} ms",label,t.elapsed().as_secs_f64()*200.);};
 time("roof::build",&||roof::build(&c));
 time("build_level floor0",&||{let mut cc=c.clone();cc.active_floor=0;model::build_level(&cc)});
 time("build_level floor1",&||{let mut cc=c.clone();cc.active_floor=1;model::build_level(&cc)});
 time("storeys::build",&||storeys::build(&c));
 time("+garage+porch+additions",&||additions::apply(&c,porch::apply(&c,garage::apply(&c,storeys::build(&c)))));
 time("+panels+roofing",&||roofing::apply(&c,panels::apply(&c,additions::apply(&c,porch::apply(&c,garage::apply(&c,storeys::build(&c)))))));
 time("model::build (all)",&||model::build(&c));
 time("model::build + to_string",&||json!(model::build(&c).to_string().len()));
 let mut cc=c.clone();cc.active_floor=0;let rs=layout(&cc).0;let ws=model::walls(&cc,&rs);
 time("frame::build floor0",&||{json!(frame::build(&ws,&cc).len())});
 time("staging::build floor0",&||{json!(staging::build(&rs,&ws).0.len())});
 time("rules::opening_schedule",&||rules::opening_schedule(&cc,&rs,&ws));
 time("finishes::faces",&||json!(finishes::faces(&cc,&rs,&ws).len()));
 time("accessibility::report",&||{let fs=staging::build(&rs,&ws).0;accessibility::report(&cc,&rs,&ws,&fs)});
}
#[test]fn generate_another_home_always_returns_a_complete_different_design(){
 let mut styles=std::collections::BTreeSet::new();let mut sizes=std::collections::BTreeSet::new();let mut stories=std::collections::BTreeSet::new();
 for(mode,keep)in[("Custom",false),("Custom",true),("Affordable",false),("Premium",false)]{let mut c=Config::default();c.design_mode=mode.into();
  for seed in 0..8u32{let next=generator::surprise(&c,1000+seed*97,keep).unwrap_or_else(|e|panic!("{} {}: {}",mode,seed,e));validate(&next).unwrap();assert_ne!(next.home_style,c.home_style,"each click changes the style");
   let m=model::build(&next);assert!(generator::practical(&next,&m));styles.insert(next.home_style.clone());sizes.insert(format!("{}x{}",next.width,next.depth));stories.insert(next.stories);c=next;}}
 assert!(styles.len()>=8,"varied styles: {:?}",styles);assert!(sizes.len()>=8,"varied sizes: {:?}",sizes);assert!(stories.len()>=2);
}
#[test]fn affordable_and_premium_buttons_return_homes_instead_of_errors(){
 for stories in [1,2]{for bedrooms in [1,2,3,4]{for mode in ["Affordable","Premium"]{let mut c=Config::default();c.stories=stories;c.bedrooms=bedrooms;
  for seed in (1000..10000).step_by(997){let g=generator::generate(&c,mode,seed,false);assert!(g.is_ok(),"{} {} story {} bed seed {}: {:?}",mode,stories,bedrooms,seed,g.err());}}}}
}
#[test]fn roof_coverings_respect_minimum_slopes_on_dormers_and_metal(){
 let item=|m:&Value,id:&str|m["items"].as_array().unwrap().iter().find(|i|s(i,"id")==id).cloned();
 // Coastal style-matched: cedar shingles with 2:12 shed dormers -> those dormer roofs are standing seam.
 let mut c=Config::default();c.home_style="Coastal".into();c.stories=1;architecture::apply(&mut c,true);c.pitch=12.;c.dormer_style="Shed".into();c.dormer_count=2;c.dormer_width=4.;c.dormer_depth=8.;
 let m=model::build(&c);assert_eq!(s(&m["roofing"],"kind"),roofing::CEDAR);let low=n(&m["roofing"],"lowSlopeArea");
 if !m["dormers"].as_array().unwrap().is_empty(){assert!(low>0.);assert!(near(n(&item(&m,"roof-lowslope").unwrap(),"net"),round(low)));}
 // Ribbed metal below 3:12 becomes standing seam; at 3:12 and above it stays ribbed.
 let mut flat=Config::default();flat.home_style="Contemporary".into();architecture::apply(&mut flat,true);flat.roofing=roofing::METAL.into();flat.pitch=1.;flat.dormer_style="None".into();
 assert!(s(&item(&model::build(&flat),"roofmetal").unwrap(),"name").contains("standing-seam"));flat.pitch=4.;assert!(s(&item(&model::build(&flat),"roofmetal").unwrap(),"name").contains("ribbed"));
}
#[test]fn cathedral_ventilation_and_garages_report_honestly(){
 let mut c=Config::default();c.home_style="Georgian".into();c.stories=1;architecture::apply(&mut c,true);c.ceiling="Cathedral".into();
 if roof::cathedral(&c){let m=model::build(&c);let v=&m["ventilation"];assert_eq!(n(v,"boxVentCount"),0.);assert_eq!(v["cathedral"],true);
  let screens=m["items"].as_array().unwrap().iter().find(|i|s(i,"id")=="ventscreen").map(|i|n(i,"net")).unwrap_or(0.);assert!(near(screens,n(v,"intakeVentCount")));}
 let mut g=Config::default();g.garage="Attached".into();let m=model::build(&g);
 assert!(!m["structural"]["issues"].as_array().unwrap().iter().any(|v|v.as_str().unwrap().contains("exterior wall section is removed")),"A garage is not a removed house wall");
}
