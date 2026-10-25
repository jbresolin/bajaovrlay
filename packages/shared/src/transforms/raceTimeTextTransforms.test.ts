/**
 * Lap times and gaps written for the screen (packages/shared)
 *
 * What this module is for:
 *   The canonical shapes keep durations in whole ms; a graphic shows them as text. Two
 *   binding transforms write them the way Baja's timing screens do (gap rule of PR #17):
 *   to the tenth of a second, cut and never rounded, with a decimal comma, because the
 *   timing records line passes with limited accuracy. formatLapTimeAsText writes a lap
 *   ("4:38,2"); formatGapAsText writes a gap to the leader, in seconds ("+12,3 s") or in
 *   laps ("+2 voltas"), as its `unit` parameter says.
 *
 * What these tests prove:
 *   - Lap times: the tenth is cut (278 299 ms reads "4:38,2", not "4:38,3"), a lap under a
 *     minute keeps its 0 minutes, and one past an hour shows the hour.
 *   - Gaps: the same number reads as seconds or as laps by `unit` (laps against ms), past
 *     a minute a gap stays in seconds, and a single lap reads "volta".
 *   - Anything but a whole number from 0 up is refused, quoting it; `unit` must be ms or
 *     laps.
 *
 * What these tests deliberately do not cover:
 *   - Which gap a car carries; the positions shape's gap rule decides that.
 */
import { describe, expect, it } from 'vitest';

import { checkTransformParameters } from './checkTransformParameters.js';
import {
  formatGapAsTextTransform,
  formatLapTimeAsTextTransform,
} from './raceTimeTextTransforms.js';
import type { TransformResult } from './transform.js';

// The context every binding transform is handed since BAJAOVRLAY-47; this one ignores it.
const contextWithNoTeams = { teams: [] };

type RaceTimeScenario = { name: string; value: unknown; expected: TransformResult };

describe('formatLapTimeAsText', () => {
  const lapTimeScenarios: RaceTimeScenario[] = [
    // The brief's row: the tenth is cut, so 278 299 ms is 4:38,2 and not 4:38,3.
    {
      name: 'writes 278 299 ms as "4:38,2", cutting the tenth',
      value: 278_299,
      expected: { ok: true, value: '4:38,2' },
    },
    // A whole number of seconds keeps its zero tenth.
    {
      name: 'writes 278 000 ms as "4:38,0"',
      value: 278_000,
      expected: { ok: true, value: '4:38,0' },
    },
    // A short lap (a test run) keeps its 0 minutes, so it never reads as hours.
    {
      name: 'writes 59 950 ms as "0:59,9"',
      value: 59_950,
      expected: { ok: true, value: '0:59,9' },
    },
    // A very long lap after a repair keeps the hour.
    {
      name: 'writes 3 723 400 ms as "1:02:03,4"',
      value: 3_723_400,
      expected: { ok: true, value: '1:02:03,4' },
    },
    // Lap-time text needs a mapping transform first; saying so finds the wrong field.
    {
      name: 'refuses the text "4:38.293", quoting it',
      value: '4:38.293',
      expected: { ok: false, reason: '"4:38.293" não é uma duração em milissegundos inteiros' },
    },
    // A negative duration is not a lap.
    {
      name: 'refuses -1 ms, quoting it',
      value: -1,
      expected: { ok: false, reason: '-1 não é uma duração em milissegundos inteiros' },
    },
  ];

  it.each(lapTimeScenarios)('$name', ({ value, expected }) => {
    // Arrange: the lap time of this row.

    // Act: write it for the screen.
    const result = formatLapTimeAsTextTransform.apply(value, undefined, contextWithNoTeams);

    // Assert: the text, or the refusal with its pt-BR reason.
    expect(result, 'the lap time must be written as this row says').toEqual(expected);
  });
});

describe('formatGapAsText', () => {
  const gapScenarios: Array<RaceTimeScenario & { unit: string }> = [
    // A car on the leader's lap: seconds to the tenth, cut.
    {
      name: 'writes 12 399 ms as "+12,3 s"',
      unit: 'ms',
      value: 12_399,
      expected: { ok: true, value: '+12,3 s' },
    },
    // Past a minute the gap stays in seconds, as timing screens write it.
    {
      name: 'writes 75 300 ms as "+75,3 s"',
      unit: 'ms',
      value: 75_300,
      expected: { ok: true, value: '+75,3 s' },
    },
    // Laps against ms: the same 2 is two laps when the binding reads gapToLeaderLaps…
    {
      name: 'writes 2 laps as "+2 voltas"',
      unit: 'laps',
      value: 2,
      expected: { ok: true, value: '+2 voltas' },
    },
    // …and two milliseconds when it reads gapToLeaderMs.
    {
      name: 'writes 2 ms as "+0,0 s"',
      unit: 'ms',
      value: 2,
      expected: { ok: true, value: '+0,0 s' },
    },
    // One lap is singular.
    {
      name: 'writes 1 lap as "+1 volta"',
      unit: 'laps',
      value: 1,
      expected: { ok: true, value: '+1 volta' },
    },
    // A gap written as text by the source needs a mapping transform first.
    {
      name: 'refuses the text "12.3", quoting it',
      unit: 'ms',
      value: '12.3',
      expected: { ok: false, reason: '"12.3" não é um número inteiro de 0 para cima' },
    },
  ];

  it.each(gapScenarios)('$name', ({ unit, value, expected }) => {
    // Arrange: the gap and unit of this row.

    // Act: write it for the screen.
    const result = formatGapAsTextTransform.apply(value, { unit }, contextWithNoTeams);

    // Assert: the text, or the refusal with its pt-BR reason.
    expect(result, 'the gap must be written as this row says').toEqual(expected);
  });

  it('checks the unit when the item is saved: ms or laps', () => {
    // Arrange: a unit typed in English instead of the two the transform knows.
    const parameters = { unit: 'seconds' };

    // Act: check it as an item save does.
    const check = checkTransformParameters('formatGapAsText', parameters, 'binding');

    // Assert: refused, naming what is accepted.
    expect(check, 'the unit must be ms or laps').toEqual({
      ok: false,
      reason: 'A unidade da diferença deve ser "ms" (tempo) ou "laps" (voltas).',
    });
  });
});
