/**
 * "Atualizar no ar" of a Camadas row behind its item (BAJAOVRLAY-38): the updateInstanceData
 * that sends the item's values of the fields behind to that instance, and whether a clock
 * question must be asked first. Pure functions, no drawing.
 */
import type {
  Graphic,
  Item,
  UpdateInstanceDataCommand,
  WallClockFieldsChoice,
} from '@bajaovrlay/shared';

import {
  listClockFieldKeysOfGraphic,
  listWallClockFieldKeysOfGraphic,
} from './fieldsOfInstanceOnAir';

/**
 * Whether "Atualizar no ar" must ask the clock question first: any clock field (time,
 * moment, switch or mode) among the fields behind, the rule "Salvar no item" asks by.
 */
export function isAClockFieldBehind(keysBehind: string[], graphic: Graphic | undefined): boolean {
  const clockFieldKeys = listClockFieldKeysOfGraphic(graphic);
  return keysBehind.some((fieldKey) => clockFieldKeys.includes(fieldKey));
}

/** What buildUpdateThatCatchesUpWithTheItem needs, all read at the press. */
export type CatchUpWithTheItemParts = {
  instanceId: string;
  item: Item;
  graphic: Graphic | undefined;
  /** The fields behind (findWhereTheItemIsAheadOfTheAir), every one a typed value of the item. */
  keysBehind: string[];
  /** The answer to the clock question; `keepMoment` when none was asked. */
  wallClockFields: WallClockFieldsChoice;
};

/**
 * The update that sends each field behind with the item's value, an empty one as null
 * (which takes it off air). With `atTake` the server also stamps the clock's moment with
 * the moment of the command, so the clock starts counting from the item's time now, as a
 * take would start it; with `keepMoment` nothing is stamped, and the server's clock rule
 * keeps a running clock from jumping, as the item editor's "Atualizar no ar" does.
 * What could go wrong: a stamped moment is a value the operator sent, so the server lists
 * it as "alterado no ar" when the item stores the moment as "the moment of the take".
 */
export function buildUpdateThatCatchesUpWithTheItem(
  parts: CatchUpWithTheItemParts,
): UpdateInstanceDataCommand {
  const isTheMomentStamped = parts.wallClockFields === 'atTake';
  const wallClockFieldKeys = isTheMomentStamped
    ? listWallClockFieldKeysOfGraphic(parts.graphic)
    : [];

  const data: Record<string, unknown> = {};
  for (const fieldKey of parts.keysBehind) {
    const fieldOfTheItem = parts.item.fields[fieldKey];
    // A stamped moment is written by the server; sending the item's number too would
    // only be overwritten.
    const isStampedInstead = wallClockFieldKeys.includes(fieldKey);
    if (fieldOfTheItem?.kind !== 'literal' || isStampedInstead) {
      continue;
    }
    data[fieldKey] = fieldOfTheItem.value;
  }

  return {
    type: 'updateInstanceData',
    instanceId: parts.instanceId,
    data,
    takeTimeFieldKeys: wallClockFieldKeys,
  };
}
