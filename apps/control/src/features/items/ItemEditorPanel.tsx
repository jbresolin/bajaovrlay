import type { Command, Item, ItemFields, ItemHome } from '@bajaovrlay/shared';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { findRundownShownOnPage } from '@/features/rundown/rundownShownOnPage';
import { ptBR } from '@/i18n/ptBR';
import {
  useReadServerStateNow,
  useSendCommand,
  useServerState,
} from '@/state/ControlPageStateProvider';

import { chooseFieldsToShowInGraphicForm } from './graphicFieldsOfItemEditor';
import {
  buildCreateItemCommand,
  buildUpdateInstanceDataCommandFromChangedFields,
  buildUpdateItemFieldsCommand,
} from './itemCommandsFromEditor';
import { ItemEditorButtons } from './ItemEditorButtons';
import { buildItemEditorFormValuesAtOpening, type ItemEditorFormValues } from './itemEditorForm';
import { ItemEditorFormFields } from './ItemEditorFormFields';
import { resolveItemEditorForm } from './itemEditorFormResolver';
import { ItemEditorHeader } from './ItemEditorHeader';
import type { PrefilledOpening } from './ItemEditorTargetProvider';
import { ItemGraphicFieldsForm, type ItemGraphicFieldsFormHandle } from './ItemGraphicFieldsForm';
import { ItemHomeSelect } from './ItemHomeSelect';
import { findInstanceOfItemOnProgram } from './itemInstanceOnAir';
import {
  type AnswerToSave,
  type ItemsTheServerMayStore,
  joinSavesOfOneFormIntoOne,
  listEveryItemTheServerMayStore,
  recordAnswerToSave,
} from './itemsTheServerMayStore';
import { useAskToBeClosedOnce } from './useAskToBeClosedOnce';
import { useFirstGraphicForNewItemOnceKnown } from './useFirstGraphicForNewItemOnceKnown';

/** What the rundown gives the panel. */
export type ItemEditorPanelProps = {
  /**
   * Where a new item goes unless the operator picks another place in "Onde": the rundown
   * on screen after the rundown's "+ Item", a panel after that panel's "+ Atalho".
   */
  homeForNewItem: ItemHome;
  /** For a new item opened by "Salvar como item": what it opens filled with. */
  prefilledOpening?: PrefilledOpening | null;
  /** The stored item to change, or null to prepare a new item. */
  itemBeingEdited: Item | null;
  /** Called after the server accepted the save, and when the operator cancels. */
  onClose: () => void;
};

/** What a press asks for: "Salvar item", or "Atualizar no ar" (save, then change the air). */
type WhatThePressAsksFor = 'saveItem' | 'saveItemAndUpdateOnAir';

/**
 * The item editor: prepares a new item (`createItem`), possibly opened already filled by
 * "Salvar como item", or changes a stored one (`updateItemFields`, only what changed,
 * the layer included; never the graphic). The form is filled once, when the panel is
 * given an item, and belongs to that item: handed another item, the panel starts a
 * fresh form instead of keeping what was typed for the first one.
 */
export function ItemEditorPanel(props: ItemEditorPanelProps) {
  // React keeps a component's state for as long as its `key` stays the same. A key per
  // item is what makes "another item" mean "a new, freshly filled form"; for a new item
  // the key names where it goes, so "+ Atalho" after "+ Item" starts afresh too, and a
  // prefilled opening has a number of its own, so every "Salvar como item" does as well.
  return <ItemEditorPanelForOneItem key={buildKeyOfTheFormForThisOpening(props)} {...props} />;
}

/** The React key of the editor's form: one per stored item, home or prefilled opening. */
function buildKeyOfTheFormForThisOpening(props: ItemEditorPanelProps): string {
  if (props.itemBeingEdited !== null) {
    return props.itemBeingEdited.id;
  }
  const prefilledOpening = props.prefilledOpening ?? null;
  if (prefilledOpening !== null) {
    return `prefilled-new-item-${prefilledOpening.openingNumber}`;
  }
  return `new-item-${JSON.stringify(props.homeForNewItem)}`;
}

/**
 * The editor for one item, from the moment it is opened until it is closed. It holds
 * two react-hook-form forms: the fields every item has, and the fields of the chosen
 * graphic, generated from its manifest (features/schemaForm). Both are checked at every
 * press of a save button, so every wrong field shows its message at once.
 */
function ItemEditorPanelForOneItem(props: ItemEditorPanelProps) {
  const graphics = useServerState((state) => state.graphics);
  const layers = useServerState((state) => state.layers);
  const instances = useServerState((state) => state.instances);
  const rundowns = useServerState((state) => state.rundowns);
  const panels = useServerState((state) => state.quickFirePanels);
  const readServerStateNow = useReadServerStateNow();
  const sendCommand = useSendCommand();
  const { askToBeClosedOnce, hasEditorFinishedWithThisItem } = useAskToBeClosedOnce(props.onClose);

  // The item as it was when the panel opened. Kept on purpose, and never replaced by a
  // newer copy from the server: "what changed" is judged against the values the form
  // was filled with, so a part another operator changed meanwhile, and this operator
  // did not touch, is not sent back with its old value.
  const [itemAsItWasWhenOpened] = useState(props.itemBeingEdited);
  const isEditingStoredItem = itemAsItWasWhenOpened !== null;
  // Kept for the same reason: the key (above) gives every prefilled opening its own form.
  const [prefill] = useState(props.prefilledOpening?.prefill ?? null);
  // "Onde" for a new item: where it was opened from until the operator picks another place.
  const [chosenHomeForNewItem, setChosenHomeForNewItem] = useState(props.homeForNewItem);
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

  // Until a save button is pressed for the first time nothing is checked while typing.
  // From that press on, each field is checked again as it changes, so a message goes away
  // the moment its field is corrected. react-hook-form switches this on by itself only
  // for its own `handleSubmit`; the press below checks with `trigger`, so the panel says
  // it here. What could go wrong: this relies on react-hook-form reading `mode` anew on
  // every draw (ItemEditorPanelCheckAtThePress.test.tsx fails if an upgrade ends that).
  const [hasCheckedTheFormsOnce, setHasCheckedTheFormsOnce] = useState(false);
  const whenFieldsAreChecked = hasCheckedTheFormsOnce ? 'onChange' : 'onSubmit';

  const itemForm = useForm<ItemEditorFormValues>({
    defaultValues: buildItemEditorFormValuesAtOpening({
      storedItem: itemAsItWasWhenOpened,
      prefill,
      firstGraphic: graphics[0],
    }),
    resolver: resolveItemEditorForm,
    mode: whenFieldsAreChecked,
  });
  const chosenGraphicId = useWatch({ control: itemForm.control, name: 'graphicId' });
  const chosenGraphic = graphics.find((graphic) => graphic.id === chosenGraphicId);

  // The second form lives in ItemGraphicFieldsForm, drawn below once the page knows the
  // chosen graphic. This is how the panel reaches it at a press: the form puts its handle
  // here while it is on the page. Null means there is no such form right now (no graphic
  // chosen yet, or a stored item whose graphic the server no longer has), and then the
  // item has no fields of a graphic to check or to send.
  const graphicFieldsFormHandleRef = useRef<ItemGraphicFieldsFormHandle | null>(null);

  // The buttons are off while a press is being checked and its commands wait for the
  // server's answer, so an impatient second click cannot create the item twice.
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);
  // The page remembers the last refused command until some command succeeds. Without
  // this list, an editor opened again after a refused save would greet the operator with
  // the refusal of a save it never made; and a refused "Atualizar" of "Edição rápida"
  // would appear here although this editor never sent an on-air update.
  const [commandTypesSentInThisOpening, setCommandTypesSentInThisOpening] = useState<
    Command['type'][]
  >([]);
  function rememberCommandTypeWasSent(commandType: Command['type']): void {
    setCommandTypesSentInThisOpening((typesSentSoFar) => [...typesSentSoFar, commandType]);
  }

  // A new item without a prefill starts on the first graphic, also when the list of
  // graphics arrives after the panel is drawn (why both, in the hook).
  useFirstGraphicForNewItemOnceKnown(itemForm, graphics, isEditingStoredItem);

  // `trigger` checks every field of one form, puts the messages under the wrong ones and
  // answers whether all passed. The item part goes first. Whatever its result, the
  // graphic's fields are checked too when they are on screen, so one press shows every
  // problem; only when both passed is anything sent.
  async function checkBothForms(): Promise<boolean> {
    setHasCheckedTheFormsOnce(true);

    const isItemPartValid = await itemForm.trigger(undefined, { shouldFocus: true });
    // The typing cursor goes to the first wrong field from the top. So the graphic's
    // part may take the focus only when the item part, drawn above it, had nothing wrong.
    const graphicFieldsForm = graphicFieldsFormHandleRef.current;
    const isGraphicPartValid =
      graphicFieldsForm === null
        ? true
        : await graphicFieldsForm.checkFields({ shouldFocusFirstWrongField: isItemPartValid });
    return isItemPartValid && isGraphicPartValid;
  }

  // Sends the whole of a new item. Answers whether the server accepted it. The moment of
  // the save plays no part: a wall-clock field is stamped by the server at the take.
  async function createTheNewItem(): Promise<boolean> {
    const graphicFieldsForm = graphicFieldsFormHandleRef.current;
    const createCommand = buildCreateItemCommand({
      home: chosenHomeForNewItem,
      itemFormValues: itemForm.getValues(),
      fields: graphicFieldsForm === null ? {} : graphicFieldsForm.buildFieldsOfNewItem(),
    });
    rememberCommandTypeWasSent('createItem');
    return sendCommand(createCommand);
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
  // and the next take uses the new one) or when the item left the air while the save was
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
    const areBothFormsValid = await checkBothForms();
    if (!areBothFormsValid || hasEditorFinishedWithThisItem()) {
      return;
    }

    const itemsTheServerMayStore = itemsTheServerMayStoreRef.current;
    if (itemAsItWasWhenOpened === null || itemsTheServerMayStore === null) {
      const wasNewItemAccepted = await createTheNewItem();
      if (wasNewItemAccepted) {
        askToBeClosedOnce();
      }
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
    askToBeClosedOnce();
  }

  // What a press on a save button does: the buttons go off, the forms are checked and,
  // if they pass, sent; the buttons come back whatever the outcome (accepted, refused,
  // no answer within 5 s, or a field that failed its rule).
  async function runWithSaveButtonsOff(whatThePressAsksFor: WhatThePressAsksFor): Promise<void> {
    setIsWaitingForTheServer(true);
    try {
      await checkBothFormsThenSend(whatThePressAsksFor);
    } finally {
      setIsWaitingForTheServer(false);
    }
  }

  const isItemOnAir =
    itemAsItWasWhenOpened !== null &&
    findInstanceOfItemOnProgram(instances, itemAsItWasWhenOpened.id) !== undefined;
  // An empty list of graphics means the server has not answered yet, not that the
  // graphic is gone, so the notice waits for a list that lacks the item's graphic.
  const isGraphicOfStoredItemGone =
    isEditingStoredItem && graphics.length > 0 && chosenGraphic === undefined;

  return (
    <section aria-label={ptBR.itemEditor.panelLabel}>
      <Card>
        <ItemEditorHeader isEditingStoredItem={isEditingStoredItem} />
        {/* The buttons are plain buttons, not submit buttons, and the form's own submit
            is cancelled, as in "Edição rápida": Enter in a text field does nothing. */}
        <form onSubmit={(event) => event.preventDefault()} noValidate className="contents">
          <CardContent className="flex flex-col gap-4">
            {isEditingStoredItem ? null : (
              <ItemHomeSelect
                rundownShown={findRundownShownOnPage(rundowns)}
                panels={panels}
                chosenHome={chosenHomeForNewItem}
                onHomeChosen={setChosenHomeForNewItem}
              />
            )}
            <ItemEditorFormFields
              form={itemForm}
              graphics={graphics}
              layers={layers}
              isEditingStoredItem={isEditingStoredItem}
            />
            {isGraphicOfStoredItemGone && (
              <p role="status" className="text-sm text-muted-foreground">
                {ptBR.itemEditor.graphicOfItemNotRegistered}
              </p>
            )}
            {/* The key makes "another graphic" mean "a new form, from that graphic's
                defaults": React throws the form of the first graphic away. */}
            {chosenGraphic !== undefined && (
              <ItemGraphicFieldsForm
                key={chosenGraphic.id}
                graphic={chosenGraphic}
                fieldsToShow={chooseFieldsToShowInGraphicForm(
                  chosenGraphic.id,
                  itemAsItWasWhenOpened,
                  prefill,
                )}
                whenFieldsAreChecked={whenFieldsAreChecked}
                handleRef={graphicFieldsFormHandleRef}
              />
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap items-center gap-3">
            <ItemEditorButtons
              isWaitingForTheServer={isWaitingForTheServer}
              isItemOnAir={isItemOnAir}
              commandTypesSentInThisOpening={commandTypesSentInThisOpening}
              onSavePressed={() => runWithSaveButtonsOff('saveItem')}
              onUpdateOnAirPressed={() => runWithSaveButtonsOff('saveItemAndUpdateOnAir')}
              onCancelPressed={() => askToBeClosedOnce()}
            />
          </CardFooter>
        </form>
      </Card>
    </section>
  );
}
