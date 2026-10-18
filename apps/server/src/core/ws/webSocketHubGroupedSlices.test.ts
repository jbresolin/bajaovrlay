/**
 * One state change, one message on /ws (apps/server)
 *
 * What this module is for:
 *   A command can change several slices at once. "Prévia: limpar" on a layer with a
 *   preview removes the preview from `instances` and adds the layer to
 *   `previewClearedLayerIds`, and every accepted command also adds its line to `eventLog`.
 *   Sent as one `slice` message per slice, the preview page drew the moment between them
 *   ("preview gone, no marker yet": the program clock cut in, then animated out). So the
 *   hub sends every slice a state change changed in ONE `slices` message, and keeps the
 *   single `slice` message for a change of one slice only.
 *
 * What these tests prove (with a real server on a random port and a real SQLite file):
 *   - "Prévia: limpar" on a previewed layer reaches a client as one `slices` message
 *     carrying the instances, the markers and the event log as the store now holds them,
 *     with the server's clock, followed by the `commandResult`, and nothing in between.
 *   - A refused command, which changes the event log alone, still sends one `slice`
 *     message, as before the `slices` message existed.
 *
 * What these tests deliberately do not cover:
 *   - The order and the clock of the messages of a take; webSocketHub.test.ts.
 *   - The rules of previewClearLayer itself; reducers/previewClearLayer tests.
 *   - What a client does with the group; the renderer's and the control page's
 *     serverConnection tests.
 */
import type { ServerMessage } from '@bajaovrlay/shared';
import { describe, expect, it, onTestFinished } from 'vitest';

import { startServer } from '../boot/startServer.js';
import { committedMigrationsFolder } from '../db/openDatabase.js';
import { createTemporaryDatabasePath } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../store/builtGraphicsFolder.testSupport.js';
import {
  createRaceClockItemOnTheStore,
  shortcutsPanelHome,
} from '../store/raceClockItemOnTheStore.testSupport.js';
import { connectWebSocketTestClient } from './webSocketTestClient.testSupport.js';

// The server's clock is held at 14:32:05 UTC on 9 October 2026.
const momentTheServerClockIsHeldAt = '2026-10-09T14:32:05.000Z';
const momentTheServerClockIsHeldAtInMilliseconds = 1_791_556_325_000;

/**
 * Starts the whole server, silent, on a random free port with a fresh temporary
 * database, the race clock registered and its clock held. It is shut down when the test ends.
 */
async function startServerOnARandomPort() {
  const runningServer = await startServer({
    logger: createLogger({ level: 'silent' }),
    version: '0.3.1',
    host: '127.0.0.1',
    port: 0,
    databasePath: createTemporaryDatabasePath(),
    migrationsFolder: committedMigrationsFolder,
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    readCurrentTime: () => new Date(momentTheServerClockIsHeldAt),
  });
  onTestFinished(() => runningServer.close());
  return runningServer;
}

/** True for the commandResult answering the given requestId. */
function isCommandResultFor(requestId: string) {
  return (message: ServerMessage) =>
    message.type === 'commandResult' && message.requestId === requestId;
}

/** Names each message by its type, and a slice message by its slice too, in arrival order. */
function describeEachMessage(messages: ServerMessage[]): string[] {
  return messages.map((message) =>
    message.type === 'slice' ? `slice ${message.name}` : message.type,
  );
}

describe('a command that changes several slices', () => {
  it('sends the instances, the markers and the event log of "Prévia: limpar" as one slices message', async () => {
    // Arrange: a running server holding the enduro clock as a button of "Atalhos", and
    // the control page, with that clock item previewed on the clock layer.
    const runningServer = await startServerOnARandomPort();
    const enduroClockItemId = createRaceClockItemOnTheStore(runningServer.stateStore, {
      home: shortcutsPanelHome,
    });
    const controlPage = await connectWebSocketTestClient(runningServer.port);
    controlPage.sendJson({
      type: 'command',
      requestId: 'pedido-1',
      command: { type: 'previewItem', itemId: enduroClockItemId },
    });
    await controlPage.waitForMessage('preview result', isCommandResultFor('pedido-1'));
    const numberOfMessagesBeforeTheClear = controlPage.readReceivedMessages().length;

    // Act: "Prévia: limpar" on the clock layer, which throws the preview away and marks it.
    controlPage.sendJson({
      type: 'command',
      requestId: 'pedido-2',
      command: { type: 'previewClearLayer', layerId: 'clock' },
    });
    await controlPage.waitForMessage('clear result', isCommandResultFor('pedido-2'));

    // Assert: exactly one slices message and then the ok, and that message carries the
    // three changed slices as the store now holds them, with the server's clock.
    const messagesOfTheClear = controlPage
      .readReceivedMessages()
      .slice(numberOfMessagesBeforeTheClear);
    const slicesNow = runningServer.stateStore.readAllSlices();
    expect(
      describeEachMessage(messagesOfTheClear),
      'one state change must reach the client as ONE message, before the ok',
    ).toEqual(['slices', 'commandResult']);
    expect(
      messagesOfTheClear[0],
      'the slices message must carry every slice the clear changed, and only those',
    ).toEqual({
      type: 'slices',
      slices: {
        instances: slicesNow.instances,
        previewClearedLayerIds: slicesNow.previewClearedLayerIds,
        eventLog: slicesNow.eventLog,
      },
      serverNowMs: momentTheServerClockIsHeldAtInMilliseconds,
    });
    expect(slicesNow.instances, 'the preview must be gone from the store').toEqual([]);
    expect(slicesNow.previewClearedLayerIds, 'the clock layer must be marked').toEqual(['clock']);
  });
});

describe('a command that changes one slice', () => {
  it('still sends the event log of a refused command as one slice message', async () => {
    // Arrange: a running server and the control page connected.
    const runningServer = await startServerOnARandomPort();
    const controlPage = await connectWebSocketTestClient(runningServer.port);
    await controlPage.waitForMessage('hello', (message) => message.type === 'hello');

    // Act: clear a layer that does not exist; the refusal is logged, nothing else changes.
    controlPage.sendJson({
      type: 'command',
      requestId: 'pedido-3',
      command: { type: 'clearLayer', layerId: 'placar' },
    });
    await controlPage.waitForMessage('refusal', isCommandResultFor('pedido-3'));

    // Assert: hello, one slice message for the event log, then the refusal.
    expect(
      describeEachMessage(controlPage.readReceivedMessages()),
      'a change of one slice must still be one slice message',
    ).toEqual(['hello', 'slice eventLog', 'commandResult']);
  });
});
