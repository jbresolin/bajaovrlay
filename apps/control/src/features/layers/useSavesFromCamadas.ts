import type { Graphic, Instance, ItemHome, WallClockFieldsChoice } from '@bajaovrlay/shared';
import { useState } from 'react';

import { useItemEditorTarget } from '@/features/items/ItemEditorTargetProvider';
import { useSendCommand } from '@/state/ControlPageStateProvider';

import {
  listClockFieldKeysOfGraphic,
  listWallClockFieldKeysOfGraphic,
} from './fieldsOfInstanceOnAir';
import { buildItemSavedFromInstanceWithoutItem } from './itemSavedFromInstanceWithoutItem';

/** A save waiting for the answer about the clock: into the instance's item, or as a new item. */
type SaveWaitingForTheClockChoice =
  | { kind: 'saveIntoItem'; instance: Instance }
  | { kind: 'saveAsItem'; instance: Instance; wallClockFieldKeys: string[]; home: ItemHome };

/** What the Camadas rows and the clock question need. */
export type SavesFromCamadas = {
  /** "Salvar no item": keeps the change on air in the instance's item. */
  pressSaveIntoItem: (instance: Instance) => void;
  /** true while this instance's "Salvar no item" waits for the server's answer. */
  isSavingIntoItem: (instanceId: string) => boolean;
  /** "Salvar como item": opens the item editor filled with what is on air, going to `home`. */
  pressSaveAsItem: (instance: Instance, home: ItemHome) => void;
  /** true while the clock question is on screen. */
  isAskingAboutTheClock: boolean;
  answerTheClockQuestion: (wallClockFields: WallClockFieldsChoice) => void;
  cancelTheClockQuestion: () => void;
};

/**
 * The two saves a Camadas row offers. "Salvar no item" sends `saveOnAirChangesIntoItem`
 * for the instance, and its button is off while that command waits, so a double press
 * sends one save. "Salvar como item" (for an instance with no item) sends nothing and
 * opens the item editor prefilled. Either first waits for the operator's choice about a
 * clock's moment (WallClockChoiceDialog.tsx) when the save would decide it: for "Salvar no
 * item", whenever any clock field (time, moment, switch or mode) is among the changes,
 * since the server then saves the clock whole; for "Salvar como item", when a wall-clock
 * field is on air. Otherwise the save happens at the press, with `keepMoment`, which then
 * changes nothing.
 */
export function useSavesFromCamadas(graphics: Graphic[]): SavesFromCamadas {
  const sendCommand = useSendCommand();
  const { openItemEditorForNewItem } = useItemEditorTarget();
  const [saveWaiting, setSaveWaiting] = useState<SaveWaitingForTheClockChoice | null>(null);
  const [instanceIdsBeingSaved, setInstanceIdsBeingSaved] = useState<string[]>([]);

  function findGraphicOf(instance: Instance): Graphic | undefined {
    return graphics.find((candidate) => candidate.id === instance.graphicId);
  }

  async function saveIntoItem(
    instance: Instance,
    wallClockFields: WallClockFieldsChoice,
  ): Promise<void> {
    setInstanceIdsBeingSaved((idsBefore) => [...idsBefore, instance.id]);
    try {
      await sendCommand({
        type: 'saveOnAirChangesIntoItem',
        instanceId: instance.id,
        wallClockFields,
      });
    } finally {
      setInstanceIdsBeingSaved((idsBefore) => idsBefore.filter((id) => id !== instance.id));
    }
  }

  function openItemEditorFilledFrom(
    instance: Instance,
    wallClockFieldKeys: string[],
    wallClockFields: WallClockFieldsChoice,
    home: ItemHome,
  ): void {
    const prefill = buildItemSavedFromInstanceWithoutItem(
      instance,
      wallClockFieldKeys,
      wallClockFields,
    );
    openItemEditorForNewItem(home, prefill);
  }

  function pressSaveIntoItem(instance: Instance): void {
    if (instanceIdsBeingSaved.includes(instance.id)) {
      return;
    }
    const clockFieldKeys = listClockFieldKeysOfGraphic(findGraphicOf(instance));
    const keysChangedOnAir = instance.fieldsChangedOnAir ?? [];
    const isAClockFieldChanged = keysChangedOnAir.some((fieldKey) =>
      clockFieldKeys.includes(fieldKey),
    );
    if (isAClockFieldChanged) {
      setSaveWaiting({ kind: 'saveIntoItem', instance });
      return;
    }
    void saveIntoItem(instance, 'keepMoment');
  }

  function pressSaveAsItem(instance: Instance, home: ItemHome): void {
    const wallClockFieldKeys = listWallClockFieldKeysOfGraphic(findGraphicOf(instance));
    const isAClockMomentOnAir = Object.keys(instance.resolvedData).some((fieldKey) =>
      wallClockFieldKeys.includes(fieldKey),
    );
    if (isAClockMomentOnAir) {
      setSaveWaiting({ kind: 'saveAsItem', instance, wallClockFieldKeys, home });
      return;
    }
    openItemEditorFilledFrom(instance, wallClockFieldKeys, 'keepMoment', home);
  }

  function answerTheClockQuestion(wallClockFields: WallClockFieldsChoice): void {
    if (saveWaiting === null) {
      return;
    }
    setSaveWaiting(null);
    if (saveWaiting.kind === 'saveIntoItem') {
      void saveIntoItem(saveWaiting.instance, wallClockFields);
      return;
    }
    openItemEditorFilledFrom(
      saveWaiting.instance,
      saveWaiting.wallClockFieldKeys,
      wallClockFields,
      saveWaiting.home,
    );
  }

  return {
    pressSaveIntoItem,
    isSavingIntoItem: (instanceId) => instanceIdsBeingSaved.includes(instanceId),
    pressSaveAsItem,
    isAskingAboutTheClock: saveWaiting !== null,
    answerTheClockQuestion,
    cancelTheClockQuestion: () => setSaveWaiting(null),
  };
}
