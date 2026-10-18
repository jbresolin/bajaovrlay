// The simulated enduro's flags: when the yellows come out, whether a red stops the race,
// and which flag shows at a moment. Two clocks are in play:
// - elapsed time: simulated time since the green flag, what the adapter hands in;
// - running time: elapsed time minus the time spent under a red. The cars and the
//   session clock follow running time, because a red stops the race and the clock.
import type { SessionState } from '@bajaovrlay/shared';

import { drawForRace, scaleDrawBetween } from './seededRandom.js';

// One yellow for every 80 minutes of session, at least one: three in a four-hour
// enduro, about what a national event sees (a stuck car, a car on its side).
const sessionTimePerYellowMs = 80 * 60_000;

// Where in its share of the session a yellow may start: between 20 % and 80 % of it, so
// two yellows never touch and none starts at the green or ends at the checkered flag.
const earliestYellowStartInItsShare = 0.2;
const latestYellowStartInItsShare = 0.8;

// How long a yellow lasts: 4 to 10 minutes, long enough to recover a car.
const shortestYellowMs = 4 * 60_000;
const longestYellowMs = 10 * 60_000;

// The chance of a red in a race: one in four ("rarely" in the brief; a red means the
// track is blocked or unsafe).
const redFlagChancePerRace = 0.25;

// When a red may come out: between a quarter and three quarters of the session, so it
// never meets the start or the finish.
const earliestRedFlagInTheSession = 0.25;
const latestRedFlagInTheSession = 0.75;

// How long a red lasts: 5 to 12 minutes ("a short red" in the brief).
const shortestRedFlagMs = 5 * 60_000;
const longestRedFlagMs = 12 * 60_000;

/**
 * How long the checkered flag shows after the session's time is up, before the session
 * is finished: 15 minutes, enough for the slowest car to finish its last lap even after
 * a pit stop (4 min + a 7 min lap slowed by 30 % ≈ 13 min). Cars stop moving then.
 */
export const checkeredFlagPeriodMs = 15 * 60_000;

/** A yellow, in running time: it starts at `startRunningMs` and ends at `endRunningMs`. */
export type YellowPeriod = { startRunningMs: number; endRunningMs: number };

/**
 * A red. It starts on both clocks at the same moment (no red came before it, so elapsed
 * and running time are still equal) and lasts `durationMs` of elapsed time, during which
 * running time stands still.
 */
export type RedFlag = { startsAtElapsedMs: number; durationMs: number };

/** Every flag of one race, drawn from the seed: the yellows in order, and the red if any. */
export type FlagSchedule = { yellowPeriods: YellowPeriod[]; redFlag: RedFlag | null };

/**
 * Draws the flags of a race from its seed. The session is cut into equal shares, one
 * per yellow, and each yellow starts somewhere in the middle of its share; a red comes
 * out in one race in four. A red may fall inside a yellow: the red shows, and the
 * yellow carries on when the race restarts.
 */
export function buildFlagScheduleOfRace(seed: number, sessionDurationMs: number): FlagSchedule {
  const yellowCount = Math.max(1, Math.round(sessionDurationMs / sessionTimePerYellowMs));
  const shareOfTheSessionMs = sessionDurationMs / yellowCount;
  const yellowPeriods: YellowPeriod[] = [];
  for (let yellowNumber = 1; yellowNumber <= yellowCount; yellowNumber += 1) {
    const shareStartMs = (yellowNumber - 1) * shareOfTheSessionMs;
    const shareEndMs = shareStartMs + shareOfTheSessionMs;
    const startRunningMs = Math.round(
      shareStartMs +
        shareOfTheSessionMs *
          scaleDrawBetween(
            drawForRace(seed, yellowNumber, 'yellowStart'),
            earliestYellowStartInItsShare,
            latestYellowStartInItsShare,
          ),
    );
    const drawnDurationMs = scaleDrawBetween(
      drawForRace(seed, yellowNumber, 'yellowDuration'),
      shortestYellowMs,
      longestYellowMs,
    );
    // In a short session the share may be shorter than the yellow: end it in its share.
    const endRunningMs = Math.round(Math.min(startRunningMs + drawnDurationMs, shareEndMs - 1));
    yellowPeriods.push({ startRunningMs, endRunningMs });
  }

  const hasARedFlag = drawForRace(seed, 1, 'redFlagChance') < redFlagChancePerRace;
  if (!hasARedFlag) {
    return { yellowPeriods, redFlag: null };
  }
  const startsAtElapsedMs = Math.round(
    sessionDurationMs *
      scaleDrawBetween(
        drawForRace(seed, 1, 'redFlagMoment'),
        earliestRedFlagInTheSession,
        latestRedFlagInTheSession,
      ),
  );
  const durationMs = Math.round(
    scaleDrawBetween(drawForRace(seed, 1, 'redFlagDuration'), shortestRedFlagMs, longestRedFlagMs),
  );
  return { yellowPeriods, redFlag: { startsAtElapsedMs, durationMs } };
}

/**
 * Running time at an elapsed moment: the same before a red, held at the red's start
 * during it, and behind elapsed time by the red's length after it.
 */
export function convertElapsedTimeToRunningTime(elapsedMs: number, schedule: FlagSchedule): number {
  const redFlag = schedule.redFlag;
  if (redFlag === null || elapsedMs <= redFlag.startsAtElapsedMs) {
    return elapsedMs;
  }
  const redFlagEndsAtElapsedMs = redFlag.startsAtElapsedMs + redFlag.durationMs;
  if (elapsedMs < redFlagEndsAtElapsedMs) {
    return redFlag.startsAtElapsedMs;
  }
  return elapsedMs - redFlag.durationMs;
}

/** Whether a red shows at this elapsed moment. */
export function isRedFlagOutAt(elapsedMs: number, schedule: FlagSchedule): boolean {
  const redFlag = schedule.redFlag;
  if (redFlag === null) {
    return false;
  }
  return (
    elapsedMs >= redFlag.startsAtElapsedMs &&
    elapsedMs < redFlag.startsAtElapsedMs + redFlag.durationMs
  );
}

/** Whether a yellow shows at this running-time moment (a red, if out, shows instead). */
export function isYellowFlagOutAt(runningMs: number, schedule: FlagSchedule): boolean {
  return schedule.yellowPeriods.some(
    (yellow) => runningMs >= yellow.startRunningMs && runningMs < yellow.endRunningMs,
  );
}

/**
 * The session's flag at an elapsed moment, in the race clock's values: red while a red
 * is out; checkered from the moment running time reaches the session's length, for
 * checkeredFlagPeriodMs; finished afterwards; otherwise yellow or green. The race starts
 * at the green flag (no 'pre' period: the simulator starts when it is turned on).
 */
export function readSessionFlagAt(
  elapsedMs: number,
  schedule: FlagSchedule,
  sessionDurationMs: number,
): SessionState {
  if (isRedFlagOutAt(elapsedMs, schedule)) {
    return 'red';
  }
  const runningMs = convertElapsedTimeToRunningTime(elapsedMs, schedule);
  if (runningMs >= sessionDurationMs + checkeredFlagPeriodMs) {
    return 'finished';
  }
  if (runningMs >= sessionDurationMs) {
    return 'checkered';
  }
  return isYellowFlagOutAt(runningMs, schedule) ? 'yellow' : 'green';
}
