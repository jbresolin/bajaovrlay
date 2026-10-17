import type { Graphic, Instance, WallClockFieldsChoice } from '@bajaovrlay/shared';
import { useState } from 'react';

import { useItemEditorTarget } from '@/features/items/ItemEditorTargetProvider';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import { listWallClockFieldKeysOfGraphic } from './fieldsOfInstanceOnAir';
import { buildItemSavedFromInstanceWithoutItem } from './itemSavedFromInstanceWithoutItem';

/** A save waiting for the answer about the clock: into the instance's item, or as a new item. */
type SaveWaitingForTheClockChoice =
  | { kind: 'saveIntoItem'; instance: Instance }
  | { kind: 'saveAsItem'; instance: Instance; wallClockFieldKeys: string[] };

/** What the Camadas rows and the clock question need. */
export type SavesFromCamadas = {
  /** "Salvar no item": keeps the change on air in the instance's item. */
  pressSaveIntoItem: (instance: Instance) => void;
  /** "Salvar como item": opens the item editor filled with what is on air. */
  pressSaveAsItem: (instance: Instance) => void;
  /** true while the clock question is on screen. */
  isAskingAboutTheClock: boolean;
  answerTheClockQuestion: (wallClockFields: WallClockFieldsChoice) => void;
  cancelTheClockQuestion: () => void;
};

/**
 * The two saves a Camadas row offers. "Salvar no item" sends `saveOnAirChangesIntoItem`
 * for the instance; "Salvar como item" (for an instance with no item) sends nothing and
 * opens the item editor prefilled. When a clock's wall-clock moment would go into the item
 * (among the fields changed on air, or among the fields on air for "Salvar como item"),
 * the save first waits for the operator's choice (WallClockChoiceDialog.tsx); otherwise it
 * happens at the press, with `keepMoment`, which then changes nothing.
 */
export function useSavesFromCamadas(graphics: Graphic[]): SavesFromCamadas {
  const sendCommand = useSendCommand();
  const rundowns = useServerState((state) => state.rundowns);
  const panels = useServerState((state) => state.quickFirePanels);
  const { openItemEditorForNewItem } = useItemEditorTarget();
  const [saveWaiting, setSaveWaiting] = useState<SaveWaitingForTheClockChoice | null>(null);

  function findWallClockFieldKeysOf(instance: Instance): string[] {
    const graphic = graphics.find((candidate) => candidate.id === instance.graphicId);
    return listWallClockFieldKeysOfGraphic(graphic);
  }

  function saveIntoItem(instance: Instance, wallClockFields: WallClockFieldsChoice): void {
    void sendCommand({
      type: 'saveOnAirChangesIntoItem',
      instanceId: instance.id,
      wallClockFields,
    });
  }

  function openItemEditorFilledFrom(
    instance: Instance,
    wallClockFieldKeys: string[],
    wallClockFields: WallClockFieldsChoice,
  ): void {
    const itemSaved = buildItemSavedFromInstanceWithoutItem(
      instance,
      wallClockFieldKeys,
      wallClockFields,
      rundowns,
      panels,
    );
    openItemEditorForNewItem(itemSaved.home, itemSaved.prefill);
  }

  function pressSaveIntoItem(instance: Instance): void {
    const wallClockFieldKeys = findWallClockFieldKeysOf(instance);
    const keysChangedOnAir = instance.fieldsChangedOnAir ?? [];
    const isAClockMomentChanged = keysChangedOnAir.some((fieldKey) =>
      wallClockFieldKeys.includes(fieldKey),
    );
    if (isAClockMomentChanged) {
      setSaveWaiting({ kind: 'saveIntoItem', instance });
      return;
    }
    saveIntoItem(instance, 'keepMoment');
  }

  function pressSaveAsItem(instance: Instance): void {
    const wallClockFieldKeys = findWallClockFieldKeysOf(instance);
    const isAClockMomentOnAir = Object.keys(instance.resolvedData).some((fieldKey) =>
      wallClockFieldKeys.includes(fieldKey),
    );
    if (isAClockMomentOnAir) {
      setSaveWaiting({ kind: 'saveAsItem', instance, wallClockFieldKeys });
      return;
    }
    openItemEditorFilledFrom(instance, wallClockFieldKeys, 'keepMoment');
  }

  function answerTheClockQuestion(wallClockFields: WallClockFieldsChoice): void {
    if (saveWaiting === null) {
      return;
    }
    setSaveWaiting(null);
    if (saveWaiting.kind === 'saveIntoItem') {
      saveIntoItem(saveWaiting.instance, wallClockFields);
      return;
    }
    openItemEditorFilledFrom(saveWaiting.instance, saveWaiting.wallClockFieldKeys, wallClockFields);
  }

  return {
    pressSaveIntoItem,
    pressSaveAsItem,
    isAskingAboutTheClock: saveWaiting !== null,
    answerTheClockQuestion,
    cancelTheClockQuestion: () => setSaveWaiting(null),
  };
}
