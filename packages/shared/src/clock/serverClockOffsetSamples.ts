/**
 * The arithmetic of the renderer's view of the server's clock: which samples of the
 * offset ("server clock minus my clock", in milliseconds) are kept, and the one value
 * used from them. Pure, and it imports nothing: graphics bundle this folder.
 */

/** How many of the latest samples count. Five: enough for a median, quick to renew. */
export const offsetSampleLimit = 5;

/**
 * Returns the samples with the new one added at the end and, past five, the oldest
 * dropped from the front. The list given is not changed.
 */
export function keepLatestOffsetSamples(
  offsetSamplesSoFarMs: readonly number[],
  newOffsetSampleMs: number,
): number[] {
  const samplesWithTheNewOne = [...offsetSamplesSoFarMs, newOffsetSampleMs];
  const countOfSamplesToDrop = Math.max(samplesWithTheNewOne.length - offsetSampleLimit, 0);
  return samplesWithTheNewOne.slice(countOfSamplesToDrop);
}

/**
 * Returns the median of the samples, or undefined when there is none. The median and
 * not the average: one message held up on the network gives one sample far too small,
 * and the median leaves it out where an average would move the clock on air.
 * Deliberate: with an even number of samples (two or four, only while the first five are
 * arriving) the HIGHER of the two middle ones is returned, not their average. Network
 * delay only ever makes a sample smaller, so the higher one was delayed less; and the
 * result is always a sample that was really measured, a whole number of milliseconds.
 */
export function computeMedianOfOffsetSamples(
  offsetSamplesMs: readonly number[],
): number | undefined {
  if (offsetSamplesMs.length === 0) {
    return undefined;
  }
  const samplesFromLowestToHighest = [...offsetSamplesMs].sort(
    (firstSampleMs, secondSampleMs) => firstSampleMs - secondSampleMs,
  );
  // For 5 samples this is position 2 (the middle); for 4 it is position 2 as well, the
  // higher of the two middle ones; for 1 it is position 0.
  const middlePosition = Math.floor(samplesFromLowestToHighest.length / 2);
  return samplesFromLowestToHighest[middlePosition];
}
