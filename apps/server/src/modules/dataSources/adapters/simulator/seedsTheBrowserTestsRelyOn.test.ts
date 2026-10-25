/**
 * The simulator seeds the browser tests rely on (apps/server)
 *
 * What this module is for:
 *   Two browser tests of the control page pick a simulator seed because its race has an
 *   event early: they wait for that event in real time at 60×, so a seed whose event moved
 *   to minute 50 would make them wait a minute or time out, far from the cause. A change
 *   to the flags or the incident draw that moves these events must fail here, by name,
 *   and point at the browser test to re-pick a seed for.
 *
 * What these tests prove:
 *   - Seed 1405's first yellow comes about 16 simulated minutes after the green flag, and
 *     its race has no red flag.
 *   - Seed 227's first incident is a penalty, about 3 simulated minutes in.
 *   - Seed 2027's ten-car Super Prime is decided 17 simulated minutes in, car 8 its champion.
 *
 * What these tests deliberately do not cover:
 *   - That the browser tests then see these events on the page: they are the check
 *     (bindingsFollowTheSimulator.e2e.ts, eventInboxWithTheSimulator.e2e.ts and
 *     bracketStepsWithTheSimulator.e2e.ts).
 *   - How yellows and incidents are drawn in general: flags.test.ts and
 *     simulatedIncidents.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { buildFlagScheduleOfRace } from './flags.js';
import { simulateBracketAt } from './simulatedBracket.js';
import { drawIncidentScheduleOfRace } from './simulatedIncidents.js';

// The seeded simulator's own settings (an empty config): 60 cars, a four-hour session.
const carsInTheSeededRace = 60;
const sessionDurationMs = 4 * 60 * 60_000;
const millisecondsInAMinute = 60_000;

/** The simulated minute of the race's first yellow, and whether the race has a red. */
function readFirstYellowOfRace(seed: number) {
  const schedule = buildFlagScheduleOfRace(seed, sessionDurationMs);
  const firstYellow = schedule.yellowPeriods[0];
  return {
    minute: (firstYellow?.startRunningMs ?? Number.NaN) / millisecondsInAMinute,
    kind: 'yellow',
    hasARedFlag: schedule.redFlag !== null,
  };
}

/** The simulated minute and the kind of the race's first incident. */
function readFirstIncidentOfRace(seed: number) {
  const incidents = drawIncidentScheduleOfRace({
    seed,
    carCount: carsInTheSeededRace,
    sessionDurationMs,
  });
  const firstIncident = incidents[0];
  return {
    minute: (firstIncident?.atElapsedMs ?? Number.NaN) / millisecondsInAMinute,
    kind: firstIncident?.kind ?? 'none',
    hasARedFlag: buildFlagScheduleOfRace(seed, sessionDurationMs).redFlag !== null,
  };
}

/** The simulated minute the Super Prime of a seed and field has its champion. */
function readMomentTheSuperPrimeIsDecided(seed: number, carCount: number) {
  for (let minute = 0; minute <= 120; minute += 1) {
    const rounds = simulateBracketAt({ seed, carCount }, minute * millisecondsInAMinute);
    const final = rounds.find((round) => round.name === 'Final')?.matches[0];
    if (final?.winnerCarNumber !== undefined) {
      return {
        minute,
        kind: 'superPrimeDecided',
        hasARedFlag: false,
        champion: final.winnerCarNumber,
      };
    }
  }
  return { minute: Number.NaN, kind: 'none', hasARedFlag: false, champion: undefined };
}

describe('the seeds the browser tests rely on', () => {
  const seedScenarios = [
    // bindingsFollowTheSimulator.e2e.ts sets seed 1405 before "Reiniciar corrida" and
    // waits for the race to turn yellow by itself, about 16 s at 60×. A red first would
    // show red, not yellow.
    {
      name: 'seed 1405: first yellow at about 16 simulated min, no red — bindingsFollowTheSimulator relies on it',
      readFirstEvent: () => readFirstYellowOfRace(1405),
      expectedKind: 'yellow',
      expectedMinute: 16,
      mustHaveNoRedFlag: true,
    },
    // eventInboxWithTheSimulator.e2e.ts starts the simulator on seed 227 and waits for its
    // first penalty to land in "Eventos", about 3 s at 60×.
    {
      name: 'seed 227: first penalty at about 3 min — eventInboxWithTheSimulator relies on it',
      readFirstEvent: () => readFirstIncidentOfRace(227),
      expectedKind: 'penalty',
      expectedMinute: 3,
      mustHaveNoRedFlag: false,
    },
    // bracketStepsWithTheSimulator.e2e.ts starts the simulator on seed 2027 with ten cars at
    // 60× and waits for the Super Prime's champion, about 17 s, before stepping through it.
    {
      name: 'seed 2027, 10 cars: the Super Prime decided at about 17 min — bracketStepsWithTheSimulator relies on it',
      readFirstEvent: () => readMomentTheSuperPrimeIsDecided(2027, 10),
      expectedKind: 'superPrimeDecided',
      expectedMinute: 17,
      mustHaveNoRedFlag: false,
    },
  ];

  it.each(seedScenarios)(
    '$name',
    ({ readFirstEvent, expectedKind, expectedMinute, mustHaveNoRedFlag }) => {
      // Arrange: the seed of the row (in the table above), in the seeded simulator's race.

      // Act: draw its first event.
      const firstEvent = readFirstEvent();

      // Assert: the right kind of event, within half a simulated minute of the expected
      // one, and no red where the browser test needs none.
      expect(
        firstEvent.kind,
        'the first event must be of the kind the browser test waits for',
      ).toBe(expectedKind);
      expect(
        Math.abs(firstEvent.minute - expectedMinute),
        'the first event must come when the browser test expects it; if it moved, re-pick the seed there',
      ).toBeLessThan(0.5);
      if (mustHaveNoRedFlag) {
        expect(firstEvent.hasARedFlag, 'the race must have no red flag').toBe(false);
      }
    },
  );

  it('seed 2027, 10 cars: the Super Prime’s champion is car 8 — bracketStepsWithTheSimulator checks it on the output', () => {
    // Arrange: the seed and field of the walk.

    // Act: run its Super Prime to its champion.
    const superPrime = readMomentTheSuperPrimeIsDecided(2027, 10);

    // Assert: car 8, the car the walk finds marked the winner of the final.
    expect(superPrime.champion, 'the champion the browser test looks for').toBe(8);
  });
});
