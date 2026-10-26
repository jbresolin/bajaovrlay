/**
 * The simulator adapter: a simulated enduro as a live source (apps/server)
 *
 * What this module is for:
 *   A source of kind `simulator` answers each poll with the session, positions, overall
 *   standings and incidents (penalties and warnings, BAJAOVRLAY-44) of a simulated enduro
 *   at "now", and the brackets of a simulated Super Prime (BAJAOVRLAY-25). The adapter only turns wall time
 *   into simulated time (from simulatedStartAtMs, at the configured speed) and hands
 *   the race state to shapesFromRaceState.ts. With isFailing on, every poll fails with
 *   "Falha simulada.", so the operator can rehearse a late source on purpose.
 *
 * What these tests prove:
 *   - Wall time becomes simulated time with the speed: at 60×, one real minute is one
 *     simulated hour; before the start, or with no start, the race is at its green flag.
 *   - A poll answers the five shapes, dated now, and they are valid.
 *   - "Reiniciar corrida" restarts the Super Prime too: a bracket decided before the
 *     restart is back at its draw, under a new session id.
 *   - The session id names the seed and the race's start, so "Reiniciar corrida" is a new
 *     session: the event inbox keys fastest laps and leader changes by it, and the same
 *     lap of a restarted race is a new event.
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

/** The sessionId of one shape of an answer, which the adapter hands back unchecked. */
function readSessionIdOfShape(shape: unknown): unknown {
  const isObject = typeof shape === 'object' && shape !== null;
  return isObject && 'sessionId' in shape ? shape.sessionId : undefined;
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
  it('answers a valid session, positions, standings, incidents and brackets dated now', async () => {
    // Arrange: the simulator at 60×, polled at 13:02 (two simulated hours in).
    const adapter = createSimulatorAdapter();
    const config = buildSimulatorConfigStartedAt1300(60);
    const pollAtMs = turnedOnAtMs + 2 * oneMinuteMs;

    // Act: poll once.
    const answer = await adapter.pollOnce(config, buildPollContextAt(pollAtMs));

    // Assert: five valid shapes, each dated at the poll.
    expect(Object.keys(answer.shapes).sort(), 'the simulator answers five shapes').toEqual([
      'brackets',
      'incidents',
      'positions',
      'session',
      'standings',
    ]);
    const everyShapeKey = ['session', 'positions', 'standings', 'incidents', 'brackets'] as const;
    for (const shapeKey of everyShapeKey) {
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
      'the simulator says it produces session, positions, standings, incidents and brackets',
    ).toEqual(['session', 'positions', 'standings', 'incidents', 'brackets']);
  });

  it('restarts the Super Prime with the race: back at its draw, a session of its own', async () => {
    // Arrange: the seeded simulator at 60× started at 13:00, so its 60-car Super Prime is
    // over by 13:30; then restarted at 13:30 ("Reiniciar corrida" moves the start).
    const adapter = createSimulatorAdapter();
    const firstRace = buildSimulatorConfigStartedAt1300(60);
    const restartedRace = { ...firstRace, simulatedStartAtMs: turnedOnAtMs + 30 * oneMinuteMs };

    // Act: poll the first race at 13:30, and the restarted one at the same moment.
    const pollAtMs = turnedOnAtMs + 30 * oneMinuteMs;
    const beforeRestart = await adapter.pollOnce(firstRace, buildPollContextAt(pollAtMs));
    const afterRestart = await adapter.pollOnce(restartedRace, buildPollContextAt(pollAtMs));
    const readRounds = (shape: unknown) =>
      (
        shape as {
          rounds: Array<{
            name: string;
            matches: Array<{ carB?: unknown; winnerCarNumber?: number }>;
          }>;
        }
      ).rounds;

    // Assert: before, every round down to a decided final; after, the first round alone,
    // its races not run, named by the new start.
    const roundsBefore = readRounds(beforeRestart.shapes.brackets);
    const roundsAfter = readRounds(afterRestart.shapes.brackets);
    expect(
      roundsBefore.at(-1)?.matches[0]?.winnerCarNumber,
      'the first Super Prime has a champion by 13:30',
    ).toBeDefined();
    expect(
      roundsAfter.map((round) => round.name),
      'the restart is back at the draw',
    ).toEqual(['32 avos de final']);
    expect(
      roundsAfter[0]?.matches.filter((match) => match.carB !== undefined && match.winnerCarNumber),
      'no race of the restarted Super Prime is run yet',
    ).toEqual([]);
    expect(
      readSessionIdOfShape(afterRestart.shapes.brackets),
      'the restarted Super Prime is a session of its own',
    ).toBe(`simulador-enduro-2027-${String(pollAtMs)}-super-prime`);
  });

  it('names the session by its seed and its start, so a restarted race is a new session', async () => {
    // Arrange: the same seeded simulator started at 13:00, and again at 13:30 (the operator
    // pressed "Reiniciar corrida").
    const adapter = createSimulatorAdapter();
    const firstRace = buildSimulatorConfigStartedAt1300(60);
    const restartedRace = { ...firstRace, simulatedStartAtMs: turnedOnAtMs + 30 * oneMinuteMs };

    // Act: poll each one minute after its own start.
    const firstAnswer = await adapter.pollOnce(
      firstRace,
      buildPollContextAt(turnedOnAtMs + oneMinuteMs),
    );
    const restartedAnswer = await adapter.pollOnce(
      restartedRace,
      buildPollContextAt(turnedOnAtMs + 31 * oneMinuteMs),
    );

    // Assert: the seed and the start moment name each session, the same in every shape.
    const expectedFirstSessionId = `simulador-enduro-2027-${String(turnedOnAtMs)}`;
    const expectedRestartedSessionId = `simulador-enduro-2027-${String(turnedOnAtMs + 30 * oneMinuteMs)}`;
    expect(
      readSessionIdOfShape(firstAnswer.shapes.session),
      'the first race is named by its start',
    ).toBe(expectedFirstSessionId);
    expect(
      readSessionIdOfShape(firstAnswer.shapes.incidents),
      'the incidents carry the same session id as the session',
    ).toBe(expectedFirstSessionId);
    expect(
      readSessionIdOfShape(restartedAnswer.shapes.positions),
      'the restarted race is a session of its own',
    ).toBe(expectedRestartedSessionId);
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
