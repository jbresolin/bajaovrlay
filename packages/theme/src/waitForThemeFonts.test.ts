/**
 * Waiting for the theme's face before a graphic's first draw (packages/theme)
 *
 * What this module is for:
 *   A graphic draws in the theme's face, Bebas Neue, which the page registers from
 *   fonts/fonts.css. Before its first draw a graphic waits for that face, so the first
 *   frame on air is not set in the fallback face. `document.fonts.ready` alone is not
 *   enough: on a cold start it can resolve before any text has asked for the face, so
 *   the helper asks for the face by name (`document.fonts.load`) first.
 *
 * What these tests prove:
 *   - The helper asks the page to load the face named by the `--font-display` token,
 *     then waits for the page's fonts to be ready.
 *   - With no token on the page it only waits for the fonts to be ready.
 *   - A face that fails to load does not make the helper reject.
 *   - A page without `document.fonts` (jsdom) resolves at once.
 *
 * What these tests deliberately do not cover:
 *   - A real font file and a real browser; the graphics' Playwright suites draw with the
 *     face and the renderer's themeOnRoot.e2e.ts checks the face is loaded from /theme/.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { waitForThemeFontsToBeReady } from './waitForThemeFonts.js';

/** What the stand-in page fonts were asked for, in order. */
type FontRequestsSeen = { loadRequests: string[]; wasReadyAwaited: boolean };

/**
 * Puts a stand-in `document.fonts` on the page that records every request and answers
 * as told: `load` resolves, or rejects when `isLoadFailing`.
 */
function installStandInPageFonts(options: { isLoadFailing: boolean }): FontRequestsSeen {
  const seen: FontRequestsSeen = { loadRequests: [], wasReadyAwaited: false };
  const standInFonts = {
    load: (fontSpec: string) => {
      seen.loadRequests.push(fontSpec);
      return options.isLoadFailing
        ? Promise.reject(new Error('fonte indisponível'))
        : Promise.resolve([]);
    },
    get ready() {
      seen.wasReadyAwaited = true;
      return Promise.resolve(standInFonts);
    },
  };
  Object.defineProperty(document, 'fonts', { value: standInFonts, configurable: true });
  return seen;
}

afterEach(() => {
  // jsdom has no document.fonts; put it back that way so the next test starts clean.
  Object.defineProperty(document, 'fonts', { value: undefined, configurable: true });
  document.documentElement.style.removeProperty('--font-display');
});

describe('waitForThemeFontsToBeReady', () => {
  it('asks for the face named by the theme token, then waits for the fonts to be ready', async () => {
    // Arrange: the theme's face on :root and a page that records font requests.
    document.documentElement.style.setProperty('--font-display', "'Bebas Neue', sans-serif");
    const seen = installStandInPageFonts({ isLoadFailing: false });

    // Act: wait as a graphic does before its first draw.
    await waitForThemeFontsToBeReady();

    // Assert: the face was asked for by name at 1em, and the fonts' ready was awaited.
    expect(seen.loadRequests, 'the face named by --font-display must be asked for').toEqual([
      "1em 'Bebas Neue', sans-serif",
    ]);
    expect(seen.wasReadyAwaited, 'the page fonts ready promise must be awaited too').toBe(true);
  });

  it('only waits for the fonts to be ready when the page has no theme token', async () => {
    // Arrange: no --font-display on :root, a recording page.
    const seen = installStandInPageFonts({ isLoadFailing: false });

    // Act: wait.
    await waitForThemeFontsToBeReady();

    // Assert: nothing was asked for by name; ready was awaited.
    expect(seen.loadRequests, 'with no token there is no face to ask for').toEqual([]);
    expect(seen.wasReadyAwaited, 'the fonts ready promise must still be awaited').toBe(true);
  });

  it('resolves even when the face fails to load', async () => {
    // Arrange: the theme token and a page whose font loading fails.
    document.documentElement.style.setProperty('--font-display', "'Bebas Neue', sans-serif");
    installStandInPageFonts({ isLoadFailing: true });

    // Act and assert: the wait ends without rejecting (the fallback face goes on air).
    await expect(
      waitForThemeFontsToBeReady(),
      'a failed font load must not keep a graphic off air',
    ).resolves.toBeUndefined();
  });

  it('resolves at once on a page without document.fonts', async () => {
    // Arrange: jsdom's page, which has no document.fonts.

    // Act and assert: nothing to wait for.
    await expect(
      waitForThemeFontsToBeReady(),
      'a page without document.fonts must not block a graphic',
    ).resolves.toBeUndefined();
  });
});
