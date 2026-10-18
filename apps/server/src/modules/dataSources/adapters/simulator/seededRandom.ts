// The one place the simulated enduro gets random numbers from. Every draw is a pure
// function of the race seed, who it is for (a car and a lap, or a race event) and what
// it is for, so lap 34 of car 12 is the same lap at every poll, after a restart and in
// every test, with no generator state kept between calls.

/**
 * What a draw is for. Each purpose has its own number, mixed into the draw's seed, so
 * the draw for a lap's time never equals the draw for the pit stop of the same lap.
 * A new purpose takes the next free number; changing a number changes every race.
 */
const purposeNumbers = {
  // Per car (lap 0) or per car and lap.
  baseLapTime: 1,
  lapVariation: 2,
  lapsUntilPitStop: 3,
  pitStopDuration: 4,
  breakdownChance: 5,
  breakdownMoment: 6,
  breakdownIsRetirement: 7,
  breakdownStopDuration: 8,
  accelerationPoints: 9,
  speedPoints: 10,
  tractionPoints: 11,
  suspensionPoints: 12,
  maneuverabilityPoints: 13,
  // Race-wide, per occurrence (the first yellow, the second...).
  yellowStart: 101,
  yellowDuration: 102,
  redFlagChance: 103,
  redFlagMoment: 104,
  redFlagDuration: 105,
} as const;

/** The name of one purpose a draw can be for. */
export type DrawPurpose = keyof typeof purposeNumbers;

/**
 * mulberry32, Tommy Ettinger's small 32-bit generator (public domain): a handful of
 * integer operations, fast, with output that passes the usual statistical batteries
 * well enough for a race simulation. Chosen because it is short enough to read here
 * and is the usual choice for seeded randomness in JavaScript; it is not for security.
 * Returns a function that gives the next number in [0, 1) each time it is called.
 */
export function createMulberry32Generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Mixes a list of integers into one 32-bit seed, with the FNV-1a steps applied to each
 * whole integer (offset basis 2166136261, prime 16777619). FNV alone mixes weakly, but
 * mulberry32's first output scrambles its seed thoroughly, so neighbouring inputs (lap
 * 34 and lap 35) still give unrelated draws. A seed beyond 32 bits is cut to its low 32.
 */
function mixIntegersIntoOneSeed(integers: number[]): number {
  let hash = 2_166_136_261;
  for (const integer of integers) {
    hash = Math.imul(hash ^ (integer | 0), 16_777_619);
  }
  return hash >>> 0;
}

/**
 * The draw in [0, 1) for one car (by its index in the field, from 0) and one lap (from
 * 1; lap 0 for a draw about the car itself, such as its base lap time), for one purpose.
 */
export function drawForCarAndLap(
  seed: number,
  carIndex: number,
  lapNumber: number,
  purpose: DrawPurpose,
): number {
  const drawSeed = mixIntegersIntoOneSeed([seed, purposeNumbers[purpose], carIndex, lapNumber]);
  return createMulberry32Generator(drawSeed)();
}

/**
 * The draw in [0, 1) for a race-wide event: the `occurrenceNumber`-th of its kind (the
 * second yellow is occurrence 2), for one purpose. Race-wide purposes have their own
 * numbers, so these draws never equal a car's.
 */
export function drawForRace(seed: number, occurrenceNumber: number, purpose: DrawPurpose): number {
  const drawSeed = mixIntegersIntoOneSeed([seed, purposeNumbers[purpose], occurrenceNumber]);
  return createMulberry32Generator(drawSeed)();
}

/** Turns a draw in [0, 1) into a value between `lowest` (draw 0) and `highest`. */
export function scaleDrawBetween(draw: number, lowest: number, highest: number): number {
  return lowest + draw * (highest - lowest);
}
