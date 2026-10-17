import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {initSync,defaults,calculate} from '../../public/pkg/universal_frames.js';
initSync({module:fs.readFileSync(new URL('../../public/pkg/universal_frames_bg.wasm',import.meta.url))});
const directory=path.resolve('work/rust-report-check');fs.mkdirSync(directory,{recursive:true});
const output=ts.transpileModule(fs.readFileSync('web/report.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
fs.writeFileSync(path.join(directory,'report.mjs'),output);
const report=await import(pathToFileURL(path.join(directory,'report.mjs')));
const config=JSON.parse(defaults());config.studType='LSL studs';config.county='27053';config.zip='55401';config.wallpaper='Midnight damask';config.bedroomWallpaper='Botanical silk';
const started=performance.now();const model=JSON.parse(calculate(JSON.stringify(config)));const calculateMs=performance.now()-started;
report.setReportModel(model);
process.chdir(directory);await report.exportPDF(config,'Universal Frames Rust QA');
const pdf=fs.readFileSync('Universal-Frame-UF-2048-design-cost-report.pdf');assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>15000);assert.ok(pdf.toString().includes('LOCATION & ASSEMBLIES'));
const blobs=[];const downloads=[];const old=URL.createObjectURL;URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:test-'+blobs.length;};
globalThis.document={createElement(){return {click(){downloads.push(this.download)}}}};
report.exportCSV(config);report.exportFraming(config);
assert.equal(downloads.length,2);const materials=await blobs[0].text();const framing=await blobs[1].text();
assert.ok(materials.includes('ZIP System'));assert.ok(materials.includes('fiberglass'));assert.ok(framing.includes('LSL 2x6'));assert.ok(framing.includes('Header ply'));assert.ok(framing.includes('Rough sill'));assert.ok(framing.includes('Cripple'));assert.ok(!materials.includes('undefined'));assert.ok(!framing.includes('undefined'));
for(const text of ['Unrounded net quantity','Waste percent','Purchase rounding','Bedroom wallpaper','Rest of house wallpaper','ridge vent','Soffit intake','Countertops'])assert.ok(materials.toLowerCase().includes(text.toLowerCase()),'CSV includes '+text);
for(const text of ['CIRCULATION PLANNING','Route-width target: 36 in','5 x 5 ft','OPENING HEIGHT','ROOF VENTILATION','Botanical silk','Midnight damask','HISTORIC DESIGN','Rockwell','MILLWORK'])assert.ok(pdf.toString().includes(text),'PDF includes '+text);
const twoConfig={...config,stories:2,activeFloor:1};const twoModel=JSON.parse(calculate(JSON.stringify(twoConfig)));report.setReportModel(twoModel);await report.exportPDF(twoConfig,'Two-story QA');const twoPdf=fs.readFileSync('Universal-Frame-UF-2048-design-cost-report.pdf').toString();assert.ok(twoPdf.includes('UPPER FLOOR'));assert.ok(twoPdf.includes('STRUCTURAL SCREENING'));assert.ok(twoPdf.includes('ForteWEB analysis: NOT RUN'));assert.ok(twoPdf.includes('MAIN FLOOR'));report.exportFraming(twoConfig);const twoFrame=await blobs[2].text();for(const name of ['-L2','Stair opening header','Floor I-joist'])assert.ok(twoFrame.includes(name));assert.ok(!twoFrame.includes('undefined'));console.log('PASS: both floor plans in the PDF and upper-floor/stair/floor members in the framing CSV.');

console.log('PASS: real PDF ('+pdf.length+' bytes), materials CSV and framing CSV generated from Rust data. Calculation '+calculateMs.toFixed(1)+' ms (includes first data load).');

for(const kind of ['Attached','Detached']){
 const c={...config,stories:2,activeFloor:1,garage:kind};const m=JSON.parse(calculate(JSON.stringify(c)));report.setReportModel(m);await report.exportPDF(c,kind+' garage QA');const pdf=fs.readFileSync('Universal-Frame-UF-2048-design-cost-report.pdf').toString();for(const label of ['GARAGE & SITE LAYOUT','TWO-CAR GARAGE','24 x 24 ft','Garage 16'])assert.ok(pdf.includes(label),'Garage PDF includes '+label);
 const before=blobs.length;report.exportCSV(c);report.exportFraming(c);const material=await blobs[before].text(),frame=await blobs[before+1].text();assert.ok(material.includes('Garage standing seam'));assert.ok(material.includes('Garage dedicated 20A'));assert.ok(frame.includes('G1-LVL'));assert.ok(frame.includes('Garage roof I-joist'));assert.ok(frame.includes('Garage ceiling I-joist'));assert.ok(!frame.includes('undefined'));
 const row=frame.split('\r\n').find(line=>line.includes('"G-C0"'));const values=JSON.parse('['+row+']');assert.equal(Number(values[9]),m.garage.h-.75,'Garage roof remains at ground-floor elevation in upper-floor exports');assert.ok(report.engineerSummary(c,'QA').includes(kind+' 24 x 24 ft'));
}
console.log('PASS: attached/detached garage PDF/site drawings, itemized costs and garage framing/roof CSV at correct ground-level elevation.');

URL.createObjectURL=old;

const costConfig={...config,designMode:'Affordable',laborCost:12500,landCost:18000,permitCost:8000,surveyCost:4000};const costModel=JSON.parse(calculate(JSON.stringify(costConfig)));report.setReportModel(costModel);
await report.exportPDF(costConfig,'Allowance QA');const costPdf=fs.readFileSync('Universal-Frame-UF-2048-design-cost-report.pdf').toString();
for(const value of ['PROJECT COSTS','Labor: $12500.00','Land: $18000.00','Permits: $8000.00','Survey: $4000.00','Total project budget','four-ply LVL'])assert.ok(costPdf.includes(value),'PDF includes '+value);
URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:cost-test';};const costBefore=blobs.length;report.exportCSV(costConfig);report.exportFraming(costConfig);
const costCsv=await blobs[costBefore].text(),ridgeCsv=await blobs[costBefore+1].text();for(const name of ['Labor','Land','Permits','Survey','TOTAL PROJECT BUDGET','42500'])assert.ok(costCsv.includes(name),'Cost CSV includes '+name);
assert.ok(costCsv.includes(String(costModel.projectTotal)));assert.equal(costModel.projectCostTotal,42500);assert.equal(costModel.projectTotal,Math.round((costModel.total+42500)*100)/100);
assert.equal(ridgeCsv.split('LVL ridge ply').length-1,costModel.roof.ridgeMembers.length);assert.ok(ridgeCsv.includes('RIDGE-'));
URL.createObjectURL=old;console.log('PASS: PDF/CSV include project allowances once, correct combined totals and all four LVL ridge plies.');

const featuresConfig={...config,homeStyle:'Colonial',width:40,depth:36,stories:2,activeFloor:1,pitch:8,dormerStyle:'Gable',dormerWidth:4,dormerDepth:16,dormerCount:2,rearOutdoor:'Deck',rearWidth:12,rearDepth:6,pricingMode:'Wholesale estimate',categoryBudgets:{'Roof features':1500},bulkDiscounts:{'Roof features':20}};
const featuresModel=JSON.parse(calculate(JSON.stringify(featuresConfig)));assert.equal(featuresModel.dormers.length,2);report.setReportModel(featuresModel);URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:features';};const start=blobs.length;report.exportCSV(featuresConfig);report.exportFraming(featuresConfig);const featuresCsv=await blobs[start].text(),featuresFrame=await blobs[start+1].text();
for(const name of ['Retail unit price USD','Discount percent','CATEGORY BUDGETS','USER CATEGORY BUDGET','1500','MATERIALS BUDGET INCLUDING TAX','PROJECT COST ALLOWANCES','Wholesale estimate'])assert.ok(featuresCsv.includes(name),name);
for(const name of ['DORMER-1','Dormer roof-opening LVL ply','Dormer roof','REAR-POST','REAR-DECK','stock source'])assert.ok(featuresFrame.includes(name),name);assert.ok(!featuresFrame.includes('undefined'));
await report.exportPDF(featuresConfig,'Feature cost QA');const featuresPdf=fs.readFileSync('Universal-Frame-UF-2048-design-cost-report.pdf').toString();for(const name of ['CATEGORY BUDGETS','Selected materials budget','Wholesale estimate','Roof features','DORMER-1','Rear Deck'])assert.ok(featuresPdf.includes(name),name);assert.ok(report.engineerSummary(featuresConfig,'QA').includes(featuresModel.materialsBudgetTotal.toFixed(2)));URL.createObjectURL=old;console.log('PASS: category budgets, retail/bulk pricing and separate project costs in exports; dormer cuts/opening framing and rear decking in framing CSV.');

const balconyConfig={...config,width:32,depth:40,stories:2,activeFloor:1,balcony:'Rear balcony',roomWallpapers:{},garage:'None'};
let balconyModel=JSON.parse(calculate(JSON.stringify(balconyConfig)));const paperRoom=balconyModel.levels[1].finishRooms.find(r=>r.type==='bedroom');balconyConfig.roomWallpapers[paperRoom.id]='Sapphire paisley';balconyModel=JSON.parse(calculate(JSON.stringify(balconyConfig)));assert.ok(balconyModel.balcony&&!balconyModel.balcony.existingGallery);report.setReportModel(balconyModel);
URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:balcony';};const balconyStart=blobs.length;report.exportCSV(balconyConfig);report.exportFraming(balconyConfig);const balconyCsv=await blobs[balconyStart].text(),balconyFrame=await blobs[balconyStart+1].text();
assert.ok(balconyCsv.includes('Sapphire paisley')&&balconyCsv.includes('Balcony'));for(const name of ['BALCONY-JOIST-','BALCONY-RIM-','BALCONY-BEAM-',balconyModel.balcony.posts.length?'BALCONY-POST-':'BALCONY-BRACE-','BALCONY-DOOR-L2'])assert.ok(balconyFrame.includes(name),name);assert.equal(balconyFrame.split('Balcony deck joist').length-1,balconyModel.balcony.joists.length);assert.ok(!balconyFrame.includes('undefined'));
const balconySummary=report.engineerSummary(balconyConfig,'Room and balcony QA');assert.ok(balconySummary.includes('Sapphire paisley')&&balconySummary.includes('upper doorway BALCONY-DOOR-L2'));URL.createObjectURL=old;
console.log('PASS: per-room wallpaper costs, connected balcony framing/door elevation, joist quantities and engineer summary.');
