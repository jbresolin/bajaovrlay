/**
 * The simulator adapter: a simulated enduro as a live source (apps/server)
 *
 * What this module is for:
 *   A source of kind `simulator` answers each poll with the session, positions and
 *   overall standings of a simulated enduro at "now". The adapter only turns wall time
 *   into simulated time (from simulatedStartAtMs, at the configured speed) and hands
 *   the race state to shapesFromRaceState.ts. With isFailing on, every poll fails with
 *   "Falha simulada.", so the operator can rehearse a late source on purpose.
 *
 * What these tests prove:
 *   - Wall time becomes simulated time with the speed: at 60×, one real minute is one
 *     simulated hour; before the start, or with no start, the race is at its green flag.
 *   - A poll answers the three shapes, dated now, and they are valid.
 *   - Two polls at the same moment answer the same data (the race has no memory).
 *   - isFailing makes the poll throw the pt-BR "Falha simulada.".
 *   - The server registers this adapter for the `simulator` kind.
 *
 * What these tests deliberately do not cover:
 *   - The race model and the shapes (simulateEnduro.test.ts, shapesFromRaceState.test.ts).
 *   - The poller around the adapter (poller.test.ts, with a fake adapter).
 */
import { type SimulatorConfig, SimulatorConfigSchema, validateDataShape } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { createLogger } from '../../../../core/logger/createLogger.js';
import { createDataSourceAdapters } from '../createDataSourceAdapters.js';
import type { DataSourcePollContext } from '../dataSourceAdapter.js';
import { convertWallTimeToSimulatedElapsedMs, createSimulatorAdapter } from './simulatorAdapter.js';

const oneMinuteMs = 60_000;
const oneHourMs = 60 * oneMinuteMs;
/** 13:00:00 UTC on 14 August 2027: the moment the simulator was turned on. */
const turnedOnAtMs = Date.parse('2027-08-14T13:00:00.000Z');

/** The seeded simulator's config (every default), started at 13:00, at the given speed. */
function buildSimulatorConfigStartedAt1300(speed: number): SimulatorConfig {
  return SimulatorConfigSchema.parse({ speed, simulatedStartAtMs: turnedOnAtMs });
}

/** The context of a poll made at a moment, with a signal that never fires. */
function buildPollContextAt(nowMs: number): DataSourcePollContext {
  return { readCurrentTime: () => new Date(nowMs), signal: new AbortController().signal };
}

describe('wall time into simulated time', () => {
  const timeScenarios = [
    // The brief's example: at 60×, one real minute is one simulated hour.
    {
      name: 'at 60×, one real minute after the start is one simulated hour',
      speed: 60,
      wallClockAfterStartMs: oneMinuteMs,
      expectedElapsedMs: oneHourMs,
    },
    // Real time: the race runs with the wall clock.
    {
      name: 'at 1×, ten real minutes are ten simulated minutes',
      speed: 1,
      wallClockAfterStartMs: 10 * oneMinuteMs,
      expectedElapsedMs: 10 * oneMinuteMs,
    },
    // A wall clock set back (or a start in the future) must not run the race backwards.
    {
      name: 'before the start, the race is at its green flag',
      speed: 5,
      wallClockAfterStartMs: -oneMinuteMs,
      expectedElapsedMs: 0,
    },
  ];

  it.each(timeScenarios)('$name', ({ speed, wallClockAfterStartMs, expectedElapsedMs }) => {
    // Arrange: a simulator turned on at 13:00 at this speed.
    const config = buildSimulatorConfigStartedAt1300(speed);

    // Act: convert the wall-clock moment into simulated time.
    const elapsedMs = convertWallTimeToSimulatedElapsedMs(
      config,
      turnedOnAtMs + wallClockAfterStartMs,
    );

    // Assert: the simulated time is the expected one.
    expect(elapsedMs, 'simulated time is wall time since the start × speed').toBe(
      expectedElapsedMs,
    );
  });

  it('keeps a simulator with no start at its green flag', () => {
    // Arrange: a simulator config that was never turned on (no simulatedStartAtMs).
    const config = SimulatorConfigSchema.parse({ speed: 60 });

    // Act: convert 13:30.
    const elapsedMs = convertWallTimeToSimulatedElapsedMs(config, turnedOnAtMs + 30 * oneMinuteMs);

    // Assert: no start means the race has not run yet.
    expect(elapsedMs, 'with no start, the race stays at 0').toBe(0);
  });
});

describe('a poll of the simulator', () => {
  it('answers a valid session, positions and standings dated now', async () => {
    // Arrange: the simulator at 60×, polled at 13:02 (two simulated hours in).
    const adapter = createSimulatorAdapter();
    const config = buildSimulatorConfigStartedAt1300(60);
    const pollAtMs = turnedOnAtMs + 2 * oneMinuteMs;

    // Act: poll once.
    const answer = await adapter.pollOnce(config, buildPollContextAt(pollAtMs));

    // Assert: three valid shapes, each dated at the poll.
    expect(Object.keys(answer.shapes).sort(), 'the simulator answers three shapes').toEqual([
      'positions',
      'session',
      'standings',
    ]);
    for (const shapeKey of ['session', 'positions', 'standings'] as const) {
      const validation = validateDataShape(shapeKey, answer.shapes[shapeKey]);
      expect(
        validation.isValid ? 'valid' : validation.errorMessage,
        `the ${shapeKey} shape must be valid`,
      ).toBe('valid');
      const updatedAtMs = validation.isValid ? validation.shape.updatedAtMs : undefined;
      expect(updatedAtMs, `the ${shapeKey} shape is dated now`).toBe(pollAtMs);
    }
    expect(
      adapter.listProducedShapes(config),
      'the simulator says it produces session, positions and standings',
    ).toEqual(['session', 'positions', 'standings']);
  });

  it('answers the same data to two polls at the same moment', async () => {
    // Arrange: two separate adapters (as before and after a server restart).
    const adapterBeforeRestart = createSimulatorAdapter();
    const adapterAfterRestart = createSimulatorAdapter();
    const config = buildSimulatorConfigStartedAt1300(30);
    const pollAtMs = turnedOnAtMs + 3 * oneMinuteMs;

    // Act: poll both at 13:03.
    const beforeRestart = await adapterBeforeRestart.pollOnce(config, buildPollContextAt(pollAtMs));
    const afterRestart = await adapterAfterRestart.pollOnce(config, buildPollContextAt(pollAtMs));

    // Assert: the restart changed nothing about the race.
    expect(afterRestart, 'the same moment must give the same race after a restart').toEqual(
      beforeRestart,
    );
  });

  it('fails with "Falha simulada." while isFailing is on', async () => {
    // Arrange: the simulator with isFailing switched on from the page.
    const adapter = createSimulatorAdapter();
    const config = { ...buildSimulatorConfigStartedAt1300(1), isFailing: true };

    // Act: poll once.
    const poll = adapter.pollOnce(config, buildPollContextAt(turnedOnAtMs + oneMinuteMs));

    // Assert: the poll fails with the pt-BR message the operator reads.
    await expect(poll, 'the poll must fail with "Falha simulada."').rejects.toThrow(
      'Falha simulada.',
    );
  });
});

describe('the adapters the server registers', () => {
  it('include the simulator for sources of kind simulator', () => {
    // Arrange: a recordings folder name (the replay adapter needs one; it is not read here).
    const recordingsFolder = 'apps/server/data/recordings';

    // Act: build the server's adapters.
    const adapters = createDataSourceAdapters({
      recordingsFolder,
      logger: createLogger({ level: 'silent' }),
    });

    // Assert: a simulator adapter is registered with the shared config schema.
    expect(adapters.simulator?.kind, 'the simulator kind must have an adapter').toBe('simulator');
    expect(adapters.simulator?.configSchema, 'it checks configs with the shared schema').toBe(
      SimulatorConfigSchema,
    );
  });
});
