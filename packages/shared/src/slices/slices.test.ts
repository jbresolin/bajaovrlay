/**
 * State slices (packages/shared)
 *
 * What this module is for:
 *   The server owns all state as four named slices: `layers` (where graphics can go),
 *   `graphics` (what can be shown), `instances` (what is showing now) and `eventLog`
 *   (every command, in order). SlicesSchema describes all four; the server checks what
 *   it stores and sends against it, and the control page and renderer check what they
 *   receive.
 *
 * What these tests prove:
 *   - A realistic race-day state (five layers, the race clock registered and on air,
 *     one logged command) is accepted unchanged.
 *   - A layer with a replace policy the renderer does not know is refused, and the
 *     failure names the field.
 *   - An instance in a status outside the lifecycle is refused.
 *   - A failed event-log entry must carry the error a person reads.
 *
 * What these tests deliberately do not cover:
 *   - How the server changes slices; the reducer and store tests in apps/server do.
 *   - Every field of every schema; Zod's own behaviour is not re-tested here.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { SlicesSchema } from './slices.js';

/** Builds the state of a race day morning: five layers, the clock registered and on air. */
function buildRaceDayStateWithTheClockOnAir() {
  return {
    layers: [
      { id: 'bug', name: 'Logo', zIndex: 10, replacePolicy: 'out-then-in', persistent: true },
      { id: 'clock', name: 'Relógio', zIndex: 30, replacePolicy: 'out-then-in', persistent: true },
    ],
    graphics: [
      {
        id: 'race-clock',
        manifest: { id: 'baja-race-clock', name: 'Relógio de prova', main: 'race-clock.js' },
        defaultLayerId: 'clock',
        category: 'clock',
        thumbnailUrl: null,
        defaultFields: {},
      },
    ],
    instances: [
      {
        id: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
        layerId: 'clock',
        graphicId: 'race-clock',
        target: 'program',
        resolvedData: { sessionName: 'Enduro de Resistência', state: 'green' },
        currentStep: 0,
        status: 'loading',
        takenAt: '2026-10-09T13:00:00.000Z',
      },
    ],
    eventLog: [
      {
        id: 1,
        ts: '2026-10-09T13:00:00.000Z',
        actor: 'operador:conexao-1',
        command: 'takeGraphic',
        payload: { type: 'takeGraphic', graphicId: 'race-clock', layerId: 'clock' },
        result: { status: 'ok' },
      },
    ],
  };
}

describe('SlicesSchema', () => {
  it('accepts a race day state with the clock on air, unchanged', () => {
    // Arrange: the state the server holds after the operator takes the race clock.
    const raceDayState = buildRaceDayStateWithTheClockOnAir();

    // Act: check it against the schema.
    const result = SlicesSchema.safeParse(raceDayState);

    // Assert: it is accepted and comes back exactly as sent.
    expect(result.success, 'a realistic state must be accepted').toBe(true);
    expect(result.data, 'the accepted state must not be altered').toEqual(raceDayState);
  });

  it('refuses a layer whose replace policy the renderer does not know, naming the field', () => {
    // Arrange: the same state, with a made-up replace policy on the clock layer.
    const raceDayState = buildRaceDayStateWithTheClockOnAir();
    const stateWithUnknownPolicy = {
      ...raceDayState,
      layers: [{ ...raceDayState.layers[1], replacePolicy: 'dissolve' }],
    };

    // Act: check it and turn the failure into readable text.
    const result = SlicesSchema.safeParse(stateWithUnknownPolicy);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at replacePolicy.
    expect(result.success, 'an unknown replace policy must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the bad field').toContain('replacePolicy');
  });

  it('refuses an instance in a status outside the lifecycle', () => {
    // Arrange: the clock instance claims a status that does not exist.
    const raceDayState = buildRaceDayStateWithTheClockOnAir();
    const stateWithUnknownStatus = {
      ...raceDayState,
      instances: [{ ...raceDayState.instances[0], status: 'paused' }],
    };

    // Act: check it against the schema.
    const result = SlicesSchema.safeParse(stateWithUnknownStatus);

    // Assert: it is refused.
    expect(result.success, 'only loading, ready, on-air and stopping are statuses').toBe(false);
  });

  it('refuses a failed event-log entry that does not say why it failed', () => {
    // Arrange: a failed command logged without the error the operator would read.
    const raceDayState = buildRaceDayStateWithTheClockOnAir();
    const stateWithSilentFailure = {
      ...raceDayState,
      eventLog: [{ ...raceDayState.eventLog[0], result: { status: 'failed' } }],
    };

    // Act: check it against the schema.
    const result = SlicesSchema.safeParse(stateWithSilentFailure);

    // Assert: it is refused, because a failure without a reason cannot be audited.
    expect(result.success, 'a failed entry must carry its error').toBe(false);
  });
});
