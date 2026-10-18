// When a simulated car pits and for how long. An enduro car pits for fuel and a driver
// change every so many laps; the stop is long or short depending on what is done.
import { drawForCarAndLap, scaleDrawBetween } from './seededRandom.js';

// Laps between two pit stops: every 8 to 14 laps, as the brief gives (a tank lasts
// roughly an hour of enduro, and teams split the four hours between their drivers).
const fewestLapsBetweenPitStops = 8;
const mostLapsBetweenPitStops = 14;

// How long a stop lasts: 1 minute (fuel only) to 4 minutes (fuel, driver change and a
// quick check), as the brief gives.
const shortestPitStopMs = 60_000;
const longestPitStopMs = 4 * 60_000;

/**
 * How many laps the car drives before its next pit stop, counted from `lapNumber` (0 at
 * the start, otherwise the lap after which it last pitted): 8 to 14.
 */
export function drawLapsUntilNextPitStop(
  seed: number,
  carIndex: number,
  lapNumber: number,
): number {
  const draw = drawForCarAndLap(seed, carIndex, lapNumber, 'lapsUntilPitStop');
  // Floor over a range one wider than the last value, so 14 is as likely as 8.
  return Math.floor(scaleDrawBetween(draw, fewestLapsBetweenPitStops, mostLapsBetweenPitStops + 1));
}

/** How long the car's pit stop after lap `lapNumber` lasts: 1 to 4 minutes. */
export function drawPitStopDurationMs(seed: number, carIndex: number, lapNumber: number): number {
  const draw = drawForCarAndLap(seed, carIndex, lapNumber, 'pitStopDuration');
  return Math.round(scaleDrawBetween(draw, shortestPitStopMs, longestPitStopMs));
}
