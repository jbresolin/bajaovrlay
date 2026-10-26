// The draw of the simulated Super Prime (BAJAOVRLAY-25): every car of the field, in an
// order drawn from the seed, paired into a first round padded with byes up to the next
// power of two. Pure: the same seed and field always draw the same pairs.
import { drawForCarAndLap } from './seededRandom.js';

/** One match of the first round, by the cars' indexes in the field (car 1 is index 0). */
export type FirstRoundPair = {
  carIndexA: number;
  /** Left out for a bye: the slot facing carA is empty. */
  carIndexB?: number;
};

/** The smallest power of two that holds every car: 16 for 10 cars, 64 for 33, 128 for 100. */
export function countSlotsOfDraw(carCount: number): number {
  let slotCount = 2;
  while (slotCount < carCount) {
    slotCount *= 2;
  }
  return slotCount;
}

/**
 * The first round: the cars sorted by a draw of their own (the car's index breaks a tie, so
 * the order is total), then paired the first against the last, the second against the one
 * before the last, and so on, the way a seeded draw sheet pairs 1 against 64. The slots past
 * the field are empty, so the first cars in the order meet nobody: those are the byes.
 */
export function drawFirstRoundOfSimulatedBracket(seed: number, carCount: number): FirstRoundPair[] {
  const carIndexes = Array.from({ length: carCount }, (_unused, carIndex) => carIndex);
  const drawOfCar = carIndexes.map((carIndex) =>
    drawForCarAndLap(seed, carIndex, 0, 'bracketDrawOrder'),
  );
  const carIndexesInDrawOrder = [...carIndexes].sort((first, second) => {
    const byDraw = (drawOfCar[first] ?? 0) - (drawOfCar[second] ?? 0);
    return byDraw !== 0 ? byDraw : first - second;
  });

  const slotCount = countSlotsOfDraw(carCount);
  const pairs: FirstRoundPair[] = [];
  for (let matchIndex = 0; matchIndex < slotCount / 2; matchIndex += 1) {
    const carIndexA = carIndexesInDrawOrder[matchIndex];
    if (carIndexA === undefined) {
      // Never: a slot count of at least the field holds at least half of it in its top half.
      throw new Error(`the draw has no car for match ${String(matchIndex + 1)}; a bug`);
    }
    const carIndexB = carIndexesInDrawOrder[slotCount - 1 - matchIndex];
    pairs.push(carIndexB === undefined ? { carIndexA } : { carIndexA, carIndexB });
  }
  return pairs;
}
