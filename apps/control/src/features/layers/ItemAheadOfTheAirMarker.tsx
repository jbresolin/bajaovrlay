import {
  findWhereTheItemIsAheadOfTheAir,
  type Graphic,
  type Instance,
  type Item,
} from '@bajaovrlay/shared';
import { memo, useEffect, useState, useSyncExternalStore } from 'react';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';
import {
  useReadServerStateNow,
  useSendCommand,
  useSendCommandAndReadItsRefusal,
  useServerState,
  useSubscribeToServerState,
} from '@/state/ControlPageStateProvider';
import type { ServerState } from '@/state/serverStateStore';

import { nameFieldsByTheirTitles } from './fieldsOfInstanceOnAir';
import { buildUpdateThatCatchesUpWithTheItem } from './updateThatCatchesUpWithTheItem';

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
 * A clock is never among the fields behind (itemAheadOfTheAir.ts says why), so nothing
 * here asks about it. A refused update is said beside the buttons: only this marker's own, so a refusal of
 * "Edição rápida" or the item editor never shows here. Draws nothing while the air
 * matches the item.
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
  const sendCommandAndReadItsRefusal = useSendCommandAndReadItsRefusal();
  // The graphics slice changes when a package is added or removed, never at a poll.
  const graphics = useServerState((state) => state.graphics);
  const [isUpdateWaiting, setIsUpdateWaiting] = useState(false);
  const [refusalOfTheUpdate, setRefusalOfTheUpdate] = useState<string | null>(null);

  // React calls the reader after every change of the store and redraws only when the text
  // differs from the last one (the same way as "Valor agora", BindingValueNowLine.tsx).
  const keysBehindText = useSyncExternalStore(subscribeToServerState, () =>
    listKeysBehind(readServerStateNow(), instanceId).join(separatorOfKeys),
  );
  const isQuiet = keysBehindText === '';

  // A refusal belongs to the update that was refused: once the air matches the item, it
  // is forgotten, so it never comes back by itself when the item moves ahead again. It
  // runs again when a refusal arrives after the row went quiet.
  useEffect(() => {
    if (isQuiet && refusalOfTheUpdate !== null) {
      setRefusalOfTheUpdate(null);
    }
  }, [isQuiet, refusalOfTheUpdate]);

  if (isQuiet) {
    return null;
  }
  const keysBehind = keysBehindText.split(separatorOfKeys);
  const graphicId = readServerStateNow().instances.find(
    (candidate) => candidate.id === instanceId,
  )?.graphicId;
  const graphic = graphics.find((candidate) => candidate.id === graphicId);
  const fieldTitles = nameFieldsByTheirTitles(graphic, keysBehind).join(', ');

  // Read again at the press: the state the marker drew with may be old.
  async function pressUpdate(): Promise<void> {
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
      keysBehind: keysBehindNow,
    });
    setIsUpdateWaiting(true);
    setRefusalOfTheUpdate(null);
    try {
      setRefusalOfTheUpdate(await sendCommandAndReadItsRefusal(update));
    } finally {
      setIsUpdateWaiting(false);
    }
  }

  function pressTakeAgain(): void {
    const { item } = findInstanceWithItsItem(readServerStateNow(), instanceId);
    if (item === undefined) {
      return;
    }
    void sendCommand({ type: 'takeItem', itemId: item.id });
  }

  // Wraps inside its own part of the row: that part may shrink to 12rem (LayerStatusRow),
  // and a marker that kept the chip and its two buttons on one line would spill over the
  // row's "Editar" and take its clicks (seen once the page drew in Inter, BAJAOVRLAY-71).
  return (
    <span className="flex flex-wrap items-center gap-1">
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
      <ActionButton
        size="xs"
        variant="ghost"
        disabled={isUpdateWaiting}
        onClick={() => void pressUpdate()}
      >
        {output === 'program'
          ? ptBR.layers.updateOnAirFromItemButton
          : ptBR.layers.updatePreviewFromItemButton}
      </ActionButton>
      {refusalOfTheUpdate === null ? null : (
        <span role="alert" className="text-xs text-destructive">
          {refusalOfTheUpdate}
        </span>
      )}
    </span>
  );
});
