// Writes every .html page of the "ardosia" direction beside itself from ../../sample-data.json
// through the shared slate templates (../../tools/slateTemplates.mjs), so no row is typed by
// hand, and formats each page with the repo's Prettier so the committed pages are exactly
// what `pnpm lint` expects. Run from the repo root: node docs/design/directions/ardosia/generatePages.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as prettier from 'prettier';

import { buildPages } from '../../tools/slateTemplates.mjs';

// Layout budget (README.md "Tower rows"): clock 54..246, tower from 254 in 34px pills with
// 3px gaps; the strip holds as many cars as its 30px caps names allow. gapUnit 'none': the
// face has no lowercase, so the detailed tower writes "+19,0" instead of "+19,0 S".
const options = {
  name: 'ardosia',
  compactRows: 20,
  detailedRows: 19,
  stripCarsPerPage: 6,
  gapUnit: 'none',
};

const pages = buildPages(options);
for (const [fileName, html] of Object.entries(pages)) {
  const fileUrl = new URL(fileName, import.meta.url);
  const filePath = fileURLToPath(fileUrl);
  const prettierConfig = (await prettier.resolveConfig(filePath)) ?? {};
  const formatted = await prettier.format(html, { ...prettierConfig, filepath: filePath });
  writeFileSync(fileUrl, formatted);
}
console.log(
  `ardosia: ${Object.keys(pages).length} pages written; compact ${options.compactRows} rows, detailed ${options.detailedRows}, strip ${options.stripCarsPerPage} per page`,
);
