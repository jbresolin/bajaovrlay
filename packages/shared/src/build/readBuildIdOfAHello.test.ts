/**
 * Reading the build id of a hello before its slices are checked (packages/shared)
 *
 * What this module is for:
 *   The page that most needs to reload after an upgrade is the one whose schemas refuse
 *   the new server's hello (a new required field, a new kind of source). Such a page
 *   never gets a ServerMessage out of that hello, so the build is read from the raw JSON
 *   with a schema of two fields only: `type: 'hello'` and `buildId`. Whatever the rest of
 *   the hello holds, the page can still compare the build and reload.
 *
 * What these tests prove:
 *   - The build id of a hello is read even when its slices are not what this page knows.
 *   - A hello naming no build, an empty id, or any other message gives no build id.
 *   - Anything that is not an object (text, a number, nothing) gives no build id.
 *
 * What these tests deliberately do not cover:
 *   - The comparison and the once-a-minute rule; reloadForNewServerBuild.test.ts.
 *   - Each page calling this when its own schema refuses a hello; the
 *     serverConnection.buildReload tests of apps/control and apps/renderer.
 */
import { describe, expect, it } from 'vitest';

import { readBuildIdOfAHello } from './readBuildIdOfAHello.js';

// The build of the upgraded server, as scripts/writeBuildId.js writes it.
const buildOfTheUpgradedServer = '2026-10-19T07:40:02.518Z';

describe('readBuildIdOfAHello', () => {
  it('reads the build id of a hello whose slices this page would refuse', () => {
    // Arrange: a hello from a newer server, whose layers are in a shape this page's
    // schema does not know.
    const helloFromANewerServer = {
      type: 'hello',
      slices: { layers: 'not-a-list', standings: [{ carNumber: 42, team: 'Baja UFPR' }] },
      serverNowMs: 1_792_400_000_000,
      buildId: buildOfTheUpgradedServer,
    };

    // Act: read the build id out of it.
    const buildId = readBuildIdOfAHello(helloFromANewerServer);

    // Assert: the id is there, so the page can still reload onto the new bundle.
    expect(buildId, 'the build id must be read whatever the slices hold').toBe(
      buildOfTheUpgradedServer,
    );
  });

  const messagesWithNoBuildId = [
    // A server from before buildId, or one started with no build-id.json.
    {
      name: 'gives no build id for a hello that names none',
      messageJson: { type: 'hello', slices: {} },
    },
    // An empty id is no build: comparing it would reload every page for nothing.
    {
      name: 'gives no build id for a hello naming an empty build',
      messageJson: { type: 'hello', slices: {}, buildId: '' },
    },
    // Only the hello names the build; a slice message with the field means nothing.
    {
      name: 'gives no build id for a message that is not a hello',
      messageJson: { type: 'slice', name: 'layers', slice: [], buildId: buildOfTheUpgradedServer },
    },
    // A message that is no JSON object at all (the page reads the text first).
    {
      name: 'gives no build id for text that is not an object',
      messageJson: 'hello',
    },
    // The page hands in undefined when the text was not JSON.
    {
      name: 'gives no build id for nothing at all',
      messageJson: undefined,
    },
  ];

  it.each(messagesWithNoBuildId)('$name', ({ messageJson }) => {
    // Arrange: the row's message, as the page parsed it from the socket.
    const parsedMessage: unknown = messageJson;

    // Act: read the build id out of it.
    const buildId = readBuildIdOfAHello(parsedMessage);

    // Assert: no build id, so the page compares nothing.
    expect(buildId, 'there must be no build id to compare').toBeUndefined();
  });
});
