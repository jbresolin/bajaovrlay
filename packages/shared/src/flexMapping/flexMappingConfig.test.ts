/**
 * The mapping config of a flex source (packages/shared)
 *
 * What this module is for:
 *   A flex source's config says, for each shape it produces, which request's response to
 *   read and one rule per canonical field: read it at a path (with at most one transform
 *   from the registry), give it a fixed value, take the car's place in the list, or take
 *   the moment of the poll. `FlexMappingConfigSchema` checks all of that when the config
 *   is saved, so a broken mapping is refused by the operator's form and by the server's
 *   createDataSource, not in the middle of a race.
 *
 * What these tests prove:
 *   - The mappings of the example preset pass.
 *   - A rule has exactly one source; a transform only reads a path; parameters need a
 *     transform; an unknown transform, a binding transform and a bad value table are
 *     refused; a broken path is refused, in a rule and as the list's path.
 *   - A target must be a field of that shape, at its level (an entry field among the
 *     shape's own fields is refused, and the other way round), and appear once;
 *     "ordem na lista" fills entry fields only.
 *   - A shape is mapped once; the session has no list, and positions, standings and
 *     brackets (a list of matches) must have one; an empty list of mappings and a misspelt
 *     key are refused.
 *
 * What these tests deliberately do not cover:
 *   - That every requestId names one of the source's requests: the httpJson config,
 *     which holds the requests, checks that (httpJsonConfig.test.ts).
 *   - Applying a mapping to a response; applyFlexMapping.test.ts covers that.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { FlexMappingConfigSchema } from './flexMappingConfig.js';

/** Reads the example preset's mappings, exactly as the file has them. */
function readExampleConfigMappings(): unknown {
  const configUrl = new URL('./examples/timing-system-like.config.json', import.meta.url);
  const config = JSON.parse(readFileSync(configUrl, 'utf8')) as { mappings: unknown };
  return config.mappings;
}

/** A positions mapping of a timing system that sends its cars under "classificacao". */
function buildPositionsMapping(): Record<string, unknown> {
  return {
    shapeKey: 'positions',
    requestId: 'classificacao',
    entriesPath: 'classificacao',
    fields: [
      { targetField: 'sessionId', constantValue: 'enduro-2027-nacional' },
      { targetField: 'updatedAtMs', fromPollMoment: true },
    ],
    entryFields: [
      { targetField: 'position', fromListOrder: true },
      { targetField: 'carNumber', fromPath: 'carro', transformId: 'textToInteger' },
      { targetField: 'teamName', fromPath: 'equipe' },
      { targetField: 'schoolName', fromPath: 'escola' },
      { targetField: 'laps', fromPath: 'voltas' },
      {
        targetField: 'status',
        fromPath: 'situacao',
        transformId: 'mapValues',
        transformParameters: { PISTA: 'running', BOX: 'inPit', ABAND: 'retired' },
      },
    ],
  };
}

/** A session mapping that reads the flag and the clock from "prova". */
function buildSessionMapping(): Record<string, unknown> {
  return {
    shapeKey: 'session',
    requestId: 'classificacao',
    fields: [
      { targetField: 'sessionId', fromPath: 'prova.id' },
      { targetField: 'eventName', constantValue: 'Baja SAE Brasil 2027 — Etapa Nacional' },
    ],
  };
}

/** The positions mapping with its car rules replaced by `entryFields`. */
function buildPositionsMappingWithEntryFields(entryFields: unknown[]): Record<string, unknown> {
  return { ...buildPositionsMapping(), entryFields };
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

describe('FlexMappingConfigSchema', () => {
  it('accepts the mappings of the example timing-system preset', () => {
    // Arrange: the example preset's mappings, as the file has them.
    const exampleMappings = readExampleConfigMappings();

    // Act: check them.
    const parsing = FlexMappingConfigSchema.safeParse(exampleMappings);

    // Assert: they pass, positions and session.
    expect(parsing.error?.issues, 'the example mappings must have no problem').toBeUndefined();
    expect(
      parsing.data?.map((mapping) => mapping.shapeKey),
      'the example must map positions and session',
    ).toEqual(['positions', 'session']);
  });

  const refusedMappingScenarios: Array<{
    name: string;
    mappings: unknown[];
    expectedPath: string;
    expectedMessage: string;
  }> = [
    // Two sources would leave the reader guessing which one wins.
    {
      name: 'refuses a team name that is both read and fixed',
      mappings: [
        buildPositionsMappingWithEntryFields([
          { targetField: 'teamName', fromPath: 'equipe', constantValue: 'Baja UFPR' },
        ]),
      ],
      expectedPath: '0.entryFields.0',
      expectedMessage:
        'A regra de "teamName" precisa de exatamente uma origem: caminho, valor fixo, ordem na lista ou momento da leitura.',
    },
    // A rule with no source at all would map nothing while looking like it maps something.
    {
      name: 'refuses a rule with no source',
      mappings: [buildPositionsMappingWithEntryFields([{ targetField: 'laps' }])],
      expectedPath: '0.entryFields.0',
      expectedMessage:
        'A regra de "laps" precisa de exatamente uma origem: caminho, valor fixo, ordem na lista ou momento da leitura.',
    },
    // A transform names what is done to a value read from the response, so a fixed value has none.
    {
      name: 'refuses a transform on a fixed value',
      mappings: [
        buildPositionsMappingWithEntryFields([
          { targetField: 'laps', constantValue: '0', transformId: 'textToInteger' },
        ]),
      ],
      expectedPath: '0.entryFields.0.transformId',
      expectedMessage: 'A transformação da regra de "laps" só vale para um campo lido por caminho.',
    },
    // A value table with no transform to read it would be silently ignored.
    {
      name: 'refuses parameters with no transform',
      mappings: [
        buildPositionsMappingWithEntryFields([
          { targetField: 'status', fromPath: 'situacao', transformParameters: { BOX: 'inPit' } },
        ]),
      ],
      expectedPath: '0.entryFields.0.transformParameters',
      expectedMessage: 'A regra de "status" tem parâmetros mas nenhuma transformação.',
    },
    // Unknown transform ids are refused at save time, never at poll time.
    {
      name: 'refuses a transform the registry does not have',
      mappings: [
        buildPositionsMappingWithEntryFields([
          { targetField: 'lastLapMs', fromPath: 'ultima_volta', transformId: 'formatLapTime' },
        ]),
      ],
      expectedPath: '0.entryFields.0.transformId',
      expectedMessage: 'A transformação "formatLapTime" não existe.',
    },
    // A binding transform formats canonical data for the screen; a mapping must bring the
    // lap in as ms (BAJAOVRLAY-20 marks every transform with its family).
    {
      name: 'refuses a binding transform, which formats for the screen',
      mappings: [
        buildPositionsMappingWithEntryFields([
          {
            targetField: 'lastLapMs',
            fromPath: 'ultima_volta',
            transformId: 'formatLapTimeAsText',
          },
        ]),
      ],
      expectedPath: '0.entryFields.0.transformId',
      expectedMessage:
        'A transformação "Tempo de volta como texto" serve para vincular campos de um gráfico, não para mapear uma fonte.',
    },
    // The value table is checked by its own schema when the config is saved.
    {
      name: 'refuses an empty status table',
      mappings: [
        buildPositionsMappingWithEntryFields([
          {
            targetField: 'status',
            fromPath: 'situacao',
            transformId: 'mapValues',
            transformParameters: {},
          },
        ]),
      ],
      expectedPath: '0.entryFields.0.transformParameters',
      expectedMessage: 'A tabela de valores está vazia.',
    },
    // A wildcard in a rule's path is refused with the path's own sentence.
    {
      name: 'refuses a wildcard in a rule path',
      mappings: [
        buildPositionsMappingWithEntryFields([{ targetField: 'laps', fromPath: 'voltas[*]' }]),
      ],
      expectedPath: '0.entryFields.0.fromPath',
      expectedMessage:
        'O caminho "voltas[*]" tem um índice que não é um número inteiro; curingas e filtros não existem, só índices como [3].',
    },
    // The list's path is checked like any other.
    {
      name: 'refuses a broken list path',
      mappings: [{ ...buildPositionsMapping(), entriesPath: 'dados..classificacao' }],
      expectedPath: '0.entriesPath',
      expectedMessage:
        'O caminho "dados..classificacao" tem um trecho vazio: um ponto no começo, no fim, ou dois pontos seguidos.',
    },
    // A misspelt field would be dropped by the canonical validation, so it is refused here.
    {
      name: 'refuses a target the positions shape does not have',
      mappings: [
        buildPositionsMappingWithEntryFields([{ targetField: 'teamname', fromPath: 'equipe' }]),
      ],
      expectedPath: '0.entryFields.0.targetField',
      expectedMessage: '"teamname" não é um campo que se possa preencher em Posições.',
    },
    // A car's field among the shape's own fields would land beside the list, not in each car.
    {
      name: 'refuses a car field among the fields of the whole shape',
      mappings: [
        {
          ...buildPositionsMapping(),
          fields: [{ targetField: 'teamName', constantValue: 'Baja UFPR' }],
        },
      ],
      expectedPath: '0.fields.0.targetField',
      expectedMessage: '"Equipe" é um campo de cada item da lista, não do formato inteiro.',
    },
    // And the other way round: the session id is the shape's, not each car's.
    {
      name: 'refuses a field of the whole shape among the car fields',
      mappings: [
        buildPositionsMappingWithEntryFields([{ targetField: 'sessionId', fromPath: 'prova' }]),
      ],
      expectedPath: '0.entryFields.0.targetField',
      expectedMessage:
        '"Identificador da sessão" é um campo do formato inteiro, não de cada item da lista.',
    },
    // Two rules for one field would leave the reader guessing which one wins.
    {
      name: 'refuses a car field mapped twice',
      mappings: [
        buildPositionsMappingWithEntryFields([
          { targetField: 'laps', fromPath: 'voltas' },
          { targetField: 'laps', fromPath: 'voltas_completas' },
        ]),
      ],
      expectedPath: '0.entryFields.1.targetField',
      expectedMessage: '"Voltas" aparece em mais de uma regra; cada campo tem uma regra só.',
    },
    // The place in the list only exists for an element of the list.
    {
      name: 'refuses the place in the list for the update moment',
      mappings: [
        {
          ...buildPositionsMapping(),
          fields: [{ targetField: 'updatedAtMs', fromListOrder: true }],
        },
      ],
      expectedPath: '0.fields.0.fromListOrder',
      expectedMessage:
        '"Ordem na lista" só vale para os campos de cada item da lista, não para "Momento da atualização".',
    },
    // A shape comes from one mapping only, so no poll has two answers for it.
    {
      name: 'refuses positions mapped twice',
      mappings: [buildPositionsMapping(), buildPositionsMapping()],
      expectedPath: '1.shapeKey',
      expectedMessage:
        'Posições está mapeada mais de uma vez; cada formato vem de um só mapeamento.',
    },
    // Brackets are a list of matches (BAJAOVRLAY-25): without the list's path there are none.
    {
      name: 'refuses brackets without the list path',
      mappings: [{ shapeKey: 'brackets', requestId: 'chaves', fields: [], entryFields: [] }],
      expectedPath: '0.entriesPath',
      expectedMessage: 'Chaves precisa do "Caminho da lista", o caminho até a lista na resposta.',
    },
    // The session is one object, so a list path there means a mistaken shape key.
    {
      name: 'refuses a list path on the session',
      mappings: [{ ...buildSessionMapping(), entriesPath: 'classificacao' }],
      expectedPath: '0.entriesPath',
      expectedMessage:
        'A Sessão não é uma lista: ela não tem "Caminho da lista" nem campos de cada item.',
    },
    // Positions without the list's path would have no cars to read.
    {
      name: 'refuses positions without the list path',
      mappings: [{ ...buildPositionsMapping(), entriesPath: undefined }],
      expectedPath: '0.entriesPath',
      expectedMessage: 'Posições precisa do "Caminho da lista", o caminho até a lista na resposta.',
    },
    // A source with no mapping produces nothing, which is never what the operator meant.
    {
      name: 'refuses an empty list of mappings',
      mappings: [],
      expectedPath: '',
      expectedMessage: 'Mapeie pelo menos um formato: Sessão, Posições ou Pontuação.',
    },
    // A misspelt key ("fromPth") would otherwise be dropped and the rule left with no source.
    {
      name: 'refuses a misspelt key on a rule',
      mappings: [
        buildPositionsMappingWithEntryFields([{ targetField: 'laps', fromPth: 'voltas' }]),
      ],
      expectedPath: '0.entryFields.0',
      expectedMessage: 'A regra tem uma chave que não existe: "fromPth".',
    },
  ];

  it.each(refusedMappingScenarios)('$name', ({ mappings, expectedPath, expectedMessage }) => {
    // Arrange: nothing more to set up; the mappings are the row's.

    // Act: check them as a saved config is checked.
    const firstIssue = findFirstIssue(mappings);

    // Assert: refused, at this place, with this sentence.
    expect(firstIssue, 'the mappings must be refused at this place, for this reason').toEqual({
      path: expectedPath,
      message: expectedMessage,
    });
  });

  it('accepts a session mapping with no list and a positions mapping side by side', () => {
    // Arrange: one session and one positions mapping, each from the same request.
    const mappings = [buildSessionMapping(), buildPositionsMapping()];

    // Act: check them.
    const parsing = FlexMappingConfigSchema.safeParse(mappings);

    // Assert: both pass.
    expect(parsing.error?.issues, 'a session and a positions mapping must pass').toBeUndefined();
  });
});
