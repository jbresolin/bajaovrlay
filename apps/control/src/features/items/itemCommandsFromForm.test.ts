/**
 * Item editor: the commands built from the form (apps/control)
 *
 * What this module is for:
 *   "Salvar item" in the item editor sends one command. For a new item it is
 *   `createItem`, carrying the whole form. For an existing item it is
 *   `updateItemFields`, carrying only what the operator changed, so two operators
 *   editing different parts of the same item do not undo each other.
 *   itemCommandsFromForm builds both commands from form values that already passed
 *   their rules, without drawing anything.
 *
 * What these tests prove:
 *   - A new race clock item becomes exactly the `createItem` the server expects: the
 *     rundown, graphic, layer, trimmed label, colour, notes, the race clock values as
 *     literals, and the auto-out delay in milliseconds (left out when blank).
 *   - A new item of a graphic the editor has no form for is created with empty fields.
 *   - An update names only the parts that differ from the stored item; among the race
 *     clock fields only the ones whose value changed.
 *   - The clock's reference moment is sent again only together with a changed time or a
 *     changed "running", so editing a label never moves a prepared clock.
 *   - Auto-out: a new number sets it, blank over a stored delay sends `null` (remove),
 *     and an untouched delay is not sent.
 *   - An edit that changed nothing builds no command at all.
 *
 * What these tests deliberately do not cover:
 *   - The rules that refuse a badly filled form (itemEditorForm.test.ts and
 *     features/playout/raceClockTakeForm.test.ts): these builders are given valid values.
 *   - Removing the laps from an item, which the update command cannot do; the panel
 *     refuses that before building anything (ItemEditorPanelEditing.test.tsx).
 *   - A stored clock time with a part of a second, which only a script can store
 *     (itemCommandsFromFormStoredTime.test.ts); every time here is in whole seconds.
 *   - What the server does with the commands (apps/server).
 */
import type { ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { RaceClockTakeFormValues } from '@/features/playout/raceClockTakeForm';

import { buildCreateItemCommand, buildUpdateItemFieldsCommand } from './itemCommandsFromForm';
import type { ItemEditorFormValues } from './itemEditorForm';
import {
  buildDriverLowerThirdItem,
  buildEnduranceStartClockItem,
  idOfTheMainSessionRundown,
  momentTheItemWasSavedInMilliseconds,
} from './itemsLikeTheEditorSaves.testSupport';

// Saturday 9:40 in Brasília, twenty minutes before the start, when the operator edits.
const momentOfTheEditInMilliseconds = Date.parse('2026-10-10T12:40:00.000Z');

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

/** The race clock part of the form exactly as the stored endurance start item fills it. */
function buildClockFormShowingTheEnduranceStartItem(): RaceClockTakeFormValues {
  return {
    sessionName: 'Enduro de Resistência',
    state: 'pre',
    clockMode: 'remaining',
    running: false,
    referenceTime: '240:00',
    lapsCompletedByLeader: '',
  };
}

describe('buildCreateItemCommand', () => {
  it('turns the form of a new race clock item into the exact createItem command', () => {
    // Arrange: a new item for the endurance start, typed on Friday evening, with a
    // label pasted with stray spaces and an auto-out of 90 seconds.
    const itemFormValues: ItemEditorFormValues = {
      ...buildItemFormShowingTheEnduranceStartItem(),
      label: '  Largada do Enduro ',
      autoOutAfterSeconds: '90',
    };
    const raceClockFormValues = buildClockFormShowingTheEnduranceStartItem();

    // Act: build the command at the moment of the save.
    const command = buildCreateItemCommand({
      rundownId: idOfTheMainSessionRundown,
      itemFormValues,
      raceClockFormValues,
      nowInMilliseconds: momentTheItemWasSavedInMilliseconds,
    });

    // Assert: the whole command, part by part (240:00 is 14 400 000 ms, 90 s is 90 000 ms).
    expect(command, 'the command must be exactly what the server expects').toEqual({
      type: 'createItem',
      rundownId: 'sessao-principal',
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
        referenceWallClockMs: { kind: 'literal', value: momentTheItemWasSavedInMilliseconds },
        running: { kind: 'literal', value: false },
      },
    });
  });

  it('leaves the auto-out and the position out, so the item goes to the end and stays on air', () => {
    // Arrange: the same new item with the auto-out left blank.
    const itemFormValues = buildItemFormShowingTheEnduranceStartItem();

    // Act: build the command.
    const command = buildCreateItemCommand({
      rundownId: idOfTheMainSessionRundown,
      itemFormValues,
      raceClockFormValues: buildClockFormShowingTheEnduranceStartItem(),
      nowInMilliseconds: momentTheItemWasSavedInMilliseconds,
    });

    // Assert: neither key is in the command; the server reads their absence.
    expect(command, 'a blank auto-out must not be sent at all').not.toHaveProperty(
      'autoOutAfterMs',
    );
    expect(command, 'the editor never chooses a position; the server appends').not.toHaveProperty(
      'order',
    );
  });

  it('creates an item of a graphic without a form with empty fields', () => {
    // Arrange: a new lower third for team 42; the editor has no form for that graphic,
    // so there are no race clock values.
    const itemFormValues: ItemEditorFormValues = {
      graphicId: 'driver-lower-third',
      layerId: 'lower-third',
      label: 'Tarja da equipe 42',
      color: 'info',
      notes: '',
      autoOutAfterSeconds: '8',
    };

    // Act: build the command.
    const command = buildCreateItemCommand({
      rundownId: idOfTheMainSessionRundown,
      itemFormValues,
      raceClockFormValues: undefined,
      nowInMilliseconds: momentTheItemWasSavedInMilliseconds,
    });

    // Assert: the item is created with no field values (BAJAOVRLAY-14 brings its form).
    expect(command, 'an item without a form must be created with empty fields').toEqual({
      type: 'createItem',
      rundownId: 'sessao-principal',
      graphicId: 'driver-lower-third',
      layerId: 'lower-third',
      label: 'Tarja da equipe 42',
      color: 'info',
      notes: '',
      autoOutAfterMs: 8_000,
      fields: {},
    });
  });
});

describe('buildUpdateItemFieldsCommand', () => {
  const idOfTheEnduranceStartItem = '0b6f2d1e-8c47-4e39-9a15-3d7c5e2f4a90';

  const scenariosOfAnEditedEnduranceStartItem = [
    // The everyday edit: a better label, nothing else. No field value may travel, or a
    // prepared clock would get a new reference moment for no reason.
    {
      name: 'a new label sends only the label',
      changesToTheItemForm: { label: 'Largada — Enduro de Resistência' },
      changesToTheClockForm: {},
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
      changesToTheClockForm: {},
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
      changesToTheClockForm: {},
      expectedCommand: {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        autoOutAfterMs: 45_000,
      },
    },
    // Only the flag changed: one field travels, and the clock's reference stays put.
    {
      name: 'a new flag sends that one field and not the reference moment',
      changesToTheItemForm: {},
      changesToTheClockForm: { state: 'green' },
      expectedCommand: {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        fields: { state: { kind: 'literal', value: 'green' } },
      },
    },
    // A new time is a new reference: the time and the moment it was typed go together.
    {
      name: 'a new time sends the time together with the moment of this save',
      changesToTheItemForm: {},
      changesToTheClockForm: { referenceTime: '90:00' },
      expectedCommand: {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        fields: {
          referenceTimeMs: { kind: 'literal', value: 5_400_000 },
          referenceWallClockMs: { kind: 'literal', value: momentOfTheEditInMilliseconds },
        },
      },
    },
    // Starting the clock also fixes the moment it starts counting from: this save.
    {
      name: 'switching the clock to running sends "running" with the moment of this save',
      changesToTheItemForm: {},
      changesToTheClockForm: { running: true },
      expectedCommand: {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        fields: {
          running: { kind: 'literal', value: true },
          referenceWallClockMs: { kind: 'literal', value: momentOfTheEditInMilliseconds },
        },
      },
    },
    // Laps typed on an item that had none are a new field.
    {
      name: 'laps typed for the first time are sent as a new field',
      changesToTheItemForm: {},
      changesToTheClockForm: { lapsCompletedByLeader: '3' },
      expectedCommand: {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        fields: { lapsCompletedByLeader: { kind: 'literal', value: 3 } },
      },
    },
  ];

  it.each(scenariosOfAnEditedEnduranceStartItem)(
    'editing the endurance start item: $name',
    ({ changesToTheItemForm, changesToTheClockForm, expectedCommand }) => {
      // Arrange: the stored item, and the two parts of the form as the item filled
      // them, with only the scenario's changes on top.
      const itemBeingEdited = buildEnduranceStartClockItem();
      const itemFormValues = {
        ...buildItemFormShowingTheEnduranceStartItem(),
        ...changesToTheItemForm,
      } as ItemEditorFormValues;
      const raceClockFormValues = {
        ...buildClockFormShowingTheEnduranceStartItem(),
        ...changesToTheClockForm,
      } as RaceClockTakeFormValues;

      // Act: build the update on Saturday morning.
      const command = buildUpdateItemFieldsCommand({
        itemBeingEdited,
        itemFormValues,
        raceClockFormValues,
        nowInMilliseconds: momentOfTheEditInMilliseconds,
      });

      // Assert: the command names the item and only what changed.
      expect(command, 'the update must carry only what the operator changed').toEqual(
        expectedCommand,
      );
    },
  );

  it('builds no command when nothing was changed', () => {
    // Arrange: the stored item and the form exactly as the item filled it.
    const itemBeingEdited = buildEnduranceStartClockItem();

    // Act: build the update twelve hours after the item was saved.
    const command = buildUpdateItemFieldsCommand({
      itemBeingEdited,
      itemFormValues: buildItemFormShowingTheEnduranceStartItem(),
      raceClockFormValues: buildClockFormShowingTheEnduranceStartItem(),
      nowInMilliseconds: momentOfTheEditInMilliseconds,
    });

    // Assert: there is nothing to send. In particular the later "now" alone is not a
    // change: the clock's reference moment is the one stored on Friday.
    expect(command, 'an untouched form must not build a command').toBeUndefined();
  });

  it('sends the reference moment when the stored item has none the clock can use', () => {
    // Arrange: the endurance start item whose reference moment was lost (a hand-made
    // API call stored fields without it), opened and saved with only a new label.
    const fieldsWithoutTheReferenceMoment: ItemFields = {
      ...buildEnduranceStartClockItem().fields,
    };
    delete fieldsWithoutTheReferenceMoment.referenceWallClockMs;
    const itemBeingEdited = {
      ...buildEnduranceStartClockItem(),
      fields: fieldsWithoutTheReferenceMoment,
    };
    const itemFormValues = {
      ...buildItemFormShowingTheEnduranceStartItem(),
      label: 'Largada do Enduro (sábado)',
    };

    // Act: build the update.
    const command = buildUpdateItemFieldsCommand({
      itemBeingEdited,
      itemFormValues,
      raceClockFormValues: buildClockFormShowingTheEnduranceStartItem(),
      nowInMilliseconds: momentOfTheEditInMilliseconds,
    });

    // Assert: the missing reference is repaired, because the graphic requires that field.
    expect(command, 'a missing reference moment must be filled in by the save').toEqual({
      type: 'updateItemFields',
      itemId: '0b6f2d1e-8c47-4e39-9a15-3d7c5e2f4a90',
      label: 'Largada do Enduro (sábado)',
      fields: {
        referenceWallClockMs: { kind: 'literal', value: momentOfTheEditInMilliseconds },
      },
    });
  });

  it('sends null to remove the auto-out when the operator blanks a stored delay', () => {
    // Arrange: the lower third of team 42, which leaves after 8 s, with the delay erased.
    const itemBeingEdited = buildDriverLowerThirdItem();
    const itemFormValues: ItemEditorFormValues = {
      graphicId: 'driver-lower-third',
      layerId: 'lower-third',
      label: 'Tarja da equipe 42',
      color: 'info',
      notes: '',
      autoOutAfterSeconds: '',
    };

    // Act: build the update; that graphic has no form, so there are no clock values.
    const command = buildUpdateItemFieldsCommand({
      itemBeingEdited,
      itemFormValues,
      raceClockFormValues: undefined,
      nowInMilliseconds: momentOfTheEditInMilliseconds,
    });

    // Assert: null is how the command says "remove the delay"; its fields are not touched.
    expect(command, 'a blanked delay must be sent as null, and no field may travel').toEqual({
      type: 'updateItemFields',
      itemId: '5e1a9c73-2b64-4f08-b3d1-7a9e0c6d8f25',
      autoOutAfterMs: null,
    });
  });
});
