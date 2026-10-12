import type {
  SchemaFormControl,
  SchemaFormDescription,
  SchemaFormDirtyFields,
} from '@/features/schemaForm';

import {
  nameOfTheCarryClockForwardRule,
  roleOfTheClockModeField,
  roleOfTheClockTimeField,
  roleOfTheReferenceMomentField,
  roleOfTheRunningField,
} from './clockRolesOfCarryClockForward';

/** The keys of the four data fields a clock works its time out from, in one graphic. */
export type ClockFieldKeysOfGraphic = {
  /** The time the clock read, typed as mm:ss and held in milliseconds. */
  timeFieldKey: string;
  /** The wall-clock moment that time was read, in milliseconds since 1970. */
  referenceMomentFieldKey: string;
  /** Whether the clock runs or is held. */
  runningFieldKey: string;
  /** Which way it counts: `elapsed` or `remaining`. */
  clockModeFieldKey: string;
};

/**
 * The key of the one field that has this role and is drawn with this control, or
 * undefined when no field or more than one field has the role, or the one that has it
 * is another kind of field. Choosing among two would be a guess.
 */
function findKeyOfTheOneFieldWithRole(
  description: SchemaFormDescription,
  role: string,
  controlTheFieldMustHave: SchemaFormControl,
): string | undefined {
  const fieldsWithTheRole = description.fields.filter((field) => field.role === role);
  if (fieldsWithTheRole.length !== 1) {
    return undefined;
  }
  const theField = fieldsWithTheRole[0];
  if (theField === undefined || theField.control !== controlTheFieldMustHave) {
    return undefined;
  }
  return theField.key;
}

/**
 * Finds the four fields of a clock in a graphic, from its manifest alone: the manifest
 * must name the update rule `carryClockForward` (`graphic.manifest.v_baja?.updateRule`)
 * and mark each of the four parts with its role, once, on the right kind of field (the
 * time on an mm:ss field, the moment on a number, the switch on a boolean, the mode on
 * a dropdown). Undefined when any of that is missing: the graphic is then treated like
 * every other one, and its form shows exactly what is on air.
 */
export function findClockFieldKeysOfGraphic(
  nameOfTheUpdateRule: string | undefined,
  description: SchemaFormDescription,
): ClockFieldKeysOfGraphic | undefined {
  if (nameOfTheUpdateRule !== nameOfTheCarryClockForwardRule) {
    return undefined;
  }
  const timeFieldKey = findKeyOfTheOneFieldWithRole(
    description,
    roleOfTheClockTimeField,
    'duration',
  );
  const referenceMomentFieldKey = findKeyOfTheOneFieldWithRole(
    description,
    roleOfTheReferenceMomentField,
    'number',
  );
  const runningFieldKey = findKeyOfTheOneFieldWithRole(
    description,
    roleOfTheRunningField,
    'switch',
  );
  const clockModeFieldKey = findKeyOfTheOneFieldWithRole(
    description,
    roleOfTheClockModeField,
    'select',
  );
  if (
    timeFieldKey === undefined ||
    referenceMomentFieldKey === undefined ||
    runningFieldKey === undefined ||
    clockModeFieldKey === undefined
  ) {
    return undefined;
  }
  return { timeFieldKey, referenceMomentFieldKey, runningFieldKey, clockModeFieldKey };
}

/**
 * Answers whether the operator changed the reading itself: the time, or the moment the
 * time belongs to (its value, or who fills it). While that is so the form shows the
 * reading as the form holds it, because the two fields are then being edited as a pair.
 */
export function hasOperatorChangedTheClockReading(
  clockFieldKeys: ClockFieldKeysOfGraphic,
  fieldsTheOperatorChanged: SchemaFormDirtyFields,
): boolean {
  const changedValues = fieldsTheOperatorChanged.values ?? {};
  const changedKinds = fieldsTheOperatorChanged.kinds ?? {};
  const isTheTimeChanged = changedValues[clockFieldKeys.timeFieldKey] === true;
  const isTheMomentChanged = changedValues[clockFieldKeys.referenceMomentFieldKey] === true;
  const isTheKindOfTheMomentChanged = changedKinds[clockFieldKeys.referenceMomentFieldKey] === true;
  return isTheTimeChanged || isTheMomentChanged || isTheKindOfTheMomentChanged;
}
