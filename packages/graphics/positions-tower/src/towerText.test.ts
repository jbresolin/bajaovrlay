/**
 * The tower's cell texts (packages/graphics/positions-tower)
 *
 * What this module is for:
 *   The canonical entries carry numbers; the detailed tower shows words: a gap to the
 *   leader in seconds or in laps, an interval, lap times, counts. João's gate decision
 *   (PR #19): gaps are written WITHOUT the unit ("+19,0", "+1 volta") because the caps
 *   face would show an "S"; the styles set the row in caps, so "volta" reads VOLTA on air.
 *   A value the source does not know shows the empty mark "—", never a 0 or a blank. The
 *   cut-to-the-tenth rule is the shared one (`@bajaovrlay/shared/raceTimeText`).
 *
 * What these tests prove:
 *   - A gap in ms reads "+19,0" (19 087 ms, the tenth cut), a gap in laps reads
 *     "+1 volta" or "+2 voltas", and a car with neither (not the leader) reads "—".
 *   - The leader's gap and interval are blank: there is no gap to oneself, and the
 *     design pages draw the leader's cells empty, not with the mark.
 *   - An interval reads "+41,3"; a lap time reads "4:38,2" (278 293 ms); a count reads
 *     its number, 0 included; each reads "—" when missing.
 *
 * What these tests deliberately do not cover:
 *   - The cut rule's edge cases (an hour-long lap, a whole second); the shared
 *     raceTimeText tests cover them.
 */
import { describe, expect, it } from 'vitest';

import { writeCountText, writeGapText, writeIntervalText, writeLapTimeText } from './towerText.js';

describe('writeGapText', () => {
  const gapScenarios = [
    // A car on the leader's lap: seconds to the tenth, cut, with no unit.
    {
      name: 'writes 19 087 ms as "+19,0"',
      entry: { gapToLeaderMs: 19_087 },
      isLeader: false,
      expected: '+19,0',
    },
    // One lap down is singular.
    {
      name: 'writes one lap down as "+1 volta"',
      entry: { gapToLeaderLaps: 1 },
      isLeader: false,
      expected: '+1 volta',
    },
    // Several laps down is plural.
    {
      name: 'writes two laps down as "+2 voltas"',
      entry: { gapToLeaderLaps: 2 },
      isLeader: false,
      expected: '+2 voltas',
    },
    // A source that does not know the gap: the empty mark, never "+0,0".
    {
      name: 'writes the empty mark when the source gives no gap',
      entry: {},
      isLeader: false,
      expected: '—',
    },
    // The leader has no gap by rule: a blank cell, as the design draws it.
    { name: 'writes nothing for the leader', entry: {}, isLeader: true, expected: '' },
  ];

  it.each(gapScenarios)('$name', ({ entry, isLeader, expected }) => {
    // Arrange: the gap fields of this row.

    // Act: write the gap cell.
    const text = writeGapText(entry, isLeader);

    // Assert: what this row expects.
    expect(text, 'the gap must be written without a unit, or as the empty mark').toBe(expected);
  });
});

describe('writeIntervalText', () => {
  const intervalScenarios = [
    // The interval to the car ahead, in seconds to the tenth, cut.
    { name: 'writes 41 372 ms as "+41,3"', intervalMs: 41_372, isLeader: false, expected: '+41,3' },
    // A few milliseconds behind: "+0,0", not a blank.
    { name: 'writes 6 ms as "+0,0"', intervalMs: 6, isLeader: false, expected: '+0,0' },
    // Unknown: the empty mark.
    {
      name: 'writes the empty mark when missing',
      intervalMs: undefined,
      isLeader: false,
      expected: '—',
    },
    // The leader has no car ahead: a blank cell.
    { name: 'writes nothing for the leader', intervalMs: undefined, isLeader: true, expected: '' },
  ];

  it.each(intervalScenarios)('$name', ({ intervalMs, isLeader, expected }) => {
    // Arrange: the interval of this row.

    // Act: write the interval cell.
    const text = writeIntervalText(intervalMs, isLeader);

    // Assert: what this row expects.
    expect(text, 'the interval must be written like a gap').toBe(expected);
  });
});

describe('writeLapTimeText', () => {
  it('writes the sample leader’s lap, 278 293 ms, as "4:38,2"', () => {
    // Arrange: the leader's last lap in the enduro sample.
    const lastLapMs = 278_293;

    // Act: write the lap cell.
    const text = writeLapTimeText(lastLapMs);

    // Assert: minutes, seconds and the tenth, cut.
    expect(text, 'a lap time must read to the tenth, cut').toBe('4:38,2');
  });

  it('writes the empty mark for a car with no lap time yet', () => {
    // Arrange: a car that has not completed a lap.
    const lastLapMs = undefined;

    // Act: write the lap cell.
    const text = writeLapTimeText(lastLapMs);

    // Assert: the mark, never "0:00,0".
    expect(text, 'a missing lap time must show the empty mark').toBe('—');
  });
});

describe('writeCountText', () => {
  const countScenarios = [
    // A real count.
    { name: 'writes 3 pit stops as "3"', count: 3, expected: '3' },
    // Zero is a value the source knows: it is written, not replaced by the mark.
    { name: 'writes 0 as "0" when the source says so', count: 0, expected: '0' },
    // Unknown: the empty mark, never "0".
    {
      name: 'writes the empty mark when the source gives no count',
      count: undefined,
      expected: '—',
    },
  ];

  it.each(countScenarios)('$name', ({ count, expected }) => {
    // Arrange: the count of this row.

    // Act: write the count cell.
    const text = writeCountText(count);

    // Assert: what this row expects.
    expect(text, 'a count must be its number or the empty mark').toBe(expected);
  });
});
