use crate::*;

// Project allowances belong to the whole project, after both floors and garage.
// They do not receive material ordering waste or material sales tax.
pub fn apply(c: &Config, mut m: Value) -> Value {
    let costs = [
        ("laborCost", "Labor", c.labor_cost),
        ("landCost", "Land", c.land_cost),
        ("permitCost", "Permits", c.permit_cost),
        ("surveyCost", "Survey", c.survey_cost),
    ];
    let total = round(costs.iter().map(|(_, _, amount)| round(*amount)).sum());
    m["designMode"] = json!(c.design_mode);
    m["projectCosts"] = json!(costs.iter().map(|(id, name, amount)| json!({
        "id": id, "name": name, "amount": round(*amount),
        "basis": "Editable whole-project allowance; no material waste or material sales tax applied."
    })).collect::<Vec<_>>());
    m["projectCostTotal"] = json!(total);
    m["projectTotal"] = json!(round(n(&m, "materialsBudgetTotal") + total));
    m["calculatedProjectTotal"] = json!(round(n(&m, "total") + total));
    m["approvalStatus"] = json!("Local code and structural approval pending");
    if c.design_mode == "Blank slate" {
        m["designNote"] = json!("Empty shell. Add walls, openings and fixtures; a complete dwelling plan and stair access, where applicable, require review.");
    } else if c.design_mode == "Affordable" {
        m["designNote"] = json!("Simple roof, 8-foot walls, compact circulation, standard finishes and sawn studs. Room, opening and fixture screening uses the same guardrails as Premium; local approval and structural analysis remain pending.");
    } else if c.design_mode == "Premium" {
        m["designNote"] = json!("Taller walls, architectural roof, carved oversized trim and coordinated wallpaper. Local approval and structural analysis remain pending.");
    }
    m
}
