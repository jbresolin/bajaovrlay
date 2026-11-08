/**
 * "Atualizar no ar" of a Camadas row behind its item (BAJAOVRLAY-38): the updateInstanceData
 * that sends the item's values of the fields behind to that instance. A pure function, no
 * drawing.
 */
import type { Item, UpdateInstanceDataCommand } from '@bajaovrlay/shared';

/** What buildUpdateThatCatchesUpWithTheItem needs, all read at the press. */
export type CatchUpWithTheItemParts = {
  instanceId: string;
  item: Item;
  /**
   * The fields behind (findWhereTheItemIsAheadOfTheAir): typed values of the item, or keys
   * it no longer stores. Never a clock, so nothing here is stamped by the server.
   */
  keysBehind: string[];
};

/**
 * The update that sends each field behind with the item's value. A key the item no longer
 * stores goes as null, as does an empty value, which takes it off air.
 */
export function buildUpdateThatCatchesUpWithTheItem(
  parts: CatchUpWithTheItemParts,
): UpdateInstanceDataCommand {
  const data: Record<string, unknown> = {};
  for (const fieldKey of parts.keysBehind) {
    const fieldOfTheItem = parts.item.fields[fieldKey];
    if (fieldOfTheItem === undefined) {
      data[fieldKey] = null;
      continue;
    }
    // Only typed values are ever behind; anything else here would be a value the item
    // does not hold, so it is not sent.
    if (fieldOfTheItem.kind !== 'literal') {
      continue;
    }
    data[fieldKey] = fieldOfTheItem.value;
  }

  return {
    type: 'updateInstanceData',
    instanceId: parts.instanceId,
    data,
    takeTimeFieldKeys: [],
  };
}
