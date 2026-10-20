import type { Instance, UpdateInstanceDataCommand } from '@bajaovrlay/shared';

import { refuseUnknownInstance } from '../commandRefusals.js';
import { listFieldsChangedOnAirAfterUpdate } from '../fieldsChangedOnAir.js';
import { prepareInstanceDataUpdate } from '../instanceDataUpdate.js';
import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * updateInstanceData: changes the instance's current data field by field (top-level
 * fields only; a field holding an object is replaced whole) and keeps the instance's
 * id, which is what makes the renderer update the graphic in place instead of taking
 * it off and on again. In this order: a field sent as `null` is taken off the data;
 * each field named in `takeTimeFieldKeys` gets the moment of this command in
 * milliseconds (only a field the graphic's schema marks as a wall-clock moment may be
 * named); the update rule the graphic's manifest names, if any, adds what it must (the
 * race clock's keeps the clock from jumping); every field then replaces the one on air.
 * Refused if the instance is not there, if a field may not be stamped, if the manifest's
 * update rule cannot be run, or if the resulting data breaks the graphic's manifest
 * schema (taking off a required field does). An update that leaves the data exactly as
 * it is on air hands back the same slices. It works the same on a preview instance
 * ("Atualizar prévia" of "Edição rápida"), which keeps its id and its item, so "Tomar"
 * sends exactly what was seen: a moment typed into a field the preview had stamped is no
 * longer stamped again at the take, and an edited automatic preview becomes `manual`. On an
 * instance of an item, the fields the operator sent that now differ from what the item
 * gives join the instance's `fieldsChangedOnAir` (fieldsChangedOnAir.ts), which Camadas
 * shows as "alterado no ar".
 */
export function reduceUpdateInstanceData(
  slices: SlicesChangedByCommands,
  command: UpdateInstanceDataCommand,
  context: ReducerContext,
): ReducerOutcome {
  const instanceToUpdate = slices.instances.find((instance) => instance.id === command.instanceId);
  if (instanceToUpdate === undefined) {
    return { status: 'refused', error: refuseUnknownInstance(command.instanceId) };
  }
  const preparation = prepareInstanceDataUpdate(
    slices.graphics,
    instanceToUpdate,
    command.data,
    command.takeTimeFieldKeys,
    context.now,
  );
  if (preparation.status === 'refused') {
    return preparation;
  }
  if (preparation.status === 'unchanged') {
    return { status: 'applied', slices };
  }
  const { dataAfterUpdate, fieldsWithAValue } = preparation;

  // The status is left alone: an update says nothing about what the renderer managed
  // to show, so a `failed` instance stays failed until it is cleared or replaced.
  const updatedInstance: Instance = { ...instanceToUpdate, resolvedData: dataAfterUpdate };

  // Two things only a preview carries follow the edit ("Atualizar prévia").
  if (instanceToUpdate.target === 'preview') {
    const takeTimeFieldKeysAfter = listTakeTimeFieldKeysOfPreviewAfterUpdate(
      instanceToUpdate.takeTimeFieldKeys ?? [],
      Object.keys(fieldsWithAValue),
      command.takeTimeFieldKeys,
    );
    if (takeTimeFieldKeysAfter.length === 0) {
      delete updatedInstance.takeTimeFieldKeys;
    } else {
      updatedInstance.takeTimeFieldKeys = takeTimeFieldKeysAfter;
    }
    // An automatic preview the operator edited is theirs now: the next "Prévia
    // automática" discards only previews marked `auto`, and must not throw the edit away.
    if (instanceToUpdate.previewOrigin === 'auto') {
      updatedInstance.previewOrigin = 'manual';
    }
  }

  // Only the keys the operator sent can be listed: a field the update rule rewrote by
  // itself (the clock's time and moment, when the clock was stopped) is the same clock
  // carried forward, not a change the operator made.
  const fieldsChangedOnAirAfter = listFieldsChangedOnAirAfterUpdate({
    instanceBefore: instanceToUpdate,
    itemOfTheInstance: slices.items.find((item) => item.id === instanceToUpdate.itemId),
    keysSentByTheOperator: [...Object.keys(command.data), ...command.takeTimeFieldKeys],
    dataAfterUpdate,
  });
  if (fieldsChangedOnAirAfter !== undefined) {
    updatedInstance.fieldsChangedOnAir = fieldsChangedOnAirAfter;
  }

  const instancesAfterUpdate = slices.instances.map((instance) =>
    instance.id === command.instanceId ? updatedInstance : instance,
  );
  return { status: 'applied', slices: { ...slices, instances: instancesAfterUpdate } };
}

/**
 * The fields a preview stamps again with the moment of its take, after an update of the
 * preview. takePreview stamps exactly these, so a previewed clock starts counting when it
 * goes on air. A field this update stamped joins the list: otherwise the take would send
 * this update's moment to air, and a clock would go on air already counting. A field this
 * update sent with a value of its own, and did not ask to stamp, leaves the list: the
 * operator typed that moment, and the take must not write over it (gate 2 of PR #15).
 */
function listTakeTimeFieldKeysOfPreviewAfterUpdate(
  keysRememberedBefore: string[],
  keysSentWithAValue: string[],
  keysStampedByThisUpdate: string[],
): string[] {
  const keysTypedByTheOperator = keysSentWithAValue.filter(
    (sentKey) => !keysStampedByThisUpdate.includes(sentKey),
  );
  const keysStillToStamp = keysRememberedBefore.filter(
    (rememberedKey) => !keysTypedByTheOperator.includes(rememberedKey),
  );
  const keysStampedForTheFirstTime = keysStampedByThisUpdate.filter(
    (stampedKey) => !keysStillToStamp.includes(stampedKey),
  );
  return [...keysStillToStamp, ...keysStampedForTheFirstTime];
}
