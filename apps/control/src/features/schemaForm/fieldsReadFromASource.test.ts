/**
 * "Atualizar no ar" and the fields the form reads from a source (apps/control)
 *
 * What this module is for:
 *   "Atualizar no ar" puts on air the values the operator typed. A field the form now
 *   reads from a source ("Fonte", or a clock field "Relógio da fonte" fills) has no typed
 *   value: the item stores its binding, and what it reads goes on air at the next take.
 *   Gate 2 of PR #18 found the editor sending the three clock fields as null after a
 *   switch to "Relógio da fonte", which the server refuses every time (the clock's mode
 *   and running are required). These tests pin the keys the on-air update leaves out,
 *   and the check that tells the operator a source change waits for the next take.
 *
 * What these tests prove:
 *   - After a switch to "Relógio da fonte" the update sends no clock field at all.
 *   - After a switch of the flag to "Fonte" the update sends the typed title only.
 *   - A source choice changed since the editor opened is noticed (a field switched to or
 *     from a source, or another path); a typed change alone is not.
 *   - A list field on "Lista dos cadastros" switched to the other list is noticed too, and
 *     the same list kept is not (gate 2 round 1 of PR #29: it was missed since PR #28).
 *
 * What these tests deliberately do not cover:
 *   - The item save, which does store the binding and the clock nulls;
 *     schemaFormBindings.test.ts.
 *   - The note on the page; ItemEditorPanelUpdateOnAirBindings.test.tsx.
 */
import raceClockManifest from '@bajaovrlay/race-clock/race-clock.ograf.json';
import type { ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { emptySchemaFormBindingValue } from './bindingFormValue';
import { buildSchemaFormValuesFromItemFields } from './buildSchemaFormValuesFromItemFields';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import {
  hasSourceChoiceChangedSinceOpened,
  listFieldKeysReadFromASource,
} from './fieldsReadFromASource';
import {
  buildChangedItemFieldsFromSchemaForm,
  buildInstanceUpdateDataFromChangedItemFields,
} from './itemFieldsFromSchemaForm';
import type { SchemaFormValues } from './schemaFormValues';

/** The real race clock's schema as the form reads it. */
function describeRaceClockForm() {
  return describeSchemaFormFromDataSchema(raceClockManifest.schema);
}

/** "Relógio do enduro" as stored before any source: every field typed. */
function buildStoredTypedClockFields(): ItemFields {
  return {
    sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
    state: { kind: 'literal', value: 'green' },
    clockMode: { kind: 'literal', value: 'remaining' },
    referenceTimeMs: { kind: 'literal', value: 14_400_000 },
    referenceWallClockMs: { kind: 'takeTime' },
    running: { kind: 'literal', value: true },
  };
}

/** The editor's form as opened on the typed clock. */
function openFormOnTheTypedClock(): SchemaFormValues {
  return buildSchemaFormValuesFromItemFields(describeRaceClockForm(), buildStoredTypedClockFields())
    .formValues;
}

/** The form with the time switched to "Relógio da fonte" of the simulator. */
function switchTheTimeToTheWholeClock(formValues: SchemaFormValues): SchemaFormValues {
  return {
    ...formValues,
    kinds: { ...formValues.kinds, referenceTimeMs: 'wholeClock' },
    bindings: {
      ...formValues.bindings,
      referenceTimeMs: { ...emptySchemaFormBindingValue, sourceId: 'simulador-enduro' },
    },
  };
}

/** The form with the flag switched to "Fonte": the simulator's session flag. */
function switchTheFlagToTheSimulator(formValues: SchemaFormValues): SchemaFormValues {
  return {
    ...formValues,
    kinds: { ...formValues.kinds, state: 'binding' },
    bindings: {
      ...formValues.bindings,
      state: {
        ...emptySchemaFormBindingValue,
        sourceId: 'simulador-enduro',
        pathKey: 'session:state',
      },
    },
  };
}

/** The data "Atualizar no ar" would send for this form, against the typed clock. */
function buildOnAirDataFor(formValues: SchemaFormValues): Record<string, unknown> {
  const description = describeRaceClockForm();
  const changedFields = buildChangedItemFieldsFromSchemaForm(
    description,
    formValues,
    buildStoredTypedClockFields(),
  );
  return buildInstanceUpdateDataFromChangedItemFields(
    changedFields,
    listFieldKeysReadFromASource(description, formValues),
  );
}

describe('the on-air update leaves out the fields read from a source', () => {
  it('sends no clock field after a switch to "Relógio da fonte"', () => {
    // Arrange: the typed clock's form, its time switched to the simulator's clock.
    const formValues = switchTheTimeToTheWholeClock(openFormOnTheTypedClock());

    // Act: build what "Atualizar no ar" sends.
    const onAirData = buildOnAirDataFor(formValues);

    // Assert: nothing; the source's clock goes on air at the next take.
    expect(onAirData, 'no clock field may be sent as null').toEqual({});
  });

  it('sends the typed title only after the flag switched to "Fonte"', () => {
    // Arrange: the flag now reads the simulator, and the title was retyped.
    const switchedForm = switchTheFlagToTheSimulator(openFormOnTheTypedClock());
    const formValues = {
      ...switchedForm,
      values: { ...switchedForm.values, sessionName: 'Enduro — Etapa Nacional' },
    };

    // Act: build what "Atualizar no ar" sends.
    const onAirData = buildOnAirDataFor(formValues);

    // Assert: the title; the flag waits for the next take.
    expect(onAirData, 'only the typed change goes on air now').toEqual({
      sessionName: 'Enduro — Etapa Nacional',
    });
  });
});

describe('hasSourceChoiceChangedSinceOpened', () => {
  const scenarios = [
    // The walk's case: the clock now follows the source.
    {
      name: 'notices a switch to "Relógio da fonte"',
      changeTheForm: switchTheTimeToTheWholeClock,
      hasChanged: true,
    },
    // A field that starts reading a source.
    {
      name: 'notices a switch of the flag to "Fonte"',
      changeTheForm: switchTheFlagToTheSimulator,
      hasChanged: true,
    },
    // A typed change goes on air at once, so no note is needed.
    {
      name: 'ignores a typed change alone',
      changeTheForm: (formValues: SchemaFormValues) => ({
        ...formValues,
        values: { ...formValues.values, sessionName: 'Enduro — Etapa Nacional' },
      }),
      hasChanged: false,
    },
  ];

  it.each(scenarios)('$name', ({ changeTheForm, hasChanged }) => {
    // Arrange: the form as opened on the typed clock, and the form after this row's change.
    const formAsOpened = openFormOnTheTypedClock();
    const formNow = changeTheForm(openFormOnTheTypedClock());

    // Act: ask whether a source choice changed.
    const answer = hasSourceChoiceChangedSinceOpened(
      describeRaceClockForm(),
      formNow,
      formAsOpened,
    );

    // Assert: only a source change counts.
    expect(answer, 'whether a source change waits for the next take').toBe(hasChanged);
  });

  it('notices another path on a field that already read a source', () => {
    // Arrange: the flag bound when opened, then pointed at the session name instead.
    const formAsOpened = switchTheFlagToTheSimulator(openFormOnTheTypedClock());
    const formNow = {
      ...formAsOpened,
      bindings: {
        ...formAsOpened.bindings,
        state: {
          ...emptySchemaFormBindingValue,
          sourceId: 'simulador-enduro',
          pathKey: 'session:sessionKind',
        },
      },
    };

    // Act: ask whether a source choice changed.
    const answer = hasSourceChoiceChangedSinceOpened(
      describeRaceClockForm(),
      formNow,
      formAsOpened,
    );

    // Assert: a new path is a source change too.
    expect(answer, 'another path is a source change').toBe(true);
  });
});

/**
 * An intermission board whose one list takes any record of the library: its items are
 * objects that name no required key, so both the sponsors and the schedule fit it.
 */
function describeBoardOfAnyListForm() {
  return describeSchemaFormFromDataSchema({
    type: 'object',
    properties: {
      boardItems: { type: 'array', title: 'Itens do quadro', items: { type: 'object' } },
    },
  });
}

/** The board's form as opened on its list reading the sponsors from Cadastros. */
function openBoardFormOnTheSponsors(): SchemaFormValues {
  return buildSchemaFormValuesFromItemFields(describeBoardOfAnyListForm(), {
    boardItems: { kind: 'entityList', entityType: 'sponsor' },
  }).formValues;
}

describe('hasSourceChoiceChangedSinceOpened on a list read from Cadastros', () => {
  const scenarios = [
    // The bug of PR #28: the kind stays "Lista dos cadastros" while the list changes.
    { name: 'notices the switch to the schedule', listNow: 'scheduleSlot', hasChanged: true },
    // The same list chosen again is no change at all.
    { name: 'ignores the same list kept', listNow: 'sponsor', hasChanged: false },
  ] as const;

  it.each(scenarios)('$name', ({ listNow, hasChanged }) => {
    // Arrange: the board as opened on the sponsors, and the form with this row's list.
    const formAsOpened = openBoardFormOnTheSponsors();
    const formNow: SchemaFormValues = {
      ...formAsOpened,
      entityLists: { ...formAsOpened.entityLists, boardItems: listNow },
    };

    // Act: ask whether a source choice changed.
    const answer = hasSourceChoiceChangedSinceOpened(
      describeBoardOfAnyListForm(),
      formNow,
      formAsOpened,
    );

    // Assert: another list waits for the next take; the same one does not.
    expect(answer, 'whether the list change waits for the next take').toBe(hasChanged);
  });
});
