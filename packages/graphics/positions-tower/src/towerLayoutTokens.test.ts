/**
 * Tower layout tokens (packages/graphics/positions-tower)
 *
 * What this module is for:
 *   How many rows a page holds is the theme's `--tower-rows-per-page` (20 in Ardósia: the
 *   pills that fit between the clock and the title-safe edge), not a number of the
 *   graphic's own (decision 15 of the context pack). The token is not a motion token, so
 *   `readMotionTokens` does not read it; this small reader does, from the computed style
 *   of the graphic, with the same rule for a missing token: a usable value, never a throw.
 *
 * What these tests prove:
 *   - With the token on :root, the rows per page are what the token says (a child element
 *     reads it, as a graphic reads the renderer page's :root).
 *   - Without the token, or with one that is not a number, the rows per page fall back
 *     to 20, so the tower still pages on a page without the theme.
 *
 * What these tests deliberately do not cover:
 *   - The real tokens.css; the value here is set on :root by the test.
 */
import { describe, expect, it, onTestFinished } from 'vitest';

import { readTowerLayoutTokens, rowsPerPageWhenTokenMissing } from './towerLayoutTokens.js';

/** Puts a rows-per-page token on :root and takes it off when the test ends. */
function placeRowsPerPageTokenOnTheRoot(value: string): void {
  document.documentElement.style.setProperty('--tower-rows-per-page', value);
  onTestFinished(() => {
    document.documentElement.style.removeProperty('--tower-rows-per-page');
  });
}

/** An element on the page that reads the tokens, as the graphic does. */
function createElementOnThePage(): HTMLElement {
  const element = document.createElement('section');
  document.body.append(element);
  onTestFinished(() => element.remove());
  return element;
}

describe('readTowerLayoutTokens', () => {
  it('reads the rows per page from the token on :root', () => {
    // Arrange: a theme that fits 21 rows (a clock without its flag band, say).
    placeRowsPerPageTokenOnTheRoot('21');
    const element = createElementOnThePage();

    // Act: read the layout tokens from the element.
    const tokens = readTowerLayoutTokens(element);

    // Assert: the value is the token's, not a number of the graphic's own.
    expect(tokens.rowsPerPage, 'the rows per page must come from the theme').toBe(21);
  });

  it('falls back to 20 rows when the token is missing', () => {
    // Arrange: no token on :root (nothing placed) and an element on the page.
    const element = createElementOnThePage();

    // Act: read the layout tokens.
    const tokens = readTowerLayoutTokens(element);

    // Assert: the fallback, so the tower still pages without the theme.
    expect(tokens.rowsPerPage, 'a missing token must give the fallback').toBe(
      rowsPerPageWhenTokenMissing,
    );
    expect(rowsPerPageWhenTokenMissing, 'the fallback is 20 rows').toBe(20);
  });

  it('falls back to 20 rows when the token is not a number', () => {
    // Arrange: a token someone wrote as a word.
    placeRowsPerPageTokenOnTheRoot('vinte');
    const element = createElementOnThePage();

    // Act: read the layout tokens.
    const tokens = readTowerLayoutTokens(element);

    // Assert: the fallback, never NaN.
    expect(tokens.rowsPerPage, 'a token that is not a number must give the fallback').toBe(20);
  });
});
