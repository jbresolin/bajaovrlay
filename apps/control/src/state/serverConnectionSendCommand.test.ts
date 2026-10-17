/**
 * Server connection: sending a command and waiting for its answer (apps/control)
 *
 * What this module is for:
 *   Everything the operator does leaves the page as a command over the one WebSocket.
 *   sendCommand numbers each command and waits for the server's answer to that number,
 *   so every button knows whether its own command was accepted.
 *
 * What these tests prove:
 *   - sendCommand sends the command with a request id, and settles only on the answer
 *     carrying that id: it resolves on ok (with the id of the item a createItem made,
 *     when the server names it), rejects with the server's code and pt-BR message on a
 *     refusal, and rejects after 5 seconds of silence.
 *   - A command sent while disconnected is refused at once and never leaves the page.
 *   - A failure is left in the store for the page to show; the next success removes it.
 *
 * What these tests deliberately do not cover:
 *   - Receiving state (hello, slice, slices) and messages the page cannot read:
 *     serverConnection.test.ts.
 *   - What happens when the line drops; serverConnectionRedialling.test.ts covers that.
 *   - The browser's real WebSocket: a fake server socket stands in for it, driven by
 *     hand.
 *   - The real clock: time is moved by hand, so "5 seconds" takes no time to test.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  connectControlPageToFakeServer,
  connectControlPageToFakeServerThatSaidHello,
} from './connectionToFakeServer.testSupport';

describe('sendCommand', () => {
  it('sends the command with a request id and resolves when that id is answered ok', async () => {
    // Arrange: a connected page.
    const { fakeServerSocket, serverConnection } = connectControlPageToFakeServerThatSaidHello();

    // Act: clear the clock layer, and let the server answer ok.
    const sending = serverConnection.sendCommand({ type: 'clearLayer', layerId: 'clock' });
    fakeServerSocket.acceptLastCommand();
    const commandResult = await sending;

    // Assert: the server got the command in the protocol's envelope, and the page got ok.
    expect(
      fakeServerSocket.listCommandMessagesReceived(),
      'exactly one command message must reach the server, with its request id',
    ).toEqual([
      {
        type: 'command',
        requestId: 'pedido-1',
        command: { type: 'clearLayer', layerId: 'clock' },
      },
    ]);
    expect(commandResult, 'the promise must resolve with the ok answer').toEqual({
      ok: true,
      requestId: 'pedido-1',
    });
  });

  it('resolves with the id of the item a createItem made, when the server names it', async () => {
    // Arrange: a connected page.
    const { fakeServerSocket, serverConnection } = connectControlPageToFakeServerThatSaidHello();

    // Act: the item editor creates "Largada do enduro", and the server answers ok, naming
    // the item it made.
    const sending = serverConnection.sendCommand({
      type: 'createItem',
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
      graphicId: 'race-clock',
      layerId: 'clock',
      fields: { sessionName: { kind: 'literal', value: 'Enduro de Resistência' } },
      label: 'Largada do enduro',
    });
    fakeServerSocket.sendMessage({
      type: 'commandResult',
      requestId: 'pedido-1',
      ok: true,
      createdItemId: '5e8a2c1d-9f3b-4a7e-b6d4-2c1f0e9a8b7c',
    });

    // Assert: the promise carries the id, so "Salvar e disparar" can take that item next.
    expect(await sending, 'the ok answer must carry the id of the item created').toEqual({
      ok: true,
      requestId: 'pedido-1',
      createdItemId: '5e8a2c1d-9f3b-4a7e-b6d4-2c1f0e9a8b7c',
    });
  });

  it('matches each answer to its own command when two are waiting', async () => {
    // Arrange: a connected page with two commands sent and neither answered.
    const { fakeServerSocket, serverConnection } = connectControlPageToFakeServerThatSaidHello();
    const sendingClearLayer = serverConnection.sendCommand({
      type: 'clearLayer',
      layerId: 'clock',
    });
    const sendingClearAll = serverConnection.sendCommand({ type: 'clearAll' });
    const whyClearLayerFailed = sendingClearLayer.catch((failure: unknown) => failure);

    // Act: the server answers the second command ok first, then refuses the first.
    fakeServerSocket.sendMessage({ type: 'commandResult', requestId: 'pedido-2', ok: true });
    fakeServerSocket.sendMessage({
      type: 'commandResult',
      requestId: 'pedido-1',
      ok: false,
      error: { code: 'LAYER_NOT_FOUND', message: 'A camada "clock" não existe.' },
    });

    // Assert: each promise got the answer that carried its own request id.
    expect(await sendingClearAll, 'clearAll (pedido-2) must get the ok answer').toEqual({
      ok: true,
      requestId: 'pedido-2',
    });
    expect(
      await whyClearLayerFailed,
      'clearLayer (pedido-1) must get the refusal, not the ok meant for pedido-2',
    ).toMatchObject({ code: 'LAYER_NOT_FOUND' });
  });

  it("rejects with the server's code and pt-BR message when the command is refused", async () => {
    // Arrange: a connected page.
    const { serverStateStore, fakeServerSocket, serverConnection } =
      connectControlPageToFakeServerThatSaidHello();

    // Act: take an item whose graphic the server no longer has, and let it refuse.
    const sending = serverConnection.sendCommand({
      type: 'takeItem',
      itemId: 'item-placar-geral',
    });
    const whyItFailed = sending.catch((failure: unknown) => failure);
    fakeServerSocket.refuseLastCommand({
      code: 'GRAPHIC_NOT_FOUND',
      message: 'O gráfico "placar-geral" não está registrado.',
    });

    // Assert: the promise rejected with the refusal, and the store keeps it for the page.
    expect(await whyItFailed, 'the rejection must carry the code and the message').toMatchObject({
      name: 'CommandFailedError',
      code: 'GRAPHIC_NOT_FOUND',
      message: 'O gráfico "placar-geral" não está registrado.',
    });
    expect(
      serverStateStore.getState().lastCommandError,
      'the store must remember which command failed and why',
    ).toEqual({
      commandType: 'takeItem',
      code: 'GRAPHIC_NOT_FOUND',
      message: 'O gráfico "placar-geral" não está registrado.',
    });
  });

  it('forgets the last error once a later command succeeds', async () => {
    // Arrange: a connected page whose last command was refused.
    const { serverStateStore, fakeServerSocket, serverConnection } =
      connectControlPageToFakeServerThatSaidHello();
    const refusedSending = serverConnection.sendCommand({ type: 'clearLayer', layerId: 'placar' });
    const whyItFailed = refusedSending.catch((failure: unknown) => failure);
    fakeServerSocket.refuseLastCommand({
      code: 'LAYER_NOT_FOUND',
      message: 'A camada "placar" não existe.',
    });
    await whyItFailed;

    // Act: send another command, which the server accepts.
    const acceptedSending = serverConnection.sendCommand({ type: 'clearAll' });
    fakeServerSocket.acceptLastCommand();
    await acceptedSending;

    // Assert: the old error is no longer shown.
    expect(
      serverStateStore.getState().lastCommandError,
      'a success must clear the error left by the earlier failure',
    ).toBeNull();
  });

  it('rejects after 5 seconds without an answer, and not a moment before', async () => {
    // Arrange: a connected page, with time moved by hand.
    vi.useFakeTimers();
    const { serverStateStore, serverConnection } = connectControlPageToFakeServerThatSaidHello();
    let hasFailed = false;

    // Act: send a command the server never answers; wait 4.999 s, then the last millisecond.
    const sending = serverConnection.sendCommand({ type: 'clearAll' });
    const whyItFailed = sending.catch((failure: unknown) => {
      hasFailed = true;
      return failure;
    });
    await vi.advanceTimersByTimeAsync(4_999);
    const hadFailedJustBeforeFiveSeconds = hasFailed;
    await vi.advanceTimersByTimeAsync(1);

    // Assert: still waiting at 4.999 s; failed at 5 s with a pt-BR explanation.
    expect(hadFailedJustBeforeFiveSeconds, 'the command must still be waiting at 4.999 s').toBe(
      false,
    );
    expect(await whyItFailed, 'at 5 s the promise must reject as timed out').toMatchObject({
      name: 'CommandFailedError',
      code: 'COMMAND_TIMED_OUT',
      message:
        'O servidor não respondeu em 5 segundos. Confira nas camadas se o comando foi aplicado.',
    });
    expect(
      serverStateStore.getState().lastCommandError?.code,
      'the store must remember the timeout for the page to show',
    ).toBe('COMMAND_TIMED_OUT');
  });

  it('ignores and logs an answer that arrives after its command timed out', async () => {
    // Arrange: a connected page whose command has already timed out.
    vi.useFakeTimers();
    const { fakeServerSocket, serverConnection, recordedLogLines } =
      connectControlPageToFakeServerThatSaidHello();
    const sending = serverConnection.sendCommand({ type: 'clearAll' });
    const whyItFailed = sending.catch((failure: unknown) => failure);
    await vi.advanceTimersByTimeAsync(5_000);
    await whyItFailed;

    // Act: the server's answer finally arrives.
    fakeServerSocket.acceptLastCommand();

    // Assert: nothing breaks, and the late answer is noted in the log.
    expect(recordedLogLines, 'a late answer must be logged, exactly once').toHaveLength(1);
    expect(recordedLogLines[0]?.message, 'the log line must say what happened').toBe(
      'ignored a command result nobody is waiting for',
    );
    expect(
      recordedLogLines[0]?.details,
      'the log line must name the request under `request_id`, the key the server logs it under',
    ).toEqual({
      request_id: 'pedido-1',
    });
  });

  it('refuses at once, without sending anything, while the page is not connected', async () => {
    // Arrange: a page that has dialled but whose server has not picked up.
    const { serverStateStore, fakeServerSocket, serverConnection } =
      connectControlPageToFakeServer();

    // Act: try to clear everything.
    const sending = serverConnection.sendCommand({ type: 'clearAll' });
    const whyItFailed = await sending.catch((failure: unknown) => failure);

    // Assert: the promise rejected with a pt-BR reason and nothing was sent.
    expect(whyItFailed, 'a command with no connection must be refused').toMatchObject({
      name: 'CommandFailedError',
      code: 'NOT_CONNECTED',
      message: 'Sem conexão com o servidor. O comando não foi enviado.',
    });
    expect(
      fakeServerSocket.listCommandMessagesReceived(),
      'nothing may be sent while the page is not connected',
    ).toEqual([]);
    expect(
      serverStateStore.getState().lastCommandError?.code,
      'the store must remember the failure for the page to show',
    ).toBe('NOT_CONNECTED');
  });
});
