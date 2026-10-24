/**
 * Filling a generated form from a stored item (apps/control)
 *
 * What this module is for:
 *   When the operator opens an item of the rundown, the editor's generated form must
 *   show what the item stores: a literal as its value, and "takeTime" as "filled by the
 *   server at the take". buildSchemaFormValuesFromItemFields builds those form values
 *   and lists the fields it could not show, so the editor can warn that saving writes
 *   what the form shows.
 *
 * What these tests prove:
 *   - Stored literals are shown, and a stored `takeTime` shows as "filled by the server"
 *     where the form offers that; a literal number stored there shows as typed.
 *   - A stored value the form cannot show falls back to the starting value and is listed
 *     by its label; the field starts as in a new item, so a typed field stays typed.
 *   - A wall-clock field the item does not store, or stores as something the form cannot
 *     show, starts as in a new item: "filled by the server".
 *   - An optional field stored as null, or an optional text stored empty, is cleared and
 *     not listed; a stored value the form cannot edit is kept as JSON text for reading.
 *
 * What these tests deliberately do not cover:
 *   - An empty form and a form filled from what is on air: buildSchemaFormValues.test.ts.
 *   - What a save sends back: itemFieldsFromSchemaForm.test.ts.
 */
import raceClockManifest from '@bajaovrlay/race-clock/race-clock.ograf.json';
import type { ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { buildSchemaFormValuesFromItemFields } from './buildSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import { describeLowerThirdFixtureForm } from './lowerThirdFixtureSchema.testSupport';

/** The real race clock's schema as the form reads it. */
function describeRaceClockForm() {
  return describeSchemaFormFromDataSchema(raceClockManifest.schema);
}

describe('buildSchemaFormValuesFromItemFields', () => {
  it('shows stored literals and a stored takeTime as "filled by the server"', () => {
    // Arrange: a race clock item as the editor saves it: typed fields as literals, the
    // reference moment as takeTime, no laps.
    const description = describeRaceClockForm();
    const itemFields: ItemFields = {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência — Bateria 2' },
      state: { kind: 'literal', value: 'pre' },
      clockMode: { kind: 'literal', value: 'remaining' },
      referenceTimeMs: { kind: 'literal', value: 14_400_000 },
      referenceWallClockMs: { kind: 'takeTime' },
      running: { kind: 'literal', value: true },
    };

    // Act: fill the form from it.
    const formRead = buildSchemaFormValuesFromItemFields(description, itemFields);

    // Assert: the form shows the stored item, and nothing had to fall back.
    expect(formRead.formValues.values, 'the stored literals must be shown').toMatchObject({
      sessionName: 'Enduro de Resistência — Bateria 2',
      state: 'pre',
      clockMode: 'remaining',
      referenceTimeMs: '240:00',
      running: true,
      lapsCompletedByLeader: null,
    });
    expect(
      formRead.formValues.kinds.referenceWallClockMs,
      'a stored takeTime must show as "filled by the server"',
    ).toBe('takeTime');
    expect(formRead.labelsOfFieldsThatCouldNotBeRead, 'every field could be shown').toEqual([]);
  });

  it('shows a literal number stored as the reference moment as a typed number', () => {
    // Arrange: an item saved before the takeTime ruling, with a moment written as a number.
    const description = describeRaceClockForm();
    const momentStoredByTheOlderEditor = Date.parse('2026-10-09T21:30:00.000Z');
    const itemFields: ItemFields = {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: 'pre' },
      clockMode: { kind: 'literal', value: 'elapsed' },
      referenceTimeMs: { kind: 'literal', value: 0 },
      referenceWallClockMs: { kind: 'literal', value: momentStoredByTheOlderEditor },
      running: { kind: 'literal', value: false },
    };

    // Act: fill the form from it.
    const formRead = buildSchemaFormValuesFromItemFields(description, itemFields);

    // Assert: the stored kind is the one shown.
    expect(formRead.formValues.kinds.referenceWallClockMs, 'the stored kind is literal').toBe(
      'literal',
    );
    expect(formRead.formValues.values.referenceWallClockMs, 'the stored number is shown').toBe(
      String(momentStoredByTheOlderEditor),
    );
  });

  const storedFieldsThatFallBack = [
    // A takeTime on a field whose editor offers no such kind (stored through the API).
    {
      name: 'a takeTime stored on a field that does not offer it',
      key: 'numeroDoCarro',
      storedField: { kind: 'takeTime' },
      label: 'Número do carro',
    },
    // A literal of the wrong type.
    {
      name: 'a text stored where a switch belongs',
      key: 'destaque',
      storedField: { kind: 'literal', value: 'sim' },
      label: 'Destaque',
    },
    // A required field stored as null has no value to show.
    {
      name: 'a null stored in a required field',
      key: 'nome',
      storedField: { kind: 'literal', value: null },
      label: 'Nome',
    },
  ] as const;

  it.each(storedFieldsThatFallBack)('falls back and lists $name', ({ key, storedField, label }) => {
    // Arrange: car 42's lower third stored as literals, with one field replaced.
    const description = describeLowerThirdFixtureForm();
    const itemFields: ItemFields = {
      nome: { kind: 'literal', value: 'Ana Souza' },
      equipe: { kind: 'literal', value: 'baja-ufpr' },
      duracaoMs: { kind: 'literal', value: 8_000 },
      destaque: { kind: 'literal', value: true },
      numeroDoCarro: { kind: 'literal', value: 42 },
      [key]: storedField,
    };

    // Act: fill the form from it.
    const formRead = buildSchemaFormValuesFromItemFields(description, itemFields);

    // Assert: that field alone is named, and it is shown as a typed field.
    expect(
      formRead.labelsOfFieldsThatCouldNotBeRead,
      'only the unusable field must be named',
    ).toEqual([label]);
    expect(formRead.formValues.kinds[key], 'the fallback is a typed field').toBe('literal');
  });

  it('starts a missing required wall-clock field as "filled by the server", and lists it', () => {
    // Arrange: a race clock item stored without its reference moment.
    const description = describeRaceClockForm();
    const itemFields: ItemFields = {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: 'pre' },
      clockMode: { kind: 'literal', value: 'elapsed' },
      referenceTimeMs: { kind: 'literal', value: 0 },
      running: { kind: 'literal', value: false },
    };

    // Act: fill the form from it.
    const formRead = buildSchemaFormValuesFromItemFields(description, itemFields);

    // Assert: the next save gives the item a moment it can use.
    expect(
      formRead.formValues.kinds.referenceWallClockMs,
      'a missing reference moment must start as in a new item',
    ).toBe('takeTime');
    expect(
      formRead.labelsOfFieldsThatCouldNotBeRead,
      'a missing required field is reported by its label',
    ).toHaveLength(1);
  });

  it('starts a reference moment stored as text as "filled by the server", and lists it', () => {
    // Arrange: a race clock item written through the API with a date text as its
    // reference moment, where the graphic expects milliseconds.
    const description = describeRaceClockForm();
    const itemFields: ItemFields = {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: 'pre' },
      clockMode: { kind: 'literal', value: 'elapsed' },
      referenceTimeMs: { kind: 'literal', value: 0 },
      referenceWallClockMs: { kind: 'literal', value: '2026-10-10T12:45:00.000Z' },
      running: { kind: 'literal', value: false },
    };

    // Act: fill the form from it.
    const formRead = buildSchemaFormValuesFromItemFields(description, itemFields);

    // Assert: the field starts as in a new item, not as the typed default 0 (1 January
    // 1970), so the next save stores a moment the clock can count from.
    expect(
      formRead.formValues.kinds.referenceWallClockMs,
      'an unreadable reference moment must start as in a new item',
    ).toBe('takeTime');
    expect(
      formRead.labelsOfFieldsThatCouldNotBeRead,
      'the operator must be told the field does not show what is stored',
    ).toEqual([raceClockManifest.schema.properties.referenceWallClockMs.title]);
  });

  it('treats an optional field stored as null as cleared, without listing it', () => {
    // Arrange: a lower third whose "cargo" was cleared in an earlier save (stored null,
    // because updateItemFields cannot remove a key).
    const description = describeLowerThirdFixtureForm();
    const itemFields: ItemFields = {
      nome: { kind: 'literal', value: 'Ana Souza' },
      cargo: { kind: 'literal', value: null },
      equipe: { kind: 'literal', value: 'baja-ufpr' },
      duracaoMs: { kind: 'literal', value: 8_000 },
      destaque: { kind: 'literal', value: false },
      numeroDoCarro: { kind: 'literal', value: 42 },
      patrocinadores: { kind: 'literal', value: [{ nome: 'Oficina do Zé' }] },
    };

    // Act: fill the form from it.
    const formRead = buildSchemaFormValuesFromItemFields(description, itemFields);

    // Assert: cleared, not a problem; and the stored list is kept for reading.
    expect(formRead.formValues.values.cargo, 'a stored null is a cleared field').toBeNull();
    expect(formRead.labelsOfFieldsThatCouldNotBeRead, 'nothing fell back').toEqual([]);
    expect(
      formRead.formValues.unsupportedValuesAsJson,
      'the stored list must be kept as JSON text',
    ).toEqual([{ key: 'patrocinadores', jsonText: '[\n  {\n    "nome": "Oficina do Zé"\n  }\n]' }]);
  });

  it('treats an optional text stored as the empty text as cleared, without listing it', () => {
    // Arrange: a lower third created through the API with an empty "cargo".
    const description = describeLowerThirdFixtureForm();
    const itemFields: ItemFields = {
      nome: { kind: 'literal', value: 'Ana Souza' },
      cargo: { kind: 'literal', value: '' },
      equipe: { kind: 'literal', value: 'baja-ufpr' },
      duracaoMs: { kind: 'literal', value: 8_000 },
      destaque: { kind: 'literal', value: false },
      numeroDoCarro: { kind: 'literal', value: 42 },
    };

    // Act: fill the form from it.
    const formRead = buildSchemaFormValuesFromItemFields(description, itemFields);

    // Assert: the form holds null, the same as after the operator empties the field.
    expect(
      formRead.formValues.values.cargo,
      'an empty optional text is a cleared field',
    ).toBeNull();
    expect(formRead.labelsOfFieldsThatCouldNotBeRead, 'nothing fell back').toEqual([]);
  });
});
