import type { CommandError, InboxEventPayload, InstanceTarget, Item } from '@bajaovrlay/shared';

import { listKeysOfTakeTimeFields } from '../itemTakeTimeFields.js';
import { resolveItemFieldsIntoGraphicData } from '../resolveItemFields.js';
import { refuseUnknownItem } from '../rundownCommandRefusals.js';
import {
  addBindingsOfNewInstance,
  listBoundFieldsKeptByNewInstance,
} from './instanceBindingsBookkeeping.js';
import { type GraphicOnOutputRequest, putGraphicOnOutput } from './putGraphicOnOutput.js';
import type { ReducerContext, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * An event shown with an item (showEvent, BAJAOVRLAY-44): its id and payload, and how long
 * its rule keeps it on air.
 */
export type EventShownWithItem = {
  eventId: string;
  payload: InboxEventPayload;
  autoOutAfterMs: number;
};

/**
 * What putting an item on an output gives: the new slices and the item that was put
 * there (the caller may need it, to move the cursor), or the refusal.
 */
export type ItemOnOutputOutcome =
  | { status: 'applied'; slices: SlicesChangedByCommands; item: Item }
  | { status: 'refused'; error: CommandError };

/**
 * Puts a prepared item on one output of its layer: the program output for takeItem, the
 * preview output for previewItem. It is the one path both share, so a preview shows
 * exactly what a take would put on air. It resolves the item's field values into data
 * and hands the take, naming the item, to putGraphicOnOutput (so every rule of a take
 * holds without being written twice: one instance per layer and output, the refusals, a
 * field stored as a literal `null` left out of the data, the item's id on the instance).
 * The new instance's bound fields are written down in `instanceBindings` (on program the
 * live ones, on preview all of them). It never touches the cursor; that is the caller's
 * decision.
 * Refused if the item does not exist, if a field cannot be resolved, or for any reason
 * putGraphicOnOutput refuses; nothing changes then. With `eventShown`, the new instance
 * carries the event's id and its rule's duration (showEvent).
 */
export function putItemOnOutput(
  slices: SlicesChangedByCommands,
  itemId: string,
  target: InstanceTarget,
  context: ReducerContext,
  eventShown?: EventShownWithItem,
): ItemOnOutputOutcome {
  const item = slices.items.find((candidate) => candidate.id === itemId);
  if (item === undefined) {
    return { status: 'refused', error: refuseUnknownItem(itemId) };
  }

  // The one place an item's fields become data, for a take and for a preview alike.
  // takePreview does NOT come back here: what was seen in the preview is what goes on
  // air, so it sends the preview instance's own data. The one exception is the
  // `takeTime` fields, which takePreview stamps again with the moment of the take; it
  // can, because the keys named below are remembered on the preview instance (see
  // putGraphicOnOutput). What could go wrong: an item edited after it was previewed goes
  // on air as it was previewed, until it is previewed again.
  const resolution = resolveItemFieldsIntoGraphicData({
    fields: item.fields,
    graphic: slices.graphics.find((graphic) => graphic.id === item.graphicId),
    momentOfTheTake: context.now,
    sources: {
      dataSources: slices.dataSources,
      dataSnapshots: slices.dataSnapshots,
      overrides: slices.overrides,
    },
  });
  if (resolution.status === 'refused') {
    return { status: 'refused', error: resolution.error };
  }
  const keysOfTakeTimeFields = listKeysOfTakeTimeFields(item.fields);

  const takeOfTheItemGraphic: GraphicOnOutputRequest = {
    graphicId: item.graphicId,
    layerId: item.layerId,
    data: resolution.data,
    target,
    // The resolver above already wrote this command's moment into the `takeTime`
    // fields. Their keys are named here all the same, so that the take step's check
    // (only a wall-clock field of the graphic may be stamped) holds for items without
    // being written twice. The take step then writes the same moment over the same fields.
    takeTimeFieldKeys: keysOfTakeTimeFields,
    itemId: item.id,
  };
  if (eventShown !== undefined) {
    takeOfTheItemGraphic.eventId = eventShown.eventId;
    takeOfTheItemGraphic.autoOutAfterMs = eventShown.autoOutAfterMs;
  }
  const takeOutcome = putGraphicOnOutput(slices, takeOfTheItemGraphic, context);
  if (takeOutcome.status === 'refused') {
    return takeOutcome;
  }
  // The new instance's bindings are written down now, from the item as it is at this
  // take: the refreshes read them from here, never from the item, so an item edited or
  // deleted later does not change what is on air (instanceBindingsBookkeeping.ts). The
  // entry of the instance this take replaced is dropped by reduceCommand.
  const instanceBindingsAfter = addBindingsOfNewInstance(
    takeOutcome.slices.instanceBindings,
    context.newInstanceId,
    listBoundFieldsKeptByNewInstance(item.fields, target),
  );
  return {
    status: 'applied',
    slices: { ...takeOutcome.slices, instanceBindings: instanceBindingsAfter },
    item,
  };
}
