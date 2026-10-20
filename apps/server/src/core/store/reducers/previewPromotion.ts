import type { Instance, InstanceBoundField, ItemFields } from '@bajaovrlay/shared';

import { refusePreviewWithoutItem } from '../onAirChangeRefusals.js';
import { resolveItemFieldsIntoGraphicData } from '../resolveItemFields.js';
import { addBindingsOfNewInstance } from './instanceBindingsBookkeeping.js';
import { removePreviewClearedMarkerOfLayer } from './previewMarkersAndDiscards.js';
import { type GraphicOnOutputRequest, putGraphicOnOutput } from './putGraphicOnOutput.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * Sends one preview instance to the program output: the one path takePreview and
 * takeAllPreviews share, so "Tomar" and "Tomar tudo" take a preview the same way.
 * A new program instance is made (the context's new id, its moment as `takenAt`, status
 * `loading`) with the preview instance's graphic, item id and data, replacing what was
 * on program on that layer; the preview instance is removed. The list of fields changed
 * on air ("Atualizar prévia") comes along too: the data on program differs from the item
 * exactly as the preview's did, so the chip "alterado no ar" must say so at once.
 *
 * The data is the preview instance's own: the item is NOT resolved again, so what was
 * seen is what goes on air, even if the item was edited or deleted meanwhile. Two
 * exceptions, both "frozen at the take, not at the preview": the fields the preview had
 * stamped with its own moment (the keys the preview instance remembers in
 * `takeTimeFieldKeys`) get the moment of THIS command, so a previewed clock starts
 * counting at the take; and its frozen bound fields (`isLive: false`, kept in the
 * preview's `instanceBindings` entry) are read again from the sources now, which refuses
 * the take like any take when one cannot be read. Its live bound fields go on as they
 * were seen (the refreshes keep them current), and their bindings move to the new
 * program instance; the preview's entry leaves with the preview.
 *
 * The take itself is handed to putGraphicOnOutput, so it is checked like every take: the
 * stamp only goes into a field the graphic's schema marks as a wall-clock moment, and the
 * data must still fit the schema registered now. Checking
 * again cannot put anything on air that was not seen (it can only refuse).
 *
 * A preview with no item is refused (INSTANCE_WITHOUT_ITEM): everything on air comes from
 * an item. No command makes such a preview since BAJAOVRLAY-37, and previews are dropped
 * at every boot, so this is a guard and not a case the operator meets.
 *
 * Neither the rundown cursors nor the "will be cleared" markers are touched here; each
 * caller settles them once it has taken everything it takes (takePreview one instance,
 * takeAllPreviews several), with moveRundownCursorsPastItemsTakenTogether.
 */
export function takePreviewInstanceToProgram(
  slices: SlicesChangedByCommands,
  previewInstance: Instance,
  context: ReducerContext,
): ReducerOutcome {
  const previewedItemId = previewInstance.itemId;
  if (previewedItemId === undefined) {
    const layerName =
      slices.layers.find((layer) => layer.id === previewInstance.layerId)?.name ??
      previewInstance.layerId;
    return { status: 'refused', error: refusePreviewWithoutItem(layerName) };
  }
  const boundFieldsOfThePreview =
    slices.instanceBindings.find((entry) => entry.instanceId === previewInstance.id)?.boundFields ??
    [];
  const frozenFieldsReadAgain = readFrozenBoundFieldsAgain(
    slices,
    previewInstance,
    boundFieldsOfThePreview,
    context.now,
  );
  if (frozenFieldsReadAgain.status === 'refused') {
    return frozenFieldsReadAgain;
  }
  const takeOfWhatWasPreviewed: GraphicOnOutputRequest = {
    graphicId: previewInstance.graphicId,
    layerId: previewInstance.layerId,
    data: { ...previewInstance.resolvedData, ...frozenFieldsReadAgain.data },
    target: 'program',
    // The one thing that is not carried over as it was seen: the take step writes this
    // command's moment over these fields. A preview that stamped nothing has no list.
    takeTimeFieldKeys: previewInstance.takeTimeFieldKeys ?? [],
    itemId: previewedItemId,
  };
  const takeOutcome = putGraphicOnOutput(slices, takeOfWhatWasPreviewed, context);
  if (takeOutcome.status === 'refused') {
    return takeOutcome;
  }

  // The instance the take step just made is the one carrying the id the context handed
  // in. It gets the preview's list of fields changed on air, when there is one.
  const fieldsChangedInPreview = previewInstance.fieldsChangedOnAir;
  const instancesAfter = takeOutcome.slices.instances
    .filter((instance) => instance.id !== previewInstance.id)
    .map((instance) =>
      instance.id === context.newInstanceId && fieldsChangedInPreview !== undefined
        ? { ...instance, fieldsChangedOnAir: fieldsChangedInPreview }
        : instance,
    );

  // The live bindings follow the instance to program; the preview's entry is dropped
  // with the preview by reduceCommand.
  const liveBoundFields = boundFieldsOfThePreview.filter((boundField) => boundField.binding.isLive);
  const instanceBindingsAfter = addBindingsOfNewInstance(
    takeOutcome.slices.instanceBindings,
    context.newInstanceId,
    liveBoundFields,
  );
  return {
    status: 'applied',
    slices: {
      ...takeOutcome.slices,
      instances: instancesAfter,
      instanceBindings: instanceBindingsAfter,
    },
  };
}

/**
 * Reads the preview's frozen bound fields again from the sources as they are now, through
 * the resolver of every take, or refuses as a take would. No frozen field gives no data.
 */
function readFrozenBoundFieldsAgain(
  slices: SlicesChangedByCommands,
  previewInstance: Instance,
  boundFieldsOfThePreview: InstanceBoundField[],
  momentOfTheTake: string,
) {
  const frozenFields: ItemFields = {};
  for (const boundField of boundFieldsOfThePreview) {
    if (!boundField.binding.isLive) {
      frozenFields[boundField.fieldKey] = boundField.binding;
    }
  }
  return resolveItemFieldsIntoGraphicData({
    fields: frozenFields,
    graphic: slices.graphics.find((graphic) => graphic.id === previewInstance.graphicId),
    momentOfTheTake,
    // The overrides join with their slice (step 7 of BAJAOVRLAY-20).
    sources: {
      dataSources: slices.dataSources,
      dataSnapshots: slices.dataSnapshots,
      overrides: [],
    },
  });
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
