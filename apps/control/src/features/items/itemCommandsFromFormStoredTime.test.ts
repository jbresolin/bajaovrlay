/**
 * Item editor: updating a clock whose stored time the form cannot show exactly (apps/control)
 *
 * What this module is for:
 *   "Salvar item" on a stored item sends `updateItemFields` with only what the operator
 *   changed. For the race clock that matters twice over: on an item whose reference
 *   moment is a stored number (as a script stores it), a changed time also replaces that
 *   number by "the moment of the take", which changes where a running clock counts from.
 *   The editor itself only stores times in whole seconds, but a script may store any
 *   number of milliseconds through the API. The form shows such a time in whole seconds
 *   ("1:30" for 90 500 ms), so the time it hands back is 500 ms short of the stored one
 *   without the operator having touched it.
 *
 * What these tests prove:
 *   - With a running clock stored at 90 500 ms, a new label sends only the label: the
 *     time and the reference moment stay as stored, so the clock on the item is not moved.
 *   - Changing another clock field (the flag) does not drag the untouched time along.
 *   - A time the operator really typed anew is still sent, with the reference moment
 *     replaced by "the moment of the take".
 *   - A stored time the form cannot show at all (not a whole number of milliseconds) is
 *     replaced by the form's time, as the editor's warning promises.
 *
 * What these tests deliberately do not cover:
 *   - Every other part of the two commands (itemCommandsFromForm.test.ts).
 *   - The warning the editor shows for a stored value it cannot read
 *     (ItemEditorPanelEditing.test.tsx).
 *   - Removing the stored part of a second without changing the time: the editor cannot
 *     do that; the operator types a different time, or the script stores a whole second.
 */
import type { Item } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import type { RaceClockTakeFormValues } from '@/features/playout/raceClockTakeForm';

import { buildUpdateItemFieldsCommand } from './itemCommandsFromForm';
import type { ItemEditorFormValues } from './itemEditorForm';
import {
  buildEnduranceStartClockItemSavedWithTheMomentOfTheSave,
  momentTheItemWasSavedInMilliseconds,
} from './itemsLikeTheEditorSaves.testSupport';

const idOfTheSecondHeatItem = '7c3e5a19-4d02-4b8f-a6e1-9f2b8d0c1e47';

/**
 * The clock of the second heat as a script stored it through the API: running, counting
 * up, at 1 minute and 30.5 seconds (90 500 ms).
 */
function buildSecondHeatClockItemStoredByAScript(): Item {
  return {
    id: idOfTheSecondHeatItem,
    rundownId: 'sessao-principal',
    order: 1,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: {
      sessionName: { kind: 'literal', value: 'Segunda bateria' },
      state: { kind: 'literal', value: 'green' },
      clockMode: { kind: 'literal', value: 'elapsed' },
      referenceTimeMs: { kind: 'literal', value: 90_500 },
      referenceWallClockMs: { kind: 'literal', value: momentTheItemWasSavedInMilliseconds },
      running: { kind: 'literal', value: true },
    },
    label: 'Segunda bateria',
    color: 'info',
    notes: '',
  };
}

/** The item part of the form exactly as the second heat item fills it. */
function buildItemFormShowingTheSecondHeatItem(): ItemEditorFormValues {
  return {
    graphicId: 'race-clock',
    layerId: 'clock',
    label: 'Segunda bateria',
    color: 'info',
    notes: '',
    autoOutAfterSeconds: '',
  };
}

/** The race clock part of the form as that item fills it: 90 500 ms is shown as "1:30". */
function buildClockFormShowingTheSecondHeatItem(): RaceClockTakeFormValues {
  return {
    sessionName: 'Segunda bateria',
    state: 'green',
    clockMode: 'elapsed',
    running: true,
    referenceTime: '1:30',
    lapsCompletedByLeader: '',
  };
}

describe('buildUpdateItemFieldsCommand for a running clock stored at 90 500 ms', () => {
  const scenariosOfAnEditedSecondHeatItem = [
    // The fault this table guards against: the form's rounding looked like a new time,
    // so a label-only edit sent the time and a new reference moment, restarting the clock.
    {
      name: 'a new label sends only the label and no field',
      changesToTheItemForm: { label: 'Segunda bateria (sábado)' },
      changesToTheClockForm: {},
      expectedCommand: {
        type: 'updateItemFields',
        itemId: idOfTheSecondHeatItem,
        label: 'Segunda bateria (sábado)',
      },
    },
    // Another clock field changing must not drag the untouched time along either.
    {
      name: 'a new flag sends that one field, without the time or the reference moment',
      changesToTheItemForm: {},
      changesToTheClockForm: { state: 'yellow' },
      expectedCommand: {
        type: 'updateItemFields',
        itemId: idOfTheSecondHeatItem,
        fields: { state: { kind: 'literal', value: 'yellow' } },
      },
    },
    // A time the operator really changed is a new reference: it counts from the take now.
    {
      name: 'a time typed anew sends the time and replaces the number by the moment of the take',
      changesToTheItemForm: {},
      changesToTheClockForm: { referenceTime: '2:00' },
      expectedCommand: {
        type: 'updateItemFields',
        itemId: idOfTheSecondHeatItem,
        fields: {
          referenceTimeMs: { kind: 'literal', value: 120_000 },
          referenceWallClockMs: { kind: 'takeTime' },
        },
      },
    },
  ];

  it.each(scenariosOfAnEditedSecondHeatItem)(
    '$name',
    ({ changesToTheItemForm, changesToTheClockForm, expectedCommand }) => {
      // Arrange: the stored item, and the two parts of the form as the item filled them,
      // with only the scenario's changes on top.
      const itemBeingEdited = buildSecondHeatClockItemStoredByAScript();
      const itemFormValues = {
        ...buildItemFormShowingTheSecondHeatItem(),
        ...changesToTheItemForm,
      } as ItemEditorFormValues;
      const raceClockFormValues = {
        ...buildClockFormShowingTheSecondHeatItem(),
        ...changesToTheClockForm,
      } as RaceClockTakeFormValues;

      // Act: build the update.
      const command = buildUpdateItemFieldsCommand({
        itemBeingEdited,
        itemFormValues,
        raceClockFormValues,
      });

      // Assert: only what the operator changed travels; the half second the form cannot
      // show is not a change.
      expect(
        command,
        'a time the operator did not touch must not be sent, nor move the running clock',
      ).toEqual(expectedCommand);
    },
  );

  it('builds no command when nothing was changed', () => {
    // Arrange: the stored item and the form exactly as the item filled it.
    const itemBeingEdited = buildSecondHeatClockItemStoredByAScript();

    // Act: build the update.
    const command = buildUpdateItemFieldsCommand({
      itemBeingEdited,
      itemFormValues: buildItemFormShowingTheSecondHeatItem(),
      raceClockFormValues: buildClockFormShowingTheSecondHeatItem(),
    });

    // Assert: opening and saving an item must never, by itself, change it.
    expect(command, 'an untouched form must not build a command').toBeUndefined();
  });
});

describe('buildUpdateItemFieldsCommand for a stored time the form cannot show', () => {
  it('sends the time of the form, and replaces the stored number by the moment of the take', () => {
    // Arrange: the endurance start item whose time a script stored with a part of a
    // millisecond (14 400 000.5), which the form cannot show. The editor then shows the
    // form's default time with a warning; here the operator typed 240:00 and saved.
    const itemBeingEdited: Item = {
      ...buildEnduranceStartClockItemSavedWithTheMomentOfTheSave(),
      fields: {
        ...buildEnduranceStartClockItemSavedWithTheMomentOfTheSave().fields,
        referenceTimeMs: { kind: 'literal', value: 14_400_000.5 },
      },
    };
    const itemFormValues: ItemEditorFormValues = {
      graphicId: 'race-clock',
      layerId: 'clock',
      label: 'Largada do Enduro',
      color: 'success',
      notes: 'Entrar quando os carros alinharem.',
      autoOutAfterSeconds: '',
    };
    const raceClockFormValues: RaceClockTakeFormValues = {
      sessionName: 'Enduro de Resistência',
      state: 'pre',
      clockMode: 'remaining',
      running: false,
      referenceTime: '240:00',
      lapsCompletedByLeader: '',
    };

    // Act: build the update.
    const command = buildUpdateItemFieldsCommand({
      itemBeingEdited,
      itemFormValues,
      raceClockFormValues,
    });

    // Assert: the unusable time is replaced by the form's, as the editor's warning says,
    // and from then on the clock counts from the take.
    expect(command, 'a stored time the form cannot show must be replaced by the save').toEqual({
      type: 'updateItemFields',
      itemId: '0b6f2d1e-8c47-4e39-9a15-3d7c5e2f4a90',
      fields: {
        referenceTimeMs: { kind: 'literal', value: 14_400_000 },
        referenceWallClockMs: { kind: 'takeTime' },
      },
    });
  });
});
