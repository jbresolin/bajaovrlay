// Objective checks on the mock-up pages of a direction, so a reviewer does not have to
// measure by eye: for every on-air graphic root (an element with data-graphic="<name>") it
// prints the bounding box, whether it stays inside the 90% title-safe area (x 96..1824,
// y 54..1026), how many data-row rows it holds, and the smallest font-size of any text in it.
// Run from the repo root:
//   node docs/design/tools/checkLayout.mjs placar
import { readdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const toolsFolder = dirname(fileURLToPath(import.meta.url));
const directionsFolder = resolve(toolsFolder, '../directions');
const directionName = process.argv[2];
if (!directionName) {
  console.error('Name a direction folder.');
  process.exit(1);
}
const directionFolder = resolve(directionsFolder, directionName);

const titleSafe = { left: 96, top: 54, right: 1824, bottom: 1026 };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
let problemCount = 0;

// Reference sheets (sheet-*.html) and the motion demo are not on-air compositions.
const pageFiles = readdirSync(directionFolder)
  .filter((name) => name.endsWith('.html') && !name.startsWith('motion') && !name.startsWith('sheet-'))
  .sort();

for (const pageFile of pageFiles) {
  await page.goto(pathToFileURL(resolve(directionFolder, pageFile)).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  const report = await page.evaluate(() => {
    const roots = [...document.querySelectorAll('[data-graphic]')];
    return roots.map((root) => {
      const rect = root.getBoundingClientRect();
      const rows = root.querySelectorAll('[data-row]').length;
      let smallestFontPx = Infinity;
      let smallestFontSample = '';
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const textNode = walker.currentNode;
        if (textNode.textContent.trim() === '') continue;
        const element = textNode.parentElement;
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
        const fontPx = Number.parseFloat(style.fontSize);
        if (fontPx < smallestFontPx) {
          smallestFontPx = fontPx;
          smallestFontSample = textNode.textContent.trim().slice(0, 24);
        }
      }
      return {
        name: root.dataset.graphic,
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        rows,
        smallestFontPx: smallestFontPx === Infinity ? null : smallestFontPx,
        smallestFontSample,
      };
    });
  });

  console.log(`\n${directionName}/${basename(pageFile)}`);
  if (report.length === 0) {
    console.log('  (no [data-graphic] root found — the page contract requires one per graphic)');
    problemCount += 1;
  }
  for (const graphic of report) {
    const insideSafe =
      graphic.left >= titleSafe.left &&
      graphic.top >= titleSafe.top &&
      graphic.right <= titleSafe.right &&
      graphic.bottom <= titleSafe.bottom;
    if (!insideSafe) problemCount += 1;
    const box = `x ${graphic.left}..${graphic.right}, y ${graphic.top}..${graphic.bottom}`;
    const rows = graphic.rows > 0 ? `, ${graphic.rows} rows` : '';
    const font = graphic.smallestFontPx === null ? '' : `, smallest text ${graphic.smallestFontPx}px ("${graphic.smallestFontSample}")`;
    console.log(`  ${graphic.name}: ${box}${rows}${font} — ${insideSafe ? 'inside title-safe' : 'OUTSIDE TITLE-SAFE'}`);
  }
}

await browser.close();
console.log(`\n${problemCount === 0 ? 'every graphic is inside the title-safe area' : `${problemCount} problem(s)`}`);
process.exit(problemCount === 0 ? 0 : 1);
