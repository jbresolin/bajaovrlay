/**
 * Tower layout tokens (packages/graphics/positions-tower)
 *
 * What this module is for:
 *   The two theme tokens the tower's paging logic (not its timelines) needs: how many
 *   rows a page holds, `--tower-rows-per-page` (20 in Ardósia: the pills that fit
 *   between the clock and the title-safe edge), and how long a page is held,
 *   `--motion-strip-hold` (7 s). Neither is a number of the graphic's own (decision 15
 *   of the context pack). This small reader takes them from the computed style of the
 *   graphic with one rule for a missing token: a usable value, never a throw and never
 *   a 0 (a 0 ms hold would turn the page every frame).
 *
 * What these tests prove:
 *   - With the tokens on :root, the rows per page and the page hold are what the tokens
 *     say (a child element reads them, as a graphic reads the renderer page's :root).
 *   - Without the rows token, or with one that is not a number, the rows per page fall
 *     back to 20, so the tower still pages on a page without the theme.
 *   - Without the hold token, or with one that is not a duration, the hold falls back
 *     to 7000 ms, never 0.
 *
 * What these tests deliberately do not cover:
 *   - The real tokens.css; the values here are set on :root by the test.
 */
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  pageHoldMsWhenTokenMissing,
  readTowerLayoutTokens,
  rowsPerPageWhenTokenMissing,
} from './towerLayoutTokens.js';

/** Puts a rows-per-page token on :root and takes it off when the test ends. */
function placeRowsPerPageTokenOnTheRoot(value: string): void {
  placeTokenOnTheRoot('--tower-rows-per-page', value);
}

/** Puts a page-hold token on :root and takes it off when the test ends. */
function placePageHoldTokenOnTheRoot(value: string): void {
  placeTokenOnTheRoot('--motion-strip-hold', value);
}

/** Puts one token on :root and takes it off when the test ends. */
function placeTokenOnTheRoot(tokenName: string, value: string): void {
  document.documentElement.style.setProperty(tokenName, value);
  onTestFinished(() => {
    document.documentElement.style.removeProperty(tokenName);
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

  it('reads the page hold from --motion-strip-hold on :root', () => {
    // Arrange: a theme that holds each page for 5 s.
    placePageHoldTokenOnTheRoot('5000ms');
    const element = createElementOnThePage();

    // Act: read the layout tokens.
    const tokens = readTowerLayoutTokens(element);

    // Assert: the hold is the theme's.
    expect(tokens.pageHoldMs, 'the page hold must come from the theme').toBe(5000);
  });

  it('falls back to 7000 ms when the hold token is missing, never to 0', () => {
    // Arrange: no hold token on :root and an element on the page.
    const element = createElementOnThePage();

    // Act: read the layout tokens.
    const tokens = readTowerLayoutTokens(element);

    // Assert: the fallback, so a tower without the theme holds each page for 7 s
    // instead of turning it every frame.
    expect(tokens.pageHoldMs, 'a missing hold token must give the fallback').toBe(
      pageHoldMsWhenTokenMissing,
    );
    expect(pageHoldMsWhenTokenMissing, 'the fallback hold is 7 s').toBe(7000);
  });

  it('falls back to 7000 ms when the hold token is not a duration', () => {
    // Arrange: a token someone wrote as a word.
    placePageHoldTokenOnTheRoot('sete segundos');
    const element = createElementOnThePage();

    // Act: read the layout tokens.
    const tokens = readTowerLayoutTokens(element);

    // Assert: the fallback, never 0.
    expect(tokens.pageHoldMs, 'a hold that is not a duration must give the fallback').toBe(7000);
  });
});
