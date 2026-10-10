/**
 * Renderer and operator connections on /ws (apps/server)
 *
 * What this module is for:
 *   The renderer page connects to `/ws?role=renderer` and, after a graphic's play
 *   finished (or its load failed), sends an `instanceStatus` message. The server turns
 *   that message into the `reportInstanceStatus` command and runs it through the same
 *   path as every other command, under the actor `renderer:<connection id>`. A
 *   connection without that role is an operator, `operador:<connection id>`.
 *
 * What these tests prove (with a real server on a random port and a real SQLite file):
 *   - A connection to `/ws` acts as `operador:<its own id>`, and one to
 *     `/ws?role=renderer` as `renderer:<its own id>`, as the event log shows.
 *   - A renderer's `instanceStatus` moves the instance to on-air, every client gets the
 *     new instances slice, and the renderer gets an ok `commandResult` whose requestId
 *     is null (the message carries none).
 *   - The same message from an operator connection is answered NOT_ALLOWED in pt-BR.
 *
 * What these tests deliberately do not cover:
 *   - The status rules themselves; reducers/reportInstanceStatus.test.ts covers them.
 *   - Everything else the hub does; webSocketHub.test.ts covers it.
 */
import type { ServerMessage } from '@bajaovrlay/shared';
import { describe, expect, it, onTestFinished } from 'vitest';

import { startServer } from '../boot/startServer.js';
import { committedMigrationsFolder } from '../db/openDatabase.js';
import { createTemporaryDatabasePath } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../store/builtGraphicsFolder.testSupport.js';
import {
  connectWebSocketTestClient,
  type WebSocketTestClient,
} from './webSocketTestClient.testSupport.js';

const takeRaceClockCommand = {
  type: 'takeGraphic',
  graphicId: 'race-clock',
  layerId: 'clock',
  // All six fields the race clock's manifest schema requires: the enduro under green
  // flag, 1:05:00 in and running.
  data: {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_900_000,
    referenceWallClockMs: 1_791_550_800_000,
    running: true,
  },
};

// A random UUID as node:crypto writes it, which is what the hub uses as connection id.
const uuidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/**
 * Starts the whole server, silent, on a random free port with a fresh temporary
 * database and the race clock registered. It is shut down when the test ends.
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
  });
  onTestFinished(() => runningServer.close());
  return runningServer;
}

/** True for any `commandResult` message. */
function isCommandResultMessage(message: ServerMessage): boolean {
  return message.type === 'commandResult';
}

/** True for an instances slice whose only instance is on air. */
function isInstancesSliceWithOneInstanceOnAir(message: ServerMessage): boolean {
  return (
    message.type === 'slice' &&
    message.name === 'instances' &&
    message.slice.length === 1 &&
    message.slice[0]?.status === 'on-air'
  );
}

/** Takes the race clock from the control page and waits until the server has answered. */
async function takeRaceClockFromControlPage(controlPage: WebSocketTestClient): Promise<void> {
  controlPage.sendJson({ type: 'command', requestId: 'pedido-1', command: takeRaceClockCommand });
  await controlPage.waitForMessage('take result', isCommandResultMessage);
}

describe('the actor of a connection', () => {
  it('is operador:<connection id> for a connection to /ws with no role', async () => {
    // Arrange: a running server and the control page connected to plain /ws.
    const runningServer = await startServerOnARandomPort();
    const controlPage = await connectWebSocketTestClient(runningServer.port);

    // Act: the control page takes the race clock.
    await takeRaceClockFromControlPage(controlPage);

    // Assert: the event log names an operator with a connection id of its own.
    const actorOfTheTake = runningServer.stateStore.readAllSlices().eventLog[0]?.actor;
    expect(actorOfTheTake, 'a connection without a role must act as an operator').toMatch(
      new RegExp(`^operador:${uuidPattern}$`),
    );
  });

  it('is renderer:<connection id> for a connection to /ws?role=renderer', async () => {
    // Arrange: a running server with the race clock taken, and a renderer connected.
    const runningServer = await startServerOnARandomPort();
    const controlPage = await connectWebSocketTestClient(runningServer.port);
    const renderer = await connectWebSocketTestClient(runningServer.port, { role: 'renderer' });
    await takeRaceClockFromControlPage(controlPage);
    const idOfTheRaceClockInstance = runningServer.stateStore.readAllSlices().instances[0]?.id;

    // Act: the renderer reports the clock on air and waits for the answer.
    renderer.sendJson({
      type: 'instanceStatus',
      instanceId: idOfTheRaceClockInstance,
      status: 'on-air',
    });
    await renderer.waitForMessage('report result', isCommandResultMessage);

    // Assert: the report is in the event log under a renderer with its own connection id.
    const entryOfTheReport = runningServer.stateStore.readAllSlices().eventLog[1];
    expect(entryOfTheReport?.command, 'the message must run as reportInstanceStatus').toBe(
      'reportInstanceStatus',
    );
    expect(entryOfTheReport?.actor, 'a ?role=renderer connection must act as a renderer').toMatch(
      new RegExp(`^renderer:${uuidPattern}$`),
    );
  });
});

describe('an instanceStatus message', () => {
  it('from a renderer puts the instance on air for every client and is answered ok', async () => {
    // Arrange: a running server with the race clock taken, and a renderer connected.
    const runningServer = await startServerOnARandomPort();
    const controlPage = await connectWebSocketTestClient(runningServer.port);
    const renderer = await connectWebSocketTestClient(runningServer.port, { role: 'renderer' });
    await takeRaceClockFromControlPage(controlPage);
    const idOfTheRaceClockInstance = runningServer.stateStore.readAllSlices().instances[0]?.id;

    // Act: the renderer reports that the clock's play finished.
    renderer.sendJson({
      type: 'instanceStatus',
      instanceId: idOfTheRaceClockInstance,
      status: 'on-air',
    });
    const sliceOnControlPage = await controlPage.waitForMessage(
      'instances slice with the clock on air',
      isInstancesSliceWithOneInstanceOnAir,
    );
    const resultOnRenderer = await renderer.waitForMessage('report result', isCommandResultMessage);

    // Assert: the control page sees the clock on air, and the renderer gets an ok with
    // no requestId, because an instanceStatus message does not carry one.
    expect(sliceOnControlPage, 'the control page must hear the clock is on air').toEqual({
      type: 'slice',
      name: 'instances',
      slice: runningServer.stateStore.readAllSlices().instances,
    });
    expect(resultOnRenderer, 'the renderer must be answered ok, with a null requestId').toEqual({
      type: 'commandResult',
      requestId: null,
      ok: true,
    });
  });

  it('from an operator connection is answered NOT_ALLOWED in pt-BR', async () => {
    // Arrange: a running server with the race clock taken by the control page.
    const runningServer = await startServerOnARandomPort();
    const controlPage = await connectWebSocketTestClient(runningServer.port);
    await takeRaceClockFromControlPage(controlPage);
    const idOfTheRaceClockInstance = runningServer.stateStore.readAllSlices().instances[0]?.id;

    // Act: the control page's own connection claims the clock is on air.
    controlPage.sendJson({
      type: 'instanceStatus',
      instanceId: idOfTheRaceClockInstance,
      status: 'on-air',
    });
    const result = await controlPage.waitForMessage('report result', isCommandResultMessage);

    // Assert: refused in pt-BR, and the instance is still loading.
    expect(result, 'only a renderer connection may report what is on screen').toEqual({
      type: 'commandResult',
      requestId: null,
      ok: false,
      error: {
        code: 'NOT_ALLOWED',
        message: 'Você não tem permissão para executar este comando.',
      },
    });
    expect(
      runningServer.stateStore.readAllSlices().instances[0]?.status,
      'the instance must still be waiting for a real renderer',
    ).toBe('loading');
  });
});
