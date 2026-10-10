import fs from 'node:fs';

// Extend the generated report adapter after the existing floor/garage adapters.
export function affordabilityReports() {
  let s = fs.readFileSync('web/report.ts', 'utf8');
  const replace = (from, to) => { s = s.replace(from, () => to); };
  replace('Listed furniture is included; loose decor, labor, freight, sitework, permits, land and engineering fees are excluded.', 'Listed furniture is included. Labor, land, permits and survey use editable whole-project allowances, added once without material waste or material sales tax. Loose decor, freight, sitework and engineering fees are excluded.');
  replace("['','','TOTAL BUDGET','','','','',m.total]", "['','','MATERIALS INCLUDING TAX','','','','',m.total],...(m.projectCosts||[]).map(i=>[`UF-${c.seed}`,'Project costs',i.name,1,1,'allowance',i.amount,i.amount,'Editable project allowance',i.basis,1,0,'Two decimal places']),['','','PROJECT COST ALLOWANCES','','','','',m.projectCostTotal],['','','TOTAL PROJECT BUDGET','','','','',m.projectTotal]");
  replace('...m.rafters.map(r=>', "...(m.roof.ridgeMembers||[]).map(v=>[`UF-${c.seed}`,v.id,v.wallId,'','Roof framing',v.role,v.material,'',v.x1,v.y1+((c.stories||1)-1)*(m.h+1.25),v.z1,v.x2,v.y2+((c.stories||1)-1)*(m.h+1.25),v.z2,v.length,Math.round(v.length*12*1000)/1000,v.stockLength,v.status]),...m.rafters.map(r=>");
  replace('Material budget: USD ${m.total.toFixed(2)} using editable sample rates.', "Materials including tax: USD ${m.total.toFixed(2)} using editable sample rates.\\nProject allowances: ${(m.projectCosts||[]).map(v=>v.name+' USD '+v.amount.toFixed(2)).join('; ')}.\\nTotal project budget: USD ${m.projectTotal.toFixed(2)}.\\nDesign mode: ${c.designMode || 'Custom'}.");
  replace('Ridge/support beam and connection allowances included.', 'Four 1-3/4 in LVL ridge plies (7 in built width), assembly fasteners, supports and rafter-connection allowances included. Beam depth/grade, fastener schedule and bearing require engineering.');
  replace("text('DESIGN SPECIFICATION',true,12);", "text('DESIGN SPECIFICATION',true,12);text('Design mode: '+(c.designMode||'Custom')+'. '+(m.designNote||''));");
  replace('Total budget: $${m.total.toFixed(2)}.', 'Materials including tax: $${m.total.toFixed(2)}.');
  replace("text('All unit prices are editable sample budget rates", "text('PROJECT COSTS',true,12);for(const cost of m.projectCosts||[])text(cost.name+': $'+cost.amount.toFixed(2));text('Total project allowances: $'+m.projectCostTotal.toFixed(2)+'. Total project budget: $'+m.projectTotal.toFixed(2)+'.',true,12);text('Project allowances are added once. No material waste or material sales tax is applied to labor, land, permits or survey.');text('All unit prices are editable sample budget rates");
  replace('ROOF FRAMING: I-joist rafters require a supported ridge.', 'ROOF FRAMING: I-joist rafters connect to a four-ply LVL structural ridge. Four 1-3/4 in plies form a 7 in built width; 15 in drawn depth is schematic, not a selected capacity. Grade, depth, ply fastening, rafter hangers, splices, bearing, posts and the foundation load path require engineering, including cathedral roofs.');
  replace('The separate framing CSV lists every modeled wall/gable piece, roof rafter and ceiling joist,', 'The separate framing CSV lists every modeled wall/gable piece, four LVL plies per ridge edge, roof rafter and ceiling joist,');
  fs.writeFileSync('web/report.ts', s);
}
