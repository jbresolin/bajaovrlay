import type { TakeGraphicCommand, TakeItemCommand } from '@bajaovrlay/shared';

import { resolveItemFieldsIntoGraphicData } from '../resolveItemFields.js';
import { refuseUnknownItem } from '../rundownCommandRefusals.js';
import { findItemThatFollows } from './itemOrdering.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';
import { putRundownCursorOnItem } from './rundownCursor.js';
import { reduceTakeGraphic } from './takeGraphic.js';

/**
 * takeItem: puts a prepared item on the program output. It resolves the item's field
 * values into data and hands the take to reduceTakeGraphic, the same reducer a take by
 * hand uses, so every rule of a take (one instance per layer and output, the refusals,
 * any check added to takeGraphic later) holds for items without being written twice.
 * Then it stamps the new instance with the item's id and moves the rundown's cursor to
 * the item after the one taken; after the last item the cursor is on nothing, rather
 * than back at the top where "next" would fire the opening again.
 * Refused if the item does not exist, if a field cannot be resolved, or for any reason
 * takeGraphic refuses (the item's layer or graphic is gone); nothing changes then.
 */
export function reduceTakeItem(
  slices: SlicesChangedByCommands,
  command: TakeItemCommand,
  context: ReducerContext,
): ReducerOutcome {
  const item = slices.items.find((candidate) => candidate.id === command.itemId);
  if (item === undefined) {
    return { status: 'refused', error: refuseUnknownItem(command.itemId) };
  }
  const resolution = resolveItemFieldsIntoGraphicData(item.fields);
  if (resolution.status === 'refused') {
    return { status: 'refused', error: resolution.error };
  }

  // An item always goes to the program output; previewing an item is a later task.
  const takeOfTheItemGraphic: TakeGraphicCommand = {
    type: 'takeGraphic',
    graphicId: item.graphicId,
    layerId: item.layerId,
    data: resolution.data,
    target: 'program',
  };
  const takeOutcome = reduceTakeGraphic(slices, takeOfTheItemGraphic, context);
  if (takeOutcome.status === 'refused') {
    return takeOutcome;
  }

  // The instance takeGraphic just made is the one carrying the id the store handed in.
  const instancesWithItemStamped = takeOutcome.slices.instances.map((instance) =>
    instance.id === context.newInstanceId ? { ...instance, itemId: item.id } : instance,
  );
  const nextItem = findItemThatFollows(slices.items, item);
  const rundownsAfter = putRundownCursorOnItem(
    slices.rundowns,
    item.rundownId,
    nextItem?.id ?? null,
  );

  return {
    status: 'applied',
    slices: { ...takeOutcome.slices, instances: instancesWithItemStamped, rundowns: rundownsAfter },
  };
}
