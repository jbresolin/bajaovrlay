import { isDeepStrictEqual } from 'node:util';

import type { Instance, UpdateInstanceDataCommand } from '@bajaovrlay/shared';

import {
  refuseFieldGraphicCannotStamp,
  refuseInvalidGraphicData,
  refuseUnknownGraphic,
  refuseUnknownInstance,
  refuseUnusableUpdateRule,
} from '../commandRefusals.js';
import {
  separateClearedFieldsFromData,
  stampFieldsWithMomentOfTheCommand,
} from '../graphicDataPreparation.js';
import { listFieldsChangedOnAirAfterUpdate } from '../fieldsChangedOnAir.js';
import { findProblemInGraphicData } from '../graphicDataValidation.js';
import { findTakeTimeFieldKeyGraphicCannotStamp } from '../graphicSchemaProperties.js';
import { chooseUpdateRuleOfGraphic } from '../updateRules/index.js';
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
 * sends exactly what was seen. On an instance of an item, the fields the operator sent
 * that now differ from what the item gives join the instance's `fieldsChangedOnAir`
 * (fieldsChangedOnAir.ts), which Camadas shows as "alterado no ar".
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
  const dataOnAir = instanceToUpdate.resolvedData;

  // The manifest lives in the graphics slice, so this reducer reads no file. A graphic
  // can be missing here if its package was removed while its instance stayed on air
  // across a restart. That is not refused yet: see the trade-off further down.
  const graphic = slices.graphics.find(
    (registeredGraphic) => registeredGraphic.id === instanceToUpdate.graphicId,
  );

  // Before anything is stamped: the server writes its own moment only into a field the
  // graphic's schema marks as a wall-clock moment.
  if (graphic !== undefined) {
    const keyThatCannotBeStamped = findTakeTimeFieldKeyGraphicCannotStamp(
      graphic,
      command.takeTimeFieldKeys,
    );
    if (keyThatCannotBeStamped !== undefined) {
      return {
        status: 'refused',
        error: refuseFieldGraphicCannotStamp(graphic.id, keyThatCannotBeStamped),
      };
    }
  }

  // Null first, stamp second: a field that is both sent as null and named for stamping
  // ends up stamped, because the stamp is the more specific request of the two.
  const { keysOfClearedFields, fieldsWithAValue } = separateClearedFieldsFromData(command.data);
  const fieldsSentAndStamped = stampFieldsWithMomentOfTheCommand(
    fieldsWithAValue,
    command.takeTimeFieldKeys,
    context.now,
  );

  // The update rule comes after nulls and stamps (it must know of both) and before the
  // "nothing changed" check and the schema check (both must see what it wrote). A rule
  // the manifest names but the server cannot run refuses every update of the graphic,
  // even one that re-sends what is on air: without the rule the server cannot tell what
  // the update would do. The boot already warned about it (discoverBuiltGraphics.ts).
  let fieldsToWrite = fieldsSentAndStamped;
  if (graphic !== undefined) {
    const updateRuleChoice = chooseUpdateRuleOfGraphic(graphic);
    if (updateRuleChoice.status === 'unusable') {
      return {
        status: 'refused',
        error: refuseUnusableUpdateRule(graphic.id, updateRuleChoice.problem),
      };
    }
    if (updateRuleChoice.status === 'usable') {
      const ruleResult = updateRuleChoice.rule.applyRule(
        dataOnAir,
        fieldsSentAndStamped,
        command.takeTimeFieldKeys,
        keysOfClearedFields,
        Date.parse(context.now),
      );
      fieldsToWrite = ruleResult.fieldsToWrite;
    }
  }

  const keysToTakeOffAir = keysOfClearedFields.filter((clearedKey) => {
    const isOnAir = Object.hasOwn(dataOnAir, clearedKey);
    const isWrittenAnyway = Object.hasOwn(fieldsToWrite, clearedKey);
    return isOnAir && !isWrittenAnyway;
  });

  const keysAndValuesKeptFromAir = Object.entries(dataOnAir).filter(
    ([fieldKey]) => !keysToTakeOffAir.includes(fieldKey),
  );
  const dataAfterUpdate = {
    ...Object.fromEntries(keysAndValuesKeptFromAir),
    ...fieldsToWrite,
  };

  // Compared by content: no field sent at all, only nulls for fields that are not on
  // air, or values equal to the ones on air (an "Atualizar" pressed on an untouched
  // form) all leave the data as it is. Hand back the same slices, so nothing is saved,
  // logged or broadcast. A stamped field holds the moment of this command, which differs
  // from the one on air, so a stamp is a change.
  // Deliberate trade-off: this comes before the "graphic not registered" refusal, so
  // re-sending what is on air is answered ok even for an instance whose graphic is no
  // longer registered. Such an instance skipped the stamp check and the update rule
  // above (both need the manifest), so it gets the answers it always got: ok for a
  // re-send, GRAPHIC_NOT_FOUND for anything else.
  const leavesTheDataOnAirAsItIs = isDeepStrictEqual(dataAfterUpdate, dataOnAir);
  if (leavesTheDataOnAirAsItIs) {
    return { status: 'applied', slices };
  }

  // Without the graphic there is no schema, and new data cannot be checked.
  if (graphic === undefined) {
    return { status: 'refused', error: refuseUnknownGraphic(instanceToUpdate.graphicId) };
  }

  // The whole result is checked, not only the fields sent: the graphic receives the
  // whole object, a field that is valid alone can be invalid next to the others, and a
  // required field that was just taken off is found missing here.
  const problemInData = findProblemInGraphicData(graphic, dataAfterUpdate);
  if (problemInData !== undefined) {
    return { status: 'refused', error: refuseInvalidGraphicData(graphic.id, problemInData) };
  }

  // The status is left alone: an update says nothing about what the renderer managed
  // to show, so a `failed` instance stays failed until it is cleared or replaced.
  const updatedInstance: Instance = { ...instanceToUpdate, resolvedData: dataAfterUpdate };

  // A preview remembers which fields the server stamped, because takePreview stamps
  // exactly those again with the moment of the take. A field stamped by this update
  // joins that list; otherwise the take would send this update's moment to air and a
  // clock would go on air already counting. Program instances never carry the list.
  const isPreviewInstance = instanceToUpdate.target === 'preview';
  if (isPreviewInstance && command.takeTimeFieldKeys.length > 0) {
    const keysRememberedSoFar = instanceToUpdate.takeTimeFieldKeys ?? [];
    const keysStampedForTheFirstTime = command.takeTimeFieldKeys.filter(
      (stampedKey) => !keysRememberedSoFar.includes(stampedKey),
    );
    updatedInstance.takeTimeFieldKeys = [...keysRememberedSoFar, ...keysStampedForTheFirstTime];
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
