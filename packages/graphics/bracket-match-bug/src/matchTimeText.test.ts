/**
 * A car's time in a timed run, as the bug writes it (packages/graphics/bracket-match-bug)
 *
 * What this module is for:
 *   A timed Super Prime match carries each car's time in milliseconds. The bug writes it
 *   as the scoring sheet does: seconds with a comma and three decimals ("41,870"), and
 *   minutes before them past a minute ("1:03,215").
 *
 * What these tests prove:
 *   - One row per case: a usual run, a run over a minute, a whole second, a time under
 *     ten seconds, and the exact minute.
 *
 * What these tests deliberately do not cover:
 *   - Where the text sits: matchBugModel.test.ts and the screenshots.
 */
import { describe, expect, it } from 'vitest';

import { writeMatchTimeText } from './matchTimeText.js';

describe('writeMatchTimeText', () => {
  const timeScenarios = [
    // The usual Super Prime run, well under a minute.
    { name: 'writes 41.87 s as "41,870"', timeMs: 41_870, expected: '41,870' },
    // A slow run past the minute: minutes, then seconds padded to two digits.
    { name: 'writes 63.215 s as "1:03,215"', timeMs: 63_215, expected: '1:03,215' },
    // A whole second keeps its three decimals, as the sheet has them.
    { name: 'writes 45 s as "45,000"', timeMs: 45_000, expected: '45,000' },
    // Under ten seconds: no leading zero before the minute.
    { name: 'writes 9.5 s as "9,500"', timeMs: 9_500, expected: '9,500' },
    // The exact minute: "1:00,000", never "60,000".
    { name: 'writes 60 s as "1:00,000"', timeMs: 60_000, expected: '1:00,000' },
  ];

  it.each(timeScenarios)('$name', ({ timeMs, expected }) => {
    // Arrange: the time the source sent (above).

    // Act: write it.
    const text = writeMatchTimeText(timeMs);

    // Assert: as the scoring sheet writes it.
    expect(text, 'the time must read as the scoring sheet writes it').toBe(expected);
  });
});
