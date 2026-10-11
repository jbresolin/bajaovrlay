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
 *   - ANY connection that says `?role=renderer` is taken at its word: a client that is
 *     not a renderer page at all can report an instance on air and the report is
 *     applied. Nothing proves the role today. This spoof is accepted on purpose until
 *     the LAN PINs of M4; the test records it so nobody mistakes the role for security.
 *   - A renderer's report that arrives after the instance was cleared (the report races
 *     the clear) is answered ok and leaves no event-log entry.
 *
 * What these tests deliberately do not cover:
 *   - The control page's program monitor: it connects with no role, so to the server it
 *     is an ordinary non-renderer connection, like the control page in these tests.
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

  it('from any connection that says ?role=renderer is applied, because nothing proves the role', async () => {
    // Arrange: a running server with the race clock taken, and no renderer page at all:
    // no OBS is open. A script on someone's laptop in the paddock connects to /ws and
    // simply writes role=renderer in the address, as anyone on the network can.
    const runningServer = await startServerOnARandomPort();
    const controlPage = await connectWebSocketTestClient(runningServer.port);
    await takeRaceClockFromControlPage(controlPage);
    const idOfTheRaceClockInstance = runningServer.stateStore.readAllSlices().instances[0]?.id;
    const scriptClaimingToBeRenderer = await connectWebSocketTestClient(runningServer.port, {
      role: 'renderer',
    });

    // Act: the script claims the clock is on air, although no screen is showing it.
    scriptClaimingToBeRenderer.sendJson({
      type: 'instanceStatus',
      instanceId: idOfTheRaceClockInstance,
      status: 'on-air',
    });
    const result = await scriptClaimingToBeRenderer.waitForMessage(
      'report result',
      isCommandResultMessage,
    );

    // Assert: the claim is believed. This is the known gap until the LAN PINs of M4.
    expect(result, 'a connection that says it is a renderer is answered as one').toEqual({
      type: 'commandResult',
      requestId: null,
      ok: true,
    });
    expect(
      runningServer.stateStore.readAllSlices().instances[0]?.status,
      'the report is applied: the role in the address is taken at its word until M4',
    ).toBe('on-air');
  });

  it('from a renderer about an instance already cleared is answered ok and leaves no event-log entry', async () => {
    // Arrange: a running server and a renderer; the operator takes the race clock and
    // clears its layer straight away, before the clock's play animation has finished.
    const runningServer = await startServerOnARandomPort();
    const controlPage = await connectWebSocketTestClient(runningServer.port);
    const renderer = await connectWebSocketTestClient(runningServer.port, { role: 'renderer' });
    await takeRaceClockFromControlPage(controlPage);
    const idOfTheRaceClockInstance = runningServer.stateStore.readAllSlices().instances[0]?.id;
    controlPage.sendJson({
      type: 'command',
      requestId: 'pedido-2',
      command: { type: 'clearLayer', layerId: 'clock' },
    });
    await controlPage.waitForMessage(
      'clear result',
      (message) => message.type === 'commandResult' && message.requestId === 'pedido-2',
    );

    // Act: the renderer's report about the clock, sent before it heard of the clear, arrives.
    renderer.sendJson({
      type: 'instanceStatus',
      instanceId: idOfTheRaceClockInstance,
      status: 'on-air',
    });
    const result = await renderer.waitForMessage('report result', isCommandResultMessage);

    // Assert: answered ok, and the event log holds only what the operator did.
    expect(result, 'a late report is normal and must not come back as an error').toEqual({
      type: 'commandResult',
      requestId: null,
      ok: true,
    });
    expect(
      runningServer.stateStore.readAllSlices().eventLog.map((entry) => entry.command),
      'a quick clear must not leave a failed reportInstanceStatus in the event log',
    ).toEqual(['takeGraphic', 'clearLayer']);
    expect(
      runningServer.stateStore.readAllSlices().instances,
      'the cleared clock must not come back',
    ).toEqual([]);
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
