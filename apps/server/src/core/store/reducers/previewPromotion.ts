import {
  findClockFieldKeysByRole,
  type Instance,
  type InstanceBoundField,
  isItemFilledByAnEvent,
  type ItemFields,
  listFieldKeysItemReadsFromASource,
} from '@bajaovrlay/shared';

import { findRefusalOfTakingAPreviewOfAnEvent } from '../../../modules/events/index.js';
import { ptBR } from '../../messages/ptBR.js';
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
 * the take like any take when one cannot be read. Every frozen key is first taken out of
 * the preview's data, so an optional value the source no longer sends goes off air as at
 * any take, rather than staying at its previewed value (gate 2 of PR #18). Its live bound fields go on as they
 * were seen (the refreshes keep them current), and their bindings move to the new
 * program instance; the preview's entry leaves with the preview.
 *
 * The take itself is handed to putGraphicOnOutput, so it is checked like every take: the
 * stamp only goes into a field the graphic's schema marks as a wall-clock moment, and the
 * data must still fit the schema registered now. Checking
 * again cannot put anything on air that was not seen (it can only refuse).
 *
 * A preview of an item filled by events, filled from a sample event (it carries no event
 * id), is refused (ITEM_FILLED_BY_EVENT): a sample is never shown. A preview of an event
 * carries the event's id and its rule's duration to program, so the event goes on air
 * (BAJAOVRLAY-44). What could go wrong: a sample preview whose item was deleted since
 * cannot be told from any other preview, and goes on air.
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
  // A preview of an event goes on air only while its event still waits (gate 2 of PR #22).
  const refusalOfTheEvent = findRefusalOfTakingAPreviewOfAnEvent(
    slices,
    previewInstance,
    context.now,
  );
  if (refusalOfTheEvent !== undefined) {
    return { status: 'refused', error: refusalOfTheEvent };
  }
  const previewedItem = slices.items.find((item) => item.id === previewedItemId);
  const isSampleOfAnEvent =
    previewInstance.eventId === undefined &&
    previewedItem !== undefined &&
    isItemFilledByAnEvent(previewedItem.fields);
  if (isSampleOfAnEvent) {
    return {
      status: 'refused',
      error: { code: 'ITEM_FILLED_BY_EVENT', message: ptBR.eventErrors.itemFilledByAnEvent },
    };
  }
  const entryOfThePreview = slices.instanceBindings.find(
    (entry) => entry.instanceId === previewInstance.id,
  );
  const boundFieldsOfThePreview = entryOfThePreview?.boundFields ?? [];
  const frozenFieldsReadAgain = readFrozenBoundFieldsAgain(
    slices,
    previewInstance,
    boundFieldsOfThePreview,
    context.now,
  );
  if (frozenFieldsReadAgain.status === 'refused') {
    return frozenFieldsReadAgain;
  }
  const previewDataWithoutFrozenKeys = Object.fromEntries(
    Object.entries(previewInstance.resolvedData).filter(
      ([fieldKey]) => !frozenFieldsReadAgain.frozenFieldKeys.includes(fieldKey),
    ),
  );
  const takeOfWhatWasPreviewed: GraphicOnOutputRequest = {
    graphicId: previewInstance.graphicId,
    layerId: previewInstance.layerId,
    data: { ...previewDataWithoutFrozenKeys, ...frozenFieldsReadAgain.data },
    target: 'program',
    // The one thing that is not carried over as it was seen: the take step writes this
    // command's moment over these fields. A preview that stamped nothing has no list.
    takeTimeFieldKeys: previewInstance.takeTimeFieldKeys ?? [],
    itemId: previewedItemId,
  };
  if (previewInstance.eventId !== undefined) {
    takeOfWhatWasPreviewed.eventId = previewInstance.eventId;
  }
  if (previewInstance.autoOutAfterMs !== undefined) {
    takeOfWhatWasPreviewed.autoOutAfterMs = previewInstance.autoOutAfterMs;
  }
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

  // The live bindings and the entity references (always live) follow the instance to
  // program; the preview's entry is dropped with the preview by reduceCommand.
  const liveBoundFields = boundFieldsOfThePreview.filter((boundField) => boundField.binding.isLive);
  const instanceBindingsAfter = addBindingsOfNewInstance(
    takeOutcome.slices.instanceBindings,
    context.newInstanceId,
    liveBoundFields,
    entryOfThePreview?.entityFields ?? [],
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
 * Also answers the graphic keys those fields fill (four for a frozen whole clock), which
 * the caller takes out of the preview's data before laying the values read over it.
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
  const graphic = slices.graphics.find((candidate) => candidate.id === previewInstance.graphicId);
  const resolution = resolveItemFieldsIntoGraphicData({
    fields: frozenFields,
    graphic,
    momentOfTheTake,
    sources: {
      dataSources: slices.dataSources,
      dataSnapshots: slices.dataSnapshots,
      overrides: slices.overrides,
    },
    // Only frozen bindings are read again here; entity fields are live and go on as seen.
    entities: slices,
  });
  if (resolution.status === 'refused') {
    return resolution;
  }
  const frozenFieldKeys = listFieldKeysItemReadsFromASource(
    frozenFields,
    graphic === undefined ? undefined : findClockFieldKeysByRole(graphic),
  );
  return { ...resolution, frozenFieldKeys };
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
