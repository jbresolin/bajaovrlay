import type { CommandError, Graphic, ItemFields } from '@bajaovrlay/shared';

import { refuseFieldGraphicCannotStamp } from './commandRefusals.js';
import { findTakeTimeFieldKeyGraphicCannotStamp } from './graphicSchemaProperties.js';

/**
 * Lists the keys of the item fields that say `{ kind: 'takeTime' }`: the fields the
 * server fills with the moment the item goes on air.
 */
export function listKeysOfTakeTimeFields(fields: ItemFields): string[] {
  return Object.keys(fields).filter((fieldKey) => fields[fieldKey]?.kind === 'takeTime');
}

/**
 * Returns the refusal for the first of these item fields that says takeTime on a field
 * the graphic's schema does not mark as a wall-clock moment, or undefined when every
 * takeTime field is one the server may stamp (or there is none). It is the check of a
 * take (same function, same code, same pt-BR message), made when an item is saved.
 * What could go wrong: it judges by the manifest registered now. The graphic can be
 * registered again with another manifest before the item is taken, which is why the take
 * checks again.
 */
export function findRefusalOfTakeTimeFieldsForGraphic(
  graphic: Graphic,
  fields: ItemFields,
): CommandError | undefined {
  const keyThatCannotBeStamped = findTakeTimeFieldKeyGraphicCannotStamp(
    graphic,
    listKeysOfTakeTimeFields(fields),
  );
  if (keyThatCannotBeStamped === undefined) {
    return undefined;
  }
  return refuseFieldGraphicCannotStamp(graphic.id, keyThatCannotBeStamped);
}
