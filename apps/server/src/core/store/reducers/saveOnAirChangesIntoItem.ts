import type {
  FieldValue,
  Graphic,
  Instance,
  ItemFields,
  SaveOnAirChangesIntoItemCommand,
  WallClockFieldsChoice,
} from '@bajaovrlay/shared';

import { refuseUnknownInstance } from '../commandRefusals.js';
import { isFieldAWallClockMomentOfGraphic } from '../graphicSchemaProperties.js';
import { refuseInstanceWithoutItem, refuseNothingChangedOnAir } from '../onAirChangeRefusals.js';
import { refuseUnknownItem } from '../rundownCommandRefusals.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * saveOnAirChangesIntoItem ("Salvar no item" on a Camadas row): writes into the item the
 * fields its instance lists in `fieldsChangedOnAir`, each as a literal holding the value
 * on air now (a field cleared on air as a literal null, the way the item editor stores a
 * cleared field), and takes the list off the instance. The item's other fields and parts
 * stay as they were, and so does what is on air: only the item and the chip change.
 *
 * A field the graphic's schema marks as a wall-clock moment follows the command's
 * `wallClockFields`: `keepMoment` stores the moment on air as a literal, so every take
 * continues that very clock; `atTake` stores takeTime, so every take starts the clock
 * when it goes on air. A graphic the server no longer lists marks no field, so every
 * field is then a literal.
 *
 * Refused, with nothing changed, if the instance is not there (INSTANCE_NOT_FOUND), if it
 * has no item (INSTANCE_WITHOUT_ITEM: put on air by hand before BAJAOVRLAY-37), if its
 * item was deleted (ITEM_NOT_FOUND) or if nothing is listed (NOTHING_CHANGED_ON_AIR).
 * What could go wrong: a field the update rule rewrote is not listed, so stopping a
 * running clock on air and saving keeps only "stopped" in the item, not the time shown.
 */
export function reduceSaveOnAirChangesIntoItem(
  slices: SlicesChangedByCommands,
  command: SaveOnAirChangesIntoItemCommand,
): ReducerOutcome {
  const instance = slices.instances.find((candidate) => candidate.id === command.instanceId);
  if (instance === undefined) {
    return { status: 'refused', error: refuseUnknownInstance(command.instanceId) };
  }
  const itemId = instance.itemId;
  if (itemId === undefined) {
    const layerName =
      slices.layers.find((layer) => layer.id === instance.layerId)?.name ?? instance.layerId;
    return { status: 'refused', error: refuseInstanceWithoutItem(layerName) };
  }
  const item = slices.items.find((candidate) => candidate.id === itemId);
  if (item === undefined) {
    return { status: 'refused', error: refuseUnknownItem(itemId) };
  }
  const keysChangedOnAir = instance.fieldsChangedOnAir ?? [];
  if (keysChangedOnAir.length === 0) {
    return { status: 'refused', error: refuseNothingChangedOnAir(item.label) };
  }

  const graphic = slices.graphics.find((candidate) => candidate.id === instance.graphicId);
  const fieldsSaved: ItemFields = {};
  for (const fieldKey of keysChangedOnAir) {
    fieldsSaved[fieldKey] = buildFieldValueFromAir(
      instance,
      fieldKey,
      graphic,
      command.wallClockFields,
    );
  }
  const itemAfter = { ...item, fields: { ...item.fields, ...fieldsSaved } };

  // The air already shows what the item now gives, so nothing on it is changed on air.
  const instanceAfter: Instance = { ...instance };
  delete instanceAfter.fieldsChangedOnAir;

  return {
    status: 'applied',
    slices: {
      ...slices,
      items: slices.items.map((candidate) => (candidate.id === item.id ? itemAfter : candidate)),
      instances: slices.instances.map((candidate) =>
        candidate.id === instance.id ? instanceAfter : candidate,
      ),
    },
  };
}

/** What the item stores for one field changed on air: the value on air, or takeTime. */
function buildFieldValueFromAir(
  instance: Instance,
  fieldKey: string,
  graphic: Graphic | undefined,
  wallClockFields: WallClockFieldsChoice,
): FieldValue {
  const isWallClockMoment =
    graphic !== undefined && isFieldAWallClockMomentOfGraphic(graphic, fieldKey);
  if (isWallClockMoment && wallClockFields === 'atTake') {
    return { kind: 'takeTime' };
  }
  const isOnAir = Object.hasOwn(instance.resolvedData, fieldKey);
  return { kind: 'literal', value: isOnAir ? instance.resolvedData[fieldKey] : null };
}
