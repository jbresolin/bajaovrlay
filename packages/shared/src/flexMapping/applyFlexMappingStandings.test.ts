/**
 * Mapping an overall classification with its score parts into the standings shape
 * (packages/shared)
 *
 * What this module is for:
 *   The real overall score has parts the source names itself (PROJETO, DINÂM., ENDURO,
 *   4X4, SEG., PEN.) and keeps disqualified teams in the list (BAJAOVRLAY-24). A flex
 *   source sends each team's parts as a list, each part a `label` and a `value`; the
 *   mapping turns that list into the team's `pointsByPart` (keyed by the label) and builds
 *   the standings' `scoreParts` from every label it met, in the order it met them. The
 *   disqualified flag is an ordinary field, read with mapValues from the source's word.
 *
 * What these tests prove:
 *   - A classification of three teams (one disqualified, one with an unknown part) maps
 *     into standings that pass validateDataShape: the parts in the source's order, each
 *     team's points by part, the unknown part left out, the disqualified team unranked.
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
        colocacao: null,
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

/** The mapping written for that endpoint, checked as a saved config is checked. */
function buildClassificationMapping(): FlexMappingConfig {
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
        { targetField: 'rank', fromPath: 'colocacao' },
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
