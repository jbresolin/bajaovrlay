/**
 * Answering one WebSocket message without a real socket (apps/server)
 *
 * What this module is for:
 *   `answerClientMessage` turns one message from a client into the `commandResult` sent
 *   back. It must never throw: a throw here would leave the operator waiting for an
 *   answer that never comes. A renderer's `instanceStatus` message is not a command
 *   envelope, so this is also where it becomes the `reportInstanceStatus` command.
 *
 * What these tests prove:
 *   - When running the command throws (for example the disk is full and saving fails),
 *     the sender gets UNEXPECTED_SERVER_ERROR in pt-BR with its requestId, and the
 *     details go to the log as an error.
 *   - An `instanceStatus` message reaches the store as a `reportInstanceStatus` command
 *     with the same instance id, status and detail, under the connection's actor, and
 *     is answered with a `commandResult` whose requestId is null. A message without a
 *     detail gives a command without one.
 *
 * What these tests deliberately do not cover:
 *   - Messages that are not JSON, outside the protocol or binary, and commands that
 *     succeed or are refused; webSocketHub.test.ts covers those over a real socket.
 *   - What the store does with the report; webSocketHubRoles.test.ts covers it with
 *     the real store.
 *   - That memory is left alone when saving fails; createStateStore.test.ts covers it.
 */
import { describe, expect, it } from 'vitest';

import { createLogger } from '../logger/createLogger.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import type { StateStore } from '../store/createStateStore.js';
import { answerClientMessage } from './clientMessageAnswers.js';

const moduleImportFailure =
  'Failed to fetch dynamically imported module: /graphics/race-clock/race-clock.js';

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

/**
 * A stand-in store that accepts every command and writes down what it was given, so a
 * test can read the exact command and actor that reached it.
 */
function createStoreThatWritesDownEveryCommand() {
  const commandsReceived: Array<{ commandInput: unknown; actor: string }> = [];
  const stateStore: StateStore = {
    readAllSlices: () => {
      throw new Error('not used by answerClientMessage');
    },
    applyCommand: (commandInput, actor) => {
      commandsReceived.push({ commandInput, actor });
      return { ok: true };
    },
    subscribeToSliceChanges: () => () => undefined,
  };
  return { stateStore, commandsReceived };
}

const instanceStatusScenarios = [
  // The graphic's module could not be imported; the detail must reach the instance.
  {
    name: 'turns a failed report with a detail into a command with the same detail',
    message: {
      type: 'instanceStatus',
      instanceId: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
      status: 'failed',
      detail: moduleImportFailure,
    },
    expectedCommand: {
      type: 'reportInstanceStatus',
      instanceId: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
      status: 'failed',
      detail: moduleImportFailure,
    },
  },
  // The normal report has no detail; the command must not carry an empty one, which
  // the command's schema would refuse.
  {
    name: 'turns an on-air report into a command with no detail field at all',
    message: {
      type: 'instanceStatus',
      instanceId: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
      status: 'on-air',
    },
    expectedCommand: {
      type: 'reportInstanceStatus',
      instanceId: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
      status: 'on-air',
    },
  },
];

describe('answerClientMessage with an instanceStatus message', () => {
  it.each(instanceStatusScenarios)('$name', ({ message, expectedCommand }) => {
    // Arrange: a store that writes down what it is given, and a renderer's connection.
    const { stateStore, commandsReceived } = createStoreThatWritesDownEveryCommand();
    const rendererActor = 'renderer:b8d4e6f0-1a2c-4e3b-9d5f-6a7c8e9f0b12';

    // Act: answer the renderer's message as the hub does.
    const commandResult = answerClientMessage({
      messageText: JSON.stringify(message),
      stateStore,
      actor: rendererActor,
      logger: createLogger({ level: 'silent' }),
    });

    // Assert: exactly one command reached the store, field for field, under the
    // renderer's actor, and the answer is ok with no requestId to echo.
    expect(
      commandsReceived,
      'the message must reach the store once, as reportInstanceStatus, with the same fields',
    ).toStrictEqual([{ commandInput: expectedCommand, actor: rendererActor }]);
    expect(commandResult, 'the renderer must be answered ok, with a null requestId').toEqual({
      type: 'commandResult',
      requestId: null,
      ok: true,
    });
  });
});

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
