/**
 * The WebSocket hub at /ws: messages outside the protocol (apps/server)
 *
 * What this module is for:
 *   A client talks to the server only in the protocol's messages. Anything else (text
 *   that is not JSON, JSON that is not a protocol message, a binary frame) must be
 *   answered with an error and logged, and must never close the socket or crash the
 *   server: a page with a bug keeps working for its next valid command.
 *
 * What these tests prove (with a real server on a random port and a real SQLite file):
 *   - A message that is not JSON, or not in the protocol, or a binary frame, gets an
 *     error and a warning in the log, and the socket stays open: a valid command sent
 *     afterwards still works.
 *
 * What these tests deliberately do not cover:
 *   - Valid commands and what they broadcast: webSocketHub.test.ts.
 *   - The heartbeat and the endpoint: webSocketHubConnections.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import {
  isCommandResultMessage,
  prepareTheTakeOfTheClockItem,
  startServerOnARandomPort,
} from './webSocketHubOnARandomPort.testSupport.js';
import { connectWebSocketTestClient } from './webSocketTestClient.testSupport.js';

describe('a message outside the protocol', () => {
  it('gets an error for text that is not JSON, and the socket stays open for the next command', async () => {
    // Arrange: a server that records its log, with the clock item, and the control page.
    const { logger, readRecordedLines } = createRecordingLogger();
    const runningServer = await startServerOnARandomPort({ logger });
    const takeOfTheClockItem = prepareTheTakeOfTheClockItem(runningServer.stateStore);
    const controlPage = await connectWebSocketTestClient(runningServer.port);

    // Act: send text that is not JSON, then a valid command.
    controlPage.sendText('isto não é json');
    const errorResult = await controlPage.waitForMessage('error result', isCommandResultMessage);
    controlPage.sendJson({ type: 'command', requestId: 'pedido-4', command: takeOfTheClockItem });
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
