/**
 * A moment in milliseconds typed as a date and time (apps/control)
 *
 * What this module is for:
 *   The countdown and the intermission count down to a session's start, `startsAtMs`: an
 *   absolute moment as a whole number of milliseconds since 1970, which is also what a
 *   schedule slot of Cadastros gives (BAJAOVRLAY-46). Typed by hand, the operator should not
 *   type thirteen digits: a manifest marks such a field `v_baja.unit: "epochMs"`, and the
 *   generated form shows the browser's date-and-time input, read back as milliseconds.
 *
 * What these tests prove:
 *   - An integer field with `v_baja.unit: "epochMs"` gets the date-and-time control, and
 *     stays a whole number.
 *   - 10:00 on 30 March 2025 (this computer's clock) is shown as "2025-03-30T10:00", and
 *     typed back gives the same milliseconds.
 *   - A text that is not a date is unreadable, with the date's reason.
 *   - The whole form, checked, sends the number, not ISO text.
 *
 * What these tests deliberately do not cover:
 *   - Every shape of date the input may hold; localDateAndTimeText.test.ts.
 *   - The countdown's own reading of the moment; packages/graphics/countdown.
 */
import { describe, expect, it } from 'vitest';

import { buildEmptySchemaFormValues } from './buildSchemaFormValues';
import { checkSchemaFormValues } from './checkSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import { convertDataValueIntoFormValue, readDataValueFromFormValue } from './fieldValueConversion';
import type { SchemaFormDescription, SchemaFormFieldDescription } from './schemaFormDescription';

/** The countdown's two fields, as its manifest declares them. */
function describeCountdownFixtureForm(): SchemaFormDescription {
  return describeSchemaFormFromDataSchema({
    type: 'object',
    properties: {
      sessionName: { type: 'string', title: 'Sessão', gddType: 'single-line' },
      startsAtMs: {
        type: 'integer',
        title: 'Largada',
        minimum: 0,
        v_baja: { unit: 'epochMs' },
      },
    },
    required: ['sessionName', 'startsAtMs'],
  });
}

/** The start field's description. */
function describeStartField(): SchemaFormFieldDescription {
  const field = describeCountdownFixtureForm().fields.find(
    (candidate) => candidate.key === 'startsAtMs',
  );
  if (field === undefined) {
    throw new Error('the fixture has a startsAtMs field');
  }
  return field;
}

/** 10:00 on Sunday 30 March 2025 on this computer's clock, in ms. */
const enduroStartsAtMs = new Date(2025, 2, 30, 10, 0).getTime();

describe('a moment in milliseconds', () => {
  it('gets the date-and-time control and stays a whole number', () => {
    // Arrange and act: describe the countdown's form.
    const field = describeStartField();

    // Assert: a date and time, read as a whole number.
    expect(field.control, 'the date-and-time input').toBe('dateTime');
    expect(field.isWholeNumber, 'still milliseconds, a whole number').toBe(true);
  });

  it('shows the moment as the date and time of this computer, and reads it back', () => {
    // Arrange: the start field.
    const field = describeStartField();

    // Act: show 10:00 on 30 March, then read the shown text back.
    const shown = convertDataValueIntoFormValue(field, enduroStartsAtMs);
    const readBack = readDataValueFromFormValue(field, '2025-03-30T10:00');

    // Assert: the input's text, and the same milliseconds back.
    expect(shown, 'the moment in the input').toEqual({
      status: 'shown',
      formValue: '2025-03-30T10:00',
    });
    expect(readBack, 'the text read back as milliseconds').toEqual({
      status: 'value',
      value: enduroStartsAtMs,
    });
  });

  it('cannot show ISO text, and reads a text that is not a date as unreadable', () => {
    // Arrange: the start field.
    const field = describeStartField();

    // Act: show an ISO text, and read a word.
    const shown = convertDataValueIntoFormValue(field, '2025-03-30T13:00:00.000Z');
    const readBack = readDataValueFromFormValue(field, 'amanhã');

    // Assert: a text is not this field's data; the word has the date's reason.
    expect(shown, 'only a number is shown').toEqual({ status: 'cannotBeShown' });
    expect(readBack, 'a word is not a date').toEqual({
      status: 'unreadable',
      problem: 'notADateAndTime',
    });
  });

  it('sends the number when the whole form is checked', () => {
    // Arrange: the countdown's form with the session and the start typed.
    const description = describeCountdownFixtureForm();
    const formValues = buildEmptySchemaFormValues(description);
    formValues.values.sessionName = 'Enduro de Resistência';
    formValues.values.startsAtMs = '2025-03-30T10:00';

    // Act: check it.
    const check = checkSchemaFormValues(description, formValues);

    // Assert: valid, the start as milliseconds.
    expect(check, 'the start goes as a number').toEqual({
      status: 'valid',
      checkedFields: [
        { key: 'sessionName', outcome: 'value', value: 'Enduro de Resistência' },
        { key: 'startsAtMs', outcome: 'value', value: enduroStartsAtMs },
      ],
    });
  });
});
