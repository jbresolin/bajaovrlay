/**
 * The mapping config's additions for APIs shaped like the Baja app's (packages/shared)
 *
 * What this module is for:
 *   BAJAOVRLAY-53 lets a flex mapping read an API that splits its data the way the Baja
 *   app's results API does, with no Baja word in the code: a rule may try alternatives in
 *   order (`firstOf`), read a joined list (`lookups` and `fromLookup`), read the outer
 *   element of a nested list (`nestedEntriesPath` and `fromParent`), read a table cell by
 *   its column's header (`table` and `fromColumn`, and standings' parts from a list of
 *   headers), refuse a whole answer by a flag (`refuseWhen`), work out gaps from laps
 *   (`workOutGapsFromLaps` with `lastPassAtMs`) and mark a bracket match incomplete
 *   (`entryIsIncompleteWhen`). FlexMappingConfigSchema checks all of it when the source is
 *   saved, so a broken mapping is refused by the form and by createDataSource.
 *
 * What these tests prove:
 *   - A positions mapping, a standings mapping and a brackets mapping using every addition
 *     pass.
 *   - Each addition is refused where it cannot work: alternatives with fewer than two
 *     sources, two sources in one alternative or a fixed value before the last one; a
 *     lookup the mapping does not declare, declared twice, or read by a shape's own field;
 *     an outer element without a nested list; a column without a table; standings' parts
 *     from columns on another shape, without a table or beside a parts list; gaps on a
 *     shape other than the positions, or a last pass mapped with the gaps off; incomplete
 *     matches on a shape other than brackets; a refusal with no message.
 *
 * What these tests deliberately do not cover:
 *   - Whether a lookup's request is one of the source's requests: the httpJson config,
 *     which holds the requests, checks that (httpJsonConfigLookups.test.ts).
 *   - What each addition does to a response: the applyFlexMapping*.test.ts files.
 */
import { describe, expect, it } from 'vitest';

import { FlexMappingConfigSchema } from './flexMappingConfig.js';

/** The teams lookup of the Baja API: equipes' teams by number, joined on a car's number. */
const teamsLookup = {
  lookupName: 'equipes',
  requestId: 'equipes',
  listPath: 'teams',
  keyPath: 'number',
  entryKeyPath: 'number',
};

/** A positions mapping of the Baja API's race, names joined from the teams list. */
function buildRacePositionsMapping(): Record<string, unknown> {
  return {
    shapeKey: 'positions',
    requestId: 'corrida',
    entriesPath: 'cars',
    lookups: [teamsLookup],
    workOutGapsFromLaps: true,
    refuseWhen: {
      path: 'simulation',
      equals: true,
      message: 'Corrida simulada: não vai ao ar como corrida de verdade.',
    },
    fields: [
      { targetField: 'sessionId', fromPath: 'prova_id' },
      { targetField: 'updatedAtMs', fromPollMoment: true },
    ],
    entryFields: [
      { targetField: 'position', fromListOrder: true },
      { targetField: 'carNumber', fromPath: 'number' },
      {
        targetField: 'teamName',
        firstOf: [
          { fromLookup: { lookup: 'equipes', path: 'short_name' } },
          { fromLookup: { lookup: 'equipes', path: 'name' } },
          { fromPath: 'team' },
        ],
      },
      {
        targetField: 'schoolName',
        firstOf: [{ fromLookup: { lookup: 'equipes', path: 'school_short' } }, { fromPath: 'school' }],
      },
      { targetField: 'laps', fromPath: 'laps' },
      { targetField: 'lastPassAtMs', fromPath: 'last_pass_ms' },
    ],
  };
}

/** A standings mapping of the Baja API's results table, read by column header. */
function buildTableStandingsMapping(): Record<string, unknown> {
  return {
    shapeKey: 'standings',
    requestId: 'resultado',
    entriesPath: 'rows',
    table: { columnsPath: 'columns', headerPath: 'header', cellsPath: 'cells' },
    scorePartsFromColumns: { headers: ['Segurança', 'Projeto', 'Dinâmicas', 'Enduro'], valuePath: 'raw' },
    refuseWhen: {
      path: 'spoilers_active',
      equals: true,
      message: 'Resultado com spoilers ativos: a organização esconde as posições agora.',
    },
    fields: [
      { targetField: 'scope', constantValue: 'overall' },
      { targetField: 'updatedAtMs', fromPollMoment: true },
    ],
    entryFields: [
      { targetField: 'carNumber', fromPath: 'team.number' },
      { targetField: 'teamName', fromPath: 'team.name' },
      { targetField: 'schoolName', fromPath: 'team.school' },
      { targetField: 'points', fromColumn: { header: 'Total', path: 'raw' } },
      { targetField: 'rank', fromPath: 'position' },
    ],
  };
}

/** A brackets mapping of the Baja API's tournament: rounds holding matches. */
function buildNestedBracketsMapping(): Record<string, unknown> {
  return {
    shapeKey: 'brackets',
    requestId: 'torneio',
    entriesPath: 'rounds',
    nestedEntriesPath: 'matches',
    entryIsIncompleteWhen: [
      { path: 'slots[0].type', isOneOf: ['pending', 'unknown'] },
      { path: 'slots[1].type', isOneOf: ['pending', 'unknown'] },
    ],
    fields: [
      { targetField: 'sessionId', fromPath: 'resultado_id' },
      { targetField: 'updatedAtMs', fromPollMoment: true },
    ],
    entryFields: [
      { targetField: 'roundName', fromParent: 'name' },
      { targetField: 'matchId', fromPath: 'match_id', transformId: 'numberToText' },
      { targetField: 'carA.carNumber', fromPath: 'slots[0].team.number' },
      { targetField: 'carA.teamName', fromPath: 'slots[0].team.short_name' },
      { targetField: 'carA.schoolName', fromPath: 'slots[0].team.school_short' },
    ],
  };
}

/** A mapping with some of its keys replaced or added. */
function withChanges(
  mapping: Record<string, unknown>,
  changes: Record<string, unknown>,
): Record<string, unknown> {
  return { ...mapping, ...changes };
}

/** A mapping with one more entry rule added at the end. */
function withEntryRule(mapping: Record<string, unknown>, rule: object): Record<string, unknown> {
  const entryFields = mapping.entryFields as object[];
  return { ...mapping, entryFields: [...entryFields, rule] };
}

/** The first problem the schema found: where, and the sentence it gave. */
function findFirstIssue(mappings: unknown): { path: string; message: string } | undefined {
  const parsing = FlexMappingConfigSchema.safeParse(mappings);
  const firstIssue = parsing.error?.issues[0];
  if (firstIssue === undefined) {
    return undefined;
  }
  return { path: firstIssue.path.map(String).join('.'), message: firstIssue.message };
}

describe('FlexMappingConfigSchema, the additions of BAJAOVRLAY-53', () => {
  it('accepts a race, a results table and a tournament mapped with every addition', () => {
    // Arrange: the three mappings, as a Baja API preset would write them.
    const mappings = [
      buildRacePositionsMapping(),
      buildTableStandingsMapping(),
      buildNestedBracketsMapping(),
    ];

    // Act: check them as a saved config is checked.
    const firstIssue = findFirstIssue(mappings);

    // Assert: no problem at all.
    expect(firstIssue, 'the three mappings must pass').toBeUndefined();
  });

  const refusedScenarios: Array<{
    name: string;
    mapping: Record<string, unknown>;
    expectedPath: string;
    expectedMessage: string;
  }> = [
    // One alternative is no choice: the rule should name its source directly.
    {
      name: 'refuses alternatives with a single source',
      mapping: withEntryRule(buildTableStandingsMapping(), {
        targetField: 'isDisqualified',
        firstOf: [{ fromPath: 'team.disqualified' }],
      }),
      expectedPath: '0.entryFields.5.firstOf',
      expectedMessage:
        'As alternativas da regra de "isDisqualified" precisam de pelo menos duas origens; com uma só, use a origem direto.',
    },
    // An alternative naming two sources would leave the reader guessing which one it is.
    {
      name: 'refuses an alternative that names two sources',
      mapping: withEntryRule(buildTableStandingsMapping(), {
        targetField: 'isDisqualified',
        firstOf: [{ fromPath: 'team.disqualified', constantValue: false }, { constantValue: false }],
      }),
      expectedPath: '0.entryFields.5.firstOf.0',
      expectedMessage:
        'A alternativa 1 da regra de "isDisqualified" precisa de exatamente uma origem: caminho, caminho no item de fora, consulta, coluna ou valor fixo.',
    },
    // A fixed value is always present, so anything after it would never be read.
    {
      name: 'refuses a fixed value before the last alternative',
      mapping: withEntryRule(buildTableStandingsMapping(), {
        targetField: 'isDisqualified',
        firstOf: [{ constantValue: false }, { fromPath: 'team.disqualified' }],
      }),
      expectedPath: '0.entryFields.5.firstOf.0',
      expectedMessage:
        'Na regra de "isDisqualified", o valor fixo só pode ser a última alternativa: as que viessem depois nunca seriam usadas.',
    },
    // A lookup the mapping does not declare cannot be read.
    {
      name: 'refuses a rule reading a lookup the mapping does not declare',
      mapping: withEntryRule(buildTableStandingsMapping(), {
        targetField: 'isDisqualified',
        fromLookup: { lookup: 'equipes', path: 'disqualified' },
      }),
      expectedPath: '0.entryFields.5.fromLookup.lookup',
      expectedMessage: 'A consulta "equipes" não existe neste mapeamento.',
    },
    // The same check reaches inside the alternatives.
    {
      name: 'refuses an alternative reading a lookup the mapping does not declare',
      mapping: withEntryRule(buildTableStandingsMapping(), {
        targetField: 'isDisqualified',
        firstOf: [{ fromLookup: { lookup: 'equipes', path: 'disqualified' } }, { constantValue: false }],
      }),
      expectedPath: '0.entryFields.5.firstOf.0.fromLookup.lookup',
      expectedMessage: 'A consulta "equipes" não existe neste mapeamento.',
    },
    // A lookup is matched by an entry's key, so a shape's own field has nothing to match.
    {
      name: 'refuses a lookup read by a shape field rather than an entry field',
      mapping: withChanges(buildRacePositionsMapping(), {
        fields: [
          { targetField: 'sessionId', fromLookup: { lookup: 'equipes', path: 'name' } },
          { targetField: 'updatedAtMs', fromPollMoment: true },
        ],
      }),
      expectedPath: '0.fields.0.fromLookup',
      expectedMessage:
        '"Consulta" só vale para os campos de cada item da lista, não para "Identificador da sessão".',
    },
    // Two lookups with one name: a rule could not say which it reads.
    {
      name: 'refuses two lookups with the same name',
      mapping: withChanges(buildRacePositionsMapping(), { lookups: [teamsLookup, teamsLookup] }),
      expectedPath: '0.lookups.1.lookupName',
      expectedMessage: 'Há duas consultas chamadas "equipes".',
    },
    // There is no outer element to read in a flat list.
    {
      name: 'refuses a rule reading the outer element of a list that is not nested',
      mapping: withEntryRule(buildTableStandingsMapping(), {
        targetField: 'isDisqualified',
        fromParent: 'disqualified',
      }),
      expectedPath: '0.entryFields.5.fromParent',
      expectedMessage:
        '"Desclassificada" lê o item de fora, mas este mapeamento não tem "Lista dentro de cada item".',
    },
    // A nested list needs the outer list it sits in.
    {
      name: 'refuses a nested list without the outer list',
      mapping: withChanges(buildNestedBracketsMapping(), { entriesPath: undefined }),
      expectedPath: '0.entriesPath',
      expectedMessage: 'Chaves precisa do "Caminho da lista", o caminho até a lista na resposta.',
    },
    // A column is found by the table's headers, which only `table` says where to find.
    {
      name: 'refuses a column read without the table layout',
      mapping: withEntryRule(buildRacePositionsMapping(), {
        targetField: 'pitStops',
        fromColumn: { header: 'Paradas', path: 'raw' },
      }),
      expectedPath: '0.entryFields.6.fromColumn',
      expectedMessage:
        '"Paradas nos boxes" lê uma coluna, mas este mapeamento não diz onde estão as colunas da tabela.',
    },
    // Parts by column belong to the standings; the positions have no score.
    {
      name: 'refuses score parts from columns on the positions',
      mapping: withChanges(buildRacePositionsMapping(), {
        scorePartsFromColumns: { headers: ['Projeto'], valuePath: 'raw' },
      }),
      expectedPath: '0.scorePartsFromColumns',
      expectedMessage: 'Partes da pontuação por coluna só existem na Pontuação.',
    },
    // Parts by column need to know where the columns are.
    {
      name: 'refuses score parts from columns without the table layout',
      mapping: withChanges(buildTableStandingsMapping(), { table: undefined, entryFields: [] }),
      expectedPath: '0.scorePartsFromColumns',
      expectedMessage:
        'Partes da pontuação por coluna precisam de onde estão as colunas da tabela.',
    },
    // Two ways of filling the same parts would compete.
    {
      name: 'refuses score parts from columns beside a list of parts per team',
      mapping: withEntryRule(buildTableStandingsMapping(), {
        targetField: 'pointsByPart',
        fromPath: 'parts',
      }),
      expectedPath: '0.scorePartsFromColumns',
      expectedMessage:
        'As partes da pontuação vêm de colunas ou de uma lista por equipe, não das duas.',
    },
    // A part named twice would be two columns of the same name on the graphic.
    {
      name: 'refuses the same header twice among the score parts',
      mapping: withChanges(buildTableStandingsMapping(), {
        scorePartsFromColumns: { headers: ['Projeto', 'Projeto'], valuePath: 'raw' },
      }),
      expectedPath: '0.scorePartsFromColumns.headers.1',
      expectedMessage: 'A coluna "Projeto" aparece duas vezes nas partes da pontuação.',
    },
    // Gaps are a positions thing.
    {
      name: 'refuses working out gaps on the standings',
      mapping: withChanges(buildTableStandingsMapping(), { workOutGapsFromLaps: true }),
      expectedPath: '0.workOutGapsFromLaps',
      expectedMessage: 'Calcular as diferenças pelas voltas só existe nas Posições.',
    },
    // A last pass with the gaps off would be read and thrown away.
    {
      name: 'refuses a last pass mapped while the gaps are not worked out',
      mapping: withChanges(buildRacePositionsMapping(), { workOutGapsFromLaps: undefined }),
      expectedPath: '0.entryFields.5.targetField',
      expectedMessage:
        '"Última passagem (para calcular as diferenças)" só serve para calcular as diferenças pelas voltas; ligue essa opção ou deixe o campo sem mapear.',
    },
    // Incomplete matches are a brackets thing.
    {
      name: 'refuses incomplete-entry conditions on the positions',
      mapping: withChanges(buildRacePositionsMapping(), {
        entryIsIncompleteWhen: [{ path: 'status', isOneOf: ['out'] }],
      }),
      expectedPath: '0.entryIsIncompleteWhen',
      expectedMessage: 'Disputas incompletas só existem nas Chaves.',
    },
    // A refusal is read by the operator, so it must say something.
    {
      name: 'refuses a refusal with no message',
      mapping: withChanges(buildTableStandingsMapping(), {
        refuseWhen: { path: 'spoilers_active', equals: true, message: '' },
      }),
      expectedPath: '0.refuseWhen.message',
      expectedMessage: 'A recusa precisa de uma mensagem para o operador.',
    },
  ];

  it.each(refusedScenarios)('$name', ({ mapping, expectedPath, expectedMessage }) => {
    // Arrange: the mapping of this row, the only one of its config.
    const mappings = [mapping];

    // Act: check it as a saved config is checked.
    const firstIssue = findFirstIssue(mappings);

    // Assert: refused at the right place, with the pt-BR sentence.
    expect(firstIssue, 'the mapping must be refused at this place with this sentence').toEqual({
      path: expectedPath,
      message: expectedMessage,
    });
  });
});
