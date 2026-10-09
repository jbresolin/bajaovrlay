/**
 * Serving built graphic packages (apps/server)
 *
 * What this module is for:
 *   The renderer loads each OGraf graphic (manifest and web component) from the
 *   server: `/graphics/<package>/<file>` serves
 *   `packages/graphics/<package>/dist/<file>`. Only the `dist` folder of a package is
 *   reachable; its source, its package.json and anything outside packages/graphics
 *   must never be served.
 *
 * What these tests prove:
 *   - A built file and the built manifest are served with the right content type.
 *   - A package that was never built answers the JSON 404.
 *   - Attempts to climb out of `dist` (with `..`, encoded or not) answer 404 and never
 *     leak the file they aimed at.
 *
 * What these tests deliberately do not cover:
 *   - The real packages/graphics folder; small stand-in files in a temporary folder
 *     play their part, so these tests need no build first.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, onTestFinished } from 'vitest';

import { createLogger } from '../logger/createLogger.js';
import { createServerApp } from './createServerApp.js';

const builtRaceClockModule = 'export default class RaceClock extends HTMLElement {}';
const builtRaceClockManifest = '{ "id": "baja-race-clock", "main": "race-clock.js" }';
const raceClockSourceSecret = 'const segredoDoCodigoFonte = "nao deve sair do servidor";';

/**
 * Builds the server app serving a stand-in packages/graphics folder: race-clock is
 * built (dist/) and also has a source file; team-lower-third has never been built.
 */
function createServerAppServingGraphicPackages() {
  const graphicPackagesFolder = mkdtempSync(join(tmpdir(), 'bajaovrlay-graficos-'));
  onTestFinished(() => rmSync(graphicPackagesFolder, { recursive: true, force: true }));

  mkdirSync(join(graphicPackagesFolder, 'race-clock', 'dist'), { recursive: true });
  mkdirSync(join(graphicPackagesFolder, 'race-clock', 'src'));
  mkdirSync(join(graphicPackagesFolder, 'team-lower-third', 'src'), { recursive: true });
  writeFileSync(
    join(graphicPackagesFolder, 'race-clock', 'dist', 'race-clock.js'),
    builtRaceClockModule,
  );
  writeFileSync(
    join(graphicPackagesFolder, 'race-clock', 'dist', 'race-clock.ograf.json'),
    builtRaceClockManifest,
  );
  writeFileSync(
    join(graphicPackagesFolder, 'race-clock', 'src', 'race-clock.ts'),
    raceClockSourceSecret,
  );

  return createServerApp({
    logger: createLogger({ level: 'silent' }),
    version: '0.3.1',
    graphicPackagesFolder,
  });
}

describe('/graphics/<package>/<file>', () => {
  it('serves the built web component of the race clock as JavaScript', async () => {
    // Arrange: a server app with the race clock built.
    const app = createServerAppServingGraphicPackages();

    // Act: fetch its module, as the renderer does before loading the graphic.
    const response = await app.request('/graphics/race-clock/race-clock.js');
    const body = await response.text();

    // Assert: 200, JavaScript, and the built file's content.
    expect(response.status, 'a built file must answer 200 OK').toBe(200);
    expect(response.headers.get('content-type'), 'a module must be served as JS').toContain(
      'javascript',
    );
    expect(body, 'the body must be the file from dist/').toBe(builtRaceClockModule);
  });

  it('serves the built OGraf manifest as JSON', async () => {
    // Arrange: a server app with the race clock built.
    const app = createServerAppServingGraphicPackages();

    // Act: fetch the manifest.
    const response = await app.request('/graphics/race-clock/race-clock.ograf.json');

    // Assert: 200 and JSON.
    expect(response.status, 'the manifest must answer 200 OK').toBe(200);
    expect(response.headers.get('content-type'), 'the manifest must be JSON').toContain(
      'application/json',
    );
  });

  it('answers the JSON 404 for a package that was never built', async () => {
    // Arrange: a server app where team-lower-third has no dist folder.
    const app = createServerAppServingGraphicPackages();

    // Act: ask for its module.
    const response = await app.request('/graphics/team-lower-third/team-lower-third.js');

    // Assert: the usual JSON 404.
    expect(response.status, 'an unbuilt package must answer 404').toBe(404);
    expect(await response.json(), 'the 404 must be the JSON error').toEqual({
      error: { code: 'ROUTE_NOT_FOUND', message: 'Endereço não encontrado no servidor.' },
    });
  });

  const climbOutOfDistScenarios = [
    // A plain `..` is folded by URL parsing; it must not land on another folder's file.
    {
      name: 'a plain .. towards the source folder',
      address: '/graphics/race-clock/../src/race-clock.ts',
    },
    // An encoded `..` survives URL parsing, so the server itself must refuse it.
    {
      name: 'an encoded .. towards the source folder',
      address: '/graphics/race-clock/%2e%2e/src/race-clock.ts',
    },
    // An encoded slash could hide `../` inside a single path segment.
    {
      name: 'an encoded ../ inside one segment',
      address: '/graphics/race-clock/..%2Fsrc%2Frace-clock.ts',
    },
    // The package name itself is a path segment and could be used to climb.
    {
      name: 'an encoded .. as the package name',
      address: '/graphics/%2e%2e/race-clock/src/race-clock.ts',
    },
  ];

  it.each(climbOutOfDistScenarios)('refuses $name', async ({ address }) => {
    // Arrange: a server app with a source file next to dist/ that must stay private.
    const app = createServerAppServingGraphicPackages();

    // Act: try to reach it (the address comes from the table above).
    const response = await app.request(address);
    const body = await response.text();

    // Assert: 404, and the source file's content is nowhere in the answer.
    expect(response.status, 'climbing out of dist/ must answer 404').toBe(404);
    expect(body, 'the source file must never be served').not.toContain('segredoDoCodigoFonte');
  });
});
