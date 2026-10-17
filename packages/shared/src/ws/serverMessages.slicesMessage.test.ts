/**
 * The `slices` message: several slices changed by one state change (packages/shared)
 *
 * What this module is for:
 *   When one command changes more than one slice (every accepted command changes its own
 *   slice and the event log), the server sends them in ONE `slices` message, so a client
 *   never draws the moment between them: "Prévia: limpar" on a previewed layer used to
 *   arrive as "preview gone, no marker yet" and then "marked", and the preview page cut
 *   the program clock in for that moment.
 *
 * What these tests prove:
 *   - A `slices` message carrying the slices one command changed, with `serverNowMs`, is
 *     accepted unchanged.
 *   - Each slice in it is checked by that slice's own schema.
 *   - Unlike `hello` and `slice`, it must carry `serverNowMs`: no older stand-in server
 *     sends it, so nothing needs leaving it out.
 *
 * What these tests deliberately do not cover:
 *   - The group itself, row by row (unknown names, an empty group); changedSlices.test.ts.
 *   - The other server messages; serverMessages.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { ServerMessageSchema } from './serverMessages.js';

const enduroClockOnAir = {
  id: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
  layerId: 'clock',
  graphicId: 'race-clock',
  target: 'program',
  resolvedData: { sessionName: 'Enduro de Resistência', state: 'green' },
  currentStep: 0,
  status: 'on-air',
  takenAt: '2026-10-09T13:00:00.000Z',
};

const eventLogLineOfTheClear = {
  id: 18,
  ts: '2026-10-09T14:32:05.000Z',
  actor: 'operador:3f2a9c1e',
  command: 'previewClearLayer',
  payload: { type: 'previewClearLayer', layerId: 'clock' },
  result: { status: 'ok' },
};

describe('ServerMessageSchema, for a slices message', () => {
  it('accepts the slices one command changed, with the server clock, unchanged', () => {
    // Arrange: what the server sends after "Prévia: limpar" on the previewed clock layer.
    const slicesMessage = {
      type: 'slices',
      slices: {
        instances: [enduroClockOnAir],
        previewClearedLayerIds: ['clock'],
        eventLog: [eventLogLineOfTheClear],
      },
      serverNowMs: 1_791_556_325_000,
    };

    // Act: check the message.
    const result = ServerMessageSchema.safeParse(slicesMessage);

    // Assert: it is accepted and comes out exactly as it went in.
    expect(result.success, 'a well-formed slices message must be accepted').toBe(true);
    expect(result.data, 'the accepted slices message must not be altered').toEqual(slicesMessage);
  });

  const slicesMessageScenarios = [
    // Each slice is checked by its own schema: a marker list is not a list of instances.
    {
      name: 'refuses a slices message whose instances are layer ids',
      message: {
        type: 'slices',
        slices: { instances: ['clock'], previewClearedLayerIds: ['clock'] },
        serverNowMs: 1_791_556_325_000,
      },
    },
    // The server always sends the time; a new message has no old stand-ins to forgive.
    {
      name: 'refuses a slices message without the server clock',
      message: {
        type: 'slices',
        slices: { instances: [enduroClockOnAir], previewClearedLayerIds: [] },
      },
    },
  ];

  it.each(slicesMessageScenarios)('$name', ({ message }) => {
    // Arrange: a slices message that is wrong in one way (from the table above).
    const wrongSlicesMessage = message;

    // Act: check the message.
    const result = ServerMessageSchema.safeParse(wrongSlicesMessage);

    // Assert: it is refused, so a client never takes in a broken state change.
    expect(result.success, 'the broken slices message must be refused').toBe(false);
  });
});
