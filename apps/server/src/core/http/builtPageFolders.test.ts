/**
 * Serving the built control page and renderer (apps/server)
 *
 * What this module is for:
 *   In production one server answers everything: the operator's control page at `/`,
 *   the renderer OBS loads at `/render/`, and the API. The pages are the Vite `dist`
 *   folders, served only when they exist at boot.
 *
 * What these tests prove:
 *   - `/` serves the control page and `/render/` serves the renderer.
 *   - `/render` without the slash redirects (301) to `/render/`, where the renderer's
 *     relative asset paths work.
 *   - An unknown `/api/...` address still answers the JSON 404 while the pages are
 *     served, so the control page can never hide an API mistake behind HTML.
 *   - A folder that was never built is reported as missing instead of served empty.
 *
 * What these tests deliberately do not cover:
 *   - The real `dist` folders made by `pnpm build`; small stand-in pages written to a
 *     temporary folder play their part, so these tests need no build first.
 *   - Asset caching and content types beyond HTML; that is @hono/node-server's job.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it, onTestFinished } from 'vitest';

import { createLogger } from '../logger/createLogger.js';
import { findBuiltPageFolder } from './builtPageFolders.js';
import { createServerApp } from './createServerApp.js';

const controlPageHtml = '<!doctype html><title>BajaOvrLay</title><h1>Painel do operador</h1>';
const rendererPageHtml = '<!doctype html><title>Renderer</title><div id="stage"></div>';

/**
 * Builds the server app as production does after `pnpm build`: a control page folder and
 * a renderer folder, each holding an index.html. The folders are removed after the test.
 */
function createServerAppServingBuiltPages() {
  const temporaryFolder = mkdtempSync(join(tmpdir(), 'bajaovrlay-built-pages-'));
  onTestFinished(() => rmSync(temporaryFolder, { recursive: true, force: true }));

  const controlPageFolder = join(temporaryFolder, 'control-dist');
  const rendererPageFolder = join(temporaryFolder, 'renderer-dist');
  mkdirSync(controlPageFolder);
  mkdirSync(rendererPageFolder);
  writeFileSync(join(controlPageFolder, 'index.html'), controlPageHtml);
  writeFileSync(join(rendererPageFolder, 'index.html'), rendererPageHtml);

  return createServerApp({
    logger: createLogger({ level: 'silent' }),
    version: '0.3.1',
    controlPageFolder,
    rendererPageFolder,
  });
}

describe('the built pages served by the server', () => {
  it('serves the control page at /', async () => {
    // Arrange: a server app with both pages built.
    const app = createServerAppServingBuiltPages();

    // Act: open the root address, as the operator's browser does.
    const response = await app.request('/');
    const body = await response.text();

    // Assert: the answer is the control page's index.html.
    expect(response.status, 'the control page must answer 200 OK').toBe(200);
    expect(body, 'the root address must serve the control page').toBe(controlPageHtml);
  });

  it('serves the renderer at /render/', async () => {
    // Arrange: a server app with both pages built.
    const app = createServerAppServingBuiltPages();

    // Act: open the renderer address, as OBS's browser source does.
    const response = await app.request('/render/');
    const body = await response.text();

    // Assert: the answer is the renderer's index.html, not the control page.
    expect(response.status, 'the renderer must answer 200 OK').toBe(200);
    expect(body, '/render/ must serve the renderer page').toBe(rendererPageHtml);
  });

  it('redirects /render without the slash to /render/', async () => {
    // Arrange: a server app with both pages built.
    const app = createServerAppServingBuiltPages();

    // Act: open /render, as someone typing the address by hand might.
    const response = await app.request('/render');

    // Assert: a permanent redirect to /render/, where the page's asset paths work.
    expect(response.status, '/render must redirect permanently (301)').toBe(301);
    expect(response.headers.get('location'), 'the redirect must point at /render/').toBe(
      '/render/',
    );
  });

  it('still answers an unknown API address with the JSON 404', async () => {
    // Arrange: a server app with both pages built, so `/*` is served from a folder.
    const app = createServerAppServingBuiltPages();

    // Act: ask for an API address that does not exist.
    const response = await app.request('/api/v1/placar-inexistente');
    const body: unknown = await response.json();

    // Assert: the answer is the JSON 404, not the control page's HTML.
    expect(response.status, 'an unknown API address must answer 404').toBe(404);
    expect(body, 'the 404 must be the JSON error, even with the pages served').toEqual({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Endereço não encontrado no servidor.',
      },
    });
  });
});

describe('findBuiltPageFolder', () => {
  it('reports a folder that was never built as missing', () => {
    // Arrange: the address of a dist folder that does not exist.
    const folderThatWasNeverBuilt = pathToFileURL(
      join(tmpdir(), 'bajaovrlay-pagina-nunca-compilada', 'dist'),
    );

    // Act: look the folder up, as main.ts does at boot.
    const foundFolder = findBuiltPageFolder(folderThatWasNeverBuilt);

    // Assert: nothing is found, so the server skips serving that page.
    expect(foundFolder, 'a folder that does not exist must be reported as missing').toBe(undefined);
  });
});
