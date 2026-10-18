// The simulated Baja enduro as a pure function of seed and time: ask for a moment, get
// the whole race at that moment. Nothing is remembered between calls; every car's race
// is driven again from the green flag, lap by lap, with the same seeded draws, so the
// same seed and moment always give the same race (a restart, a replay, a test).
import type { SessionState } from '@bajaovrlay/shared';

import { type Breakdown, drawBreakdownOfCar, type RepairableBreakdown } from './breakdowns.js';
import { readFictionalTeamOfCar } from './fictionalTeams.js';
import {
  buildFlagScheduleOfRace,
  checkeredFlagPeriodMs,
  convertElapsedTimeToRunningTime,
  type FlagSchedule,
  isYellowFlagOutAt,
  readSessionFlagAt,
} from './flags.js';
import { drawBaseLapTimeMsOfCar, drawLapDrivingTimeMs } from './lapTimes.js';
import { drawLapsUntilNextPitStop, drawPitStopDurationMs } from './pitStops.js';

/** What a simulated race is made of: its seed, how many cars, how long the session runs. */
export type EnduroSimulationSettings = {
  seed: number;
  carCount: number;
  sessionDurationMs: number;
};

/** What a car is doing at the moment looked at. */
export type CarRaceStatus = 'running' | 'inPit' | 'stopped' | 'retired';

/** One car at the moment looked at. */
export type CarRaceState = {
  carNumber: number;
  teamName: string;
  schoolName: string;
  /** When the car crossed the line at the end of each lap, in running time; lap 1 first. */
  lapCompletedAtRunningMs: number[];
  /** Pit stops the car has gone into so far. */
  pitStopCount: number;
  status: CarRaceStatus;
  /** True once the car crossed the line after the checkered flag: it has finished. */
  hasTakenTheCheckeredFlag: boolean;
};

/** The whole race at one moment. */
export type EnduroRaceState = {
  settings: EnduroSimulationSettings;
  /** Simulated time since the green flag, reds included. */
  elapsedSimulatedMs: number;
  /** Simulated time the race has actually run: elapsed time minus the time under a red. */
  runningTimeMs: number;
  flag: SessionState;
  flagSchedule: FlagSchedule;
  /** Every car, in grid order (car 1 first). */
  cars: CarRaceState[];
};

/**
 * The race of `settings` at `elapsedSimulatedMs` after the green flag (a negative moment
 * reads as the green flag). Pure: the same arguments always give a deep-equal answer.
 */
export function simulateEnduroAt(
  settings: EnduroSimulationSettings,
  elapsedSimulatedMs: number,
): EnduroRaceState {
  const elapsedMs = Math.max(0, elapsedSimulatedMs);
  const flagSchedule = buildFlagScheduleOfRace(settings.seed, settings.sessionDurationMs);
  const runningTimeMs = convertElapsedTimeToRunningTime(elapsedMs, flagSchedule);
  // Once the session is finished nothing moves: a car still out on track then (a long
  // breakdown stop after the checkered) stays where it is.
  const lastMomentCarsMoveMs = settings.sessionDurationMs + checkeredFlagPeriodMs;
  const carsLookedAtMs = Math.min(runningTimeMs, lastMomentCarsMoveMs);

  const cars: CarRaceState[] = [];
  for (let carIndex = 0; carIndex < settings.carCount; carIndex += 1) {
    cars.push(driveOneCarUntil(settings, flagSchedule, carIndex, carsLookedAtMs));
  }

  return {
    settings,
    elapsedSimulatedMs: elapsedMs,
    runningTimeMs,
    flag: readSessionFlagAt(elapsedMs, flagSchedule, settings.sessionDurationMs),
    flagSchedule,
    cars,
  };
}

/**
 * Drives one car from the green flag, lap by lap, until the moment `nowRunningMs`, and
 * says where it is. Each lap:
 * 1. its driving time is drawn (slower when it begins under a yellow);
 * 2. if the car's breakdown falls in this lap (or in the pit stop before it), it
 *    retires there, or stands still for the repair, which lengthens the lap (a repair
 *    begun in the pits adds only what is left of it once the stop is over);
 * 3. if the lap ends after now, the car is out on track (or stopped): done;
 * 4. the lap is completed; one completed at or after the checkered moment is its last;
 * 5. after every 8 to 14 laps it pits, and the next lap starts when the stop is over
 *    (a car that retires during the stop shows retired from that moment).
 */
function driveOneCarUntil(
  settings: EnduroSimulationSettings,
  flagSchedule: FlagSchedule,
  carIndex: number,
  nowRunningMs: number,
): CarRaceState {
  const { seed, sessionDurationMs } = settings;
  const team = readFictionalTeamOfCar(carIndex);
  const baseLapTimeMs = drawBaseLapTimeMsOfCar(seed, carIndex);
  const breakdown: Breakdown | null = drawBreakdownOfCar(seed, carIndex, sessionDurationMs);

  const lapCompletedAtRunningMs: number[] = [];
  let pitStopCount = 0;
  let status: CarRaceStatus = 'running';
  let hasTakenTheCheckeredFlag = false;
  // A lap starts when the car leaves the line, or the pits; the previous crossing of the
  // line is kept too, so a breakdown during a pit stop counts in the lap that follows it.
  let lapStartsAtMs = 0;
  let previousLineCrossingAtMs = 0;
  let lapsLeftUntilPitStop = drawLapsUntilNextPitStop(seed, carIndex, 0);

  for (let lapNumber = 1; ; lapNumber += 1) {
    const isUnderYellowFlag = isYellowFlagOutAt(lapStartsAtMs, flagSchedule);
    let lapEndsAtMs =
      lapStartsAtMs +
      drawLapDrivingTimeMs(seed, carIndex, lapNumber, baseLapTimeMs, isUnderYellowFlag);

    const breaksDownInThisLap =
      breakdown !== null &&
      breakdown.atRunningMs >= previousLineCrossingAtMs &&
      breakdown.atRunningMs < lapEndsAtMs;
    let isStandingStillNow = false;
    if (breaksDownInThisLap && breakdown.kind === 'retirement') {
      const hasRetiredByNow = nowRunningMs >= breakdown.atRunningMs;
      status = hasRetiredByNow ? 'retired' : 'running';
      break;
    }
    if (breaksDownInThisLap && breakdown.kind === 'stop') {
      lapEndsAtMs += measureRepairTimeAddedToTheLap(breakdown, lapStartsAtMs);
      const repairEndsAtMs = breakdown.atRunningMs + breakdown.stopDurationMs;
      isStandingStillNow = nowRunningMs >= breakdown.atRunningMs && nowRunningMs < repairEndsAtMs;
    }

    if (lapEndsAtMs > nowRunningMs) {
      status = isStandingStillNow ? 'stopped' : 'running';
      break;
    }
    lapCompletedAtRunningMs.push(lapEndsAtMs);
    if (lapEndsAtMs >= sessionDurationMs) {
      hasTakenTheCheckeredFlag = true;
      break;
    }

    previousLineCrossingAtMs = lapEndsAtMs;
    lapsLeftUntilPitStop -= 1;
    if (lapsLeftUntilPitStop > 0) {
      lapStartsAtMs = lapEndsAtMs;
      continue;
    }
    pitStopCount += 1;
    const pitStopEndsAtMs = lapEndsAtMs + drawPitStopDurationMs(seed, carIndex, lapNumber);
    if (pitStopEndsAtMs > nowRunningMs) {
      // A car that retires during this stop shows retired from that moment, not in the
      // pits until the stop would have ended.
      const retiresDuringThisStop =
        breakdown !== null &&
        breakdown.kind === 'retirement' &&
        breakdown.atRunningMs >= lapEndsAtMs &&
        breakdown.atRunningMs < pitStopEndsAtMs;
      const hasRetiredByNow = retiresDuringThisStop && nowRunningMs >= breakdown.atRunningMs;
      status = hasRetiredByNow ? 'retired' : 'inPit';
      break;
    }
    lapStartsAtMs = pitStopEndsAtMs;
    lapsLeftUntilPitStop = drawLapsUntilNextPitStop(seed, carIndex, lapNumber);
  }

  return {
    carNumber: carIndex + 1,
    teamName: team.teamName,
    schoolName: team.schoolName,
    lapCompletedAtRunningMs,
    pitStopCount,
    status,
    hasTakenTheCheckeredFlag,
  };
}

/**
 * How much a repairable breakdown lengthens the lap it counts in: the part of the
 * repair after the lap started. A breakdown on track stops the car for the whole
 * repair; one during the pit stop before the lap is worked on in the pits, so only the
 * repair left once the stop is over adds to the lap (none when the stop outlasts it).
 * The car leaves at max(stop's end, breakdown + repair), never stop's end + repair.
 */
function measureRepairTimeAddedToTheLap(
  breakdown: RepairableBreakdown,
  lapStartsAtMs: number,
): number {
  const repairEndsAtMs = breakdown.atRunningMs + breakdown.stopDurationMs;
  const repairStartsInThisLapAtMs = Math.max(breakdown.atRunningMs, lapStartsAtMs);
  const repairLeftInThisLapMs = repairEndsAtMs - repairStartsInThisLapAtMs;
  return Math.max(0, repairLeftInThisLapMs);
}
