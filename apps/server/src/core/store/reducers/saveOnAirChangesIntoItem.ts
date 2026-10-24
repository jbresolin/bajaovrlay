import {
  type FieldValue,
  findClockFieldKeysByRole,
  type Graphic,
  type Instance,
  type ItemFields,
  listFieldKeysItemReadsFromASource,
  type SaveOnAirChangesIntoItemCommand,
  type WallClockFieldsChoice,
} from '@bajaovrlay/shared';

import { refuseUnknownInstance } from '../commandRefusals.js';
import { removeKeysFromFieldsChangedOnAirOfItem } from '../fieldsChangedOnAir.js';
import {
  isFieldAWallClockMomentOfGraphic,
  listClockFieldKeysOfGraphic,
} from '../graphicSchemaProperties.js';
import { refuseInstanceWithoutItem, refuseNothingChangedOnAir } from '../onAirChangeRefusals.js';
import { refuseUnknownItem } from '../rundownCommandRefusals.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * saveOnAirChangesIntoItem ("Salvar no item" on a Camadas row): writes into the item the
 * fields its instance lists in `fieldsChangedOnAir`, each as a literal holding the value
 * on air now (a field cleared on air as a literal null, the way the item editor stores a
 * cleared field), and takes those fields off the list of every live instance of the item
 * (this one and a preview of the same item alike). The item's other fields and parts stay
 * as they were, and so does what is on air: only the item and the chips change.
 *
 * A clock is saved whole: when any listed field has a clock role (clockTime, wallClock,
 * clockRunning, clockMode), all of the graphic's clock fields are saved together from
 * what is on air. Stopping a clock lists only the running switch, because the update rule
 * wrote the time it reached and the moment, and the chip lists only what the operator
 * sent; saving the switch alone would bring the clock back at the item's old time (gate 2
 * of PR #15: stopped at 27:34, saved, taken again, it showed 12:34).
 *
 * A field the graphic's schema marks as a wall-clock moment follows the command's
 * `wallClockFields`: `keepMoment` stores the moment on air as a literal, so every take
 * continues that very clock; `atTake` stores takeTime, so every take starts the clock
 * when it goes on air. A graphic the server no longer lists marks no field, so every
 * field is then a literal.
 *
 * A field the item reads from a source (a binding, or the four fields of the whole clock)
 * is skipped and stays listed as changed on air: the item keeps following its source
 * (gate 2 of PR #18), and the control page names what was not saved. When every listed
 * field is one, the save changes nothing.
 *
 * Refused, with nothing changed, if the instance is not there (INSTANCE_NOT_FOUND), if it
 * has no item (INSTANCE_WITHOUT_ITEM: put on air by hand before BAJAOVRLAY-37), if its
 * item was deleted (ITEM_NOT_FOUND) or if nothing is listed (NOTHING_CHANGED_ON_AIR).
 * What could go wrong: a graphic whose clock fields carry no roles is saved field by
 * field, so a stopped clock of such a graphic would lose its time; the race clock marks all
 * four.
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
  const keysItemReadsFromASource = listFieldKeysItemReadsFromASource(
    item.fields,
    graphic === undefined ? undefined : findClockFieldKeysByRole(graphic),
  );
  // A field filled by an event is skipped like a bound one: saving the event's value
  // into it would turn the template into a fixed item (BAJAOVRLAY-44).
  const keysToSave = addTheWholeClockWhenAPartOfItIsListed(keysChangedOnAir, graphic).filter(
    (fieldKey) =>
      !keysItemReadsFromASource.includes(fieldKey) && item.fields[fieldKey]?.kind !== 'eventField',
  );
  if (keysToSave.length === 0) {
    return { status: 'applied', slices };
  }
  const fieldsSaved: ItemFields = {};
  for (const fieldKey of keysToSave) {
    fieldsSaved[fieldKey] = buildFieldValueFromAir(
      instance,
      fieldKey,
      graphic,
      command.wallClockFields,
    );
  }
  const itemAfter = { ...item, fields: { ...item.fields, ...fieldsSaved } };

  // The air already shows what the item now gives, so nothing on it is changed on air:
  // this instance's list empties, and a live preview of the item loses those fields too.
  const instancesAfter = removeKeysFromFieldsChangedOnAirOfItem(
    slices.instances,
    item.id,
    keysToSave,
  );

  return {
    status: 'applied',
    slices: {
      ...slices,
      items: slices.items.map((candidate) => (candidate.id === item.id ? itemAfter : candidate)),
      instances: instancesAfter,
    },
  };
}

/**
 * The keys to save: those listed, plus every clock field of the graphic when any listed
 * key is one (a clock's time, moment, switch and mode only mean something together).
 */
function addTheWholeClockWhenAPartOfItIsListed(
  keysChangedOnAir: string[],
  graphic: Graphic | undefined,
): string[] {
  const clockFieldKeys = graphic === undefined ? [] : listClockFieldKeysOfGraphic(graphic);
  const isAClockFieldListed = keysChangedOnAir.some((fieldKey) =>
    clockFieldKeys.includes(fieldKey),
  );
  if (!isAClockFieldListed) {
    return keysChangedOnAir;
  }
  const clockFieldKeysNotListed = clockFieldKeys.filter(
    (fieldKey) => !keysChangedOnAir.includes(fieldKey),
  );
  return [...keysChangedOnAir, ...clockFieldKeysNotListed];
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
