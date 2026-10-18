use super::*;

pub fn roof(a:&State)->String{
    let c=&a.c;let mut out=String::from("<details class=control-group data-section=roofing><summary>Roof covering &amp; ceiling</summary>");
    out.push_str(&select("roofing","Roof covering",&strings(&roofing::CHOICES),&c.roofing));
    let r=&a.m["roofing"];out.push_str(&format!("<p class=muted>Building with {} · {} factory roof panels. Minimum pitch {}:12; style-matched shingles switch to metal on flatter roofs.</p>",esc(s(r,"kind")),n(r,"panels"),n(r,"minPitch")));
    if !s(r,"note").is_empty(){out.push_str(&format!("<p class=feature-note>{}</p>",esc(s(r,"note"))));}
    if roof::cathedral_ok(c){out.push_str(&select("ceiling","Top-floor ceiling",&strings(&["Flat ceiling","Cathedral"]),&c.ceiling));out.push_str("<p class=muted>Cathedral: the roof panels' underside is a vaulted ceiling on a structural LVL ridge, insulated in every rafter bay. Flat: ceiling joists at the top plates with a vented attic above.</p>");}
    else{out.push_str("<p class=muted>Top-floor ceiling: flat with a vented attic. Cathedral ceilings need a pitched roof of at least 4:12.</p>");}
    out.push_str("</details><details class=control-group data-section=exterior><summary>Dormers &amp; architectural details</summary>");
    out.push_str(&select("dormerStyle","Window dormer roof",&strings(&["None","Style matched","Gable","Shed","Hip","Arched","Eyebrow"]),&c.dormer_style));
    if c.dormer_style!="None"{
        out.push_str("<div class=two-fields>");
        out.push_str(&select("dormerWidth","Dormer width · ft",&strings(&["2","4","8","16"]),&c.dormer_width.to_string()));
        out.push_str(&select("dormerDepth","Dormer maximum depth · ft",&strings(&["2","4","8","16"]),&c.dormer_depth.to_string()));out.push_str("</div><div class=two-fields>");
        out.push_str(&select("dormerCount","Dormer count",&strings(&["1","2","3","4","5","6"]),&c.dormer_count.to_string()));
        out.push_str(&select("dormerSide","Dormer placement",&strings(&["Automatic","Front","Rear","Left","Right"]),&c.dormer_side));out.push_str("</div>");
        out.push_str(&format!("<p class=muted>{} dormers fit the current roof. Dormers form centered, evenly spaced rows, with clear eaves, ridges, hips and valleys. Depth is the module envelope; roofs stop at their actual intersection.</p>",a.m["dormers"].as_array().map_or(0,Vec::len)));
        for note in a.m["dormerNotes"].as_array().into_iter().flatten(){out.push_str(&format!("<p class=feature-note>{}</p>",esc(note.as_str().unwrap_or(""))));}
    }
    out.push_str(&select("roofEdgeStyle","Roof edge molding",&strings(&["Style matched","Plain fascia","Crown fascia","Stepped cornice","Ogee cornice","Dentil cornice","Modillion cornice","Scrolled corbels","Craftsman brackets","Exposed beam ends","Boxed eave & frieze","Victorian fretwork"]),&c.roof_edge_style));
    out.push_str(&select("eaveOverhang","Roof overhang · eave depth",&strings(&additions::character::OVERHANGS),&c.eave_overhang));
    out.push_str(&select("gableAccent","Gable trim accent",&strings(&["Style matched","None","Shingle panel","Board and batten","Tudor timber"]),&c.gable_accent));
    out.push_str(&select("finials","Roof-peak ornaments",&strings(&["Style matched","None","Turned finials","Roof spire"]),&c.finials));
    out.push_str("<p class=muted>Sealed wood facade trim with real profile depth. Accent panels stay inside gables. Dormer openings and roof ornaments need final structural and weather detailing.</p></details>");out
}
pub fn outdoor(a:&State)->String{
    let c=&a.c;let mut out=String::from("<details class=control-group data-section=outdoor><summary>Porches, decks &amp; balcony</summary>");
    out.push_str(&select("frontPorch","Front porch",&strings(&crate::porch::FORMS),&c.front_porch));
    if !["Style matched","None"].contains(&c.front_porch.as_str())&&a.m["porch"].is_null(){out.push_str("<p class=feature-note>Add a door on the front wall to attach this porch.</p>");}
    out.push_str(&select("columnStyle","Porch column style",&strings(&additions::character::COLUMNS),&c.column_style));
    out.push_str(&select("railingStyle","Railing style · porch, deck and balcony",&strings(&additions::character::RAILINGS),&c.railing_style));
    out.push_str(&select("rearOutdoor","Rear outdoor space",&strings(&["Style matched","None","Deck","Covered porch"]),&c.rear_outdoor));
    if additions::rear_kind(c)!="None"{
        out.push_str("<div class=two-fields>");out.push_str(&field_num("rearWidth","Width · ft",c.rear_width,4.,32.).replace("step=0.01","step=2"));out.push_str(&field_num("rearDepth","Depth · ft",c.rear_depth,2.,32.).replace("step=0.01","step=2"));out.push_str("</div>");
        if let Some(r)=a.m["rearOutdoor"]["rectangles"].as_array().and_then(|v|v.first()){out.push_str(&format!("<p class=muted>{} · {} × {} ft. {}</p>",esc(s(&a.m["rearOutdoor"],"kind")),n(r,"w"),n(r,"d"),esc(s(&a.m["rearOutdoor"],"access"))));}
    }
    out.push_str(&select("balcony","Upper-floor balcony",&strings(&["Style matched","None","Rear balcony"]),&c.balcony));
    if let Some(note)=a.m["balconyNote"].as_str(){out.push_str(&format!("<p class=feature-note>{}</p>",esc(note)));}
    if a.m["balcony"].is_object(){out.push_str(&format!("<p class=muted>{} · {:.0} × {:.0} ft · connected upper-floor door. {}</p>",esc(s(&a.m["balcony"],"side")),n(&a.m["balcony"],"w"),n(&a.m["balcony"],"d"),esc(s(&a.m["balcony"],"note"))));}
    out.push_str("<p class=muted>Style matched keeps the catalog house's own front porch. Rear additions coordinate with the selected style and appear in the takeoff.</p></details>");out
}
pub fn windows(a:&State)->String{
    let c=&a.c;let mut out=String::from("<details class=control-group data-section=windows><summary>Windows, shutters &amp; front door</summary>");
    out.push_str(&select("windowStyle","Window operating style",&strings(&["Style matched","Double hung","Casement","Picture"]),&c.window_style));
    out.push_str(&select("windowSize","Main window size",&strings(&["Style matched","Medium","Large"]),&c.window_size));
    out.push_str(&select("windowGrilles","Window grille pattern",&strings(&additions::character::GRILLES),&c.window_grilles));
    out.push_str(&select("shutters","Window shutters",&strings(&additions::character::SHUTTERS),&c.shutters));
    out.push_str(&select("entryDoor","Front door style",&strings(&additions::character::DOORS),&c.entry_door));
    out.push_str(&select("entrySurround","Front door surround",&strings(&additions::character::SURROUNDS),&c.entry_surround));
    out.push_str("<p class=muted>Medium: 3 × 4 ft. Large: 4 × 4 ft. Bath windows remain compact. Custom 3D openings are preserved. Bedrooms retain an operable escape candidate; product clear dimensions require verification.</p></details>");out
}
pub fn interiors(a:&State)->String{
    let c=&a.c;let picked=crate::interior_design::resolved(c);let fields=crate::interior_design::fields(c);
    let mut out=String::new();
    for(section,title,range,note)in[("kitchen","Kitchen design",0..11,"Real product sizes: 36 in counters, 30 in uppers, 24 in dishwasher, 30 to 48 in ranges. Style matched follows the interior design scheme. Upgrades over the standard kitchen are priced in the estimate."),("living","Living room design",11..15,"Wraparound and L sectionals take the room only where they keep doors, walkways and windows clear; otherwise the sofa stays. Fireplaces and built-ins are priced on the media wall."),("cabinetry","Cabinetry & storage",15..18,"Kitchen cabinet color paints the cabinets and island; the cabinetry finish dresses wardrobes, dressers, nightstands, consoles, sideboards, bookcases and desks; bedroom storage chooses the piece each bedroom gets.")]{
        out.push_str(&format!("<details class=control-group data-section={}-design><summary>{}</summary>",section,title));
        for(key,label,options,value)in fields[range].iter(){
            let current=picked.get(key).copied().unwrap_or("");
            out.push_str(&select(key,&if *value=="Style matched"{format!("{} · {}",label,current)}else{label.to_string()},&strings(options),value));
        }
        out.push_str(&format!("<p class=muted>{}</p></details>",note));
    }
    out
}
