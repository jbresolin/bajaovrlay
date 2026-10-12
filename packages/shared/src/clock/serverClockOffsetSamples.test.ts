/**
 * The samples of the server's clock a renderer keeps (packages/shared)
 *
 * What this module is for:
 *   The server stamps a race clock's reading with ITS wall clock, and the graphic works
 *   out the time on air with the clock of the machine OBS runs on. Each message from the
 *   server says what time the server's clock showed; the renderer subtracts its own clock
 *   and gets one sample of the difference ("the offset"). It keeps the last five and uses
 *   their median, so one message that was stuck on the network cannot move the clock on air.
 *
 * What these tests prove:
 *   - With one sample the offset is that sample; with five it is the middle one.
 *   - A sixth sample pushes the oldest out.
 *   - One sample far from the others (a slow message) does not change the offset.
 *   - An even number of samples gives the higher of the two middle ones.
 *   - Negative offsets (the renderer's clock ahead of the server's) work the same way.
 *   - With no sample at all there is no offset.
 *
 * What these tests deliberately do not cover:
 *   - Where the samples are kept between messages and how the time is read back;
 *     serverAlignedTime.test.ts.
 *   - Taking a sample from a real message; apps/renderer's serverConnection tests.
 */
import { describe, expect, it } from 'vitest';

import {
  computeMedianOfOffsetSamples,
  keepLatestOffsetSamples,
} from './serverClockOffsetSamples.js';

const offsetScenarios: Array<{
  name: string;
  offsetsInArrivalOrderMs: number[];
  expectedSamplesKeptMs: number[];
  expectedOffsetMs: number;
}> = [
  // The first message after the page loads: one sample is all there is, so it is used.
  {
    name: 'uses the only sample when there is one',
    offsetsInArrivalOrderMs: [2_300],
    expectedSamplesKeptMs: [2_300],
    expectedOffsetMs: 2_300,
  },
  // The normal state: five samples a few milliseconds apart, the middle one wins.
  {
    name: 'uses the middle one of five samples',
    offsetsInArrivalOrderMs: [2_300, 2_296, 2_298, 2_291, 2_299],
    expectedSamplesKeptMs: [2_300, 2_296, 2_298, 2_291, 2_299],
    expectedOffsetMs: 2_298,
  },
  // Only the last five count: the first sample (taken before the renderer's clock was
  // corrected, 200 ms away from the rest) leaves when the sixth arrives.
  {
    name: 'lets a sixth sample push the oldest one out',
    offsetsInArrivalOrderMs: [2_100, 2_300, 2_296, 2_298, 2_291, 2_299],
    expectedSamplesKeptMs: [2_300, 2_296, 2_298, 2_291, 2_299],
    expectedOffsetMs: 2_298,
  },
  // One message was stuck on the Wi-Fi for 850 ms, so its sample is 850 ms too small.
  // The median ignores it; an average would have moved the clock on air by 170 ms.
  {
    name: 'ignores one sample far from the others',
    offsetsInArrivalOrderMs: [2_300, 2_296, 1_450, 2_298, 2_299],
    expectedSamplesKeptMs: [2_300, 2_296, 1_450, 2_298, 2_299],
    expectedOffsetMs: 2_298,
  },
  // Two samples have no middle one. The higher is chosen: network delay only ever makes
  // a sample smaller, so the higher of the two is the one that was delayed less.
  {
    name: 'uses the higher of two samples',
    offsetsInArrivalOrderMs: [2_290, 2_300],
    expectedSamplesKeptMs: [2_290, 2_300],
    expectedOffsetMs: 2_300,
  },
  // The same rule with four: the two middle ones are 2 296 and 2 298.
  {
    name: 'uses the higher of the two middle samples when there are four',
    offsetsInArrivalOrderMs: [2_300, 2_296, 2_298, 2_291],
    expectedSamplesKeptMs: [2_300, 2_296, 2_298, 2_291],
    expectedOffsetMs: 2_298,
  },
  // An OBS machine whose clock runs a second and a half AHEAD of the server's.
  {
    name: 'works with negative offsets, when the renderer clock is ahead',
    offsetsInArrivalOrderMs: [-1_500, -1_504, -1_498],
    expectedSamplesKeptMs: [-1_500, -1_504, -1_498],
    expectedOffsetMs: -1_500,
  },
];

describe('the offset between the server clock and the renderer clock', () => {
  it.each(offsetScenarios)(
    '$name',
    ({ offsetsInArrivalOrderMs, expectedSamplesKeptMs, expectedOffsetMs }) => {
      // Arrange: no sample yet, as on a page that has just loaded.
      let samplesKeptMs: number[] = [];

      // Act: the samples of this scenario arrive one by one, then the median is asked for.
      for (const offsetMs of offsetsInArrivalOrderMs) {
        samplesKeptMs = keepLatestOffsetSamples(samplesKeptMs, offsetMs);
      }
      const medianOffsetMs = computeMedianOfOffsetSamples(samplesKeptMs);

      // Assert: the samples kept are the last five at most, in arrival order, and the
      // offset is the one the scenario expects.
      expect(samplesKeptMs, 'only the last five samples are kept, oldest first').toEqual(
        expectedSamplesKeptMs,
      );
      expect(medianOffsetMs, 'the offset must be the median of the samples kept').toBe(
        expectedOffsetMs,
      );
    },
  );

  it('has no offset when no sample was ever taken', () => {
    // Arrange: a page that has not heard from the server yet.
    const noSamples: number[] = [];

    // Act: ask for the median.
    const medianOffsetMs = computeMedianOfOffsetSamples(noSamples);

    // Assert: there is none, so the caller knows to use its own clock as it is.
    expect(medianOffsetMs, 'no sample means no offset, not an offset of zero').toBeUndefined();
  });

  it('does not change the list it was given', () => {
    // Arrange: three samples, frozen so that changing the list in place would throw.
    const samplesBefore: readonly number[] = Object.freeze([2_300, 2_296, 2_298]);

    // Act: add a fourth sample and ask for the median of the frozen list.
    const samplesAfter = keepLatestOffsetSamples(samplesBefore, 2_291);
    const medianOfTheFrozenList = computeMedianOfOffsetSamples(samplesBefore);

    // Assert: a new list came back, and sorting for the median left the order alone.
    expect(samplesAfter, 'the new sample must be added at the end').toEqual([
      2_300, 2_296, 2_298, 2_291,
    ]);
    expect(medianOfTheFrozenList, 'the median of three samples is the middle one').toBe(2_298);
  });
});
