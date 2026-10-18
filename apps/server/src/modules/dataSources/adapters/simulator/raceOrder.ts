// The running order of the simulated enduro and the positions entries built from it:
// who is where, how far behind the leader, and how far behind the car ahead.
import type { PositionEntry } from '@bajaovrlay/shared';

import type { CarRaceState } from './simulateEnduro.js';

/**
 * The cars in race order: most laps first; on the same lap, the one that crossed the
 * line first; with no lap yet (the start), the grid order, car 1 first. Retired cars
 * keep their place by the laps they did, as on a timing screen.
 */
export function orderCarsByRacePosition(cars: CarRaceState[]): CarRaceState[] {
  return [...cars].sort((first, second) => {
    const lapsDifference =
      second.lapCompletedAtRunningMs.length - first.lapCompletedAtRunningMs.length;
    if (lapsDifference !== 0) {
      return lapsDifference;
    }
    const firstCrossedAtMs = first.lapCompletedAtRunningMs.at(-1) ?? 0;
    const secondCrossedAtMs = second.lapCompletedAtRunningMs.at(-1) ?? 0;
    if (firstCrossedAtMs !== secondCrossedAtMs) {
      return firstCrossedAtMs - secondCrossedAtMs;
    }
    return first.carNumber - second.carNumber;
  });
}

/**
 * The positions entries of cars already in race order (orderCarsByRacePosition). Gaps
 * follow the positions shape's rule: the leader has none; before the leader's first lap
 * nobody has one; a car on the leader's lap has its gap in ms (how much later it crossed
 * the line at the end of that lap), any other car its gap in laps.
 */
export function buildPositionEntriesInRaceOrder(orderedCars: CarRaceState[]): PositionEntry[] {
  const leader = orderedCars[0];
  return orderedCars.map((car, index) => {
    const carAhead = orderedCars[index - 1];
    const lapDurationsMs = readLapDurationsMs(car);
    const lastLapMs = lapDurationsMs.at(-1);
    const entry: PositionEntry = {
      position: index + 1,
      carNumber: car.carNumber,
      teamName: car.teamName,
      schoolName: car.schoolName,
      laps: car.lapCompletedAtRunningMs.length,
      pitStops: car.pitStopCount,
      status: car.status,
    };
    if (lastLapMs !== undefined) {
      entry.lastLapMs = lastLapMs;
      entry.bestLapMs = Math.min(...lapDurationsMs);
    }
    if (leader !== undefined && carAhead !== undefined) {
      const gapToLeader = buildGapToLeader(car, leader);
      if (gapToLeader.gapToLeaderMs !== undefined) {
        entry.gapToLeaderMs = gapToLeader.gapToLeaderMs;
      }
      if (gapToLeader.gapToLeaderLaps !== undefined) {
        entry.gapToLeaderLaps = gapToLeader.gapToLeaderLaps;
      }
      const intervalMs = measureIntervalToCarAhead(car, carAhead);
      if (intervalMs !== undefined) {
        entry.intervalMs = intervalMs;
      }
    }
    return entry;
  });
}

/** How long each completed lap of a car took, pit stops and repairs included; lap 1 first. */
function readLapDurationsMs(car: CarRaceState): number[] {
  return car.lapCompletedAtRunningMs.map((completedAtMs, index) => {
    const previousCrossingAtMs = car.lapCompletedAtRunningMs[index - 1] ?? 0;
    return completedAtMs - previousCrossingAtMs;
  });
}

/** The gap of a car that is not the leader: in ms on the leader's lap, in laps otherwise. */
function buildGapToLeader(
  car: CarRaceState,
  leader: CarRaceState,
): Pick<PositionEntry, 'gapToLeaderMs' | 'gapToLeaderLaps'> {
  const leaderLaps = leader.lapCompletedAtRunningMs.length;
  const carLaps = car.lapCompletedAtRunningMs.length;
  if (leaderLaps === 0) {
    return {};
  }
  if (carLaps < leaderLaps) {
    return { gapToLeaderLaps: leaderLaps - carLaps };
  }
  const carCrossedAtMs = car.lapCompletedAtRunningMs[carLaps - 1] ?? 0;
  const leaderCrossedAtMs = leader.lapCompletedAtRunningMs[carLaps - 1] ?? 0;
  return { gapToLeaderMs: carCrossedAtMs - leaderCrossedAtMs };
}

/**
 * The interval to the car ahead, measured where this car last crossed the line: how much
 * later it crossed there than the car ahead did on the same lap. Unknown (undefined)
 * with no lap yet, and when the car ahead crossed that line later than this car did:
 * it got ahead since (this car stopped or pitted), so "behind it by" has no time to show.
 */
function measureIntervalToCarAhead(car: CarRaceState, carAhead: CarRaceState): number | undefined {
  const carLaps = car.lapCompletedAtRunningMs.length;
  if (carLaps === 0) {
    return undefined;
  }
  const carCrossedAtMs = car.lapCompletedAtRunningMs[carLaps - 1] ?? 0;
  const carAheadCrossedAtMs = carAhead.lapCompletedAtRunningMs[carLaps - 1] ?? 0;
  const intervalMs = carCrossedAtMs - carAheadCrossedAtMs;
  return intervalMs >= 0 ? intervalMs : undefined;
}
