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
 *   - A take of an item (a button of "Atalhos", prepared before any client connects)
 *     from client A produces one `slices` message on client B, with the new instances
 *     and the event log.
 *   - `hello` and the message of each change carry `serverNowMs`, the time the server's
 *     clock showed when that message was built (the clock is held by the test), and a
 *     `commandResult` does not.
 *   - The sender gets the slices first, then a `commandResult` echoing its requestId; the
 *     one of a createItem also names the item the server made.
 *   - A refused command gets an error `commandResult` in pt-BR; a `takeGraphic` (removed
 *     in BAJAOVRLAY-37) is refused as unknown and changes nothing.
 *
 * What these tests deliberately do not cover:
 *   - A message outside the protocol: webSocketHubBadMessages.test.ts. The heartbeat and
 *     the endpoint itself: webSocketHubConnections.test.ts.
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
import { describe, expect, it } from 'vitest';

import {
  isCommandResultMessage,
  isSlicesMessageWithInstances,
  momentTheServerClockIsHeldAt,
  momentTheServerClockIsHeldAtInMilliseconds,
  prepareTheTakeOfTheClockItem,
  startServerOnARandomPort,
} from './webSocketHubOnARandomPort.testSupport.js';
import { connectWebSocketTestClient } from './webSocketTestClient.testSupport.js';

describe('connecting to /ws', () => {
  it('sends hello with every slice, including the seeded layers', async () => {
    // Arrange: a running server.
    const runningServer = await startServerOnARandomPort();

    // Act: connect a client and wait for its first message.
    const client = await connectWebSocketTestClient(runningServer.port);
    const hello = await client.waitForMessage('hello', (message) => message.type === 'hello');

    // Assert: hello carries the very slices the store holds, seven layers among them,
    // and the time the server's clock showed.
    expect(hello, 'hello must carry every slice the store holds and the server clock').toEqual({
      type: 'hello',
      slices: runningServer.stateStore.readAllSlices(),
      serverNowMs: momentTheServerClockIsHeldAtInMilliseconds,
    });
    expect(
      hello.type === 'hello' ? hello.slices.layers.length : 0,
      'the seeded layers must be in hello',
    ).toBe(7);
  });
});

describe('a command sent over /ws', () => {
  it('produces one slices message on another client, with the instances and the event log', async () => {
    // Arrange: a server with the clock item, and the control page (A) and renderer (B).
    const runningServer = await startServerOnARandomPort();
    const takeOfTheClockItem = prepareTheTakeOfTheClockItem(runningServer.stateStore);
    const controlPage = await connectWebSocketTestClient(runningServer.port);
    const renderer = await connectWebSocketTestClient(runningServer.port);

    // Act: the control page takes the race clock item.
    controlPage.sendJson({ type: 'command', requestId: 'pedido-1', command: takeOfTheClockItem });
    const slicesOnRenderer = await renderer.waitForMessage(
      'slices message with the instances',
      isSlicesMessageWithInstances,
    );

    // Assert: the renderer hears about the new race-clock instance, what the clock layer
    // showed before (for "Desfazer") and the event-log line of the take in the same
    // message, with the time the server's clock showed.
    expect(
      slicesOnRenderer,
      'the renderer must get the instances, the history and the event log together',
    ).toEqual({
      type: 'slices',
      slices: {
        instances: runningServer.stateStore.readAllSlices().instances,
        programHistory: runningServer.stateStore.readAllSlices().programHistory,
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
    // Arrange: a server whose clock the test sets by hand, with the clock item, and a
    // renderer that connected at 14:32:05 and got its hello.
    let momentTheServerClockShows = momentTheServerClockIsHeldAt;
    const runningServer = await startServerOnARandomPort({
      readCurrentTime: () => new Date(momentTheServerClockShows),
    });
    const takeOfTheClockItem = prepareTheTakeOfTheClockItem(runningServer.stateStore);
    const controlPage = await connectWebSocketTestClient(runningServer.port);
    const renderer = await connectWebSocketTestClient(runningServer.port);
    const hello = await renderer.waitForMessage('hello', (message) => message.type === 'hello');

    // Act: forty seconds later on the server's clock, the control page takes the clock item.
    momentTheServerClockShows = '2026-10-09T14:32:45.000Z';
    controlPage.sendJson({ type: 'command', requestId: 'pedido-6', command: takeOfTheClockItem });
    // A take changes the instances, the layer's history and the event log: one slices message.
    await renderer.waitForMessage('slices message of the take', isSlicesMessageWithInstances);

    // Assert: the hello says 14:32:05, and the one message of the take, the whole slices
    // message, says 14:32:45: the clock is read for each message, not once at connect.
    const { instances, programHistory, eventLog } = runningServer.stateStore.readAllSlices();
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
        slices: { instances, programHistory, eventLog },
        serverNowMs: momentTheServerClockIsHeldAtInMilliseconds + 40_000,
      },
    ]);
  });

  it('answers the sender with the slices first, then a commandResult echoing its requestId', async () => {
    // Arrange: a running server with the race clock item, and the control page connected.
    const runningServer = await startServerOnARandomPort();
    const takeOfTheClockItem = prepareTheTakeOfTheClockItem(runningServer.stateStore);
    const controlPage = await connectWebSocketTestClient(runningServer.port);
    await controlPage.waitForMessage('hello', (message) => message.type === 'hello');

    // Act: take the race clock item with requestId pedido-2 and wait for the answer.
    controlPage.sendJson({ type: 'command', requestId: 'pedido-2', command: takeOfTheClockItem });
    const commandResult = await controlPage.waitForMessage('commandResult', isCommandResultMessage);

    // Assert: ok with the same requestId, after the one message with the instances, the
    // layer's history and the event log.
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
      'slices instances programHistory eventLog',
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
    // The rundown's items only: the panel "Avisos" holds two seeded notice items.
    const itemIdsInTheStore = runningServer.stateStore
      .readAllSlices()
      .items.filter((item) => item.home.kind === 'rundown')
      .map((item) => item.id);
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

  it('refuses a takeGraphic, the take by hand removed in BAJAOVRLAY-37, and changes nothing', async () => {
    // Arrange: a running server and a page written before BAJAOVRLAY-37 connected.
    const runningServer = await startServerOnARandomPort();
    const olderControlPage = await connectWebSocketTestClient(runningServer.port);
    await olderControlPage.waitForMessage('hello', (message) => message.type === 'hello');
    const instancesBefore = runningServer.stateStore.readAllSlices().instances;

    // Act: that page puts the race clock up by hand, with no item.
    olderControlPage.sendJson({
      type: 'command',
      requestId: 'pedido-4',
      command: {
        type: 'takeGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: { sessionName: 'Enduro de Resistência', state: 'green' },
      },
    });
    const commandResult = await olderControlPage.waitForMessage(
      'commandResult',
      isCommandResultMessage,
    );

    // Assert: refused as an unknown command, and nothing went on air.
    expect(commandResult, 'the take by hand must be refused as an unknown command').toMatchObject({
      type: 'commandResult',
      requestId: 'pedido-4',
      ok: false,
      error: { code: 'INVALID_COMMAND' },
    });
    expect(
      runningServer.stateStore.readAllSlices().instances,
      'nothing may reach the air except through an item',
    ).toBe(instancesBefore);
  });
});
