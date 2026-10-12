/**
 * A generated form as the fields an item stores (apps/control)
 *
 * What this module is for:
 *   An item in the rundown stores one field value per property of its graphic: a
 *   literal the operator typed, or "takeTime" for the server to fill at each take.
 *   itemFieldsFromSchemaForm builds those from a checked form: all of them for a new
 *   item, only the differing ones for a stored item, and from those the data that
 *   "Atualizar no ar" sends to the instance on air.
 *
 * What these tests prove:
 *   - A new item stores every field with a value as a literal, leaves cleared fields
 *     out and stores a field the server fills as `{ kind: 'takeTime' }`.
 *   - For a stored item only the fields that differ are built; a cleared field becomes
 *     a literal null, and only when the item stores something there (a text that is
 *     empty or only spaces counts as nothing).
 *   - A form that shows exactly what is stored builds nothing.
 *   - "Atualizar no ar" gets the changed literals (null for a cleared one) and never a
 *     field that was changed to takeTime.
 *   - A stored time with a part of a second counts as different (written next to the
 *     code as a known loss).
 *
 * What these tests deliberately do not cover:
 *   - The item's own fields (label, colour, notes, auto-out) and the commands around
 *     these fields: the item editor's tests.
 *   - The server stripping a stored null at the take: the server's tests.
 */
import raceClockManifest from '@bajaovrlay/race-clock/race-clock.ograf.json';
import type { ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildEmptySchemaFormValues,
  buildSchemaFormValuesFromItemFields,
} from './buildSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import {
  buildChangedItemFieldsFromSchemaForm,
  buildInstanceUpdateDataFromChangedItemFields,
  buildItemFieldsFromSchemaForm,
} from './itemFieldsFromSchemaForm';
import { describeLowerThirdFixtureForm } from './lowerThirdFixtureSchema.testSupport';
import type { SchemaFormFieldKind, SchemaFormFieldValue } from './schemaFormValues';

/** The real race clock's schema as the form reads it. */
function describeRaceClockForm() {
  return describeSchemaFormFromDataSchema(raceClockManifest.schema);
}

/** The four-hour endurance race as the editor stores it: counting down from 240:00, 7 laps. */
function buildStoredEnduranceRaceClockFields(): ItemFields {
  return {
    sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
    state: { kind: 'literal', value: 'pre' },
    clockMode: { kind: 'literal', value: 'remaining' },
    referenceTimeMs: { kind: 'literal', value: 14_400_000 },
    referenceWallClockMs: { kind: 'takeTime' },
    running: { kind: 'literal', value: true },
    lapsCompletedByLeader: { kind: 'literal', value: 7 },
  };
}

describe('buildItemFieldsFromSchemaForm', () => {
  it('stores a new race clock as literals with its reference moment as takeTime', () => {
    // Arrange: the race clock's empty form, filled for the endurance race; no laps.
    const description = describeRaceClockForm();
    const formValues = buildEmptySchemaFormValues(description);
    formValues.values.clockMode = 'remaining';
    formValues.values.referenceTimeMs = '240:00';
    formValues.values.running = true;

    // Act: build the fields of the new item.
    const itemFields = buildItemFieldsFromSchemaForm(description, formValues);

    // Assert: what gate 2 of BAJAOVRLAY-13 ruled: typed fields as literals, the moment
    // as takeTime, and no key at all for the blank laps.
    expect(itemFields, 'a new race clock item must store takeTime as its reference').toEqual({
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: 'pre' },
      clockMode: { kind: 'literal', value: 'remaining' },
      referenceTimeMs: { kind: 'literal', value: 14_400_000 },
      referenceWallClockMs: { kind: 'takeTime' },
      running: { kind: 'literal', value: true },
    });
  });

  it('stores a new lower third without its cleared and uneditable fields', () => {
    // Arrange: the lower third's empty form with the two required blanks filled.
    const description = describeLowerThirdFixtureForm();
    const formValues = buildEmptySchemaFormValues(description);
    formValues.values.nome = 'Ana Souza';
    formValues.values.numeroDoCarro = '42';

    // Act: build the fields of the new item.
    const itemFields = buildItemFieldsFromSchemaForm(description, formValues);

    // Assert: five literals; cargo, horario, the weight, the list and the object are absent.
    expect(itemFields, 'only fields with a value are stored').toEqual({
      nome: { kind: 'literal', value: 'Ana Souza' },
      equipe: { kind: 'literal', value: 'baja-ufpr' },
      duracaoMs: { kind: 'literal', value: 8_000 },
      destaque: { kind: 'literal', value: false },
      numeroDoCarro: { kind: 'literal', value: 42 },
    });
  });
});

describe('buildChangedItemFieldsFromSchemaForm, on the stored endurance race clock', () => {
  const editsAndWhatIsSaved: Array<{
    name: string;
    changedValues: Record<string, SchemaFormFieldValue>;
    changedKinds: Record<string, SchemaFormFieldKind>;
    changedItemFields: ItemFields;
  }> = [
    {
      // Opening an item and saving it must not rewrite anything.
      name: 'builds nothing when the form shows what is stored',
      changedValues: {},
      changedKinds: {},
      changedItemFields: {},
    },
    {
      // One field edited: one field saved.
      name: 'builds the flag alone when only the flag was changed',
      changedValues: { state: 'green' },
      changedKinds: {},
      changedItemFields: { state: { kind: 'literal', value: 'green' } },
    },
    {
      // A typed time is stored in milliseconds; the takeTime reference is already stored.
      name: 'builds the time in milliseconds and leaves the stored takeTime alone',
      changedValues: { referenceTimeMs: '120:00' },
      changedKinds: {},
      changedItemFields: { referenceTimeMs: { kind: 'literal', value: 7_200_000 } },
    },
    {
      // updateItemFields cannot remove a key, so cleared laps are stored as null.
      name: 'builds a literal null for laps that were cleared',
      changedValues: { lapsCompletedByLeader: null },
      changedKinds: {},
      changedItemFields: { lapsCompletedByLeader: { kind: 'literal', value: null } },
    },
    {
      // The operator pins the reference moment to a number: the kind changes.
      name: 'builds a literal when the reference moment is switched from takeTime to a typed number',
      changedValues: { referenceWallClockMs: '1760100300000' },
      changedKinds: { referenceWallClockMs: 'literal' },
      changedItemFields: { referenceWallClockMs: { kind: 'literal', value: 1_760_100_300_000 } },
    },
  ];

  it.each(editsAndWhatIsSaved)('$name', ({ changedValues, changedKinds, changedItemFields }) => {
    // Arrange: the editor's form filled from the stored item, then edited as in this scenario.
    const description = describeRaceClockForm();
    const storedItemFields = buildStoredEnduranceRaceClockFields();
    const formValues = buildSchemaFormValuesFromItemFields(
      description,
      storedItemFields,
    ).formValues;
    Object.assign(formValues.values, changedValues);
    Object.assign(formValues.kinds, changedKinds);

    // Act: build what the save must send.
    const fieldsToSave = buildChangedItemFieldsFromSchemaForm(
      description,
      formValues,
      storedItemFields,
    );

    // Assert: only the fields that differ from what is stored.
    expect(fieldsToSave, 'the save must hold the differing fields and nothing else').toEqual(
      changedItemFields,
    );
  });

  it('builds takeTime for an item that stores a literal number as its reference moment', () => {
    // Arrange: an item saved before the takeTime ruling; the operator switches the kind.
    const description = describeRaceClockForm();
    const storedItemFields: ItemFields = {
      ...buildStoredEnduranceRaceClockFields(),
      referenceWallClockMs: { kind: 'literal', value: 1_760_045_400_000 },
    };
    const formValues = buildSchemaFormValuesFromItemFields(
      description,
      storedItemFields,
    ).formValues;
    formValues.kinds.referenceWallClockMs = 'takeTime';

    // Act: build what the save must send.
    const fieldsToSave = buildChangedItemFieldsFromSchemaForm(
      description,
      formValues,
      storedItemFields,
    );

    // Assert: the stored number is replaced by "the moment of the take".
    expect(fieldsToSave, 'the kind change alone must be saved').toEqual({
      referenceWallClockMs: { kind: 'takeTime' },
    });
  });

  it('does not build a null for a cleared field the item never stored', () => {
    // Arrange: the same item stored without laps; the form shows the laps cleared.
    const description = describeRaceClockForm();
    const storedItemFields = buildStoredEnduranceRaceClockFields();
    delete storedItemFields.lapsCompletedByLeader;
    const formValues = buildSchemaFormValuesFromItemFields(
      description,
      storedItemFields,
    ).formValues;

    // Act: build what the save must send.
    const fieldsToSave = buildChangedItemFieldsFromSchemaForm(
      description,
      formValues,
      storedItemFields,
    );

    // Assert: there is no key to blank, so nothing is written.
    expect(fieldsToSave, 'a field that is absent and stays cleared is left alone').toEqual({});
  });

  it('rewrites a stored time that has a part of a second, because it compares data', () => {
    // Arrange: a time of 90 500 ms written through the API; the form shows it as 1:30.
    const description = describeRaceClockForm();
    const storedItemFields: ItemFields = {
      ...buildStoredEnduranceRaceClockFields(),
      referenceTimeMs: { kind: 'literal', value: 90_500 },
    };
    const formValues = buildSchemaFormValuesFromItemFields(
      description,
      storedItemFields,
    ).formValues;

    // Act: build what a save with no edit would send.
    const fieldsToSave = buildChangedItemFieldsFromSchemaForm(
      description,
      formValues,
      storedItemFields,
    );

    // Assert: the half second is dropped at the first save. A known loss, kept simple on
    // purpose; the editor itself only ever stores whole seconds.
    expect(fieldsToSave, 'the time is rewritten in whole seconds').toEqual({
      referenceTimeMs: { kind: 'literal', value: 90_000 },
    });
  });
});

describe('buildChangedItemFieldsFromSchemaForm, on a stored lower third with a blank text', () => {
  const blankTextsAnItemCanStore = [
    // The empty text: an item created through the API with `cargo: ""`.
    { name: 'empty', storedJobTitle: '' },
    // Spaces alone are shown as a cleared field too, and read back as nothing.
    { name: 'only spaces', storedJobTitle: '   ' },
  ];

  it.each(blankTextsAnItemCanStore)(
    'leaves an optional text the item stores as $name alone when another field is saved',
    ({ storedJobTitle }) => {
      // Arrange: car 42's lower third stored with a blank "cargo"; the form shows it as a
      // cleared field, and the operator corrects only the name.
      const description = describeLowerThirdFixtureForm();
      const storedItemFields: ItemFields = {
        nome: { kind: 'literal', value: 'Ana Sousa' },
        cargo: { kind: 'literal', value: storedJobTitle },
        equipe: { kind: 'literal', value: 'baja-ufpr' },
        duracaoMs: { kind: 'literal', value: 8_000 },
        destaque: { kind: 'literal', value: false },
        numeroDoCarro: { kind: 'literal', value: 42 },
      };
      const formValues = buildSchemaFormValuesFromItemFields(
        description,
        storedItemFields,
      ).formValues;
      formValues.values.nome = 'Ana Souza';

      // Act: build what the save must send.
      const fieldsToSave = buildChangedItemFieldsFromSchemaForm(
        description,
        formValues,
        storedItemFields,
      );

      // Assert: the name alone. A null written over the blank text would change what the
      // graphic receives at the next take (no "cargo" at all) without anyone asking.
      expect(fieldsToSave, 'a blank text nobody touched must not be rewritten as null').toEqual({
        nome: { kind: 'literal', value: 'Ana Souza' },
      });
    },
  );
});

describe('buildInstanceUpdateDataFromChangedItemFields', () => {
  it('sends changed literals as values, a cleared one as null, and never a takeTime', () => {
    // Arrange: the fields a save changed: a new flag, cleared laps, and the reference
    // moment switched to takeTime.
    const changedItemFields: ItemFields = {
      state: { kind: 'literal', value: 'green' },
      lapsCompletedByLeader: { kind: 'literal', value: null },
      referenceWallClockMs: { kind: 'takeTime' },
    };

    // Act: build the data of "Atualizar no ar".
    const updateData = buildInstanceUpdateDataFromChangedItemFields(changedItemFields);

    // Assert: literals only; the moment on air stays until the item is taken again.
    expect(updateData, 'the update must hold the changed literal fields only').toEqual({
      state: 'green',
      lapsCompletedByLeader: null,
    });
  });

  it('builds empty data when nothing was changed', () => {
    // Arrange: a save that changed no field.
    const changedItemFields: ItemFields = {};

    // Act: build the data of "Atualizar no ar".
    const updateData = buildInstanceUpdateDataFromChangedItemFields(changedItemFields);

    // Assert: empty, which the panel reads as "nothing to update on air".
    expect(updateData, 'no changed field means no data').toEqual({});
  });
});
