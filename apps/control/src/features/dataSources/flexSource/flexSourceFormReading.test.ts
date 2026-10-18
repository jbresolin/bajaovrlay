/**
 * Reading the flex HTTP/JSON form (apps/control)
 *
 * What this module is for:
 *   The flex form holds text: request names and addresses, header rows, and one row per
 *   canonical field with its origin, path or fixed value and transform. "Salvar fonte",
 *   "Testar" and "Exportar" read it into a config and check it with the shared
 *   HttpJsonConfigSchema, the one the server checks, and put each refusal under the field
 *   it is about, so the operator fixes it where it is.
 *
 * What these tests prove:
 *   - A form filled from the example preset reads back as exactly that config.
 *   - A form filled by hand reads into the rules it shows: list order, a transform, and a
 *     value table whose right column is read as JSON (true) or text (inPit).
 *   - A form filled from a config gives its rules back in that config's order, whatever
 *     the order of the rows, with a rule mapped since after them.
 *   - Each kind of refusal lands under its own field: the name, the address, a header's
 *     variable, a row's path, a fixed value of the wrong kind, an empty value table, the
 *     request a mapping reads; one with no field (nothing mapped) goes in the general list.
 *
 * What these tests deliberately do not cover:
 *   - Every rule of the config schema: packages/shared/src/dataSources/httpJsonConfig.test.ts.
 *   - The form on the page and the command it sends: DataSourcesPageFlexForm.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import { readFlexConfigFormValues, readFlexSourceForm } from './flexSourceFormReading';
import {
  buildEmptyMappingFormValues,
  buildFlexConfigFormValues,
  type FieldRuleFormValues,
  type FlexMappingFormValues,
  type FlexSourceFormValues,
} from './flexSourceFormValues';
import { readExampleTimingSystemConfig } from './timingSystemExample.testSupport';

/** A flex form named "Cronometragem da pista", reading every 2 s, filled from the example preset. */
function buildFormFilledFromTheExample(): FlexSourceFormValues {
  return {
    label: 'Cronometragem da pista',
    pollIntervalSeconds: '2',
    ...buildFlexConfigFormValues(readExampleTimingSystemConfig()),
  };
}

/** A form with one request, "classificacao" on the timing system, and these mappings. */
function buildFormWithOneRequestAndMappings(
  mappings: FlexMappingFormValues[],
): FlexSourceFormValues {
  return {
    label: 'Cronometragem da pista',
    pollIntervalSeconds: '2',
    requests: [
      {
        requestId: 'classificacao',
        url: 'http://192.168.0.20:8080/classificacao',
        headers: [],
        queryParameters: [],
      },
    ],
    mappings,
  };
}

/** Changes the row of one canonical field in a mapping block, as the operator would. */
function fillFieldRow(
  mapping: FlexMappingFormValues,
  targetField: string,
  changes: Partial<FieldRuleFormValues>,
): void {
  const rowIndex = mapping.fieldRules.findIndex((row) => row.targetField === targetField);
  const row = mapping.fieldRules[rowIndex];
  if (row === undefined) {
    throw new Error(`the ${mapping.shapeKey} block has no row for ${targetField}`);
  }
  mapping.fieldRules[rowIndex] = { ...row, ...changes };
}

/** Finds the row index of one canonical field, for the error path the form shows it at. */
function findRowIndex(mapping: FlexMappingFormValues, targetField: string): number {
  return mapping.fieldRules.findIndex((row) => row.targetField === targetField);
}

describe('readFlexSourceForm, on a valid form', () => {
  it('reads a form filled from the example preset back as exactly that config', () => {
    // Arrange: the example preset put into the form, as "Importar configuração" does.
    const values = buildFormFilledFromTheExample();

    // Act: read the form.
    const reading = readFlexSourceForm(values);

    // Assert: the source as typed, its config the preset itself.
    expect(reading, 'the example preset must survive the trip through the form').toEqual({
      isValid: true,
      label: 'Cronometragem da pista',
      pollIntervalMs: 2_000,
      config: readExampleTimingSystemConfig(),
    });
  });

  it('reads a positions block filled by hand into the rules it shows', () => {
    // Arrange: a positions block reading "classificacao": the place from the list order,
    // the car by its number as text, and a status table where BOX means the car is in pit.
    const positions = buildEmptyMappingFormValues('positions', 'classificacao');
    positions.entriesPath = 'classificacao';
    fillFieldRow(positions, 'updatedAtMs', { sourceKind: 'pollMoment' });
    fillFieldRow(positions, 'position', { sourceKind: 'listOrder' });
    fillFieldRow(positions, 'carNumber', {
      sourceKind: 'path',
      pathOrConstantText: 'carro',
      transformId: 'textToInteger',
    });
    fillFieldRow(positions, 'status', {
      sourceKind: 'path',
      pathOrConstantText: 'situacao',
      transformId: 'mapValues',
      valueTableRows: [
        { sourceValue: 'BOX', canonicalValueText: 'inPit' },
        { sourceValue: 'PISTA', canonicalValueText: 'running' },
        // A row added once too often and left empty must not become a rule.
        { sourceValue: '', canonicalValueText: '' },
      ],
    });
    fillFieldRow(positions, 'sessionId', { sourceKind: 'constant', pathOrConstantText: '"2027"' });

    // Act: read the form.
    const reading = readFlexConfigFormValues(buildFormWithOneRequestAndMappings([positions]));

    // Assert: the rules in the order of the rows, the rows left "Não mapeado" absent.
    expect(reading.isValid, 'a form filled this way must be a valid config').toBe(true);
    expect(
      reading.isValid ? reading.config.mappings : undefined,
      'each filled row must give its rule',
    ).toEqual([
      {
        shapeKey: 'positions',
        requestId: 'classificacao',
        entriesPath: 'classificacao',
        fields: [
          { targetField: 'sessionId', constantValue: '2027' },
          { targetField: 'updatedAtMs', fromPollMoment: true },
        ],
        entryFields: [
          { targetField: 'position', fromListOrder: true },
          { targetField: 'carNumber', fromPath: 'carro', transformId: 'textToInteger' },
          {
            targetField: 'status',
            fromPath: 'situacao',
            transformId: 'mapValues',
            transformParameters: { BOX: 'inPit', PISTA: 'running' },
          },
        ],
      },
    ]);
  });

  it("keeps an imported config's rule order, putting a rule mapped since after them", () => {
    // Arrange: a config whose item rules name the car before the place (the form shows
    // the place first), and then the laps mapped by hand in the form.
    const formValues = buildFlexConfigFormValues({
      requests: [
        {
          requestId: 'classificacao',
          url: 'http://192.168.0.20:8080/classificacao',
          headers: [],
          queryParameters: [],
        },
      ],
      mappings: [
        {
          shapeKey: 'positions',
          requestId: 'classificacao',
          entriesPath: 'classificacao',
          fields: [{ targetField: 'updatedAtMs', fromPollMoment: true }],
          entryFields: [
            { targetField: 'carNumber', fromPath: 'carro', transformId: 'textToInteger' },
            { targetField: 'position', fromListOrder: true },
          ],
        },
      ],
    });
    const positions = formValues.mappings[0]!;
    fillFieldRow(positions, 'laps', { sourceKind: 'path', pathOrConstantText: 'voltas' });

    // Act: read the form.
    const reading = readFlexConfigFormValues(formValues);

    // Assert: the car, then the place, as written; then the laps, mapped since.
    expect(
      reading.isValid ? reading.config.mappings[0]?.entryFields : undefined,
      "the config's own order must survive the form, a new rule coming last",
    ).toEqual([
      { targetField: 'carNumber', fromPath: 'carro', transformId: 'textToInteger' },
      { targetField: 'position', fromListOrder: true },
      { targetField: 'laps', fromPath: 'voltas' },
    ]);
  });
});

describe('readFlexSourceForm, on a form with problems', () => {
  it('puts a missing name and a non-http address under their fields', () => {
    // Arrange: the example form with no name, its address typed with ftp://.
    const values = buildFormFilledFromTheExample();
    values.label = '  ';
    values.requests[0] = { ...values.requests[0]!, url: 'ftp://cronometragem.local/classificacao' };

    // Act: read the form.
    const reading = readFlexSourceForm(values);

    // Assert: one message under the name, one under the address.
    expect(reading.isValid, 'a form with problems must not be sent').toBe(false);
    expect(
      reading.isValid ? undefined : reading.errorMessageByFieldPath,
      'each problem must be under its field',
    ).toEqual({
      label: 'Informe o nome da fonte.',
      'requests.0.url':
        'O endereço "ftp://cronometragem.local/classificacao" precisa começar com http:// ou https://.',
    });
  });

  it("puts a header variable without the BAJAOVRLAY_SOURCE_ prefix under that row's value", () => {
    // Arrange: the example form with an Authorization header read from DATABASE_PATH.
    const values = buildFormFilledFromTheExample();
    values.requests[0]!.headers = [
      { name: 'Authorization', valueKind: 'environment', valueText: 'DATABASE_PATH' },
    ];

    // Act: read the form.
    const reading = readFlexSourceForm(values);

    // Assert: the refusal sits under the header's value, naming the variable.
    expect(
      reading.isValid
        ? undefined
        : reading.errorMessageByFieldPath['requests.0.headers.0.valueText'],
      'a server variable outside the prefix must be refused at the row that names it',
    ).toContain('"DATABASE_PATH" não pode ser usada');
  });

  it("puts a broken path, a list as a fixed value and an empty value table under each row's own control", () => {
    // Arrange: a positions block whose team path has an unclosed bracket, whose session
    // id is fixed to a list, and whose status table has no rows.
    const positions = buildEmptyMappingFormValues('positions', 'classificacao');
    positions.entriesPath = 'classificacao';
    fillFieldRow(positions, 'teamName', { sourceKind: 'path', pathOrConstantText: 'equipe[0' });
    fillFieldRow(positions, 'sessionId', { sourceKind: 'constant', pathOrConstantText: '[1, 2]' });
    fillFieldRow(positions, 'status', {
      sourceKind: 'path',
      pathOrConstantText: 'situacao',
      transformId: 'mapValues',
      valueTableRows: [],
    });

    // Act: read the form.
    const reading = readFlexConfigFormValues(buildFormWithOneRequestAndMappings([positions]));

    // Assert: three messages, each at its row's path or value, or its transform.
    const messages = reading.isValid ? {} : reading.errorMessageByFieldPath;
    const rowPath = (targetField: string) =>
      `mappings.0.fieldRules.${findRowIndex(positions, targetField)}`;
    expect(
      messages[`${rowPath('teamName')}.pathOrConstantText`],
      'a broken path must be refused under the path',
    ).toBe('O caminho "equipe[0" abre um colchete e não fecha.');
    expect(
      messages[`${rowPath('sessionId')}.pathOrConstantText`],
      'a list is not a fixed value, and the reason must be in pt-BR',
    ).toBe('Um valor fixo precisa ser um texto, um número, true ou false.');
    expect(
      messages[`${rowPath('status')}.transformId`],
      'an empty value table must be refused under the transform',
    ).toBeDefined();
  });

  it('puts a mapping that reads a request nobody named under its request', () => {
    // Arrange: a session block reading "direcao_de_prova", which is not a request here.
    const session = buildEmptyMappingFormValues('session', 'direcao_de_prova');

    // Act: read the form.
    const reading = readFlexConfigFormValues(buildFormWithOneRequestAndMappings([session]));

    // Assert: the message under the mapping's request.
    expect(
      reading.isValid ? undefined : reading.errorMessageByFieldPath['mappings.0.requestId'],
      'the mapping must say which request is missing',
    ).toBe('Sessão lê a requisição "direcao_de_prova", que não existe nesta fonte.');
  });

  it('lists a problem with no field of its own, nothing mapped, in the general list', () => {
    // Arrange: one request and no mapping at all.
    const values = buildFormWithOneRequestAndMappings([]);

    // Act: read the form.
    const reading = readFlexConfigFormValues(values);

    // Assert: no field message, one general problem.
    expect(
      reading.isValid ? undefined : reading.generalProblems,
      'a source that maps nothing must say so above the buttons',
    ).toEqual(['Mapeie pelo menos um formato: Sessão, Posições ou Pontuação.']);
  });
});
