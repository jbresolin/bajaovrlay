/**
 * The server's build in every hello (apps/server)
 *
 * What this module is for:
 *   After an upgrade, an open page (an OBS browser source, a control tab) still runs the
 *   bundle it loaded before. The hub puts the server's build (`buildId`, read at boot
 *   from build-id.json, the value the built pages embed) in each hello, so a page from
 *   another build reloads itself (packages/shared/src/build).
 *
 * What these tests prove (with a real server on a random port and real sockets):
 *   - An operator, a renderer and a monitor all find the server's build id in their hello.
 *   - A server started with no build id sends a hello with no `buildId` field at all.
 *
 * What these tests deliberately do not cover:
 *   - Reading build-id.json at boot; readBuildId.test.ts.
 *   - What a page does with the id; the serverConnection tests of apps/control and
 *     apps/renderer, and packages/shared/src/build.
 */
import { describe, expect, it } from 'vitest';

import { startServerOnARandomPort } from './webSocketHubOnARandomPort.testSupport.js';
import { connectWebSocketTestClient } from './webSocketTestClient.testSupport.js';

// The build of race-day morning, 19 October 2026, as scripts/writeBuildId.js writes it.
const buildOfThisServer = '2026-10-19T07:40:02.518Z';

describe('the build id in hello', () => {
  const connectionRoles = [
    // The control page: it reloads when its bundle is older than the server.
    { name: 'gives an operator the build of the server', role: undefined },
    // The OBS browser source: the page that must not stay on an old bundle.
    { name: 'gives a renderer the build of the server', role: 'renderer' },
    // The control page's frames run the renderer's code, so they reload too.
    { name: 'gives a monitor the build of the server', role: 'monitor' },
  ] as const;

  it.each(connectionRoles)('$name', async ({ role }) => {
    // Arrange: a server started with this morning's build id.
    const runningServer = await startServerOnARandomPort({ buildId: buildOfThisServer });

    // Act: a page connects in that role and waits for its hello.
    const client = await connectWebSocketTestClient(
      runningServer.port,
      role === undefined ? {} : { role },
    );
    const hello = await client.waitForMessage('hello', (message) => message.type === 'hello');

    // Assert: the hello names the build the server runs.
    expect(hello.type === 'hello' && hello.buildId, 'the hello must name the server build').toBe(
      buildOfThisServer,
    );
  });

  it('leaves the field out when the server was started with no build id', async () => {
    // Arrange: a server started with no build-id.json (as in development).
    const runningServer = await startServerOnARandomPort();

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
});
