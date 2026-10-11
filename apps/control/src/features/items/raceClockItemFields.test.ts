/**
 * Race clock item fields: form values to stored fields and back (apps/control)
 *
 * What this module is for:
 *   A race clock item stores, for each field of the race clock, the value the operator
 *   typed (a "literal"). raceClockItemFields turns the race clock form (the same six
 *   fields as the take panel) into those stored fields when an item is saved, and turns
 *   stored fields back into form values when an item is opened for editing.
 *
 * What these tests prove:
 *   - A filled form becomes one literal per race clock field, with the time in
 *     milliseconds and the moment of the SAVE as the clock's reference moment.
 *   - Blank laps are left out of the fields altogether.
 *   - Stored fields come back as the form values the operator typed. The time is the
 *     one stored, never carried forward, because the item is not on air.
 *   - A stored field that is missing, is not a literal, or holds a value the form
 *     cannot show comes back as the form's default and is named as "could not be read".
 *   - Blanking the laps of an item that has laps is recognised, because the update
 *     command cannot remove a field.
 *
 * What these tests deliberately do not cover:
 *   - How a clock saved as running behaves when the item is taken hours later: it counts
 *     from the moment of the save (see the comment in raceClockItemFields.ts). No test
 *     here can prove what the graphic shows; that is an open question for João.
 *   - The rules of the six fields (features/playout/raceClockTakeForm.test.ts).
 *   - Which of these fields an update sends (itemCommandsFromForm.test.ts).
 */
import type { FieldValue, ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { RaceClockTakeFormValues } from '@/features/playout/raceClockTakeForm';

import {
  buildEnduranceStartClockItem,
  momentTheItemWasSavedInMilliseconds,
} from './itemsLikeTheEditorSaves.testSupport';
import {
  buildRaceClockItemFieldsFromFormValues,
  isFormBlankingLapsTheItemHas,
  readRaceClockFormValuesFromItemFields,
} from './raceClockItemFields';

/** The race clock form as filled for the second heat: 12:34 in, green, running, 7 laps. */
function buildFormFilledForTheSecondHeat(): RaceClockTakeFormValues {
  return {
    sessionName: 'Enduro de Resistência — Bateria 2',
    state: 'green',
    clockMode: 'elapsed',
    running: true,
    referenceTime: '12:34',
    lapsCompletedByLeader: '7',
  };
}

/**
 * A field value of a kind this task does not have yet: a binding to the timing system,
 * which arrives in M2. The type does not allow it today, so the test forces it in.
 */
function buildBindingFieldValueFromM2(): FieldValue {
  const bindingToTheTimingSystem = { kind: 'binding', source: 'cronometragem.lider.voltas' };
  return bindingToTheTimingSystem as unknown as FieldValue;
}

describe('buildRaceClockItemFieldsFromFormValues', () => {
  it('turns a filled form into one literal per race clock field', () => {
    // Arrange: the form filled for the second heat.
    const formValues = buildFormFilledForTheSecondHeat();

    // Act: build the fields at the moment of the save (Friday evening).
    const itemFields = buildRaceClockItemFieldsFromFormValues(
      formValues,
      momentTheItemWasSavedInMilliseconds,
    );

    // Assert: every field is a literal; 12:34 is 754 000 ms; the reference is the save.
    expect(itemFields, 'each race clock field must be stored as the literal typed').toEqual({
      sessionName: { kind: 'literal', value: 'Enduro de Resistência — Bateria 2' },
      state: { kind: 'literal', value: 'green' },
      clockMode: { kind: 'literal', value: 'elapsed' },
      referenceTimeMs: { kind: 'literal', value: 754_000 },
      referenceWallClockMs: { kind: 'literal', value: momentTheItemWasSavedInMilliseconds },
      running: { kind: 'literal', value: true },
      lapsCompletedByLeader: { kind: 'literal', value: 7 },
    });
  });

  it('leaves the laps out of the fields when the operator left them blank', () => {
    // Arrange: the same form with the laps left blank.
    const formValues = { ...buildFormFilledForTheSecondHeat(), lapsCompletedByLeader: '' };

    // Act: build the fields.
    const itemFields = buildRaceClockItemFieldsFromFormValues(
      formValues,
      momentTheItemWasSavedInMilliseconds,
    );

    // Assert: there is no laps field at all (the graphic refuses a null field).
    expect(itemFields, 'blank laps must not become a field').not.toHaveProperty(
      'lapsCompletedByLeader',
    );
  });
});

describe('readRaceClockFormValuesFromItemFields', () => {
  it('gives back what the operator typed for an item saved the evening before', () => {
    // Arrange: the item prepared for the start: stopped at 240:00, counting down.
    const itemFields = buildEnduranceStartClockItem().fields;

    // Act: read the form values from its fields.
    const whatWasRead = readRaceClockFormValuesFromItemFields(itemFields);

    // Assert: the form repeats the item. The time is the stored 240:00, not moved on.
    expect(whatWasRead.formValues, 'the form must show the values the item stores').toEqual({
      sessionName: 'Enduro de Resistência',
      state: 'pre',
      clockMode: 'remaining',
      running: false,
      referenceTime: '240:00',
      lapsCompletedByLeader: '',
    });
    expect(
      whatWasRead.formFieldsThatCouldNotBeRead,
      'every field of a well-formed item must be readable (missing laps are normal)',
    ).toEqual([]);
  });

  it('shows the stored laps as text', () => {
    // Arrange: the same item after the leader completed 7 laps.
    const itemFields: ItemFields = {
      ...buildEnduranceStartClockItem().fields,
      lapsCompletedByLeader: { kind: 'literal', value: 7 },
    };

    // Act: read the form values.
    const whatWasRead = readRaceClockFormValuesFromItemFields(itemFields);

    // Assert: the laps field shows 7.
    expect(whatWasRead.formValues.lapsCompletedByLeader, 'the laps must be shown').toBe('7');
  });

  const scenariosWithOneFieldThatCannotBeRead = [
    // A flag the race clock does not have, as a hand-made API call could store.
    {
      name: 'a flag that is not one of the six comes back as the default "pre"',
      fieldKey: 'state',
      storedFieldValue: { kind: 'literal', value: 'blue' } as FieldValue,
      formFieldName: 'state',
      expectedFormValue: 'pre',
    },
    // The time stored as text instead of milliseconds.
    {
      name: 'a time stored as text comes back as the default 0:00',
      fieldKey: 'referenceTimeMs',
      storedFieldValue: { kind: 'literal', value: '12:34' } as FieldValue,
      formFieldName: 'referenceTime',
      expectedFormValue: '0:00',
    },
    // A session name stored as a number.
    {
      name: 'a session name that is not text comes back as the default name',
      fieldKey: 'sessionName',
      storedFieldValue: { kind: 'literal', value: 42 } as FieldValue,
      formFieldName: 'sessionName',
      expectedFormValue: 'Enduro de Resistência',
    },
    // A kind of field value M2 brings: this editor only knows literals.
    {
      name: 'laps bound to a data source (M2) come back blank',
      fieldKey: 'lapsCompletedByLeader',
      storedFieldValue: buildBindingFieldValueFromM2(),
      formFieldName: 'lapsCompletedByLeader',
      expectedFormValue: '',
    },
    // A negative number of laps makes no sense and the graphic refuses it.
    {
      name: 'negative laps come back blank',
      fieldKey: 'lapsCompletedByLeader',
      storedFieldValue: { kind: 'literal', value: -3 } as FieldValue,
      formFieldName: 'lapsCompletedByLeader',
      expectedFormValue: '',
    },
  ] as const;

  it.each(scenariosWithOneFieldThatCannotBeRead)(
    '$name and is named as unreadable',
    ({ fieldKey, storedFieldValue, formFieldName, expectedFormValue }) => {
      // Arrange: the endurance start item with one stored field replaced.
      const itemFields: ItemFields = {
        ...buildEnduranceStartClockItem().fields,
        [fieldKey]: storedFieldValue,
      };

      // Act: read the form values.
      const whatWasRead = readRaceClockFormValuesFromItemFields(itemFields);

      // Assert: that form field shows its default, and only it is named as unreadable.
      expect(
        whatWasRead.formValues[formFieldName],
        'a field that cannot be read must show the default of the form',
      ).toBe(expectedFormValue);
      expect(
        whatWasRead.formFieldsThatCouldNotBeRead,
        'only the field that could not be read must be named',
      ).toEqual([formFieldName]);
    },
  );

  it('names every required field of an item that has no fields at all', () => {
    // Arrange: a race clock item created with empty fields, as a bare API call could.
    const itemFields: ItemFields = {};

    // Act: read the form values.
    const whatWasRead = readRaceClockFormValuesFromItemFields(itemFields);

    // Assert: the form is at its defaults, and the five required fields are named
    // (missing laps are normal, so they are not).
    expect(whatWasRead.formValues, 'the form must fall back to its defaults').toEqual({
      sessionName: 'Enduro de Resistência',
      state: 'pre',
      clockMode: 'elapsed',
      running: false,
      referenceTime: '0:00',
      lapsCompletedByLeader: '',
    });
    expect(
      whatWasRead.formFieldsThatCouldNotBeRead,
      'the five required fields are missing and must be named in form order',
    ).toEqual(['sessionName', 'state', 'clockMode', 'running', 'referenceTime']);
  });
});

describe('isFormBlankingLapsTheItemHas', () => {
  const lapsScenarios = [
    // The case the update command cannot express: the item has laps, the form has none.
    {
      name: 'says yes when the item has 7 laps and the form is blank',
      lapsOnItem: 7,
      lapsInForm: '',
      expected: true,
    },
    // Changing the number is an ordinary update.
    {
      name: 'says no when the laps are changed to another number',
      lapsOnItem: 7,
      lapsInForm: '8',
      expected: false,
    },
    // Nothing to remove: the item never had laps.
    {
      name: 'says no when the item has no laps and the form is blank',
      lapsOnItem: undefined,
      lapsInForm: '',
      expected: false,
    },
  ];

  it.each(lapsScenarios)('$name', ({ lapsOnItem, lapsInForm, expected }) => {
    // Arrange: the endurance start item, with laps when the scenario says so, and the
    // form of the second heat with the scenario's laps text.
    const itemFields: ItemFields = { ...buildEnduranceStartClockItem().fields };
    if (lapsOnItem !== undefined) {
      itemFields.lapsCompletedByLeader = { kind: 'literal', value: lapsOnItem };
    }
    const formValues = { ...buildFormFilledForTheSecondHeat(), lapsCompletedByLeader: lapsInForm };

    // Act: ask whether saving would need to remove the laps.
    const isBlankingLaps = isFormBlankingLapsTheItemHas(itemFields, formValues);

    // Assert: only a blank form over an item with laps is a removal.
    expect(isBlankingLaps, 'only blank laps over stored laps count as a removal').toBe(expected);
  });
});
