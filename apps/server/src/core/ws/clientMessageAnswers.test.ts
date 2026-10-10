/**
 * Answering one WebSocket message when the command breaks the server (apps/server)
 *
 * What this module is for:
 *   `answerClientMessage` turns one message from a client into the `commandResult` sent
 *   back. It must never throw: a throw here would leave the operator waiting for an
 *   answer that never comes.
 *
 * What these tests prove:
 *   - When running the command throws (for example the disk is full and saving fails),
 *     the sender gets UNEXPECTED_SERVER_ERROR in pt-BR with its requestId, and the
 *     details go to the log as an error.
 *
 * What these tests deliberately do not cover:
 *   - Messages that are not JSON, outside the protocol or binary, and commands that
 *     succeed or are refused; webSocketHub.test.ts covers those over a real socket.
 *   - That memory is left alone when saving fails; createStateStore.test.ts covers it.
 */
import { describe, expect, it } from 'vitest';

import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import type { StateStore } from '../store/createStateStore.js';
import { answerClientMessage } from './clientMessageAnswers.js';

/** A stand-in store whose every command fails the way a full disk would. */
function createStoreWhoseSavingAlwaysFails(): StateStore {
  return {
    readAllSlices: () => {
      throw new Error('not used by answerClientMessage');
    },
    applyCommand: () => {
      throw new Error('SQLITE_FULL: database or disk is full');
    },
    subscribeToSliceChanges: () => () => undefined,
  };
}

describe('answerClientMessage when the command throws', () => {
  it('answers UNEXPECTED_SERVER_ERROR in pt-BR with the requestId, and logs the error', () => {
    // Arrange: a store that cannot save, a recording logger, and a valid clearAll message.
    const { logger, readRecordedLines } = createRecordingLogger();
    const clearAllMessage = JSON.stringify({
      type: 'command',
      requestId: 'pedido-21',
      command: { type: 'clearAll' },
    });

    // Act: answer the message as the hub does.
    const commandResult = answerClientMessage({
      messageText: clearAllMessage,
      stateStore: createStoreWhoseSavingAlwaysFails(),
      actor: 'operador:conexao-7',
      logger,
    });

    // Assert: the operator gets a pt-BR error for this request; the details are logged.
    expect(commandResult, 'the sender must get an error, never silence').toEqual({
      type: 'commandResult',
      requestId: 'pedido-21',
      ok: false,
      error: {
        code: 'UNEXPECTED_SERVER_ERROR',
        message:
          'Erro inesperado no servidor ao executar o comando. Procure o erro no log do servidor.',
      },
    });
    const errorLines = readRecordedLines().filter((line) => line.level === 'error');
    expect(errorLines, 'the failure must be logged once, with the requestId').toEqual([
      expect.objectContaining({
        message: 'command failed unexpectedly',
        request_id: 'pedido-21',
      }),
    ]);
  });
});
