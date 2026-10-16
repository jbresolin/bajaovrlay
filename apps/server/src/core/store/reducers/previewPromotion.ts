import type { Instance, TakeGraphicCommand } from '@bajaovrlay/shared';

import { removePreviewClearedMarkerOfLayer } from './previewClearedMarkers.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { moveRundownCursorOnIfItWasOnTakenItem } from './rundownCursor.js';
import { reduceTakeGraphic } from './takeGraphic.js';

/**
 * Sends one preview instance to the program output: the one path takePreview and
 * takeAllPreviews share, so "Tomar" and "Tomar tudo" take a preview the same way.
 * A new program instance is made (the context's new id, its moment as `takenAt`, status
 * `loading`) with the preview instance's graphic, item id and data, replacing what was
 * on program on that layer; the preview instance is removed.
 *
 * The data is the preview instance's own: the item is NOT resolved again, so what was
 * seen is what goes on air, even if the item was edited or deleted meanwhile. The one
 * exception is the fields the preview had stamped with its own moment (the keys the
 * preview instance remembers in `takeTimeFieldKeys`): they get the moment of THIS
 * command, so a previewed clock starts counting at the take.
 *
 * The take itself is handed to reduceTakeGraphic, so it is checked like
 * every take: the stamp only goes into a field the graphic's schema marks as a
 * wall-clock moment, and the data must still fit the schema registered now. Checking
 * again cannot put anything on air that was not seen (it can only refuse).
 *
 * The cursor follows takeItem's rule, with takeItem's code: it moves on only if the
 * previewed item is the cursor item in the slices handed in. A preview made by hand, or
 * one whose item was deleted since, leaves the cursor alone.
 *
 * The "will be cleared" markers are not touched here; each caller decides.
 */
export function takePreviewInstanceToProgram(
  slices: SlicesChangedByCommands,
  previewInstance: Instance,
  context: ReducerContext,
): ReducerOutcome {
  const takeOfWhatWasPreviewed: TakeGraphicCommand = {
    type: 'takeGraphic',
    graphicId: previewInstance.graphicId,
    layerId: previewInstance.layerId,
    data: previewInstance.resolvedData,
    target: 'program',
    // The one thing that is not carried over as it was seen: takeGraphic writes this
    // command's moment over these fields. A preview that stamped nothing has no list.
    takeTimeFieldKeys: previewInstance.takeTimeFieldKeys ?? [],
  };
  const takeOutcome = reduceTakeGraphic(slices, takeOfWhatWasPreviewed, context);
  if (takeOutcome.status === 'refused') {
    return takeOutcome;
  }

  const instancesWithoutThePreview = takeOutcome.slices.instances.filter(
    (instance) => instance.id !== previewInstance.id,
  );
  // The instance takeGraphic just made is the one carrying the id the context handed in.
  // It gets the preview's item id, when the preview came from an item.
  const previewedItemId = previewInstance.itemId;
  const instancesAfter =
    previewedItemId === undefined
      ? instancesWithoutThePreview
      : instancesWithoutThePreview.map((instance) =>
          instance.id === context.newInstanceId
            ? { ...instance, itemId: previewedItemId }
            : instance,
        );

  // Undefined for a preview made by hand, and for one whose item was deleted since.
  const previewedItem = slices.items.find((candidate) => candidate.id === previewedItemId);
  const rundownsAfter =
    previewedItem === undefined
      ? slices.rundowns
      : moveRundownCursorOnIfItWasOnTakenItem(slices.rundowns, slices.items, previewedItem);

  return {
    status: 'applied',
    slices: { ...takeOutcome.slices, instances: instancesAfter, rundowns: rundownsAfter },
  };
}

/**
 * Carries out the "will be cleared" marker of one layer: removes every instance of that
 * layer's PROGRAM output (as clearLayer does on program) and takes the marker off.
 * Deliberate: program only, because the marker says "the program of this layer will be
 * empty"; a marked layer has no preview to remove. The same arrays come back for what
 * did not change (nothing on program there, or no marker), so nothing is saved for them.
 */
export function clearProgramOfMarkedLayer(
  slices: SlicesChangedByCommands,
  layerId: string,
): SlicesChangedByCommands {
  const instancesKept = slices.instances.filter((instance) => {
    const isOnThisLayersProgram = instance.layerId === layerId && instance.target === 'program';
    return !isOnThisLayersProgram;
  });
  const hasRemovedAnInstance = instancesKept.length !== slices.instances.length;
  return {
    ...slices,
    instances: hasRemovedAnInstance ? instancesKept : slices.instances,
    previewClearedLayerIds: removePreviewClearedMarkerOfLayer(
      slices.previewClearedLayerIds,
      layerId,
    ),
  };
}
