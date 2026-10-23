/**
 * The enduro sample for the browser tests: the 60 cars of packages/shared's positions
 * sample (car 31 "Acauã Baja" leads; car 69 is in the pit at 17th, car 65 broken down at
 * 49th, car 96 retired at 60th), read from disk through the shared package's own export,
 * and the change the tests send most: two cars trading places.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

/** One car as the sample writes it; the tests only read and copy it. */
export type SampleEntry = Record<string, unknown> & { position: number; carNumber: number };

/** The sample's 60 entries, in position order. */
export function readEnduroSampleEntries(): SampleEntry[] {
  const resolveLikeNode = createRequire(import.meta.url);
  const samplePath = resolveLikeNode.resolve('@bajaovrlay/shared/samples/positions.json');
  const sample = JSON.parse(readFileSync(samplePath, 'utf8')) as { entries: SampleEntry[] };
  return sample.entries;
}

/**
 * Trades the places of the cars at two positions (from 1) and answers a new list with
 * the positions rewritten, as the timing system would send it after an overtake.
 */
export function swapCarsAtPositions(
  entries: readonly SampleEntry[],
  positionA: number,
  positionB: number,
): SampleEntry[] {
  const swapped = [...entries];
  const carA = swapped[positionA - 1];
  const carB = swapped[positionB - 1];
  if (carA === undefined || carB === undefined) {
    throw new Error('swapCarsAtPositions was given a position outside the list');
  }
  swapped[positionA - 1] = { ...carB, position: positionA };
  swapped[positionB - 1] = { ...carA, position: positionB };
  return swapped;
}
