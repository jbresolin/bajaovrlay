/**
 * Notice data model (packages/graphics/notice)
 *
 * What this module is for:
 *   Everything the notice shows comes from one small data object: the variant (a fastest
 *   lap or a notice from race control) and, optionally, the car (a general notice has
 *   none, BAJAOVRLAY-67), the team, the school,
 *   the lap and its time, the kind of notice, the reason and the penalty. The renderer
 *   sends the whole object to `load` and then partial changes to `updateAction`. This
 *   module checks that data, merges the partial changes in, and explains in pt-BR what
 *   is wrong when the data is bad, so the graphic can answer 400 instead of throwing.
 *
 * What these tests prove:
 *   - Complete, correct data of either variant is accepted as it is, and so is the bare
 *     minimum: a variant and a car number, or a general notice with no car at all.
 *   - Data missing a required field, with a wrong value, or with a field the graphic does
 *     not know is refused with a pt-BR message naming the field.
 *   - A partial update changes only the fields it carries and keeps every other field.
 *   - A bad partial update is refused and leaves nothing half-applied.
 *   - A notice without a kind reads as a penalty.
 *
 * What these tests deliberately do not cover:
 *   - That the manifest's JSON Schema agrees with these rules;
 *     noticeManifestDataAgreement.test.ts runs the same payloads through both.
 *   - What the component answers on the wire (status codes); notice.test.ts does.
 */
import { describe, expect, it } from 'vitest';

import {
  mergePartialUpdateIntoNoticeData,
  type NoticeData,
  parseCompleteNoticeData,
  readNoticeKind,
} from './noticeModel.js';

/** Builds the data of a fastest lap: car 31, Acauã Baja (Mauá), 4:38,2 on lap 34. */
function createFastestLapData(): NoticeData {
  return {
    variant: 'fastestLap',
    carNumber: 31,
    teamName: 'Acauã Baja',
    schoolName: 'Mauá',
    lapNumber: 34,
    lapTimeText: '4:38,2',
  };
}

/** Builds the data of a penalty: car 47, Carnaúba Baja (UFERSA), +30 seconds for a jump start. */
function createJumpStartPenaltyData(): NoticeData {
  return {
    variant: 'penalty',
    carNumber: 47,
    teamName: 'Carnaúba Baja',
    schoolName: 'UFERSA',
    noticeKind: 'penalty',
    reason: 'Queima de largada',
    penaltyText: '+30 segundos',
  };
}

describe('parseCompleteNoticeData', () => {
  const acceptedDataScenarios = [
    // The everyday fastest lap, every field filled.
    { name: 'accepts a complete fastest lap unchanged', data: createFastestLapData() },
    // The everyday penalty, every field filled.
    { name: 'accepts a complete penalty unchanged', data: createJumpStartPenaltyData() },
    // An event that knows only the car: the card must still be possible.
    {
      name: 'accepts the bare minimum: a variant and a car number',
      data: { variant: 'penalty', carNumber: 47 },
    },
    // A general notice (BAJAOVRLAY-67) is about the event itself: it has no car.
    {
      name: 'accepts a general notice with no car',
      data: { variant: 'penalty', noticeKind: 'notice', reason: 'Largada adiada em 15 minutos' },
    },
  ];

  it.each(acceptedDataScenarios)('$name', ({ data }) => {
    // Arrange: the data comes from the scenario row above.

    // Act: check it as `load` does.
    const result = parseCompleteNoticeData(data);

    // Assert: it is valid and comes back exactly as sent.
    expect(result, 'correct data must be accepted exactly as sent').toEqual({
      isValid: true,
      data,
    });
  });

  const refusedDataScenarios = [
    {
      // Without a variant the graphic cannot know which head to draw.
      name: 'refuses data missing the variant',
      data: { ...createFastestLapData(), variant: undefined },
      expectedProblem: 'Falta o campo obrigatório "variant".',
    },
    {
      // A variant the graphic does not draw.
      name: 'refuses a variant the graphic does not know',
      data: { ...createFastestLapData(), variant: 'bandeira' },
      expectedProblem: 'Valor inválido no campo "variant".',
    },
    {
      // Car numbers start at 1; a 0 means an empty number field upstream.
      name: 'refuses car number 0',
      data: { ...createJumpStartPenaltyData(), carNumber: 0 },
      expectedProblem: 'Valor inválido no campo "carNumber".',
    },
    {
      // Laps are counted from 1.
      name: 'refuses lap number 0',
      data: { ...createFastestLapData(), lapNumber: 0 },
      expectedProblem: 'Valor inválido no campo "lapNumber".',
    },
    {
      // A kind of notice that is not one of the four race control sends.
      name: 'refuses a notice kind the graphic does not know',
      data: { ...createJumpStartPenaltyData(), noticeKind: 'blackFlag' },
      expectedProblem: 'Valor inválido no campo "noticeKind".',
    },
    {
      // A typo in a field name would otherwise be silently ignored.
      name: 'refuses a field the graphic does not know, such as a typo',
      data: { ...createJumpStartPenaltyData(), penalty: '+30 segundos' },
      expectedProblem: 'Campo desconhecido nos dados: "penalty".',
    },
    {
      // Something that is not an object at all, such as an empty load.
      name: 'refuses something that is not a data object',
      data: 'Queima de largada',
      expectedProblem: 'Dados inválidos: era esperado um objeto com os dados do aviso.',
    },
  ];

  it.each(refusedDataScenarios)('$name', ({ data, expectedProblem }) => {
    // Arrange: the bad data comes from the scenario row above.

    // Act: check it as `load` does.
    const result = parseCompleteNoticeData(data);

    // Assert: it is refused with a pt-BR message that names the problem.
    expect(result, 'bad data must be refused with a pt-BR message naming the field').toEqual({
      isValid: false,
      problem: expectedProblem,
    });
  });
});

describe('mergePartialUpdateIntoNoticeData', () => {
  it('changes only the fields the update carries and keeps the rest', () => {
    // Arrange: a fastest lap on air; car 31 improves its time on lap 36.
    const currentData = createFastestLapData();
    const betterLapUpdate = { lapNumber: 36, lapTimeText: '4:36,9' };

    // Act: merge the update into the current data.
    const result = mergePartialUpdateIntoNoticeData(currentData, betterLapUpdate);

    // Assert: only the lap and the time changed; the car and the team are untouched.
    expect(result, 'a partial update must change only the fields it carries').toEqual({
      isValid: true,
      data: { ...createFastestLapData(), lapNumber: 36, lapTimeText: '4:36,9' },
    });
  });

  it('refuses a bad update and leaves the current data untouched', () => {
    // Arrange: an update with a good reason and a misspelled kind, so a merge that
    // applied fields one by one would leave a half-update.
    const currentData = createJumpStartPenaltyData();
    const misspelledUpdate = { reason: 'Conduta antidesportiva', noticeKind: 'penalidade' };

    // Act: try to merge it.
    const result = mergePartialUpdateIntoNoticeData(currentData, misspelledUpdate);

    // Assert: refused with a pt-BR message; the current data was not changed.
    expect(result, 'a bad update must be refused with a pt-BR message').toEqual({
      isValid: false,
      problem: 'Valor inválido no campo "noticeKind".',
    });
    expect(currentData, 'a refused update must not apply even its good fields').toEqual(
      createJumpStartPenaltyData(),
    );
  });

  it('refuses an update carrying a field the graphic does not know', () => {
    // Arrange: an update with a field from the race clock.
    const currentData = createFastestLapData();
    const updateForAnotherGraphic = { sessionName: 'Enduro de Resistência' };

    // Act: try to merge it.
    const result = mergePartialUpdateIntoNoticeData(currentData, updateForAnotherGraphic);

    // Assert: refused, naming the unknown field.
    expect(result, 'an unknown field must be refused, not ignored').toEqual({
      isValid: false,
      problem: 'Campo desconhecido nos dados: "sessionName".',
    });
  });
});

describe('readNoticeKind', () => {
  const noticeKindScenarios = [
    // Race control sent the kind: it is used as sent.
    { name: 'reads an incident as an incident', noticeKind: 'incident', expected: 'incident' },
    // An item typed before the field existed, or an event that sends no kind.
    { name: 'reads a missing kind as a penalty', noticeKind: undefined, expected: 'penalty' },
  ] as const;

  it.each(noticeKindScenarios)('$name', ({ noticeKind, expected }) => {
    // Arrange: the penalty data with the kind as the scenario says.
    const penaltyData = { ...createJumpStartPenaltyData(), noticeKind };

    // Act: read the kind the head shows.
    const kind = readNoticeKind(penaltyData);

    // Assert: a missing kind is a penalty; a given kind is itself.
    expect(kind, 'a missing kind must read as a penalty').toBe(expected);
  });
});
