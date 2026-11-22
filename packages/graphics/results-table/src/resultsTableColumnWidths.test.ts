/**
 * The widths of the page's columns (packages/graphics/results-table)
 *
 * What this module is for:
 *   Each column of a result page is as wide as its widest text, measured in the browser
 *   (BAJAOVRLAY-83); these pure functions fit those widths into the board and write the
 *   grid every pill shares. The measuring itself needs a real browser and is proven by
 *   e2e/resultsTableFit.e2e.ts.
 *
 * What these tests prove:
 *   - Columns that fit in 60% of the board keep their natural widths, rounded up.
 *   - Columns that would not are narrowed by one factor so they fill exactly that share,
 *     the team keeping the rest.
 *   - The grid is the rank, the car chip, the team taking the rest, then one width each.
 *
 * What these tests deliberately do not cover:
 *   - Measuring texts in the theme's font: the fit e2e test.
 */
import { describe, expect, it } from 'vitest';

import {
  buildResultsTableGridTemplate,
  fitColumnWidthsIntoTheBoard,
} from './resultsTableColumnWidths.js';

/** The wide boards' title-safe width, x 96..1824. */
const boardWidthPx = 1728;

describe('fitColumnWidthsIntoTheBoard', () => {
  it('keeps natural widths that fit, rounded up to whole pixels', () => {
    // Arrange: the qualifying page's six columns as measured, about 620 px in all.
    const naturalWidthsPx = [70.2, 128.6, 108, 202.4, 92.1, 75];

    // Act: fit them into the board.
    const widthsPx = fitColumnWidthsIntoTheBoard(naturalWidthsPx, boardWidthPx);

    // Assert: each kept, whole.
    expect(widthsPx, 'columns that fit keep their widths').toEqual([71, 129, 108, 203, 93, 75]);
  });

  it('narrows every column by one factor when together they would leave the team too little', () => {
    // Arrange: eight wide columns of 200 px, 1600 px against the 1036.8 px share.
    const naturalWidthsPx = [200, 200, 200, 200, 200, 200, 200, 200];

    // Act: fit them into the board.
    const widthsPx = fitColumnWidthsIntoTheBoard(naturalWidthsPx, boardWidthPx);

    // Assert: each 129 px (200 × 1036.8 / 1600, rounded down), inside the share.
    expect(widthsPx, 'each column narrowed alike').toEqual([
      129, 129, 129, 129, 129, 129, 129, 129,
    ]);
    const totalPx = widthsPx.reduce((total, width) => total + width, 0);
    expect(totalPx, 'the columns stay inside 60% of the board').toBeLessThanOrEqual(1036.8);
  });
});

describe('buildResultsTableGridTemplate', () => {
  it('writes the rank, the car chip, the team, then one width per column', () => {
    // Arrange: two columns, as the Enduro page has them.
    const widthsPx = [64, 88];

    // Act: build the grid.
    const gridTemplate = buildResultsTableGridTemplate(widthsPx);

    // Assert: the fixed tracks from the theme, the team taking the rest.
    expect(gridTemplate, 'the grid every pill shares').toBe(
      'var(--column-pos) var(--chip-width) minmax(0, 1fr) 64px 88px',
    );
  });
});
