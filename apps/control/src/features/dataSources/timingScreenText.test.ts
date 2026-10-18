/**
 * Lap times and gaps as the positions table writes them (apps/control)
 *
 * What this module is for:
 *   The "Fontes" page shows a source's positions as a table. Times arrive as whole
 *   milliseconds; the table writes a lap as m:ss.mmm ("4:38.293") and the gap to the
 *   leader either in seconds to the tenth with a decimal comma ("+12,3 s", same lap) or
 *   in laps ("+2 voltas", lapped), the way a timing screen at the track does. A gap is
 *   never shown to the millisecond: Baja's timing records line passes with limited
 *   accuracy, so the last two digits would be false precision. Lap times keep their
 *   milliseconds here because this page is a diagnostic screen.
 *
 * What these tests prove:
 *   - Lap times of an enduro (4–7 minutes), a sub-minute time and the padding of seconds
 *     and milliseconds.
 *   - The gap of the leader is empty, a gap in ms reads in seconds to the tenth, cut
 *     (never rounded up) as timing screens do, a gap in laps reads "+1 volta" or
 *     "+N voltas".
 *
 * What these tests deliberately do not cover:
 *   - The table itself: DataSourcesPageDetail.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import { formatGapToLeader, formatLapTime } from './timingScreenText';

const lapTimeScenarios = [
  // A typical enduro lap of the sample's leader.
  { name: 'writes a 4:38 lap with its milliseconds', lapTimeMs: 278_293, expected: '4:38.293' },
  // A slow lap under yellow: still minutes, no hour.
  { name: 'writes a 7-minute lap', lapTimeMs: 425_004, expected: '7:05.004' },
  // Under a minute the minutes read 0, and the milliseconds keep three digits.
  { name: 'pads seconds and milliseconds', lapTimeMs: 9_050, expected: '0:09.050' },
];

describe('formatLapTime', () => {
  it.each(lapTimeScenarios)('$name', ({ lapTimeMs, expected }) => {
    // Arrange: the lap time comes from the scenario row above.

    // Act: write it.
    const text = formatLapTime(lapTimeMs);

    // Assert: the text the row expects.
    expect(text, `${lapTimeMs} ms must read "${expected}"`).toBe(expected);
  });
});

const gapScenarios = [
  // The leader has no gap to anyone.
  { name: 'leaves the leader blank', gap: {}, expected: '' },
  // Second place, on the leader's lap, 12.345 s behind: the tenth only.
  { name: 'writes a gap in ms as tenths', gap: { gapToLeaderMs: 12_345 }, expected: '+12,3 s' },
  // 12.399 s would round to 12,4; a timing screen cuts it to 12,3 instead.
  { name: 'cuts the tenth, never rounds', gap: { gapToLeaderMs: 12_399 }, expected: '+12,3 s' },
  // Whole seconds still show their tenth, so every gap in the column reads alike.
  { name: 'keeps a zero tenth', gap: { gapToLeaderMs: 7_000 }, expected: '+7,0 s' },
  // Under a tenth behind (a photo finish) still reads as a gap, not as the leader.
  { name: 'writes a gap under a tenth', gap: { gapToLeaderMs: 42 }, expected: '+0,0 s' },
  // More than a minute behind on the same lap still reads in seconds.
  { name: 'keeps seconds past a minute', gap: { gapToLeaderMs: 75_049 }, expected: '+75,0 s' },
  // Lapped once: singular.
  { name: 'writes one lap in the singular', gap: { gapToLeaderLaps: 1 }, expected: '+1 volta' },
  // Lapped many times, like the retired car 96 of the sample, 22 laps down.
  { name: 'writes several laps', gap: { gapToLeaderLaps: 22 }, expected: '+22 voltas' },
];

describe('formatGapToLeader', () => {
  it.each(gapScenarios)('$name', ({ gap, expected }) => {
    // Arrange: the gap comes from the scenario row above.

    // Act: write it.
    const text = formatGapToLeader(gap);

    // Assert: the text the row expects.
    expect(text, `the gap ${JSON.stringify(gap)} must read "${expected}"`).toBe(expected);
  });
});
