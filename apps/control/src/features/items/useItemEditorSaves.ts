import type { Command, Item, ItemFields, ItemHome } from '@bajaovrlay/shared';
import { type RefObject, useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import {
  useReadServerStateNow,
  useSendCommand,
  useSendCommandAndReadItsAnswer,
} from '@/state/ControlPageStateProvider';

import {
  buildCreateItemCommand,
  buildUpdateInstanceDataCommandFromChangedFields,
  buildUpdateItemFieldsCommand,
} from './itemCommandsFromEditor';
import type { ItemEditorFormValues } from './itemEditorForm';
import { useItemEditorTarget } from './ItemEditorTargetProvider';
import type { ItemGraphicFieldsFormHandle } from './ItemGraphicFieldsForm';
import { findInstanceOfItemOnProgram } from './itemInstanceOnAir';
import {
  type AnswerToSave,
  type ItemsTheServerMayStore,
  joinSavesOfOneFormIntoOne,
  listEveryItemTheServerMayStore,
  recordAnswerToSave,
} from './itemsTheServerMayStore';
import { useAskToBeClosedOnce } from './useAskToBeClosedOnce';

/**
 * What a press asks for: "Salvar item"; "Salvar e disparar" or "Salvar e prévia" (save,
 * then take or preview this item); or "Atualizar no ar" (save, then change the air).
 */
export type WhatThePressAsksFor =
  'saveItem' | 'saveItemAndTake' | 'saveItemAndPreview' | 'saveItemAndUpdateOnAir';

/** What the saves are built from: the editor's two forms and what it was opened for. */
export type ItemEditorSavesOptions = {
  /** The stored item as it was when the editor opened, or null for a new item. */
  itemAsItWasWhenOpened: Item | null;
  /** "Onde" for a new item; ignored for a stored one. */
  chosenHomeForNewItem: ItemHome;
  itemForm: UseFormReturn<ItemEditorFormValues>;
  /** The graphic's form, while it is on the page (null when there is none). */
  graphicFieldsFormHandleRef: RefObject<ItemGraphicFieldsFormHandle | null>;
  /** Checks both forms, putting the messages under the wrong fields; true when all passed. */
  checkBothForms: () => Promise<boolean>;
  /** true while an image of the graphic is still uploading: a press then sends nothing. */
  isAnImageUploading: boolean;
  /** Called after the server accepted everything a press sent, and on "Cancelar". */
  onClose: () => void;
  /** The command types whose refusal the buttons show from the start (usually none). */
  refusalsToShowAtOpening: Command['type'][];
};

/** What the editor's buttons need from the saves. */
export type ItemEditorSaves = {
  /** true while a press is checked and its commands wait: the save buttons are off. */
  isWaitingForTheServer: boolean;
  /** The command types this opening sent; the buttons show their refusals. */
  commandTypesSentInThisOpening: Command['type'][];
  /** One press of a save button, start to finish. */
  pressSaveButton: (whatThePressAsksFor: WhatThePressAsksFor) => Promise<void>;
  /** "Cancelar": closes the editor, once. */
  cancel: () => void;
};

/**
 * The commands a press of the item editor sends, and what the editor does with each
 * answer: `createItem` for a new item, `updateItemFields` with only what changed for a
 * stored one; then, for "Salvar e disparar" and "Salvar e prévia", `takeItem` or
 * `previewItem` (origin manual) for that item, and for "Atualizar no ar"
 * `updateInstanceData` for the item's instance on air. The editor's two forms and its
 * drawing stay in ItemEditorPanel.tsx; this hook only reads them at the press.
 */
export function useItemEditorSaves(options: ItemEditorSavesOptions): ItemEditorSaves {
  const { itemAsItWasWhenOpened, itemForm, graphicFieldsFormHandleRef } = options;
  const readServerStateNow = useReadServerStateNow();
  const sendCommand = useSendCommand();
  const sendCommandAndReadItsAnswer = useSendCommandAndReadItsAnswer();
  const { openItemEditorForItem } = useItemEditorTarget();
  const { askToBeClosedOnce, hasEditorFinishedWithThisItem } = useAskToBeClosedOnce(
    options.onClose,
  );

  // What the server may store for the item as far as this editor knows: the item as
  // opened plus every save this editor had accepted since, and one more possibility per
  // save the server never answered (itemsTheServerMayStore.ts). A save is compared with
  // all of them, so a field put back after an accepted or an unanswered save is saved
  // again. It is a ref because only a press reads it; nothing drawn depends on it. Null
  // for a new item, which is sent whole.
  const itemsTheServerMayStoreRef = useRef<ItemsTheServerMayStore | null>(
    itemAsItWasWhenOpened === null
      ? null
      : { itemAfterTheAnsweredSaves: itemAsItWasWhenOpened, itemsIfAnUnansweredSaveWasApplied: [] },
  );

  // The buttons are off while a press is being checked and its commands wait for the
  // server's answer, so an impatient second click cannot create the item twice.
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);
  // The page remembers the last refused command until some command succeeds. Without
  // this list, an editor opened again after a refused save would greet the operator with
  // the refusal of a save it never made; and a refused "Atualizar" of "Edição rápida"
  // would appear here although this editor never sent an on-air update.
  const [commandTypesSentInThisOpening, setCommandTypesSentInThisOpening] = useState<
    Command['type'][]
  >(options.refusalsToShowAtOpening);
  function rememberCommandTypeWasSent(commandType: Command['type']): void {
    setCommandTypesSentInThisOpening((typesSentSoFar) => [...typesSentSoFar, commandType]);
  }

  // Sends the whole of a new item. Answers whether the server accepted it and, when it
  // did, the id it gave the item (a server that names none answers `undefined`). The
  // moment of the save plays no part: a wall-clock field is stamped by the server at the take.
  async function createTheNewItem(): Promise<
    { wasAccepted: false } | { wasAccepted: true; createdItemId: string | undefined }
  > {
    const graphicFieldsForm = graphicFieldsFormHandleRef.current;
    const createCommand = buildCreateItemCommand({
      home: options.chosenHomeForNewItem,
      itemFormValues: itemForm.getValues(),
      fields: graphicFieldsForm === null ? {} : graphicFieldsForm.buildFieldsOfNewItem(),
    });
    rememberCommandTypeWasSent('createItem');
    const answer = await sendCommandAndReadItsAnswer(createCommand);
    if (answer === null) {
      return { wasAccepted: false };
    }
    return { wasAccepted: true, createdItemId: answer.createdItemId };
  }

  // "Salvar e disparar" takes the item, "Salvar e prévia" previews it, asked for by hand.
  // Answers whether the server accepted. Deliberate: the take is sent as it is, without
  // the automatic preview of the next cursor item that "Disparar" on a rundown row
  // brings, because the editor needs the answer to decide whether to close.
  async function takeOrPreviewTheSavedItem(
    itemId: string,
    whatThePressAsksFor: 'saveItemAndTake' | 'saveItemAndPreview',
  ): Promise<boolean> {
    if (whatThePressAsksFor === 'saveItemAndTake') {
      rememberCommandTypeWasSent('takeItem');
      return sendCommand({ type: 'takeItem', itemId });
    }
    rememberCommandTypeWasSent('previewItem');
    return sendCommand({ type: 'previewItem', itemId, origin: 'manual' });
  }

  // A new item, start to finish. After a refused take of an item just created, the item
  // stays saved (a save is never rolled back) and the editor turns into the editor of
  // that stored item, showing the refusal: pressed again, it would otherwise create a
  // second item.
  async function createTheNewItemThenUseIt(whatThePressAsksFor: WhatThePressAsksFor) {
    const creation = await createTheNewItem();
    if (!creation.wasAccepted || hasEditorFinishedWithThisItem()) {
      return;
    }
    const isUseAskedFor =
      whatThePressAsksFor === 'saveItemAndTake' || whatThePressAsksFor === 'saveItemAndPreview';
    if (!isUseAskedFor || creation.createdItemId === undefined) {
      askToBeClosedOnce();
      return;
    }
    const wasUseAccepted = await takeOrPreviewTheSavedItem(
      creation.createdItemId,
      whatThePressAsksFor,
    );
    if (wasUseAccepted) {
      askToBeClosedOnce();
      return;
    }
    if (!hasEditorFinishedWithThisItem()) {
      const refusedCommandType =
        whatThePressAsksFor === 'saveItemAndTake' ? 'takeItem' : 'previewItem';
      openItemEditorForItem(creation.createdItemId, [refusedCommandType]);
    }
  }

  // The fields of the graphic in which the form differs from what `comparedItem` stores.
  function findFieldsChangedFrom(comparedItem: Item): ItemFields {
    const graphicFieldsForm = graphicFieldsFormHandleRef.current;
    return graphicFieldsForm === null
      ? {}
      : graphicFieldsForm.findFieldsChangedFromStoredItem(comparedItem);
  }

  // How the save just sent ended. "No answer within 5 s" is told apart from a refusal by
  // the failure the page keeps, read straight after the wait, before any other command
  // can replace it: a refused save was not applied, an unanswered one may have been.
  function describeAnswerToSave(wasSaveAccepted: boolean): AnswerToSave {
    if (wasSaveAccepted) {
      return 'accepted';
    }
    const wasLeftUnanswered = readServerStateNow().lastCommandError?.code === 'COMMAND_TIMED_OUT';
    return wasLeftUnanswered ? 'leftUnanswered' : 'refused';
  }

  // Saves every part in which the form differs from any item the server may store.
  // Answers false only when the server did not accept; when nothing differs there is
  // nothing to send, and that counts as done. The answer to the save decides what the
  // next press is compared with.
  async function saveChangesToStoredItem(
    itemsTheServerMayStore: ItemsTheServerMayStore,
  ): Promise<boolean> {
    const savesAgainstEachItem = listEveryItemTheServerMayStore(itemsTheServerMayStore).map(
      (itemTheServerMayStore) =>
        buildUpdateItemFieldsCommand({
          itemBeingEdited: itemTheServerMayStore,
          itemFormValues: itemForm.getValues(),
          changedFields: findFieldsChangedFrom(itemTheServerMayStore),
        }),
    );
    const updateCommand = joinSavesOfOneFormIntoOne(savesAgainstEachItem);
    if (updateCommand === undefined) {
      return true;
    }
    rememberCommandTypeWasSent('updateItemFields');
    const wasSaveAccepted = await sendCommand(updateCommand);
    itemsTheServerMayStoreRef.current = recordAnswerToSave(
      itemsTheServerMayStore,
      updateCommand,
      describeAnswerToSave(wasSaveAccepted),
    );
    return wasSaveAccepted;
  }

  // Puts on the item's instance on air the fields in which the form differs from the item
  // as it was when the editor opened: this editor has changed nothing on air yet, so that
  // is still what the air is compared with, whatever has been saved since. Answers false
  // only when the server refused. Nothing is sent, and that counts as done, when no typed
  // value differs (a new label or layer is not on air: the instance stays on its layer,
  // and the next take uses the new one; a field now read from a source goes on air at the
  // next take too) or when the item left the air while the save was
  // waiting: the instance is looked up at this moment, not as it was when drawn.
  async function updateInstanceOfItemOnAir(itemAsOpened: Item): Promise<boolean> {
    const instanceOnAirNow = findInstanceOfItemOnProgram(
      readServerStateNow().instances,
      itemAsOpened.id,
    );
    if (instanceOnAirNow === undefined) {
      return true;
    }
    const updateOnAirCommand = buildUpdateInstanceDataCommandFromChangedFields({
      instanceId: instanceOnAirNow.id,
      changedFields: findFieldsChangedFrom(itemAsOpened),
      keysReadFromASource: graphicFieldsFormHandleRef.current?.listFieldKeysReadFromASource() ?? [],
    });
    if (updateOnAirCommand === undefined) {
      return true;
    }
    rememberCommandTypeWasSent('updateInstanceData');
    return sendCommand(updateOnAirCommand);
  }

  // One press, start to finish. The editor closes only when everything the press sent was
  // accepted (or there was nothing to send); after a refusal it stays open with the form
  // as typed and the server's message next to the buttons.
  //
  // "Atualizar no ar" sends two commands in a row, the save first: what is on air must
  // never be ahead of what the item stores, or the next take of the item would undo it.
  // If the save is accepted and the on-air update is refused, the item is already saved
  // and the editor stays open. The next press is then compared with what was saved, so it
  // saves again only what the operator changed since (a field put back included), while
  // the on-air update, still compared with the item as opened, gets its second try.
  // After a save the server never answered, the next press is compared both with the item
  // before that save and with the item after it, since the server may store either.
  //
  // "Cancelar" stays on during a press, and the rundown can hand the editor another item.
  // So the press asks before each command whether the editor has finished with this
  // item, and then sends nothing more: the air must not change after a "Cancelar".
  async function checkBothFormsThenSend(whatThePressAsksFor: WhatThePressAsksFor): Promise<void> {
    const areBothFormsValid = await options.checkBothForms();
    if (!areBothFormsValid || hasEditorFinishedWithThisItem()) {
      return;
    }

    const itemsTheServerMayStore = itemsTheServerMayStoreRef.current;
    if (itemAsItWasWhenOpened === null || itemsTheServerMayStore === null) {
      await createTheNewItemThenUseIt(whatThePressAsksFor);
      return;
    }

    const wasSaveAcceptedOrNotNeeded = await saveChangesToStoredItem(itemsTheServerMayStore);
    if (!wasSaveAcceptedOrNotNeeded || hasEditorFinishedWithThisItem()) {
      return;
    }
    if (whatThePressAsksFor === 'saveItemAndUpdateOnAir') {
      const wasOnAirUpdateAcceptedOrNotNeeded =
        await updateInstanceOfItemOnAir(itemAsItWasWhenOpened);
      if (!wasOnAirUpdateAcceptedOrNotNeeded) {
        return;
      }
    }
    // A refused take or preview leaves the editor open with the server's message; the
    // save it followed stays accepted, and the next press compares with what was saved.
    if (whatThePressAsksFor === 'saveItemAndTake' || whatThePressAsksFor === 'saveItemAndPreview') {
      const wasUseAccepted = await takeOrPreviewTheSavedItem(
        itemAsItWasWhenOpened.id,
        whatThePressAsksFor,
      );
      if (!wasUseAccepted) {
        return;
      }
    }
    askToBeClosedOnce();
  }

  // What a press on a save button does: the buttons go off, the forms are checked and,
  // if they pass, sent; the buttons come back whatever the outcome (accepted, refused,
  // no answer within 5 s, or a field that failed its rule).
  //
  // A press during an image upload sends nothing: the form still holds the old image
  // (BAJAOVRLAY-51). The buttons are off then too; this is the second guard, for any way
  // in that does not go through them, as a keyboard shortcut added later might not.
  async function pressSaveButton(whatThePressAsksFor: WhatThePressAsksFor): Promise<void> {
    if (options.isAnImageUploading) {
      return;
    }
    setIsWaitingForTheServer(true);
    try {
      await checkBothFormsThenSend(whatThePressAsksFor);
    } finally {
      setIsWaitingForTheServer(false);
    }
  }

  return {
    isWaitingForTheServer,
    commandTypesSentInThisOpening,
    pressSaveButton,
    cancel: askToBeClosedOnce,
  };
}
