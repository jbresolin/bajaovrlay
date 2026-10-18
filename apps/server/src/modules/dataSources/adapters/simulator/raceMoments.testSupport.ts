// Test support for the simulator's tests: finding moments of a simulated race on the
// clock the tests ask with (elapsed time) from the clock the flags are drawn on
// (running time), and finding a race with a red flag.
import { buildFlagScheduleOfRace, type FlagSchedule } from './flags.js';

const fourHoursMs = 4 * 60 * 60 * 1000;

/**
 * The elapsed moment of a running-time moment: the same up to the red's start (both
 * clocks agree until then), and later by the red's length after it, because running
 * time stood still during the red. The inverse of convertElapsedTimeToRunningTime.
 */
export function convertRunningMomentToElapsedMoment(
  runningMs: number,
  schedule: FlagSchedule,
): number {
  const redFlag = schedule.redFlag;
  if (redFlag === null || runningMs <= redFlag.startsAtElapsedMs) {
    return runningMs;
  }
  return runningMs + redFlag.durationMs;
}

/**
 * The elapsed moment in the middle of a race's first yellow, as a whole ms (the session
 * clock takes whole ms, so a moment ending in .5 would fail its shape for no reason).
 */
export function findTheMiddleOfTheFirstYellow(schedule: FlagSchedule): number {
  const firstYellow = schedule.yellowPeriods[0];
  if (firstYellow === undefined) {
    throw new Error('the race must have a yellow');
  }
  const middleRunningMs = Math.floor((firstYellow.startRunningMs + firstYellow.endRunningMs) / 2);
  return convertRunningMomentToElapsedMoment(middleRunningMs, schedule);
}

/** The first of the seeds 1..200 whose four-hour race has a red flag. */
export function findTheFirstSeedWithARedFlag(): number {
  for (let seed = 1; seed <= 200; seed += 1) {
    if (buildFlagScheduleOfRace(seed, fourHoursMs).redFlag !== null) {
      return seed;
    }
  }
  throw new Error('no seed from 1 to 200 has a red flag');
}
