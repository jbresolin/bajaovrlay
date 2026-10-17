import type { Item, ItemHome } from '@bajaovrlay/shared';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { findRundownShownOnPage } from '@/features/rundown/rundownShownOnPage';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import { chooseFieldsToShowInGraphicForm } from './graphicFieldsOfItemEditor';
import { ItemEditorButtons } from './ItemEditorButtons';
import { buildItemEditorFormValuesAtOpening, type ItemEditorFormValues } from './itemEditorForm';
import { ItemEditorFormFields } from './ItemEditorFormFields';
import { resolveItemEditorForm } from './itemEditorFormResolver';
import { ItemEditorHeader } from './ItemEditorHeader';
import type { PrefilledOpening } from './ItemEditorTargetProvider';
import { ItemGraphicFieldsForm, type ItemGraphicFieldsFormHandle } from './ItemGraphicFieldsForm';
import { ItemHomeSelect } from './ItemHomeSelect';
import { findInstanceOfItemOnProgram } from './itemInstanceOnAir';
import { useFirstGraphicForNewItemOnceKnown } from './useFirstGraphicForNewItemOnceKnown';
import { useItemEditorSaves } from './useItemEditorSaves';

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

/**
 * The item editor: prepares a new item (`createItem`), possibly opened already filled by
 * "Salvar como item", or changes a stored one (`updateItemFields`, only what changed,
 * the layer included; never the graphic). The form is filled once, when the panel is
 * given an item, and belongs to that item: handed another item, the panel starts a
 * fresh form instead of keeping what was typed for the first one. What a press sends is
 * useItemEditorSaves.ts; this file holds the two forms and draws them.
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

  // Every command a press sends, and what the editor does with each answer.
  const saves = useItemEditorSaves({
    itemAsItWasWhenOpened,
    chosenHomeForNewItem,
    itemForm,
    graphicFieldsFormHandleRef,
    checkBothForms,
    onClose: props.onClose,
  });

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
              isWaitingForTheServer={saves.isWaitingForTheServer}
              isItemOnAir={isItemOnAir}
              commandTypesSentInThisOpening={saves.commandTypesSentInThisOpening}
              onSavePressed={() => saves.pressSaveButton('saveItem')}
              onUpdateOnAirPressed={() => saves.pressSaveButton('saveItemAndUpdateOnAir')}
              onCancelPressed={saves.cancel}
            />
          </CardFooter>
        </form>
      </Card>
    </section>
  );
}
