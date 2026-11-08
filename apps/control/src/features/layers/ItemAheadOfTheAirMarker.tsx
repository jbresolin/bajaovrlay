import {
  findWhereTheItemIsAheadOfTheAir,
  type Graphic,
  type Instance,
  type Item,
  type WallClockFieldsChoice,
} from '@bajaovrlay/shared';
import { memo, useState, useSyncExternalStore } from 'react';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';
import {
  useReadServerStateNow,
  useSendCommand,
  useServerState,
  useSubscribeToServerState,
} from '@/state/ControlPageStateProvider';
import type { ServerState } from '@/state/serverStateStore';

import { nameFieldsByTheirTitles } from './fieldsOfInstanceOnAir';
import {
  buildUpdateThatCatchesUpWithTheItem,
  isAClockFieldBehind,
} from './updateThatCatchesUpWithTheItem';
import { WallClockChoiceDialog } from './WallClockChoiceDialog';

/** One instance, its item and its graphic, as the store holds them at one moment. */
type InstanceWithItsItem = {
  instance: Instance | undefined;
  item: Item | undefined;
  graphic: Graphic | undefined;
};

/** Finds the instance with this id, its item and its graphic in the server state. */
function findInstanceWithItsItem(state: ServerState, instanceId: string): InstanceWithItsItem {
  const instance = state.instances.find((candidate) => candidate.id === instanceId);
  const item = state.items.find((candidate) => candidate.id === instance?.itemId);
  const graphic = state.graphics.find((candidate) => candidate.id === instance?.graphicId);
  return { instance, item, graphic };
}

/** The fields of this instance behind its item, read from the server state as it is now. */
function listKeysBehind(state: ServerState, instanceId: string): string[] {
  const { instance, item, graphic } = findInstanceWithItsItem(state, instanceId);
  if (instance === undefined) {
    return [];
  }
  return findWhereTheItemIsAheadOfTheAir(instance, item, graphic);
}

// The keys behind as one text, one key per line: a text compares by value, so the marker
// redraws only when the list itself changes. A list would be a new array at every read.
const separatorOfKeys = '\n';

/**
 * "item mudou" on a Camadas row (BAJAOVRLAY-38): the chip, its tooltip naming the fields
 * the instance shows older values of than its item now holds, and the two ways to catch
 * up. On program: "Disparar" (takeItem, the normal take) and "Atualizar no ar"
 * (updateInstanceData with only those fields). On the layer's preview: "Atualizar prévia"
 * alone, since a take from there would put on air something that was not previewed.
 * A clock field among them first asks the clock question (WallClockChoiceDialog.tsx).
 * Draws nothing while the air matches the item.
 *
 * It reads its own instance and item from the store, compared by value, and is memoised
 * on its two props (BAJAOVRLAY-45's rule): a poll that refreshes a bound field on air
 * changes the instances slice and redraws the row, but not this marker.
 */
export const ItemAheadOfTheAirMarker = memo(function ItemAheadOfTheAirMarker(props: {
  instanceId: string;
  output: 'program' | 'preview';
}) {
  const { instanceId, output } = props;
  const subscribeToServerState = useSubscribeToServerState();
  const readServerStateNow = useReadServerStateNow();
  const sendCommand = useSendCommand();
  // The graphics slice changes when a package is added or removed, never at a poll.
  const graphics = useServerState((state) => state.graphics);
  const [isAskingAboutTheClock, setIsAskingAboutTheClock] = useState(false);
  const [isUpdateWaiting, setIsUpdateWaiting] = useState(false);

  // React calls the reader after every change of the store and redraws only when the text
  // differs from the last one (the same way as "Valor agora", BindingValueNowLine.tsx).
  const keysBehindText = useSyncExternalStore(subscribeToServerState, () =>
    listKeysBehind(readServerStateNow(), instanceId).join(separatorOfKeys),
  );
  if (keysBehindText === '') {
    return null;
  }
  const keysBehind = keysBehindText.split(separatorOfKeys);
  const graphicId = readServerStateNow().instances.find(
    (candidate) => candidate.id === instanceId,
  )?.graphicId;
  const graphic = graphics.find((candidate) => candidate.id === graphicId);
  const fieldTitles = nameFieldsByTheirTitles(graphic, keysBehind).join(', ');

  // Read again at the press and at the answer: the state the marker drew with may be old.
  async function sendTheUpdate(wallClockFields: WallClockFieldsChoice): Promise<void> {
    const {
      instance,
      item,
      graphic: graphicNow,
    } = findInstanceWithItsItem(readServerStateNow(), instanceId);
    if (instance === undefined || item === undefined) {
      return;
    }
    const keysBehindNow = findWhereTheItemIsAheadOfTheAir(instance, item, graphicNow);
    if (keysBehindNow.length === 0) {
      return;
    }
    const update = buildUpdateThatCatchesUpWithTheItem({
      instanceId,
      item,
      graphic: graphicNow,
      keysBehind: keysBehindNow,
      wallClockFields,
    });
    setIsUpdateWaiting(true);
    try {
      await sendCommand(update);
    } finally {
      setIsUpdateWaiting(false);
    }
  }

  function pressUpdate(): void {
    const keysBehindNow = listKeysBehind(readServerStateNow(), instanceId);
    if (isAClockFieldBehind(keysBehindNow, graphic)) {
      setIsAskingAboutTheClock(true);
      return;
    }
    void sendTheUpdate('keepMoment');
  }

  function answerTheClockQuestion(wallClockFields: WallClockFieldsChoice): void {
    setIsAskingAboutTheClock(false);
    void sendTheUpdate(wallClockFields);
  }

  function pressTakeAgain(): void {
    const { item } = findInstanceWithItsItem(readServerStateNow(), instanceId);
    if (item === undefined) {
      return;
    }
    void sendCommand({ type: 'takeItem', itemId: item.id });
  }

  return (
    <span className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" tabIndex={0}>
            {ptBR.layers.itemAheadOfTheAirChip}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{ptBR.layers.itemAheadOfTheAirTooltip(fieldTitles)}</TooltipContent>
      </Tooltip>
      {output === 'program' ? (
        <ActionButton size="xs" variant="ghost" onClick={pressTakeAgain}>
          {ptBR.layers.takeItemAgainButton}
        </ActionButton>
      ) : null}
      <ActionButton size="xs" variant="ghost" disabled={isUpdateWaiting} onClick={pressUpdate}>
        {output === 'program'
          ? ptBR.layers.updateOnAirFromItemButton
          : ptBR.layers.updatePreviewFromItemButton}
      </ActionButton>
      {/* Mounted only while asking: one dialog per marker would be drawn on every row. */}
      {isAskingAboutTheClock ? (
        <WallClockChoiceDialog
          purpose="updateFromItem"
          isOpen
          onChosen={answerTheClockQuestion}
          onCancelled={() => setIsAskingAboutTheClock(false)}
        />
      ) : null}
    </span>
  );
});
