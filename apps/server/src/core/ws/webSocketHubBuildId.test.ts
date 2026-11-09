/**
 * The server's build in every hello (apps/server)
 *
 * What this module is for:
 *   After an upgrade, an open page (an OBS browser source, a control tab) still runs the
 *   bundle it loaded before. The hub puts the build the server runs (`buildId`, read
 *   from build-id.json once at boot, the value the built pages of that build embed) in
 *   each hello, so a page from another build reloads itself (packages/shared/src/build).
 *
 * What these tests prove (with a real server on a random port and real sockets):
 *   - An operator, a renderer and a monitor all find the build id in their hello.
 *   - The file is read once, at boot: a `pnpm build` with the server still up (which
 *     rewrites build-id.json only once every package has built) changes nothing until
 *     the restart, so no page is sent into a half-built folder or a bundle newer than
 *     the server code that answers it.
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

  it('keeps naming the build it booted with after pnpm build runs with the server up', async () => {
    // Arrange: a server booted with this morning's build, then a lunchtime rebuild that
    // rewrites build-id.json (and the built folders) without restarting the server.
    const buildIdFilePath = choosePathForABuildIdFile();
    writeBuildIdFileNaming(buildIdFilePath, buildOfRaceDayMorning);
    const runningServer = await startServerOnARandomPort({
      buildIdFileUrl: pathToFileURL(buildIdFilePath),
    });
    writeBuildIdFileNaming(buildIdFilePath, buildOfRaceDayLunchtime);

    // Act: the OBS renderer's socket drops and reconnects during that rebuild.
    const client = await connectWebSocketTestClient(runningServer.port, { role: 'renderer' });
    const hello = await client.waitForMessage('hello', (message) => message.type === 'hello');

    // Assert: the hello still names this morning's build, the one this server process
    // runs, so the renderer keeps its stage instead of reloading into the rebuild.
    expect(
      hello.type === 'hello' && hello.buildId,
      'the hello must name the build the server booted with, until a restart',
    ).toBe(buildOfRaceDayMorning);
    expect(runningServer.buildId, 'the server must say which build it booted with').toBe(
      buildOfRaceDayMorning,
    );
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
      'serverClockStepCount',
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
      'serverClockStepCount',
    ]);
  });
});
