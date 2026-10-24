// Screenshots every mock-up page of one or more design directions at 1920x1080, over footage
// frame 1 of docs/brand/frames/ and over plain mid-grey and near-black. Run from the repo
// root (Playwright comes from the repo's node_modules):
//   node docs/design/tools/screenshot.mjs ardosia           one direction
//   node docs/design/tools/screenshot.mjs ardosia outra     several
//   node docs/design/tools/screenshot.mjs --all             every folder under directions/
//   node docs/design/tools/screenshot.mjs --png ardosia     lossless PNG instead of JPEG
//   node docs/design/tools/screenshot.mjs --every-frame ardosia   over every footage frame
//
// The page contract: a mock-up page is 1920x1080, and its <body> (or a .stage element) paints
// its background from the CSS custom property --stage-background, which this tool sets on
// <html> before shooting. A page never loads anything from the network.
//
// File format: JPEG, each file at most about 300 KB (the quality starts at 85 and steps down
// until the file fits; a flat grey or black shot is far smaller at 85 already), because a
// 1920x1080 PNG of a photo is 2 to 3 MB and there are dozens of them. --png keeps every shot
// lossless instead.
// The page.evaluate callbacks below run inside the browser page, not in Node.
/* global document */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

const toolsFolder = dirname(fileURLToPath(import.meta.url));
const designFolder = resolve(toolsFolder, '..');
const directionsFolder = resolve(designFolder, 'directions');
const framesFolder = resolve(designFolder, '../brand/frames');

const arguments_ = process.argv.slice(2);
const wantsLosslessFootage = arguments_.includes('--png');
const wantsEveryDirection = arguments_.includes('--all');
const namedDirections = arguments_.filter((argument) => !argument.startsWith('--'));

const directionNames = wantsEveryDirection
  ? readdirSync(directionsFolder, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : namedDirections;

if (directionNames.length === 0) {
  console.error('Name a direction folder (or --all).');
  process.exit(1);
}

// Frame 1 only, unless --every-frame (João's trim on PR #21): one footage frame shows a
// graphic over the stream, grey and black show it against its two extremes, and every
// frame over every page made the folder 60 MB.
const wantsEveryFrame = arguments_.includes('--every-frame');
const frameFiles = readdirSync(framesFolder)
  .filter((name) => name.endsWith('.jpg'))
  .filter((name) => wantsEveryFrame || name === '1.jpg')
  .sort();

/** The backgrounds a page is shot over: the footage frame(s), then the two plain colours. */
const backgrounds = [
  ...frameFiles.map((name) => ({
    name: `frame-${basename(name, '.jpg')}`,
    cssValue: `url("${pathToFileURL(resolve(framesFolder, name)).href}")`,
    isFootage: true,
  })),
  { name: 'grey', cssValue: '#7f7f7f', isFootage: false },
  { name: 'black', cssValue: '#0a0a0a', isFootage: false },
];

/** Pages the tool shoots: every .html in the direction folder except the motion demo. */
function listPagesOfDirection(directionFolder) {
  return readdirSync(directionFolder)
    .filter((name) => name.endsWith('.html') && !name.startsWith('motion'))
    .sort();
}

const stageClip = { x: 0, y: 0, width: 1920, height: 1080 };
const targetJpegBytes = 320 * 1024;

/** Shoots the stage as JPEG, stepping the quality down from 85 until the file is near 300 KB. */
async function shootJpegNearTargetSize(page) {
  let shot = null;
  for (const quality of [85, 80, 75, 70, 65, 60]) {
    shot = await page.screenshot({ type: 'jpeg', quality, clip: stageClip });
    if (shot.length <= targetJpegBytes) {
      return shot;
    }
  }
  return shot;
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

let shotCount = 0;
for (const directionName of directionNames) {
  const directionFolder = resolve(directionsFolder, directionName);
  if (!existsSync(directionFolder)) {
    console.error(`No direction folder: ${directionFolder}`);
    process.exit(1);
  }
  const screenshotsFolder = resolve(directionFolder, 'screenshots');
  mkdirSync(screenshotsFolder, { recursive: true });

  for (const pageFile of listPagesOfDirection(directionFolder)) {
    const pageName = basename(pageFile, '.html');
    await page.goto(pathToFileURL(resolve(directionFolder, pageFile)).href);
    await page.evaluate(() => document.fonts.ready);

    // A reference sheet (sheet-*.html) is not an on-air composition: grey and black are enough.
    const isReferenceSheet = pageName.startsWith('sheet-');
    const backgroundsForThisPage = isReferenceSheet
      ? backgrounds.filter((background) => !background.isFootage)
      : backgrounds;

    for (const background of backgroundsForThisPage) {
      await page.evaluate((cssValue) => {
        document.documentElement.style.setProperty('--stage-background', cssValue);
      }, background.cssValue);
      // Let the background image decode and any entrance animation settle.
      await page.waitForTimeout(250);

      const outputPath = resolve(
        screenshotsFolder,
        `${pageName}.${background.name}.${wantsLosslessFootage ? 'png' : 'jpg'}`,
      );
      if (wantsLosslessFootage) {
        await page.screenshot({ path: outputPath, type: 'png', clip: stageClip });
      } else {
        writeFileSync(outputPath, await shootJpegNearTargetSize(page));
      }
      shotCount += 1;
    }
    console.log(`${directionName}/${pageName}: ${backgroundsForThisPage.length} shots`);
  }
}

await browser.close();
console.log(`${shotCount} screenshots written`);
