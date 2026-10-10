use super::*;

pub fn roof(a:&State)->String{
    let c=&a.c;let mut out=String::from("<details class=control-group data-section=exterior><summary>Dormers &amp; architectural details</summary>");
    out.push_str(&select("dormerStyle","Window dormer roof",&strings(&["None","Style matched","Gable","Shed","Hip"]),&c.dormer_style));
    if c.dormer_style!="None"{
        out.push_str("<div class=two-fields>");
        out.push_str(&select("dormerWidth","Dormer width · ft",&strings(&["2","4","8","16"]),&c.dormer_width.to_string()));
        out.push_str(&select("dormerDepth","Dormer maximum depth · ft",&strings(&["2","4","8","16"]),&c.dormer_depth.to_string()));out.push_str("</div><div class=two-fields>");
        out.push_str(&select("dormerCount","Dormer count",&strings(&["1","2","3","4","5","6"]),&c.dormer_count.to_string()));
        out.push_str(&select("dormerSide","Dormer placement",&strings(&["Automatic","Front","Rear","Left","Right"]),&c.dormer_side));out.push_str("</div>");
        out.push_str(&format!("<p class=muted>{} dormers fit the current roof. Dormers form centered, evenly spaced rows, with clear eaves, ridges, hips and valleys. Depth is the module envelope; roofs stop at their actual intersection.</p>",a.m["dormers"].as_array().map_or(0,Vec::len)));
        for note in a.m["dormerNotes"].as_array().into_iter().flatten(){out.push_str(&format!("<p class=feature-note>{}</p>",esc(note.as_str().unwrap_or(""))));}
    }
    out.push_str(&select("roofEdgeStyle","Roof edge molding",&strings(&["Style matched","Plain fascia","Stepped cornice","Ogee cornice","Dentil cornice","Craftsman brackets","Victorian fretwork"]),&c.roof_edge_style));
    out.push_str(&select("gableAccent","Gable trim accent",&strings(&["Style matched","None","Shingle panel","Board and batten","Tudor timber"]),&c.gable_accent));
    out.push_str(&select("finials","Roof-peak ornaments",&strings(&["Style matched","None","Turned finials","Roof spire"]),&c.finials));
    out.push_str("<p class=muted>Sealed wood facade trim with real profile depth. Accent panels stay inside gables. Dormer openings and roof ornaments need final structural and weather detailing.</p></details>");out
}
pub fn outdoor(a:&State)->String{
    let c=&a.c;let mut out=String::from("<details class=control-group data-section=outdoor><summary>Rear deck or porch</summary>");
    out.push_str(&select("rearOutdoor","Rear outdoor space",&strings(&["Style matched","None","Deck","Covered porch"]),&c.rear_outdoor));
    if additions::rear_kind(c)!="None"{
        out.push_str("<div class=two-fields>");out.push_str(&field_num("rearWidth","Width · ft",c.rear_width,4.,32.).replace("step=0.01","step=2"));out.push_str(&field_num("rearDepth","Depth · ft",c.rear_depth,2.,32.).replace("step=0.01","step=2"));out.push_str("</div>");
        if let Some(r)=a.m["rearOutdoor"]["rectangles"].as_array().and_then(|v|v.first()){out.push_str(&format!("<p class=muted>{} · {} × {} ft. {}</p>",esc(s(&a.m["rearOutdoor"],"kind")),n(r,"w"),n(r,"d"),esc(s(&a.m["rearOutdoor"],"access"))));}
    }
    out.push_str(&select("balcony","Upper-floor balcony",&strings(&["Style matched","None","Rear balcony"]),&c.balcony));
    if let Some(note)=a.m["balconyNote"].as_str(){out.push_str(&format!("<p class=feature-note>{}</p>",esc(note)));}
    if a.m["balcony"].is_object(){out.push_str(&format!("<p class=muted>{} · {:.0} × {:.0} ft · connected upper-floor door. {}</p>",esc(s(&a.m["balcony"],"side")),n(&a.m["balcony"],"w"),n(&a.m["balcony"],"d"),esc(s(&a.m["balcony"],"note"))));}
    out.push_str("<p class=muted>The source-informed front porch is retained. Rear additions coordinate with the selected style and appear in the takeoff.</p></details>");out
}
pub fn windows(a:&State)->String{
    let c=&a.c;let mut out=String::from("<details class=control-group data-section=windows><summary>Window type &amp; size</summary>");
    out.push_str(&select("windowStyle","Window operating style",&strings(&["Style matched","Double hung","Casement","Picture"]),&c.window_style));
    out.push_str(&select("windowSize","Main window size",&strings(&["Style matched","Medium","Large"]),&c.window_size));
    out.push_str("<p class=muted>Medium: 3 × 4 ft. Large: 4 × 4 ft. Bath windows remain compact. Custom 3D openings are preserved. Bedrooms retain an operable escape candidate; product clear dimensions require verification.</p></details>");out
}
