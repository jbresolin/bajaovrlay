/**
 * Gaps worked out from laps and line passes (BAJAOVRLAY-53), for a source that sends each
 * car's laps and last pass but no gaps, as the Baja app's race answer does. Run on the
 * mapped cars when a positions mapping switches on `workOutGapsFromLaps`. The gaps are as
 * of the last line crossing: between two crossings they stay put, however the cars move.
 * What could go wrong: a source whose cars are not in position order gets gaps to the
 * wrong car; the positions shape refuses such a list anyway.
 */
import { lastPassTargetField } from './flexShapeMappingChecks.js';

/** The statuses of a car still in the race; only these get gaps. */
const statusesStillInTheRace = new Set(['running', 'inPit', 'stopped']);

/** A mapped car as this step reads it: whatever its rules filled, not yet validated. */
type MappedCar = Record<string, unknown>;

/** Reads a whole number a rule filled, or undefined when it is anything else. */
function readWholeNumber(car: MappedCar, fieldName: string): number | undefined {
  const value = car[fieldName];
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

/** Says whether a car is still in the race, by its mapped status. */
function isStillInTheRace(car: MappedCar): boolean {
  return typeof car.status === 'string' && statusesStillInTheRace.has(car.status);
}

/** Says whether the source sent a gap of either kind for this car. */
function hasAGapFromTheSource(car: MappedCar): boolean {
  return car.gapToLeaderMs !== undefined || car.gapToLeaderLaps !== undefined;
}

/**
 * Works out each car's gaps, in list order (which is position order), and takes
 * `lastPassAtMs` off every car. The leader is position 1. For a car still in the race:
 * - on the leader's lap, gapToLeaderMs = its last pass − the leader's;
 * - lapped, gapToLeaderLaps = the laps it is behind;
 * - intervalMs = its last pass − the last pass of the car directly ahead, when that car is
 *   still in the race and on the same lap.
 * Gaps the source sent are never overwritten; a time that would come out negative (the
 * passes out of step with the laps) is left out rather than guessed.
 */
export function addGapsWorkedOutFromLaps(cars: MappedCar[]): MappedCar[] {
  const leader = cars.find((car) => car.position === 1);
  const leaderLaps = leader === undefined ? undefined : readWholeNumber(leader, 'laps');
  const leaderLastPassAtMs =
    leader === undefined ? undefined : readWholeNumber(leader, lastPassTargetField);

  const carsWithGaps = cars.map((car, carIndex) => {
    const carWithGaps: MappedCar = { ...car };
    const isTheLeader = car === leader;
    if (isTheLeader || !isStillInTheRace(car)) {
      return carWithGaps;
    }
    const laps = readWholeNumber(car, 'laps');
    const lastPassAtMs = readWholeNumber(car, lastPassTargetField);

    if (!hasAGapFromTheSource(car) && laps !== undefined && leaderLaps !== undefined) {
      const lapsBehindTheLeader = leaderLaps - laps;
      if (lapsBehindTheLeader > 0) {
        carWithGaps.gapToLeaderLaps = lapsBehindTheLeader;
      }
      const isOnTheLeadersLap = lapsBehindTheLeader === 0;
      const timeBehindTheLeader = subtractPasses(lastPassAtMs, leaderLastPassAtMs);
      if (isOnTheLeadersLap && timeBehindTheLeader !== undefined) {
        carWithGaps.gapToLeaderMs = timeBehindTheLeader;
      }
    }

    const carAhead = cars[carIndex - 1];
    if (car.intervalMs === undefined && carAhead !== undefined && isStillInTheRace(carAhead)) {
      const isOnTheSameLapAsTheCarAhead =
        laps !== undefined && laps === readWholeNumber(carAhead, 'laps');
      const timeBehindTheCarAhead = subtractPasses(
        lastPassAtMs,
        readWholeNumber(carAhead, lastPassTargetField),
      );
      if (isOnTheSameLapAsTheCarAhead && timeBehindTheCarAhead !== undefined) {
        carWithGaps.intervalMs = timeBehindTheCarAhead;
      }
    }
    return carWithGaps;
  });

  for (const car of carsWithGaps) {
    delete car[lastPassTargetField];
  }
  return carsWithGaps;
}

/** The time from one pass to a later one, or undefined when either is unknown or it is negative. */
function subtractPasses(
  laterPassAtMs: number | undefined,
  earlierPassAtMs: number | undefined,
): number | undefined {
  if (laterPassAtMs === undefined || earlierPassAtMs === undefined) {
    return undefined;
  }
  const timeBetween = laterPassAtMs - earlierPassAtMs;
  return timeBetween >= 0 ? timeBetween : undefined;
}
