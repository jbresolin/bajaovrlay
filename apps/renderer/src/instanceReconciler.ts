/**
 * Decides what the renderer must do so the stage matches the server's slices. Pure
 * functions: they compare two deliveries and answer with named operations, one list per
 * layer. Nothing here touches the page; instancePlayer.ts carries the operations out.
 *
 * A page draws one output, named by `drawnOutput`. `program` is the page OBS loads and its
 * monitor: it draws the program instances and nothing else, and never reads the layers
 * marked "will be cleared" in preview. `preview` is the page the control page frames as
 * "Prévia": it draws the screen as it will look after the take, the composition of
 * previewComposition.ts (per layer the preview instance, else nothing on a marked layer,
 * else the program instance). The way a replace is carried out (see
 * `replacePolicyOnThePreviewOutput`) is the only other difference: everything after the
 * choice of instances (the diff, the rebuild) is one set of rules, not one per output.
 */
import type { Instance, Layer } from '@bajaovrlay/shared';

import { selectInstancesForPreviewComposition } from './previewComposition.js';

/** Put a new graphic on an empty layer: create it, load it, play it. */
export type LoadAndPlayOperation = {
  kind: 'loadAndPlay';
  instance: Instance;
  /** True when rebuilding the stage: the graphic appears at once, with no in-animation. */
  skipAnimation: boolean;
};

/** The same instance has new data: send the graphic only the fields that changed. */
export type UpdateDataOperation = {
  kind: 'updateData';
  instanceId: string;
  /** A field that disappeared from the data is listed here with the value `undefined`. */
  changedData: Record<string, unknown>;
};

/** Another instance was taken on an occupied layer: swap them as the layer's policy says. */
export type ReplaceOperation = {
  kind: 'replace';
  outgoingInstanceId: string;
  incomingInstance: Instance;
  replacePolicy: Layer['replacePolicy'];
};

/**
 * The same instance moved to another OGraf step ("Próximo", BAJAOVRLAY-47): play that step
 * on the graphic already on screen.
 */
export type GoToStepOperation = {
  kind: 'goToStep';
  instanceId: string;
  step: number;
};

/** The instance is gone from the slice: animate it out, then throw it away. */
export type StopAndDisposeOperation = {
  kind: 'stopAndDispose';
  instanceId: string;
};

/** Rebuilding the stage: throw the graphic away immediately, with no out-animation. */
export type DisposeAtOnceOperation = {
  kind: 'disposeAtOnce';
  instanceId: string;
};

/** Any one thing the renderer can be told to do on a layer. */
export type InstanceOperation =
  | LoadAndPlayOperation
  | UpdateDataOperation
  | GoToStepOperation
  | ReplaceOperation
  | StopAndDisposeOperation
  | DisposeAtOnceOperation;

/** What to do on one layer, in order. Different layers never wait for each other. */
export type LayerOperations = {
  layerId: string;
  operations: InstanceOperation[];
};

// The policy §6 of the concept names as the default, and the safest one: two graphics
// never overlap on a layer. Used when an instance sits on a layer the slice does not list.
const replacePolicyOfUnknownLayers: Layer['replacePolicy'] = 'out-then-in';

// On the preview output every replace is carried out as a `cut`, whatever the layer says:
// the new graphic is loaded behind the old one and swapped in with both animations
// skipped (instancePlayer.ts, cutToInstance). The preview is for looking at the next
// graphic, not for reviewing animations, and the operator stepping through the rundown
// must not wait for an out-animation on every row. The trade-off, taken on purpose: the
// preview does not show how a replace will look on air.
const replacePolicyOnThePreviewOutput: Layer['replacePolicy'] = 'cut';

/**
 * What the server listed in one delivery and in the one before, as a page compares them:
 * both `instances` slices and both `previewClearedLayerIds` slices (the layers marked
 * "will be cleared" in preview; a page that draws `program` ignores them).
 */
type TwoDeliveries = {
  previousInstances: Instance[];
  previousPreviewClearedLayerIds: string[];
  nextInstances: Instance[];
  nextPreviewClearedLayerIds: string[];
  drawnOutput: Instance['target'];
};

/**
 * Compares the instances drawn last with the ones that just arrived and answers what to
 * do on each layer that changed, looking only at what `drawnOutput` draws. Layers with
 * nothing to do are left out of the answer.
 */
export function decideLayerOperations(
  change: TwoDeliveries & { layers: Layer[] },
): LayerOperations[] {
  const previousByLayer = findInstanceDrawnOnEachLayer(
    change.previousInstances,
    change.previousPreviewClearedLayerIds,
    change.drawnOutput,
  );
  const nextByLayer = findInstanceDrawnOnEachLayer(
    change.nextInstances,
    change.nextPreviewClearedLayerIds,
    change.drawnOutput,
  );
  const layerIds = listLayerIdsInOrderOfAppearance(previousByLayer, nextByLayer);

  const layerOperations: LayerOperations[] = [];
  for (const layerId of layerIds) {
    const replacePolicy =
      change.drawnOutput === 'preview'
        ? replacePolicyOnThePreviewOutput
        : findReplacePolicyOfLayer(layerId, change.layers);
    const operations = decideOperationsForOneLayer(
      previousByLayer.get(layerId),
      nextByLayer.get(layerId),
      replacePolicy,
    );
    if (operations.length > 0) {
      layerOperations.push({ layerId, operations });
    }
  }
  return layerOperations;
}

/**
 * Answers how to rebuild the whole stage after a `hello` (a reconnect, or OBS reloading
 * the page): dispose everything drawn so far at once, then load every instance
 * `drawnOutput` draws with its in-animation skipped. Even an unchanged instance is
 * rebuilt, because after a drop the renderer cannot know what it missed.
 */
export function decideRebuildOperations(change: TwoDeliveries): LayerOperations[] {
  const previousByLayer = findInstanceDrawnOnEachLayer(
    change.previousInstances,
    change.previousPreviewClearedLayerIds,
    change.drawnOutput,
  );
  const nextByLayer = findInstanceDrawnOnEachLayer(
    change.nextInstances,
    change.nextPreviewClearedLayerIds,
    change.drawnOutput,
  );
  const layerIds = listLayerIdsInOrderOfAppearance(previousByLayer, nextByLayer);

  const layerOperations: LayerOperations[] = [];
  for (const layerId of layerIds) {
    const previousInstance = previousByLayer.get(layerId);
    const nextInstance = nextByLayer.get(layerId);
    const operations: InstanceOperation[] = [];
    if (previousInstance !== undefined) {
      operations.push({ kind: 'disposeAtOnce', instanceId: previousInstance.id });
    }
    if (nextInstance !== undefined) {
      operations.push({ kind: 'loadAndPlay', instance: nextInstance, skipAnimation: true });
    }
    layerOperations.push({ layerId, operations });
  }
  return layerOperations;
}

/** The four cases of one layer: nothing, new, gone, or same-or-replaced. */
function decideOperationsForOneLayer(
  previousInstance: Instance | undefined,
  nextInstance: Instance | undefined,
  replacePolicy: Layer['replacePolicy'],
): InstanceOperation[] {
  if (previousInstance === undefined) {
    if (nextInstance === undefined) {
      return [];
    }
    return [{ kind: 'loadAndPlay', instance: nextInstance, skipAnimation: false }];
  }
  if (nextInstance === undefined) {
    return [{ kind: 'stopAndDispose', instanceId: previousInstance.id }];
  }

  if (previousInstance.id !== nextInstance.id) {
    return [
      {
        kind: 'replace',
        outgoingInstanceId: previousInstance.id,
        incomingInstance: nextInstance,
        replacePolicy,
      },
    ];
  }

  // The same instance: its data and its step are compared. A change of `status` is the
  // server repeating what a renderer reported (this page, or another one whose failure
  // turned an on-air instance to failed), so there is nothing to do about it here. When
  // both changed in one delivery the data goes first, so the step plays with it.
  const operations: InstanceOperation[] = [];
  const changedData = findChangedFields(previousInstance.resolvedData, nextInstance.resolvedData);
  if (Object.keys(changedData).length > 0) {
    operations.push({ kind: 'updateData', instanceId: nextInstance.id, changedData });
  }
  if (nextInstance.currentStep !== previousInstance.currentStep) {
    operations.push({
      kind: 'goToStep',
      instanceId: nextInstance.id,
      step: nextInstance.currentStep,
    });
  }
  return operations;
}

/**
 * Maps each layer id to the instance this page draws there. On a page that draws
 * `program` that is the layer's program instance, and the markers are not looked at. On a
 * page that draws `preview` it is the preview composition, where a program instance counts
 * too. The server keeps at most one per layer and output; if a slice ever listed two, the
 * later one in the list wins.
 */
function findInstanceDrawnOnEachLayer(
  instances: Instance[],
  previewClearedLayerIds: string[],
  drawnOutput: Instance['target'],
): Map<string, Instance> {
  const instancesDrawn =
    drawnOutput === 'preview'
      ? selectInstancesForPreviewComposition({ instances, previewClearedLayerIds })
      : instances.filter((instance) => instance.target === 'program');
  const instanceByLayer = new Map<string, Instance>();
  for (const instance of instancesDrawn) {
    instanceByLayer.set(instance.layerId, instance);
  }
  return instanceByLayer;
}

/** Lists every layer id of either map once: the previous ones first, then the new ones. */
function listLayerIdsInOrderOfAppearance(
  previousByLayer: Map<string, Instance>,
  nextByLayer: Map<string, Instance>,
): string[] {
  const layerIds = new Set<string>();
  for (const layerId of previousByLayer.keys()) {
    layerIds.add(layerId);
  }
  for (const layerId of nextByLayer.keys()) {
    layerIds.add(layerId);
  }
  return [...layerIds];
}

function findReplacePolicyOfLayer(layerId: string, layers: Layer[]): Layer['replacePolicy'] {
  const layer = layers.find((candidate) => candidate.id === layerId);
  if (layer === undefined) {
    return replacePolicyOfUnknownLayers;
  }
  return layer.replacePolicy;
}

/**
 * Lists the fields whose value differs between two data objects, with their new value.
 * Values are compared by their JSON text, which is how they travelled from the server,
 * so two equal lists or objects count as unchanged. A field that is in the previous data
 * but not in the next is listed as `undefined`: the graphic is told the value is gone
 * rather than left showing the old one.
 */
function findChangedFields(
  previousData: Record<string, unknown>,
  nextData: Record<string, unknown>,
): Record<string, unknown> {
  const changedData: Record<string, unknown> = {};
  for (const [fieldName, nextValue] of Object.entries(nextData)) {
    const isUnchanged = JSON.stringify(previousData[fieldName]) === JSON.stringify(nextValue);
    if (!isUnchanged) {
      changedData[fieldName] = nextValue;
    }
  }
  for (const fieldName of Object.keys(previousData)) {
    const hasDisappeared = !(fieldName in nextData);
    if (hasDisappeared) {
      changedData[fieldName] = undefined;
    }
  }
  return changedData;
}
