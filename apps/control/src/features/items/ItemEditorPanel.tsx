import type { Command, Item, ItemFields } from '@bajaovrlay/shared';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ActionButton } from '@/features/connection/ActionButton';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { ptBR } from '@/i18n/ptBR';
import {
  useReadServerStateNow,
  useSendCommand,
  useServerState,
} from '@/state/ControlPageStateProvider';

import {
  buildCreateItemCommand,
  buildUpdateInstanceDataCommandFromChangedFields,
  buildUpdateItemFieldsCommand,
} from './itemCommandsFromEditor';
import {
  buildItemEditorFormValuesForNewItem,
  buildItemEditorFormValuesFromItem,
  type ItemEditorFormValues,
} from './itemEditorForm';
import { ItemEditorFormFields } from './ItemEditorFormFields';
import { resolveItemEditorForm } from './itemEditorFormResolver';
import { ItemGraphicFieldsForm, type ItemGraphicFieldsFormHandle } from './ItemGraphicFieldsForm';
import { findInstanceOfItemOnProgram } from './itemInstanceOnAir';
import { useAskToBeClosedOnce } from './useAskToBeClosedOnce';

/** What the rundown gives the panel. */
export type ItemEditorPanelProps = {
  /** The rundown a new item is added to (at its end). */
  rundownId: string;
  /** The stored item to change, or null to prepare a new item. */
  itemBeingEdited: Item | null;
  /** Called after the server accepted the save, and when the operator cancels. */
  onClose: () => void;
};

/** What a press asks for: "Salvar item", or "Atualizar no ar" (save, then change the air). */
type WhatThePressAsksFor = 'saveItem' | 'saveItemAndUpdateOnAir';

/**
 * The item editor: prepares a new item (`createItem`) or changes a stored one
 * (`updateItemFields`, only what changed). The form is filled once, when the panel is
 * given an item, and belongs to that item: handed another item, the panel starts a
 * fresh form instead of keeping what was typed for the first one.
 */
export function ItemEditorPanel(props: ItemEditorPanelProps) {
  // React keeps a component's state for as long as its `key` stays the same. A key per
  // item is what makes "another item" mean "a new, freshly filled form".
  const keyOfTheFormForThisItem =
    props.itemBeingEdited === null ? 'new-item' : props.itemBeingEdited.id;
  return <ItemEditorPanelForOneItem key={keyOfTheFormForThisItem} {...props} />;
}

/**
 * The editor for one item, from the moment it is opened until it is closed. It holds
 * two react-hook-form forms: the fields every item has, and the fields of the chosen
 * graphic, generated from its manifest (features/schemaForm). Both are checked at every
 * press of a save button, so every wrong field shows its message at once.
 */
function ItemEditorPanelForOneItem(props: ItemEditorPanelProps) {
  const { rundownId } = props;
  const graphics = useServerState((state) => state.graphics);
  const layers = useServerState((state) => state.layers);
  const instances = useServerState((state) => state.instances);
  const readServerStateNow = useReadServerStateNow();
  const sendCommand = useSendCommand();
  const askToBeClosedOnce = useAskToBeClosedOnce(props.onClose);

  // The item as it was when the panel opened. Kept on purpose, and never replaced by a
  // newer copy from the server: "what changed" is judged against the values the form
  // was filled with, so a part another operator changed meanwhile, and this operator
  // did not touch, is not sent back with its old value.
  const [itemAsItWasWhenOpened] = useState(props.itemBeingEdited);
  const isEditingStoredItem = itemAsItWasWhenOpened !== null;

  // Until a save button is pressed for the first time nothing is checked while typing.
  // From that press on, each field is checked again as it changes, so a message goes away
  // the moment its field is corrected. react-hook-form switches this on by itself only
  // for its own `handleSubmit`; the press below checks with `trigger`, so the panel says
  // it here. What could go wrong: this relies on react-hook-form reading `mode` anew on
  // every draw (ItemEditorPanelCheckAtThePress.test.tsx fails if an upgrade ends that).
  const [hasCheckedTheFormsOnce, setHasCheckedTheFormsOnce] = useState(false);
  const whenFieldsAreChecked = hasCheckedTheFormsOnce ? 'onChange' : 'onSubmit';

  const itemForm = useForm<ItemEditorFormValues>({
    defaultValues:
      itemAsItWasWhenOpened === null
        ? buildItemEditorFormValuesForNewItem(graphics[0])
        : buildItemEditorFormValuesFromItem(itemAsItWasWhenOpened),
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

  // A new item starts on the first graphic the server has, on that graphic's default
  // layer. When the page already knows the graphics (the usual case: "+ Item" pressed
  // on a connected page) that is the form's starting value, above. This effect is only
  // for a list of graphics that arrives after the panel is drawn (the page opened
  // before the server answered). Both are needed: a value set from an effect in the
  // very draw that creates the form is not shown by the dropdown. It never overrides a
  // graphic that is already chosen.
  const getItemFormValues = itemForm.getValues;
  const setItemFormValue = itemForm.setValue;
  useEffect(() => {
    const firstGraphic = graphics[0];
    const isGraphicStillToBeChosen = getItemFormValues('graphicId') === '';
    if (isEditingStoredItem || firstGraphic === undefined || !isGraphicStillToBeChosen) {
      return;
    }
    setItemFormValue('graphicId', firstGraphic.id);
    setItemFormValue('layerId', firstGraphic.defaultLayerId);
  }, [graphics, isEditingStoredItem, getItemFormValues, setItemFormValue]);

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
      rundownId,
      itemFormValues: itemForm.getValues(),
      fields: graphicFieldsForm === null ? {} : graphicFieldsForm.buildFieldsOfNewItem(),
    });
    rememberCommandTypeWasSent('createItem');
    return sendCommand(createCommand);
  }

  // The fields of the graphic in which the form differs from the stored item. Both
  // commands of a press are built from this one answer, so they always agree.
  function findChangedFieldsOfStoredItem(storedItem: Item): ItemFields {
    const graphicFieldsForm = graphicFieldsFormHandleRef.current;
    return graphicFieldsForm === null
      ? {}
      : graphicFieldsForm.findFieldsChangedFromStoredItem(storedItem);
  }

  // Saves what changed in a stored item. Answers false only when the server refused;
  // when nothing was changed there is nothing to send, and that counts as done.
  async function saveChangesToStoredItem(
    storedItem: Item,
    changedFields: ItemFields,
  ): Promise<boolean> {
    const updateCommand = buildUpdateItemFieldsCommand({
      itemBeingEdited: storedItem,
      itemFormValues: itemForm.getValues(),
      changedFields,
    });
    if (updateCommand === undefined) {
      return true;
    }
    rememberCommandTypeWasSent('updateItemFields');
    return sendCommand(updateCommand);
  }

  // Puts the changed fields on the item's instance on air. Answers false only when the
  // server refused. Nothing is sent, and that counts as done, when no typed value changed
  // (a new label is not on air) or when the item left the air while the save was waiting:
  // the instance is looked up at this moment, not as it was when the button was drawn.
  async function updateInstanceOfItemOnAir(
    storedItem: Item,
    changedFields: ItemFields,
  ): Promise<boolean> {
    const instanceOnAirNow = findInstanceOfItemOnProgram(
      readServerStateNow().instances,
      storedItem.id,
    );
    if (instanceOnAirNow === undefined) {
      return true;
    }
    const updateOnAirCommand = buildUpdateInstanceDataCommandFromChangedFields({
      instanceId: instanceOnAirNow.id,
      changedFields,
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
  // and the editor stays open. "What changed" is still judged against the item as it was
  // when the editor opened, so a second press sends both commands again: the server
  // treats the repeated save as a change of nothing (it leaves no trace), and the on-air
  // update gets its second try. Keeping no memory of "already saved" is deliberate: it is
  // one rule for every press instead of a second state that could go stale.
  async function checkBothFormsThenSend(whatThePressAsksFor: WhatThePressAsksFor): Promise<void> {
    const areBothFormsValid = await checkBothForms();
    if (!areBothFormsValid) {
      return;
    }

    if (itemAsItWasWhenOpened === null) {
      const wasNewItemAccepted = await createTheNewItem();
      if (wasNewItemAccepted) {
        askToBeClosedOnce();
      }
      return;
    }

    const changedFields = findChangedFieldsOfStoredItem(itemAsItWasWhenOpened);
    const wasSaveAcceptedOrNotNeeded = await saveChangesToStoredItem(
      itemAsItWasWhenOpened,
      changedFields,
    );
    if (!wasSaveAcceptedOrNotNeeded) {
      return;
    }
    if (whatThePressAsksFor === 'saveItemAndUpdateOnAir') {
      const wasOnAirUpdateAcceptedOrNotNeeded = await updateInstanceOfItemOnAir(
        itemAsItWasWhenOpened,
        changedFields,
      );
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
  const hasSentACommandInThisOpening = commandTypesSentInThisOpening.length > 0;

  return (
    <section aria-label={ptBR.itemEditor.panelLabel}>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>
              {isEditingStoredItem ? ptBR.itemEditor.editItemTitle : ptBR.itemEditor.newItemTitle}
            </h2>
          </CardTitle>
        </CardHeader>
        {/* The buttons are plain buttons, not submit buttons, and the form's own submit
            is cancelled, as in "Edição rápida": Enter in a text field does nothing. */}
        <form onSubmit={(event) => event.preventDefault()} noValidate className="contents">
          <CardContent className="flex flex-col gap-4">
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
                itemAsItWasWhenOpened={itemAsItWasWhenOpened}
                whenFieldsAreChecked={whenFieldsAreChecked}
                handleRef={graphicFieldsFormHandleRef}
              />
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap items-center gap-3">
            <ActionButton
              type="button"
              disabled={isWaitingForTheServer}
              onClick={() => runWithSaveButtonsOff('saveItem')}
            >
              {ptBR.itemEditor.saveButton}
            </ActionButton>
            {isItemOnAir && (
              <ActionButton
                type="button"
                variant="secondary"
                disabled={isWaitingForTheServer}
                onClick={() => runWithSaveButtonsOff('saveItemAndUpdateOnAir')}
              >
                {ptBR.itemEditor.updateOnAirButton}
              </ActionButton>
            )}
            <Button type="button" variant="outline" onClick={() => askToBeClosedOnce()}>
              {ptBR.itemEditor.cancelButton}
            </Button>
            {hasSentACommandInThisOpening && (
              <CommandErrorMessage commandTypes={commandTypesSentInThisOpening} />
            )}
          </CardFooter>
        </form>
      </Card>
    </section>
  );
}
