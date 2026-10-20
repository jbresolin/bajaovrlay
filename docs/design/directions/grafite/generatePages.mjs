// Writes every .html page of the "grafite" direction beside itself from ../../sample-data.json
// through the shared slate templates (../../tools/slateTemplates.mjs), so no row is typed by
// hand. Run from the repo root: node docs/design/directions/grafite/generatePages.mjs
import { writeFileSync } from 'node:fs';
import { buildPages } from '../../tools/slateTemplates.mjs';

// Layout budget (README.md "Tower rows"): clock 54..226, tower from 234 in 32px pills with
// 4px gaps; the strip holds as many cars as its 28px names allow.
const options = { name: 'grafite', compactRows: 21, detailedRows: 19, stripCarsPerPage: 6 };

const pages = buildPages(options);
for (const [fileName, html] of Object.entries(pages)) {
  writeFileSync(new URL(fileName, import.meta.url), html);
}
console.log(`grafite: ${Object.keys(pages).length} pages written; compact ${options.compactRows} rows, detailed ${options.detailedRows}, strip ${options.stripCarsPerPage} per page`);
