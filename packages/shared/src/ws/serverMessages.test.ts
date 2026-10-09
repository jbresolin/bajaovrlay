/**
 * WebSocket messages from the server (packages/shared)
 *
 * What this module is for:
 *   The control page and the renderer talk to the server over one WebSocket at `/ws`.
 *   The server sends `hello` (every slice, on connect), `slice` (one slice that
 *   changed) and `commandResult` (ok, or an error with a pt-BR message). Clients check
 *   every message they receive against ServerMessageSchema.
 *
 * What these tests prove:
 *   - A `slice` message is accepted only when its contents match the slice it names.
 *   - An ok `commandResult` echoes the requestId; an error one must carry a code from
 *     the closed list and a pt-BR message.
 *   - A message with an unknown `type` is refused.
 *
 * What these tests deliberately do not cover:
 *   - The JSON examples in README.md; protocolReadmeExamples.test.ts checks those.
 *   - Sending and receiving on a real socket; apps/server's webSocketHub tests do.
 */
import { describe, expect, it } from 'vitest';

import { ServerMessageSchema } from './serverMessages.js';

const lowerThirdLayer = {
  id: 'lower-third',
  name: 'Tarja',
  zIndex: 40,
  replacePolicy: 'out-then-in',
  persistent: false,
};

describe('ServerMessageSchema', () => {
  it('accepts a slice message whose contents match the slice it names', () => {
    // Arrange: the server tells clients the layer list changed.
    const layersSliceMessage = { type: 'slice', name: 'layers', slice: [lowerThirdLayer] };

    // Act: check the message.
    const result = ServerMessageSchema.safeParse(layersSliceMessage);

    // Assert: it is accepted unchanged.
    expect(result.success, 'a well-formed layers slice message must be accepted').toBe(true);
    expect(result.data, 'the accepted message must not be altered').toEqual(layersSliceMessage);
  });

  it('refuses a slice message whose contents belong to another slice', () => {
    // Arrange: a message that says "instances" but carries layers.
    const mislabelledSliceMessage = { type: 'slice', name: 'instances', slice: [lowerThirdLayer] };

    // Act: check the message.
    const result = ServerMessageSchema.safeParse(mislabelledSliceMessage);

    // Assert: it is refused, so a client never stores layers as instances.
    expect(result.success, 'the slice contents must match the slice name').toBe(false);
  });

  const commandResultScenarios = [
    // The usual answer: the command worked, echoing the client's requestId.
    {
      name: 'accepts an ok result echoing the requestId',
      message: { type: 'commandResult', requestId: 'pedido-17', ok: true },
      isAccepted: true,
    },
    // A refusal must tell the operator why, in pt-BR, with a stable code.
    {
      name: 'accepts an error result with a code and a pt-BR message',
      message: {
        type: 'commandResult',
        requestId: null,
        ok: false,
        error: { code: 'LAYER_NOT_FOUND', message: 'A camada "placar" não existe.' },
      },
      isAccepted: true,
    },
    // A failure with nothing to show the operator is a server bug.
    {
      name: 'refuses an error result without the error',
      message: { type: 'commandResult', requestId: null, ok: false },
      isAccepted: false,
    },
    // Codes are a closed list so clients can react to them reliably.
    {
      name: 'refuses an error code that is not in the list',
      message: {
        type: 'commandResult',
        requestId: null,
        ok: false,
        error: { code: 'SOMETHING_ODD', message: 'Algo estranho aconteceu.' },
      },
      isAccepted: false,
    },
  ];

  it.each(commandResultScenarios)('$name', ({ message, isAccepted }) => {
    // Arrange: a commandResult message (from the table above).
    const commandResultMessage = message;

    // Act: check the message.
    const result = ServerMessageSchema.safeParse(commandResultMessage);

    // Assert: it is accepted or refused as the row says.
    expect(result.success, 'the commandResult must be judged as the scenario says').toBe(
      isAccepted,
    );
  });

  it('refuses a message type the protocol does not have', () => {
    // Arrange: a message type that does not exist.
    const unknownMessage = { type: 'goodbye' };

    // Act: check the message.
    const result = ServerMessageSchema.safeParse(unknownMessage);

    // Assert: it is refused.
    expect(result.success, 'only hello, slice and commandResult come from the server').toBe(false);
  });
});
