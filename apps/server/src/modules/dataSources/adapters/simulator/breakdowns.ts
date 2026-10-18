// Which simulated cars break down, when, and whether they come back. A Baja enduro is
// hard on the cars: some stop on track for a repair, some never come back.
import { drawForCarAndLap, scaleDrawBetween } from './seededRandom.js';

// The share of the field that breaks down over four hours: about 15 %, as the brief
// gives. A shorter or longer session scales it (see drawBreakdownOfCar).
const breakdownShareOverFourHours = 0.15;
const fourHoursMs = 4 * 60 * 60_000;

// Of the cars that break down, the share that retires; the others are repaired. Half and
// half keeps a retirement or two in most races, as at the real events.
const retirementShareOfBreakdowns = 0.5;

// How long a repaired car stands still: 5 to 15 minutes, as the brief gives (a chain
// or a CVT belt fixed by the team at the trackside).
const shortestBreakdownStopMs = 5 * 60_000;
const longestBreakdownStopMs = 15 * 60_000;

/** A car's breakdown: a moment in running time, and either a stop of some length or the end. */
export type Breakdown =
  | { kind: 'retirement'; atRunningMs: number }
  | { kind: 'stop'; atRunningMs: number; stopDurationMs: number };

/**
 * The car's breakdown, or null when it runs trouble-free. About 15 % of the field over
 * four hours (capped at every car for a very long session); the moment is anywhere in
 * the session; half retire, half stop 5 to 15 minutes.
 */
export function drawBreakdownOfCar(
  seed: number,
  carIndex: number,
  sessionDurationMs: number,
): Breakdown | null {
  const breakdownChance = Math.min(
    1,
    (breakdownShareOverFourHours * sessionDurationMs) / fourHoursMs,
  );
  const breaksDown = drawForCarAndLap(seed, carIndex, 0, 'breakdownChance') < breakdownChance;
  if (!breaksDown) {
    return null;
  }

  const momentDraw = drawForCarAndLap(seed, carIndex, 0, 'breakdownMoment');
  const atRunningMs = Math.round(scaleDrawBetween(momentDraw, 0, sessionDurationMs));
  const isRetirement =
    drawForCarAndLap(seed, carIndex, 0, 'breakdownIsRetirement') < retirementShareOfBreakdowns;
  if (isRetirement) {
    return { kind: 'retirement', atRunningMs };
  }

  const stopDraw = drawForCarAndLap(seed, carIndex, 0, 'breakdownStopDuration');
  const stopDurationMs = Math.round(
    scaleDrawBetween(stopDraw, shortestBreakdownStopMs, longestBreakdownStopMs),
  );
  return { kind: 'stop', atRunningMs, stopDurationMs };
}
