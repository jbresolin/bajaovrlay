import type {
  LayerNotTaken,
  TakeAllPreviewsCommand,
  TakeRefusedForAnotherConsole,
} from '@bajaovrlay/shared';

import { refuseUnknownLayer } from '../commandRefusals.js';
import {
  findUnseenChangeByAnotherConsole,
  refuseTakeOverAnUnseenChange,
} from '../consoles/unseenChangeByAnotherConsole.js';
import {
  refuseTakeAllAtLayer,
  refuseTakeAllOnEveryLayerChangedByAnotherConsole,
  refuseTakeAllWithNothingInPreview,
} from '../previewRefusals.js';
import { buildContextForInstanceOnLayer } from './instanceIdForEachLayer.js';
import { removeEveryPreviewClearedMarker } from './previewMarkersAndDiscards.js';
import { clearProgramOfMarkedLayer, takePreviewInstanceToProgram } from './previewPromotion.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { moveRundownCursorsPastItemsTakenTogether } from './rundownCursor.js';
import { nameItemOfThePreview } from './takePreview.js';

/**
 * takeAllPreviews ("Tomar tudo"): makes program what Prévia shows, in one reducer call,
 * so the store saves, logs and broadcasts it as ONE change and OBS never shows a
 * half-taken set. For each layer, lowest z-index first:
 * - a preview instance there is taken exactly as takePreview takes it (the data as seen,
 *   its stamped fields stamped again with this command's moment through the wall-clock
 *   check, the item's id kept);
 * - otherwise a "will be cleared" marker there clears that layer's program output.
 * Then no preview and no marker is left, and the rundown cursors are settled once: a
 * cursor on an item taken here moves on past every item taken here
 * (moveRundownCursorsPastItemsTakenTogether), so it is never left on an item just put on
 * air, and the same set gives the same cursor whatever the layers' z-order.
 *
 * Deliberate: the layers go in z-order, lowest first (layers with the same z-index in
 * the order the layers slice lists them), so the result does not depend on the order the
 * instances happen to sit in.
 * What could go wrong: after macro "Prévia", this ends with the cursor where "Executar"
 * (runMacro) leaves it only when the macro takes its items in rundown order, each on its
 * own layer. Executar judges the cursor at each step, so a macro that takes a later item
 * before the cursor item, or two items on one layer, can leave it elsewhere there.
 * Each new program instance gets the store's new instance id followed by its layer id
 * (instanceIdForEachLayer.ts).
 *
 * Refused, with nothing changed, when there is no preview and no marker
 * (NOTHING_IN_PREVIEW), or when any one layer cannot be taken: a preview or marker on a
 * layer the server does not list, or a take that putGraphicOnOutput refuses (the graphic gone,
 * the data or a stamp no longer fitting its schema). Deliberate: one refused layer
 * refuses the whole set, with a message naming that layer and carrying its reason,
 * because a half-taken set on air is worse than none.
 * The one exception (BAJAOVRLAY-69, the brief's rule 4): a layer another console changed
 * less than 2 s ago, unseen by this console (../consoles/), is checked on its own. It is
 * left as it is, its preview and marker kept so the operator can look and take it again,
 * and the other layers are taken; the outcome lists it in `layersNotTaken`. Only when every
 * layer is left that way is the command refused (LAYER_CHANGED_BY_ANOTHER_CONSOLE).
 */
export function reduceTakeAllPreviews(
  slices: SlicesChangedByCommands,
  command: TakeAllPreviewsCommand,
  context: ReducerContext,
): ReducerOutcome {
  const previewInstances = slices.instances.filter((instance) => instance.target === 'preview');
  const isPreviewEmpty =
    previewInstances.length === 0 && slices.previewClearedLayerIds.length === 0;
  if (isPreviewEmpty) {
    return { status: 'refused', error: refuseTakeAllWithNothingInPreview() };
  }

  // A preview or marker on a layer that is not listed would be skipped by the loop below,
  // which goes through the listed layers: refuse it first, naming it by its id.
  const layerIdsShownInPreview = [
    ...previewInstances.map((instance) => instance.layerId),
    ...slices.previewClearedLayerIds,
  ];
  const unlistedLayerId = layerIdsShownInPreview.find(
    (layerId) => !slices.layers.some((layer) => layer.id === layerId),
  );
  if (unlistedLayerId !== undefined) {
    return {
      status: 'refused',
      error: refuseTakeAllAtLayer(unlistedLayerId, refuseUnknownLayer(unlistedLayerId)),
    };
  }

  const layersLowestFirst = [...slices.layers].sort(
    (lowerLayer, higherLayer) => lowerLayer.zIndex - higherLayer.zIndex,
  );
  let slicesSoFar = slices;
  const takenItemIds: string[] = [];
  let numberOfLayersTakenOrCleared = 0;
  const layersNotTaken: LayerNotTaken[] = [];
  const takesRefusedForAnotherConsole: TakeRefusedForAnotherConsole[] = [];
  for (const layer of layersLowestFirst) {
    const previewInstanceOnLayer = slicesSoFar.instances.find(
      (instance) => instance.layerId === layer.id && instance.target === 'preview',
    );
    const isLayerMarkedToBeCleared = slicesSoFar.previewClearedLayerIds.includes(layer.id);
    const isSomethingShownInPreview =
      previewInstanceOnLayer !== undefined || isLayerMarkedToBeCleared;
    if (!isSomethingShownInPreview) {
      continue;
    }

    // Each layer's program is compared as the command found it: taking one layer never
    // changes another layer's program, so this is also what is on air at this step.
    const unseenChange = findUnseenChangeByAnotherConsole({
      layerId: layer.id,
      instanceIdSeenOnAir: command.instanceIdsSeenOnAir?.[layer.id],
      instances: slices.instances,
      context,
    });
    if (unseenChange !== undefined) {
      const refusal = refuseTakeOverAnUnseenChange({
        unseenChange,
        layerId: layer.id,
        slices,
        context,
        whatWasNotDone:
          previewInstanceOnLayer === undefined
            ? { kind: 'clear' }
            : { kind: 'take', itemLabel: nameItemOfThePreview(previewInstanceOnLayer, slices) },
      });
      layersNotTaken.push({ layerId: layer.id, error: refusal.error });
      takesRefusedForAnotherConsole.push(refusal.takeRefused);
      continue;
    }

    if (previewInstanceOnLayer !== undefined) {
      const promotion = takePreviewInstanceToProgram(
        slicesSoFar,
        previewInstanceOnLayer,
        buildContextForInstanceOnLayer(context, layer.id),
      );
      if (promotion.status === 'refused') {
        return { status: 'refused', error: refuseTakeAllAtLayer(layer.name, promotion.error) };
      }
      slicesSoFar = promotion.slices;
      if (previewInstanceOnLayer.itemId !== undefined) {
        takenItemIds.push(previewInstanceOnLayer.itemId);
      }
    } else {
      slicesSoFar = clearProgramOfMarkedLayer(slicesSoFar, layer.id);
    }
    numberOfLayersTakenOrCleared += 1;
  }

  if (numberOfLayersTakenOrCleared === 0) {
    return {
      status: 'refused',
      error: refuseTakeAllOnEveryLayerChangedByAnotherConsole(
        layersNotTaken.map((layerNotTaken) => layerNotTaken.error),
      ),
      takesRefusedForAnotherConsole,
    };
  }

  // Every marker was carried out above, but those of the layers left for another console;
  // this also drops one that sat beside a preview on the same layer, which no command
  // makes, so that "nothing is left" holds regardless.
  const layerIdsNotTaken = layersNotTaken.map((layerNotTaken) => layerNotTaken.layerId);
  const markersAfter =
    layerIdsNotTaken.length === 0
      ? removeEveryPreviewClearedMarker(slicesSoFar.previewClearedLayerIds)
      : slicesSoFar.previewClearedLayerIds.filter((layerId) => layerIdsNotTaken.includes(layerId));
  const rundownsAfter = moveRundownCursorsPastItemsTakenTogether(
    slicesSoFar.rundowns,
    slicesSoFar.items,
    takenItemIds,
  );
  const slicesAfter = {
    ...slicesSoFar,
    previewClearedLayerIds: markersAfter,
    rundowns: rundownsAfter,
  };
  if (layersNotTaken.length === 0) {
    return { status: 'applied', slices: slicesAfter };
  }
  return {
    status: 'applied',
    slices: slicesAfter,
    layersNotTaken,
    takesRefusedForAnotherConsole,
  };
}
