use crate::*;

pub const PRICE_DATE: &str = "2026-10-09";
const ZIP_SOURCE: &str = "https://www.mccoys.com/shop/p/02100301/716x4x8-zip-system-wall-sheathing-osb";

pub fn validate(c: &Config) -> Result<(), String> {
    if !["Retail", "Wholesale estimate"].contains(&c.pricing_mode.as_str()) { return Err("Choose retail or wholesale estimate pricing.".into()); }
    if c.category_budgets.len()>80 || c.bulk_discounts.len()>80 || c.category_budgets.iter().any(|(k,v)|k.len()>100 || !v.is_finite() || *v<0. || *v>1e9) {
        return Err("Category budgets must be between $0 and $1 billion.".into());
    }
    if c.bulk_discounts.iter().any(|(k,v)|k.len()>100 || !v.is_finite() || *v<0. || *v>80.) { return Err("Supplier discounts must be 0–80%.".into()); }
    Ok(())
}

// Published examples are reference-market prices, not a live local-store feed.
// All other rates remain explicit retail estimating allowances until quoted.
pub fn retail_rate(id:&str,_category:&str,fallback:f64)->f64 {
    match id {
        "zipwall"|"garage-zipwall" if fallback<60. =>29.49,
        "ziproof"|"porch-ziproof"|"dormer-ziproof"=>54.,
        "ziptape"|"porch-ziptape"|"dormer-ziptape"|"garage-ziptape"=>43.,
        "zipstretch"=>88.,
        "drywallwalls"|"dormer-drywall"=>18.,
        "drywallceiling"=>24.,
        "compound"=>28.,
        _=>fallback,
    }
}

fn source(i:&Value)->Value {
    if s(i,"id")=="zipwall" && !s(i,"name").contains("R-6") {
        json!({"status":"Published retail reference", "checked":PRICE_DATE,"retailer":"McCoy's · San Marcos, TX", "url":ZIP_SOURCE,"note":"$29.49 per sheet; published bulk $26.54 at 80 sheets. Prices and availability vary by store; freight excluded."})
    } else {
        json!({"status":"Retail allowance — supplier quote needed", "checked":PRICE_DATE,"note":"Editable retail estimating rate, not a verified price for your ZIP. Final product, quantity, freight and local supplier quote can change the amount."})
    }
}

pub fn recalc_item(i:&mut Value,c:&Config) {
    let raw=n(i,"rawNet").max(0.);let amount=raw*(1.+n(i,"wastePercent")/100.);
    let qty=if s(i,"rounding")=="Whole purchase units"{(amount-1e-9).max(0.).ceil()}else{round(amount)};
    i["net"]=json!(round(raw));i["qty"]=json!(qty);i["total"]=json!(round(qty*n(i,"price")));
    let _=c;
}

pub fn apply(c:&Config,mut m:Value)->Value {
    let mut retail_categories:BTreeMap<String,f64>=BTreeMap::new();
    for i in m["items"].as_array().unwrap(){*retail_categories.entry(s(i,"category").into()).or_default()+=round(n(i,"qty")*n(i,"price"));}
    let mut categories:BTreeMap<String,f64>=BTreeMap::new();let mut subtotal=0.;let mut retail_subtotal=0.;let mut unquoted=0;
    for i in m["items"].as_array_mut().unwrap(){
        let cat=s(i,"category").to_string();let id=s(i,"id").to_string();let retail=n(i,"price");
        let zip_bulk=id=="zipwall"&&!s(i,"name").contains("R-6")&&n(i,"qty")>=80.&&!c.prices.contains_key(&id);
        // A user-supplied quote percentage is never stacked with a published tier.
        // Quote requests are modeled as a 10% scenario only above $2,000/category.
        let proposed=*c.bulk_discounts.get(&cat).unwrap_or(&if retail_categories[&cat]>=2000.{10.}else{0.});
        let discount=if c.pricing_mode=="Retail"{0.}else if c.bulk_discounts.contains_key(&cat){proposed}else if zip_bulk{(1.-26.54/29.49)*100.}else{proposed};
        let effective=if c.pricing_mode!="Retail"&&zip_bulk&&!c.bulk_discounts.contains_key(&cat){26.54}else{round(retail*(1.-discount/100.))};
        let retail_total=round(n(i,"qty")*retail);let total=round(n(i,"qty")*effective);
        let mut reference=source(i);if c.prices.contains_key(&id){reference["status"]=json!("User-entered retail unit price");}
        if n(i,"qty")>0.&&s(&reference,"status").starts_with("Retail allowance"){unquoted+=1;}
        i["retailPrice"]=json!(retail);i["retailTotal"]=json!(retail_total);i["price"]=json!(effective);i["total"]=json!(total);
        i["discountPercent"]=json!(round(discount));i["priceReference"]=reference;
        i["discountBasis"]=json!(if c.pricing_mode=="Retail"{"Retail basis"}else if c.bulk_discounts.contains_key(&cat){"User-entered supplier discount; confirm eligibility"}else if zip_bulk{"Published 80-sheet tier · McCoy's San Marcos reference"}else if discount>0.{"Unquoted 10% volume scenario at $2,000/category; not guaranteed"}else{"No discount assumed below volume threshold"});
        subtotal+=total;retail_subtotal+=retail_total;*categories.entry(cat).or_default()+=total;
    }
    for v in categories.values_mut(){*v=round(*v)}
    let mut budget_subtotal=0.;let mut overrides=0;
    let groups=categories.iter().map(|(cat,calculated)|{
        let override_value=c.category_budgets.get(cat);if override_value.is_some(){overrides+=1;}
        let budget=round(*override_value.unwrap_or(calculated));budget_subtotal+=budget;
        json!({"name":cat,"calculated":calculated,"retail":round(retail_categories[cat]),"budget":budget,"overridden":override_value.is_some(),"discountPercent":c.bulk_discounts.get(cat).copied().unwrap_or(if retail_categories[cat]>=2000.{10.}else{0.})})
    }).collect::<Vec<_>>();
    let subtotal=round(subtotal);let tax=round(subtotal*c.tax/100.);let budget_subtotal=round(budget_subtotal);let budget_tax=round(budget_subtotal*c.tax/100.);
    m["subtotal"]=json!(subtotal);m["tax"]=json!(tax);m["total"]=json!(round(subtotal+tax));m["categoryTotals"]=json!(categories);
    if m["garage"].is_object(){m["garage"]["subtotal"]=json!(round(m["items"].as_array().unwrap().iter().filter(|i|s(i,"id").starts_with("garage-")).map(|i|n(i,"total")).sum()));}
    m["categoryBudgets"]=json!(groups);m["budgetSubtotal"]=json!(budget_subtotal);m["budgetTax"]=json!(budget_tax);m["materialsBudgetTotal"]=json!(round(budget_subtotal+budget_tax));
    m["retailSubtotal"]=json!(round(retail_subtotal));m["volumeSavings"]=json!(round(retail_subtotal-subtotal));m["budgetOverrideCount"]=json!(overrides);m["pricingMode"]=json!(c.pricing_mode);
    m["pricing"]=json!({"checked":PRICE_DATE,"zip":c.zip,"unquotedLineCount":unquoted,"status":"Reference retail allowances, not live local-store pricing","bulkStatus":"Published tiers where available; other discounts are editable unquoted scenarios. Discounts are not stacked.","sources":[{"name":"ZIP retail and 80-sheet bulk reference", "url":ZIP_SOURCE},{"name":"Lowe's Pro quote and discount terms", "url":"https://www.lowes.com/l/Pro/pro-benefits"},{"name":"Fiberglass retail product references", "url":"https://www.homedepot.com/b/Building-Materials-Insulation/R21/N-5yc1vZasbsZ1z18nge"}]});
    m
}
