/**
 * Where the code's squares go in the box (packages/graphics/qr-card)
 *
 * What this module is for:
 *   qrCodeLayout.ts plans the code inside the 176 px `--qr-size` box: a whole number of px
 *   per module, so no square edge is blurred into grey, the code centred on whole px, and
 *   the SVG path of the dark modules. It also measures the light around the squares, which
 *   a camera needs to find the code.
 *
 * What these tests prove:
 *   - Each version the card draws (1 to 6) gets the largest whole cell that fits the box
 *     with its one-module quiet zone, and the leftover px split before the code, rounded
 *     down: version 6 is 4 px a module, 172 px drawn, 2 px before.
 *   - Without the theme (the box token missing) the code is drawn one px a module, never a
 *     NaN size.
 *   - For every version the card draws, the light around the squares (quiet zone, leftover
 *     and the card's 12 px light padding) is at least three modules on the narrowest side.
 *   - The path has one square per dark module, at its column and row, and nothing else.
 *
 * What these tests deliberately do not cover:
 *   - Which modules are dark; qrCodeEncoding.test.ts scans the encoder's squares.
 *   - That Chromium draws the SVG crisp at that size; the screenshots and the e2e scan do.
 */
import { describe, expect, it } from 'vitest';

import { countModulesOfVersion } from './qrCodeEncoding.js';
import {
  buildQrCodePathData,
  measureLightAroundCodeInModules,
  planQrCodeDrawing,
} from './qrCodeLayout.js';

/** The theme's code box (`--qr-size`) and the card's light padding (`--space-3`), in px. */
const ardosiaQrBoxSizePx = 176;
const ardosiaCardPaddingPx = 12;

const versionScenarios = [
  // Version 1, 21 modules: 23 with the quiet zone, 7 px each, 161 px, 7 px before.
  { name: 'version 1 is 7 px a module', version: 1, cell: 7, drawn: 161, offset: 7 },
  // Version 2: 27 units, 6 px each.
  { name: 'version 2 is 6 px a module', version: 2, cell: 6, drawn: 162, offset: 7 },
  // Version 3 (the design's own address): 31 units, 5 px each.
  { name: 'version 3 is 5 px a module', version: 3, cell: 5, drawn: 155, offset: 10 },
  // Version 4: 35 units at 5 px fill the box to 175 px, nothing before but the half px lost.
  { name: 'version 4 is 5 px a module', version: 4, cell: 5, drawn: 175, offset: 0 },
  // Version 5: 39 units, 4 px each.
  { name: 'version 5 is 4 px a module', version: 5, cell: 4, drawn: 156, offset: 10 },
  // Version 6, the largest the card draws: 43 units at the 4 px minimum.
  { name: 'version 6 is 4 px a module', version: 6, cell: 4, drawn: 172, offset: 2 },
];

describe('planQrCodeDrawing in the theme’s 176 px box', () => {
  it.each(versionScenarios)('$name', ({ version, cell, drawn, offset }) => {
    // Arrange: the module count of the version.
    const moduleCount = countModulesOfVersion(version);

    // Act: plan the drawing in the box.
    const plan = planQrCodeDrawing(moduleCount, ardosiaQrBoxSizePx);

    // Assert: whole px everywhere, the code inside the box.
    expect(plan, 'the cell, the drawn size and the offset must be whole px').toEqual({
      cellSizePx: cell,
      drawnSizePx: drawn,
      offsetPx: offset,
    });
    expect(
      plan.offsetPx + plan.drawnSizePx,
      'the code must never spill out of its box',
    ).toBeLessThanOrEqual(ardosiaQrBoxSizePx);
  });

  it('draws one px a module when the box token is missing, never a NaN size', () => {
    // Arrange: a box read from a page without the theme.
    const unreadableBoxSizePx = Number.parseFloat('');

    // Act: plan a version 3 code in it.
    const plan = planQrCodeDrawing(29, unreadableBoxSizePx);

    // Assert: one px a module with the quiet zone, nothing before.
    expect(plan, 'without the theme the code must still have a size').toEqual({
      cellSizePx: 1,
      drawnSizePx: 31,
      offsetPx: 0,
    });
  });
});

describe('the light around the squares', () => {
  it.each(versionScenarios)('$name and keeps three modules of light at least', ({ version }) => {
    // Arrange: the plan of this version in the theme's box.
    const plan = planQrCodeDrawing(countModulesOfVersion(version), ardosiaQrBoxSizePx);

    // Act: measure the light on the narrowest side, with the card's padding.
    const lightInModules = measureLightAroundCodeInModules(plan, ardosiaCardPaddingPx);

    // Assert: at least three modules, so a camera finds the code's corners.
    expect(lightInModules, 'a code needs light around it to be found').toBeGreaterThanOrEqual(3);
  });
});

describe('buildQrCodePathData', () => {
  it('writes one square per dark module at its column and row, and nothing for a light one', () => {
    // Arrange: a 3 × 3 corner of a code: a dark diagonal and one more dark module.
    const modules = [
      [true, false, false],
      [false, true, true],
      [false, false, true],
    ];

    // Act: write the path.
    const pathData = buildQrCodePathData(modules);

    // Assert: four squares, in reading order, each one module wide.
    expect(pathData, 'each dark module must be one square at its place').toBe(
      'M0 0h1v1h-1zM1 1h1v1h-1zM2 1h1v1h-1zM2 2h1v1h-1z',
    );
  });
});
