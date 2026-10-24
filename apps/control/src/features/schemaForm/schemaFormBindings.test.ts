/**
 * The generated form and fields read from a source (apps/control)
 *
 * What this module is for:
 *   In the item editor a field may be "Fonte" (read a path of a source, live or frozen,
 *   with at most one transform) and the race clock's time may be "Relógio da fonte" (the
 *   whole session clock, filling the four clock fields). The form holds each binding as
 *   plain choices (source, path, car number text, live or frozen, transform and its one
 *   parameter as text); checking the form turns them into the binding an item stores, or
 *   a pt-BR message naming the field; and a stored item's bindings fill the form back.
 *
 * What these tests prove:
 *   - A stored flag binding and a stored whole clock fill the form as "Fonte" and
 *     "Relógio da fonte", and the three other clock fields are not listed as unreadable.
 *   - A new item stores the flag binding as chosen, and "Relógio da fonte" as one
 *     binding on the time field, leaving the other three clock fields out.
 *   - A stored item gets only the binding that changed, and the three clock fields as a
 *     literal null when it stored values there.
 *   - A binding with no source, no path, a car path with no number or a maximum length
 *     of 0 letters is refused with a message naming the field.
 *
 * What these tests deliberately do not cover:
 *   - Which paths a field offers; bindingChoices.test.ts.
 *   - Drawing the binding controls; the item editor's component tests.
 */
import raceClockManifest from '@bajaovrlay/race-clock/race-clock.ograf.json';
import type { ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { emptySchemaFormBindingValue } from './bindingFormValue';
import {
  buildEmptySchemaFormValues,
  buildSchemaFormValuesFromItemFields,
} from './buildSchemaFormValues';
import { checkSchemaFormValues } from './checkSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import {
  buildChangedItemFieldsFromSchemaForm,
  buildItemFieldsFromSchemaForm,
} from './itemFieldsFromSchemaForm';
import type { SchemaFormValues } from './schemaFormValues';

/** The real race clock's schema as the form reads it. */
function describeRaceClockForm() {
  return describeSchemaFormFromDataSchema(raceClockManifest.schema);
}

/** A live binding to the simulator's session at the path given. */
function buildSimulatorSessionBinding(path: string) {
  return {
    kind: 'binding' as const,
    sourceId: 'simulador-enduro',
    shapeKey: 'session' as const,
    path,
    isLive: true,
  };
}

/** "Relógio do enduro — fonte" as the editor stores it. */
function buildStoredBoundClockFields(): ItemFields {
  return {
    sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
    state: buildSimulatorSessionBinding('state'),
    referenceTimeMs: buildSimulatorSessionBinding('clock'),
  };
}

/** An empty race clock form with the flag and the time chosen as the editor would. */
function buildNewFormWithFlagAndWholeClockFromTheSimulator(): SchemaFormValues {
  const formValues = buildEmptySchemaFormValues(describeRaceClockForm());
  return {
    ...formValues,
    values: { ...formValues.values, sessionName: 'Enduro de Resistência' },
    kinds: { ...formValues.kinds, state: 'binding', referenceTimeMs: 'wholeClock' },
    bindings: {
      ...formValues.bindings,
      state: {
        ...emptySchemaFormBindingValue,
        sourceId: 'simulador-enduro',
        pathKey: 'session:state',
      },
      referenceTimeMs: { ...emptySchemaFormBindingValue, sourceId: 'simulador-enduro' },
    },
  };
}

describe('a stored item with bindings in the form', () => {
  it('shows the flag as "Fonte" and the time as "Relógio da fonte"', () => {
    // Arrange: the bound clock as stored.
    const storedFields = buildStoredBoundClockFields();

    // Act: fill the form from it.
    const { formValues, labelsOfFieldsThatCouldNotBeRead } = buildSchemaFormValuesFromItemFields(
      describeRaceClockForm(),
      storedFields,
    );

    // Assert: the kinds and choices as stored, and nothing listed as unreadable: the
    // three other clock fields are the whole clock's.
    expect(formValues.kinds.state, 'the flag reads a source').toBe('binding');
    expect(formValues.kinds.referenceTimeMs, 'the time is the whole clock').toBe('wholeClock');
    expect(formValues.bindings.state, 'the flag binding as chosen').toEqual({
      ...emptySchemaFormBindingValue,
      sourceId: 'simulador-enduro',
      pathKey: 'session:state',
    });
    expect(labelsOfFieldsThatCouldNotBeRead, 'nothing is unreadable').toEqual([]);
  });
});

describe('building item fields with bindings', () => {
  it('stores the flag binding and one whole-clock binding for a new item', () => {
    // Arrange: a new form with the flag and the time read from the simulator.
    const formValues = buildNewFormWithFlagAndWholeClockFromTheSimulator();

    // Act: build the new item's fields.
    const itemFields = buildItemFieldsFromSchemaForm(describeRaceClockForm(), formValues);

    // Assert: the title typed, the two bindings, the band switch at its default (on),
    // and no other clock field at all.
    expect(itemFields, 'the fields of the new item').toEqual({
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: buildSimulatorSessionBinding('state'),
      referenceTimeMs: buildSimulatorSessionBinding('clock'),
      showFlagBand: { kind: 'literal', value: true },
    });
  });

  it('sends only the changed binding, and nulls the clock fields a stored item filled', () => {
    // Arrange: an item stored with a typed clock and a typed flag.
    const storedFields: ItemFields = {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: 'green' },
      clockMode: { kind: 'literal', value: 'remaining' },
      referenceTimeMs: { kind: 'literal', value: 14_400_000 },
      referenceWallClockMs: { kind: 'takeTime' },
      running: { kind: 'literal', value: true },
    };
    const formValues = buildNewFormWithFlagAndWholeClockFromTheSimulator();

    // Act: build what changed.
    const changedFields = buildChangedItemFieldsFromSchemaForm(
      describeRaceClockForm(),
      formValues,
      storedFields,
    );

    // Assert: the two bindings, a null on each clock field the whole clock now fills,
    // and the band switch, which the stored item (saved before the switch existed) had
    // no value for and the form now holds at its default.
    expect(changedFields, 'what the save sends').toEqual({
      state: buildSimulatorSessionBinding('state'),
      referenceTimeMs: buildSimulatorSessionBinding('clock'),
      clockMode: { kind: 'literal', value: null },
      referenceWallClockMs: { kind: 'literal', value: null },
      running: { kind: 'literal', value: null },
      showFlagBand: { kind: 'literal', value: true },
    });
  });

  it('sends nothing for a binding that is stored as it is', () => {
    // Arrange: the bound clock as stored, and the form filled from it.
    const storedFields = buildStoredBoundClockFields();
    const { formValues } = buildSchemaFormValuesFromItemFields(
      describeRaceClockForm(),
      storedFields,
    );

    // Act: build what changed.
    const changedFields = buildChangedItemFieldsFromSchemaForm(
      describeRaceClockForm(),
      formValues,
      storedFields,
    );

    // Assert: nothing.
    expect(changedFields, 'an untouched form changes nothing').toEqual({});
  });
});

describe('checking a form with bindings', () => {
  const bindingScenarios = [
    // "Fonte" chosen and left there.
    {
      name: 'refuses a flag with no source, naming it',
      binding: { ...emptySchemaFormBindingValue },
      message: 'Escolha a fonte de dados de "Bandeira".',
    },
    // A source but nothing to read in it.
    {
      name: 'refuses a flag with no path, naming it',
      binding: { ...emptySchemaFormBindingValue, sourceId: 'simulador-enduro' },
      message: 'Escolha o que "Bandeira" lê da fonte.',
    },
    // A car chosen by number with the number left blank.
    {
      name: 'refuses a car chosen by number with no number, naming it',
      binding: {
        ...emptySchemaFormBindingValue,
        sourceId: 'simulador-enduro',
        pathKey: 'positions:entryOfCar.status',
      },
      message: 'Informe em "Bandeira" o número do carro, um inteiro de 1 para cima.',
    },
    // The parameter the shared registry refuses, with the field's name before it.
    {
      name: 'refuses a maximum length of 0 letters, naming the field',
      binding: {
        ...emptySchemaFormBindingValue,
        sourceId: 'simulador-enduro',
        pathKey: 'positions:entries.0.teamName',
        transformId: 'shortenSchoolName',
        transformParameterText: '0',
      },
      message: 'Bandeira: O tamanho máximo deve ser um inteiro de 4 a 60 letras.',
    },
  ];

  it.each(bindingScenarios)('$name', ({ binding, message }) => {
    // Arrange: the race clock form with the flag set to "Fonte" as this row chose it.
    const emptyForm = buildEmptySchemaFormValues(describeRaceClockForm());
    const formValues: SchemaFormValues = {
      ...emptyForm,
      kinds: { ...emptyForm.kinds, state: 'binding' },
      bindings: { ...emptyForm.bindings, state: binding },
    };

    // Act: check the form.
    const check = checkSchemaFormValues(describeRaceClockForm(), formValues);

    // Assert: refused, the message under the flag.
    expect(check, 'the binding must be refused with this message').toEqual({
      status: 'invalid',
      fieldMessages: [{ fieldKey: 'state', message }],
    });
  });
});
