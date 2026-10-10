// Browser adapters are maintained directly. Validate them without overwriting
// current features from the retired React prototype. Rust owns the model.
import fs from 'node:fs';
for (const [file,signature] of [['web/scene.ts','export function renderHouse'],['web/report.ts','export function exportCSV'],['web/additions.ts','export function addDormers']]) {
  if (!fs.existsSync(file) || !fs.readFileSync(file,'utf8').includes(signature)) throw new Error('Missing maintained adapter: '+file);
}
console.log('Maintained graphics and report adapters verified.');
