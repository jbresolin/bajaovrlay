/**
 * Race times written to the tenth, cut (packages/shared/src/raceTimeText)
 *
 * What this module is for:
 *   The canonical shapes keep durations in whole milliseconds; a graphic or a transform
 *   shows them as text the way Baja's timing screens do: to the tenth of a second, cut and
 *   never rounded (the gap rule of PR #17), with a decimal comma. Two pure functions do
 *   it: `writeSecondsToTheTenthCutAsText` writes seconds ("12,3", the body of a gap) and
 *   `writeLapTimeAsText` writes a lap ("4:38,2"). They carry no Zod, so the positions tower
 *   bundles them through `@bajaovrlay/shared/raceTimeText` without the rest of shared.
 *
 * What these tests prove:
 *   - Seconds: the tenth is cut (12 399 ms reads "12,3", not "12,4"), past a minute the
 *     text stays in seconds ("75,3"), and a few milliseconds read "0,0".
 *   - Lap times: the tenth is cut (278 299 ms reads "4:38,2"), a whole number of seconds
 *     keeps its zero tenth, a lap under a minute keeps its 0 minutes so it never reads as
 *     hours, and one past an hour shows the hour with two-digit minutes.
 *
 * What these tests deliberately do not cover:
 *   - Refusing text, negative or fractional input: the binding transforms
 *     (transforms/raceTimeTextTransforms.ts) guard their input and answer a pt-BR reason;
 *     these functions take a whole number of milliseconds from 0 up and nothing else.
 *   - The "+" sign, the " s" unit and the "volta(s)" word: the transforms and the tower
 *     compose them from their own catalogs.
 */
import { describe, expect, it } from 'vitest';

import { writeLapTimeAsText, writeSecondsToTheTenthCutAsText } from './raceTimeText.js';

describe('writeSecondsToTheTenthCutAsText', () => {
  const secondsScenarios = [
    // The gap rule's example: the tenth is cut, so 12 399 ms reads 12,3 and not 12,4.
    { name: 'writes 12 399 ms as "12,3", cutting the tenth', durationMs: 12_399, expected: '12,3' },
    // The sample's gap between the first two cars: 19 087 ms reads +19,0 on the tower.
    { name: 'writes 19 087 ms as "19,0"', durationMs: 19_087, expected: '19,0' },
    // Past a minute the text stays in seconds, as timing screens write a gap.
    { name: 'writes 75 300 ms as "75,3"', durationMs: 75_300, expected: '75,3' },
    // A few milliseconds are less than a tenth: 0,0 and not a blank.
    { name: 'writes 2 ms as "0,0"', durationMs: 2, expected: '0,0' },
  ];

  it.each(secondsScenarios)('$name', ({ durationMs, expected }) => {
    // Arrange: the duration of this row, in whole milliseconds.

    // Act: write it as seconds to the tenth.
    const text = writeSecondsToTheTenthCutAsText(durationMs);

    // Assert: the text this row expects, with a decimal comma.
    expect(text, 'the seconds must be written to the tenth, cut, with a comma').toBe(expected);
  });
});

describe('writeLapTimeAsText', () => {
  const lapTimeScenarios = [
    // The brief's row: the tenth is cut, so 278 299 ms is 4:38,2 and not 4:38,3.
    {
      name: 'writes 278 299 ms as "4:38,2", cutting the tenth',
      durationMs: 278_299,
      expected: '4:38,2',
    },
    // The sample leader's lap: 278 293 ms reads the same 4:38,2.
    { name: 'writes 278 293 ms as "4:38,2"', durationMs: 278_293, expected: '4:38,2' },
    // A whole number of seconds keeps its zero tenth.
    { name: 'writes 278 000 ms as "4:38,0"', durationMs: 278_000, expected: '4:38,0' },
    // A short lap (a test run) keeps its 0 minutes, so it never reads as hours.
    { name: 'writes 59 950 ms as "0:59,9"', durationMs: 59_950, expected: '0:59,9' },
    // A very long lap after a repair keeps the hour, with two-digit minutes.
    { name: 'writes 3 723 400 ms as "1:02:03,4"', durationMs: 3_723_400, expected: '1:02:03,4' },
  ];

  it.each(lapTimeScenarios)('$name', ({ durationMs, expected }) => {
    // Arrange: the lap time of this row, in whole milliseconds.

    // Act: write it as the timing screen does.
    const text = writeLapTimeAsText(durationMs);

    // Assert: minutes, two-digit seconds and the tenth, cut.
    expect(text, 'the lap time must be written as this row says').toBe(expected);
  });
});
