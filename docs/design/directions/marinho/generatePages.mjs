// Writes every .html page of the "marinho" direction beside itself from ../../sample-data.json
// through the shared slate templates (../../tools/slateTemplates.mjs), so no row is typed by
// hand. Run from the repo root: node docs/design/directions/marinho/generatePages.mjs
import { writeFileSync } from 'node:fs';
import { buildPages } from '../../tools/slateTemplates.mjs';

// Layout budget (README.md "Tower rows"): clock 54..250, tower from 258 in 34px pills with
// 2px gaps; the strip holds as many cars as its 28px chips allow.
const options = { name: 'marinho', compactRows: 20, detailedRows: 19, stripCarsPerPage: 5 };

const pages = buildPages(options);
for (const [fileName, html] of Object.entries(pages)) {
  writeFileSync(new URL(fileName, import.meta.url), html);
}
console.log(`marinho: ${Object.keys(pages).length} pages written; compact ${options.compactRows} rows, detailed ${options.detailedRows}, strip ${options.stripCarsPerPage} per page`);
