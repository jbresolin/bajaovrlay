/**
 * A generated form as the data of an on-air update (apps/control)
 *
 * What this module is for:
 *   "Atualizar" sends only what the operator changed as an `updateInstanceData`, so the
 *   graphic changes in place. buildInstanceUpdateFromDirtySchemaFormFields builds the
 *   `data` and `takeTimeFieldKeys` of that command from a checked form. (Until
 *   BAJAOVRLAY-37 this file also covered buildTakeDataFromSchemaForm, the whole form as a
 *   take; "Edição rápida" no longer takes anything, so that builder was removed.)
 *
 * What these tests prove:
 *   - An update carries only the changed fields: a value, null for a cleared field, or
 *     the key of a field now filled by the server; a change of kind counts as a change.
 *   - An update with nothing changed says so, so the panel sends no command.
 *   - The builder does not accept a form that did not pass the check.
 *
 * What these tests deliberately do not cover:
 *   - react-hook-form deciding which fields are changed; the tests hand in the
 *     `dirtyFields` it would report (SchemaFormFieldsEditing.test.tsx shows it reporting).
 *   - The server writing the moment into `takeTimeFieldKeys` and deleting the keys sent
 *     as null: the server's own tests.
 *   - The command around the data (graphic, layer, instance): the panels' tests.
 */
import raceClockManifest from '@bajaovrlay/race-clock/race-clock.ograf.json';
import { describe, expect, it } from 'vitest';

import { buildSchemaFormValuesFromDataOnAir } from './buildSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import { buildInstanceUpdateFromDirtySchemaFormFields } from './instanceUpdateFromSchemaForm';
import {
  buildLowerThirdFormValuesForCar42,
  describeLowerThirdFixtureForm,
} from './lowerThirdFixtureSchema.testSupport';
import type { SchemaFormDirtyFields, SchemaFormFieldValue } from './schemaFormValues';

describe('buildInstanceUpdateFromDirtySchemaFormFields, on the lower third of car 42 on air', () => {
  const changesAndWhatIsSent: Array<{
    name: string;
    changedValues: Record<string, SchemaFormFieldValue>;
    dirtyFields: SchemaFormDirtyFields;
    data: Record<string, unknown>;
  }> = [
    {
      // The commonest update: one field retyped.
      name: 'sends only the name when only the name was changed',
      changedValues: { nome: 'Bruno Lima' },
      dirtyFields: { values: { nome: true } },
      data: { nome: 'Bruno Lima' },
    },
    {
      // Two fields changed go out together, converted like a take converts them.
      name: 'sends the time on air in milliseconds together with the switch',
      changedValues: { duracaoMs: '0:15', destaque: false },
      dirtyFields: { values: { duracaoMs: true, destaque: true } },
      data: { duracaoMs: 15_000, destaque: false },
    },
    {
      // "limpar" on an optional field: null tells the server to take the key off air.
      name: 'sends null for an optional field that was cleared',
      changedValues: { cargo: null },
      dirtyFields: { values: { cargo: true } },
      data: { cargo: null },
    },
    {
      // An optional typed field emptied by hand is the same as cleared.
      name: 'sends null for an optional number that was emptied',
      changedValues: { pesoDoCarroKg: null },
      dirtyFields: { values: { pesoDoCarroKg: true } },
      data: { pesoDoCarroKg: null },
    },
    {
      // react-hook-form writes false for a field put back to what it was.
      name: 'leaves out a field that react-hook-form marks as not changed',
      changedValues: { nome: 'Bruno Lima' },
      dirtyFields: { values: { nome: true, equipe: false } },
      data: { nome: 'Bruno Lima' },
    },
  ];

  it.each(changesAndWhatIsSent)('$name', ({ changedValues, dirtyFields, data }) => {
    // Arrange: the form filled from what is on air, then changed as in this scenario.
    const description = describeLowerThirdFixtureForm();
    const formValues = buildLowerThirdFormValuesForCar42();
    Object.assign(formValues.values, changedValues);

    // Act: build the update from the changed fields.
    const update = buildInstanceUpdateFromDirtySchemaFormFields(
      description,
      formValues,
      dirtyFields,
    );

    // Assert: only what changed is sent; the server keeps the rest.
    expect(update.data, 'the update must hold the changed fields and nothing else').toEqual(data);
    expect(update.takeTimeFieldKeys, 'nothing here is filled by the server').toEqual([]);
    expect(update.hasNothingToSend, 'there is a command to send').toBe(false);
  });

  it('says there is nothing to send when nothing was changed', () => {
    // Arrange: the form exactly as it was filled from what is on air.
    const description = describeLowerThirdFixtureForm();
    const formValues = buildLowerThirdFormValuesForCar42();
    const dirtyFields: SchemaFormDirtyFields = {};

    // Act: build the update.
    const update = buildInstanceUpdateFromDirtySchemaFormFields(
      description,
      formValues,
      dirtyFields,
    );

    // Assert: the panel knows not to send a command at all.
    expect(update.hasNothingToSend, 'an untouched form has nothing to update').toBe(true);
    expect(update.data, 'no field is sent').toEqual({});
  });

  it('refuses to build an update while any field of the form is wrong', () => {
    // Arrange: only the name was changed, but the car number on the form is wrong.
    const description = describeLowerThirdFixtureForm();
    const formValues = buildLowerThirdFormValuesForCar42();
    formValues.values.nome = 'Bruno Lima';
    formValues.values.numeroDoCarro = '0';

    // Act: try to build the update.
    const buildTheUpdate = () =>
      buildInstanceUpdateFromDirtySchemaFormFields(description, formValues, {
        values: { nome: true },
      });

    // Assert: the whole form must be valid, as it is for the panel's buttons.
    expect(buildTheUpdate, 'an unchecked form must never become a command').toThrow(
      /passed checkSchemaFormValues/,
    );
  });
});

describe('buildInstanceUpdateFromDirtySchemaFormFields, on the race clock on air', () => {
  /** The real race clock's form filled from the first heat on air since 9:45 in Brasília. */
  function buildRaceClockFormFilledFromTheFirstHeatOnAir() {
    const description = describeSchemaFormFromDataSchema(raceClockManifest.schema);
    const formValues = buildSchemaFormValuesFromDataOnAir(description, {
      sessionName: 'Enduro de Resistência — Bateria 1',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 754_000,
      referenceWallClockMs: Date.parse('2026-10-10T12:45:00.000Z'),
      running: true,
      lapsCompletedByLeader: 7,
    }).formValues;
    return { description, formValues };
  }

  it('sends the flag alone for a flag change, so the clock keeps its own reference', () => {
    // Arrange: the clock on air under green; the operator picks the yellow flag.
    const { description, formValues } = buildRaceClockFormFilledFromTheFirstHeatOnAir();
    formValues.values.state = 'yellow';

    // Act: build the update.
    const update = buildInstanceUpdateFromDirtySchemaFormFields(description, formValues, {
      values: { state: true },
    });

    // Assert: one field; nothing about the time is touched.
    expect(update.data, 'a flag change must send the flag and nothing else').toEqual({
      state: 'yellow',
    });
    expect(update.takeTimeFieldKeys, 'the reference moment is not re-stamped').toEqual([]);
  });

  it('asks the server for a new moment when the kind was changed to "filled by the server"', () => {
    // Arrange: the operator types a new time and switches the reference moment's kind.
    const { description, formValues } = buildRaceClockFormFilledFromTheFirstHeatOnAir();
    formValues.values.referenceTimeMs = '30:00';
    formValues.kinds.referenceWallClockMs = 'takeTime';

    // Act: build the update; changing a kind marks that field as changed.
    const update = buildInstanceUpdateFromDirtySchemaFormFields(description, formValues, {
      values: { referenceTimeMs: true },
      kinds: { referenceWallClockMs: true },
    });

    // Assert: the typed time goes as data and the moment is the server's to write.
    expect(update.data, 'the typed time must be sent in milliseconds').toEqual({
      referenceTimeMs: 1_800_000,
    });
    expect(update.takeTimeFieldKeys, 'the server must stamp the reference moment').toEqual([
      'referenceWallClockMs',
    ]);
    expect(update.hasNothingToSend, 'there is a command to send').toBe(false);
  });

  it('takes the laps off air when they are cleared', () => {
    // Arrange: 7 laps on air; the operator presses "limpar" on the laps.
    const { description, formValues } = buildRaceClockFormFilledFromTheFirstHeatOnAir();
    formValues.values.lapsCompletedByLeader = null;

    // Act: build the update.
    const update = buildInstanceUpdateFromDirtySchemaFormFields(description, formValues, {
      values: { lapsCompletedByLeader: true },
    });

    // Assert: null is how an update removes a field (the gap of PR #7 is closed).
    expect(update.data, 'cleared laps must be sent as null').toEqual({
      lapsCompletedByLeader: null,
    });
  });
});
