/**
 * The standings shape: score parts and disqualified teams (packages/shared)
 *
 * What this module is for:
 *   The real overall score of Baja SAE Brasil is not a sum of session kinds: the export
 *   names its own parts (PROJETO, DINÂM., ENDURO, 4X4, SEG., PEN.), a part may be unknown
 *   ("—"), and a disqualified team stays in the list with no place. The standings shape
 *   carries that as `scoreParts` (the parts, in display order, labelled as the source names
 *   them), `pointsByPart` on each team, and `isDisqualified` on a team. The standings
 *   graphic draws one column per part and the disqualified teams dimmed at the end.
 *
 * What these tests prove:
 *   - Standings whose teams' points name only listed parts pass, and a team may leave a
 *     part out (shown as "—").
 *   - A part a team names that the standings do not list is refused, in pt-BR, naming the
 *     part; with no parts listed at all, any part a team names is refused too.
 *   - A part listed twice is refused.
 *   - A disqualified team has no rank and comes after every ranked team; one with a rank,
 *     or one above a ranked team, is refused, and a team that is not disqualified must
 *     have a rank.
 *   - Tied teams share a rank, also at the top.
 *   - Standings with no team, with disqualified teams only, or with an empty list of parts
 *     pass.
 *   - Old payloads that carry `pointsByEvent` (the field this replaced) still pass, with
 *     the field dropped: old recordings must replay.
 *
 * What these tests deliberately do not cover:
 *   - The rules the shape had before (first rank 1, rank order, a team listed once);
 *     dataShapes.test.ts covers them.
 *   - Replaying a real recording file; the replay adapter's tests do that on the server.
 */
import { describe, expect, it } from 'vitest';

import { validateDataShape } from './validateDataShape.js';

/** The six parts of the real overall export, in its order, labelled as it names them. */
const overallScoreParts = [
  { partId: 'projeto', label: 'PROJETO' },
  { partId: 'dinamicas', label: 'DINÂM.' },
  { partId: 'enduro', label: 'ENDURO' },
  { partId: 'bonus4x4', label: '4X4' },
  { partId: 'seguranca', label: 'SEG.' },
  { partId: 'penalidade', label: 'PEN.' },
];

/** Baja UFMG, car 2, first overall at the 30ª Competição with 921,8 points. */
function buildBajaUfmgInFirst() {
  return {
    rank: 1,
    carNumber: 2,
    teamName: 'Baja UFMG',
    schoolName: 'UFMG',
    points: 921.8,
    pointsByPart: {
      projeto: 246.81,
      dinamicas: 227.49,
      enduro: 312.5,
      bonus4x4: 150,
      seguranca: -15,
      penalidade: 0,
    },
  };
}

/** Equipe FEI Baja, car 1, second with 903,48 points. */
function buildEquipeFeiInSecond() {
  return {
    rank: 2,
    carNumber: 1,
    teamName: 'Equipe FEI Baja',
    schoolName: 'FEI',
    points: 903.48,
    pointsByPart: {
      projeto: 235.55,
      dinamicas: 157.93,
      enduro: 375,
      bonus4x4: 150,
      seguranca: -15,
      penalidade: 0,
    },
  };
}

/** Caledônia Racing, car 30, disqualified: in the list, with no rank. */
function buildCaledoniaDisqualified() {
  return {
    carNumber: 30,
    teamName: 'Caledônia Racing Baja SAE',
    schoolName: 'UERJ',
    points: 0,
    pointsByPart: { projeto: 0, dinamicas: 0, enduro: 0, seguranca: -5, penalidade: 0 },
    isDisqualified: true,
  };
}

/** Overall standings of the 30ª Competição with the given teams and the six parts. */
function buildOverallStandings(entries: unknown[]) {
  return {
    scope: 'overall',
    updatedAtMs: 1_779_465_600_000,
    scoreParts: overallScoreParts,
    entries,
  };
}

const acceptedScenarios = [
  {
    // The everyday case: every team's parts are among the listed parts.
    name: 'accepts teams whose points name only the listed parts',
    payload: buildOverallStandings([buildBajaUfmgInFirst(), buildEquipeFeiInSecond()]),
  },
  {
    // Unicamp's export has a blank 4X4: the part is unknown, so it is left out ("—").
    name: 'accepts a team that leaves a part out',
    payload: buildOverallStandings([
      buildBajaUfmgInFirst(),
      { ...buildEquipeFeiInSecond(), pointsByPart: { projeto: 235.55, enduro: 375 } },
    ]),
  },
  {
    // The real export keeps disqualified teams at the bottom, with no place.
    name: 'accepts a disqualified team with no rank after every ranked team',
    payload: buildOverallStandings([
      buildBajaUfmgInFirst(),
      buildEquipeFeiInSecond(),
      buildCaledoniaDisqualified(),
    ]),
  },
  {
    // Two teams level on points share the first place; the next team is third.
    name: 'accepts two teams tied in first place',
    payload: buildOverallStandings([
      buildBajaUfmgInFirst(),
      { ...buildEquipeFeiInSecond(), rank: 1, points: 921.8 },
      {
        rank: 3,
        carNumber: 10,
        teamName: 'Equipe Komiketo Baja',
        schoolName: 'UFSJ',
        points: 891.59,
      },
    ]),
  },
  {
    // Before the first ranked result, every team listed may be disqualified.
    name: 'accepts standings whose only teams are disqualified',
    payload: buildOverallStandings([buildCaledoniaDisqualified()]),
  },
  {
    // A source that has no team yet (the morning before the first event).
    name: 'accepts standings with no teams at all',
    payload: buildOverallStandings([]),
  },
  {
    // A source that lists no parts sends an empty list rather than leaving it out.
    name: 'accepts an empty list of parts with no points by part',
    payload: {
      ...buildOverallStandings([{ ...buildBajaUfmgInFirst(), pointsByPart: undefined }]),
      scoreParts: [],
    },
  },
  {
    // A per-event table has no parts at all: just the total per team.
    name: 'accepts standings with no parts and no points by part',
    payload: {
      scope: 'enduro',
      updatedAtMs: 1_779_465_600_000,
      entries: [
        { rank: 1, carNumber: 1, teamName: 'Equipe FEI Baja', schoolName: 'FEI', points: 375 },
      ],
    },
  },
];

describe('standings with score parts and disqualified teams that pass', () => {
  it.each(acceptedScenarios)('$name', ({ payload }) => {
    // Arrange: the payload comes from the scenario row above.

    // Act: check it against the standings shape.
    const validation = validateDataShape('standings', payload);

    // Assert: it passes.
    expect(validation, 'these standings must pass the shape').toMatchObject({ isValid: true });
  });
});

const refusedScenarios = [
  {
    // A typo in a source's part name would draw a column of "—" and hide the points.
    name: 'refuses a team whose points name a part the standings do not list',
    payload: buildOverallStandings([
      { ...buildBajaUfmgInFirst(), pointsByPart: { projeto: 246.81, endurro: 312.5 } },
    ]),
    expectedErrorMessage:
      'Dados inválidos em "standings.entries.0.pointsByPart.endurro": a parte "endurro" não está entre as partes da pontuação.',
  },
  {
    // With no parts listed, a team's points by part have no column to go in.
    name: 'refuses points by part when the standings list no parts',
    payload: {
      ...buildOverallStandings([buildBajaUfmgInFirst()]),
      scoreParts: undefined,
    },
    expectedErrorMessage:
      'Dados inválidos em "standings.entries.0.pointsByPart.projeto": a parte "projeto" não está entre as partes da pontuação.',
  },
  {
    // A part listed twice would draw two columns with the same numbers.
    name: 'refuses a part listed twice',
    payload: {
      ...buildOverallStandings([buildBajaUfmgInFirst()]),
      scoreParts: [...overallScoreParts, { partId: 'enduro', label: 'ENDURO' }],
    },
    expectedErrorMessage:
      'Dados inválidos em "standings.scoreParts.6.partId": a parte "enduro" aparece mais de uma vez.',
  },
  {
    // A disqualified team has no place; a rank on it would be drawn as a place.
    name: 'refuses a disqualified team with a rank',
    payload: buildOverallStandings([
      buildBajaUfmgInFirst(),
      { ...buildCaledoniaDisqualified(), rank: 51 },
    ]),
    expectedErrorMessage:
      'Dados inválidos em "standings.entries.1.rank": uma equipe desclassificada não tem posição.',
  },
  {
    // The disqualified teams sit at the end; a ranked team below one is out of order.
    name: 'refuses a disqualified team above a ranked one',
    payload: buildOverallStandings([
      buildBajaUfmgInFirst(),
      buildCaledoniaDisqualified(),
      buildEquipeFeiInSecond(),
    ]),
    expectedErrorMessage:
      'Dados inválidos em "standings.entries.2.rank": as equipes desclassificadas vêm depois de todas as classificadas.',
  },
  {
    // A team that is not disqualified must have its place.
    name: 'refuses a team that is not disqualified and has no rank',
    payload: buildOverallStandings([{ ...buildBajaUfmgInFirst(), rank: undefined }]),
    expectedErrorMessage:
      'Dados inválidos em "standings.entries.0.rank": falta a posição de uma equipe que não foi desclassificada.',
  },
];

describe('standings with score parts and disqualified teams that are refused', () => {
  it.each(refusedScenarios)('$name', ({ payload, expectedErrorMessage }) => {
    // Arrange: the payload comes from the scenario row above.

    // Act: check it against the standings shape.
    const validation = validateDataShape('standings', payload);

    // Assert: refused, with the pt-BR reason naming the path.
    expect(validation, 'the operator must read why the standings were refused').toEqual({
      isValid: false,
      errorMessage: expectedErrorMessage,
    });
  });
});

describe('standings written before the score parts', () => {
  it('pass with pointsByEvent dropped, so an old recording replays', () => {
    // Arrange: a team as recordings before BAJAOVRLAY-24 wrote it, with points per event.
    const oldPayload = {
      scope: 'overall',
      updatedAtMs: 1_779_465_600_000,
      entries: [
        {
          rank: 1,
          carNumber: 45,
          teamName: 'Jandaia Racing',
          schoolName: 'UFC',
          points: 646.9,
          pointsByEvent: { enduro: 376.5, acceleration: 54.1 },
        },
      ],
    };

    // Act: check it against today's shape.
    const validation = validateDataShape('standings', oldPayload);

    // Assert: it passes, and the old field is not carried on.
    expect(validation.isValid, 'old standings must still pass').toBe(true);
    const firstEntry = validation.isValid
      ? (validation.shape as { entries: Record<string, unknown>[] }).entries[0]
      : undefined;
    expect(firstEntry, 'the old pointsByEvent must be dropped, never refused').not.toHaveProperty(
      'pointsByEvent',
    );
  });
});
