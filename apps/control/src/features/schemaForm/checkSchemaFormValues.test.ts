/**
 * Checking what a generated form holds (apps/control)
 *
 * What this module is for:
 *   Before a generated form sends anything, every field is checked: what was typed is
 *   read as data, blanks are judged, and the manifest's limits are applied.
 *   checkSchemaFormValues answers one pt-BR message per wrong field, or every field as
 *   data. buildSchemaFormResolver hands that answer to react-hook-form.
 *
 * What these tests prove:
 *   - A correct form passes and each field comes back as a value, "cleared" or "filled
 *     by the server at the take".
 *   - A number, an mm:ss time or a date that cannot be read gets a message that names
 *     the field; so does a value outside the manifest's limits.
 *   - A required field left blank is refused, a required text included; an optional
 *     field left blank or cleared is accepted as cleared.
 *   - A field set to "filled by the server" is not checked, even though it is required
 *     and what is typed underneath is wrong.
 *   - Every wrong field is reported at once, each with one message.
 *   - The resolver gives react-hook-form the messages under `values.<key>`.
 *
 * What these tests deliberately do not cover:
 *   - Each rule of the manifest one by one: zodSchemaFromDataSchema.test.ts.
 *   - The message appearing under the control: SchemaFormFieldsEditing.test.tsx.
 *   - The server's own check, which stays the authority.
 */
import raceClockManifest from '@bajaovrlay/race-clock/race-clock.ograf.json';
import { describe, expect, it } from 'vitest';

import { buildEmptySchemaFormValues } from './buildSchemaFormValues';
import { checkSchemaFormValues } from './checkSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import {
  buildLowerThirdFormValuesForCar42,
  describeLowerThirdFixtureForm,
} from './lowerThirdFixtureSchema.testSupport';
import { buildSchemaFormResolver } from './schemaFormResolver';

describe('checkSchemaFormValues, on a correct form', () => {
  it('answers every editable field of the lower third as data', () => {
    // Arrange: the form filled from car 42's data, with "cargo" cleared by the operator.
    const description = describeLowerThirdFixtureForm();
    const formValues = buildLowerThirdFormValuesForCar42();
    formValues.values.cargo = null;

    // Act: check it.
    const check = checkSchemaFormValues(description, formValues);

    // Assert: valid, with typed text turned into data and the cleared field marked.
    expect(check, 'a correct form must pass with its fields as data').toEqual({
      status: 'valid',
      checkedFields: [
        { key: 'nome', outcome: 'value', value: 'Ana Souza' },
        { key: 'cargo', outcome: 'cleared' },
        { key: 'equipe', outcome: 'value', value: 'baja-ufpr' },
        { key: 'horario', outcome: 'value', value: '2026-10-10T12:45:00.000Z' },
        { key: 'duracaoMs', outcome: 'value', value: 8_000 },
        { key: 'destaque', outcome: 'value', value: true },
        { key: 'numeroDoCarro', outcome: 'value', value: 42 },
        { key: 'pesoDoCarroKg', outcome: 'value', value: 182.5 },
      ],
    });
  });

  it('passes the race clock as it opens, with its reference moment left to the server', () => {
    // Arrange: the real race clock's form, untouched.
    const description = describeSchemaFormFromDataSchema(raceClockManifest.schema);
    const formValues = buildEmptySchemaFormValues(description);

    // Act: check it.
    const check = checkSchemaFormValues(description, formValues);

    // Assert: the form opens in a state that can be taken.
    expect(check.status, 'the manifest defaults must be valid').toBe('valid');
    expect(
      check.status === 'valid' ? check.checkedFields : [],
      'the reference moment is the server’s to fill, blank laps are cleared, the band switch is on',
    ).toEqual([
      { key: 'sessionName', outcome: 'value', value: 'Enduro de Resistência' },
      { key: 'state', outcome: 'value', value: 'pre' },
      { key: 'clockMode', outcome: 'value', value: 'elapsed' },
      { key: 'referenceTimeMs', outcome: 'value', value: 0 },
      { key: 'referenceWallClockMs', outcome: 'takeTime' },
      { key: 'running', outcome: 'value', value: false },
      { key: 'lapsCompletedByLeader', outcome: 'cleared' },
      { key: 'showFlagBand', outcome: 'value', value: true },
    ]);
  });

  it('does not check a field that is filled by the server, whatever is typed underneath', () => {
    // Arrange: the race clock's form with nonsense typed as the reference moment, then
    // switched back to "filled by the server".
    const description = describeSchemaFormFromDataSchema(raceClockManifest.schema);
    const formValues = buildEmptySchemaFormValues(description);
    formValues.values.referenceWallClockMs = 'agora';
    formValues.kinds.referenceWallClockMs = 'takeTime';

    // Act: check it.
    const check = checkSchemaFormValues(description, formValues);

    // Assert: the typed text is not sent, so it is not judged.
    expect(check.status, 'a field the server fills has nothing to check').toBe('valid');
  });
});

describe('checkSchemaFormValues, on a form with mistakes', () => {
  const mistakesAndTheirMessages = [
    // The blank rule: a required text left empty counts as missing.
    {
      name: 'an empty required name',
      key: 'nome',
      formValue: '',
      message: 'O campo "Nome" é obrigatório.',
    },
    // Only spaces are blank as well.
    {
      name: 'a required name of spaces only',
      key: 'nome',
      formValue: '   ',
      message: 'O campo "Nome" é obrigatório.',
    },
    // A required dropdown with nothing chosen.
    {
      name: 'a required team with nothing chosen',
      key: 'equipe',
      formValue: null,
      message: 'O campo "Equipe" é obrigatório.',
    },
    // A required number left empty.
    {
      name: 'an empty required car number',
      key: 'numeroDoCarro',
      formValue: '',
      message: 'O campo "Número do carro" é obrigatório.',
    },
    // Typed text that is not a number at all.
    {
      name: 'words as the car number',
      key: 'numeroDoCarro',
      formValue: 'quarenta e dois',
      message: 'O campo "Número do carro" precisa ser um número.',
    },
    // A number, but not a whole one: read first, refused by the manifest's rule.
    {
      name: 'a decimal car number',
      key: 'numeroDoCarro',
      formValue: '42,5',
      message: 'O campo "Número do carro" precisa ser um número inteiro.',
    },
    // A number over the manifest's maximum.
    {
      name: 'car number 1000',
      key: 'numeroDoCarro',
      formValue: '1000',
      message: 'O campo "Número do carro" não pode ser maior que 999.',
    },
    // Typed text that is not mm:ss.
    {
      name: 'a time on air typed as 0:8',
      key: 'duracaoMs',
      formValue: '0:8',
      message: 'Use minutos e segundos no formato mm:ss em "Tempo no ar", por exemplo 12:30.',
    },
    // A good mm:ss under the manifest's minimum of 3 seconds.
    {
      name: 'a time on air of 0:02',
      key: 'duracaoMs',
      formValue: '0:02',
      message: 'O campo "Tempo no ar" não pode ser menor que 0:03.',
    },
    // Typed text that is not a date.
    {
      name: 'an interview time that is not a date',
      key: 'horario',
      formValue: 'sábado de manhã',
      message: 'O campo "Horário da entrevista" precisa de uma data e hora válidas.',
    },
    // A name under the manifest's minimum length.
    {
      name: 'a one-letter name',
      key: 'nome',
      formValue: 'A',
      message: 'O campo "Nome" precisa ter pelo menos 2 caracteres.',
    },
  ];

  it.each(mistakesAndTheirMessages)('refuses $name', ({ key, formValue, message }) => {
    // Arrange: car 42's form with the one mistake of this scenario.
    const description = describeLowerThirdFixtureForm();
    const formValues = buildLowerThirdFormValuesForCar42();
    formValues.values[key] = formValue;

    // Act: check it.
    const check = checkSchemaFormValues(description, formValues);

    // Assert: that field alone has a message, in pt-BR, naming it by its label.
    expect(check, 'the wrong field must get its message').toEqual({
      status: 'invalid',
      fieldMessages: [{ fieldKey: key, message }],
    });
  });

  it('reports every wrong field at once, each with one message', () => {
    // Arrange: car 42's form with an empty name, a time that is not mm:ss and car number 0.
    const description = describeLowerThirdFixtureForm();
    const formValues = buildLowerThirdFormValuesForCar42();
    formValues.values.nome = '';
    formValues.values.duracaoMs = 'oito segundos';
    formValues.values.numeroDoCarro = '0';

    // Act: check it.
    const check = checkSchemaFormValues(description, formValues);

    // Assert: three fields, three messages; the operator fixes them in one go.
    const keysWithMessages =
      check.status === 'invalid' ? check.fieldMessages.map((entry) => entry.fieldKey) : [];
    expect(keysWithMessages, 'every wrong field must be reported, once').toEqual([
      'nome',
      'duracaoMs',
      'numeroDoCarro',
    ]);
  });

  it('checks a wall-clock field like any number once the operator types it', () => {
    // Arrange: the race clock's form with the reference moment switched to "typed" and
    // left with words in it.
    const description = describeSchemaFormFromDataSchema(raceClockManifest.schema);
    const formValues = buildEmptySchemaFormValues(description);
    formValues.kinds.referenceWallClockMs = 'literal';
    formValues.values.referenceWallClockMs = 'agora';

    // Act: check it.
    const check = checkSchemaFormValues(description, formValues);

    // Assert: a typed field is the operator's responsibility.
    expect(check.status, 'a typed reference moment must be a number').toBe('invalid');
    expect(
      check.status === 'invalid' ? check.fieldMessages.map((entry) => entry.fieldKey) : [],
      'the message belongs to the reference moment',
    ).toEqual(['referenceWallClockMs']);
  });
});

describe('buildSchemaFormResolver', () => {
  it('hands react-hook-form the same values back when the form is correct', () => {
    // Arrange: car 42's form, correct, and the resolver for the lower third.
    const resolveSchemaForm = buildSchemaFormResolver(describeLowerThirdFixtureForm());
    const formValues = buildLowerThirdFormValuesForCar42();

    // Act: resolve it, as react-hook-form does at a press.
    const resolution = resolveSchemaForm(formValues);

    // Assert: no messages, and the values are the form's own, untouched.
    expect(resolution.errors, 'a correct form has no messages').toEqual({});
    expect(resolution.values, 'the values must come back as they went in').toBe(formValues);
  });

  it('puts each message under values.<key>, where the form looks for it', () => {
    // Arrange: car 42's form with an empty name and car number 0.
    const resolveSchemaForm = buildSchemaFormResolver(describeLowerThirdFixtureForm());
    const formValues = buildLowerThirdFormValuesForCar42();
    formValues.values.nome = '';
    formValues.values.numeroDoCarro = '0';

    // Act: resolve it.
    const resolution = resolveSchemaForm(formValues);

    // Assert: react-hook-form gets one message per wrong field and no values to submit.
    expect(resolution.errors, 'each wrong field must carry its pt-BR message').toEqual({
      values: {
        nome: { type: 'validation', message: 'O campo "Nome" é obrigatório.' },
        numeroDoCarro: {
          type: 'validation',
          message: 'O campo "Número do carro" não pode ser menor que 1.',
        },
      },
    });
    expect(resolution.values, 'a wrong form submits nothing').toEqual({});
  });
});
