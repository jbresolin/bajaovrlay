/**
 * The WebSocket hub at /ws (apps/server)
 *
 * What this module is for:
 *   The control page and the renderer stay in sync with the server over one WebSocket
 *   at `/ws`, on the same port as HTTP. On connect a client gets `hello` with every
 *   slice. It changes state only by sending `command` messages; every client then gets
 *   one message with the slices that changed (`slices`, or `slice` when only one did),
 *   and the sender gets a `commandResult`. Anything outside the protocol is answered with an error and
 *   logged, and the socket stays open. A client that stops answering pings is dropped.
 *
 * What these tests prove (with a real server on a random port and a real SQLite file):
 *   - A client gets `hello` with every slice, including the seeded layers, on connect.
 *   - A take from client A produces one `slices` message on client B, with the new
 *     instances and the event log.
 *   - `hello` and the message of each change carry `serverNowMs`, the time the server's
 *     clock showed when that message was built (the clock is held by the test), and a
 *     `commandResult` does not.
 *   - The sender gets the slices first, then a `commandResult` echoing its requestId; the
 *     one of a createItem also names the item the server made.
 *   - A refused command gets an error `commandResult` in pt-BR.
 *   - A message that is not JSON, or not in the protocol, or a binary frame, gets an
 *     error and a warning in the log, and the socket stays open: a valid command sent
 *     afterwards still works.
 *   - A client that stops answering pings is dropped; one that answers is kept.
 *   - Only /ws upgrades to a WebSocket, an upgrade with a malformed address cannot
 *     crash the server, and shutting down closes every client.
 *
 * What these tests deliberately do not cover:
 *   - The `time` message every client gets every ten seconds; it has its own file,
 *     webSocketHubServerTime.test.ts, with a timer moved by hand. No test here lasts
 *     ten seconds, so none ever sees one.
 *   - The rules of each command (reducers/reduceCommand.test.ts) and the event log
 *     (createStateStore.test.ts); here the store is used as the server uses it.
 *   - A command changing three slices, and a change of one slice alone (still a `slice`
 *     message); webSocketHubGroupedSlices.test.ts.
 *   - The answer when saving a command fails; clientMessageAnswers.test.ts covers it
 *     without a real socket, since a real server's database cannot be broken from here.
 */
import type { ServerMessage } from '@bajaovrlay/shared';
import { describe, expect, it, onTestFinished } from 'vitest';

import { startServer } from '../boot/startServer.js';
import { committedMigrationsFolder } from '../db/openDatabase.js';
import { createTemporaryDatabasePath } from '../db/temporaryDatabase.testSupport.js';
import { createLogger, type ServerLogger } from '../logger/createLogger.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../store/builtGraphicsFolder.testSupport.js';
import {
  connectWebSocketTestClient,
  sendRawUpgradeRequest,
  tryWebSocketOnPath,
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

// The server's clock is held at 14:32:05 UTC on 9 October 2026 unless a test moves it,
// so the `serverNowMs` of every message can be compared exactly.
const momentTheServerClockIsHeldAt = '2026-10-09T14:32:05.000Z';
const momentTheServerClockIsHeldAtInMilliseconds = 1_791_556_325_000;

/**
 * Starts the whole server on a random free port with a fresh temporary database and the
 * race clock registered (silent unless a logger is given). It is shut down when the test ends.
 */
async function startServerOnARandomPort(
  options: {
    heartbeatIntervalInMilliseconds?: number;
    logger?: ServerLogger;
    readCurrentTime?: () => Date;
  } = {},
) {
  const runningServer = await startServer({
    logger: options.logger ?? createLogger({ level: 'silent' }),
    version: '0.3.1',
    host: '127.0.0.1',
    port: 0,
    databasePath: createTemporaryDatabasePath(),
    migrationsFolder: committedMigrationsFolder,
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    heartbeatIntervalInMilliseconds: options.heartbeatIntervalInMilliseconds,
    readCurrentTime: options.readCurrentTime ?? (() => new Date(momentTheServerClockIsHeldAt)),
  });
  onTestFinished(() => runningServer.close());
  return runningServer;
}

/** True for a `slices` message carrying the instances slice. */
function isSlicesMessageWithInstances(message: ServerMessage): boolean {
  return message.type === 'slices' && message.slices.instances !== undefined;
}

/** True for any `commandResult` message. */
function isCommandResultMessage(message: ServerMessage): boolean {
  return message.type === 'commandResult';
}

describe('connecting to /ws', () => {
  it('sends hello with every slice, including the seeded layers', async () => {
    // Arrange: a running server.
    const runningServer = await startServerOnARandomPort();

    // Act: connect a client and wait for its first message.
    const client = await connectWebSocketTestClient(runningServer.port);
    const hello = await client.waitForMessage('hello', (message) => message.type === 'hello');

    // Assert: hello carries the very slices the store holds, five layers among them,
    // and the time the server's clock showed.
    expect(hello, 'hello must carry every slice the store holds and the server clock').toEqual({
      type: 'hello',
      slices: runningServer.stateStore.readAllSlices(),
      serverNowMs: momentTheServerClockIsHeldAtInMilliseconds,
    });
    expect(
      hello.type === 'hello' ? hello.slices.layers.length : 0,
      'the seeded layers must be in hello',
    ).toBe(5);
  });
});

describe('a command sent over /ws', () => {
  it('produces one slices message on another client, with the instances and the event log', async () => {
    // Arrange: a running server and two clients, the control page (A) and the renderer (B).
    const runningServer = await startServerOnARandomPort();
    const controlPage = await connectWebSocketTestClient(runningServer.port);
    const renderer = await connectWebSocketTestClient(runningServer.port);

    // Act: the control page takes the race clock.
    controlPage.sendJson({ type: 'command', requestId: 'pedido-1', command: takeRaceClockCommand });
    const slicesOnRenderer = await renderer.waitForMessage(
      'slices message with the instances',
      isSlicesMessageWithInstances,
    );

    // Assert: the renderer hears about the new race-clock instance and the event-log line
    // of the take in the same message, with the time the server's clock showed.
    expect(
      slicesOnRenderer,
      'the renderer must get the instances and the event log together',
    ).toEqual({
      type: 'slices',
      slices: {
        instances: runningServer.stateStore.readAllSlices().instances,
        eventLog: runningServer.stateStore.readAllSlices().eventLog,
      },
      serverNowMs: momentTheServerClockIsHeldAtInMilliseconds,
    });
    expect(
      slicesOnRenderer.type === 'slices' ? slicesOnRenderer.slices.instances?.length : 0,
      'exactly one instance must be on air',
    ).toBe(1);
  });

  it('stamps the message of a change with the server clock as it is when that message is built', async () => {
    // Arrange: a server whose clock the test sets by hand, and a renderer that connected
    // at 14:32:05 and got its hello.
    let momentTheServerClockShows = momentTheServerClockIsHeldAt;
    const runningServer = await startServerOnARandomPort({
      readCurrentTime: () => new Date(momentTheServerClockShows),
    });
    const controlPage = await connectWebSocketTestClient(runningServer.port);
    const renderer = await connectWebSocketTestClient(runningServer.port);
    const hello = await renderer.waitForMessage('hello', (message) => message.type === 'hello');

    // Act: forty seconds later on the server's clock, the control page takes the race clock.
    momentTheServerClockShows = '2026-10-09T14:32:45.000Z';
    controlPage.sendJson({ type: 'command', requestId: 'pedido-6', command: takeRaceClockCommand });
    // A take changes the instances and the event log, so it is one slices message.
    await renderer.waitForMessage('slices message of the take', isSlicesMessageWithInstances);

    // Assert: the hello says 14:32:05, and the one message of the take, the whole slices
    // message, says 14:32:45: the clock is read for each message, not once at connect.
    const { instances, eventLog } = runningServer.stateStore.readAllSlices();
    expect(
      hello.type === 'hello' ? hello.serverNowMs : undefined,
      'the hello must carry the server clock of the moment the client connected',
    ).toBe(momentTheServerClockIsHeldAtInMilliseconds);
    expect(
      renderer.readReceivedMessages().filter((message) => message.type.startsWith('slice')),
      'the one message of the take must carry the server clock of forty seconds later',
    ).toEqual([
      {
        type: 'slices',
        slices: { instances, eventLog },
        serverNowMs: momentTheServerClockIsHeldAtInMilliseconds + 40_000,
      },
    ]);
  });

  it('answers the sender with the slices first, then a commandResult echoing its requestId', async () => {
    // Arrange: a running server and the control page connected.
    const runningServer = await startServerOnARandomPort();
    const controlPage = await connectWebSocketTestClient(runningServer.port);
    await controlPage.waitForMessage('hello', (message) => message.type === 'hello');

    // Act: take the race clock with requestId pedido-2 and wait for the answer.
    controlPage.sendJson({ type: 'command', requestId: 'pedido-2', command: takeRaceClockCommand });
    const commandResult = await controlPage.waitForMessage('commandResult', isCommandResultMessage);

    // Assert: ok with the same requestId, after the one message with the instances and
    // the event log.
    expect(commandResult, 'the answer must be ok and echo the requestId').toEqual({
      type: 'commandResult',
      requestId: 'pedido-2',
      ok: true,
    });
    const messagesInArrivalOrder = controlPage
      .readReceivedMessages()
      .map((message) =>
        message.type === 'slices'
          ? `slices ${Object.keys(message.slices).join(' ')}`
          : message.type,
      );
    expect(messagesInArrivalOrder, 'state must arrive before the ok').toEqual([
      'hello',
      'slices instances eventLog',
      'commandResult',
    ]);
  });

  it('names the item a createItem made in its commandResult', async () => {
    // Arrange: a running server and the control page connected.
    const runningServer = await startServerOnARandomPort();
    const controlPage = await connectWebSocketTestClient(runningServer.port);
    await controlPage.waitForMessage('hello', (message) => message.type === 'hello');

    // Act: the item editor creates "Largada do enduro" and waits for the answer.
    controlPage.sendJson({
      type: 'command',
      requestId: 'pedido-3',
      command: {
        type: 'createItem',
        home: { kind: 'rundown', rundownId: 'sessao-principal' },
        graphicId: 'race-clock',
        layerId: 'clock',
        fields: { sessionName: { kind: 'literal', value: 'Enduro de Resistência' } },
        label: 'Largada do enduro',
      },
    });
    const commandResult = await controlPage.waitForMessage('commandResult', isCommandResultMessage);

    // Assert: ok, naming the id of the item the store now holds, so "Salvar e disparar"
    // can take that very item next.
    const itemIdsInTheStore = runningServer.stateStore.readAllSlices().items.map((item) => item.id);
    expect(itemIdsInTheStore.length, 'exactly one item must have been created').toBe(1);
    expect(commandResult, 'the answer must name the item the server made').toEqual({
      type: 'commandResult',
      requestId: 'pedido-3',
      ok: true,
      createdItemId: itemIdsInTheStore[0],
    });
  });

  it('answers a refused command with an error commandResult in pt-BR', async () => {
    // Arrange: a running server and the control page connected.
    const runningServer = await startServerOnARandomPort();
    const controlPage = await connectWebSocketTestClient(runningServer.port);

    // Act: clear a layer that does not exist.
    controlPage.sendJson({
      type: 'command',
      requestId: 'pedido-3',
      command: { type: 'clearLayer', layerId: 'placar' },
    });
    const commandResult = await controlPage.waitForMessage('commandResult', isCommandResultMessage);

    // Assert: an error with the stable code and the pt-BR reason.
    expect(commandResult, 'the refusal must reach the sender in pt-BR').toEqual({
      type: 'commandResult',
      requestId: 'pedido-3',
      ok: false,
      error: { code: 'LAYER_NOT_FOUND', message: 'A camada "placar" não existe.' },
    });
  });
});

describe('a message outside the protocol', () => {
  it('gets an error for text that is not JSON, and the socket stays open for the next command', async () => {
    // Arrange: a running server that records its log, and the control page connected.
    const { logger, readRecordedLines } = createRecordingLogger();
    const runningServer = await startServerOnARandomPort({ logger });
    const controlPage = await connectWebSocketTestClient(runningServer.port);

    // Act: send text that is not JSON, then a valid command.
    controlPage.sendText('isto não é json');
    const errorResult = await controlPage.waitForMessage('error result', isCommandResultMessage);
    controlPage.sendJson({ type: 'command', requestId: 'pedido-4', command: takeRaceClockCommand });
    const okResult = await controlPage.waitForMessage('ok result', isCommandResultMessage);

    // Assert: an INVALID_MESSAGE error in pt-BR, then an ok on the same socket.
    expect(errorResult, 'text that is not JSON must get an INVALID_MESSAGE error').toEqual({
      type: 'commandResult',
      requestId: null,
      ok: false,
      error: {
        code: 'INVALID_MESSAGE',
        message: 'Mensagem inválida: o servidor aceita apenas mensagens JSON do protocolo.',
      },
    });
    expect(okResult, 'the socket must still work after a bad message').toEqual({
      type: 'commandResult',
      requestId: 'pedido-4',
      ok: true,
    });
    expect(controlPage.isOpen(), 'a bad message must never close the socket').toBe(true);
    const refusalWarnings = readRecordedLines().filter(
      (line) => line.message === 'websocket message refused: not JSON',
    );
    expect(refusalWarnings, 'the bad message must be logged once, as a warning').toEqual([
      expect.objectContaining({ level: 'warn', message_text: 'isto não é json' }),
    ]);
  });

  it('gets an error for a binary frame, which the protocol does not use', async () => {
    // Arrange: a running server and the control page connected.
    const runningServer = await startServerOnARandomPort();
    const controlPage = await connectWebSocketTestClient(runningServer.port);

    // Act: send the bytes of a small PNG header as a binary frame, as a buggy client might.
    controlPage.sendBinary(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    const errorResult = await controlPage.waitForMessage('error result', isCommandResultMessage);

    // Assert: INVALID_MESSAGE in pt-BR, with no requestId to echo, and the socket open.
    expect(errorResult, 'a binary frame must get INVALID_MESSAGE').toEqual({
      type: 'commandResult',
      requestId: null,
      ok: false,
      error: {
        code: 'INVALID_MESSAGE',
        message: 'Mensagem inválida: o servidor aceita apenas mensagens JSON do protocolo.',
      },
    });
    expect(controlPage.isOpen(), 'a binary frame must never close the socket').toBe(true);
  });

  it('gets an error echoing the requestId for JSON that is not a protocol message', async () => {
    // Arrange: a running server and the control page connected.
    const runningServer = await startServerOnARandomPort();
    const controlPage = await connectWebSocketTestClient(runningServer.port);

    // Act: send a message type the protocol does not have.
    controlPage.sendJson({ type: 'subscribe', requestId: 'pedido-5', slice: 'instances' });
    const errorResult = await controlPage.waitForMessage('error result', isCommandResultMessage);

    // Assert: INVALID_MESSAGE, with the requestId it could still read.
    expect(errorResult, 'an unknown message type must get INVALID_MESSAGE').toEqual({
      type: 'commandResult',
      requestId: 'pedido-5',
      ok: false,
      error: {
        code: 'INVALID_MESSAGE',
        message: 'Mensagem inválida: o servidor aceita apenas mensagens JSON do protocolo.',
      },
    });
    expect(controlPage.isOpen(), 'a bad message must never close the socket').toBe(true);
  });
});

describe('the heartbeat', () => {
  it('drops a client that stops answering pings and keeps one that answers', async () => {
    // Arrange: a server pinging every 250 ms, a healthy client and a frozen one.
    // 250 ms, not less: the healthy client's pong must be read before the next tick, and
    // a busy CI machine can stall the event loop for tens of milliseconds. The test waits
    // on the frozen client's close event, so the wider interval costs well under a second.
    const runningServer = await startServerOnARandomPort({ heartbeatIntervalInMilliseconds: 250 });
    const healthyClient = await connectWebSocketTestClient(runningServer.port);
    const frozenClient = await connectWebSocketTestClient(runningServer.port, {
      answersPings: false,
    });

    // Act: wait until the server drops the frozen client.
    await frozenClient.waitUntilClosed();

    // Assert: the frozen client is gone and the healthy one, connected as long, is not.
    expect(frozenClient.isOpen(), 'a client that misses a ping must be dropped').toBe(false);
    expect(healthyClient.isOpen(), 'a client that answers pings must be kept').toBe(true);
  });
});

describe('the WebSocket endpoint itself', () => {
  it('refuses to upgrade any path other than /ws', async () => {
    // Arrange: a running server.
    const runningServer = await startServerOnARandomPort();

    // Act: try to open a WebSocket on another address.
    const outcome = await tryWebSocketOnPath(runningServer.port, '/api/v1/state');

    // Assert: the upgrade is refused.
    expect(outcome, 'only /ws may become a WebSocket').toBe('refused');
  });

  it('survives an upgrade request whose address is malformed', async () => {
    // Arrange: a running server.
    const runningServer = await startServerOnARandomPort();

    // Act: send a raw upgrade for the absolute address `http://[`, which is not a URL,
    // then ask for /health.
    const upgradeAnswer = await sendRawUpgradeRequest(runningServer.port, 'http://[');
    const healthResponse = await fetch(`http://127.0.0.1:${runningServer.port}/health`);

    // Assert: the upgrade was refused and the server is still answering.
    expect(upgradeAnswer, 'a malformed address must be refused, not upgraded').toContain(
      '404 Not Found',
    );
    expect(healthResponse.status, 'the server must still be up after the bad request').toBe(200);
  });

  it('closes every client when the server shuts down', async () => {
    // Arrange: a running server with the control page connected.
    const runningServer = await startServerOnARandomPort();
    const controlPage = await connectWebSocketTestClient(runningServer.port);

    // Act: shut the server down.
    await runningServer.close();
    await controlPage.waitUntilClosed();

    // Assert: the client's socket is closed.
    expect(controlPage.isOpen(), 'shutdown must close every client socket').toBe(false);
  });
});
