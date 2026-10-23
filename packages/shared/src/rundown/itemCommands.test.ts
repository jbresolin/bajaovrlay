/**
 * Commands that prepare items: createItem, updateItemFields, deleteItem (packages/shared)
 *
 * What this module is for:
 *   Before a session the operator prepares items in the item editor. Saving a new one
 *   sends `createItem`; saving a change to one sends `updateItemFields`, which carries
 *   only what changed; removing one sends `deleteItem`. These schemas say what each of
 *   those commands must look like before the server even looks at its state.
 *
 * What these tests prove:
 *   - A createItem with only the required parts gets the colour `neutral` and empty
 *     notes, and no order or auto-out is invented for it.
 *   - A createItem with every part filled in is accepted unchanged.
 *   - A createItem is refused, with the field named, when the label is empty, the order
 *     is negative or not whole, the colour is not one of the six names, a field names a
 *     team in the first draft shape of an entity reference or the auto-out is zero.
 *   - An updateItemFields may change any one thing on its own (its layer included, since
 *     BAJAOVRLAY-36), may remove the auto-out with null, and adds nothing the editor did
 *     not send.
 *   - An updateItemFields without an item id, with a negative auto-out, or with an empty
 *     label or layer, is refused.
 *   - A graphic id sent in an updateItemFields is dropped by the schema: an item keeps
 *     its graphic for life (a different graphic is a new item).
 *   - A deleteItem needs the id of the item.
 *
 * What these tests deliberately do not cover:
 *   - Whether the rundown, graphic, layer or item named exists, where a new item lands
 *     among the others and how the rest are renumbered; that needs the state, so the
 *     reducers in apps/server check it.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CommandSchema } from '../commands/command.js';

const enduroClockItemId = 'b1f7c2d0-93a4-4e1b-8c55-0d2a6f3e7a10';

/** Builds the createItem the item editor sends when only the required parts are filled in. */
function buildCreateItemForTheEnduroClock() {
  return {
    type: 'createItem',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: 'green' },
    },
    label: 'Relógio do enduro — largada',
  };
}

describe('createItem', () => {
  it('fills in a neutral colour and empty notes when the editor sends neither', () => {
    // Arrange: a createItem with only the parts the brief makes mandatory.
    const createItemWithRequiredPartsOnly = buildCreateItemForTheEnduroClock();

    // Act: check the command.
    const result = CommandSchema.safeParse(createItemWithRequiredPartsOnly);

    // Assert: it is accepted, with the two defaults and nothing else added.
    expect(result.success, 'a createItem with the required parts must be accepted').toBe(true);
    expect(result.data, 'only the colour and the notes may be filled in').toEqual({
      ...createItemWithRequiredPartsOnly,
      color: 'neutral',
      notes: '',
    });
  });

  it('accepts a createItem with every part filled in, unchanged', () => {
    // Arrange: the editor filled in the position, colour, notes and an 8 s auto-out too.
    const createItemWithEveryPart = {
      ...buildCreateItemForTheEnduroClock(),
      order: 2,
      color: 'warning',
      notes: 'Só depois da volta de apresentação.',
      autoOutAfterMs: 8_000,
    };

    // Act: check the command.
    const result = CommandSchema.safeParse(createItemWithEveryPart);

    // Assert: it is accepted and nothing the editor wrote is altered.
    expect(result.success, 'a complete createItem must be accepted').toBe(true);
    expect(result.data, 'a complete createItem has no defaults to fill in').toEqual(
      createItemWithEveryPart,
    );
  });

  const refusedCreateItemScenarios = [
    // The label is how the operator finds the item in the rundown and on the layer panel.
    {
      name: 'refuses an empty label, naming label',
      changedPart: { label: '' },
      fieldNamedInTheFailure: 'label',
    },
    // Positions count from 0; "at the end" is said by leaving order out.
    {
      name: 'refuses a negative order, naming order',
      changedPart: { order: -1 },
      fieldNamedInTheFailure: 'order',
    },
    // A position between two items is not a position.
    {
      name: 'refuses an order that is not a whole number, naming order',
      changedPart: { order: 1.5 },
      fieldNamedInTheFailure: 'order',
    },
    // Only the six named colours exist; a raw colour would bypass the design tokens.
    {
      name: 'refuses a colour that is not one of the six names, naming color',
      changedPart: { color: 'purple' },
      fieldNamedInTheFailure: 'color',
    },
    // The concept's first draft of an entity reference said entityId; as built by
    // BAJAOVRLAY-19 a team is chosen by its car number, so that draft is refused.
    {
      name: 'refuses a team reference in the first draft shape, naming carNumber',
      changedPart: {
        fields: {
          sessionName: { kind: 'entity', entityType: 'team', entityId: '42', attribute: 'name' },
        },
      },
      fieldNamedInTheFailure: 'carNumber',
    },
    // "No auto-out" is said by leaving the field out; zero would clear the layer at once.
    {
      name: 'refuses an auto-out of zero milliseconds, naming autoOutAfterMs',
      changedPart: { autoOutAfterMs: 0 },
      fieldNamedInTheFailure: 'autoOutAfterMs',
    },
  ];

  it.each(refusedCreateItemScenarios)('$name', ({ changedPart, fieldNamedInTheFailure }) => {
    // Arrange: the enduro clock's createItem with one part replaced by the bad one.
    const createItemWithOneBadPart = { ...buildCreateItemForTheEnduroClock(), ...changedPart };

    // Act: check it and turn the failure into readable text.
    const result = CommandSchema.safeParse(createItemWithOneBadPart);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at the bad field.
    expect(result.success, 'a createItem with a bad part must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the bad field').toContain(fieldNamedInTheFailure);
  });
});

describe('updateItemFields', () => {
  const acceptedUpdateScenarios = [
    // The operator only renamed the item.
    {
      name: 'accepts a change of the label alone',
      changes: { label: 'Relógio do enduro — relargada' },
    },
    // The flag changed: only that one field is sent, the others stay as they are.
    {
      name: 'accepts a change of one field value alone',
      changes: { fields: { state: { kind: 'literal', value: 'yellow' } } },
    },
    // Colour and notes are edited together in the same form.
    {
      name: 'accepts a change of colour and notes',
      changes: { color: 'danger', notes: 'Usar somente em bandeira vermelha.' },
    },
    // The operator typed a new auto-out of 12 s.
    { name: 'accepts a new auto-out delay', changes: { autoOutAfterMs: 12_000 } },
    // The operator emptied the auto-out box: null means "stay on air until cleared".
    { name: 'accepts null to remove the auto-out', changes: { autoOutAfterMs: null } },
    // "Editar item" moved the item to another layer (BAJAOVRLAY-36); the next take uses it.
    { name: 'accepts a change of the layer alone', changes: { layerId: 'lower-third' } },
    // Saving the editor without touching anything; the server has nothing to change.
    { name: 'accepts an update that changes nothing', changes: {} },
  ];

  it.each(acceptedUpdateScenarios)('$name', ({ changes }) => {
    // Arrange: an update of the enduro clock item carrying the changes from the table.
    const updateOfTheEnduroClockItem = {
      type: 'updateItemFields',
      itemId: enduroClockItemId,
      ...changes,
    };

    // Act: check the command.
    const result = CommandSchema.safeParse(updateOfTheEnduroClockItem);

    // Assert: it is accepted and carries only what the editor sent.
    expect(result.success, 'a partial update of an item must be accepted').toBe(true);
    expect(result.data, 'nothing the editor did not send may be added').toEqual(
      updateOfTheEnduroClockItem,
    );
  });

  const refusedUpdateScenarios = [
    // Without the id the server cannot know which item to change.
    {
      name: 'refuses an update that does not say which item, naming itemId',
      command: { type: 'updateItemFields', label: 'Relógio do enduro — relargada' },
      fieldNamedInTheFailure: 'itemId',
    },
    // A delay cannot run backwards.
    {
      name: 'refuses a negative auto-out, naming autoOutAfterMs',
      command: { type: 'updateItemFields', itemId: enduroClockItemId, autoOutAfterMs: -8_000 },
      fieldNamedInTheFailure: 'autoOutAfterMs',
    },
    // An item must keep a label the operator can read.
    {
      name: 'refuses a label changed to an empty text, naming label',
      command: { type: 'updateItemFields', itemId: enduroClockItemId, label: '' },
      fieldNamedInTheFailure: 'label',
    },
    // An empty text names no layer; "keep the layer" is said by leaving layerId out.
    {
      name: 'refuses a layer changed to an empty text, naming layerId',
      command: { type: 'updateItemFields', itemId: enduroClockItemId, layerId: '' },
      fieldNamedInTheFailure: 'layerId',
    },
  ];

  it.each(refusedUpdateScenarios)('$name', ({ command, fieldNamedInTheFailure }) => {
    // Arrange: the bad update from the table above.
    const updateWithOneBadPart = command;

    // Act: check it and turn the failure into readable text.
    const result = CommandSchema.safeParse(updateWithOneBadPart);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at the bad field.
    expect(result.success, 'an update with a bad part must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the bad field').toContain(fieldNamedInTheFailure);
  });

  it('drops a graphic id from the update, so an item can never change its graphic', () => {
    // Arrange: an update that tries to turn the enduro clock item into a team lower third,
    // as an older or confused client might send it.
    const updateTryingToChangeTheGraphic = {
      type: 'updateItemFields',
      itemId: enduroClockItemId,
      label: 'Relógio do enduro — relargada',
      graphicId: 'team-lower-third',
    };

    // Act: check the command.
    const result = CommandSchema.safeParse(updateTryingToChangeTheGraphic);

    // Assert: accepted for what it may change, and the graphic id is gone: the schema has
    // no such field and, like every command schema, leaves out a key it does not know.
    expect(result.success, 'the rest of the update is well formed').toBe(true);
    expect(result.data, 'the graphic id must not survive validation').toEqual({
      type: 'updateItemFields',
      itemId: enduroClockItemId,
      label: 'Relógio do enduro — relargada',
    });
  });
});

describe('deleteItem', () => {
  it('accepts a deleteItem that names the item', () => {
    // Arrange: the operator removes the enduro clock item from the rundown.
    const deleteTheEnduroClockItem = { type: 'deleteItem', itemId: enduroClockItemId };

    // Act: check the command.
    const result = CommandSchema.safeParse(deleteTheEnduroClockItem);

    // Assert: it is accepted unchanged.
    expect(result.success, 'a deleteItem with an item id must be accepted').toBe(true);
    expect(result.data, 'a deleteItem has no defaults to fill in').toEqual(
      deleteTheEnduroClockItem,
    );
  });

  it('refuses a deleteItem whose item id is empty, naming itemId', () => {
    // Arrange: a deleteItem sent with nothing selected.
    const deleteWithEmptyItemId = { type: 'deleteItem', itemId: '' };

    // Act: check it and turn the failure into readable text.
    const result = CommandSchema.safeParse(deleteWithEmptyItemId);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at itemId.
    expect(result.success, 'a deleteItem must say which item').toBe(false);
    expect(failureMessage, 'the failure must name the bad field').toContain('itemId');
  });
});
