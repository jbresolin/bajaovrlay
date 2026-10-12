import type { CommandError, InstanceTarget, Item, TakeGraphicCommand } from '@bajaovrlay/shared';

import { listKeysOfTakeTimeFields } from '../itemTakeTimeFields.js';
import { resolveItemFieldsIntoGraphicData } from '../resolveItemFields.js';
import { refuseUnknownItem } from '../rundownCommandRefusals.js';
import type { ReducerContext, SlicesChangedByCommands } from './reducerTypes.js';
import { reduceTakeGraphic } from './takeGraphic.js';

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
 * exactly what a take would put on air. It resolves the item's field values into data,
 * hands the take to reduceTakeGraphic (so every rule of a take holds for items without
 * being written twice: one instance per layer and output, the refusals, a field stored
 * as a literal `null` left out of the data) and stamps the new instance with the item's
 * id. It never touches the cursor; that is the caller's decision.
 * Refused if the item does not exist, if a field cannot be resolved, or for any reason
 * takeGraphic refuses; nothing changes then.
 */
export function putItemOnOutput(
  slices: SlicesChangedByCommands,
  itemId: string,
  target: InstanceTarget,
  context: ReducerContext,
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
  // reduceTakeGraphic). What could go wrong: an item edited after it was previewed goes
  // on air as it was previewed, until it is previewed again.
  const resolution = resolveItemFieldsIntoGraphicData(item.fields, context.now);
  if (resolution.status === 'refused') {
    return { status: 'refused', error: resolution.error };
  }
  const keysOfTakeTimeFields = listKeysOfTakeTimeFields(item.fields);

  const takeOfTheItemGraphic: TakeGraphicCommand = {
    type: 'takeGraphic',
    graphicId: item.graphicId,
    layerId: item.layerId,
    data: resolution.data,
    target,
    // The resolver above already wrote this command's moment into the `takeTime`
    // fields. Their keys are named here all the same, so that takeGraphic's check (only
    // a wall-clock field of the graphic may be stamped) holds for items without being
    // written twice. takeGraphic then writes the same moment over the same fields.
    takeTimeFieldKeys: keysOfTakeTimeFields,
  };
  const takeOutcome = reduceTakeGraphic(slices, takeOfTheItemGraphic, context);
  if (takeOutcome.status === 'refused') {
    return takeOutcome;
  }

  // The instance takeGraphic just made is the one carrying the id the store handed in.
  const instancesWithItemStamped = takeOutcome.slices.instances.map((instance) =>
    instance.id === context.newInstanceId ? { ...instance, itemId: item.id } : instance,
  );
  return {
    status: 'applied',
    slices: { ...takeOutcome.slices, instances: instancesWithItemStamped },
    item,
  };
}
