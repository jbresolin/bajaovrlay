/**
 * Item editor: updating a clock whose reference moment is not "the moment of the take" (apps/control)
 *
 * What this module is for:
 *   A running race clock counts from its reference moment. The editor stores "the moment
 *   of the take" there, so a clock prepared on Friday counts from the instant it goes on
 *   air on Saturday. Items saved before that existed, and items a script stores through
 *   the API, hold a plain number instead: the instant of the save. Such an item must
 *   still open and save. This file is about what "Salvar item" sends for it.
 *
 * What these tests prove:
 *   - A label-only edit sends only the label: the stored number is left alone, so the
 *     clock on the item is not moved by an edit that was not about the clock.
 *   - Changing another clock field (the flag) does not touch the reference either.
 *   - The first save that changes the clock's time or its "running" switch replaces the
 *     number by "the moment of the take", together with that change.
 *   - Saving with nothing changed sends nothing: the number is never replaced on its own.
 *   - An item with no reference moment at all (a hand-made API call) gets "the moment of
 *     the take" at the next save, whatever was changed, because the graphic needs one.
 *
 * What these tests deliberately do not cover:
 *   - Items saved by this editor, which already hold "the moment of the take"
 *     (itemCommandsFromForm.test.ts).
 *   - A stored clock time with a part of a second (itemCommandsFromFormStoredTime.test.ts).
 *   - How such an older item behaves on air until it is edited: a clock stored running
 *     still counts from the moment of its save. Nothing converts it without an edit.
 */
import type { ItemFields } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { RaceClockTakeFormValues } from '@/features/playout/raceClockTakeForm';

import { buildUpdateItemFieldsCommand } from './itemCommandsFromForm';
import type { ItemEditorFormValues } from './itemEditorForm';
import {
  buildEnduranceStartClockItem,
  buildEnduranceStartClockItemSavedWithTheMomentOfTheSave,
} from './itemsLikeTheEditorSaves.testSupport';

const idOfTheEnduranceStartItem = '0b6f2d1e-8c47-4e39-9a15-3d7c5e2f4a90';

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

describe('buildUpdateItemFieldsCommand for an item whose reference moment is the number of its save', () => {
  const scenariosOfAnEditedItemSavedEarlier = [
    // The everyday edit must not touch the clock: the number stays as it is stored.
    {
      name: 'a new label sends only the label and leaves the stored number alone',
      changesToTheItemForm: { label: 'Largada — Enduro de Resistência' },
      changesToTheClockForm: {},
      expectedCommand: {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        label: 'Largada — Enduro de Resistência',
      },
    },
    // A clock field that is not part of the reference does not drag the reference along.
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
    // A new time is a new reference. From this save on the clock counts from the take.
    {
      name: 'a new time sends the time and replaces the number by the moment of the take',
      changesToTheItemForm: {},
      changesToTheClockForm: { referenceTime: '90:00' },
      expectedCommand: {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        fields: {
          referenceTimeMs: { kind: 'literal', value: 5_400_000 },
          referenceWallClockMs: { kind: 'takeTime' },
        },
      },
    },
    // Starting the clock is a new reference too: it must start at the take, not on Friday.
    {
      name: 'switching the clock to running replaces the number by the moment of the take',
      changesToTheItemForm: {},
      changesToTheClockForm: { running: true },
      expectedCommand: {
        type: 'updateItemFields',
        itemId: idOfTheEnduranceStartItem,
        fields: {
          running: { kind: 'literal', value: true },
          referenceWallClockMs: { kind: 'takeTime' },
        },
      },
    },
  ];

  it.each(scenariosOfAnEditedItemSavedEarlier)(
    '$name',
    ({ changesToTheItemForm, changesToTheClockForm, expectedCommand }) => {
      // Arrange: the item as an earlier editor saved it, and the two parts of the form
      // as the item filled them, with only the scenario's changes on top.
      const itemBeingEdited = buildEnduranceStartClockItemSavedWithTheMomentOfTheSave();
      const itemFormValues = {
        ...buildItemFormShowingTheEnduranceStartItem(),
        ...changesToTheItemForm,
      } as ItemEditorFormValues;
      const raceClockFormValues = {
        ...buildClockFormShowingTheEnduranceStartItem(),
        ...changesToTheClockForm,
      } as RaceClockTakeFormValues;

      // Act: build the update.
      const command = buildUpdateItemFieldsCommand({
        itemBeingEdited,
        itemFormValues,
        raceClockFormValues,
      });

      // Assert: the number is replaced only by a save that changes the clock's reference.
      expect(
        command,
        'the stored number must stay unless the time or the running switch was changed',
      ).toEqual(expectedCommand);
    },
  );

  it('builds no command when nothing was changed', () => {
    // Arrange: the item as an earlier editor saved it, and the form exactly as it filled it.
    const itemBeingEdited = buildEnduranceStartClockItemSavedWithTheMomentOfTheSave();

    // Act: build the update.
    const command = buildUpdateItemFieldsCommand({
      itemBeingEdited,
      itemFormValues: buildItemFormShowingTheEnduranceStartItem(),
      raceClockFormValues: buildClockFormShowingTheEnduranceStartItem(),
    });

    // Assert: nothing is sent. Opening and saving alone never converts the item.
    expect(
      command,
      'an untouched form must not build a command, not even to modernise the reference',
    ).toBeUndefined();
  });
});

describe('buildUpdateItemFieldsCommand for an item with no reference moment at all', () => {
  it('sends the moment of the take, whatever else was changed', () => {
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
    });

    // Assert: the missing reference is repaired, because the graphic requires that field.
    expect(command, 'a missing reference moment must be filled in by the save').toEqual({
      type: 'updateItemFields',
      itemId: idOfTheEnduranceStartItem,
      label: 'Largada do Enduro (sábado)',
      fields: { referenceWallClockMs: { kind: 'takeTime' } },
    });
  });
});
