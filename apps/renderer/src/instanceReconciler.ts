/**
 * Decides what the renderer must do so the stage matches the `instances` slice. Pure
 * functions: they compare two lists of instances and answer with named operations, one
 * list per layer. Nothing here touches the page; instancePlayer.ts carries the
 * operations out.
 *
 * Only instances on the `program` output count. The `preview` output is drawn elsewhere
 * (a later task), so a preview instance is invisible to these functions.
 */
import type { Instance, Layer } from '@bajaovrlay/shared';

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

/**
 * Compares the instances drawn last with the ones that just arrived and answers what to
 * do on each layer that changed. Layers with nothing to do are left out of the answer.
 */
export function decideLayerOperations(change: {
  previousInstances: Instance[];
  nextInstances: Instance[];
  layers: Layer[];
}): LayerOperations[] {
  const previousByLayer = findProgramInstanceOfEachLayer(change.previousInstances);
  const nextByLayer = findProgramInstanceOfEachLayer(change.nextInstances);
  const layerIds = listLayerIdsInOrderOfAppearance(previousByLayer, nextByLayer);

  const layerOperations: LayerOperations[] = [];
  for (const layerId of layerIds) {
    const operation = decideOperationForOneLayer(
      previousByLayer.get(layerId),
      nextByLayer.get(layerId),
      findReplacePolicyOfLayer(layerId, change.layers),
    );
    if (operation !== undefined) {
      layerOperations.push({ layerId, operations: [operation] });
    }
  }
  return layerOperations;
}

/**
 * Answers how to rebuild the whole stage after a `hello` (a reconnect, or OBS reloading
 * the page): dispose everything drawn so far at once, then load every instance on air
 * with its in-animation skipped. Even an unchanged instance is rebuilt, because after a
 * drop the renderer cannot know what it missed.
 */
export function decideRebuildOperations(change: {
  previousInstances: Instance[];
  nextInstances: Instance[];
}): LayerOperations[] {
  const previousByLayer = findProgramInstanceOfEachLayer(change.previousInstances);
  const nextByLayer = findProgramInstanceOfEachLayer(change.nextInstances);
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
function decideOperationForOneLayer(
  previousInstance: Instance | undefined,
  nextInstance: Instance | undefined,
  replacePolicy: Layer['replacePolicy'],
): InstanceOperation | undefined {
  if (previousInstance === undefined) {
    if (nextInstance === undefined) {
      return undefined;
    }
    return { kind: 'loadAndPlay', instance: nextInstance, skipAnimation: false };
  }
  if (nextInstance === undefined) {
    return { kind: 'stopAndDispose', instanceId: previousInstance.id };
  }

  if (previousInstance.id !== nextInstance.id) {
    return {
      kind: 'replace',
      outgoingInstanceId: previousInstance.id,
      incomingInstance: nextInstance,
      replacePolicy,
    };
  }

  // The same instance. Only its data is compared. A change of `status` is the server
  // repeating what a renderer reported (this page, or another one whose failure turned
  // an on-air instance to failed), so there is nothing to do about it here; a change of
  // `currentStep` (stepping through a graphic) is a later task and is ignored for now.
  const changedData = findChangedFields(previousInstance.resolvedData, nextInstance.resolvedData);
  if (Object.keys(changedData).length === 0) {
    return undefined;
  }
  return { kind: 'updateData', instanceId: nextInstance.id, changedData };
}

/**
 * Maps each layer id to its instance on the `program` output. The server keeps at most
 * one per layer and output; if a slice ever listed two, the later one in the list wins.
 */
function findProgramInstanceOfEachLayer(instances: Instance[]): Map<string, Instance> {
  const programInstanceByLayer = new Map<string, Instance>();
  for (const instance of instances) {
    if (instance.target === 'program') {
      programInstanceByLayer.set(instance.layerId, instance);
    }
  }
  return programInstanceByLayer;
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
