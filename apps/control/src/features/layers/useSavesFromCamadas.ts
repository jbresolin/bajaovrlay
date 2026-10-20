import {
  findClockFieldKeysByRole,
  type Graphic,
  type Instance,
  type Item,
  type ItemHome,
  listFieldKeysItemReadsFromASource,
  type WallClockFieldsChoice,
} from '@bajaovrlay/shared';
import { useState } from 'react';

import { useItemEditorTarget } from '@/features/items/ItemEditorTargetProvider';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand } from '@/state/ControlPageStateProvider';

import {
  listClockFieldKeysOfGraphic,
  listWallClockFieldKeysOfGraphic,
  nameFieldsByTheirTitles,
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
  /** After an accepted "Salvar no item" that skipped fields read from a source: which. */
  noteAboutTheLastSave: string | null;
};

/** What one "Salvar no item" will save and skip, worked out before it is sent. */
type SaveIntoItemPlan = {
  /** A clock field will be saved (whole), so the clock question must be asked. */
  isAClockFieldSaved: boolean;
  /** The keys skipped because the item reads them from a source (the server skips them). */
  keysReadFromASource: string[];
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
 * A field the item reads from a source is skipped by the server (gate 2 of PR #18); the
 * same shared rule names those fields here, in `noteAboutTheLastSave`, once the save is
 * accepted, and a clock the item reads whole asks no clock question.
 */
export function useSavesFromCamadas(graphics: Graphic[], items: Item[]): SavesFromCamadas {
  const sendCommand = useSendCommand();
  const { openItemEditorForNewItem } = useItemEditorTarget();
  const [saveWaiting, setSaveWaiting] = useState<SaveWaitingForTheClockChoice | null>(null);
  const [instanceIdsBeingSaved, setInstanceIdsBeingSaved] = useState<string[]>([]);
  const [noteAboutTheLastSave, setNoteAboutTheLastSave] = useState<string | null>(null);

  function findGraphicOf(instance: Instance): Graphic | undefined {
    return graphics.find((candidate) => candidate.id === instance.graphicId);
  }

  // The server's rule, step by step: the changed keys, the whole clock when a part of it
  // changed, and then the split between what is saved and what the item reads from a source.
  function planTheSaveIntoItem(instance: Instance): SaveIntoItemPlan {
    const graphic = findGraphicOf(instance);
    const clockFieldKeys = listClockFieldKeysOfGraphic(graphic);
    const keysChangedOnAir = instance.fieldsChangedOnAir ?? [];
    const isAClockFieldChanged = keysChangedOnAir.some((fieldKey) =>
      clockFieldKeys.includes(fieldKey),
    );
    const clockFieldKeysAdded = isAClockFieldChanged
      ? clockFieldKeys.filter((fieldKey) => !keysChangedOnAir.includes(fieldKey))
      : [];
    const keysOfTheSave = [...keysChangedOnAir, ...clockFieldKeysAdded];
    const item = items.find((candidate) => candidate.id === instance.itemId);
    const keysTheItemReadsFromASource =
      item === undefined
        ? []
        : listFieldKeysItemReadsFromASource(
            item.fields,
            graphic === undefined ? undefined : findClockFieldKeysByRole(graphic),
          );
    const keysSaved = keysOfTheSave.filter(
      (fieldKey) => !keysTheItemReadsFromASource.includes(fieldKey),
    );
    return {
      isAClockFieldSaved: keysSaved.some((fieldKey) => clockFieldKeys.includes(fieldKey)),
      keysReadFromASource: keysOfTheSave.filter((fieldKey) =>
        keysTheItemReadsFromASource.includes(fieldKey),
      ),
    };
  }

  async function saveIntoItem(
    instance: Instance,
    wallClockFields: WallClockFieldsChoice,
  ): Promise<void> {
    setInstanceIdsBeingSaved((idsBefore) => [...idsBefore, instance.id]);
    setNoteAboutTheLastSave(null);
    const { keysReadFromASource } = planTheSaveIntoItem(instance);
    try {
      const wasSaveAccepted = await sendCommand({
        type: 'saveOnAirChangesIntoItem',
        instanceId: instance.id,
        wallClockFields,
      });
      if (wasSaveAccepted && keysReadFromASource.length > 0) {
        const fieldTitles = nameFieldsByTheirTitles(findGraphicOf(instance), keysReadFromASource);
        setNoteAboutTheLastSave(ptBR.layers.notSavedBecauseReadFromASource(fieldTitles.join(', ')));
      }
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
    if (planTheSaveIntoItem(instance).isAClockFieldSaved) {
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
    noteAboutTheLastSave,
  };
}
