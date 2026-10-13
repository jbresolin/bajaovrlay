import type { TakeGraphicCommand, TakePreviewCommand } from '@bajaovrlay/shared';

import { refuseTakeOfEmptyPreview, refuseUnknownLayer } from '../commandRefusals.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { moveRundownCursorOnIfItWasOnTakenItem } from './rundownCursor.js';
import { reduceTakeGraphic } from './takeGraphic.js';

/**
 * takePreview: sends what is on the preview output of one layer to the program output.
 * A new program instance is made (new id, this command's moment as `takenAt`, status
 * `loading`) with the preview instance's graphic, item id and data, replacing what was
 * on program on that layer; the preview instance is removed.
 *
 * The data is the preview instance's own: the item is NOT resolved again, so what was
 * seen is what goes on air, even if the item was edited or deleted meanwhile. The one
 * exception is the fields the preview had stamped with its own moment (the keys the
 * preview instance remembers in `takeTimeFieldKeys`): they get the moment of THIS
 * command, so a previewed clock starts counting at the take.
 *
 * The take itself is handed to reduceTakeGraphic, so it is checked like every take: the
 * stamp only goes into a field the graphic's schema marks as a wall-clock moment, and
 * the data must still fit the schema registered now. Deliberate: checking again cannot
 * put anything on air that was not seen (it can only refuse), and the graphics slice
 * does not change while the server runs, so a preview that was accepted is accepted here.
 *
 * The cursor follows takeItem's rule, with takeItem's code: it moves on only if the
 * previewed item is the cursor item now. A preview made by hand, or one whose item was
 * deleted since, leaves the cursor alone (the instance still carries the item's id).
 *
 * Refused if the layer does not exist, if nothing is previewed on it, or for any reason
 * takeGraphic refuses; nothing changes then, and the preview stays.
 */
export function reduceTakePreview(
  slices: SlicesChangedByCommands,
  command: TakePreviewCommand,
  context: ReducerContext,
): ReducerOutcome {
  const layer = slices.layers.find((candidate) => candidate.id === command.layerId);
  if (layer === undefined) {
    return { status: 'refused', error: refuseUnknownLayer(command.layerId) };
  }
  const previewInstance = slices.instances.find(
    (instance) => instance.layerId === command.layerId && instance.target === 'preview',
  );
  if (previewInstance === undefined) {
    return { status: 'refused', error: refuseTakeOfEmptyPreview(layer.name) };
  }

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
  // The instance takeGraphic just made is the one carrying the id the store handed in.
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
