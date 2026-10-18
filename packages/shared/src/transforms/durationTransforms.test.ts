/**
 * Durations into milliseconds (packages/shared)
 *
 * What this module is for:
 *   The canonical shapes hold every duration as whole milliseconds (`lastLapMs`,
 *   `gapToLeaderMs`). A timing system sends them as a number of seconds (278.293) or as
 *   lap-time text ("4:38.293"); secondsToMs and lapTimeTextToMs bring both into ms.
 *
 * What these tests prove:
 *   - secondsToMs rounds to the nearest millisecond, so floating point does not turn
 *     278.293 s into 278 292 ms, and refuses anything that is not a number.
 *   - lapTimeTextToMs reads seconds, minutes and hours, with a comma or a point before the
 *     fraction, and refuses text that is not a lap time, quoting it.
 *
 * What these tests deliberately do not cover:
 *   - Showing a duration on screen (gaps to the tenth, lap times); that is the control
 *     page's and the bindings' formatting.
 */
import { describe, expect, it } from 'vitest';

import { lapTimeTextToMsTransform, secondsToMsTransform } from './durationTransforms.js';
import type { TransformResult } from './transform.js';

type DurationTransformScenario = { name: string; value: unknown; expected: TransformResult };

describe('secondsToMs', () => {
  const secondsToMsScenarios: DurationTransformScenario[] = [
    // The brief's example: 278.293 × 1000 is 278 292.999… in floating point.
    {
      name: 'turns a 278.293 s lap into 278 293 ms, not 278 292',
      value: 278.293,
      expected: { ok: true, value: 278_293 },
    },
    // A gap of whole seconds.
    { name: 'turns 12 s into 12 000 ms', value: 12, expected: { ok: true, value: 12_000 } },
    // A fraction below the millisecond is rounded to the nearest one.
    {
      name: 'rounds 1.2345 s to the nearest ms, 1 235',
      value: 1.2345,
      expected: { ok: true, value: 1_235 },
    },
    // Lap-time text needs lapTimeTextToMs; saying so finds the wrong transform.
    {
      name: 'refuses the text "278.293", which needs lapTimeTextToMs',
      value: '278.293',
      expected: { ok: false, reason: '"278.293" não é um número' },
    },
  ];

  it.each(secondsToMsScenarios)('$name', ({ value, expected }) => {
    // Arrange: the number of seconds this row's source sent.

    // Act: run the transform on it.
    const result = secondsToMsTransform.apply(value, undefined);

    // Assert: whole milliseconds, or the refusal with its pt-BR reason.
    expect(result, 'secondsToMs must give whole ms or refuse as this row says').toEqual(expected);
  });
});

describe('lapTimeTextToMs', () => {
  const lapTimeTextScenarios: DurationTransformScenario[] = [
    // The common Baja lap: minutes, seconds and thousandths.
    {
      name: 'reads "4:38.293" as 278 293 ms',
      value: '4:38.293',
      expected: { ok: true, value: 278_293 },
    },
    // The same lap written with the pt-BR decimal comma.
    {
      name: 'reads "4:38,293" as 278 293 ms',
      value: '4:38,293',
      expected: { ok: true, value: 278_293 },
    },
    // Plain seconds as text, which many systems send instead of minutes.
    {
      name: 'reads "278.293" as 278 293 ms',
      value: '278.293',
      expected: { ok: true, value: 278_293 },
    },
    // Hours, for an enduro gap or a very slow lap; one fraction digit is tenths.
    {
      name: 'reads "1:02:03.4" as 3 723 400 ms',
      value: '1:02:03.4',
      expected: { ok: true, value: 3_723_400 },
    },
    // A lap written without a fraction.
    { name: 'reads "4:38" as 278 000 ms', value: '4:38', expected: { ok: true, value: 278_000 } },
    // A typo in the digits, the brief's example of an unreadable lap.
    {
      name: 'refuses "4:3x.293", quoting it',
      value: '4:3x.293',
      expected: {
        ok: false,
        reason: '"4:3x.293" não é um tempo de volta como 4:38.293, 278.293 ou 1:02:03.4',
      },
    },
    // Seconds of 60 or more after minutes would silently be the next minute.
    {
      name: 'refuses "4:75.000", whose seconds are past 59',
      value: '4:75.000',
      expected: {
        ok: false,
        reason: '"4:75.000" não é um tempo de volta como 4:38.293, 278.293 ou 1:02:03.4',
      },
    },
    // Four parts is no clock anyone writes.
    {
      name: 'refuses "1:02:03:04", which has too many parts',
      value: '1:02:03:04',
      expected: {
        ok: false,
        reason: '"1:02:03:04" não é um tempo de volta como 4:38.293, 278.293 ou 1:02:03.4',
      },
    },
    // A number of seconds needs secondsToMs.
    {
      name: 'refuses the number 278.293, which needs secondsToMs',
      value: 278.293,
      expected: { ok: false, reason: '278.293 não é um texto' },
    },
  ];

  it.each(lapTimeTextScenarios)('$name', ({ value, expected }) => {
    // Arrange: the lap-time text this row's source sent.

    // Act: run the transform on it.
    const result = lapTimeTextToMsTransform.apply(value, undefined);

    // Assert: the lap in whole ms, or the refusal with its pt-BR reason.
    expect(result, 'lapTimeTextToMs must read or refuse the text as this row says').toEqual(
      expected,
    );
  });
});
