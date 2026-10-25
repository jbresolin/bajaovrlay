/**
 * Filling a generated form: empty, and from what is on air (apps/control)
 *
 * What this module is for:
 *   A generated form opens in one of three ways: empty (a new item, or a graphic that is
 *   not on air), showing what an instance on air holds, or showing what an item stores.
 *   buildSchemaFormValues builds the form's values for each, and lists the fields it
 *   could not show so the panel can warn the operator. This file covers the first two.
 *
 * What these tests prove:
 *   - An empty form starts from the manifest's defaults; a field without one starts
 *     empty when required and cleared when optional; a wall-clock field starts as
 *     "filled by the server at the take".
 *   - From on-air data every field shown is a typed value, a missing optional field is
 *     cleared, and a value the control cannot show falls back and is listed.
 *   - An optional text that is empty or only spaces on air, or empty as the manifest's
 *     default, is cleared.
 *   - A wall-clock field that is missing or unreadable on air starts as "filled by the
 *     server at the take", as in an empty form, and is listed.
 *   - Values of properties the form cannot edit are kept as JSON text, only when they
 *     exist, also when the property is named `__proto__`; so is a key on air that the
 *     schema does not declare.
 *
 * What these tests deliberately do not cover:
 *   - A form filled from a stored item: buildSchemaFormValuesFromItemFields.test.ts.
 *   - How one value is shown in its control: fieldValueConversion.test.ts.
 *   - What the filled form sends back: instanceUpdateFromSchemaForm.test.ts,
 *     instanceUpdateFromSchemaForm.test.ts and itemFieldsFromSchemaForm.test.ts.
 */
import raceClockManifest from '@bajaovrlay/race-clock/race-clock.ograf.json';
import { describe, expect, it } from 'vitest';

import {
  buildEmptySchemaFormValues,
  buildSchemaFormValuesFromDataOnAir,
} from './buildSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import {
  buildLowerThirdDataForCar42,
  describeLowerThirdFixtureForm,
} from './lowerThirdFixtureSchema.testSupport';

/** The real race clock's schema as the form reads it. */
function describeRaceClockForm() {
  return describeSchemaFormFromDataSchema(raceClockManifest.schema);
}

describe('buildEmptySchemaFormValues', () => {
  it('starts the lower third from its defaults, empty where required and cleared where optional', () => {
    // Arrange: the lower third's form description.
    const description = describeLowerThirdFixtureForm();

    // Act: build the values of a form nobody filled.
    const formValues = buildEmptySchemaFormValues(description);

    // Assert: defaults where the manifest gives them, and honest blanks elsewhere.
    expect(formValues.values, 'each field must start as the manifest says').toEqual({
      // Required text with no default: empty, for the operator to fill.
      nome: '',
      // Optional with no default: cleared.
      cargo: null,
      // The manifest's default team.
      equipe: 'baja-ufpr',
      horario: null,
      // The default of 8 000 ms, shown as mm:ss.
      duracaoMs: '0:08',
      destaque: false,
      // Required number with no default: empty.
      numeroDoCarro: '',
      pesoDoCarroKg: null,
    });
    expect(
      Object.values(formValues.kinds),
      'no field of the lower third is filled by the server',
    ).toEqual(Array(8).fill('literal'));
    expect(
      formValues.unsupportedValuesAsJson,
      'nothing is invented for the properties the form cannot edit',
    ).toEqual([]);
  });

  it('starts the race clock with its defaults and the reference moment filled at the take', () => {
    // Arrange: the real race clock manifest.
    const description = describeRaceClockForm();

    // Act: build the values of a form nobody filled.
    const formValues = buildEmptySchemaFormValues(description);

    // Assert: what the hand-written form opened with, plus the reference moment.
    expect(formValues.values, 'the race clock must open with the manifest defaults').toEqual({
      sessionName: 'Enduro de Resistência',
      state: 'pre',
      clockMode: 'elapsed',
      referenceTimeMs: '0:00',
      referenceWallClockMs: '0',
      running: false,
      lapsCompletedByLeader: null,
      // The band switch is on by default (the manifest's `default: true`).
      showFlagBand: true,
    });
    expect(
      formValues.kinds.referenceWallClockMs,
      'a new clock must count from the take (gate 2 of BAJAOVRLAY-13)',
    ).toBe('takeTime');
    expect(formValues.kinds.referenceTimeMs, 'every other field is typed').toBe('literal');
  });

  it('starts an optional text whose default is the empty text as cleared', () => {
    // Arrange: an optional nickname whose manifest wrote `default: ""`.
    const description = describeSchemaFormFromDataSchema({
      type: 'object',
      properties: { apelido: { type: 'string', title: 'Apelido', default: '' } },
    });

    // Act: build the empty form.
    const formValues = buildEmptySchemaFormValues(description);

    // Assert: an empty optional text has no value, so the form holds null from the start.
    expect(formValues.values.apelido, 'an empty default must start as cleared').toBeNull();
  });

  it('ignores a default the control cannot show', () => {
    // Arrange: a required laps count whose default was written as text by mistake.
    const description = describeSchemaFormFromDataSchema({
      type: 'object',
      properties: { voltas: { type: 'integer', title: 'Voltas', default: 'sete' } },
      required: ['voltas'],
    });

    // Act: build the empty form.
    const formValues = buildEmptySchemaFormValues(description);

    // Assert: the field starts empty instead of showing a text in a number input.
    expect(formValues.values.voltas, 'a default of the wrong type must be ignored').toBe('');
  });
});

describe('buildSchemaFormValuesFromDataOnAir', () => {
  it('shows what is on air, keeping the uneditable values as JSON text', () => {
    // Arrange: the lower third of car 42 on air, with every property filled.
    const description = describeLowerThirdFixtureForm();
    const dataOnAir = buildLowerThirdDataForCar42();

    // Act: fill the form from it.
    const formRead = buildSchemaFormValuesFromDataOnAir(description, dataOnAir);

    // Assert: each control holds the on-air value, and nothing had to fall back.
    expect(formRead.formValues.values, 'the form must show what is on air').toMatchObject({
      nome: 'Ana Souza',
      cargo: 'Capitã',
      equipe: 'baja-ufpr',
      duracaoMs: '0:08',
      destaque: true,
      numeroDoCarro: '42',
      pesoDoCarroKg: '182.5',
    });
    expect(
      formRead.formValues.unsupportedValuesAsJson,
      'the list and the nested object must be kept exactly, as JSON text',
    ).toEqual([
      {
        key: 'patrocinadores',
        jsonText:
          '[\n  {\n    "nome": "Oficina do Zé"\n  },\n  {\n    "nome": "Autopeças Curitiba"\n  }\n]',
      },
      { key: 'redesSociais', jsonText: '{\n  "instagram": "@bajaufpr"\n}' },
    ]);
    expect(formRead.labelsOfFieldsThatCouldNotBeRead, 'every field could be shown').toEqual([]);
  });

  it('shows the reference moment of a clock on air as the number that is on air', () => {
    // Arrange: the first heat on air since 9:45 in Brasília, running from 12:34.
    const description = describeRaceClockForm();
    const momentTheClockWentOnAir = Date.parse('2026-10-10T12:45:00.000Z');
    const dataOnAir = {
      sessionName: 'Enduro de Resistência — Bateria 1',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 754_000,
      referenceWallClockMs: momentTheClockWentOnAir,
      running: true,
    };

    // Act: fill the form from it.
    const formRead = buildSchemaFormValuesFromDataOnAir(description, dataOnAir);

    // Assert: the moment is a typed number, and the missing laps are simply cleared.
    expect(
      formRead.formValues.kinds.referenceWallClockMs,
      'what is on air is a number, not "filled at the take"',
    ).toBe('literal');
    expect(formRead.formValues.values.referenceWallClockMs, 'the number on air must be shown').toBe(
      String(momentTheClockWentOnAir),
    );
    expect(formRead.formValues.values.referenceTimeMs, 'the time must read 12:34').toBe('12:34');
    expect(
      formRead.formValues.values.lapsCompletedByLeader,
      'laps that are not on air are a cleared field',
    ).toBeNull();
    expect(
      formRead.labelsOfFieldsThatCouldNotBeRead,
      'missing optional laps are normal and not reported',
    ).toEqual([]);
  });

  it('falls back to the starting value, and says so, for what it cannot show', () => {
    // Arrange: on-air data with a team that is not an option, a car number written as
    // text, and no name at all (as a script might have sent it).
    const description = describeLowerThirdFixtureForm();
    const dataOnAir = buildLowerThirdDataForCar42();
    delete dataOnAir.nome;
    dataOnAir.equipe = 'equipe-desconhecida';
    dataOnAir.numeroDoCarro = 'quarenta e dois';

    // Act: fill the form from it.
    const formRead = buildSchemaFormValuesFromDataOnAir(description, dataOnAir);

    // Assert: the three fields show their starting values and are named, in form order.
    expect(formRead.formValues.values.nome, 'a missing required name starts empty').toBe('');
    expect(formRead.formValues.values.equipe, 'an unknown team falls back to the default').toBe(
      'baja-ufpr',
    );
    expect(formRead.formValues.values.numeroDoCarro, 'an unreadable number starts empty').toBe('');
    expect(
      formRead.labelsOfFieldsThatCouldNotBeRead,
      'the panel must be able to name the fields that fell back',
    ).toEqual(['Nome', 'Equipe', 'Número do carro']);
  });

  it('keeps every key of the data when the whole schema is unsupported', () => {
    // Arrange: a ticker whose data is described as a oneOf, and two keys on air.
    const description = describeSchemaFormFromDataSchema({ oneOf: [{ type: 'object' }] });
    const dataOnAir = { texto: 'Largada às 10h', velocidade: 2 };

    // Act: fill the form from it.
    const formRead = buildSchemaFormValuesFromDataOnAir(description, dataOnAir);

    // Assert: both keys are kept as text, and there is no field to fall back.
    expect(
      formRead.formValues.unsupportedValuesAsJson,
      'all the data must be kept for the read-only box and the next take',
    ).toEqual([
      { key: 'texto', jsonText: '"Largada às 10h"' },
      { key: 'velocidade', jsonText: '2' },
    ]);
    expect(formRead.formValues.values, 'there are no editable fields').toEqual({});
  });

  it('keeps a key the schema does not declare, so the next take carries it', () => {
    // Arrange: a ticker whose schema declares only its text and does not forbid other
    // keys; another client put it on air with a speed as well.
    const description = describeSchemaFormFromDataSchema({
      type: 'object',
      properties: { texto: { type: 'string', title: 'Texto' } },
      required: ['texto'],
    });
    const dataOnAir = { texto: 'Largada às 10h', velocidade: 2 };

    // Act: fill the form from it.
    const formRead = buildSchemaFormValuesFromDataOnAir(description, dataOnAir);

    // Assert: the speed is kept as text beside the form; it is neither a field nor a problem.
    expect(formRead.formValues.values, 'only the declared text is a field').toEqual({
      texto: 'Largada às 10h',
    });
    expect(
      formRead.formValues.unsupportedValuesAsJson,
      'data on air the schema does not declare must not be lost',
    ).toEqual([{ key: 'velocidade', jsonText: '2' }]);
    expect(
      formRead.labelsOfFieldsThatCouldNotBeRead,
      'an undeclared key is not a field that fell back',
    ).toEqual([]);
  });

  const blankTextsOnAir = [
    // The empty text: what a script sends for "no job title".
    { name: 'empty', cargoOnAir: '' },
    // Spaces alone are sent as nothing by the form, so they must not look like a value.
    { name: 'only spaces', cargoOnAir: '   ' },
  ];

  it.each(blankTextsOnAir)(
    'reads an optional text that is $name on air as a cleared field',
    ({ cargoOnAir }) => {
      // Arrange: car 42's lower third, put on air by a script with a blank "cargo".
      const description = describeLowerThirdFixtureForm();
      const dataOnAir = { ...buildLowerThirdDataForCar42(), cargo: cargoOnAir };

      // Act: fill the form from it.
      const formRead = buildSchemaFormValuesFromDataOnAir(description, dataOnAir);

      // Assert: blank and cleared are one state, so the form holds null, as it would
      // after the operator emptied the field; nothing fell back.
      expect(
        formRead.formValues.values.cargo,
        'a blank optional text must be held as cleared',
      ).toBeNull();
      expect(formRead.labelsOfFieldsThatCouldNotBeRead, 'a blank text is not a problem').toEqual(
        [],
      );
    },
  );

  const referenceMomentsOnAirThatCannotBeRead = [
    // A script took the clock without the moment the time counts from.
    { name: 'missing', referenceMomentOnAir: undefined },
    // The moment was written as a date text, where the graphic expects milliseconds.
    { name: 'a date written as text', referenceMomentOnAir: '2026-10-10T12:45:00.000Z' },
  ];

  it.each(referenceMomentsOnAirThatCannotBeRead)(
    'starts a reference moment that is $name on air as "filled by the server", and lists it',
    ({ referenceMomentOnAir }) => {
      // Arrange: the first heat on air, with a reference moment the form cannot show.
      const description = describeRaceClockForm();
      const dataOnAir: Record<string, unknown> = {
        sessionName: 'Enduro de Resistência — Bateria 1',
        state: 'green',
        clockMode: 'elapsed',
        referenceTimeMs: 754_000,
        running: true,
      };
      if (referenceMomentOnAir !== undefined) {
        dataOnAir.referenceWallClockMs = referenceMomentOnAir;
      }

      // Act: fill the form from it.
      const formRead = buildSchemaFormValuesFromDataOnAir(description, dataOnAir);

      // Assert: the field starts as in an empty form, so the form never offers the default
      // 0 (1 January 1970) as a moment, from which a running clock would count more than
      // fifty years; a field left so is filled by the server.
      expect(
        formRead.formValues.kinds.referenceWallClockMs,
        'a reference moment that cannot be read must start as in an empty form',
      ).toBe('takeTime');
      expect(
        formRead.labelsOfFieldsThatCouldNotBeRead,
        'the operator must be told the field does not show what is on air',
      ).toEqual([raceClockManifest.schema.properties.referenceWallClockMs.title]);
    },
  );

  it('keeps the value of a property named __proto__', () => {
    // Arrange: a schema and data as JSON text, because only JSON.parse makes
    // `__proto__` a real key.
    const description = describeSchemaFormFromDataSchema(
      JSON.parse('{ "type": "object", "properties": { "__proto__": { "type": "string" } } }'),
    );
    const dataOnAir: unknown = JSON.parse('{ "__proto__": "Baja UFPR" }');

    // Act: fill the form from it.
    const formRead = buildSchemaFormValuesFromDataOnAir(description, dataOnAir);

    // Assert: the value is kept as text under its own key.
    expect(
      formRead.formValues.unsupportedValuesAsJson,
      'a key that JavaScript treats specially must still be kept',
    ).toEqual([{ key: '__proto__', jsonText: '"Baja UFPR"' }]);
  });
});
