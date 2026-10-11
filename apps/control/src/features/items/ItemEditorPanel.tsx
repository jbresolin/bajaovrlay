import type { Item } from '@bajaovrlay/shared';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ActionButton } from '@/features/connection/ActionButton';
import { CommandErrorMessage } from '@/features/playout/CommandErrorMessage';
import { RaceClockFormFields } from '@/features/playout/RaceClockFormFields';
import {
  defaultRaceClockTakeFormValues,
  type RaceClockTakeFormValues,
} from '@/features/playout/raceClockTakeForm';
import { resolveRaceClockTakeForm } from '@/features/playout/raceClockTakeFormResolver';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand, useServerState } from '@/state/ControlPageStateProvider';

import {
  buildCreateItemCommand,
  buildUpdateItemFieldsCommand,
  isGraphicTheRaceClock,
} from './itemCommandsFromForm';
import {
  buildItemEditorFormValuesForNewItem,
  buildItemEditorFormValuesFromItem,
  type ItemEditorFormValues,
} from './itemEditorForm';
import { ItemEditorFormFields } from './ItemEditorFormFields';
import { resolveItemEditorForm } from './itemEditorFormResolver';
import {
  isFormBlankingLapsTheItemHas,
  readRaceClockFormValuesFromItemFields,
} from './raceClockItemFields';

/** What the rundown gives the panel. */
export type ItemEditorPanelProps = {
  /** The rundown a new item is added to (at its end). */
  rundownId: string;
  /** The stored item to change, or null to prepare a new item. */
  itemBeingEdited: Item | null;
  /** Called after the server accepted the save, and when the operator cancels. */
  onClose: () => void;
};

// The race clock fields are drawn by the take panel too. This prefix keeps the ids of
// this panel's copy apart from the take panel's, which is on the page at the same time.
const raceClockControlIdPrefix = 'item-editor-race-clock';

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
 * two react-hook-form forms: the fields every item has, and the race clock's fields,
 * which are the take panel's own component and rules, reused. Both are checked at every
 * press of "Salvar item", so every wrong field shows its message at once.
 *
 * Hand-written for the race clock; BAJAOVRLAY-14 generates the fields of every graphic.
 */
function ItemEditorPanelForOneItem(props: ItemEditorPanelProps) {
  const { rundownId, onClose } = props;
  const graphics = useServerState((state) => state.graphics);
  const layers = useServerState((state) => state.layers);
  const sendCommand = useSendCommand();

  // The item as it was when the panel opened. Kept on purpose, and never replaced by a
  // newer copy from the server: "what changed" is judged against the values the form
  // was filled with, so a part another operator changed meanwhile, and this operator
  // did not touch, is not sent back with its old value.
  const [itemAsItWasWhenOpened] = useState(props.itemBeingEdited);
  const isEditingStoredItem = itemAsItWasWhenOpened !== null;
  const [raceClockValuesReadFromItem] = useState(() => {
    const isStoredRaceClockItem =
      itemAsItWasWhenOpened !== null && isGraphicTheRaceClock(itemAsItWasWhenOpened.graphicId);
    return isStoredRaceClockItem
      ? readRaceClockFormValuesFromItemFields(itemAsItWasWhenOpened.fields)
      : undefined;
  });

  // Until "Salvar item" is pressed for the first time nothing is checked while typing.
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
  const raceClockForm = useForm<RaceClockTakeFormValues>({
    defaultValues: raceClockValuesReadFromItem?.formValues ?? defaultRaceClockTakeFormValues,
    resolver: resolveRaceClockTakeForm,
    mode: whenFieldsAreChecked,
  });
  const chosenGraphicId = useWatch({ control: itemForm.control, name: 'graphicId' });
  const isGraphicChosen = chosenGraphicId !== '';
  const isRaceClockChosen = isGraphicTheRaceClock(chosenGraphicId);
  // The button is off while a press is being checked and its command waits for the
  // server's answer, so an impatient second click cannot create the item twice.
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);
  // The page remembers the last refused command until some command succeeds. Without
  // this, an editor opened again after a refused save would greet the operator with the
  // refusal of a save it never made.
  const [hasSentASaveInThisOpening, setHasSentASaveInThisOpening] = useState(false);

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

  // The panel asks to be closed at most once, and never after it left the page. A save
  // can still be waiting for the server when the operator presses "Cancelar" or opens
  // another item; without this, the late "accepted" would call `onClose` a second time
  // and could close an editor the operator has opened since.
  const hasFinishedWithThisItemRef = useRef(false);
  useEffect(() => {
    hasFinishedWithThisItemRef.current = false;
    return () => {
      hasFinishedWithThisItemRef.current = true;
    };
  }, []);
  function askToBeClosedOnce(): void {
    if (hasFinishedWithThisItemRef.current) {
      return;
    }
    hasFinishedWithThisItemRef.current = true;
    onClose();
  }

  // Runs only when every field of both forms passed its rule. `raceClockFormValues` is
  // undefined for a graphic the editor has no form for. The moment of the save plays no
  // part: a clock's reference moment is stamped by the server when the item is taken.
  async function sendFormsAsCommand(
    itemFormValues: ItemEditorFormValues,
    raceClockFormValues: RaceClockTakeFormValues | undefined,
  ): Promise<void> {
    if (itemAsItWasWhenOpened === null) {
      const createCommand = buildCreateItemCommand({
        rundownId,
        itemFormValues,
        raceClockFormValues,
      });
      setHasSentASaveInThisOpening(true);
      const wasAcceptedByTheServer = await sendCommand(createCommand);
      if (wasAcceptedByTheServer) {
        askToBeClosedOnce();
      }
      return;
    }

    // The update command cannot remove a field, so erased laps cannot be saved. Saying
    // so under the field is better than silently keeping the old laps.
    const isTryingToRemoveLaps =
      raceClockFormValues !== undefined &&
      isFormBlankingLapsTheItemHas(itemAsItWasWhenOpened.fields, raceClockFormValues);
    if (isTryingToRemoveLaps) {
      raceClockForm.setError('lapsCompletedByLeader', {
        type: 'validation',
        message: ptBR.itemEditor.fieldErrors.lapsCannotBeRemoved,
      });
      return;
    }

    const updateCommand = buildUpdateItemFieldsCommand({
      itemBeingEdited: itemAsItWasWhenOpened,
      itemFormValues,
      raceClockFormValues,
    });
    // Nothing was changed: there is nothing to send, and the operator is done.
    if (updateCommand === undefined) {
      askToBeClosedOnce();
      return;
    }
    setHasSentASaveInThisOpening(true);
    const wasAcceptedByTheServer = await sendCommand(updateCommand);
    if (wasAcceptedByTheServer) {
      askToBeClosedOnce();
    }
  }

  // `trigger` checks every field of one form, puts the messages under the wrong ones and
  // answers whether all passed. The item part goes first. Whatever its result, the race
  // clock part is checked too when it is on screen, so one press shows every problem;
  // only when both passed is anything sent.
  async function checkBothFormsThenSend(): Promise<void> {
    setHasCheckedTheFormsOnce(true);

    const isItemPartValid = await itemForm.trigger(undefined, { shouldFocus: true });
    // The typing cursor goes to the first wrong field from the top. So the race clock
    // part may take the focus only when the item part, drawn above it, had nothing wrong.
    const isRaceClockPartValid = isRaceClockChosen
      ? await raceClockForm.trigger(undefined, { shouldFocus: isItemPartValid })
      : true;
    if (!isItemPartValid || !isRaceClockPartValid) {
      return;
    }

    const raceClockFormValues = isRaceClockChosen ? raceClockForm.getValues() : undefined;
    await sendFormsAsCommand(itemForm.getValues(), raceClockFormValues);
  }

  // What a press on "Salvar item" does: the button goes off, the forms are checked and,
  // if they pass, sent; the button comes back whatever the outcome (accepted, refused,
  // no answer within 5 s, or a field that failed its rule).
  async function runWithSaveButtonOff(): Promise<void> {
    setIsWaitingForTheServer(true);
    try {
      await checkBothFormsThenSend();
    } finally {
      setIsWaitingForTheServer(false);
    }
  }

  const labelsOfFieldsThatCouldNotBeRead = (
    raceClockValuesReadFromItem?.formFieldsThatCouldNotBeRead ?? []
  ).map((formFieldName) => ptBR.playout.fields[formFieldName]);
  const hasFieldsThatCouldNotBeRead = labelsOfFieldsThatCouldNotBeRead.length > 0;

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
            is cancelled, as in the take panel: Enter in a text field does nothing. */}
        <form onSubmit={(event) => event.preventDefault()} noValidate className="contents">
          <CardContent className="flex flex-col gap-4">
            <ItemEditorFormFields
              form={itemForm}
              graphics={graphics}
              layers={layers}
              isEditingStoredItem={isEditingStoredItem}
            />
            {hasFieldsThatCouldNotBeRead && (
              <p role="status" className="text-sm text-muted-foreground">
                {ptBR.itemEditor.fieldsThatCouldNotBeRead(
                  labelsOfFieldsThatCouldNotBeRead.join(', '),
                )}
              </p>
            )}
            {isRaceClockChosen && (
              <RaceClockFormFields
                form={raceClockForm}
                controlIdPrefix={raceClockControlIdPrefix}
              />
            )}
            {isGraphicChosen && !isRaceClockChosen && (
              <p className="text-sm text-muted-foreground">
                {ptBR.itemEditor.genericEditorComesLater}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap items-center gap-3">
            <ActionButton
              type="button"
              disabled={isWaitingForTheServer}
              onClick={() => runWithSaveButtonOff()}
            >
              {ptBR.itemEditor.saveButton}
            </ActionButton>
            <Button type="button" variant="outline" onClick={() => askToBeClosedOnce()}>
              {ptBR.itemEditor.cancelButton}
            </Button>
            {hasSentASaveInThisOpening && (
              <CommandErrorMessage commandTypes={['createItem', 'updateItemFields']} />
            )}
          </CardFooter>
        </form>
      </Card>
    </section>
  );
}
