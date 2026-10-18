/**
 * Moments into milliseconds since 1970 (packages/shared)
 *
 * What this module is for:
 *   The canonical shapes hold moments (`updatedAtMs`, `clock.referenceWallClockMs`) as
 *   milliseconds since 1970. A source sends them as ISO 8601 text or as Unix seconds;
 *   isoDateTextToMs and unixSecondsToMs bring both into ms.
 *
 * What these tests prove:
 *   - isoDateTextToMs reads a moment with a zone (Z or an offset like -03:00) and its
 *     fraction, and refuses a moment with no zone, since guessing the zone is how a clock
 *     ends up three hours off; it also refuses a date that does not exist.
 *   - unixSecondsToMs turns seconds into ms and refuses text.
 *
 * What these tests deliberately do not cover:
 *   - The server's own clock: neither transform reads it. A source that sends no moment
 *     uses the mapping's fromPollMoment instead.
 */
import { describe, expect, it } from 'vitest';

import { isoDateTextToMsTransform, unixSecondsToMsTransform } from './momentTransforms.js';
import type { TransformResult } from './transform.js';

type MomentTransformScenario = { name: string; value: unknown; expected: TransformResult };

/** 14 August 2027, 17:30:00 UTC (14:30 in Brasília), in ms since 1970. */
const enduroStartAtMs = Date.UTC(2027, 7, 14, 17, 30, 0);

describe('isoDateTextToMs', () => {
  const isoMomentScenarios: MomentTransformScenario[] = [
    // A Brazilian source writing Brasília time with its offset.
    {
      name: 'reads 14:30 at -03:00 as 17:30 UTC',
      value: '2027-08-14T14:30:00-03:00',
      expected: { ok: true, value: enduroStartAtMs },
    },
    // The same moment written in UTC with a Z.
    {
      name: 'reads the same moment written with Z',
      value: '2027-08-14T17:30:00Z',
      expected: { ok: true, value: enduroStartAtMs },
    },
    // A fraction of a second is kept to the millisecond.
    {
      name: 'keeps the milliseconds of "…00.250-03:00"',
      value: '2027-08-14T14:30:00.250-03:00',
      expected: { ok: true, value: enduroStartAtMs + 250 },
    },
    // No zone: read in the server's zone, a UTC server would put this three hours off.
    {
      name: 'refuses a moment with no zone instead of guessing it',
      value: '2027-08-14T14:30:00',
      expected: {
        ok: false,
        reason:
          '"2027-08-14T14:30:00" não tem fuso horário; sem ele o horário pode sair horas errado (escreva como 2027-08-14T14:30:00-03:00 ou 2027-08-14T17:30:00Z)',
      },
    },
    // JavaScript's Date would quietly make this March 2nd.
    {
      name: 'refuses 30 February, which does not exist',
      value: '2027-02-30T14:30:00-03:00',
      expected: { ok: false, reason: '"2027-02-30T14:30:00-03:00" não existe no calendário' },
    },
    // A Brazilian date with slashes is no ISO moment.
    {
      name: 'refuses "14/08/2027 14:30", which is not ISO 8601',
      value: '14/08/2027 14:30',
      expected: {
        ok: false,
        reason: '"14/08/2027 14:30" não é uma data e hora ISO 8601 como 2027-08-14T14:30:00-03:00',
      },
    },
    // Unix seconds need unixSecondsToMs.
    {
      name: 'refuses a number, which needs unixSecondsToMs',
      value: 1818264600,
      expected: { ok: false, reason: '1818264600 não é um texto' },
    },
  ];

  it.each(isoMomentScenarios)('$name', ({ value, expected }) => {
    // Arrange: the moment this row's source sent.

    // Act: run the transform on it.
    const result = isoDateTextToMsTransform.apply(value, undefined);

    // Assert: ms since 1970, or the refusal with its pt-BR reason.
    expect(result, 'isoDateTextToMs must read or refuse the moment as this row says').toEqual(
      expected,
    );
  });
});

describe('unixSecondsToMs', () => {
  const unixSecondsScenarios: MomentTransformScenario[] = [
    // The common case: whole seconds since 1970.
    {
      name: 'turns 1818264600 s into the start of the enduro in ms',
      value: 1_818_264_600,
      expected: { ok: true, value: enduroStartAtMs },
    },
    // Some systems send a fraction; it is kept to the ms.
    {
      name: 'keeps the half second of 1818264600.5',
      value: 1_818_264_600.5,
      expected: { ok: true, value: enduroStartAtMs + 500 },
    },
    // Text is refused rather than read, so a source that changed format is noticed.
    {
      name: 'refuses the text "1818264600"',
      value: '1818264600',
      expected: { ok: false, reason: '"1818264600" não é um número' },
    },
  ];

  it.each(unixSecondsScenarios)('$name', ({ value, expected }) => {
    // Arrange: the Unix seconds this row's source sent.

    // Act: run the transform on it.
    const result = unixSecondsToMsTransform.apply(value, undefined);

    // Assert: ms since 1970, or the refusal with its pt-BR reason.
    expect(result, 'unixSecondsToMs must convert or refuse as this row says').toEqual(expected);
  });
});
