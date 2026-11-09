import { isDeepStrictEqual } from 'node:util';

import type { CommandError, Graphic, Instance } from '@bajaovrlay/shared';

import {
  refuseFieldGraphicCannotStamp,
  refuseInvalidGraphicData,
  refuseUnknownGraphic,
  refuseUnusableUpdateRule,
} from './commandRefusals.js';
import {
  separateClearedFieldsFromData,
  stampFieldsWithMomentOfTheCommand,
} from './graphicDataPreparation.js';
import { findProblemInGraphicData } from './graphicDataValidation.js';
import { findTakeTimeFieldKeyGraphicCannotStamp } from './graphicSchemaProperties.js';
import { chooseUpdateRuleOfGraphic } from './updateRules/index.js';

/**
 * What preparing a change of an instance's data gives: the data after the change (and
 * the fields that were sent with a value), `unchanged` when the result equals the data
 * on air, or the refusal.
 */
export type InstanceDataUpdatePreparation =
  | {
      status: 'prepared';
      dataAfterUpdate: Record<string, unknown>;
      fieldsWithAValue: Record<string, unknown>;
    }
  | { status: 'unchanged' }
  | { status: 'refused'; error: CommandError };

/**
 * The steps every change of an instance's data on air runs, in this order: a field sent
 * as `null` is taken off the data; each field named in `takeTimeFieldKeys` gets the
 * moment of the command in milliseconds (only a wall-clock field of the graphic may be
 * named); the update rule the graphic's manifest names, if any, adds what it must (the
 * race clock's keeps the clock from jumping); every field then replaces the one on air;
 * a result equal to the data on air is `unchanged`; and the whole result is checked
 * against the graphic's manifest schema. Shared by updateInstanceData (the operator's
 * edit) and refreshBoundInstanceData (a source's new values, BAJAOVRLAY-20), so a refresh
 * can never put on air what an edit could not.
 */
export function prepareInstanceDataUpdate(
  graphics: Graphic[],
  instanceToUpdate: Instance,
  dataSent: Record<string, unknown>,
  takeTimeFieldKeys: string[],
  now: string,
): InstanceDataUpdatePreparation {
  const dataOnAir = instanceToUpdate.resolvedData;

  // The manifest lives in the graphics slice, so this reducer reads no file. A graphic
  // can be missing here if its package was removed while its instance stayed on air
  // across a restart. That is not refused yet: see the trade-off further down.
  const graphic = graphics.find(
    (registeredGraphic) => registeredGraphic.id === instanceToUpdate.graphicId,
  );

  // Before anything is stamped: the server writes its own moment only into a field the
  // graphic's schema marks as a wall-clock moment.
  if (graphic !== undefined) {
    const keyThatCannotBeStamped = findTakeTimeFieldKeyGraphicCannotStamp(
      graphic,
      takeTimeFieldKeys,
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
  const { keysOfClearedFields, fieldsWithAValue } = separateClearedFieldsFromData(dataSent);
  const fieldsSentAndStamped = stampFieldsWithMomentOfTheCommand(
    fieldsWithAValue,
    takeTimeFieldKeys,
    now,
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
        takeTimeFieldKeys,
        keysOfClearedFields,
        Date.parse(now),
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
    return { status: 'unchanged' };
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
    return { status: 'refused', error: refuseInvalidGraphicData(graphic, problemInData) };
  }

  return { status: 'prepared', dataAfterUpdate, fieldsWithAValue };
}
