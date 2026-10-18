/**
 * A repairable breakdown during a pit stop, in the simulated enduro (apps/server)
 *
 * What this module is for:
 *   simulateEnduroAt lets a car break down at any moment, also while it is in the pits.
 *   A repair that starts during a pit stop is worked on there, so the car leaves when
 *   the later of the two ends: the stop or the repair. It never waits for the stop to
 *   end and then does the whole repair.
 *
 * What these tests prove:
 *   - In the seed 21 race, car 47 (which breaks down during its pit stop) shows stopped
 *     on 12 laps until its repair ends, and running after.
 *   - Lap 13 ends exactly one drive after the repair ends: only the repair left once the
 *     stop is over lengthens the lap, not the whole repair added after the stop.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the race (simulateEnduro.test.ts).
 *   - A breakdown on track, which stops the car for the whole repair.
 */
import { describe, expect, it } from 'vitest';

import { type EnduroRaceState, simulateEnduroAt } from './simulateEnduro.js';

const fourHoursMs = 4 * 60 * 60 * 1000;
const oneMinuteMs = 60_000;
/** Long enough after the start for any red and the checkered period to be over. */
const longAfterTheFinishMs = fourHoursMs + 2 * 60 * oneMinuteMs;

// Found by exploring the seeded races (seed 21 has no red, so elapsed and running time
// agree). Car 47 crosses the line after lap 12 at 1 h 24 min 24.457 s and pits until
// 1 h 27 min 42.501 s. At 1 h 25 min 56.075 s, during that stop, it breaks down for a
// repair of 8 min 16.619 s, which the team works on in the pits: the repair ends at
// 1 h 34 min 12.694 s, and the car leaves then. Lap 13 is a 6 min 45.365 s drive after
// that. Before gate 2 the whole repair was added after the pit stop, as if the team
// had waited for the stop to end before starting it: lap 13 ended 1 min 46.426 s later.
const seed21Race = { seed: 21, carCount: 60, sessionDurationMs: fourHoursMs };
const repairEndsAtMs = 5_652_694;
const lap13DriveMs = 405_365;

/** The car of a race state with the given number; throws when it is not racing. */
function findCar(raceState: EnduroRaceState, carNumber: number) {
  const car = raceState.cars.find((candidate) => candidate.carNumber === carNumber);
  if (car === undefined) {
    throw new Error(`car ${String(carNumber)} is not in the race`);
  }
  return car;
}

describe('a repairable breakdown during a pit stop, in the seed 21 race', () => {
  it('shows car 47 stopped on 12 laps until its repair ends, then running', () => {
    // Arrange: a second before and a second after the repair ends.
    const secondBeforeTheRepairEndsMs = repairEndsAtMs - 1000;
    const secondAfterTheRepairEndsMs = repairEndsAtMs + 1000;

    // Act: read car 47 at both moments.
    const beforeTheEnd = findCar(simulateEnduroAt(seed21Race, secondBeforeTheRepairEndsMs), 47);
    const afterTheEnd = findCar(simulateEnduroAt(seed21Race, secondAfterTheRepairEndsMs), 47);

    // Assert: stopped on 12 laps until the repair ends, then back out on track.
    expect(beforeTheEnd.status, 'car 47 is still being repaired').toBe('stopped');
    expect(beforeTheEnd.lapCompletedAtRunningMs, 'car 47 has done 12 laps').toHaveLength(12);
    expect(afterTheEnd.status, 'car 47 must be back on track once the repair ends').toBe('running');
  });

  it('adds only the repair time left after the pit stop to lap 13', () => {
    // Arrange: long after the finish, when lap 13 is long done.
    const finishedRace = simulateEnduroAt(seed21Race, longAfterTheFinishMs);

    // Act: read when car 47 crossed the line at the end of lap 13.
    const lap13EndedAtMs = findCar(finishedRace, 47).lapCompletedAtRunningMs[12];

    // Assert: the repair's end plus one lap's drive (1 h 40 min 58.059 s); the old model
    // crossed at 1 h 42 min 44.485 s, the pit stop's end plus the whole repair and drive.
    expect(
      lap13EndedAtMs,
      'lap 13 must end one drive after the repair ends, with no time added twice',
    ).toBe(repairEndsAtMs + lap13DriveMs);
  });
});
