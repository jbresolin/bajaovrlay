/**
 * WebSocket messages from a client (packages/shared)
 *
 * What this module is for:
 *   A client (the control page) changes state only by sending a `command` message over
 *   the WebSocket at `/ws`. The server checks the envelope against ClientMessageSchema;
 *   the command inside is checked by the server's store against CommandSchema, so a bad
 *   command is written to the event log with the field named.
 *
 * What these tests prove:
 *   - A `command` message may carry a requestId and keeps the command exactly as sent.
 *   - A client cannot send anything but a command (for example, a slice).
 *
 * What these tests deliberately do not cover:
 *   - Checking the command itself; commands/command.test.ts and the server's store do.
 */
import { describe, expect, it } from 'vitest';

import { ClientMessageSchema } from './clientMessages.js';

describe('ClientMessageSchema', () => {
  it('accepts a command message with a requestId and keeps the command as sent', () => {
    // Arrange: the control page clears the lower third and tags the request.
    const clearLowerThirdMessage = {
      type: 'command',
      requestId: 'pedido-18',
      command: { type: 'clearLayer', layerId: 'lower-third' },
    };

    // Act: check the message.
    const result = ClientMessageSchema.safeParse(clearLowerThirdMessage);

    // Assert: it is accepted unchanged; the command inside is the store's to check.
    expect(result.success, 'a command message must be accepted').toBe(true);
    expect(result.data, 'the command must reach the store exactly as sent').toEqual(
      clearLowerThirdMessage,
    );
  });

  it('refuses a message that is not a command', () => {
    // Arrange: a client trying to send state instead of a command.
    const clientSendingState = { type: 'slice', name: 'layers', slice: [] };

    // Act: check the message.
    const result = ClientMessageSchema.safeParse(clientSendingState);

    // Assert: it is refused; clients change state only through commands.
    expect(result.success, 'a client may only send command messages').toBe(false);
  });
});
