// How long a simulated car takes for one lap: its own pace (base lap time), a little
// variation from lap to lap, and a slower lap under a yellow flag.
import { drawForCarAndLap, scaleDrawBetween } from './seededRandom.js';

// The fastest and slowest base lap of the field. A Baja SAE Brasil enduro lap of about
// 2 km takes the front runners roughly 4:30 and the back markers about 7:00 (the range
// the brief gives, from the national event's lap charts).
const fastestBaseLapTimeMs = 4 * 60_000 + 30_000;
const slowestBaseLapTimeMs = 7 * 60_000;

// How much one lap may differ from the car's base lap, either way: "a few seconds" in
// the brief; six seconds keeps neighbouring cars swapping places now and then.
const largestLapVariationMs = 6_000;

// How much slower a lap begun under a yellow flag is: about 30 % in the brief (no
// overtaking, slow past the incident).
const yellowFlagLapTimeFactor = 1.3;

/**
 * The car's own pace: its lap time on a clean lap, drawn once per car between 4:30 and
 * 7:00. Spread evenly over that range, so the field has a few front runners, a crowded
 * middle and a few slow cars in every part of it.
 */
export function drawBaseLapTimeMsOfCar(seed: number, carIndex: number): number {
  const draw = drawForCarAndLap(seed, carIndex, 0, 'baseLapTime');
  return Math.round(scaleDrawBetween(draw, fastestBaseLapTimeMs, slowestBaseLapTimeMs));
}

/**
 * The driving time of one lap (pit stops and breakdowns not included): the base lap
 * plus or minus a few seconds, 30 % slower when the lap began under a yellow flag.
 */
export function drawLapDrivingTimeMs(
  seed: number,
  carIndex: number,
  lapNumber: number,
  baseLapTimeMs: number,
  isUnderYellowFlag: boolean,
): number {
  const draw = drawForCarAndLap(seed, carIndex, lapNumber, 'lapVariation');
  const variationMs = scaleDrawBetween(draw, -largestLapVariationMs, largestLapVariationMs);
  const greenFlagLapTimeMs = baseLapTimeMs + variationMs;
  const lapTimeMs = isUnderYellowFlag
    ? greenFlagLapTimeMs * yellowFlagLapTimeFactor
    : greenFlagLapTimeMs;
  return Math.round(lapTimeMs);
}
