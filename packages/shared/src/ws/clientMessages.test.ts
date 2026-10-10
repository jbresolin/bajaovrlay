/**
 * WebSocket messages from a client (packages/shared)
 *
 * What this module is for:
 *   A client talks to the server over the WebSocket at `/ws` with two kinds of
 *   message. The control page sends `command`, the only way an operator changes state.
 *   The renderer sends `instanceStatus`, saying whether a graphic really reached the
 *   screen (`on-air`) or could not be shown (`failed`). The server checks every
 *   message against ClientMessageSchema; the command inside a `command` message is
 *   checked by the server's store against CommandSchema, so a bad command is written
 *   to the event log with the field named.
 *
 * What these tests prove:
 *   - A `command` message may carry a requestId and keeps the command exactly as sent.
 *   - An `instanceStatus` message is accepted for `on-air` without a detail and for
 *     `failed` with one.
 *   - An `instanceStatus` message without its instance or its status is refused, and
 *     the failure names the missing field.
 *   - An `instanceStatus` message with a status the renderer may not report is refused,
 *     naming `status`.
 *   - A client cannot send a server message (for example, a slice).
 *
 * What these tests deliberately do not cover:
 *   - Checking the command itself; commands/command.test.ts and the server's store do.
 *   - Turning an `instanceStatus` message into the reportInstanceStatus command, and
 *     refusing it from a client that is not a renderer; apps/server's tests do.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ClientMessageSchema } from './clientMessages.js';

const raceClockInstanceId = '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11';

describe('ClientMessageSchema with a command message', () => {
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

  it('refuses a message that only the server may send', () => {
    // Arrange: a client trying to send state instead of a command.
    const clientSendingState = { type: 'slice', name: 'layers', slice: [] };

    // Act: check the message.
    const result = ClientMessageSchema.safeParse(clientSendingState);

    // Assert: it is refused; clients change state only through commands and reports.
    expect(result.success, 'a client may only send command and instanceStatus messages').toBe(
      false,
    );
  });
});

describe('ClientMessageSchema with an instanceStatus message', () => {
  const acceptedInstanceStatusScenarios = [
    // The usual report: the play animation finished and the clock is showing.
    {
      name: 'accepts a report that the race clock is on air, with no detail',
      message: { type: 'instanceStatus', instanceId: raceClockInstanceId, status: 'on-air' },
    },
    // A failed import or load carries what went wrong, for the layer panel's tooltip.
    {
      name: 'accepts a report that the race clock failed, with the reason',
      message: {
        type: 'instanceStatus',
        instanceId: raceClockInstanceId,
        status: 'failed',
        detail: 'Failed to fetch dynamically imported module: /graphics/race-clock/race-clock.js',
      },
    },
  ];

  it.each(acceptedInstanceStatusScenarios)('$name', ({ message }) => {
    // Arrange: the message as the renderer sends it (from the table above).
    const messageFromRenderer = message;

    // Act: check the message.
    const result = ClientMessageSchema.safeParse(messageFromRenderer);

    // Assert: it is accepted unchanged.
    expect(result.success, 'a complete instanceStatus message must be accepted').toBe(true);
    expect(result.data, 'the report must reach the server exactly as sent').toEqual(
      messageFromRenderer,
    );
  });

  const refusedInstanceStatusScenarios = [
    // Without the instance the server cannot know which graphic the report is about.
    {
      name: 'refuses a report that does not say which instance, naming instanceId',
      message: { type: 'instanceStatus', status: 'on-air' },
      fieldNamedInTheFailure: 'instanceId',
    },
    // A report with no status says nothing.
    {
      name: 'refuses a report without a status, naming status',
      message: { type: 'instanceStatus', instanceId: raceClockInstanceId },
      fieldNamedInTheFailure: 'status',
    },
    // `stopping` is a real instance status, but not one a renderer reports.
    {
      name: 'refuses a report of stopping, which a renderer may not report, naming status',
      message: { type: 'instanceStatus', instanceId: raceClockInstanceId, status: 'stopping' },
      fieldNamedInTheFailure: 'status',
    },
    // A status that does not exist anywhere (a typo, or a newer renderer).
    {
      name: 'refuses a status that does not exist, naming status',
      message: { type: 'instanceStatus', instanceId: raceClockInstanceId, status: 'paused' },
      fieldNamedInTheFailure: 'status',
    },
  ];

  it.each(refusedInstanceStatusScenarios)('$name', ({ message, fieldNamedInTheFailure }) => {
    // Arrange: a broken report (from the table above).
    const brokenMessage = message;

    // Act: check it and turn the failure into readable text.
    const result = ClientMessageSchema.safeParse(brokenMessage);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at the field that is wrong.
    expect(result.success, 'a broken instanceStatus message must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the field that is wrong').toContain(
      fieldNamedInTheFailure,
    );
  });
});
