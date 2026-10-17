/**
 * Item editor: the commands built from the editor (apps/control)
 *
 * What this module is for:
 *   The item editor sends up to three commands. "Salvar item" sends `createItem` for a
 *   new item, carrying the whole form, or `updateItemFields` for an existing one,
 *   carrying only what the operator changed, so two operators editing different parts of
 *   the same item do not undo each other. "Atualizar no ar" also sends
 *   `updateInstanceData`, which changes the item's instance on air.
 *   itemCommandsFromEditor builds the three from values that already passed their rules,
 *   without drawing anything. The graphic's own fields reach it already built by the
 *   generated form (features/schemaForm), so it treats every graphic alike.
 *
 * What these tests prove:
 *   - A new item becomes exactly the `createItem` the server expects: the rundown,
 *     graphic, layer, trimmed label, colour, notes, the fields as handed in, and the
 *     auto-out delay in milliseconds (left out when blank). No position is sent.
 *   - A graphic that takes no data is created with empty fields.
 *   - An update names only the parts that differ from the stored item, and carries the
 *     changed fields exactly as handed in; with no changed field it carries no `fields`.
 *   - A changed layer travels as `layerId` and nothing else with it.
 *   - Auto-out: a new number sets it, blank over a stored delay sends `null` (remove),
 *     and an untouched delay is not sent.
 *   - An edit that changed nothing builds no command at all.
 *   - The on-air update carries a changed value as that value and a cleared field as
 *     null, never a field left to be stamped at the take, and asks the server to stamp
 *     nothing; with no value to change on air it builds no command.
 *
 * What these tests deliberately do not cover:
 *   - Reading the fields out of the generated form, and finding which of them differ
 *     from the stored item: features/schemaForm/itemFieldsFromSchemaForm.test.ts.
 *   - The rules that refuse a badly filled form: itemEditorForm.test.ts and
 *     features/schemaForm/checkSchemaFormValues.test.ts. These builders get valid values.
 *   - When each command is sent: the ItemEditorPanel test files.
 *   - What the server does with the commands (apps/server).
 */
import type { ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildCreateItemCommand,
  buildUpdateInstanceDataCommandFromChangedFields,
  buildUpdateItemFieldsCommand,
} from './itemCommandsFromEditor';
import type { ItemEditorFormValues } from './itemEditorForm';
import {
  buildEnduranceStartClockItem,
  buildInterviewLowerThirdItem,
  idOfTheMainSessionRundown,
} from './itemsLikeTheEditorSaves.testSupport';

/** The item part of the form exactly as the stored endurance start item fills it. */
function buildItemFormShowingTheEnduranceStartItem(): ItemEditorFormValues {
  return {
    graphicId: 'race-clock',
    layerId: 'clock',
    label: 'Largada do Enduro',
    color: 'success',
    notes: 'Entrar quando os carros alinharem.',
    autoOutAfterSeconds: '',
  };
}

/** The item part of the form exactly as the stored interview lower third fills it. */
function buildItemFormShowingTheInterviewLowerThird(): ItemEditorFormValues {
  return {
    graphicId: 'lower-third-fixture',
    layerId: 'lower-third',
    label: 'Tarja da equipe 42',
    color: 'info',
    notes: '',
    autoOutAfterSeconds: '8',
  };
}

describe('buildCreateItemCommand', () => {
  it('turns the form of a new item into the exact createItem command', () => {
    // Arrange: a new item for the endurance start, typed on Friday evening, with a
    // label pasted with stray spaces and an auto-out of 90 seconds. Its fields are the
    // ones the generated form built for the race clock.
    const itemFormValues: ItemEditorFormValues = {
      ...buildItemFormShowingTheEnduranceStartItem(),
      label: '  Largada do Enduro ',
      autoOutAfterSeconds: '90',
    };
    const fieldsFromTheGeneratedForm = buildEnduranceStartClockItem().fields;

    // Act: build the command.
    const command = buildCreateItemCommand({
      home: { kind: 'rundown', rundownId: idOfTheMainSessionRundown },
      itemFormValues,
      fields: fieldsFromTheGeneratedForm,
    });

    // Assert: the whole command, part by part (90 s is 90 000 ms). The fields travel
    // exactly as handed in, the reference moment still left for the server to stamp.
    expect(command, 'the command must be exactly what the server expects').toEqual({
      type: 'createItem',
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
      graphicId: 'race-clock',
      layerId: 'clock',
      label: 'Largada do Enduro',
      color: 'success',
      notes: 'Entrar quando os carros alinharem.',
      autoOutAfterMs: 90_000,
      fields: {
        sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
        state: { kind: 'literal', value: 'pre' },
        clockMode: { kind: 'literal', value: 'remaining' },
        referenceTimeMs: { kind: 'literal', value: 14_400_000 },
        referenceWallClockMs: { kind: 'takeTime' },
        running: { kind: 'literal', value: false },
      },
    });
  });

  it('leaves the auto-out and the position out, so the item goes to the end and stays on air', () => {
    // Arrange: the same new item with the auto-out left blank.
    const itemFormValues = buildItemFormShowingTheEnduranceStartItem();

    // Act: build the command.
    const command = buildCreateItemCommand({
      home: { kind: 'rundown', rundownId: idOfTheMainSessionRundown },
      itemFormValues,
      fields: buildEnduranceStartClockItem().fields,
    });

    // Assert: neither key is in the command; the server reads their absence.
    expect(command, 'a blank auto-out must not be sent at all').not.toHaveProperty(
      'autoOutAfterMs',
    );
    expect(command, 'the editor never chooses a position; the server appends').not.toHaveProperty(
      'order',
    );
  });

  it('creates an item of a graphic that takes no data with empty fields', () => {
    // Arrange: a new item of a graphic whose manifest has no data schema (a plain logo),
    // so the generated form has no field and hands in nothing.
    const itemFormValues: ItemEditorFormValues = {
      graphicId: 'logo-da-competicao',
      layerId: 'bug',
      label: 'Logo Baja SAE Brasil',
      color: 'neutral',
      notes: '',
      autoOutAfterSeconds: '',
    };

    // Act: build the command.
    const command = buildCreateItemCommand({
      home: { kind: 'rundown', rundownId: idOfTheMainSessionRundown },
      itemFormValues,
      fields: {},
    });

    // Assert: the item is created with no field values.
    expect(command, 'an item without data must be created with empty fields').toEqual({
      type: 'createItem',
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
      graphicId: 'logo-da-competicao',
      layerId: 'bug',
      label: 'Logo Baja SAE Brasil',
      color: 'neutral',
      notes: '',
      fields: {},
    });
  });
});

describe('buildUpdateItemFieldsCommand', () => {
  const idOfTheEnduranceStartItem = '0b6f2d1e-8c47-4e39-9a15-3d7c5e2f4a90';

  const scenariosOfAnEditedEnduranceStartItem: Array<{
    name: string;
    changesToTheItemForm: Partial<ItemEditorFormValues>;
    changedFields: ItemFields;
    expectedCommand: Record<string, unknown>;
  }> = [
    // The everyday edit: a better label, nothing else. No field value may travel, or
    // another operator's change to a field would be undone.
    {
      name: 'a new label sends only the label',
      changesToTheItemForm: { label: 'Largada — Enduro de Resistência' },
      changedFields: {},
      expectedCommand: {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        label: 'Largada — Enduro de Resistência',
      },
    },
    // Colour and notes are independent parts and travel only when changed.
    {
      name: 'a new colour and emptied notes send those two parts',
      changesToTheItemForm: { color: 'warning', notes: '' },
      changedFields: {},
      expectedCommand: {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        color: 'warning',
        notes: '',
      },
    },
    // Typing a delay on an item that had none sets it, in milliseconds.
    {
      name: 'an auto-out of 45 seconds typed on an item without one sends 45 000 ms',
      changesToTheItemForm: { autoOutAfterSeconds: '45' },
      changedFields: {},
      expectedCommand: {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        autoOutAfterMs: 45_000,
      },
    },
    // Only a field of the graphic changed: it travels alone, with no label or colour.
    {
      name: 'one changed field sends that field and no other part',
      changesToTheItemForm: {},
      changedFields: { state: { kind: 'literal', value: 'green' } },
      expectedCommand: {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        fields: { state: { kind: 'literal', value: 'green' } },
      },
    },
    // A cleared field reaches the command as a literal null, the only way the update
    // command has to say "no value": it cannot remove a key.
    {
      name: 'a cleared field is sent as the literal null it was handed in as',
      changesToTheItemForm: {},
      changedFields: { lapsCompletedByLeader: { kind: 'literal', value: null } },
      expectedCommand: {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        fields: { lapsCompletedByLeader: { kind: 'literal', value: null } },
      },
    },
    // A label and a field in the same save travel in one command.
    {
      name: 'a new label and a changed field travel together',
      changesToTheItemForm: { label: 'Largada — Enduro de Resistência' },
      changedFields: { referenceTimeMs: { kind: 'literal', value: 5_400_000 } },
      expectedCommand: {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        label: 'Largada — Enduro de Resistência',
        fields: { referenceTimeMs: { kind: 'literal', value: 5_400_000 } },
      },
    },
    // Since BAJAOVRLAY-36 a stored item's layer can be changed: the clock moved to the
    // lower-third layer travels as `layerId`, and nothing else does.
    {
      name: 'a new layer sends only the layer',
      changesToTheItemForm: { layerId: 'lower-third' },
      changedFields: {},
      expectedCommand: {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        layerId: 'lower-third',
      },
    },
  ];

  it.each(scenariosOfAnEditedEnduranceStartItem)(
    'editing the endurance start item: $name',
    ({ changesToTheItemForm, changedFields, expectedCommand }) => {
      // Arrange: the stored item, the item part of the form as the item filled it with
      // only the scenario's changes on top, and the fields the generated form found changed.
      const itemBeingEdited = buildEnduranceStartClockItem();
      const itemFormValues: ItemEditorFormValues = {
        ...buildItemFormShowingTheEnduranceStartItem(),
        ...changesToTheItemForm,
      };

      // Act: build the update.
      const command = buildUpdateItemFieldsCommand({
        itemBeingEdited,
        itemFormValues,
        changedFields,
      });

      // Assert: the command names the item and only what changed.
      expect(command, 'the update must carry only what the operator changed').toEqual(
        expectedCommand,
      );
    },
  );

  it('builds no command when nothing was changed', () => {
    // Arrange: the stored item, the form exactly as the item filled it, no changed field.
    const itemBeingEdited = buildEnduranceStartClockItem();

    // Act: build the update.
    const command = buildUpdateItemFieldsCommand({
      itemBeingEdited,
      itemFormValues: buildItemFormShowingTheEnduranceStartItem(),
      changedFields: {},
    });

    // Assert: there is nothing to send; opening and saving an item must never change it.
    expect(command, 'an untouched form must not build a command').toBeUndefined();
  });

  it('sends null to remove the auto-out when the operator blanks a stored delay', () => {
    // Arrange: the lower third of team 42, which leaves after 8 s, with the delay erased.
    const itemBeingEdited = buildInterviewLowerThirdItem();
    const itemFormValues: ItemEditorFormValues = {
      ...buildItemFormShowingTheInterviewLowerThird(),
      autoOutAfterSeconds: '',
    };

    // Act: build the update.
    const command = buildUpdateItemFieldsCommand({
      itemBeingEdited,
      itemFormValues,
      changedFields: {},
    });

    // Assert: null is how the command says "remove the delay"; its fields are not touched.
    expect(command, 'a blanked delay must be sent as null, and no field may travel').toEqual({
      type: 'updateItemFields',
      itemId: '5e1a9c73-2b64-4f08-b3d1-7a9e0c6d8f25',
      autoOutAfterMs: null,
    });
  });
});

describe('buildUpdateInstanceDataCommandFromChangedFields', () => {
  const idOfTheClockInstanceOnAir = '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11';

  it('sends each changed value as it is and a cleared field as null', () => {
    // Arrange: on the item whose clock is on air, the operator raised the green flag and
    // cleared the laps.
    const changedFields: ItemFields = {
      state: { kind: 'literal', value: 'green' },
      lapsCompletedByLeader: { kind: 'literal', value: null },
    };

    // Act: build the on-air update.
    const command = buildUpdateInstanceDataCommandFromChangedFields({
      instanceId: idOfTheClockInstanceOnAir,
      changedFields,
    });

    // Assert: plain values for the graphic, null for the field to take off air, and no
    // field for the server to stamp.
    expect(command, 'the on-air update must carry the two changes as data').toEqual({
      type: 'updateInstanceData',
      instanceId: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
      data: { state: 'green', lapsCompletedByLeader: null },
      takeTimeFieldKeys: [],
    });
  });

  it('leaves out a field changed to "filled by the server at the take"', () => {
    // Arrange: the operator typed a new time and also switched the reference moment of
    // an older item from a stored number to "the moment of the take".
    const changedFields: ItemFields = {
      referenceTimeMs: { kind: 'literal', value: 5_400_000 },
      referenceWallClockMs: { kind: 'takeTime' },
    };

    // Act: build the on-air update.
    const command = buildUpdateInstanceDataCommandFromChangedFields({
      instanceId: idOfTheClockInstanceOnAir,
      changedFields,
    });

    // Assert: only the typed time goes on air. The moment on air stays as it is, and the
    // server is not asked to stamp a new one.
    expect(command, 'a field left to the take must never be sent on air from the editor').toEqual({
      type: 'updateInstanceData',
      instanceId: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
      data: { referenceTimeMs: 5_400_000 },
      takeTimeFieldKeys: [],
    });
  });

  const scenariosWithNothingToChangeOnAir: Array<{ name: string; changedFields: ItemFields }> = [
    // A new label or colour changes the rundown row, not what the audience sees.
    { name: 'builds no command when no field changed', changedFields: {} },
    // The only change is a field now left to the take: nothing typed to put on air.
    {
      name: 'builds no command when the only change is a field left to the take',
      changedFields: { referenceWallClockMs: { kind: 'takeTime' } },
    },
  ];

  it.each(scenariosWithNothingToChangeOnAir)('$name', ({ changedFields }) => {
    // Arrange: the changed fields of this row.

    // Act: build the on-air update.
    const command = buildUpdateInstanceDataCommandFromChangedFields({
      instanceId: idOfTheClockInstanceOnAir,
      changedFields,
    });

    // Assert: there is nothing to send to the instance on air.
    expect(command, 'with no typed value changed, nothing may be sent on air').toBeUndefined();
  });
});
