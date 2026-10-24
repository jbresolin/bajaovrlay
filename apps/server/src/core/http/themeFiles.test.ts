/**
 * Serving the theme (apps/server)
 *
 * What this module is for:
 *   The renderer page links the theme's tokens and font CSS from the server, and the
 *   font file and the logo come from the same place: `/theme/<folder>/<file>` serves
 *   `packages/theme/<folder>/<file>`. Only the three folders a browser needs are
 *   reachable (ardosia/, fonts/, brand/); the motion helper's TypeScript source (src/),
 *   package.json and anything outside packages/theme must never be served. The tokens
 *   and the font CSS are small and may be edited, so they are never cached; the font
 *   file and the logo never change under their names, so they are cached for a year.
 *
 * What these tests prove:
 *   - tokens.css and fonts.css are served as CSS with `Cache-Control: no-cache`.
 *   - The woff2 font file is served as font/woff2, and the logo as image/png, both with
 *     the long immutable cache header.
 *   - The helper's source (src/), package.json and a file that does not exist answer the
 *     JSON 404.
 *   - Attempts to climb out of the served folders (with `..`, encoded or not) answer 404
 *     and never leak the file they aimed at.
 *
 * What these tests deliberately do not cover:
 *   - The real packages/theme folder; a stand-in in a temporary folder
 *     (themeFolder.testSupport.ts) plays its part, so a renamed token cannot break a
 *     server test.
 *   - That the renderer page really loads the theme; apps/renderer/e2e/themeOnRoot.e2e.ts
 *     does that against the real server.
 */
import { describe, expect, it } from 'vitest';

import { createLogger } from '../logger/createLogger.js';
import { createServerApp } from './createServerApp.js';
import {
  createStandInThemeFolder,
  standInFontFileBytes,
  standInFontsCss,
  standInLogoBytes,
  standInTokensCss,
  themeSourceSecretWord,
} from './themeFolder.testSupport.js';

const longCacheHeader = 'public, max-age=31536000, immutable';

/** Builds the server app serving the stand-in theme folder, silent and with no pages. */
function createServerAppServingTheTheme() {
  return createServerApp({
    logger: createLogger({ level: 'silent' }),
    version: '0.3.1',
    themeFolder: createStandInThemeFolder(),
  });
}

describe('/theme/<folder>/<file>', () => {
  it('serves tokens.css as CSS that is never cached, so an edit shows on the next reload', async () => {
    // Arrange: a server app serving the theme.
    const app = createServerAppServingTheTheme();

    // Act: fetch the tokens, as the renderer page's <link> does.
    const response = await app.request('/theme/ardosia/tokens.css');
    const body = await response.text();

    // Assert: 200, CSS, no-cache, and the file's content.
    expect(response.status, 'the tokens must answer 200 OK').toBe(200);
    expect(response.headers.get('content-type'), 'the tokens must be served as CSS').toContain(
      'text/css',
    );
    expect(
      response.headers.get('cache-control'),
      'the tokens must not be cached: an edited token must show on the next reload',
    ).toBe('no-cache');
    expect(body, 'the body must be the tokens file').toBe(standInTokensCss);
  });

  it('serves fonts.css as CSS that is never cached', async () => {
    // Arrange: a server app serving the theme.
    const app = createServerAppServingTheTheme();

    // Act: fetch the @font-face file.
    const response = await app.request('/theme/fonts/fonts.css');
    const body = await response.text();

    // Assert: 200, CSS, no-cache, and the file's content.
    expect(response.status, 'the font CSS must answer 200 OK').toBe(200);
    expect(response.headers.get('content-type'), 'the font CSS must be served as CSS').toContain(
      'text/css',
    );
    expect(
      response.headers.get('cache-control'),
      'the font CSS is small and may change, so it must not be cached',
    ).toBe('no-cache');
    expect(body, 'the body must be the font CSS file').toBe(standInFontsCss);
  });

  it('serves the woff2 font file as font/woff2, cached for a year', async () => {
    // Arrange: a server app serving the theme.
    const app = createServerAppServingTheTheme();

    // Act: fetch the font file, as the browser does when the @font-face is used.
    const response = await app.request('/theme/fonts/bebas-neue/bebas-neue-latin-400-normal.woff2');
    const body = Buffer.from(await response.arrayBuffer());

    // Assert: 200, the woff2 type, the long cache header, and the file's bytes.
    expect(response.status, 'the font file must answer 200 OK').toBe(200);
    expect(response.headers.get('content-type'), 'the font file must be served as woff2').toBe(
      'font/woff2',
    );
    expect(
      response.headers.get('cache-control'),
      'the font file never changes under its name, so OBS may keep it for a year',
    ).toBe(longCacheHeader);
    expect(body.equals(standInFontFileBytes), 'the body must be the font file, byte for byte').toBe(
      true,
    );
  });

  it('serves the logo as image/png, cached for a year', async () => {
    // Arrange: a server app serving the theme.
    const app = createServerAppServingTheTheme();

    // Act: fetch the white logo.
    const response = await app.request('/theme/brand/logo-branca.png');
    const body = Buffer.from(await response.arrayBuffer());

    // Assert: 200, PNG, the long cache header, and the file's bytes.
    expect(response.status, 'the logo must answer 200 OK').toBe(200);
    expect(response.headers.get('content-type'), 'the logo must be served as PNG').toBe(
      'image/png',
    );
    expect(response.headers.get('cache-control'), 'the logo must be cached for a year').toBe(
      longCacheHeader,
    );
    expect(body.equals(standInLogoBytes), 'the body must be the logo file, byte for byte').toBe(
      true,
    );
  });

  const addressesThatMustAnswer404 = [
    // The motion helper's TypeScript: a graphic imports it through Vite, never from here.
    { name: 'the motion helper’s source', address: '/theme/src/readMotionTokens.ts' },
    // The package file at the root of packages/theme.
    { name: 'package.json', address: '/theme/package.json' },
    // A file that does not exist inside a served folder.
    { name: 'a tokens file that does not exist', address: '/theme/ardosia/escuro.css' },
  ];

  it.each(addressesThatMustAnswer404)('answers the JSON 404 for $name', async ({ address }) => {
    // Arrange: a server app serving the theme.
    const app = createServerAppServingTheTheme();

    // Act: ask for the address (from the table above).
    const response = await app.request(address);

    // Assert: the usual JSON 404.
    expect(response.status, 'a file outside the served folders must answer 404').toBe(404);
    expect(await response.json(), 'the 404 must be the JSON error').toEqual({
      error: { code: 'ROUTE_NOT_FOUND', message: 'Endereço não encontrado no servidor.' },
    });
  });

  const climbOutOfTheThemeScenarios = [
    // A plain `..` is folded by URL parsing; it must not land on the source folder.
    {
      name: 'a plain .. towards the source folder',
      address: '/theme/ardosia/../src/readMotionTokens.ts',
    },
    // An encoded `..` survives URL parsing, so the server itself must refuse it.
    {
      name: 'an encoded .. towards the source folder',
      address: '/theme/ardosia/%2e%2e/src/readMotionTokens.ts',
    },
    // An encoded slash could hide `../` inside a single path segment.
    {
      name: 'an encoded ../ inside one segment',
      address: '/theme/ardosia/..%2Fsrc%2FreadMotionTokens.ts',
    },
    // The folder name itself is a path segment and could be used to climb.
    {
      name: 'an encoded .. as the folder name',
      address: '/theme/%2e%2e/theme/src/readMotionTokens.ts',
    },
  ];

  it.each(climbOutOfTheThemeScenarios)('refuses $name', async ({ address }) => {
    // Arrange: a server app serving the theme, whose src/ holds a line that must stay private.
    const app = createServerAppServingTheTheme();

    // Act: try to reach it (the address comes from the table above).
    const response = await app.request(address);
    const body = await response.text();

    // Assert: 404, and the source line is nowhere in the answer.
    expect(response.status, 'climbing out of the served folders must answer 404').toBe(404);
    expect(body, 'the source file must never be served').not.toContain(themeSourceSecretWord);
  });
});
