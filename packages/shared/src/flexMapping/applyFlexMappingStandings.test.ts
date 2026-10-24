/**
 * Mapping an overall classification with its score parts into the standings shape
 * (packages/shared)
 *
 * What this module is for:
 *   The real overall score has parts the source names itself (PROJETO, DINÂM., ENDURO,
 *   4X4, SEG., PEN.) and keeps disqualified teams in the list (BAJAOVRLAY-24). A flex
 *   source sends each team's parts as a list, each part a `label` and a `value`; the
 *   mapping turns that list into the team's `pointsByPart` (keyed by the label) and builds
 *   the standings' `scoreParts` from every label it met, a part with no value included, in
 *   the order it met them. The disqualified flag is an ordinary field, read with mapValues
 *   from the source's word; a disqualified team's rank is dropped, since the real export
 *   still writes one ("51º") and the shape refuses a rank on a disqualified team.
 *
 * What these tests prove:
 *   - A classification of three teams (one disqualified as the real export writes it, "51º"
 *     and "Desclassificada"; one with an unknown part) maps into standings that pass
 *     validateDataShape: the parts in the source's order, each team's points by part, the
 *     unknown part left out, the disqualified team unranked.
 *   - A part whose value is unknown for the first team, or for every team, keeps its
 *     column, in the source's order: a column must not vanish or move because a cell is
 *     blank.
 *   - A rank the mapping cannot read on a disqualified team is no problem, since the rank
 *     is dropped anyway.
 *   - A team whose parts are not a list fails the mapping, naming the team's car and line.
 *   - A part without a text label or with a value that is not a number fails the mapping,
 *     naming the part's place in the list.
 *
 * What these tests deliberately do not cover:
 *   - The general rules of a mapping (missing paths, problem lists, list order);
 *     applyFlexMapping.test.ts covers them with the positions.
 *   - Which fields may be mapped; mappableFields.test.ts lists them.
 */
import { describe, expect, it } from 'vitest';

import { validateDataShape } from '../dataShapes/validateDataShape.js';
import { applyFlexMapping } from './applyFlexMapping.js';
import { type FlexMappingConfig, FlexMappingConfigSchema } from './flexMappingConfig.js';

/** The moment of the poll in these tests: 14:00 in Brasília on the competition's last day. */
const pollMomentMs = Date.UTC(2026, 2, 8, 17, 0, 0);

/** The parts of one team as the source lists them, each a label and a value. */
function buildPartsList(points: Array<[string, number | null]>) {
  return points.map(([label, value]) => ({ label, value }));
}

/**
 * What an imaginary results endpoint answers: the overall classification of the 30ª
 * Competição, with its own keys, each team's parts as a list, and the situation in words.
 */
function buildClassificationResponse() {
  return {
    classificacao: [
      {
        colocacao: 1,
        numero: 2,
        equipe: 'Baja UFMG',
        escola: 'UFMG',
        total: 921.8,
        situacao: '',
        partes: buildPartsList([
          ['PROJETO', 246.81],
          ['DINÂM.', 227.49],
          ['ENDURO', 312.5],
          ['4X4', 150],
          ['SEG.', -15],
          ['PEN.', 0],
        ]),
      },
      {
        colocacao: 38,
        numero: 15,
        equipe: 'Unicamp Baja SAE',
        escola: 'Unicamp',
        total: 100.21,
        situacao: '',
        // The export's 4X4 cell is blank for this team: the part is unknown.
        partes: buildPartsList([
          ['PROJETO', 105.21],
          ['DINÂM.', 0],
          ['ENDURO', 0],
          ['4X4', null],
          ['SEG.', -5],
          ['PEN.', 0],
        ]),
      },
      {
        // As the real export writes a disqualified team: a place, and the word.
        colocacao: '51º',
        numero: 30,
        equipe: 'Caledônia Racing Baja SAE',
        escola: 'UERJ',
        total: 0,
        situacao: 'Desclassificada',
        partes: buildPartsList([
          ['PROJETO', 0],
          ['SEG.', -5],
        ]),
      },
    ],
  };
}

/** The rank read as the endpoint sends it, a number, with no transform. */
const rankReadAsItIs = { targetField: 'rank', fromPath: 'colocacao' };

/** The rank read from text with textToInteger, which refuses the export's "51º". */
const rankReadFromText = {
  targetField: 'rank',
  fromPath: 'colocacao',
  transformId: 'textToInteger',
};

/**
 * The mapping written for that endpoint, checked as a saved config is checked, with the
 * rank rule given (as it is, unless a test says otherwise).
 */
function buildClassificationMapping(rankRule: object = rankReadAsItIs): FlexMappingConfig {
  return FlexMappingConfigSchema.parse([
    {
      shapeKey: 'standings',
      requestId: 'resultados',
      entriesPath: 'classificacao',
      fields: [
        { targetField: 'scope', constantValue: 'overall' },
        { targetField: 'updatedAtMs', fromPollMoment: true },
      ],
      entryFields: [
        { targetField: 'carNumber', fromPath: 'numero' },
        { targetField: 'teamName', fromPath: 'equipe' },
        { targetField: 'schoolName', fromPath: 'escola' },
        { targetField: 'points', fromPath: 'total' },
        rankRule,
        { targetField: 'pointsByPart', fromPath: 'partes' },
        {
          targetField: 'isDisqualified',
          fromPath: 'situacao',
          transformId: 'mapValues',
          transformParameters: { '': false, Desclassificada: true },
        },
      ],
    },
  ]);
}

describe('mapping an overall classification with score parts', () => {
  it('builds standings with the parts in the source’s order and the disqualified team last', () => {
    // Arrange: the endpoint's answer and the mapping written for it.
    const response = buildClassificationResponse();
    const mapping = buildClassificationMapping();

    // Act: map the poll, then check the standings as every caller does next.
    const result = applyFlexMapping(mapping, { resultados: response }, pollMomentMs);
    const standings = result.ok ? result.shapes.standings : undefined;
    const validation = validateDataShape('standings', standings);

    // Assert: the parts are listed once each, in the order met; Unicamp's unknown 4X4 is
    // left out; Caledônia is disqualified with no rank; and the whole passes the shape.
    expect(result.ok, 'the classification must map').toBe(true);
    expect(standings, 'the standings must carry the parts and each team’s points').toEqual({
      scope: 'overall',
      updatedAtMs: pollMomentMs,
      scoreParts: [
        { partId: 'PROJETO', label: 'PROJETO' },
        { partId: 'DINÂM.', label: 'DINÂM.' },
        { partId: 'ENDURO', label: 'ENDURO' },
        { partId: '4X4', label: '4X4' },
        { partId: 'SEG.', label: 'SEG.' },
        { partId: 'PEN.', label: 'PEN.' },
      ],
      entries: [
        {
          carNumber: 2,
          teamName: 'Baja UFMG',
          schoolName: 'UFMG',
          points: 921.8,
          rank: 1,
          pointsByPart: {
            PROJETO: 246.81,
            'DINÂM.': 227.49,
            ENDURO: 312.5,
            '4X4': 150,
            'SEG.': -15,
            'PEN.': 0,
          },
          isDisqualified: false,
        },
        {
          carNumber: 15,
          teamName: 'Unicamp Baja SAE',
          schoolName: 'Unicamp',
          points: 100.21,
          rank: 38,
          pointsByPart: { PROJETO: 105.21, 'DINÂM.': 0, ENDURO: 0, 'SEG.': -5, 'PEN.': 0 },
          isDisqualified: false,
        },
        {
          carNumber: 30,
          teamName: 'Caledônia Racing Baja SAE',
          schoolName: 'UERJ',
          points: 0,
          pointsByPart: { PROJETO: 0, 'SEG.': -5 },
          isDisqualified: true,
        },
      ],
    });
    expect(validation.isValid, 'the mapped standings must pass the shape').toBe(true);
  });

  it('reads no rank for a disqualified team, even one the rank rule cannot read', () => {
    // Arrange: the same teams with their places written as text ("1", "38", "51º"), and
    // the rank read with textToInteger, which refuses "51º".
    const response = buildClassificationResponse();
    const teamsWithPlacesAsText = response.classificacao.map((team) => ({
      ...team,
      colocacao: String(team.colocacao),
    }));
    const responseWithPlacesAsText = { classificacao: teamsWithPlacesAsText };
    const mapping = buildClassificationMapping(rankReadFromText);

    // Act: map the poll.
    const result = applyFlexMapping(
      mapping,
      { resultados: responseWithPlacesAsText },
      pollMomentMs,
    );

    // Assert: the mapping succeeds and Caledônia has no rank.
    expect(result.ok, 'a disqualified team’s unreadable rank must not fail the poll').toBe(true);
    const entries = result.ok
      ? (result.shapes.standings as { entries: Array<Record<string, unknown>> }).entries
      : [];
    expect(entries[2], 'the disqualified team has no rank').not.toHaveProperty('rank');
  });
});

describe('a part whose value the source does not know', () => {
  const unknownPartScenarios = [
    {
      // The real overall.csv has blank 4X4 cells: the first team's blank must not move
      // 4X4 to the end of the board.
      name: 'keeps its column in place when the first team has no value for it',
      valuesOfFourByFour: [null, 150],
    },
    {
      // Before the 4X4 is run nobody has it: the column must still be there, all "—".
      name: 'keeps its column when no team has a value for it',
      valuesOfFourByFour: [null, null],
    },
  ];

  it.each(unknownPartScenarios)('$name', ({ valuesOfFourByFour }) => {
    // Arrange: two teams, each with PROJETO, 4X4 and ENDURO in that order, the 4X4 values
    // from the row.
    const response = {
      classificacao: valuesOfFourByFour.map((fourByFour, index) => ({
        colocacao: index + 1,
        numero: index + 1,
        equipe: index === 0 ? 'Baja UFMG' : 'Equipe FEI Baja',
        escola: index === 0 ? 'UFMG' : 'FEI',
        total: 500,
        situacao: '',
        partes: buildPartsList([
          ['PROJETO', 200],
          ['4X4', fourByFour],
          ['ENDURO', 300],
        ]),
      })),
    };

    // Act: map the poll.
    const result = applyFlexMapping(
      buildClassificationMapping(),
      { resultados: response },
      pollMomentMs,
    );

    // Assert: the three parts, in the source's order, 4X4 included.
    const standings = result.ok ? (result.shapes.standings as { scoreParts: unknown }) : undefined;
    expect(standings?.scoreParts, 'every part named in the lists, in order').toEqual([
      { partId: 'PROJETO', label: 'PROJETO' },
      { partId: '4X4', label: '4X4' },
      { partId: 'ENDURO', label: 'ENDURO' },
    ]);
  });
});

describe('a classification whose parts cannot be read', () => {
  const unreadablePartsScenarios = [
    {
      // A source sending the total as the parts would otherwise draw no columns at all.
      name: 'fails when a team’s parts are not a list, naming the team',
      parts: 921.8,
      expectedProblem:
        'Pontuação › carro 2 (linha 1) › Partes da pontuação (lista de rótulo e valor): era esperada uma lista de partes, cada uma com rótulo (label) e valor (value)',
    },
    {
      // A part with no label has no column head.
      name: 'fails when a part has no text label, naming its place in the list',
      parts: [{ label: 'PROJETO', value: 246.81 }, { value: 227.49 }],
      expectedProblem:
        'Pontuação › carro 2 (linha 1) › Partes da pontuação (lista de rótulo e valor): a parte 2 da lista precisa de um rótulo (label) em texto e de um valor (value) em número',
    },
    {
      // A value written as text ("246,81") would be drawn as text in a number column.
      name: 'fails when a part’s value is not a number, naming its place in the list',
      parts: [{ label: 'PROJETO', value: '246,81' }],
      expectedProblem:
        'Pontuação › carro 2 (linha 1) › Partes da pontuação (lista de rótulo e valor): a parte 1 da lista precisa de um rótulo (label) em texto e de um valor (value) em número',
    },
  ];

  it.each(unreadablePartsScenarios)('$name', ({ parts, expectedProblem }) => {
    // Arrange: Baja UFMG alone, with the parts of the row above.
    const response = {
      classificacao: [
        {
          colocacao: 1,
          numero: 2,
          equipe: 'Baja UFMG',
          escola: 'UFMG',
          total: 921.8,
          situacao: '',
          partes: parts,
        },
      ],
    };

    // Act: map the poll.
    const result = applyFlexMapping(
      buildClassificationMapping(),
      { resultados: response },
      pollMomentMs,
    );

    // Assert: the mapping fails, and the problem names the team and what is wrong.
    expect(result, 'unreadable parts must fail the whole mapping').toEqual({
      ok: false,
      problems: [expectedProblem],
      summary: expectedProblem,
    });
  });
});
