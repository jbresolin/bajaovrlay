/**
 * State slices (packages/shared)
 *
 * What this module is for:
 *   The server owns all state as six named slices: `layers` (where graphics can go),
 *   `graphics` (what can be shown), `instances` (what is showing now), `rundowns` and
 *   `items` (the planned show) and `eventLog` (the commands that changed something or
 *   were refused, in order). SlicesSchema describes all six; the server checks what it
 *   stores and sends against it, and the control page and renderer check what they
 *   receive.
 *
 * What these tests prove:
 *   - A realistic race-day state (five layers, the race clock registered and on air,
 *     one logged command) is accepted unchanged.
 *   - A layer with a replace policy the renderer does not know is refused, and the
 *     failure names the field.
 *   - An instance in a status outside the lifecycle is refused.
 *   - An instance may be `failed` and carry the reason the renderer gave
 *     (`statusDetail`), and that reason must be a text.
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
    // No rundown and no prepared item: rundownAndItemSlices.test.ts covers those slices.
    rundowns: [],
    items: [],
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
    expect(result.success, 'only loading, ready, on-air, stopping and failed are statuses').toBe(
      false,
    );
  });

  it('accepts a failed instance that carries the reason the renderer gave', () => {
    // Arrange: the renderer reported that the clock could not be loaded, and why.
    const raceDayState = buildRaceDayStateWithTheClockOnAir();
    const stateWithFailedClock = {
      ...raceDayState,
      instances: [
        {
          ...raceDayState.instances[0],
          status: 'failed',
          statusDetail:
            'Failed to fetch dynamically imported module: /graphics/race-clock/race-clock.js',
        },
      ],
    };

    // Act: check it against the schema.
    const result = SlicesSchema.safeParse(stateWithFailedClock);

    // Assert: it is accepted, and the reason is still there for the layer panel to show.
    expect(result.success, 'failed must be a status an instance can be in').toBe(true);
    expect(result.data, 'the reason for the failure must be kept').toEqual(stateWithFailedClock);
  });

  it('refuses an instance whose status detail is not a text, naming the field', () => {
    // Arrange: the failed clock carries an error object instead of words a person reads.
    const raceDayState = buildRaceDayStateWithTheClockOnAir();
    const stateWithUnreadableDetail = {
      ...raceDayState,
      instances: [
        { ...raceDayState.instances[0], status: 'failed', statusDetail: { statusCode: 500 } },
      ],
    };

    // Act: check it and turn the failure into readable text.
    const result = SlicesSchema.safeParse(stateWithUnreadableDetail);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at statusDetail.
    expect(result.success, 'the status detail must be a text').toBe(false);
    expect(failureMessage, 'the failure must name the bad field').toContain('statusDetail');
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
