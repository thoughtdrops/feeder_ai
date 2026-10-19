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
   let items=m["items"].as_array().unwrap();assert_eq!(round(items.iter().filter(|v|!pricing::furnishing(s(v,"category"))).map(|v|n(v,"total")).sum()),n(&m,"subtotal"));assert_eq!(n(&m,"total"),round(n(&m,"subtotal")+n(&m,"tax")));
   assert!((n(&m,"tax")-round(n(&m,"subtotal")*0.06)).abs()<0.011);assert!(items.iter().all(|v|n(v,"total")==round(n(v,"qty")*n(v,"price"))));
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
   let row=rows.iter().find(|i|s(i,"id")=="cornertrim").unwrap();assert!(near(n(row,"rawNet"),corners.iter().map(|p|n(p,"length")).sum()));assert!(near(n(&m,"subtotal"),round(rows.iter().filter(|i|!pricing::furnishing(s(i,"category"))).map(|i|n(i,"total")).sum())));
   for corner in corners{let wall=m["walls"].as_array().unwrap().iter().find(|w|s(w,"id")==s(corner,"wallId")).unwrap();let width=n(corner,"width");assert!(n(corner,"at")>=width/2.-1e-8&&n(corner,"at")+width/2.<=n(wall,"length")+1e-8);assert!(near(n(corner,"length"),c.wall_height-0.2));}
   let casing=rows.iter().find(|i|s(i,"id")=="casing").unwrap();let expected:f64=m["walls"].as_array().unwrap().iter().map(|w|w["openings"].as_array().unwrap().iter().filter(|o|s(o,"kind")!="window").map(|o|(2.*(n(o,"height")-0.2)+n(o,"width")+2.*n(&m["trimPackage"],"casingWidth"))*if w["exterior"]==true{1.}else{2.}).sum::<f64>()).sum();assert!(near(n(casing,"rawNet"),expected));
  }
 }}let mut c=fixture();c.trim_size="Invalid".into();assert!(validate(&c).is_err());
}
#[test]fn every_generated_room_uses_the_two_foot_grid_without_gaps_or_overlaps(){
 for w in (8..=100).step_by(2){for d in (8..=100).step_by(2){for style in catalog()["layoutStyles"].as_array().unwrap(){let mut c=fixture();c.width=w as f64;c.depth=d as f64;c.layout=s(style,"name").into();let(rs,_)=layout(&c);assert!(!rs.is_empty());assert!(near(rs.iter().map(|r|r.w*r.d).sum(),c.width*c.depth));for(i,r)in rs.iter().enumerate(){for n in [r.x,r.z,r.w,r.d]{assert!(near(n/2.,(n/2.).round()));}assert!(r.w>=2.&&r.d>=2.&&r.x>=0.&&r.z>=0.&&r.x+r.w<=c.width&&r.z+r.d<=c.depth);for other in &rs[i+1..]{assert!((r.x+r.w).min(other.x+other.w)<=r.x.max(other.x)+1e-8||(r.z+r.d).min(other.z+other.d)<=r.z.max(other.z)+1e-8);}}}}}
}
#[test]fn detailed_takeoff_reconciles_with_geometry_rounded_prices_waste_tax_and_categories(){
 for(w,d)in[(8.,8.),(24.,32.),(48.,36.),(100.,100.)]{let mut c=fixture();c.width=w;c.depth=d;c.tax=7.25;c.waste=13.;c.wallpaper="Midnight damask".into();c.bedroom_wallpaper="Botanical silk".into();c.prices.insert("counter".into(),45.125);c.roofing=roofing::METAL.into();let m=model::build(&c);let items=m["items"].as_array().unwrap();let mut ids=std::collections::BTreeSet::new();let mut categories=BTreeMap::<String,f64>::new();for i in items{assert!(ids.insert(s(i,"id")));let raw=n(i,"rawNet");let ordered=raw*(1.+n(i,"wastePercent")/100.);let expected=if s(i,"rounding")=="Whole purchase units"{(ordered-1e-9).max(0.).ceil()}else{round(ordered)};assert!(near(n(i,"net"),round(raw)));assert!(near(n(i,"qty"),expected));assert!(near(n(i,"price"),round(n(i,"price"))));assert!(near(n(i,"total"),round(n(i,"qty")*n(i,"price"))));*categories.entry(s(i,"category").into()).or_default()+=n(i,"total");}assert!(near(n(&m,"subtotal"),round(items.iter().filter(|i|!pricing::furnishing(s(i,"category"))).map(|i|n(i,"total")).sum())));assert!(near(n(&m,"tax"),round(n(&m,"subtotal")*c.tax/100.)));assert!(near(n(&m,"total"),round(n(&m,"subtotal")+n(&m,"tax"))));for(cat,total)in categories{assert!(near(m["categoryTotals"][cat].as_f64().unwrap(),total));}
 let row=|id:&str|items.iter().find(|i|s(i,"id")==id).unwrap();assert!(near(n(row("roofmetal"),"rawNet"),(w+2.*n(&m["roof"],"overhangX"))*(d+2.*n(&m["roof"],"overhangZ"))*(1.+(c.pitch/12.).powi(2)).sqrt()));assert!(near(n(row("counter"),"rawNet"),m["furniture"].as_array().unwrap().iter().filter(|f|["kitchen","island","counter-run"].contains(&s(f,"kind"))).map(|f|n(f,"localWidth")*n(f,"localDepth")).sum()));let faces=m["wallFaces"].as_array().unwrap();assert!((faces.iter().map(|f|n(f,"area")).sum::<f64>()-n(&m,"drywallWalls")).abs()<0.011);assert!((n(&m,"wallpaperBedroomArea")+n(&m,"wallpaperGeneralArea")-n(&m,"wallpaperArea")).abs()<0.021);assert!(m["ventilation"]["passesArea"]==true&&m["ventilation"]["passesBalance"]==true);assert!(!items.iter().any(|i|["electrical","plumbing","hvac","appliances"].contains(&s(i,"id"))));}
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
#[test]fn all_layouts_and_sizes_have_consistent_quantities(){for(w,d)in[(8.,8.),(8.,100.),(100.,8.),(24.,32.),(48.,36.),(100.,100.)]{for style in catalog()["layoutStyles"].as_array().unwrap(){let mut c=fixture();c.width=w;c.depth=d;c.layout=s(style,"name").into();validate(&c).unwrap();let m=model::build(&c);let rs=m["rooms"].as_array().unwrap();assert!((rs.iter().map(|r|n(r,"w")*n(r,"d")).sum::<f64>()-w*d).abs()<0.1);for r in rs{assert!(n(r,"x")>=0.&&n(r,"z")>=0.&&n(r,"x")+n(r,"w")<=w+0.01&&n(r,"z")+n(r,"d")<=d+0.01);}let items=m["items"].as_array().unwrap();assert!((round(items.iter().filter(|i|!pricing::furnishing(s(i,"category"))).map(|i|n(i,"total")).sum())-n(&m,"subtotal")).abs()<0.01);assert!(items.iter().all(|i|n(i,"net")>=0.&&n(i,"qty")>=0.&&n(i,"total").is_finite()));assert_eq!(n(&m["counts"],"studs"),n(&m["counts"],"exteriorStuds")+n(&m["counts"],"interiorStuds"));assert_eq!(n(&m["counts"],"headerPlies"),2.*m["walls"].as_array().unwrap().iter().filter(|w|w["exterior"]==true).map(|w|w["openings"].as_array().unwrap().len()).sum::<usize>()as f64);assert!(n(&m,"cavityArea")>0.&&n(&m,"cavityArea")<n(&m,"perimeter")*c.wall_height);}}}
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
 for i in 0..30{let mut c=fixture();c.layout=s(&catalog()["layoutStyles"][i],"name").into();let m=model::build(&c);let frames=m["frameMembers"].as_array().unwrap();for opening in m["openings"].as_array().unwrap(){let group:Vec<_>=frames.iter().filter(|f|s(f,"openingId")==s(opening,"id")).collect();let bearing=m["walls"].as_array().unwrap().iter().find(|w|w["id"]==opening["wallId"]).unwrap()["exterior"]==true;// A window ganged to the one on its left shares that mullion's king stud.
 let wall=m["walls"].as_array().unwrap().iter().find(|w|w["id"]==opening["wallId"]).unwrap();let shared=wall["openings"].as_array().unwrap().iter().any(|q|n(q,"at")+n(q,"width")<=n(opening,"at")+1e-9&&n(opening,"at")-n(q,"at")-n(q,"width")<0.5);
 for(role,count)in [("Header ply",if bearing{2}else{0}),("Flat door header",if bearing{0}else{1}),("King",if shared{1}else{2}),("Jack",if bearing{2}else{0})]{assert_eq!(group.iter().filter(|f|s(f,"role")==role).count(),count);}assert_eq!(group.iter().filter(|f|s(f,"role")=="Rough sill").count(),usize::from(s(opening,"kind")=="window"));}}
}

#[test]fn architecture_changes_footprints_wall_plans_and_roof_topology(){
 let mut signatures=std::collections::BTreeSet::new();for name in catalog()["options"]["homeStyle"].as_array().unwrap(){let mut c=fixture();c.home_style=name.as_str().unwrap().into();architecture::apply(&mut c,true);validate(&c).unwrap();let m=model::build(&c);assert!(!c.layout.is_empty());signatures.insert(format!("{}:{}:{}:{}",c.width,c.depth,c.layout,m["roof"]["type"]));let roof=&m["roof"];assert!(n(roof,"area")>c.width*c.depth);assert!(!roof["facets"].as_array().unwrap().is_empty());for r in m["rafters"].as_array().unwrap(){for suffix in ["1","2"]{let x=n(r,&format!("x{}",suffix));let z=n(r,&format!("z{}",suffix));let y=n(r,&format!("y{}",suffix));assert!((y-c.wall_height-roof::height(&c,x,z)).abs()<1e-5,"{} {:?}",c.home_style,r);}let len=((n(r,"x2")-n(r,"x1")).powi(2)+(n(r,"z2")-n(r,"z1")).powi(2)+(n(r,"y2")-n(r,"y1")).powi(2)).sqrt();assert!((len-n(r,"length")).abs()<1e-6);}
 let projected:f64=roof["facets"].as_array().unwrap().iter().map(|f|{let p=f["plane"].as_array().unwrap();n(f,"area")/(1.+p[0].as_f64().unwrap().powi(2)+p[1].as_f64().unwrap().powi(2)).sqrt()}).sum();let expected=(c.width+2.*n(roof,"overhangX"))*(c.depth+2.*n(roof,"overhangZ"));assert!((projected-expected).abs()<1e-5,"Roof plane area must cover the entire footprint exactly once");if s(roof,"type")=="Hip"{assert!(n(roof,"hipLF")>0.);assert_eq!(n(roof,"infillArea"),0.);}if s(roof,"type")=="Cross gable"{assert!(n(roof,"valleyLF")>0.);} }
 assert_eq!(signatures.len(),15);
}
#[test]fn two_storeys_have_connected_programs_and_single_roof_foundation(){for name in ["Victorian","Georgian","Ranch","Scandinavian","Contemporary"]{let mut c=fixture();c.home_style=name.into();c.stories=2;architecture::apply(&mut c,true);let m=model::build(&c);let ls=m["levels"].as_array().unwrap();assert_eq!(ls.len(),2);assert_eq!(n(&ls[0]["counts"],"bedrooms"),0.);assert_eq!(n(&ls[1]["counts"],"bedrooms"),3.);assert!(!ls[0]["furniture"].as_array().unwrap().iter().any(|f|["bed","wallbed"].contains(&s(f,"kind"))));assert!(!ls[1]["furniture"].as_array().unwrap().iter().any(|f|["kitchen","sofa"].contains(&s(f,"kind"))));for l in ls{let rs:Vec<Room>=serde_json::from_value(l["rooms"].clone()).unwrap();assert_eq!(rs.iter().map(|r|r.w*r.d).sum::<f64>(),c.width*c.depth);for r in &rs{assert!([r.x,r.z,r.w,r.d].iter().all(|x|near(*x/2.,(*x/2.).round())));}let ws:Vec<Wall>=serde_json::from_value(l["walls"].clone()).unwrap();for r in rs.iter().filter(|r|["bedroom","bath","stairs"].contains(&r.kind.as_str())){assert!(!staging::aprons(r,&ws).is_empty(),"No access for {} in {}",r.name,name);}}
 let items=m["items"].as_array().unwrap();assert!(!items.iter().any(|i|s(i,"id")=="slab"));assert!((n(items.iter().find(|i|s(i,"id")=="crawl-subfloor").unwrap(),"rawNet")-c.width*c.depth/32.).abs()<1e-6);assert!((n(items.iter().find(|i|s(i,"id")=="ziproof").unwrap(),"rawNet")-n(&m,"roofArea")/32.).abs()<1e-6);assert_eq!(m["allFrameMembers"].as_array().unwrap().len(),ls.iter().map(|l|l["frameMembers"].as_array().unwrap().len()).sum::<usize>());assert!(n(&m["stair"],"riserInches")<=7.75);assert!(m["floorFrameMembers"].as_array().unwrap().len()>20);let sum=round(items.iter().filter(|i|!pricing::furnishing(s(i,"category"))).map(|i|n(i,"total")).sum());assert_eq!(sum,n(&m,"subtotal"));c.active_floor=1;let upper=model::build(&c);assert_eq!(upper["total"],m["total"]);assert!(upper["walls"].as_array().unwrap().iter().all(|w|s(w,"id").contains("-L2")));}}

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
     assert!(near(rs.iter().filter(|r|!wings::is_wing(&r.id)).map(|r|r.w*r.d).sum(),width*depth));
     for (i,r) in rs.iter().enumerate() {
      assert!([r.x,r.z,r.w,r.d].iter().all(|v|near(*v/2.,(*v/2.).round())));
      for other in &rs[i+1..] {assert!((r.x+r.w).min(other.x+other.w)<=r.x.max(other.x)+1e-8||(r.z+r.d).min(other.z+other.d)<=r.z.max(other.z)+1e-8);}
     }
    }
    assert_eq!(n(&m["counts"],"bedrooms"),beds as f64,"{} {}x{} {} wings {}",mode,width,depth,next.shape,m["wings"]);
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
 for kind in ["Attached","Detached"]{let mut c=fixture();c.garage=kind.into();c.garage_side="Left".into();let left=model::build(&c);assert!(n(&left["garage"],"x")<0.);assert!(n(&left["siteBounds"],"minX")<0.);c.garage_side="Right".into();let right=model::build(&c);assert!(n(&right["garage"],"x")>=c.width);for m in [&left,&right]{assert!(near(n(&m["garage"],"w"),24.));assert_eq!(round(m["items"].as_array().unwrap().iter().filter(|i|!pricing::furnishing(s(i,"category"))).map(|i|n(i,"total")).sum()),n(m,"subtotal"));}}
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
  let mut upper_c=c.clone();upper_c.active_floor=1;assert_eq!(m["levels"][1]["frameMembers"].as_array().unwrap().len(),frame::build(&upper_ws,&upper_c).len());assert_eq!(round(m["items"].as_array().unwrap().iter().filter(|i|!pricing::furnishing(s(i,"category"))).map(|i|n(i,"total")).sum()),n(&m,"subtotal"));
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
   assert!(near(n(&m,"subtotal"),round(items.iter().filter(|i|!pricing::furnishing(s(i,"category"))).map(|i|n(i,"total")).sum())));
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
 let mut c=fixture();c.width=100.;c.depth=100.;c.county=s(&rules::locate(25.77,-80.19).unwrap(),"id").into();c.pricing_mode="Wholesale estimate".into();let m=model::build(&c);let row=|m:&Value|m["items"].as_array().unwrap().iter().find(|i|s(i,"id")=="zipwall").unwrap().clone();let z=row(&m);assert!(n(&z,"qty")>=80.);assert_eq!(n(&z,"retailPrice"),29.49);assert!(n(&z,"discountPercent")>=20.,"Production-builder sheathing rate, above the 80-sheet tier");assert_eq!(n(&z,"price"),round(29.49*(1.-n(&z,"discountPercent")/100.)));
 c.bulk_discounts.insert("ZIP envelope".into(),20.);let override_row=row(&model::build(&c));assert_eq!(n(&override_row,"price"),round(29.49*0.8));assert_eq!(n(&override_row,"discountPercent"),20.);c.prices.insert("zipwall".into(),40.);assert_eq!(n(&row(&model::build(&c)),"price"),32.);
 c.pricing_mode="Retail".into();let retail=model::build(&c);assert_eq!(n(&row(&retail),"price"),40.);assert_eq!(n(&retail,"volumeSavings"),0.);c.pricing_mode="Wholesale estimate".into();c.bulk_discounts.clear();c.width=8.;c.depth=8.;c.prices.clear();let tiny=row(&model::build(&c));assert!(n(&tiny,"qty")<80.);assert_eq!(n(&tiny,"discountPercent"),30.);c.bulk_discounts.insert("Roof".into(),81.);assert!(validate(&c).is_err());
}
#[test]fn rear_additions_windows_and_insulation_scale_from_live_geometry(){
 let mut c=fixture();c.home_style="Ranch".into();c.width=40.;c.depth=48.;c.rear_outdoor="Deck".into();c.window_size="Large".into();c.window_style="Picture".into();let m=model::build(&c);let p=&m["rearOutdoor"];assert!(s(p,"access").starts_with("Connected"));assert_eq!(p["roofs"],json!([]));let rect=&p["rectangles"][0];assert_eq!(n(rect,"w"),16.);assert_eq!(n(rect,"d"),8.);assert!(n(&m["siteBounds"],"maxZ")>=56.);assert!(n(&m,"interiorCavityArea")<n(&m,"partitionLength")*c.wall_height);
 for w in m["windowSchedule"].as_array().unwrap(){if w["bedroomEscapeCandidate"]==true{assert_eq!(s(w,"type"),"Casement");}assert!(n(w,"width")==2.||n(w,"width")>=6.,"large ranch window {}",n(w,"width"));}
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
 let note=garage::move_connection(&mut c,&rs,&ws,30.).unwrap();assert!(note.is_some(),"A spot past the shared wall snaps back with a note");
 let snapped=model::build(&c);let door=snapped["openings"].as_array().unwrap().iter().find(|o|s(o,"id")=="G-HOUSE-DOOR").unwrap();let center=n(door,"at")+n(door,"width")/2.;
 let spans=garage::connection_spans(&c,&rs,&ws);assert!(spans.iter().any(|&(a,b)|center>=a-1e-6&&center<=b+1e-6));assert!(center<24.);
 assert!(garage::move_connection(&mut c,&rs,&ws,f64::NAN).is_err());
}

#[test]
fn the_garage_slides_along_the_house_and_its_door_can_go_anywhere_but_bedrooms_and_stairs(){
 let mut c=Config::default();c.garage="Attached".into();c.garage_side="Left".into();let auto=model::build(&c);
 for z in [-16.,0.,8.,(c.depth-8.).max(0.)]{
  c.garage_offset=Some(z);c.opening_overrides.clear();assert!(validate(&c).is_ok());let m=model::build(&c);assert_eq!(n(&m["garage"],"z"),z);
  let rs:Vec<Room>=serde_json::from_value(m["rooms"].clone()).unwrap();let ws:Vec<Wall>=serde_json::from_value(m["walls"].clone()).unwrap();
  let spans=garage::connection_spans(&c,&rs,&ws);
  for &(a,b) in &spans{for center in [a,(a+b)/2.,b]{let mut t=c.clone();assert_eq!(garage::move_connection(&mut t,&rs,&ws,center).unwrap(),None);let door=model::build(&t)["openings"].as_array().unwrap().iter().find(|o|s(o,"id")=="G-HOUSE-DOOR").cloned().unwrap();assert!((n(&door,"at")+n(&door,"width")/2.-center).abs()<1e-6);
   assert!(!rs.iter().any(|r|["bedroom","stairs"].contains(&r.kind.as_str())&&near(r.x,0.)&&center-19./12.<r.z+r.d&&center+19./12.>r.z),"never into a bedroom or stair");}}
 }
 c.garage_offset=Some(f64::NAN);assert!(validate(&c).is_err());c.garage_offset=Some(500.);assert!(validate(&c).is_err());
 c.garage_offset=None;assert_eq!(model::build(&c)["garage"]["z"],auto["garage"]["z"]);
 // A bath on the shared wall may take the door (IRC R302.5.1 only bars sleeping rooms).
 let rooms=vec![Room{id:"B".into(),name:"Bath".into(),kind:"bath".into(),x:0.,z:0.,w:8.,d:10.}];let w=Wall{id:"W".into(),name:"Left".into(),x:0.,z:0.,length:24.,axis:"z".into(),exterior:true,openings:vec![]};
 let mut t=Config::default();t.garage="Attached".into();t.garage_side="Left".into();t.garage_offset=Some(0.);t.depth=24.;
 let o=Opening{id:"G-HOUSE-DOOR".into(),kind:"door".into(),at:3.,width:38./12.,bottom:0.,height:82.5/12.};assert!(garage::connection_error(&o,&w,&t,&rooms).is_none());
 let bed=vec![Room{kind:"bedroom".into(),..rooms[0].clone()}];assert!(garage::connection_error(&o,&w,&t,&bed).is_some());
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
 // Default: steel beams in the cap saddles, a treated nailer bolted on top, floor panels on the nailer.
 assert!(row("pier-girders").is_none());assert!(near(n(row("pier-beams").unwrap(),"rawNet"),3.*46.));assert!(near(n(row("pier-nailers").unwrap(),"rawNet"),3.*46.));assert_eq!(n(row("pier-nailer-bolts").unwrap(),"qty"),69.);assert_eq!(f["beam"],"steel");
 let mut wood=c.clone();wood.pier_beam=piers::BEAMS[1].into();let mw=model::build(&wood);let wi=mw["items"].as_array().unwrap();assert!(near(n(wi.iter().find(|i|s(i,"id")=="pier-girders").unwrap(),"rawNet"),3.*46.));assert!(!wi.iter().any(|i|s(i,"id")=="pier-beams"||s(i,"id")=="pier-nailers"));
 let mut bad_beam=c.clone();bad_beam.pier_beam="Bamboo".into();assert!(validate(&bad_beam).is_err());
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
#[test]fn wholesale_scenario_tracks_category_size_and_affordable_varies_style(){
 assert_eq!(pricing::builder_discount("Kitchen & bath"),45.);assert_eq!(pricing::builder_discount("Openings"),40.);assert_eq!(pricing::builder_discount("Roof framing"),30.);assert_eq!(pricing::builder_discount("Foundation"),25.);
 // Production-builder pricing: every category is priced at its contract rate, furniture and staging are not build cost.
 let mut p=Config::default();p.pricing_mode="Wholesale estimate".into();let m=model::build(&p);let items=m["items"].as_array().unwrap();
 for i in items.iter().filter(|i|n(i,"qty")>0.&&n(i,"retailPrice")>0.&&!p.prices.contains_key(s(i,"id"))){assert!(n(i,"discountPercent")>=25.-1e-9,"{} {}",s(i,"id"),n(i,"discountPercent"));}
 let furnish:f64=items.iter().filter(|i|pricing::furnishing(s(i,"category"))).map(|i|n(i,"total")).sum();let build:f64=items.iter().filter(|i|!pricing::furnishing(s(i,"category"))).map(|i|n(i,"total")).sum();
 assert!(furnish>0.);assert!(near(n(&m,"furnishingsTotal"),round(furnish)));assert!((n(&m,"subtotal")-round(build)).abs()<0.05,"Build subtotal excludes furnishings");
 let mut c=Config::default();c.stories=2;c.home_style="Colonial".into();let mut styles=std::collections::BTreeSet::new();
 for seed in (1000..10000).step_by(911){let g=generator::generate(&c,"Affordable",seed,false).unwrap();assert_ne!(g.home_style,"Colonial","Affordable always moves to a different style");styles.insert(g.home_style);}
 assert!(styles.len()>=3,"Affordable homes vary: {:?}",styles);
}
#[test]fn framing_cut_lists_share_stock_and_whole_house_items_are_counted_once(){
 assert_eq!(model::stock_boards(&[7.72;5],8.),5,"Full studs need a board each");assert_eq!(model::stock_boards(&[2.;8],8.),3,"Short cripples share boards (kerf)");assert_eq!(model::stock_boards(&[5.,3.,5.,3.],8.),3);
 // Two-story 24 × 32: one HVAC system for 1,536 sq ft, downspouts kept, two exterior lights in total.
 let mut c=Config::default();c.home_style="Colonial".into();c.stories=2;architecture::apply(&mut c,true);c.width=24.;c.depth=32.;
 let m=model::build(&c);let q=|id:&str|m["items"].as_array().unwrap().iter().find(|i|s(i,"id")==id).map(|i|n(i,"net")).unwrap_or(0.);
 assert_eq!(q("hvacequipment"),1.);assert_eq!(q("thermostats"),1.);assert!(q("downspouts")>0.,"Downspouts survive the story merge");
 let rooms:usize=m["levels"].as_array().unwrap().iter().map(|l|l["rooms"].as_array().unwrap().iter().filter(|r|s(r,"type")!="hall").count()).sum();assert!(near(q("lights"),rooms as f64+2.));
 assert_eq!(q("cornerbead"),0.,"Pre-painted panels with wood corner trim need no corner bead");
 // Shingle roofs: the drip edge replaces the metal roof's rake & eave trim.
 let mut sh=Config::default();sh.roofing=roofing::ASPHALT.into();sh.pitch=8.;let m=model::build(&sh);assert!(!m["items"].as_array().unwrap().iter().any(|i|s(i,"id")=="rake"));
 // Roof posts: distinct interior support points only.
 let v=model::build(&Config::default());let posts=v["items"].as_array().unwrap().iter().find(|i|s(i,"id")=="roofposts").map(|i|n(i,"net")).unwrap_or(0.);assert!(posts<=16.,"posts {}",posts);
}
/// Rooms that cannot be reached from an exterior door (through doors, passages, open edges and stairs), and
/// bedrooms without an exterior window.
fn room_access_problems(c:&Config,m:&Value)->Vec<String>{
 let levels:Vec<Value>=if c.stories>1{m["levels"].as_array().unwrap().clone()}else{vec![m.clone()]};let mut problems=vec![];
 let (w,d)=(c.width,c.depth);let mut stair_rooms:Vec<(usize,String)>=vec![];let mut nodes:Vec<(usize,Room)>=vec![];
 for(li,l)in levels.iter().enumerate(){for r in serde_json::from_value::<Vec<Room>>(l["rooms"].clone()).unwrap(){if r.kind=="stairs"{stair_rooms.push((li,r.id.clone()))}nodes.push((li,r));}}
 let walls:Vec<Vec<Wall>>=levels.iter().map(|l|serde_json::from_value(l["walls"].clone()).unwrap()).collect();
 // covered[] intervals along a line, and door intervals
 let seg=|li:usize,vertical:bool,at:f64,lo:f64,hi:f64|->(f64,f64){let mut cover=0.;let mut door=0.;for wl in &walls[li]{if (wl.axis=="z")!=vertical{continue}let(line,start)=if vertical{(wl.x,wl.z)}else{(wl.z,wl.x)};if (line-at).abs()>0.3{continue}let a=start.max(lo);let b=(start+wl.length).min(hi);if b>a{cover+=b-a;}for o in &wl.openings{if o.kind=="window"{continue}let oa=(start+o.at).max(lo);let ob=(start+o.at+o.width).min(hi);if ob-oa>1.5{door=f64::max(door,ob-oa);}}}(cover,door)};
 let n=nodes.len();let mut adj=vec![vec![];n];let mut entry=vec![false;n];
 for i in 0..n{let(li,a)=&nodes[i];
  // exterior entries on the ground floor
  if *li==0{for(vertical,at,lo,hi)in[(true,0.,a.z,a.z+a.d),(true,w,a.z,a.z+a.d),(false,0.,a.x,a.x+a.w),(false,d,a.x,a.x+a.w)]{let edge=if vertical{if at==0.{a.x}else{a.x+a.w}}else{if at==0.{a.z}else{a.z+a.d}};if (edge-at).abs()<0.3{let(_,door)=seg(0,vertical,at,lo,hi);if door>0.{entry[i]=true;}}}}
  for j in 0..n{if i==j{continue}let(lj,b)=&nodes[j];if li!=lj{continue}
   for(vertical,at,lo,hi)in[(true,a.x+a.w,a.z.max(b.z),(a.z+a.d).min(b.z+b.d)),(false,a.z+a.d,a.x.max(b.x),(a.x+a.w).min(b.x+b.w))]{let touches=if vertical{(b.x-at).abs()<0.3}else{(b.z-at).abs()<0.3};if !touches||hi-lo<1.5{continue}let(cover,door)=seg(*li,vertical,at,lo,hi);if hi-lo-cover>2.4||door>0.{adj[i].push(j);adj[j].push(i);}}}}
 for a in 0..stair_rooms.len(){for b in 0..stair_rooms.len(){if stair_rooms[a].0+1==stair_rooms[b].0{let i=nodes.iter().position(|(l,r)|*l==stair_rooms[a].0&&r.id==stair_rooms[a].1).unwrap();let j=nodes.iter().position(|(l,r)|*l==stair_rooms[b].0&&r.id==stair_rooms[b].1).unwrap();adj[i].push(j);adj[j].push(i);}}}
 let mut seen=entry.clone();let mut stack:Vec<usize>=(0..n).filter(|&i|entry[i]).collect();if stack.is_empty(){problems.push("no exterior door".into());}
 while let Some(i)=stack.pop(){for &j in &adj[i]{if !seen[j]{seen[j]=true;stack.push(j);}}}
 for i in 0..n{if !seen[i]{problems.push(format!("unreachable L{} {} ({})",nodes[i].0,nodes[i].1.name,nodes[i].1.kind));}}
 for(li,r)in &nodes{if r.kind=="bedroom"{let mut win=false;for(vertical,at,lo,hi,edge)in[(true,r.x,r.z,r.z+r.d,r.x),(true,r.x+r.w,r.z,r.z+r.d,r.x+r.w),(false,r.z,r.x,r.x+r.w,r.z),(false,r.z+r.d,r.x,r.x+r.w,r.z+r.d)]{if (edge-at).abs()>0.3{continue}for wl in &walls[*li]{if (wl.axis=="z")!=vertical||!wl.exterior{continue}let start=if vertical{wl.z}else{wl.x};for o in &wl.openings{if o.kind=="window"&&(start+o.at)<hi&&(start+o.at+o.width)>lo{win=true}}}}if !win{problems.push(format!("bedroom without window L{} {}",li,r.name));}}}
 problems}
#[test]fn every_room_has_a_way_in_and_bedrooms_have_windows(){let styles:Vec<String>=catalog()["homeStyles"].as_array().unwrap().iter().map(|h|s(h,"name").to_string()).collect();let mut bad=0;let mut total=0;
 for st in &styles{for stories in 1..=3usize{let mut c=Config::default();c.home_style=st.clone();c.stories=stories;architecture::apply(&mut c,true);c.stories=stories;if validate(&c).is_err(){continue}let m=model::build(&c);total+=1;let p=room_access_problems(&c,&m);if !p.is_empty(){bad+=1;eprintln!("{} {}st {}x{}: {:?}",st,stories,c.width,c.depth,p);}}}
 for seed in 0..40u32{let c=generator::surprise(&Config::default(),seed*313+11,false).unwrap();let m=model::build(&c);total+=1;let p=room_access_problems(&c,&m);if !p.is_empty(){bad+=1;eprintln!("GEN {} {}st {}x{}: {:?}",c.home_style,c.stories,c.width,c.depth,p);}}
 assert_eq!(bad,0,"{} of {} designs have sealed rooms or windowless bedrooms",bad,total);}
#[test]fn keep_my_dimensions_never_resizes_the_house(){
 for (w,d,st) in [(26.,40.,2usize),(24.,32.,1),(30.,36.,3),(40.,48.,2)]{let mut c=Config::default();c.stories=st;c.width=w;c.depth=d;
  for seed in (100..4000).step_by(487){if let Ok(g)=generator::surprise(&c,seed,true){assert!(near(g.width,w)&&near(g.depth,d),"{}x{} st{} seed {} -> {}x{}",w,d,st,seed,g.width,g.depth);assert_eq!(g.stories,st);}}}
}

#[test]
fn every_item_price_is_editable_and_the_garage_window_is_counted_once(){
 for (garage,stud,dormer) in [("Detached","Sawn lumber","None"),("Attached","LSL studs","Gable")]{
  let mut c=Config::default();c.stories=1;c.garage=garage.into();c.stud_type=stud.into();c.dormer_style=dormer.into();let m=model::build(&c);
  let items=m["items"].as_array().unwrap();
  assert_eq!(items.iter().filter(|i|s(i,"id")=="garage-window").count(),1);
  let house_windows:f64=items.iter().filter(|i|s(i,"id").starts_with("windows-")).map(|i|n(i,"qty")).sum();
  let modeled=m["walls"].as_array().unwrap().iter().filter(|w|w["exterior"]==true).flat_map(|w|w["openings"].as_array().unwrap()).filter(|o|s(o,"kind")=="window").count() as f64;
  assert_eq!(house_windows,modeled,"house window lines cover the house's own windows only");
  // Every line in the estimate can take a typed price.
  for i in items{let mut t=c.clone();t.prices.insert(s(i,"id").into(),n(i,"price")+1.);assert!(validate(&t).is_ok(),"price edit refused for {}",s(i,"id"));}
 }
}

#[test]
fn generated_homes_fit_roofing_and_large_single_story_programs(){
 let mut c=Config::default();c.roofing="Natural slate".into();
 for seed in 0..12{let g=generator::generate(&c,"Affordable",seed,false);assert!(g.is_ok(),"seed {} {:?}",seed,g.err());}
 let mut big=Config::default();big.stories=1;big.bedrooms=5;
 for seed in 0..4{let g=generator::generate(&big,"Premium",seed,false);assert!(g.is_ok(),"premium seed {} {:?}",seed,g.err());}
}

#[test]
fn every_kitchen_has_a_refrigerator_and_facade_packages_are_whole(){
 let mut c=Config::default();c.width=32.;c.depth=40.;c.stories=2;let m=model::build(&c);
 let items=m["items"].as_array().unwrap();let qty=|id:&str|items.iter().find(|i|s(i,"id")==id).map(|i|n(i,"qty")).unwrap_or(0.);
 assert!(qty("fridge")>=qty("sink")&&qty("fridge")>=1.);
 let f=qty("facade");assert_eq!(f,f.round());
}

#[test]
fn facade_character_options_render_data_and_price_once(){
 use crate::additions::character as ch;
 let mut c=Config::default();c.home_style="Craftsman".into();
 for (field,list) in [("columnStyle",&ch::COLUMNS[..]),("railingStyle",&ch::RAILINGS[..]),("shutters",&ch::SHUTTERS[..]),("windowGrilles",&ch::GRILLES[..]),("entryDoor",&ch::DOORS[..]),("entrySurround",&ch::SURROUNDS[..]),("eaveOverhang",&ch::OVERHANGS[..])]{
  for v in list{let mut t=serde_json::to_value(&c).unwrap();t[field]=json!(v);let t:Config=serde_json::from_value(t).unwrap();assert!(validate(&t).is_ok(),"{} {}",field,v);let m=model::build(&t);assert!(m["character"].is_object());let total=n(&m,"subtotal");assert!(total.is_finite()&&total>0.);}
  let mut t=serde_json::to_value(&c).unwrap();t[field]=json!("Not an option");assert!(validate(&serde_json::from_value::<Config>(t).unwrap()).is_err());
 }
 // Columns: the porch price follows the chosen column.
 let price=|style:&str|{let mut t=c.clone();t.column_style=style.into();let m=model::build(&t);m["items"].as_array().unwrap().iter().find(|i|s(i,"id")=="porch-columns").map(|i|n(i,"price")).unwrap()};
 assert!(price("Fluted Doric")>price("Square post"));assert_eq!(model::build(&{let mut t=c.clone();t.column_style="Stone pier & post".into();t})["porch"]["columnStyle"],"stone");
 // Shutters and grilles are priced on the house windows; "None" removes them.
 let mut t=c.clone();t.shutters="Louvered".into();t.window_grilles="Prairie".into();let m=model::build(&t);let ids:Vec<&str>=m["items"].as_array().unwrap().iter().map(|i|s(i,"id")).collect();
 assert!(ids.contains(&"character-shutters")&&ids.contains(&"character-grilles"));
 t.shutters="None".into();t.window_grilles="None".into();let m=model::build(&t);assert!(!m["items"].as_array().unwrap().iter().any(|i|["character-shutters","character-grilles"].contains(&s(i,"id"))));
 // Overhang depth drives the actual roof.
 let mut deep=c.clone();deep.eave_overhang="Extra deep · 36 in".into();let mut tight=c.clone();tight.eave_overhang="Tight · 6 in".into();
 let (a,b)=(model::build(&deep),model::build(&tight));assert!(n(&a["roof"],"area")>n(&b["roof"],"area"));
 // New roof-edge moldings place real ornaments and price them.
 for (style,kind) in [("Modillion cornice","modillion"),("Scrolled corbels","corbel"),("Exposed beam ends","beam"),("Boxed eave & frieze","frieze")]{
  let mut t=c.clone();t.roof_edge_style=style.into();assert!(validate(&t).is_ok());let m=model::build(&t);
  assert!(m["roofAccents"]["ornaments"].as_array().unwrap().iter().any(|o|s(o,"kind")==kind),"{} has no {}",style,kind);
 }
}
#[test]
fn kitchen_and_living_options_validate_resolve_and_price(){
 use crate::interior_design as kd;
 let c=fixture();
 for (key,_,options,_) in kd::fields(&c){
  for v in options.iter(){let mut t=serde_json::to_value(&c).unwrap();t[key]=json!(v);let t:Config=serde_json::from_value(t).unwrap();assert!(validate(&t).is_ok(),"{} {}",key,v);let m=model::build(&t);assert!(m["interiorDesign"].is_object());assert!(!m["interiorDesign"].as_object().unwrap().values().any(|v|v=="Style matched"));let total=n(&m,"subtotal");assert!(total.is_finite()&&total>0.,"{} {}",key,v);}
  let mut t=serde_json::to_value(&c).unwrap();t[key]=json!("Not an option");assert!(validate(&serde_json::from_value::<Config>(t).unwrap()).is_err(),"{}",key);
 }
 // Every interior scheme family resolves to a full, valid design.
 for scheme in catalog()["interiorSchemes"].as_array().unwrap(){let mut t=c.clone();t.interior_style=s(scheme,"name").into();for(key,value)in kd::resolved(&t){let options=kd::fields(&t).into_iter().find(|f|f.0==key).unwrap().2;assert!(options.contains(&value)&&value!="Style matched",)}}
 let item=|t:&Config,id:&str|model::build(t)["items"].as_array().unwrap().iter().find(|i|s(i,"id")==id).cloned();
 let price=|t:&Config,id:&str|item(t,id).map(|i|n(&i,"price")).unwrap_or(0.);
 let with=|f:&dyn Fn(&mut Config)|{let mut t=c.clone();f(&mut t);t};
 assert!(price(&with(&|t|t.kitchen_counter="Calacatta marble".into()),"counter")>price(&with(&|t|t.kitchen_counter="Butcher block".into()),"counter"));
 assert!(price(&with(&|t|t.kitchen_cabinets="Fluted oak".into()),"cabinets")>price(&with(&|t|t.kitchen_cabinets="Shaker".into()),"cabinets"));
 assert!(price(&with(&|t|t.kitchen_sink="Farmhouse apron".into()),"sink")>price(&with(&|t|t.kitchen_sink="Undermount stainless".into()),"sink"));
 assert_eq!(price(&with(&|t|t.kitchen_backsplash="None".into()),"backsplash"),0.);
 let range=|v:&str|item(&with(&|t|t.kitchen_range=v.into()),"kitchen-range-upgrade");
 assert!(range("30 in slide-in").is_none());assert!(n(&range("48 in pro range").unwrap(),"price")>n(&range("36 in pro range").unwrap(),"price"));
 let media=|v:&str|item(&with(&|t|t.living_media=v.into()),"living-fireplace");assert!(media("TV console").is_none());assert!(media("Fireplace & TV").is_some());
 // Generated homes come back style matched.
 let mut t=c.clone();t.kitchen_counter="Concrete".into();t.living_seating="Curved sofa".into();kd::match_style(&mut t);assert_eq!(t.kitchen_counter,"Style matched");assert_eq!(t.living_seating,"Style matched");
}

#[test]
fn wide_seating_fits_its_room_and_keeps_every_other_piece_clear(){
 let mut placed=0;
 for seating in ["Wraparound U sectional","L-shaped sectional","Sofa & lounge chairs"]{for size in [36.,60.]{for i in (0..30).step_by(2){
  let mut c=fixture();c.width=size;c.depth=size;c.layout=s(&catalog()["layoutStyles"][i],"name").into();c.living_seating=seating.into();
  let m=model::build(&c);let rooms:Vec<Room>=serde_json::from_value(m["rooms"].clone()).unwrap();let fs:Vec<staging::Furniture>=serde_json::from_value(m["furniture"].clone()).unwrap();
  for f in fs.iter().filter(|f|f.kind=="sectional"){placed+=1;let r=rooms.iter().find(|r|r.id==f.room_id).unwrap();assert!(f.x-f.w/2.>=r.x&&f.x+f.w/2.<=r.x+r.w&&f.z-f.d/2.>=r.z&&f.z+f.d/2.<=r.z+r.d,"{} in {}",seating,c.layout);
   let a=[f.x-f.w/2.,f.z-f.d/2.,f.x+f.w/2.,f.z+f.d/2.];for o in fs.iter().filter(|o|o.id!=f.id&&!["coffee","rug"].contains(&o.kind.as_str())){let b=[o.x-o.w/2.,o.z-o.d/2.,o.x+o.w/2.,o.z+o.d/2.];assert!(!(a[0]<b[2]-0.001&&a[2]>b[0]+0.001&&a[1]<b[3]-0.001&&a[3]>b[1]+0.001),"{} overlaps {} in {}",seating,o.kind,c.layout);}}
 }}}
 let d=model::build(&{let mut c=Config::default();c.living_seating="Wraparound U sectional".into();c});assert_eq!(d["furniture"].as_array().unwrap().iter().filter(|f|s(f,"kind")=="sectional").count(),1,"the starter home fits a wraparound sectional");eprintln!("PLACED {}",placed);assert!(placed>10,"wide seating should fit in most living rooms, placed {}",placed);
}

#[test]
fn fireplace_and_builtin_media_walls_stay_on_solid_wall(){
 for media in ["Fireplace & TV","Built-in shelves & TV"]{for i in (0..30).step_by(3){
  let mut c=fixture();c.layout=s(&catalog()["layoutStyles"][i],"name").into();c.living_media=media.into();
  let m=model::build(&c);let rooms:Vec<Room>=serde_json::from_value(m["rooms"].clone()).unwrap();let ws:Vec<Wall>=serde_json::from_value(m["walls"].clone()).unwrap();let fs:Vec<staging::Furniture>=serde_json::from_value(m["furniture"].clone()).unwrap();
  for f in fs.iter().filter(|f|f.kind=="console"&&f.local_width>4.){let r=rooms.iter().find(|r|r.id==f.room_id).unwrap();assert!(f.x-f.w/2.>=r.x&&f.x+f.w/2.<=r.x+r.w&&f.z-f.d/2.>=r.z&&f.z+f.d/2.<=r.z+r.d);assert!(!crate::interior_design::glass_behind(f,&ws));assert!(edit::item_error(f,&c,&ws,&fs).is_none(),"{} in {}",media,c.layout);}
  let priced=m["items"].as_array().unwrap().iter().any(|i|["living-fireplace","living-builtins"].contains(&s(i,"id")));
  assert_eq!(priced,fs.iter().any(|f|f.kind=="console"&&!crate::interior_design::glass_behind(f,&ws)),"{} priced only on a solid wall in {}",media,c.layout);
 }}
}

#[test]
fn audit_regressions_stair_rails_and_metric_loads(){
 // Stair handrails follow the modeled flights: each rail is longer than the rise it climbs.
 let mut c=Config::default();c.stories=2;let m=model::build(&c);let rail=m["items"].as_array().unwrap().iter().find(|i|s(i,"id")=="stairrail").unwrap();
 let fh=n(&m,"floorHeight").max(c.wall_height+1.);assert!(n(rail,"net")>2.*fh/2.+16.,"rail {} for floor height {}",n(rail,"net"),fh);
 // 40 / 20 psf shown in kPa come back as the table loads, not 40.1 / 20.05.
 assert_eq!(crate::units::to_engine(&crate::units::num(40.*crate::units::PSF_KPA,2),"psf",Some(0.5)),"40");
 assert_eq!(crate::units::to_engine(&crate::units::num(20.*crate::units::PSF_KPA,2),"psf",Some(0.5)),"20");
}
#[test]fn steel_pier_beams_are_sized_to_span_and_load(){
 let mut c=Config::default();c.width=32.;c.depth=32.;c.stories=2;let l=piers::layout(&c);assert_eq!((l.lines,l.per_line,l.piers),(3,3,9),"a 32 × 32 ft house sits on a 3 × 3 pier grid");
 let(i,e)=piers::beams(&c,&l);assert_eq!(piers::SHAPES[i.shape].0,"W12×35");assert_eq!(piers::SHAPES[e.shape].0,"W10×22");
 for b in [&i,&e]{let x=piers::SHAPES[b.shape];assert!(x.6>=b.s_req&&x.7>=b.i_req);if b.shape>0{let lighter=piers::SHAPES[..b.shape].iter().all(|y|y.6<b.s_req||y.7<b.i_req);assert!(lighter,"the lightest passing shape is chosen");}}
 // Heavier houses need deeper beams at the same spacing; shorter spans need lighter ones.
 c.stories=1;let(i1,_)=piers::beams(&c,&piers::layout(&c));assert!(piers::SHAPES[i1.shape].1<piers::SHAPES[i.shape].1);
 let short=piers::size_beam(8.,16.,181.);assert!(piers::SHAPES[short.shape].1<piers::SHAPES[i.shape].1);
 let m=model::build(&{let mut c=Config::default();c.width=32.;c.depth=32.;c});assert_eq!(m["foundation"]["beamSizes"]["interior"]["name"],"W12×35");
 let mut old=Config::default();old.pier_beam=piers::LEGACY_STEEL.into();assert!(validate(&old).is_ok()&&piers::steel(&old));
}
#[test]fn lsl_studs_are_stronger_and_checked_against_floor_loads(){
 let(sawn,by)=structural::stud_capacity(structural::SAWN,8.09375);let(lsl,_)=structural::stud_capacity(structural::LSL,8.09375);
 assert_eq!(by,"bearing on the plates");assert!(lsl>sawn*1.7&&lsl<sawn*2.2,"LSL with LSL plates carries roughly twice the sawn stud: {} vs {}",lsl,sawn);
 let mut c=Config::default();let m=model::build(&c);let st=&m["structural"]["studs"];assert!(n(st,"demandLb")>0.&&n(st,"utilization")>0.);assert!(n(st,"bendingRatio")>1.9);
 c.floor_live_load=300.;c.floor_dead_load=200.;let heavy=model::build(&c);assert!(heavy["structural"]["issues"].as_array().unwrap().iter().any(|i|i.as_str().unwrap().contains("bearing studs")));
 c.stud_type="LSL studs".into();let lsl_m=model::build(&c);assert!(n(&lsl_m["structural"]["studs"],"utilization")<n(&heavy["structural"]["studs"],"utilization"));
 assert!(lsl_m["frameMembers"].as_array().map_or(true,|ms|ms.iter().filter(|m|s(m,"role").contains("plate")).all(|m|s(m,"material")=="LSL 2x6")));
}
#[test]fn house_shapes_add_wings_with_rooms_walls_roofs_and_pricing(){
 for stories in [1usize,2]{for(shape,count)in[("Rectangle",0),("L-shape",1),("T-shape",1),("U-shape",2)]{
  let mut c=Config::default();c.stories=stories;c.width=40.;c.depth=36.;c.shape=shape.into();c.rear_outdoor="Deck".into();c.wing_width=16.;c.wing_depth=18.;assert!(validate(&c).is_ok(),"{}",shape);
  let m=model::build(&c);let ground=if stories>=2{&m["levels"][0]}else{&m};assert_eq!(m["wings"].as_array().unwrap().len(),count,"{}",shape);
  let rooms=ground["rooms"].as_array().unwrap();let walls=ground["walls"].as_array().unwrap();let fs=ground["furniture"].as_array().unwrap();
  for g in m["wings"].as_array().unwrap(){
   let(x,z,w,d)=(n(g,"x"),n(g,"z"),n(g,"w"),n(g,"d"));assert_eq!(z,c.depth);if shape=="T-shape"{assert!(x>=0.&&x+w<=c.width);}else{assert!(x<0.||x+w>c.width,"{} reaches past a side wall",shape);assert!(walls.iter().any(|wl|s(wl,"id").starts_with("XF")&&s(wl,"id").ends_with(s(g,"id"))),"{} has a street-facing wall",shape);}assert!(near(w/2.,(w/2.).round())&&near(d/2.,(d/2.).round()));
   let inside:Vec<&Value>=rooms.iter().filter(|r|n(r,"x")>=x-1e-6&&n(r,"x")+n(r,"w")<=x+w+1e-6&&n(r,"z")>=z-1e-6).collect();assert!(!inside.is_empty());
   assert!(inside.iter().all(|r|fs.iter().any(|f|s(f,"roomId")==s(r,"id"))),"every wing room is furnished in {}",shape);
   for prefix in ["XL-","XR-","XB-"]{let wall=walls.iter().find(|wl|s(wl,"id")==format!("{}{}",prefix,s(g,"id"))).expect("wing wall");assert!(wall["exterior"]==true);assert!(wall["openings"].as_array().unwrap().iter().any(|o|s(o,"kind")=="window"),"{} has windows",prefix);}
   let rear=walls.iter().find(|wl|s(wl,"id")=="E2").unwrap();let inside_rear:Vec<&Value>=rear["openings"].as_array().unwrap().iter().filter(|o|n(o,"at")>=x.max(0.)&&n(o,"at")+n(o,"width")<=(x+w).min(c.width)).collect();
   assert_eq!(inside_rear.len(),1,"one way into the wing");assert!(s(inside_rear[0],"kind")!="window");
   assert!(n(&g["roof"],"area")>w*d&&n(&g["roof"],"rise")>0.);
   if let Some(rect)=m["rearOutdoor"]["rectangles"].get(0){assert!(n(rect,"x")+n(rect,"w")<=x+1e-6||n(rect,"x")>=x+w-1e-6,"the deck stays off the {} addition",shape);}
  }
  let items=m["items"].as_array().unwrap();let has=|id:&str|items.iter().any(|i|s(i,"id")==id);assert_eq!(has("wing-floor-panels"),count>0);assert_eq!(has("wing-piers"),count>0);
  if count>0{let mut r=c.clone();r.shape="Rectangle".into();let base=model::build(&r);assert!(n(&m,"subtotal")>n(&base,"subtotal"));assert!(n(&m["siteBounds"],"maxZ")>=c.depth+c.wing_depth);
   assert!(n(&m,"area")>n(&base,"area")+0.9*count as f64*16.*18.);}
 }}
 let mut c=Config::default();c.shape="Hexagon".into();assert!(validate(&c).is_err());c.shape="L-shape".into();c.wing_width=15.;assert!(validate(&c).is_err());c.wing_width=50.;assert!(validate(&c).is_err());
 // A U on a narrow house trims each wing so the rear wall stays open between them.
 c.wing_width=40.;c.width=30.;c.shape="U-shape".into();let ws=wings::rects(&c);assert_eq!(ws.len(),2);assert!(ws[0].x+ws[0].w+4.<=ws[1].x+1e-6);
 // Shapes work on a blank slate too: each wing is one empty room, entered through the rear wall.
 c.design_mode="Blank slate".into();c.width=40.;c.depth=36.;c.stories=1;c.wing_width=16.;c.shape="L-shape".into();c.garage="Attached".into();architecture::reset_edits(&mut c);assert!(validate(&c).is_ok());let m=model::build(&c);assert_eq!(m["wings"].as_array().unwrap().len(),1);assert!(m["rooms"].as_array().unwrap().iter().any(|r|s(r,"id")=="wing0-blank"));
 let g=&m["garage"];let w0=&m["wings"][0];assert!(n(g,"x")+24.<=n(w0,"x")+1e-6||n(g,"x")>=n(w0,"x")+n(w0,"w")-1e-6||n(g,"z")+24.<=n(w0,"z")+1e-6,"the garage stays clear of the wing");
}
#[test]fn first_visit_opens_on_a_colonial_with_an_attached_garage_and_six_percent_tax(){
 let c=generator::starter();assert_eq!(c.home_style,"Colonial");assert_eq!(c.garage,"Attached");assert_eq!(c.tax,6.);assert!(validate(&c).is_ok());
 let m=model::build(&c);assert!(m["garage"].is_object());assert!(generator::practical(&c,&m));
 for seed in 0..6{let next=generator::surprise(&c,100+seed,false).unwrap();assert_eq!(next.garage,"Attached");}
}
/// Wall-logic problems in one level: interior wall ends that stop short of another wall (gaps), walls that
/// overlap a collinear wall (duplicates), walls with the same room on both sides (extra walls), stubs, and
/// walls that run through the middle of a room.
fn wall_problems(level:&Value)->Vec<String>{
 let ws:Vec<Wall>=serde_json::from_value(level["walls"].clone()).unwrap();let rs:Vec<Room>=serde_json::from_value(level["rooms"].clone()).unwrap();let mut out=vec![];
 let end=|w:&Wall,t:f64|if w.axis=="x"{(w.x+t,w.z)}else{(w.x,w.z+t)};
 let touches=|p:(f64,f64),me:&Wall|ws.iter().any(|o|!std::ptr::eq(o,me)&&if o.axis=="x"{(o.z-p.1).abs()<0.35&&p.0>=o.x-0.35&&p.0<=o.x+o.length+0.35}else{(o.x-p.0).abs()<0.35&&p.1>=o.z-0.35&&p.1<=o.z+o.length+0.35});
 let room_at=|x:f64,z:f64|rs.iter().find(|r|x>r.x+1e-6&&x<r.x+r.w-1e-6&&z>r.z+1e-6&&z<r.z+r.d-1e-6).map(|r|r.id.clone());
 for w in &ws{
  if w.length<1.4&&!w.exterior{out.push(format!("stub {} {:.2} ft",w.id,w.length));}
  if !w.exterior{for t in [0.,w.length]{if !touches(end(w,t),w){out.push(format!("dangling end {} ({}) at {:?}",w.id,w.name,end(w,t)));}}}
  for o in &ws{if std::ptr::eq(o,w)||o.axis!=w.axis{continue}let same=if w.axis=="x"{(o.z-w.z).abs()<0.2}else{(o.x-w.x).abs()<0.2};if !same{continue}
   let(a0,a1,b0,b1)=if w.axis=="x"{(w.x,w.x+w.length,o.x,o.x+o.length)}else{(w.z,w.z+w.length,o.z,o.z+o.length)};if a1.min(b1)-a0.max(b0)>0.3&&w.id<o.id{out.push(format!("overlap {} / {} ({:.1} ft)",w.id,o.id,a1.min(b1)-a0.max(b0)));}}
  if !w.exterior&&w.length>=2.{let mid=w.length/2.;let(px,pz)=end(w,mid);let(l,r)=if w.axis=="x"{(room_at(px,pz-0.5),room_at(px,pz+0.5))}else{(room_at(px-0.5,pz),room_at(px+0.5,pz))};
   if l.is_some()&&l==r{out.push(format!("wall {} ({}) inside room {}",w.id,w.name,l.clone().unwrap()));}
   if l.is_none()&&r.is_none(){out.push(format!("wall {} ({}) touches no room",w.id,w.name));}}
 }
 for r in &rs{let area=r.w*r.d;let(short,long)=(r.w.min(r.d),r.w.max(r.d));let k=r.kind.as_str();let name=r.name.to_lowercase();
  let limit=if name.contains("powder"){Some(96.)}else if k=="bath"{Some(230.)}else if name.contains("pantry"){Some(90.)}else if k=="closet"||name.contains("closet")||name.contains("linen"){Some(70.)}else if k=="laundry"||name.contains("laundry"){Some(110.)}else{None};
  if let Some(max)=limit{if area>max+1e-6{out.push(format!("oversize {} {} {:.0}x{:.0}",r.id,r.name,r.w,r.d));}}
  if !["hall","stairs","blank"].contains(&k)&&!name.contains("gallery")&&!name.contains("landing")&&!name.contains("hall")&&long/short.max(0.1)>4.5&&area>40.{out.push(format!("sliver {} {} {:.0}x{:.0}",r.id,r.name,r.w,r.d));}
  if k=="bedroom"&&(area<70.||short<7.){out.push(format!("tiny-bedroom {} {:.0}x{:.0}",r.id,r.w,r.d));}
  if r.id.contains("-entry-return")&&short<3.{out.push(format!("scrap {} {:.0}x{:.0}",r.id,r.w,r.d));}}
 out}
#[test]#[ignore]fn wall_audit_report(){let styles:Vec<String>=catalog()["homeStyles"].as_array().unwrap().iter().map(|h|s(h,"name").to_string()).collect();let mut counts=BTreeMap::<String,usize>::new();let mut total=0;let mut bad=0;
 let mut check=|label:String,c:&Config|{let m=model::build(c);let levels:Vec<Value>=m["levels"].as_array().cloned().unwrap_or_else(||vec![m.clone()]);total+=1;let mut any=false;for(i,l)in levels.iter().enumerate(){for p in wall_problems(l){any=true;let key=p.split_whitespace().next().unwrap().to_string();*counts.entry(key).or_default()+=1;if std::env::var("AUDIT_VERBOSE").is_ok(){eprintln!("{} L{}: {}",label,i,p);}}}if any{bad+=1;}};
 for st in &styles{for stories in 1..=3usize{for beds in [2usize,3,4,5]{let mut c=Config::default();c.home_style=st.clone();c.stories=stories;c.bedrooms=beds;architecture::apply(&mut c,true);c.stories=stories;if c.stories>=2{c.depth=c.depth.max(architecture::minimum_depth(&c));}if validate(&c).is_err(){continue}check(format!("{} {}st {}bd {}x{}",st,stories,beds,c.width,c.depth),&c);}}}
 for seed in 0..60u32{if let Ok(c)=generator::surprise(&Config::default(),seed*313+11,false){check(format!("GEN{} {} {}st {}x{} {}",seed,c.home_style,c.stories,c.width,c.depth,c.shape),&c);}}
 for mode in ["Affordable","Premium"]{for seed in 0..30u32{if let Ok(c)=generator::generate(&Config::default(),mode,seed*97+5,false){check(format!("{}{} {} {}st {}x{}",mode,seed,c.home_style,c.stories,c.width,c.depth),&c);}}}
 eprintln!("AUDIT {} of {} designs have wall problems: {:?}",bad,total,counts);}
#[test]fn walls_meet_and_rooms_are_sized_for_their_use(){let styles:Vec<String>=catalog()["homeStyles"].as_array().unwrap().iter().map(|h|s(h,"name").to_string()).collect();let mut problems=vec![];
 let mut check=|label:String,c:&Config|{let m=model::build(c);for(i,l)in m["levels"].as_array().cloned().unwrap_or_else(||vec![m.clone()]).iter().enumerate(){for p in wall_problems(l){problems.push(format!("{} L{}: {}",label,i,p));}}};
 for st in &styles{for stories in 1..=3usize{for beds in [2usize,4]{let mut c=Config::default();c.home_style=st.clone();c.stories=stories;c.bedrooms=beds;architecture::apply(&mut c,true);c.stories=stories;if c.stories>=2{c.depth=c.depth.max(architecture::minimum_depth(&c));}if validate(&c).is_ok(){check(format!("{} {}st {}bd",st,stories,beds),&c);}}}}
 for seed in 0..16u32{if let Ok(c)=generator::surprise(&Config::default(),seed*313+11,false){check(format!("generated {} {}",seed,c.home_style),&c);}}
 assert!(problems.is_empty(),"{}",problems.join("\n"));}
/// A balcony over the rear deck hangs from the house on knee-braced brackets: no post stands on the deck
/// or pierces it.
#[test]fn balcony_over_a_deck_hangs_on_brackets(){let mut c=generator::starter();c.balcony="Rear balcony".into();c.rear_outdoor="Deck".into();c.rear_width=20.;c.rear_depth=10.;assert!(validate(&c).is_ok());let m=model::build(&c);
 let b=&m["balcony"];assert!(b.is_object()&&m["rearOutdoor"].is_object());assert!(b["posts"].as_array().unwrap().is_empty());let brackets=b["brackets"].as_array().unwrap();assert!(brackets.len()>=2);
 for k in brackets{assert!(n(&k["a"],"1")<n(&k["b"],"1")||k["a"][1].as_f64().unwrap()<k["b"][1].as_f64().unwrap());assert!(k["b"][1].as_f64().unwrap()<=n(b,"deckY"));}
 assert!(m["items"].as_array().unwrap().iter().any(|i|s(i,"id")=="balcony-brackets"&&n(i,"qty")>=2.));}
#[test]fn three_car_garage_widens_and_adds_a_single_door(){let mut c=generator::starter();c.garage="Attached".into();let two=model::build(&c);c.garage_size="Three-car".into();assert!(validate(&c).is_ok());let three=model::build(&c);
 let(g2,g3)=(&two["garage"],&three["garage"]);assert_eq!(n(g2,"w"),24.);assert_eq!(n(g3,"w"),34.);assert_eq!(n(g3,"area"),816.);assert_eq!(n(g3,"cars"),3.);
 assert!(g3["openings"].as_array().unwrap().iter().any(|o|s(o,"id")=="G-OVERHEAD-2"&&n(o,"width")==9.));for w in serde_json::from_value::<Vec<Wall>>(g3["walls"].clone()).unwrap(){assert!(model::valid_openings(&w.openings,w.length,n(g3,"h")),"{}",w.id);}
 assert!(n(&three,"total")>n(&two,"total"));assert!(three["items"].as_array().unwrap().iter().any(|i|s(i,"id")=="garage-overheaddoor-single"));}
#[test]fn front_porch_options_change_the_porch(){let mut c=generator::starter();let mut forms=std::collections::BTreeSet::new();for f in crate::porch::FORMS{c.front_porch=f.into();assert!(validate(&c).is_ok());let m=model::build(&c);let p=&m["porch"];
 let key=if p.is_null(){"none".to_string()}else{format!("{} {:.0}",s(p,"form"),p["rectangles"].as_array().unwrap().iter().map(|r|n(r,"w")*n(r,"d")).sum::<f64>())};if f=="None"{assert!(p.is_null());}forms.insert(key);}
 assert_eq!(forms.len(),crate::porch::FORMS.len(),"each porch option looks different: {:?}",forms);}

/// Furniture problems in one level: pieces that overlap, pieces standing in another piece's working space
/// (the aisle in front of counters, a bed's foot, the pull-out ring round a dining table), and refrigerators
/// stranded away from the kitchen counters (further than a galley aisle).
fn furniture_problems(level:&Value)->Vec<String>{
 let fs:Vec<staging::Furniture>=serde_json::from_value(level["furniture"].clone()).unwrap_or_default();let mut out=vec![];
 let body=|f:&staging::Furniture|[f.x-f.w/2.,f.z-f.d/2.,f.x+f.w/2.,f.z+f.d/2.];let hit=|a:[f64;4],b:[f64;4]|a[0]<b[2]-0.05&&a[2]>b[0]+0.05&&a[1]<b[3]-0.05&&a[3]>b[1]+0.05;
 for(i,a)in fs.iter().enumerate(){for b in &fs[i+1..]{if a.room_id==b.room_id&&hit(body(a),body(b))&&!staging::may_share(a,b)&&!staging::may_share(b,a){out.push(format!("overlap {} / {}",a.id,b.id));}}
  for b in &fs{if std::ptr::eq(a,b)||a.room_id!=b.room_id{continue}if let Some(z)=staging::work_zone(b){if hit(body(a),z)&&!staging::may_share(a,b){out.push(format!("in-front {} in {}'s work space",a.id,b.kind));}}}}
 for f in fs.iter().filter(|f|f.kind=="fridge"){if let Some(run)=fs.iter().find(|q|q.room_id==f.room_id&&q.kind=="kitchen"){let(a,b)=(body(f),body(run));let gap=(a[0]-b[2]).max(b[0]-a[2]).max(a[1]-b[3]).max(b[1]-a[3]);if gap>4.{out.push(format!("stranded fridge {} {:.1} ft from the counters",f.id,gap));}}}
 out}
#[test]#[ignore]fn furniture_audit_report(){let styles:Vec<String>=catalog()["homeStyles"].as_array().unwrap().iter().map(|h|s(h,"name").to_string()).collect();let mut counts=BTreeMap::<String,usize>::new();let mut total=0;let mut bad=0;
 let mut check=|label:String,c:&Config|{let m=model::build(c);let levels:Vec<Value>=m["levels"].as_array().cloned().unwrap_or_else(||vec![m.clone()]);total+=1;let mut any=false;for(i,l)in levels.iter().enumerate(){for p in furniture_problems(l){any=true;let key=p.split_whitespace().next().unwrap().to_string();*counts.entry(key).or_default()+=1;if std::env::var("AUDIT_VERBOSE").is_ok(){eprintln!("{} L{}: {}",label,i,p);}}}if any{bad+=1;}};
 for st in &styles{for stories in 1..=2usize{for beds in [2usize,3,4]{let mut c=Config::default();c.home_style=st.clone();c.stories=stories;c.bedrooms=beds;architecture::apply(&mut c,true);c.stories=stories;if c.stories>=2{c.depth=c.depth.max(architecture::minimum_depth(&c));}if validate(&c).is_err(){continue}check(format!("{} {}st {}bd",st,stories,beds),&c);}}}
 for seed in 0..40u32{if let Ok(c)=generator::surprise(&Config::default(),seed*313+11,false){check(format!("GEN{} {} {}st",seed,c.home_style,c.stories),&c);}}
 eprintln!("FURNITURE {} of {} designs have problems: {:?}",bad,total,counts);}
#[test]fn furniture_keeps_its_working_space(){for st in catalog()["homeStyles"].as_array().unwrap().iter().map(|h|s(h,"name").to_string()){for stories in 1..=2usize{let mut c=Config::default();c.home_style=st.clone();c.stories=stories;c.bedrooms=3;architecture::apply(&mut c,true);c.stories=stories;if stories>=2{c.depth=c.depth.max(architecture::minimum_depth(&c));}if validate(&c).is_err(){continue}let m=model::build(&c);
 for l in m["levels"].as_array().cloned().unwrap_or_else(||vec![m.clone()]){let p=furniture_problems(&l);assert!(p.is_empty(),"{} {} storeys: {:?}",st,stories,p);}}}}
#[test]fn medium_and_large_windows_open_every_style_up(){for st in catalog()["homeStyles"].as_array().unwrap().iter().map(|h|s(h,"name").to_string()){let glass=|size:&str|{let mut c=Config::default();c.home_style=st.clone();architecture::apply(&mut c,true);c.window_size=size.into();let m=model::build(&c);assert!(m["openingChecks"]["allHeightGuardrailsPass"]==true,"{} {}: {:?}",st,size,m["openingChecks"]["issues"]);m["windowSchedule"].as_array().unwrap().iter().map(|w|n(w,"width")*n(w,"height")).sum::<f64>()};
 let(base,medium,large)=(glass("Style matched"),glass("Medium"),glass("Large"));assert!(base<medium&&medium<large,"{}: {} / {} / {}",st,base,medium,large);}}
/// Street fronts follow the catalog house: symmetric styles mirror their windows about the front door.
#[test]fn symmetric_fronts_mirror_about_the_door(){for st in ["Georgian","Colonial","French country","Coastal"]{let mut c=Config::default();c.home_style=st.into();architecture::apply(&mut c,true);let m=model::build(&c);let l=&m["levels"][0];let front=l["walls"].as_array().unwrap().iter().find(|w|s(w,"id")=="E1").unwrap();let os=front["openings"].as_array().unwrap();let door=os.iter().find(|o|s(o,"kind")=="door").unwrap();let axis=n(door,"at")+n(door,"width")/2.;let ws:Vec<(f64,f64)>=os.iter().filter(|o|s(o,"kind")=="window").map(|o|(n(o,"at")+n(o,"width")/2.,n(o,"width"))).collect();assert!(ws.len()>=4,"{} has a full front: {:?}",st,ws);
 for(x,w)in &ws{assert!(ws.iter().any(|(y,v)|(axis-x-(y-axis)).abs()<0.05&&(w-v).abs()<0.05),"{}: window at {:.2} has no mirror about the door at {:.2}",st,x,axis);}}}
#[test]#[ignore]fn bug_sweep(){let mut seen=BTreeMap::<String,usize>::new();
 for seed in 0..60u32{let Ok(base)=generator::surprise(&Config::default(),seed*977+5,false)else{continue};for size in ["Style matched","Medium","Large"]{for h in [8.,9.]{let mut c=base.clone();c.window_size=size.into();c.wall_height=h;if validate(&c).is_err(){*seen.entry("invalid config".into()).or_default()+=1;continue}let m=model::build(&c);
  let tag=format!("{} {}st {} {}ft",c.home_style,c.stories,size,h);
  if m["openingChecks"]["allHeightGuardrailsPass"]!=true{let k=format!("guardrail: {:?}",m["openingChecks"]["issues"][0]);if !seen.contains_key(&k){eprintln!("{} -> {}",tag,k);}*seen.entry(k).or_default()+=1;}
  for(i,l)in m["levels"].as_array().cloned().unwrap_or_else(||vec![m.clone()]).iter().enumerate(){let mut cc=c.clone();cc.active_floor=i;let ws:Vec<Wall>=serde_json::from_value(l["walls"].clone()).unwrap();let rs:Vec<Room>=serde_json::from_value(l["rooms"].clone()).unwrap();
   for w in &ws{if let Some(e)=rules::opening_error(&w.openings,w,&cc,&rs){let k=format!("opening_error {}",&e[..e.len().min(60)]);if !seen.contains_key(&k){eprintln!("{} L{} {} -> {}",tag,i,w.id,e);}*seen.entry(k).or_default()+=1;}}
   for p in furniture_problems(l){let k=p.split_whitespace().next().unwrap().to_string();if std::env::var("AUDIT_VERBOSE").is_ok()||!seen.contains_key(&k){eprintln!("{} L{} -> {}",tag,i,p);}*seen.entry(k).or_default()+=1;}
   for r in rs.iter().filter(|r|r.kind=="bedroom"){let has=ws.iter().filter(|w|w.exterior).any(|w|w.openings.iter().any(|o|o.kind=="window"&&{let along=w.axis=="x";let s=if along{w.x}else{w.z}+o.at;let(lo,hi)=if along{(r.x,r.x+r.w)}else{(r.z,r.z+r.d)};let line=if along{w.z}else{w.x};let touch=if along{near(line,r.z)||near(line,r.z+r.d)}else{near(line,r.x)||near(line,r.x+r.w)};touch&&s>=lo&&s+o.width<=hi}));if !has{let k="bedroom without window".to_string();if !seen.contains_key(&k){eprintln!("{} L{} -> {} {}",tag,i,k,r.name);}*seen.entry(k).or_default()+=1;}}
  }}}}
 eprintln!("SWEEP {:?}",seen);}
#[test]#[ignore]fn bug_sweep_sizes(){let mut seen=BTreeMap::<String,usize>::new();for st in catalog()["homeStyles"].as_array().unwrap().iter().map(|h|s(h,"name").to_string()){for(w,d)in[(16.,20.),(24.,24.),(30.,40.),(60.,36.),(80.,48.)]{for stories in 1..=3usize{for size in ["Style matched","Large"]{for h in [8.,10.]{let mut c=Config::default();c.home_style=st.clone();architecture::apply(&mut c,true);c.width=w;c.depth=d;c.stories=stories;c.window_size=size.into();c.wall_height=h;if stories>=2{c.depth=c.depth.max(architecture::minimum_depth(&c));}if validate(&c).is_err(){continue}
 let r=std::panic::catch_unwind(||model::build(&c));let Ok(m)=r else{let k=format!("PANIC {} {}x{} {}st",st,w,d,stories);eprintln!("{}",k);*seen.entry("panic".into()).or_default()+=1;continue};
 if m["openingChecks"]["allHeightGuardrailsPass"]!=true{let k=format!("guardrail {} {}x{} {}st {} {}ft: {}",st,w,d,stories,size,h,m["openingChecks"]["issues"][0]);if seen.get("guardrail").copied().unwrap_or(0)<6{eprintln!("{}",k);}*seen.entry("guardrail".into()).or_default()+=1;}
 for(i,l)in m["levels"].as_array().cloned().unwrap_or_else(||vec![m.clone()]).iter().enumerate(){let mut cc=c.clone();cc.active_floor=i;let ws:Vec<Wall>=serde_json::from_value(l["walls"].clone()).unwrap();let rs:Vec<Room>=serde_json::from_value(l["rooms"].clone()).unwrap();for wl in &ws{if let Some(e)=rules::opening_error(&wl.openings,wl,&cc,&rs){if seen.get("opening").copied().unwrap_or(0)<6{eprintln!("opening {} {}x{} {}st {} {}ft L{} {}: {} {:?}",st,w,d,stories,size,h,i,wl.id,&e[..e.len().min(70)],wl.openings.iter().map(|o|format!("{}@{:.1}+{:.1} b{:.2} h{:.2}",&o.kind[..1],o.at,o.width,o.bottom,o.height)).collect::<Vec<_>>());}*seen.entry("opening".into()).or_default()+=1;}}}
 }}}}}eprintln!("SIZES {:?}",seen);}
/// Ganged windows (a Craftsman ribbon, a Tudor casement band) frame with one shared king stud per mullion,
/// so no two studs in a wall occupy the same space.
#[test]fn ganged_windows_share_king_studs(){for st in ["Craftsman","Tudor","Mid-century","Coastal"]{let mut c=Config::default();c.home_style=st.into();architecture::apply(&mut c,true);let m=model::build(&c);let l=if m["levels"].is_array(){&m["levels"][0]}else{&m};let ws:Vec<Wall>=serde_json::from_value(l["walls"].clone()).unwrap();let front=ws.iter().find(|w|w.id=="E1").unwrap();
 let os=&front.openings;assert!(os.windows(2).any(|p|p[1].at-(p[0].at+p[0].width)<0.5),"{} has a ganged group",st);
 let ms=frame::build(&ws,&c);let studs:Vec<&frame::Member>=ms.iter().filter(|v|v.wall_id=="E1"&&["King","Jack","Common"].contains(&v.role.as_str())).collect();
 for(i,a)in studs.iter().enumerate(){for b in &studs[i+1..]{let(pa,pb)=(a.x1,b.x1);let overlap=(pa-pb).abs()<0.125-1e-6;let vertical=a.y1.min(a.y2)<b.y1.max(b.y2)-1e-6&&b.y1.min(b.y2)<a.y1.max(a.y2)-1e-6;assert!(!(overlap&&vertical),"{}: {} and {} studs overlap at x {:.3} / {:.3}",st,a.role,b.role,pa,pb);}}}}
/// Every style and window size keeps valid, non-overlapping openings on 8 ft walls, and the attached garage
/// never takes away a bedroom's only daylight.
#[test]fn windows_fit_and_bedrooms_keep_daylight(){for st in catalog()["homeStyles"].as_array().unwrap().iter().map(|h|s(h,"name").to_string()){for stories in [1usize,2]{for size in ["Medium","Large"]{let mut c=Config::default();c.home_style=st.clone();architecture::apply(&mut c,true);c.stories=stories;c.window_size=size.into();c.wall_height=8.;if stories>=2{c.depth=c.depth.max(architecture::minimum_depth(&c));}if validate(&c).is_err(){continue}let m=model::build(&c);
 for l in m["levels"].as_array().cloned().unwrap_or_else(||vec![m.clone()]){let ws:Vec<Wall>=serde_json::from_value(l["walls"].clone()).unwrap();for w in &ws{assert!(model::valid_openings(&w.openings,w.length,8.),"{} {}st {}: {} openings invalid",st,stories,size,w.id);}
  for r in serde_json::from_value::<Vec<Room>>(l["rooms"].clone()).unwrap().iter().filter(|r|r.kind=="bedroom"){assert!(ws.iter().filter(|w|w.exterior).any(|w|{let along=w.axis=="x";let line=if along{w.z}else{w.x};let touch=if along{near(line,r.z)||near(line,r.z+r.d)}else{near(line,r.x)||near(line,r.x+r.w)};let(lo,hi)=if along{(r.x,r.x+r.w)}else{(r.z,r.z+r.d)};let s0=if along{w.x}else{w.z};touch&&w.openings.iter().any(|o|o.kind=="window"&&s0+o.at>=lo&&s0+o.at+o.width<=hi)}),"{} {}st {}: {} has no window",st,stories,size,r.name);}}}}}}
/// Formal catalog homes (Colonial, Georgian, French country, Coastal) give the living room the front of the
/// west hall, so it is a real room rather than a 10 ft strip.
#[test]fn formal_living_rooms_are_wide(){for st in ["Colonial","Georgian","French country","Coastal"]{let mut c=generator::starter();c.home_style=st.into();c.stories=2;architecture::apply(&mut c,true);let m=model::build(&c);let l=&m["levels"][0];let living=l["rooms"].as_array().unwrap().iter().find(|r|s(r,"type")=="living").unwrap();assert!(n(living,"w")>=14.,"{} living room is {} ft wide",st,n(living,"w"));}}
#[test]#[ignore]fn combo_sweep(){let mut seen=BTreeMap::<String,usize>::new();let mut note=|k:String,detail:String|{if !seen.contains_key(&k){eprintln!("{} :: {}",k,detail);}*seen.entry(k).or_default()+=1;};
 let rect=|v:&Value|[n(v,"x"),n(v,"z"),n(v,"x")+n(v,"w"),n(v,"z")+n(v,"d")];let hit=|a:[f64;4],b:[f64;4]|a[0]<b[2]-0.05&&a[2]>b[0]+0.05&&a[1]<b[3]-0.05&&a[3]>b[1]+0.05;
 let styles:Vec<String>=catalog()["homeStyles"].as_array().unwrap().iter().map(|h|s(h,"name").to_string()).collect();let mut i=0u32;
 for st in &styles{for porch in crate::porch::FORMS{for(garage,size,side)in[("Attached","Two-car","Automatic"),("Attached","Three-car","Left"),("Attached","Three-car","Right"),("Detached","Three-car","Automatic"),("None","Two-car","Automatic")]{i+=1;
  let mut c=Config::default();c.home_style=st.clone();architecture::apply(&mut c,true);c.front_porch=porch.into();c.garage=garage.into();c.garage_size=size.into();c.garage_side=side.into();c.shape=["Rectangle","L-shape","T-shape","U-shape"][(i%4)as usize].into();c.balcony=["Style matched","Rear balcony","None"][(i%3)as usize].into();c.rear_outdoor=["Style matched","Deck","Covered porch","None"][(i%4)as usize].into();c.stories=1+(i%3)as usize;if c.stories>=2{c.depth=c.depth.max(architecture::minimum_depth(&c));}
  let tag=format!("{} {} {} {} {} {} {}st",st,porch,garage,size,side,c.shape,c.stories);
  if let Err(e)=validate(&c){note(format!("invalid: {}",e),tag);continue}
  let Ok(m)=std::panic::catch_unwind(||model::build(&c))else{note("PANIC".into(),tag);continue};
  let g=&m["garage"];let wings:Vec<[f64;4]>=crate::wings::rects(&c).iter().map(|r|[r.x,r.z,r.x+r.w,r.z+r.d]).collect();
  let house=[0.,0.,c.width,c.depth];
  let porch_rects:Vec<[f64;4]>=m["porch"]["rectangles"].as_array().cloned().unwrap_or_default().iter().map(rect).collect();
  let rear_rects:Vec<[f64;4]>=m["rearOutdoor"]["rectangles"].as_array().cloned().unwrap_or_default().iter().map(rect).collect();
  if g.is_object(){let gr=rect(g);if hit(gr,house){note("garage overlaps house".into(),tag.clone());}for w in &wings{if hit(gr,*w){note("garage overlaps wing".into(),tag.clone());}}for p in porch_rects.iter().chain(&rear_rects){if hit(gr,*p){note("garage overlaps porch/deck".into(),format!("{} g{:?} p{:?}",tag,gr,p));}}
   for w in serde_json::from_value::<Vec<Wall>>(g["walls"].clone()).unwrap(){if !model::valid_openings(&w.openings,w.length,n(g,"h")){note("garage openings invalid".into(),tag.clone());}}}
  for p in porch_rects.iter().chain(&rear_rects){if hit(*p,house){note("porch/deck inside house".into(),format!("{} {:?}",tag,p));}for w in &wings{if hit(*p,*w){note("porch/deck overlaps wing".into(),format!("{} {:?} {:?}",tag,p,w));}}}
  for p in &porch_rects{for r in &rear_rects{if hit(*p,*r){note("front porch overlaps rear deck".into(),tag.clone());}}}
  let b=&m["balcony"];if b.is_object(){let br=rect(b);for w in &wings{if hit(br,*w){note("balcony overlaps wing".into(),tag.clone());}}if g.is_object()&&hit(br,rect(g)){note("balcony over garage".into(),tag.clone());}}
  for(li,l)in m["levels"].as_array().cloned().unwrap_or_else(||vec![m.clone()]).iter().enumerate(){for w in serde_json::from_value::<Vec<Wall>>(l["walls"].clone()).unwrap(){if !model::valid_openings(&w.openings,w.length,c.wall_height){note("house openings invalid".into(),format!("{} L{} {}",tag,li,w.id));}}
   for p in furniture_problems(l).into_iter().filter(|p|!p.starts_with("stranded")){note(format!("furniture {}",p.split_whitespace().next().unwrap()),format!("{} L{}: {}",tag,li,p));}}
  if m["openingChecks"]["allHeightGuardrailsPass"]!=true{note("guardrail".into(),format!("{} {}",tag,m["openingChecks"]["issues"][0]));}
  let sb=&m["siteBounds"];if g.is_object()&&sb.is_object(){let gr=rect(g);if gr[0]<n(sb,"minX")-0.01||gr[2]>n(sb,"maxX")+0.01{note("site bounds miss garage".into(),tag.clone());}}
 }}}eprintln!("COMBO {} designs: {:?}",i,seen);}
/// A chosen wraparound veranda wraps the side the attached garage is not on, wherever the garage lands.
#[test]fn wraparound_veranda_wraps_away_from_the_garage(){for side in ["Automatic","Left","Right"]{let mut c=generator::starter();c.garage="Attached".into();c.garage_side=side.into();c.front_porch="Wraparound veranda".into();let m=model::build(&c);let p=&m["porch"];let rs=p["rectangles"].as_array().unwrap();assert_eq!(rs.len(),2,"{} garage: the veranda wraps a side",side);let g=&m["garage"];let wrap=&rs[1];let on_left=n(wrap,"x")<0.;assert_ne!(on_left,n(g,"x")<0.,"{} garage: wrap is opposite the garage",side);}}
#[test]fn rear_balcony_avoids_wings(){for shape in ["L-shape","T-shape","U-shape"]{let mut c=generator::starter();c.shape=shape.into();c.balcony="Rear balcony".into();let m=model::build(&c);if let Some(b)=m["balcony"].as_object(){let(bx,bw)=(b["x"].as_f64().unwrap(),b["w"].as_f64().unwrap());for g in crate::wings::rects(&c).iter().filter(|g|g.z+g.d>c.depth+1e-6){assert!(bx+bw<=g.x+1e-6||bx>=g.x+g.w-1e-6,"{}: balcony inside a rear wing",shape);}}}}
#[test]#[ignore]fn money_sweep(){let mut seen=BTreeMap::<String,usize>::new();let mut note=|k:String,d:String|{if !seen.contains_key(&k){eprintln!("{} :: {}",k,d);}*seen.entry(k).or_default()+=1;};
 fn bad_numbers(v:&Value,path:&str,out:&mut Vec<String>){match v{Value::Number(x)=>{if !x.as_f64().is_some_and(f64::is_finite){out.push(path.into())}},Value::Array(a)=>for(i,x)in a.iter().enumerate(){bad_numbers(x,&format!("{}[{}]",path,i),out)},Value::Object(o)=>for(k,x)in o{bad_numbers(x,&format!("{}.{}",path,k),out)},Value::Null=>{},_=>{}}}
 let styles:Vec<String>=catalog()["homeStyles"].as_array().unwrap().iter().map(|h|s(h,"name").to_string()).collect();let mut i=0u32;
 for st in &styles{for porch in crate::porch::FORMS{for(garage,size)in[("Attached","Two-car"),("Attached","Three-car"),("Detached","Three-car"),("None","Two-car")]{i+=1;
  let mut c=Config::default();c.home_style=st.clone();architecture::apply(&mut c,true);c.front_porch=porch.into();c.garage=garage.into();c.garage_size=size.into();c.shape=["Rectangle","L-shape","T-shape","U-shape"][(i%4)as usize].into();c.balcony=["Style matched","Rear balcony","None"][(i%3)as usize].into();c.rear_outdoor=["Style matched","Deck","Covered porch","None"][(i%4)as usize].into();c.stories=1+(i%3)as usize;c.window_size=["Style matched","Medium","Large"][(i%3)as usize].into();if c.stories>=2{c.depth=c.depth.max(architecture::minimum_depth(&c));}if i%5==0{c.design_mode="Blank slate".into();}
  let tag=format!("{} {} {} {} {} {}st {}",st,porch,garage,size,c.shape,c.stories,c.design_mode);if validate(&c).is_err(){continue}
  let m=model::build(&c);let mut bad=vec![];bad_numbers(&m,"m",&mut bad);if let Some(p)=bad.first(){note("non-finite number".into(),format!("{} at {} (+{} more)",tag,p,bad.len()-1));}
  let items=m["items"].as_array().unwrap();let mut ids=std::collections::BTreeSet::new();let mut cats=BTreeMap::<String,f64>::new();
  for it in items{let id=s(it,"id").to_string();if !ids.insert(id.clone()){note("duplicate item id".into(),format!("{} {}",tag,id));}if n(it,"qty")<0.||n(it,"price")<0.{note("negative qty/price".into(),format!("{} {}",tag,id));}if (n(it,"total")-round(n(it,"qty")*n(it,"price"))).abs()>0.011{note("item total != qty*price".into(),format!("{} {}",tag,id));}*cats.entry(s(it,"category").into()).or_default()+=n(it,"total");}
  let sum:f64=items.iter().map(|i|n(i,"total")).sum::<f64>()-n(&m,"furnishingsTotal");if (sum-n(&m,"subtotal")).abs()>0.05{note("subtotal mismatch".into(),format!("{} sum {} subtotal {}",tag,sum,n(&m,"subtotal")));}
  for(k,v)in &cats{if (n(&m["categoryTotals"],k)-v).abs()>0.05{note("category total mismatch".into(),format!("{} {} {} vs {}",tag,k,v,n(&m["categoryTotals"],k)));}}
  if (n(&m,"tax")-round(n(&m,"subtotal")*c.tax/100.)).abs()>0.011{note("tax mismatch".into(),tag.clone());}
  if (n(&m,"total")-round(n(&m,"subtotal")+n(&m,"tax"))).abs()>0.011{note("total mismatch".into(),tag.clone());}
  let back:Config=serde_json::from_value(serde_json::to_value(&c).unwrap()).unwrap();if model::build(&back)!=m{note("non-deterministic / roundtrip".into(),tag.clone());}
 }}}eprintln!("MONEY {} designs: {:?}",i,seen);}
/// In an empty shell a chosen porch appears once the front wall has a door, and not before.
#[test]fn blank_slate_porch_follows_the_front_door(){let mut c=Config::default();c.design_mode="Blank slate".into();c.stories=1;c.width=32.;c.depth=32.;c.garage="None".into();c.front_porch="Full-width veranda".into();assert!(validate(&c).is_ok());
 let bare=model::build(&c);let front=bare["walls"].as_array().unwrap().iter().find(|w|s(w,"id")=="E1").unwrap().clone();let has_door=front["openings"].as_array().unwrap().iter().any(|o|s(o,"kind")=="door");
 if !has_door{assert!(bare["porch"].is_null());c.opening_overrides.insert("E1".into(),vec![Opening{id:"U1".into(),kind:"door".into(),at:14.,width:38./12.,bottom:0.,height:82.5/12.}]);}
 let m=model::build(&c);assert!(m["porch"].is_object(),"porch appears at the front door");assert_eq!(s(&m["porch"],"form"),"Full-width front veranda");
 c.front_porch="Style matched".into();assert!(model::build(&c)["porch"].is_null(),"the empty shell has no catalog porch");}
#[test]fn generated_homes_reset_the_front_porch(){let mut c=generator::starter();c.front_porch="None".into();for seed in 0..6u32{let g=generator::surprise(&c,seed*101+7,false).unwrap();assert_eq!(g.front_porch,"Style matched");assert!(g.garage_size=="Two-car"||g.design_mode=="Premium");}}
/// Every upper-floor balcony door opens onto a modeled balcony or gallery, whatever porch is chosen.
#[test]fn balcony_doors_always_open_onto_a_balcony(){for st in ["Colonial","Victorian","French country","Coastal"]{for porch in crate::porch::FORMS{for garage in ["None","Attached"]{let mut c=generator::starter();c.home_style=st.into();architecture::apply(&mut c,true);c.stories=2;c.depth=c.depth.max(architecture::minimum_depth(&c));c.garage=garage.into();c.front_porch=porch.into();let m=model::build(&c);
 let door=m["levels"][1]["walls"].as_array().unwrap().iter().any(|w|w["openings"].as_array().unwrap().iter().any(|o|s(o,"id")=="BALCONY-DOOR-L2"));
 let gallery=m["porch"]["rectangles"].as_array().is_some_and(|rs|rs.iter().any(|r|r["deckYs"].as_array().unwrap().len()==2));assert!(!door||m["balcony"].is_object()||gallery,"{} {} {}: upper balcony door opens onto nothing",st,porch,garage);}}}}
#[test]#[ignore]fn reconcile_sweep(){let mut seen=BTreeMap::<String,usize>::new();let mut note=|k:String,d:String|{if !seen.contains_key(&k){eprintln!("{} :: {}",k,d);}*seen.entry(k).or_default()+=1;};
 let styles:Vec<String>=catalog()["homeStyles"].as_array().unwrap().iter().map(|h|s(h,"name").to_string()).collect();let mut i=0u32;
 for st in &styles{for porch in crate::porch::FORMS{for size in ["Two-car","Three-car"]{i+=1;
  let mut c=Config::default();c.home_style=st.clone();architecture::apply(&mut c,true);c.front_porch=porch.into();c.garage=["Attached","Detached","None"][(i%3)as usize].into();c.garage_size=size.into();c.shape=["Rectangle","L-shape","T-shape","U-shape"][(i%4)as usize].into();c.balcony=["Style matched","Rear balcony","None"][(i%3)as usize].into();c.rear_outdoor=["Style matched","Deck","Covered porch","None"][(i%4)as usize].into();c.stories=1+(i%3)as usize;if c.stories>=2{c.depth=c.depth.max(architecture::minimum_depth(&c));}
  let tag=format!("{} {} {} {} {}st",st,porch,size,c.shape,c.stories);if validate(&c).is_err(){continue}let m=model::build(&c);
  let item=|id:&str|m["items"].as_array().unwrap().iter().find(|i|s(i,"id")==id).cloned();let raw=|id:&str|item(id).map(|i|n(&i,"rawNet"));
  let levels=m["levels"].as_array().cloned().unwrap_or_else(||vec![m.clone()]);
  let walls:Vec<Wall>=levels.iter().flat_map(|l|serde_json::from_value::<Vec<Wall>>(l["walls"].clone()).unwrap()).collect();
  let windows=walls.iter().flat_map(|w|&w.openings).filter(|o|o.kind=="window").count()as f64;
  if raw("windowscreens").is_some_and(|v|!near(v,windows)){note("window screens != windows".into(),format!("{} {} vs {}",tag,raw("windowscreens").unwrap(),windows));}
  let priced:f64=m["items"].as_array().unwrap().iter().filter(|i|s(i,"id").starts_with("windows-")).map(|i|n(i,"rawNet")).sum();let ext_windows=walls.iter().filter(|w|w.exterior).flat_map(|w|&w.openings).filter(|o|o.kind=="window").count()as f64;
  if !near(priced,ext_windows){note("priced windows != exterior windows".into(),format!("{} {} vs {}",tag,priced,ext_windows));}
  let ext_doors=walls.iter().filter(|w|w.exterior).flat_map(|w|&w.openings).filter(|o|o.kind=="door").count()as f64;if raw("extdoor").is_some_and(|v|!near(v,ext_doors)){note("extdoor != exterior doors".into(),format!("{} {} vs {}",tag,raw("extdoor").unwrap(),ext_doors));}
  let int_doors=walls.iter().filter(|w|!w.exterior).flat_map(|w|&w.openings).filter(|o|o.kind=="door").count()as f64;if raw("intdoor").is_some_and(|v|!near(v,int_doors)){note("intdoor != interior doors".into(),format!("{} {} vs {}",tag,raw("intdoor").unwrap(),int_doors));}
  let fs:Vec<staging::Furniture>=levels.iter().flat_map(|l|serde_json::from_value::<Vec<staging::Furniture>>(l["furniture"].clone()).unwrap_or_default()).collect();let lf:f64=fs.iter().filter(|f|f.kind=="kitchen"||f.kind=="counter-run").map(|f|f.local_width).sum();let island:f64=fs.iter().filter(|f|f.kind=="island").map(|f|f.local_width).sum();
  if raw("cabinets").is_some_and(|v|!near(v,lf+island)){note("cabinets != counter lf".into(),format!("{} {} vs {}",tag,raw("cabinets").unwrap(),lf));}
  if lf<10.&&c.home_style!="Mid-century"{note("short kitchen".into(),format!("{} {} lf",tag,lf));}
  for(key,id)in[("porch","porch-columns"),("rearOutdoor","rear-posts"),("balcony","balcony-posts")]{if m[key].is_object()&&!(key=="balcony"&&m[key]["existingGallery"]==true){let posts=m[key]["posts"].as_array().map(|p|p.len()).unwrap_or(0)as f64;if !raw(id).is_some_and(|v|near(v,posts)){note(format!("{} != posts",id),format!("{} {:?} vs {}",tag,raw(id),posts));}}}
  if m["balcony"].is_object()&&m["balcony"]["existingGallery"]!=true{let b=m["balcony"]["brackets"].as_array().map(|p|p.len()).unwrap_or(0)as f64;if !raw("balcony-brackets").is_some_and(|v|near(v,b)){note("balcony-brackets != brackets".into(),tag.clone());}}
  // Roof: the 3D facets' true (sloped) areas add up to the area the roofing is bought for.
  let poly3=|pts:&Vec<Value>|->f64{let p:Vec<[f64;3]>=pts.iter().map(|q|[q[0].as_f64().unwrap(),q[1].as_f64().unwrap(),q[2].as_f64().unwrap()]).collect();let mut cr=[0.;3];for i in 0..p.len(){let(a,b)=(p[i],p[(i+1)%p.len()]);cr[0]+=a[1]*b[2]-a[2]*b[1];cr[1]+=a[2]*b[0]-a[0]*b[2];cr[2]+=a[0]*b[1]-a[1]*b[0];}(cr[0]*cr[0]+cr[1]*cr[1]+cr[2]*cr[2]).sqrt()/2.};
  let facets:f64=m["roof"]["facets"].as_array().map(|fs|fs.iter().map(|f|poly3(f["points"].as_array().unwrap())).sum()).unwrap_or(0.);let main_area=n(&m["roof"],"area");if main_area>0.&&(facets-main_area).abs()>main_area*0.01+1.{note("roof facets != roof area".into(),format!("{} facets {:.1} vs area {:.1}",tag,facets,main_area));}
  // Floors: the rooms on every level tile the house footprint (wings included) exactly.
  for(li,l)in levels.iter().enumerate(){let rooms:f64=l["rooms"].as_array().unwrap().iter().map(|r|n(r,"w")*n(r,"d")).sum();let wing=if li==0||c.stories>1{crate::wings::floor_area(&c)}else{0.};let _=wing;if (rooms-c.width*c.depth).abs()>0.5&&(rooms-(c.width*c.depth+crate::wings::floor_area(&c))).abs()>0.5{note("rooms don't tile the floor".into(),format!("{} L{} rooms {} footprint {}",tag,li,rooms,c.width*c.depth));}}
  let g=&m["garage"];if g.is_object(){if !raw("garage-slab").is_some_and(|v|near(v,n(g,"area")/81.)){note("garage slab".into(),tag.clone());}if !near(n(g,"area"),n(g,"w")*n(g,"d")){note("garage area".into(),tag.clone());}}
 }}}eprintln!("RECONCILE {} designs: {:?}",i,seen);}
/// Every catalog home's kitchen gets a real working counter: a sink-and-range run plus more counter on
/// another wall, so openings never leave it with a single short base cabinet.
#[test]fn default_kitchens_have_working_counters(){for st in catalog()["homeStyles"].as_array().unwrap().iter().map(|h|s(h,"name").to_string()){let mut c=generator::starter();c.home_style=st.clone();architecture::apply(&mut c,true);c.stories=heritage::default_stories(&st);if c.stories>=2{c.depth=c.depth.max(architecture::minimum_depth(&c));}let m=model::build(&c);
 let lf:f64=m["levels"].as_array().cloned().unwrap_or_else(||vec![m.clone()]).iter().flat_map(|l|serde_json::from_value::<Vec<staging::Furniture>>(l["furniture"].clone()).unwrap_or_default()).filter(|f|f.kind=="kitchen"||f.kind=="counter-run").map(|f|f.local_width).sum();
 let need=if ["Colonial","Georgian","French country","Coastal"].contains(&st.as_str()){14.}else{10.};assert!(lf>=need,"{} kitchen has {} ft of counter",st,lf);}}

/// Photos to a home: a read for every style builds a valid, practical design that carries the
/// photo's own choices; values outside the menus are ignored rather than breaking the design.
#[test]fn photo_reads_build_valid_homes_for_every_style(){
 let base=generator::starter();
 for(i,st)in catalog()["options"]["homeStyle"].as_array().unwrap().iter().filter_map(|v|v.as_str()).enumerate(){
  let read=json!({"homeStyle":st,"stories":1+i%3,"bedrooms":2+i%4,"widthFt":30+i*3,"depthFt":28+i*2,"roofPitch":6+i%6,"siding":"Painted lap siding","sidingColor":"#2F3E4E","roofColor":"#343434","trimColor":"#f2efe6",
   "frontPorch":"Full-width veranda","columnStyle":"Classical round","garage":if i%2==0{"Attached"}else{"None"},"garageSize":"Three-car","shutters":"Louvered","entryDoor":"Craftsman glass",
   "interiorStyle":"Natural · Linen house","floor":"Natural oak","kitchenCabinets":"Shaker","kitchenIsland":"Waterfall island","livingSeating":"L-shaped sectional","cabinetColor":"Sage green"});
  let (c,notes)=photo::design(&base,&read).unwrap_or_else(|e|panic!("{}: {}",st,e));
  assert!(validate(&c).is_ok(),"{} invalid",st);assert!(generator::practical(&c,&model::build(&c)),"{} impractical",st);
  assert_eq!(c.home_style,st);assert_eq!(c.siding,"Painted lap siding");assert_eq!(c.colors["siding"],"#2f3e4e");assert_eq!(c.front_porch,"Full-width veranda");
  assert_eq!(c.kitchen_cabinets,"Shaker");assert_eq!(c.cabinet_color,"Sage green");assert_eq!(c.interior_style,"Natural · Linen house");assert_eq!(c.design_mode,"Custom");
  assert!(notes[0].starts_with(st),"{:?}",notes);
 }
 // Garbage and missing values fall back to the style's own choices.
 let (c,_)=photo::design(&base,&json!({"homeStyle":"Spaceship","stories":9,"widthFt":-4,"siding":"Gold leaf","sidingColor":"red","frontPorch":"Moat","kitchenCounter":42})).unwrap();
 assert_eq!(c.home_style,base.home_style);assert!(validate(&c).is_ok());assert_eq!(c.front_porch,"Style matched");assert_eq!(c.kitchen_counter,"Style matched");
 assert!(photo::design(&base,&json!("nope")).is_err());
 // Too many bedrooms for a small read: the footprint grows instead of failing.
 let (c,_)=photo::design(&base,&json!({"homeStyle":"Ranch","stories":1,"bedrooms":5,"widthFt":20,"depthFt":20})).unwrap();
 assert!(c.width*c.depth>400.&&generator::practical(&c,&model::build(&c)));
}
/// The photo API's answer schema is built from website/api/_lib/photo-options.json; it must list
/// exactly the engine's options. Regenerate with UPDATE_PHOTO_OPTIONS=1 cargo test photo_options.
#[test]fn photo_options_file_matches_the_engine(){
 let path=concat!(env!("CARGO_MANIFEST_DIR"),"/../api/_lib/photo-options.json");
 let want=serde_json::to_string_pretty(&photo::options()).unwrap()+"\n";
 if std::env::var("UPDATE_PHOTO_OPTIONS").is_ok(){std::fs::write(path,&want).unwrap();}
 assert_eq!(std::fs::read_to_string(path).unwrap_or_default(),want,"run UPDATE_PHOTO_OPTIONS=1 cargo test photo_options");
}

/// Rooms tile a floor exactly when every 1-ft cell is covered once.
fn tiles(rs:&[Room],w:f64,d:f64)->bool{let mut hit=vec![0u8;(w as usize)*(d as usize)];for r in rs{for z in r.z as usize..(r.z+r.d)as usize{for x in r.x as usize..(r.x+r.w)as usize{if x>=w as usize||z>=d as usize{return false}hit[z*w as usize+x]+=1;}}}hit.iter().all(|h|*h==1)}
fn plan_room(t:&str,name:&str,x:f64,z:f64,w:f64,d:f64)->Value{json!({"type":t,"name":name,"x":x,"z":z,"w":w,"d":d})}
/// A two-story center-hall plan read with typical errors (gaps, overlaps, a missing hall upstairs).
fn colonial_plan()->Value{json!({"mainWidthFt":40.6,"mainDepthFt":31.5,"floors":[
 {"rooms":[plan_room("living","Living room",0.,0.,15.,18.),plan_room("foyer","Foyer",15.,0.,10.,12.),plan_room("stairs","Stairs",15.5,12.,8.,16.),plan_room("dining","Dining room",25.,0.,15.,14.),
  plan_room("family","Family room",0.,18.,15.,13.5),plan_room("kitchen","Kitchen",25.,14.,15.,17.5),plan_room("powder","Powder",23.,24.,3.,6.),plan_room("garage","Garage",40.,0.,22.,24.)]},
 {"rooms":[plan_room("bedroom","Primary bedroom",0.,0.,16.,15.),plan_room("bath","Primary bath",0.,15.,10.,8.),plan_room("closet","Walk-in closet",10.,15.,6.,8.),
  plan_room("stairs","Stairs",16.,12.,8.,16.),plan_room("bedroom","Bedroom 2",25.,0.,15.,12.),plan_room("bedroom","Bedroom 3",25.,19.,15.,12.5),plan_room("bath","Hall bath",25.,12.,8.,7.),plan_room("bedroom","Bedroom 4",0.,23.,16.,8.5)]}]})}

#[test]fn floor_plan_reading_builds_the_traced_rooms_exactly(){
 let base=generator::starter();
 let read=json!({"homeStyle":"Colonial","stories":2,"bedrooms":4,"floorPlan":colonial_plan()});
 let(c,notes)=photo::design(&base,&read).unwrap();
 assert_eq!((c.width,c.depth,c.stories),(40.,32.,2),"{:?}",notes);assert!(!c.catalog_plan&&c.traced_plan.is_some());assert_eq!(c.bedrooms,4);
 assert!(notes[0].contains("traced from your floor plan"),"{:?}",notes);assert!(validate(&c).is_ok());
 let t=c.traced_plan.clone().unwrap();
 for(f,rooms)in t.floors.iter().enumerate(){
  assert!(tiles(rooms,40.,32.),"floor {} does not tile: {:?}",f,rooms);
  let stair=rooms.iter().find(|r|r.kind=="stairs").expect("stair on every floor");assert_eq!((stair.w,stair.d),(8.,16.));
  assert_eq!((stair.x,stair.z),(t.floors[0].iter().find(|r|r.kind=="stairs").unwrap().x,t.floors[0].iter().find(|r|r.kind=="stairs").unwrap().z));
 }
 // Named rooms survive close to their read size; the garage is not a room.
 let ground=&t.floors[0];let kitchen=ground.iter().find(|r|r.kind=="kitchen").unwrap();assert!(kitchen.w>=12.&&kitchen.d>=16.,"{:?}",kitchen);
 assert!(ground.iter().all(|r|r.name!="Garage"));assert!(ground.iter().any(|r|r.name=="Powder"&&r.kind=="bath"));
 // The engine builds exactly these rooms on each floor, and furnishes them by type.
 for floor in 0..2{let mut cc=c.clone();cc.active_floor=floor;let m=model::build(&cc);
  let rooms:Vec<Room>=serde_json::from_value(m["rooms"].clone()).unwrap();
  assert_eq!(rooms.len(),t.floors[floor].len(),"floor {}",floor);assert!(tiles(&rooms,40.,32.));
  let fs:Vec<staging::Furniture>=serde_json::from_value(m["furniture"].clone()).unwrap();
  for r in rooms.iter().filter(|r|r.kind=="bedroom"){assert!(fs.iter().any(|f|f.room_id==r.id&&f.kind=="bed"),"no bed in {}",r.name);}
  for r in rooms.iter().filter(|r|r.kind=="bath"){assert!(fs.iter().any(|f|f.room_id==r.id&&f.kind=="toilet"),"no toilet in {}",r.name);}
 }
 // Editing the size scales the plan and keeps it whole; changing the style returns to catalog plans.
 let mut wider=c.clone();wider.width=48.;wider.depth=36.;assert!(validate(&wider).is_ok());let rs:Vec<Room>=serde_json::from_value(model::build(&wider)["rooms"].clone()).unwrap();assert!(tiles(&rs,48.,36.));
 let mut other=c.clone();architecture::apply(&mut other,true);assert!(other.traced_plan.is_none());
 // The plan survives a save and reload.
 let saved=serde_json::to_string(&c).unwrap();assert!(security::parse(&saved).is_ok());
}

#[test]fn floor_plan_with_a_rear_wing_becomes_an_l_shape(){
 let base=generator::starter();
 let plan=json!({"mainWidthFt":44,"mainDepthFt":28,"floors":[{"rooms":[plan_room("living","Great room",0.,0.,20.,16.),plan_room("kitchen","Kitchen",20.,0.,12.,14.),plan_room("dining","Dining",32.,0.,12.,14.),
  plan_room("hall","Hall",20.,14.,24.,4.),plan_room("bedroom","Primary",0.,16.,14.,12.),plan_room("bath","Bath",14.,16.,6.,8.),plan_room("bedroom","Bedroom 2",32.,18.,12.,10.),plan_room("bath","Bath 2",26.,18.,6.,10.),
  plan_room("bedroom","Bedroom 3",32.,28.,12.,14.),plan_room("closet","Closet",20.,18.,6.,10.)]}]});
 let(c,notes)=photo::design(&base,&json!({"homeStyle":"Ranch","stories":1,"floorPlan":plan})).unwrap();
 assert_eq!((c.width,c.depth,c.stories,c.shape.as_str()),(44.,28.,1,"L-shape"),"{:?}",notes);assert_eq!(c.bedrooms,3);assert!(validate(&c).is_ok());
 let m=model::build(&c);let rooms:Vec<Room>=serde_json::from_value(m["rooms"].clone()).unwrap();
 assert!(rooms.iter().any(|r|wings::is_wing(&r.id)&&r.kind=="bedroom"),"wing keeps the traced bedroom: {:?}",rooms.iter().map(|r|(&r.id,&r.kind)).collect::<Vec<_>>());
 assert!(tiles(&rooms.iter().filter(|r|!wings::is_wing(&r.id)).cloned().collect::<Vec<_>>(),44.,28.));
}

/// Any jumble of read rooms becomes an exact tiling.
#[test]fn plan_tiling_always_covers_the_floor_once(){
 let mut seed=7u32;let mut rnd=|n:f64|{seed=seed.wrapping_mul(1664525).wrapping_add(1013904223);((seed>>8)as f64/16777216.)*n};
 for _ in 0..300{let(w,d)=(grid(16.+rnd(60.)),grid(16.+rnd(60.)));let raws:Vec<traced::Raw>=(0..(2+rnd(14.)as usize)).map(|i|traced::Raw{name:format!("R{}",i),kind:["bedroom","bath","living","hall","kitchen"][i%5].into(),x:rnd(w)-2.,z:rnd(d)-2.,w:2.+rnd(20.),d:2.+rnd(20.)}).collect();
  let rs=traced::tile(&raws,&[],w,d);assert!(tiles(&rs,w,d),"{}x{} {:?}",w,d,raws);assert!(rs.iter().all(|r|r.w>=2.&&r.d>=2.&&traced::KINDS.contains(&r.kind.as_str())));}
}

/// Diagnostic: which items can be placed in which homes (prints, never fails).
#[test]#[ignore]fn item_placement_report(){
 let builtin=["stairs","sofa","bed","chair","armchair","toilet","vanity","shower","kitchen","island","counter-run","pantry-tower","fridge","dining","coffee","desk","wardrobe","nightstand","laundry","plant","rug","floorlamp","side-table","bench","bookcase","entry-console","floor-vase","floor-mirror","tall-plant"];
 let kinds:Vec<String>=builtin.iter().map(|s|s.to_string()).chain(objects::all().iter().map(|o|o.kind.clone())).collect();
 let mut homes:Vec<(String,Config)>=catalog()["options"]["homeStyle"].as_array().unwrap().iter().map(|v|{let st=v.as_str().unwrap();let mut c=generator::starter();c.home_style=st.into();let h=lookup("homeStyles",st);c.siding=s(&h,"cladding").into();c.stories=heritage::default_stories(st);c.bedrooms=heritage::default_bedrooms(st);architecture::apply(&mut c,true);(st.to_string(),c)}).collect();
 for stories in [1,2]{let mut b=generator::starter();b.design_mode="Blank slate".into();b.stories=stories;b.width=40.;b.depth=32.;architecture::reset_edits(&mut b);homes.push((format!("Blank slate {}",stories),b));}
 for(name,c)in &homes{if validate(c).is_err(){println!("{}: invalid {:?}",name,validate(c));continue}let m=model::build(c);let ws:Vec<Wall>=serde_json::from_value(m["walls"].clone()).unwrap();let fs:Vec<staging::Furniture>=serde_json::from_value(m["furniture"].clone()).unwrap();let rs:Vec<Room>=serde_json::from_value(m["rooms"].clone()).unwrap();
  let mut missing=vec![];for k in &kinds{let(w,d)=edit::item_dimensions(k);let ok=rs.iter().any(|r|{let f=staging::Furniture{id:"preview".into(),kind:k.clone(),room_id:r.id.clone(),x:r.x+r.w/2.,z:r.z+r.d/2.,w,d,rotation:0.,local_width:w,local_depth:d};let(_,_,e)=edit::snap_item(f,c,&ws,&fs);e.is_none()});if !ok{missing.push(k.clone());}}
  println!("{}: {} of {} items cannot be placed: {:?}",name,missing.len(),kinds.len(),missing);}
}

/// Diagnostic: furniture kinds staged per room type in each catalog home (prints, never fails).
#[test]#[ignore]fn staging_kinds_report(){
 let mut per:std::collections::BTreeMap<String,std::collections::BTreeMap<String,usize>>=Default::default();let mut rooms:std::collections::BTreeMap<String,usize>=Default::default();
 for st in catalog()["options"]["homeStyle"].as_array().unwrap().iter().filter_map(|v|v.as_str()){let mut c=generator::starter();c.home_style=st.into();c.stories=heritage::default_stories(st);c.bedrooms=heritage::default_bedrooms(st);architecture::apply(&mut c,true);
  for floor in 0..c.stories{let mut cc=c.clone();cc.active_floor=floor;let m=model::build(&cc);let rs:Vec<Room>=serde_json::from_value(m["rooms"].clone()).unwrap();let fs:Vec<staging::Furniture>=serde_json::from_value(m["furniture"].clone()).unwrap();
   for r in &rs{*rooms.entry(r.kind.clone()).or_default()+=1;let mut seen=std::collections::BTreeSet::new();for f in fs.iter().filter(|f|f.room_id==r.id){if seen.insert(f.kind.clone()){*per.entry(r.kind.clone()).or_default().entry(f.kind.clone()).or_default()+=1;}}}}}
 for(k,n)in &rooms{println!("{} ({} rooms): {:?}",k,n,per.get(k));}
}

/// Furniture drawn on a floor plan lands where it was drawn, facing the way it was drawn, in place of
/// the automatic piece; it scales with the house when the size changes.
#[test]fn plan_furniture_is_placed_where_drawn(){
 let mut plan=colonial_plan();
 plan["floors"][0]["furniture"]=json!([{"type":"sofa","x":0.5,"z":8.,"w":3.,"d":7.,"backToward":"left"},{"type":"dining table","x":29.,"z":4.,"w":6.,"d":4.,"backToward":"front"},{"type":"toilet","x":15.5,"z":28.5,"w":2.,"d":2.5,"backToward":"back"}]);
 plan["floors"][1]["furniture"]=json!([{"type":"bed","x":4.,"z":0.5,"w":6.4,"d":6.8,"backToward":"front"},{"type":"nightstand","x":1.5,"z":0.5,"w":1.6,"d":1.5,"backToward":"front"},{"type":"bathtub","x":0.5,"z":15.5,"w":5.,"d":2.6,"backToward":"left"}]);
 let(c,notes)=photo::design(&generator::starter(),&json!({"homeStyle":"Colonial","floorPlan":plan})).unwrap();
 assert!(notes.iter().any(|n|n.contains("6 pieces of furniture placed")),"{:?}",notes);assert!(validate(&c).is_ok());
 let near_at=|fs:&[staging::Furniture],kind:&str,x:f64,z:f64,rot:f64|fs.iter().any(|f|f.kind==kind&&(f.x-x).abs()<=2.&&(f.z-z).abs()<=2.&&(f.rotation-rot).abs()<0.01);
 let ground:Vec<staging::Furniture>=serde_json::from_value(model::build(&c)["furniture"].clone()).unwrap();
 assert!(near_at(&ground,"sofa",2.,11.5,3.*std::f64::consts::FRAC_PI_2),"sofa: {:?}",ground.iter().filter(|f|f.kind=="sofa").collect::<Vec<_>>());
 assert!(near_at(&ground,"dining",32.,6.,0.));
 let lr=ground.iter().find(|f|f.id.starts_with("tf")&&f.kind=="sofa").unwrap().room_id.clone();assert_eq!(ground.iter().filter(|f|f.room_id==lr&&["sofa","sectional"].contains(&f.kind.as_str())).count(),1,"the drawn sofa replaces the automatic one");
 let mut up=c.clone();up.active_floor=1;let upper:Vec<staging::Furniture>=serde_json::from_value(model::build(&up)["furniture"].clone()).unwrap();
 assert!(near_at(&upper,"king-bed",7.2,3.9,0.),"bed: {:?}",upper.iter().filter(|f|f.kind.contains("bed")).collect::<Vec<_>>());
 let room=upper.iter().find(|f|f.kind=="king-bed").unwrap().room_id.clone();assert_eq!(upper.iter().filter(|f|f.room_id==room&&f.kind.contains("bed")&&f.kind!="bench").count(),1,"one bed in the primary bedroom");
 assert!(upper.iter().any(|f|f.kind=="bathtub"),"tub placed");
 // Wider house: the drawn pieces move with their rooms.
 let mut wide=c.clone();wide.width=48.;let g:Vec<staging::Furniture>=serde_json::from_value(model::build(&wide)["furniture"].clone()).unwrap();assert!(near_at(&g,"dining",38.4,6.,0.),"scaled dining");
}
#[test]#[ignore]fn debug_bath_walls(){let mut plan=colonial_plan();plan["floors"][1]["furniture"]=json!([]);let(c,_)=photo::design(&generator::starter(),&json!({"homeStyle":"Colonial","floorPlan":plan})).unwrap();let mut up=c.clone();up.active_floor=1;let m=model::build(&up);let ws:Vec<Wall>=serde_json::from_value(m["walls"].clone()).unwrap();
 for w in ws.iter().filter(|w|{let(x0,z0,x1,z1)=if w.axis=="x"{(w.x,w.z,w.x+w.length,w.z)}else{(w.x,w.z,w.x,w.z+w.length)};x1>=0.&&x0<=10.&&z1>=16.&&z0<=24.}){println!("{} {} x{} z{} len{} {:?}",w.id,w.axis,w.x,w.z,w.length,w.openings.iter().map(|o|(&o.kind,o.at,o.width)).collect::<Vec<_>>());}}
#[test]fn each_stair_style_prices_its_own_parts(){
 let mut c=Config::default();c.stories=2;let raw=|c:&Config,id:&str|{let m=model::build(c);m["items"].as_array().unwrap().iter().find(|i|s(i,"id")==id).map_or(0.,|i|n(i,"rawNet"))};
 assert_eq!(stairs::style(&c),"U-shaped switchback","a Victorian gets the switchback by default");
 let risers=n(&stairs::info(&c,&model::build(&c)["levels"][0]["rooms"],c.wall_height+structural::floor_gap(&c)),"risers");
 for(style,treads,landing,kit)in[("U-shaped switchback",risers-2.,32.,0.),("Straight",risers-1.,0.,0.),("L-shaped",risers-2.,12.25,0.),("Spiral",0.,0.,1.)]{
  c.stair_style=style.into();assert!(validate(&c).is_ok(),"{style}");assert_eq!(stairs::style(&c),style);
  assert_eq!(raw(&c,"stairtreads"),treads,"{style} treads");assert!(near(raw(&c,"stairlanding"),landing),"{style} landing");assert_eq!(raw(&c,"stairspiral"),kit,"{style} kit");
 }
 c.stair_style="Ladder".into();assert!(validate(&c).is_err());
 c.stair_style="Style matched".into();c.home_style="Contemporary".into();assert_eq!(stairs::style(&c),"Straight");
}
#[test]#[ignore]fn bump_report(){
 for style in ["Colonial","Victorian","Craftsman","Ranch","Contemporary","Tudor","Modern farmhouse","Cape Cod","Coastal","Georgian","French country","Mid-century"]{
  for seed in [1u32,2]{let mut c=generator::starter();c.home_style=style.into();c.catalog_plan=true;architecture::apply(&mut c,true);c.stories=heritage::default_stories(style);c.bedrooms=heritage::default_bedrooms(style);architecture::apply(&mut c,true);c.seed=seed;c.bump_outs="Style matched".into();
   if validate(&c).is_err(){println!("{style}: invalid {:?}",validate(&c));continue}
   let bs=bumps::list(&c);let m=model::build(&c);
   println!("{style} s{seed} {}st {}x{} garage {} -> {:?} | wings {} | warnings {:?}",c.stories,c.width,c.depth,c.garage_side,bs.iter().map(|b|format!("{} {}..{} d{} {} tie{:.2} [{}]",b.side,b.lo,b.hi,b.depth,b.roof,b.tie,b.room)).collect::<Vec<_>>(),m["wings"].as_array().map_or(0,|a|a.len()),m["warnings"].as_array().map(|a|a.len()));
  }
 }
}
#[test]#[ignore]fn bump_probe(){let mut c=generator::starter();c.home_style="Cape Cod".into();c.stories=heritage::default_stories("Cape Cod");c.bedrooms=heritage::default_bedrooms("Cape Cod");architecture::apply(&mut c,true);c.seed=2;c.bump_outs=std::env::var("BO").unwrap_or("Style matched".into());let m=model::build(&c);println!("bumps {:?}",bumps::list(&c));println!("issues {}",m["openingChecks"]["issues"]);println!("bed {} baths {}",m["counts"]["bedrooms"],m["counts"]["baths"]);println!("practical {}",generator::practical(&c,&m));let f=m["furniture"].as_array().unwrap();for r in m["rooms"].as_array().unwrap(){println!("room {} {} {}x{} : {:?}",s(r,"id"),s(r,"type"),n(r,"w"),n(r,"d"),f.iter().filter(|x|s(x,"roomId")==s(r,"id")).map(|x|s(x,"kind")).collect::<Vec<_>>());}println!("garage {} wings {}",format!("x {} z {} w {}",m["garage"]["x"],m["garage"]["z"],m["garage"]["w"]),m["wings"].to_string().chars().take(300).collect::<String>());}
#[test]fn bump_outs_pop_out_on_the_grid_with_their_own_roofs(){
 for style in ["Colonial","Victorian","Contemporary","Cape Cod","Georgian","Ranch","Tudor"]{for seed in [1u32,2]{
  let mut c=generator::starter();c.home_style=style.into();c.stories=heritage::default_stories(style);c.bedrooms=heritage::default_bedrooms(style);architecture::apply(&mut c,true);c.seed=seed;c.bump_outs="Style matched".into();
  if validate(&c).is_err(){continue}
  // Bump-outs never turn a workable home into one the generator would reject.
  let mut plain=c.clone();plain.bump_outs="None".into();let m=model::build(&c);if generator::practical(&plain,&model::build(&plain)){assert!(generator::practical(&c,&m),"{style} {seed} practical");}
  let ground=if c.stories>=2{&m["levels"][0]}else{&m};let walls=ground["walls"].as_array().unwrap();
  for(i,b)in bumps::list(&c).iter().enumerate(){
   let id=format!("wingb{i}");assert!([b.lo,b.hi,b.depth].iter().all(|v|near(*v/2.,(*v/2.).round())),"{style} on grid {:?}",b);
   let g=m["wings"].as_array().unwrap().iter().find(|g|s(g,"id")==id).unwrap();assert!(g["roof"]["facets"].as_array().unwrap().len()>=1);assert!(n(&g["roof"],"area")>0.);
   assert_eq!(walls.iter().filter(|w|s(w,"id").ends_with(&format!("-{id}"))).count(),3,"{style} three bump walls");
   let host=walls.iter().find(|w|s(w,"id")==bumps::host_wall(b.side)).unwrap();assert!(host["openings"].as_array().unwrap().iter().any(|o|s(o,"kind")=="passage"&&n(o,"at")>=b.lo&&n(o,"at")+n(o,"width")<=b.hi),"{style} opens into the bump-out");
   assert!(ground["rooms"].as_array().unwrap().iter().any(|r|s(r,"id")==format!("{id}-bay")&&s(r,"type")=="bay"));
  }
  if !bumps::list(&c).is_empty(){assert!(m["items"].as_array().unwrap().iter().any(|i|s(i,"id")=="bump-tie-in"));}
 }}
 let mut c=generator::starter();c.bump_outs="None".into();assert!(bumps::list(&c).is_empty());c.bump_outs="Sideways".into();assert!(validate(&c).is_err());
}
