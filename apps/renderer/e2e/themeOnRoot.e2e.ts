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
 *   - When `/theme/ardosia/tokens.css` answers 404 (routed so inside the page, before it
 *     opens), the renderer logs the error line "theme not loaded on :root", naming the
 *     token it checked and the file's address, and still builds its layers: nothing on
 *     air is blanked by a missing stylesheet.
 *
 * What these tests deliberately do not cover:
 *   - The server's headers and refusals for /theme/; the server's themeFiles.test.ts.
 *   - What a graphic draws with the tokens; each graphic's own screenshot tests.
 *   - What an unstyled graphic looks like on a page without the theme: the log line is
 *     the only thing the renderer does about it (src/themeOnRoot.test.ts has the check).
 */
import { expect, type Page, test } from '@playwright/test';

import { readThemeTokenAtEachLoad } from './fakeGraphicCalls.js';
import { openRendererAndWaitForItsLayers, startFakeServerForPage } from './fakeServerForPage.js';
import { createEnduroInstance, enduroInstanceId } from './instancesOnTheFakeServer.js';
import { collectRendererLogLines } from './rendererLogLines.js';

const bebasNeueFontSpec = "28px 'Bebas Neue'";
const themeTokensAddress = '/theme/ardosia/tokens.css';
const themeNotLoadedMessage = 'theme not loaded on :root';

/**
 * Makes the page's request for the theme's tokens answer 404, as when the server has no
 * packages/theme folder beside it. Call it before `page.goto`, like the stand-in server.
 */
async function makeThemeTokensAnswer404(page: Page): Promise<void> {
  await page.route(`**${themeTokensAddress}`, (route) =>
    route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }),
  );
}

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
      logLines.filter((line) => line.message === themeNotLoadedMessage),
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

  test('logs "theme not loaded on :root" when the tokens answer 404, and still builds its layers', async ({
    page,
  }) => {
    // Arrange: the renderer's log kept, the tokens file answering 404 inside the page,
    // and a stand-in server with nothing on air.
    const logLines = collectRendererLogLines(page);
    await makeThemeTokensAnswer404(page);
    const fakeServer = await startFakeServerForPage(page, { instancesOnAir: [] });

    // Act: open the page; it checks :root at start, then hears the hello and builds the
    // layers. Then the operator takes the clock, as on a normal day.
    await openRendererAndWaitForItsLayers(page);
    fakeServer.sendInstances([createEnduroInstance('green')]);

    // Assert: the error line names the token checked and the file to look for, and the
    // page went on: the layers are there and the clock was loaded on one of them, with
    // no token to see.
    expect(
      logLines.filter((line) => line.message === themeNotLoadedMessage),
      'the renderer must log one error line naming the token checked and the file address',
    ).toEqual([
      expect.objectContaining({
        level: 'error',
        tokenChecked: '--panel-base',
        themeAddress: themeTokensAddress,
      }),
    ]);
    await expect(
      page.locator('[data-layer-id]'),
      'every layer of the hello must still be built without the theme',
    ).toHaveCount(4);
    await expect
      .poll(() => readThemeTokenAtEachLoad(page, enduroInstanceId), {
        message: 'the clock must still be loaded on its layer without the theme',
      })
      .toEqual(['']);
  });
});
