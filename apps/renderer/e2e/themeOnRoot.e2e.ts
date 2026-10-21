/**
 * The theme on the renderer page before the first graphic loads (apps/renderer, Playwright)
 *
 * What this module is for:
 *   Every graphic draws with the theme's tokens (`var(--panel-base)` and the rest) and
 *   sets its text in the theme's face, and carries no fallback values of its own. So the
 *   renderer page must have the tokens on :root and the font registered before any
 *   graphic loads: index.html links `/theme/ardosia/tokens.css` and `/theme/fonts/fonts.css`
 *   in its head, before its script, and preloads the font file. The files come from the
 *   real server (packages/theme served at /theme/), here through the dev server's proxy.
 *
 * What these tests prove, with the real page in Chromium:
 *   - At the very moment the first graphic's `load` is called, the token `--panel-base`
 *     is already on :root (the fake graphic writes it down with the call), the renderer
 *     logged no "theme not loaded" error, and every /theme/ file the page asked for
 *     (the tokens and the font CSS among them) answered 200.
 *   - The Bebas Neue face is registered on the page and loads from /theme/fonts/.
 *
 * What these tests deliberately do not cover:
 *   - The server's headers and refusals for /theme/; the server's themeFiles.test.ts.
 *   - What a graphic draws with the tokens; each graphic's own screenshot tests.
 *   - A page whose stylesheet fails to load; src/themeOnRoot.test.ts covers the check
 *     and the log line is the only thing the renderer does about it.
 */
import { expect, type Page, test } from '@playwright/test';

import { readThemeTokenAtEachLoad } from './fakeGraphicCalls.js';
import { openRendererAndWaitForItsLayers, startFakeServerForPage } from './fakeServerForPage.js';
import { createEnduroInstance, enduroInstanceId } from './instancesOnTheFakeServer.js';
import { collectRendererLogLines } from './rendererLogLines.js';

const bebasNeueFontSpec = "28px 'Bebas Neue'";

/** One answer to a request for a theme file: the path asked for and the status answered. */
type ThemeFileAnswer = { path: string; status: number };

/**
 * Starts keeping every answer to a /theme/ request the page makes, oldest first. Call it
 * before `page.goto`, so the links in the page's head are seen.
 */
function collectThemeFileAnswers(page: Page): ThemeFileAnswer[] {
  const answers: ThemeFileAnswer[] = [];
  page.on('response', (response) => {
    const requestPath = new URL(response.url()).pathname;
    if (requestPath.startsWith('/theme/')) {
      answers.push({ path: requestPath, status: response.status() });
    }
  });
  return answers;
}

test.describe('the theme on the renderer page', () => {
  test('has the tokens on :root before the first graphic loads, served from /theme/', async ({
    page,
  }) => {
    // Arrange: the renderer's log and its /theme/ answers kept, a stand-in server with
    // nothing on air, and the page open.
    const logLines = collectRendererLogLines(page);
    const themeFileAnswers = collectThemeFileAnswers(page);
    const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });
    await openRendererAndWaitForItsLayers(page);

    // Act: the operator takes the enduro clock, the first graphic this page loads.
    fakeServer.sendInstances([createEnduroInstance('green')]);

    // Assert: when load was called the token was already on :root, the renderer did not
    // complain about the theme, and the theme files all came from the server with 200.
    await expect
      .poll(() => readThemeTokenAtEachLoad(page, enduroInstanceId), {
        message: 'the clock must have been loaded once',
      })
      .toHaveLength(1);
    const [themeTokenAtLoad] = await readThemeTokenAtEachLoad(page, enduroInstanceId);
    const themeTokenNow = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--panel-base').trim(),
    );
    expect(themeTokenAtLoad, 'the token must be on :root at the moment load is called').not.toBe(
      '',
    );
    expect(themeTokenNow, 'the token seen at load must be the one on :root now').toBe(
      themeTokenAtLoad,
    );
    expect(
      logLines.filter((line) => line.message === 'theme not loaded on :root'),
      'the renderer must not complain about the theme when it is loaded',
    ).toEqual([]);
    expect(themeFileAnswers, 'the tokens and the font CSS must have been fetched').toEqual(
      expect.arrayContaining([
        { path: '/theme/ardosia/tokens.css', status: 200 },
        { path: '/theme/fonts/fonts.css', status: 200 },
      ]),
    );
    expect(
      themeFileAnswers.filter((answer) => answer.status !== 200),
      'every /theme/ request must have answered 200',
    ).toEqual([]);
  });

  test('registers the Bebas Neue face on the page and loads it from /theme/fonts/', async ({
    page,
  }) => {
    // Arrange: the page's /theme/ answers kept, and the page open with nothing on air.
    const themeFileAnswers = collectThemeFileAnswers(page);
    await startFakeServerForPage(page, { instancesOnAir: [] });
    await openRendererAndWaitForItsLayers(page);

    // Act: wait for the page's fonts, ask for the face as a graphic's text would, and
    // read what the page knows about it.
    const faceOnThePage = await page.evaluate(async (fontSpec) => {
      await document.fonts.ready;
      await document.fonts.load(fontSpec);
      const bebasNeueFaceStatuses: string[] = [];
      document.fonts.forEach((face) => {
        const familyName = face.family.replaceAll('"', '').replaceAll("'", '');
        if (familyName === 'Bebas Neue') {
          bebasNeueFaceStatuses.push(face.status);
        }
      });
      return { isAvailable: document.fonts.check(fontSpec), bebasNeueFaceStatuses };
    }, bebasNeueFontSpec);

    // Assert: one Bebas Neue face, loaded, usable, and its file came from the server.
    expect(
      faceOnThePage.bebasNeueFaceStatuses,
      'the page must have registered one Bebas Neue face from fonts.css, and loaded it',
    ).toEqual(['loaded']);
    expect(faceOnThePage.isAvailable, 'the face must be usable by the graphics').toBe(true);
    expect(
      themeFileAnswers,
      'the font file must have been fetched from /theme/fonts/',
    ).toContainEqual({
      path: '/theme/fonts/bebas-neue/bebas-neue-latin-400-normal.woff2',
      status: 200,
    });
  });
});
