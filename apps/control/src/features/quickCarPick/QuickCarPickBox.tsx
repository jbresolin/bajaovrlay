import type { Item } from '@bajaovrlay/shared';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { findInstanceOfItemOnProgram } from '@/features/items/itemInstanceOnAir';
import { ptBR } from '@/i18n/ptBR';
import {
  useIsConnectedToServer,
  useReadServerStateNow,
  useServerState,
} from '@/state/ControlPageStateProvider';
import { useWhyTheRoleCannotSend } from '@/state/operatorSessionContext';

import type { CarGroupsToPickQuickly } from './carGroupsToPickQuickly';
import { describeBattleOfPlaceTypedNow, describeCarsOfNumbersTypedNow } from './carsNowReadOut';
import { NumberBox } from './NumberBox';
import { readPositionsOfSourceNow } from './positionsOfTheSource';
import {
  checkBattlePlaceTyped,
  checkCarNumbersTyped,
  findProblemOfCarNumberTyped,
  type QuickCarPickCheck,
} from './quickCarPickChecks';
import {
  readSourceOfQuickCarPick,
  readStartOfQuickCarPick,
  type WayOfQuickCarPick,
} from './quickCarPickStart';
import { useSaveCarPicksIntoItem } from './useSaveCarPicksIntoItem';

const texts = ptBR.quickCarPick;

/** What the box needs: the item, what it offers, and what "Prévia" and "No ar" do next. */
export type QuickCarPickBoxProps = {
  /** The item as the box opened: its stored cars fill the boxes, its source is kept. */
  item: Item;
  offer: CarGroupsToPickQuickly;
  /** The page's own "Prévia" of the item (previewItem, origin manual), after the save. */
  onPreviewChosen: () => void;
  /** The page's one take path (features/autoPreview) for the item, after the save. */
  onTakeChosen: () => void;
  /** Closes the box: after "Prévia" or "No ar" went through. */
  onClose: () => void;
};

/**
 * The inside of "Escolher carros" (BAJAOVRLAY-82): the item's cars by number (one box per
 * car group, suggestions from the source's positions, Enter moving on) or, on a battle,
 * "Disputa pela posição"; one line naming the cars as they run now; then "Prévia" and
 * "No ar". A press checks the boxes (quickCarPickChecks.ts), saves the picks into the item
 * exactly as the editor's car picker does (useSaveCarPicksIntoItem.ts), and only once the
 * server accepted the save previews or takes the item the page's usual way. A refused save
 * keeps the box open with the server's sentence; a refused take shows where takes from
 * that part of the page always show. While the item is on air, "No ar" takes it again (the
 * graphic goes out and in with the new cars): no command changes the cars a live instance
 * follows in place, and typing their values on air would freeze them (concept §5.3).
 */
export function QuickCarPickBox(props: QuickCarPickBoxProps) {
  const { item, offer } = props;
  const controlId = useId();
  const readServerStateNow = useReadServerStateNow();
  const saveCarPicksIntoItem = useSaveCarPicksIntoItem();
  const isConnected = useIsConnectedToServer();
  const whyTheRoleCannotTake = useWhyTheRoleCannotSend('takeItem');
  const whyTheRoleCannotPreview = useWhyTheRoleCannotSend('previewItem');
  const isOnAir = useServerState(
    (state) => findInstanceOfItemOnProgram(state.instances, item.id) !== undefined,
  );

  // What the box opens with, read once: what the operator types afterwards is the box's.
  const [start] = useState(() => readStartOfQuickCarPick(item, offer));
  const [source] = useState(() => readSourceOfQuickCarPick(item, offer, readServerStateNow()));
  const [way, setWay] = useState<WayOfQuickCarPick>(start.way);
  const [carNumberTextOfEachGroup, setCarNumberTextOfEachGroup] = useState(
    start.carNumberTextOfEachGroup,
  );
  const [placeText, setPlaceText] = useState(start.placeText);
  // The message under each box (by group id, or 'place'), shown once the box was left or a
  // button pressed, never while a number is half typed.
  const [messageOfEachBox, setMessageOfEachBox] = useState<Record<string, string>>({});
  const [refusalOfTheSave, setRefusalOfTheSave] = useState<string | undefined>(undefined);
  const [isWaitingForTheServer, setIsWaitingForTheServer] = useState(false);

  // The positions follow every poll while the box is open (and only then: it is drawn only
  // while open), each slice compared by reference, so a poll redraws this box alone.
  const dataSources = useServerState((state) => state.dataSources);
  const dataSnapshots = useServerState((state) => state.dataSnapshots);
  const overrides = useServerState((state) => state.overrides);
  const bracketMatchFocuses = useServerState((state) => state.bracketMatchFocuses);
  const teams = useServerState((state) => state.teams);
  const positions = useMemo(
    () =>
      source === undefined
        ? undefined
        : readPositionsOfSourceNow(source.sourceId, {
            dataSources,
            dataSnapshots,
            overrides,
            bracketMatchFocuses,
            teams,
          }),
    [source, dataSources, dataSnapshots, overrides, bracketMatchFocuses, teams],
  );

  const numberBoxRefs = useRef<Array<HTMLInputElement | null>>([]);
  const placeBoxRef = useRef<HTMLInputElement | null>(null);
  const previewButtonRef = useRef<HTMLButtonElement | null>(null);

  // The first box takes the focus at opening, so the operator types the number at once.
  useEffect(() => {
    if (start.way === 'place') {
      placeBoxRef.current?.focus();
    } else {
      numberBoxRefs.current[0]?.focus();
    }
  }, [start.way]);

  const sourceWithPositions = source === undefined ? undefined : { ...source, positions };
  const suggestionsListId = `${controlId}-cars`;
  const readOut =
    way === 'place'
      ? describeBattleOfPlaceTypedNow(placeText, positions)
      : describeCarsOfNumbersTypedNow(offer.carGroups, carNumberTextOfEachGroup, positions);

  function changeCarNumberText(groupId: string, carNumberText: string): void {
    setCarNumberTextOfEachGroup((textsBefore) => ({ ...textsBefore, [groupId]: carNumberText }));
    setMessageOfEachBox((messagesBefore) => ({ ...messagesBefore, [groupId]: '' }));
  }

  // A number left behind is checked at once; an empty box is not, until a button is pressed.
  function checkNumberBoxWhenLeft(groupIndex: number): void {
    const carGroup = offer.carGroups[groupIndex];
    const carNumberText =
      carGroup === undefined ? '' : (carNumberTextOfEachGroup[carGroup.id] ?? '');
    if (
      carGroup === undefined ||
      sourceWithPositions === undefined ||
      carNumberText.trim() === ''
    ) {
      return;
    }
    const message = findProblemOfCarNumberTyped(carGroup, carNumberText, sourceWithPositions);
    setMessageOfEachBox((messagesBefore) => ({ ...messagesBefore, [carGroup.id]: message ?? '' }));
  }

  // Enter moves to the next box, and from the last one to "Prévia".
  function moveOnFromNumberBox(groupIndex: number): void {
    const nextBox = numberBoxRefs.current[groupIndex + 1];
    if (nextBox === undefined || nextBox === null) {
      previewButtonRef.current?.focus();
      return;
    }
    nextBox.focus();
  }

  function checkWhatIsTyped(): QuickCarPickCheck | undefined {
    if (sourceWithPositions === undefined) {
      return undefined;
    }
    if (way === 'place' && offer.battle !== undefined) {
      return checkBattlePlaceTyped(offer.battle, placeText, sourceWithPositions);
    }
    return checkCarNumbersTyped(offer.carGroups, carNumberTextOfEachGroup, sourceWithPositions);
  }

  // One press of "Prévia" or "No ar", start to finish.
  async function pressSendButton(whatToDoNext: 'preview' | 'take'): Promise<void> {
    const check = checkWhatIsTyped();
    if (check === undefined) {
      return;
    }
    if (check.status === 'problems') {
      const messages: Record<string, string> = {};
      for (const problem of check.problems) {
        messages[problem.about] = problem.message;
      }
      setMessageOfEachBox(messages);
      return;
    }
    setMessageOfEachBox({});
    setRefusalOfTheSave(undefined);
    setIsWaitingForTheServer(true);
    const outcome = await saveCarPicksIntoItem(item.id, offer.dataSchema, check.picksOfGroups);
    setIsWaitingForTheServer(false);
    if (outcome.status === 'refused') {
      setRefusalOfTheSave(outcome.message);
      return;
    }
    props.onClose();
    if (whatToDoNext === 'preview') {
      props.onPreviewChosen();
    } else {
      props.onTakeChosen();
    }
  }

  const isAnySendOff = !isConnected || source === undefined || isWaitingForTheServer;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{texts.boxTitle(item.label)}</h2>
      <p className="text-xs text-muted-foreground">
        {source === undefined
          ? texts.noSourceWithPositions
          : texts.sourceLine(source.sourceLabel, source.isLive)}
      </p>

      {offer.battle === undefined ? null : (
        <Tabs
          value={way}
          onValueChange={(chosenWay) => setWay(chosenWay === 'place' ? 'place' : 'carNumber')}
        >
          <TabsList className="w-full">
            <TabsTrigger value="carNumber">{texts.byNumberTab}</TabsTrigger>
            <TabsTrigger value="place">{texts.byPlaceTab}</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {way === 'carNumber' ? (
        <div className="grid grid-cols-2 gap-2">
          {offer.carGroups.map((carGroup, groupIndex) => (
            <NumberBox
              key={carGroup.id}
              label={carGroup.label}
              controlId={`${controlId}-${carGroup.id}`}
              suggestionsListId={suggestionsListId}
              placeholder={undefined}
              numberText={carNumberTextOfEachGroup[carGroup.id] ?? ''}
              message={messageOfEachBox[carGroup.id] || undefined}
              isDisabled={isWaitingForTheServer}
              ref={(element) => {
                numberBoxRefs.current[groupIndex] = element;
              }}
              onNumberTextChange={(carNumberText) =>
                changeCarNumberText(carGroup.id, carNumberText)
              }
              onLeft={() => checkNumberBoxWhenLeft(groupIndex)}
              onEnterPressed={() => moveOnFromNumberBox(groupIndex)}
            />
          ))}
          <datalist id={suggestionsListId}>
            {(positions ?? []).map((car) => (
              <option key={car.carNumber} value={String(car.carNumber)}>
                {texts.carSuggestion(car.teamName, car.position)}
              </option>
            ))}
          </datalist>
        </div>
      ) : (
        <NumberBox
          label={texts.battlePlaceLabel}
          controlId={`${controlId}-place`}
          suggestionsListId={undefined}
          placeholder={texts.battlePlacePlaceholder}
          numberText={placeText}
          message={messageOfEachBox.place || undefined}
          isDisabled={isWaitingForTheServer}
          ref={placeBoxRef}
          onNumberTextChange={(typedPlaceText) => {
            setPlaceText(typedPlaceText);
            setMessageOfEachBox({});
          }}
          onLeft={() => undefined}
          onEnterPressed={() => previewButtonRef.current?.focus()}
        />
      )}

      <p className="text-sm" aria-live="polite">
        {readOut}
      </p>
      {isOnAir ? <p className="text-xs text-muted-foreground">{texts.onAirNote}</p> : null}
      {refusalOfTheSave === undefined ? null : (
        <p role="alert" className="text-sm text-destructive">
          {refusalOfTheSave}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          ref={previewButtonRef}
          size="sm"
          variant="outline"
          disabled={isAnySendOff || whyTheRoleCannotPreview !== undefined}
          onClick={() => void pressSendButton('preview')}
        >
          {texts.previewButton}
        </Button>
        <Button
          size="sm"
          disabled={isAnySendOff || whyTheRoleCannotTake !== undefined}
          onClick={() => void pressSendButton('take')}
        >
          {texts.takeButton}
        </Button>
      </div>
      {whyTheRoleCannotTake === undefined ? null : (
        <p className="text-xs text-muted-foreground">{whyTheRoleCannotTake}</p>
      )}
    </div>
  );
}
