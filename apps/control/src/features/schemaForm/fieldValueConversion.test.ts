/**
 * One field's value, between data and control (apps/control)
 *
 * What this module is for:
 *   A graphic's data holds numbers of milliseconds, ISO 8601 texts and true/false; the
 *   operator types "12:34", picks a date in the browser's own input, flips a switch.
 *   fieldValueConversion goes both ways for one field: it shows a data value in the
 *   field's control, and reads what the control holds back into data.
 *
 * What these tests prove:
 *   - Each control shows the data it is meant for, and answers "cannot be shown" for
 *     data of another kind, so the form can fall back instead of showing nonsense.
 *   - What a control holds is read back as data; nothing typed, only spaces and a
 *     cleared field are all "blank".
 *   - A number, an mm:ss time or a date that cannot be read is reported with its reason.
 *   - An mm:ss time and a date survive the round trip data → control → data.
 *
 * What these tests deliberately do not cover:
 *   - Limits (minimum, maximum, lengths) and "required": checkSchemaFormValues.test.ts
 *     and zodSchemaFromDataSchema.test.ts.
 *   - Every mm:ss and date shape: minutesAndSeconds.test.ts and
 *     localDateAndTimeText.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { convertDataValueIntoFormValue, readDataValueFromFormValue } from './fieldValueConversion';
import { describeLowerThirdFixtureForm } from './lowerThirdFixtureSchema.testSupport';
import type { SchemaFormFieldDescription } from './schemaFormDescription';

/** The description of one field of the lower third fixture, by its key. */
function describeLowerThirdField(key: string): SchemaFormFieldDescription {
  const field = describeLowerThirdFixtureForm().fields.find((candidate) => candidate.key === key);
  if (field === undefined) {
    throw new Error(`The lower third fixture has no field "${key}"`);
  }
  return field;
}

describe('convertDataValueIntoFormValue', () => {
  const dataValuesTheControlsShow = [
    // Text is shown as it is.
    { name: 'shows a name as typed', key: 'nome', dataValue: 'Ana Souza', formValue: 'Ana Souza' },
    // A dropdown holds the option's value, not its label.
    {
      name: 'shows a team as its option value',
      key: 'equipe',
      dataValue: 'poli-usp',
      formValue: 'poli-usp',
    },
    // Eight seconds on air read 0:08 to the operator.
    { name: 'shows 8 000 ms as 0:08', key: 'duracaoMs', dataValue: 8_000, formValue: '0:08' },
    // A switch holds true or false.
    { name: 'shows the highlight as on', key: 'destaque', dataValue: true, formValue: true },
    // A whole number becomes the digits in the input.
    { name: 'shows car number 42 as "42"', key: 'numeroDoCarro', dataValue: 42, formValue: '42' },
    // A decimal keeps its decimal point, which is what a number input expects.
    {
      name: 'shows 182.5 kg as "182.5"',
      key: 'pesoDoCarroKg',
      dataValue: 182.5,
      formValue: '182.5',
    },
  ];

  it.each(dataValuesTheControlsShow)('$name', ({ key, dataValue, formValue }) => {
    // Arrange: the field of this scenario.
    const field = describeLowerThirdField(key);

    // Act: show the data value in its control.
    const valueShown = convertDataValueIntoFormValue(field, dataValue);

    // Assert: the control holds what the operator expects to read.
    expect(valueShown, `${key} must be shown as ${String(formValue)}`).toEqual({
      status: 'shown',
      formValue,
    });
  });

  const dataValuesTheControlsCannotShow = [
    // A number where the name belongs (a script wrote the wrong type).
    { name: 'a number in a text field', key: 'nome', dataValue: 42 },
    // A team the dropdown does not offer.
    { name: 'a team that is not an option', key: 'equipe', dataValue: 'equipe-desconhecida' },
    // Text where milliseconds belong.
    { name: 'a text in a duration field', key: 'duracaoMs', dataValue: '0:08' },
    // An mm:ss field has three digits of minutes: 1000 minutes do not fit.
    { name: 'a duration past 999:59', key: 'duracaoMs', dataValue: 60_000_000 },
    // A clock never shows negative time.
    { name: 'a negative duration', key: 'duracaoMs', dataValue: -1_000 },
    // "sim" is not true.
    { name: 'a text in a switch', key: 'destaque', dataValue: 'sim' },
    // The manifest says integer; 42.5 is not a car number.
    { name: 'a decimal in a whole-number field', key: 'numeroDoCarro', dataValue: 42.5 },
    // A date written for people, not ISO 8601.
    { name: 'a date that is not ISO 8601', key: 'horario', dataValue: '10/10/2026 09:45' },
    // No value at all (the manifest gave no default).
    { name: 'a missing value', key: 'nome', dataValue: undefined },
    // A list is never shown in a control.
    {
      name: 'the value of an unsupported field',
      key: 'patrocinadores',
      dataValue: ['Oficina do Zé'],
    },
  ];

  it.each(dataValuesTheControlsCannotShow)('cannot show $name', ({ key, dataValue }) => {
    // Arrange: the field of this scenario.
    const field = describeLowerThirdField(key);

    // Act: try to show the data value in its control.
    const valueShown = convertDataValueIntoFormValue(field, dataValue);

    // Assert: the answer is "cannot", so the caller falls back to the starting value.
    expect(valueShown, 'the control must not show a value it cannot edit').toEqual({
      status: 'cannotBeShown',
    });
  });
});

describe('readDataValueFromFormValue', () => {
  const formValuesThatAreData = [
    // Spaces around a name come from copy and paste and are not sent.
    {
      name: 'reads a name without the spaces around it',
      key: 'nome',
      formValue: '  Ana Souza ',
      dataValue: 'Ana Souza',
    },
    // The dropdown's value is the data.
    { name: 'reads the chosen team', key: 'equipe', formValue: 'fei-baja', dataValue: 'fei-baja' },
    // mm:ss becomes milliseconds.
    { name: 'reads 0:15 as 15 000 ms', key: 'duracaoMs', formValue: '0:15', dataValue: 15_000 },
    // A switch that is off is a value (false), not a blank.
    {
      name: 'reads a switch that is off as false',
      key: 'destaque',
      formValue: false,
      dataValue: false,
    },
    // Digits become a number.
    { name: 'reads "42" as the number 42', key: 'numeroDoCarro', formValue: '42', dataValue: 42 },
    // A number input hands a decimal over with a point.
    { name: 'reads "182.5" as 182.5', key: 'pesoDoCarroKg', formValue: '182.5', dataValue: 182.5 },
    // In Brazil a decimal is typed with a comma.
    {
      name: 'reads "182,5" as 182.5 too',
      key: 'pesoDoCarroKg',
      formValue: '182,5',
      dataValue: 182.5,
    },
    // A decimal typed where a whole number belongs is still a number; the rule refuses it later.
    {
      name: 'reads "42.5" as 42.5 even in a whole-number field',
      key: 'numeroDoCarro',
      formValue: '42.5',
      dataValue: 42.5,
    },
  ];

  it.each(formValuesThatAreData)('$name', ({ key, formValue, dataValue }) => {
    // Arrange: the field of this scenario.
    const field = describeLowerThirdField(key);

    // Act: read what its control holds.
    const dataValueRead = readDataValueFromFormValue(field, formValue);

    // Assert: it is the data the graphic receives.
    expect(dataValueRead, `${key} must be read as ${String(dataValue)}`).toEqual({
      status: 'value',
      value: dataValue,
    });
  });

  const formValuesThatAreBlank = [
    // Cleared with "limpar".
    { name: 'a cleared field', key: 'cargo', formValue: null },
    // Nothing typed.
    { name: 'an empty text', key: 'nome', formValue: '' },
    // Only spaces are nothing too.
    { name: 'a text of spaces only', key: 'nome', formValue: '   ' },
    // A dropdown with nothing chosen.
    { name: 'a dropdown with nothing chosen', key: 'equipe', formValue: null },
    // A field the form's values do not have at all.
    { name: 'a field with no entry in the form', key: 'numeroDoCarro', formValue: undefined },
  ];

  it.each(formValuesThatAreBlank)('reads $name as blank', ({ key, formValue }) => {
    // Arrange: the field of this scenario.
    const field = describeLowerThirdField(key);

    // Act: read what its control holds.
    const dataValueRead = readDataValueFromFormValue(field, formValue);

    // Assert: there is no value; whether that is allowed is decided elsewhere.
    expect(dataValueRead, 'nothing typed must be read as blank').toEqual({ status: 'blank' });
  });

  const formValuesThatCannotBeRead = [
    // Words are not a number.
    {
      name: 'words in a number field',
      key: 'numeroDoCarro',
      formValue: 'quarenta e dois',
      problem: 'notANumber',
    },
    // An exponent is how a calculator writes, not an operator.
    {
      name: '"1e3" in a number field',
      key: 'numeroDoCarro',
      formValue: '1e3',
      problem: 'notANumber',
    },
    // Seconds need two digits.
    {
      name: '"0:8" in a duration field',
      key: 'duracaoMs',
      formValue: '0:8',
      problem: 'notMinutesAndSeconds',
    },
    // A bare number does not say whether it means minutes or seconds.
    {
      name: '"15" in a duration field',
      key: 'duracaoMs',
      formValue: '15',
      problem: 'notMinutesAndSeconds',
    },
    // A date typed by hand in the Brazilian order, which the browser's input never hands over.
    {
      name: '"10/10/2026 09:45" in a date field',
      key: 'horario',
      formValue: '10/10/2026 09:45',
      problem: 'notADateAndTime',
    },
  ];

  it.each(formValuesThatCannotBeRead)('cannot read $name', ({ key, formValue, problem }) => {
    // Arrange: the field of this scenario.
    const field = describeLowerThirdField(key);

    // Act: read what its control holds.
    const dataValueRead = readDataValueFromFormValue(field, formValue);

    // Assert: the reason is named, so the form can say it under the field.
    expect(dataValueRead, `the problem must be reported as ${problem}`).toEqual({
      status: 'unreadable',
      problem,
    });
  });
});

describe('the round trip from data to control and back', () => {
  it('brings an mm:ss time back as the same milliseconds', () => {
    // Arrange: 12 minutes 34 seconds, as a graphic's data holds it.
    const field = describeLowerThirdField('duracaoMs');
    const durationInMilliseconds = 754_000;

    // Act: show it in the mm:ss field, then read the field again.
    const valueShown = convertDataValueIntoFormValue(field, durationInMilliseconds);
    const textInTheField = valueShown.status === 'shown' ? valueShown.formValue : null;
    const dataValueRead = readDataValueFromFormValue(field, textInTheField);

    // Assert: the operator saw 12:34 and nothing was lost on the way.
    expect(textInTheField, 'the field must show 12:34').toBe('12:34');
    expect(dataValueRead, 'the same milliseconds must come back').toEqual({
      status: 'value',
      value: 754_000,
    });
  });

  it('brings a date and time back as the same moment', () => {
    // Arrange: 12:45 UTC on the Saturday of the endurance race.
    const field = describeLowerThirdField('horario');
    const momentAsIsoText = '2026-10-10T12:45:00.000Z';

    // Act: show it in the date and time input, then read the input again.
    const valueShown = convertDataValueIntoFormValue(field, momentAsIsoText);
    const textInTheInput = valueShown.status === 'shown' ? valueShown.formValue : null;
    const dataValueRead = readDataValueFromFormValue(field, textInTheInput);

    // Assert: whatever this computer's time zone, the moment is unchanged.
    expect(dataValueRead, 'the same moment must come back as ISO 8601 text').toEqual({
      status: 'value',
      value: '2026-10-10T12:45:00.000Z',
    });
  });
});
