/**
 * The server's build in every hello (apps/server)
 *
 * What this module is for:
 *   After an upgrade, an open page (an OBS browser source, a control tab) still runs the
 *   bundle it loaded before. The hub puts the build of the pages it serves (`buildId`,
 *   read from build-id.json, the value the built pages embed) in each hello, so a page
 *   from another build reloads itself (packages/shared/src/build).
 *
 * What these tests prove (with a real server on a random port and real sockets):
 *   - An operator, a renderer and a monitor all find the build id in their hello.
 *   - The file is read again for each hello: after a `pnpm build` with the server still
 *     running, the next hello names the new build, the one the pages now embed, so a page
 *     that reloaded onto the new bundle is not told to reload again.
 *   - A server started with no build-id.json sends a hello with no `buildId` field at all.
 *
 * What these tests deliberately do not cover:
 *   - Reading and checking the file itself; readBuildId.test.ts.
 *   - What a page does with the id; the serverConnection tests of apps/control and
 *     apps/renderer, and packages/shared/src/build.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createTemporaryDataFolder } from '../boot/temporaryDataFolder.testSupport.js';
import { startServerOnARandomPort } from './webSocketHubOnARandomPort.testSupport.js';
import { connectWebSocketTestClient } from './webSocketTestClient.testSupport.js';

// The build of race-day morning, 19 October 2026, as scripts/writeBuildId.js writes it.
const buildOfRaceDayMorning = '2026-10-19T07:40:02.518Z';
// A rebuild at lunchtime the same day, run while the server kept going.
const buildOfRaceDayLunchtime = '2026-10-19T12:15:47.003Z';

/** Writes build-id.json naming the given build, as `pnpm build` does, at the given path. */
function writeBuildIdFileNaming(buildIdFilePath: string, buildId: string): void {
  writeFileSync(buildIdFilePath, `{\n  "buildId": "${buildId}"\n}\n`);
}

/** Makes a fresh folder for build-id.json and returns the file's path (not written yet). */
function choosePathForABuildIdFile(): string {
  return join(createTemporaryDataFolder(), 'build-id.json');
}

describe('the build id in hello', () => {
  const connectionRoles = [
    // The control page: it reloads when its bundle is older than the server.
    { name: 'gives an operator the build of the served pages', role: undefined },
    // The OBS browser source: the page that must not stay on an old bundle.
    { name: 'gives a renderer the build of the served pages', role: 'renderer' },
    // The control page's frames run the renderer's code, so they reload too.
    { name: 'gives a monitor the build of the served pages', role: 'monitor' },
  ] as const;

  it.each(connectionRoles)('$name', async ({ role }) => {
    // Arrange: a server whose build-id.json names this morning's build.
    const buildIdFilePath = choosePathForABuildIdFile();
    writeBuildIdFileNaming(buildIdFilePath, buildOfRaceDayMorning);
    const runningServer = await startServerOnARandomPort({
      buildIdFileUrl: pathToFileURL(buildIdFilePath),
    });

    // Act: a page connects in that role and waits for its hello.
    const client = await connectWebSocketTestClient(
      runningServer.port,
      role === undefined ? {} : { role },
    );
    const hello = await client.waitForMessage('hello', (message) => message.type === 'hello');

    // Assert: the hello names the build in the file.
    expect(hello.type === 'hello' && hello.buildId, 'the hello must name the served build').toBe(
      buildOfRaceDayMorning,
    );
  });

  it('names the new build once pnpm build has run with the server still up', async () => {
    // Arrange: a server booted with this morning's build, then a lunchtime rebuild that
    // rewrites build-id.json (and the served pages) without restarting the server.
    const buildIdFilePath = choosePathForABuildIdFile();
    writeBuildIdFileNaming(buildIdFilePath, buildOfRaceDayMorning);
    const runningServer = await startServerOnARandomPort({
      buildIdFileUrl: pathToFileURL(buildIdFilePath),
    });
    writeBuildIdFileNaming(buildIdFilePath, buildOfRaceDayLunchtime);

    // Act: the OBS renderer, just reloaded onto the lunchtime bundle, connects.
    const client = await connectWebSocketTestClient(runningServer.port, { role: 'renderer' });
    const hello = await client.waitForMessage('hello', (message) => message.type === 'hello');

    // Assert: the hello names the lunchtime build, so the renderer stays put instead of
    // reloading (and blanking the program output) once a minute until a restart.
    expect(
      hello.type === 'hello' && hello.buildId,
      'the hello must name the build the pages now embed, not the one at boot',
    ).toBe(buildOfRaceDayLunchtime);
  });

  it('leaves the field out when there is no build-id.json', async () => {
    // Arrange: a server pointed at a build-id.json that was never written (development).
    const runningServer = await startServerOnARandomPort({
      buildIdFileUrl: pathToFileURL(choosePathForABuildIdFile()),
    });

    // Act: a renderer connects and waits for its hello.
    const client = await connectWebSocketTestClient(runningServer.port, { role: 'renderer' });
    const hello = await client.waitForMessage('hello', (message) => message.type === 'hello');

    // Assert: there is no buildId key at all, so no page compares anything.
    expect(Object.keys(hello), 'a server with no build id must send no buildId field').toEqual([
      'type',
      'slices',
      'serverNowMs',
    ]);
  });

  it('leaves the field out when the server was given no build-id.json to read', async () => {
    // Arrange: a server started with no file to read at all, as every other hub test.
    const runningServer = await startServerOnARandomPort();

    // Act: a renderer connects and waits for its hello.
    const client = await connectWebSocketTestClient(runningServer.port, { role: 'renderer' });
    const hello = await client.waitForMessage('hello', (message) => message.type === 'hello');

    // Assert: there is no buildId key at all.
    expect(Object.keys(hello), 'a server with no build file must send no buildId field').toEqual([
      'type',
      'slices',
      'serverNowMs',
    ]);
  });
});
