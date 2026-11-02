/**
 * A command sent over HTTP reaches every open control page (apps/server)
 *
 * What this module is for:
 *   A button on Companion changes state through the store's one path (BAJAOVRLAY-28), so
 *   the WebSocket hub broadcasts the change exactly as it does for the control page's own
 *   commands: an operator watching "Camadas" sees the clock go on air when the pad's
 *   button is pressed.
 *
 * What these tests prove (the whole server booted on a random port, a real SQLite file,
 * a real WebSocket client connected as the control page, and a real HTTP request):
 *   - After POST /api/v1/take-item/<id>, the control page receives the instances slice
 *     with the clock on air from that item, and the event log naming `api:companion`.
 *
 * What these tests deliberately do not cover:
 *   - Which slices each kind of client is sent; the hub's own tests.
 *   - Each shortcut in turn; commandShortcutRoutes.test.ts compares them through the store.
 */
import { describe, expect, it, onTestFinished } from 'vitest';

import { parseApiTokens } from '../../core/apiAccess/apiTokens.js';
import {
  apiTokensOfTheDesk,
  companionToken,
} from '../../core/apiAccess/fakeApiTokens.testSupport.js';
import { buildBootOptions } from '../../core/boot/bootedServer.testSupport.js';
import { startServer } from '../../core/boot/startServer.js';
import { committedMigrationsFolder } from '../../core/db/openDatabase.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../../core/store/builtGraphicsFolder.testSupport.js';
import {
  createRaceClockItemOnTheStore,
  shortcutsPanelHome,
} from '../../core/store/raceClockItemOnTheStore.testSupport.js';
import { connectWebSocketTestClient } from '../../core/ws/webSocketTestClient.testSupport.js';

/** Boots the whole server with Companion's and the Stream Deck's tokens; closed after the test. */
async function startServerWithTheCommandApi() {
  const parsing = parseApiTokens(apiTokensOfTheDesk);
  if (!parsing.isValid) {
    throw new Error(parsing.problem);
  }
  const runningServer = await startServer({
    ...buildBootOptions(committedMigrationsFolder),
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    apiTokens: parsing.apiTokens,
  });
  onTestFinished(() => runningServer.close());
  return runningServer;
}

describe('a command sent over HTTP is broadcast', () => {
  it('shows the control page the clock Companion put on air', async () => {
    // Arrange: the server, the corner clock as a button of "Atalhos", and a control page open.
    const runningServer = await startServerWithTheCommandApi();
    const cornerClockItemId = createRaceClockItemOnTheStore(runningServer.stateStore, {
      label: 'Relógio no canto',
      layerId: 'bug',
      home: shortcutsPanelHome,
    });
    const controlPage = await connectWebSocketTestClient(runningServer.port);
    await controlPage.waitForMessage('the hello', (message) => message.type === 'hello');

    // Act: press the pad's button for the corner clock.
    const response = await fetch(
      `http://127.0.0.1:${runningServer.port}/api/v1/take-item/${cornerClockItemId}`,
      { method: 'POST', headers: { Authorization: `Bearer ${companionToken}` } },
    );

    // Assert: accepted, and the control page hears of the instance and of who took it.
    expect(response.status, 'the button press is accepted').toBe(200);
    const slicesMessage = await controlPage.waitForMessage(
      'the instances slice with the corner clock on air',
      (message) =>
        message.type === 'slices' &&
        (message.slices.instances ?? []).some(
          (instance) => instance.itemId === cornerClockItemId && instance.target === 'program',
        ),
    );
    const eventLog = slicesMessage.type === 'slices' ? slicesMessage.slices.eventLog : undefined;
    expect(eventLog?.at(-1)?.actor, 'the control page sees Companion took it').toBe(
      'api:companion',
    );
  });
});
