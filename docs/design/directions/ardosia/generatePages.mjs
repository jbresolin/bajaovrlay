// Writes every .html page of the "ardosia" direction beside itself from ../../sample-data.json
// through the shared slate templates (../../tools/slateTemplates.mjs), so no row is typed by
// hand. Run from the repo root: node docs/design/directions/ardosia/generatePages.mjs
import { writeFileSync } from 'node:fs';
import { buildPages } from '../../tools/slateTemplates.mjs';

// Layout budget (README.md "Tower rows"): clock 54..246, tower from 254 in 34px pills with
// 3px gaps; the strip holds as many cars as its 30px caps names allow.
const options = { name: 'ardosia', compactRows: 20, detailedRows: 19, stripCarsPerPage: 6 };

const pages = buildPages(options);
for (const [fileName, html] of Object.entries(pages)) {
  writeFileSync(new URL(fileName, import.meta.url), html);
}
console.log(`ardosia: ${Object.keys(pages).length} pages written; compact ${options.compactRows} rows, detailed ${options.detailedRows}, strip ${options.stripCarsPerPage} per page`);
