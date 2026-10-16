/**
 * How a field of an item gets its value: literal or the time of the take (packages/shared)
 *
 * What this module is for:
 *   An item stores, for each field of its graphic, how that field gets its value. A
 *   `literal` is what the operator typed, used as typed. A `takeTime` is filled in by
 *   the server at the moment the item goes on air, with the wall-clock milliseconds of
 *   that take. The race clock needs it: a clock prepared on Friday must start counting
 *   when it is fired on Saturday, not from the moment it was saved.
 *
 * What these tests prove:
 *   - A literal and a takeTime are both accepted as field values, unchanged.
 *   - A takeTime that carries a value is refused, naming `value`: the server decides
 *     the time, so a value written next to it would be silently ignored.
 *   - A kind that only arrives in M2 (a binding) is still refused, naming `kind`.
 *   - A takeTime field is accepted inside a stored item, inside a createItem command
 *     and inside an updateItemFields command, and comes back exactly as written.
 *   - A takeTime carrying a value is refused inside those two commands as well.
 *
 * What these tests deliberately do not cover:
 *   - Turning a takeTime into milliseconds; resolveItemFieldsIntoGraphicData in
 *     apps/server does that at the take.
 *   - Whether the graphic's field is one that can hold a time; the server checks the
 *     resolved data against the graphic's own schema at the take.
 *   - The other rules of a literal (it must have a value), of items and of the two
 *     commands; rundownAndItemSlices.test.ts and itemCommands.test.ts cover those.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CommandSchema } from '../commands/command.js';
import { FieldValueSchema } from './fieldValue.js';
import { ItemSchema } from './item.js';

const enduroClockItemId = 'b1f7c2d0-93a4-4e1b-8c55-0d2a6f3e7a10';

/**
 * Builds the fields of an enduro clock that starts counting when it is fired: the
 * typed time is a literal and the reference moment is stamped at the take.
 */
function buildEnduroClockFieldsStampedAtTheTake() {
  return {
    sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
    state: { kind: 'literal', value: 'green' },
    clockMode: { kind: 'literal', value: 'remaining' },
    referenceTimeMs: { kind: 'literal', value: 14_400_000 },
    referenceWallClockMs: { kind: 'takeTime' },
    running: { kind: 'literal', value: true },
  };
}

/** Builds the stored item of the enduro clock with the fields given. */
function buildEnduroClockItemWithFields(fields: Record<string, unknown>) {
  return {
    id: enduroClockItemId,
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    order: 0,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields,
    label: 'Relógio do enduro — largada',
    color: 'success',
    notes: 'Colocar no ar quando o diretor de prova der a bandeira verde.',
  };
}

/** Builds the createItem the item editor sends for the enduro clock, with the fields given. */
function buildCreateItemForTheEnduroClockWithFields(fields: Record<string, unknown>) {
  return {
    type: 'createItem',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    graphicId: 'race-clock',
    layerId: 'clock',
    fields,
    label: 'Relógio do enduro — largada',
    color: 'success',
    notes: '',
  };
}

describe('FieldValueSchema', () => {
  const acceptedFieldValueScenarios = [
    // What the operator typed in the item editor, used exactly as typed.
    {
      name: 'accepts a literal with the typed session name',
      fieldValue: { kind: 'literal', value: 'Enduro de Resistência' },
    },
    // The new kind: it says "the server fills this in at the take" and holds nothing else.
    { name: 'accepts a takeTime, which carries no value', fieldValue: { kind: 'takeTime' } },
  ];

  it.each(acceptedFieldValueScenarios)('$name', ({ fieldValue }) => {
    // Arrange: the field value from the table above.
    const fieldValueAsWritten = fieldValue;

    // Act: check it against the schema.
    const result = FieldValueSchema.safeParse(fieldValueAsWritten);

    // Assert: it is accepted and comes back exactly as written.
    expect(result.success, 'a literal and a takeTime must both be accepted').toBe(true);
    expect(result.data, 'the accepted field value must not be altered').toEqual(
      fieldValueAsWritten,
    );
  });

  it('refuses a takeTime that carries a value, because of that extra value', () => {
    // Arrange: a takeTime with a moment written next to it by hand. That moment would be
    // thrown away at the take, so whoever wrote it must be told instead of believing it.
    const takeTimeCarryingAValue = { kind: 'takeTime', value: 1_791_550_800_000 };

    // Act: check it and read the reasons the schema gives.
    const result = FieldValueSchema.safeParse(takeTimeCarryingAValue);
    const reasonsForRefusal = result.error ? result.error.issues : [];

    // Assert: refused for exactly one reason, the part that should not be there.
    expect(result.success, 'a takeTime carrying a value must be refused').toBe(false);
    expect(reasonsForRefusal, 'the extra value must be the only complaint').toHaveLength(1);
    expect(reasonsForRefusal[0], 'the complaint must be about the extra key `value`').toMatchObject(
      { code: 'unrecognized_keys', keys: ['value'] },
    );
  });

  const refusedFieldValueScenarios = [
    // Bindings to data sources arrive in M2 (BAJAOVRLAY-20); adding takeTime did not open
    // the door to them.
    {
      name: 'refuses a field bound to a data source, naming kind',
      fieldValue: { kind: 'binding', sourceId: 'cronometragem', path: 'session.flag' },
      wordInTheFailure: 'kind',
    },
    // A field value must say how it gets its value; one with no kind says nothing.
    {
      name: 'refuses a field value that has no kind, naming kind',
      fieldValue: { value: 'Enduro de Resistência' },
      wordInTheFailure: 'kind',
    },
  ];

  it.each(refusedFieldValueScenarios)('$name', ({ fieldValue, wordInTheFailure }) => {
    // Arrange: the bad field value from the table above.
    const badFieldValue = fieldValue;

    // Act: check it and turn the failure into readable text.
    const result = FieldValueSchema.safeParse(badFieldValue);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at what is wrong.
    expect(result.success, 'a field value with a bad part must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the bad part').toContain(wordInTheFailure);
  });
});

describe('a takeTime field inside an item and inside the commands that carry fields', () => {
  it('is accepted in a stored item, unchanged', () => {
    // Arrange: the enduro clock item whose reference moment is stamped at the take.
    const enduroClockItem = buildEnduroClockItemWithFields(
      buildEnduroClockFieldsStampedAtTheTake(),
    );

    // Act: check it against the item schema.
    const result = ItemSchema.safeParse(enduroClockItem);

    // Assert: it is accepted, and the takeTime field is still a takeTime with no value.
    expect(result.success, 'an item with a takeTime field must be accepted').toBe(true);
    expect(result.data, 'the accepted item must not be altered').toEqual(enduroClockItem);
  });

  it('is accepted in a createItem command, unchanged', () => {
    // Arrange: what the item editor sends when a new enduro clock is saved.
    const createItemWithTakeTime = buildCreateItemForTheEnduroClockWithFields(
      buildEnduroClockFieldsStampedAtTheTake(),
    );

    // Act: check the command.
    const result = CommandSchema.safeParse(createItemWithTakeTime);

    // Assert: it is accepted and nothing the editor wrote is altered.
    expect(result.success, 'a createItem with a takeTime field must be accepted').toBe(true);
    expect(result.data, 'the accepted createItem must not be altered').toEqual(
      createItemWithTakeTime,
    );
  });

  it('is accepted in an updateItemFields command, unchanged', () => {
    // Arrange: an item saved before this ruling gets its saved moment replaced by takeTime.
    const updateThatStampsTheReferenceAtTheTake = {
      type: 'updateItemFields',
      itemId: enduroClockItemId,
      fields: { referenceWallClockMs: { kind: 'takeTime' } },
    };

    // Act: check the command.
    const result = CommandSchema.safeParse(updateThatStampsTheReferenceAtTheTake);

    // Assert: it is accepted and carries only what the editor sent.
    expect(result.success, 'an update with a takeTime field must be accepted').toBe(true);
    expect(result.data, 'the accepted update must not be altered').toEqual(
      updateThatStampsTheReferenceAtTheTake,
    );
  });

  const commandsCarryingATakeTimeWithAValue = [
    // A script creating items could write the moment by hand next to takeTime.
    {
      name: 'refuses a createItem whose takeTime field carries a value, naming value',
      command: buildCreateItemForTheEnduroClockWithFields({
        referenceWallClockMs: { kind: 'takeTime', value: 1_791_550_800_000 },
      }),
    },
    // The same mistake on the other command that carries fields.
    {
      name: 'refuses an updateItemFields whose takeTime field carries a value, naming value',
      command: {
        type: 'updateItemFields',
        itemId: enduroClockItemId,
        fields: { referenceWallClockMs: { kind: 'takeTime', value: 1_791_550_800_000 } },
      },
    },
  ];

  it.each(commandsCarryingATakeTimeWithAValue)('$name', ({ command }) => {
    // Arrange: the command from the table above.
    const commandWithABadField = command;

    // Act: check it and turn the failure into readable text.
    const result = CommandSchema.safeParse(commandWithABadField);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused, and the message points at the field and at its extra value.
    expect(result.success, 'a takeTime carrying a value must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the field of the item').toContain(
      'referenceWallClockMs',
    );
    expect(failureMessage, 'the failure must say the extra part is not recognised').toContain(
      'Unrecognized key: "value"',
    );
  });
});
