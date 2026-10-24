// Prepares the real logos for the design pages (BAJAOVRLAY-43): each team logo
// (sample_data/team_logos/<car>_<name>.<ext>) and sponsor logo
// (sample_data/sponsors/<sponsor>_<level>.<ext>) is trimmed of its empty margins, scaled to at
// most 480 px on its long side and written as WebP (it keeps transparency) under sample_data/logos/, with a manifest,
// logos.json, saying for each one the size and the surface it needs on air:
//   "dark"  a transparent logo drawn in light colours: it sits straight on the slate;
//   "light" a transparent logo in dark colours, or one drawn on a light box: it sits on a
//           light plate, so it stays legible on the slate panels.
// Some originals are huge (one is 12500 x 8334); a page that loaded them would decode
// hundreds of megabytes. Chromium (Playwright) decodes and measures every format the folder
// has (PNG, JPEG, WebP). Run from the repo root after changing a logo:
//   node docs/design/tools/prepareLogos.mjs
/* global document, Image */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';

import { chromium } from '@playwright/test';

const sampleFolder = resolve('docs/design/sample_data');
const outputFolder = resolve(sampleFolder, 'logos');
const mimeTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/** The logos to prepare: where each comes from and the name it is written under. */
function listLogoSources() {
  const teamFolder = resolve(sampleFolder, 'team_logos');
  const sponsorFolder = resolve(sampleFolder, 'sponsors');
  const teams = readdirSync(teamFolder).map((fileName) => ({
    kind: 'teams',
    key: String(Number(fileName.split('_')[0])),
    sourcePath: resolve(teamFolder, fileName),
  }));
  const sponsors = readdirSync(sponsorFolder).map((fileName) => {
    const [sponsorKey, level] = basename(fileName, extname(fileName)).split('_');
    return {
      kind: 'sponsors',
      key: sponsorKey,
      level,
      sourcePath: resolve(sponsorFolder, fileName),
    };
  });
  return [...teams, ...sponsors];
}

// Runs inside the page: decodes the logo, finds its background (transparency, or the colour
// of its corners when it has none), trims to the drawing, measures the drawing's lightness
// and answers the trimmed logo as a PNG data URL with its size and surface.
async function measureAndTrimLogoInPage({ dataUrl, maxSide }) {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const at = (x, y) => (y * width + x) * 4;
  const luminance = (index) =>
    (0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]) / 255;

  let transparentCount = 0;
  for (let index = 3; index < pixels.length; index += 4)
    if (pixels[index] < 32) transparentCount += 1;
  const isTransparent = transparentCount / (width * height) > 0.01;
  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
  const cornerColour = [0, 1, 2].map(
    (channel) => corners.reduce((sum, index) => sum + pixels[index + channel], 0) / 4,
  );
  const isBackground = (index) => {
    if (isTransparent) return pixels[index + 3] < 32;
    const distance = Math.hypot(
      ...[0, 1, 2].map((channel) => pixels[index + channel] - cornerColour[channel]),
    );
    return distance < 28;
  };

  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  let drawingCount = 0;
  let lightnessSum = 0;
  let darkCount = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = at(x, y);
      if (isBackground(index)) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      if (pixels[index + 3] < 128) continue;
      const lightness = luminance(index);
      drawingCount += 1;
      lightnessSum += lightness;
      if (lightness < 0.3) darkCount += 1;
    }
  }
  const meanLightness = lightnessSum / Math.max(1, drawingCount);
  const darkShare = darkCount / Math.max(1, drawingCount);
  const isLightDrawing = meanLightness >= 0.6 && darkShare < 0.15;
  // A logo drawn on its own dark box (no transparency, dark corners) also belongs on slate.
  const cornerLightness =
    (0.2126 * cornerColour[0] + 0.7152 * cornerColour[1] + 0.0722 * cornerColour[2]) / 255;
  const isOnDarkBox = !isTransparent && cornerLightness < 0.35;
  const surface = (isTransparent && isLightDrawing) || isOnDarkBox ? 'dark' : 'light';

  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;
  const outputScale = Math.min(1, maxSide / Math.max(cropWidth / scale, cropHeight / scale));
  const output = document.createElement('canvas');
  output.width = Math.max(1, Math.round((cropWidth / scale) * outputScale));
  output.height = Math.max(1, Math.round((cropHeight / scale) * outputScale));
  output
    .getContext('2d')
    .drawImage(
      image,
      left / scale,
      top / scale,
      cropWidth / scale,
      cropHeight / scale,
      0,
      0,
      output.width,
      output.height,
    );
  return {
    imageDataUrl: output.toDataURL('image/webp', 0.9),
    width: output.width,
    height: output.height,
    surface,
    isTransparent,
    meanLightness: Math.round(meanLightness * 100) / 100,
  };
}

// Surfaces checked by eye on a contact sheet (each logo on slate and on a light plate) where
// the measurement chose wrong: Mud Racing (27) is a white drawing with dark outlines, which
// read as a dark logo and nearly vanished on the plate.
const surfaceOverrides = { teams: { 27: 'dark' }, sponsors: {} };

const browser = await chromium.launch();
const page = await browser.newPage();
const manifest = { teams: {}, sponsors: {} };
for (const source of listLogoSources()) {
  const mimeType = mimeTypes[extname(source.sourcePath).toLowerCase()];
  const dataUrl = `data:${mimeType};base64,${readFileSync(source.sourcePath).toString('base64')}`;
  const measured = await page.evaluate(measureAndTrimLogoInPage, { dataUrl, maxSide: 480 });
  const relativeFile = `${source.kind}/${source.key}.webp`;
  mkdirSync(resolve(outputFolder, source.kind), { recursive: true });
  writeFileSync(
    resolve(outputFolder, relativeFile),
    Buffer.from(measured.imageDataUrl.split(',')[1], 'base64'),
  );
  manifest[source.kind][source.key] = {
    file: `logos/${relativeFile}`,
    width: measured.width,
    height: measured.height,
    surface: surfaceOverrides[source.kind][source.key] ?? measured.surface,
    ...(source.level === undefined ? {} : { level: source.level }),
    source: basename(source.sourcePath),
  };
  console.log(
    `${relativeFile.padEnd(26)} ${String(measured.width).padStart(4)}x${String(measured.height).padEnd(4)} ${measured.surface.padEnd(6)} transparent ${measured.isTransparent} lightness ${measured.meanLightness}`,
  );
}
await browser.close();
writeFileSync(resolve(outputFolder, 'logos.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `${Object.keys(manifest.teams).length} team logos, ${Object.keys(manifest.sponsors).length} sponsor logos`,
);
