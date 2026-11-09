/**
 * A car group in the generated form (BAJAOVRLAY-66), as pure functions: whether the
 * group's fields agree on one car (to open an item grouped or split, and to say why it is
 * split), how the group opens, and the per-field bindings a car pick writes. The form
 * keeps holding each field's own kind and binding, so what a save sends is built exactly
 * as before; the picker is only a faster way to fill those fields alike.
 */
import {
  buildPathOfCarFieldAtPlace,
  buildPathOfCarFieldChosenByNumber,
  type CarFieldMeaning,
  type CarGroup,
  readCarPickOfPositionsPath,
} from '@bajaovrlay/shared';

import { buildBindingPathKey, readBindingPathKey } from './bindingChoices';
import { emptySchemaFormBindingValue } from './bindingFormValue';
import { readOwnValueOfRecord } from './plainRecord';
import type { CarGroupWay, SchemaFormBindingValue, SchemaFormValues } from './schemaFormValues';

/**
 * One car picked for a group, as the form holds it: by number (the number as typed, so a
 * half-typed one can be shown back) or by place (undefined until a place is chosen), on
 * one source, live or frozen.
 */
export type CarPickInForm =
  | { pickedBy: 'number'; sourceId: string; carNumberText: string; isLive: boolean }
  | { pickedBy: 'place'; sourceId: string; placeNumber: number | undefined; isLive: boolean };

/**
 * Whether a group's fields agree:
 * - `oneCarPick`: every field reads its own meaning of one car, one source, live or not;
 * - `typed`: every field is typed by hand (and whether anything is typed at all);
 * - `differentCars`: every field reads the positions, but not of one car;
 * - `notOnePick`: anything else (one field typed among bound ones, read from the library
 *   or an event, another path, a transform, one field frozen and the others live).
 */
export type CarGroupFieldsAgreement =
  | { status: 'oneCarPick'; pick: CarPickInForm }
  | { status: 'typed'; isAnythingTyped: boolean }
  | { status: 'differentCars' }
  | { status: 'notOnePick' };

/** The form's binding of one field, or the empty one when it holds none. */
function readBindingValueOfField(
  formValues: SchemaFormValues,
  fieldKey: string,
): SchemaFormBindingValue {
  return readOwnValueOfRecord(formValues.bindings, fieldKey) ?? emptySchemaFormBindingValue;
}

/**
 * The car one field's binding follows, when it reads exactly its own meaning of one car
 * of the positions with no transform; undefined otherwise.
 */
function readCarPickOfBindingValue(
  meaning: CarFieldMeaning,
  bindingValue: SchemaFormBindingValue,
): CarPickInForm | undefined {
  const shapeAndPath = readBindingPathKey(bindingValue.pathKey);
  if (shapeAndPath?.shapeKey !== 'positions' || bindingValue.transformId !== '') {
    return undefined;
  }
  const carPick = readCarPickOfPositionsPath(shapeAndPath.path);
  if (carPick === undefined || carPick.meaning !== meaning) {
    return undefined;
  }
  if (carPick.pickedBy === 'number') {
    return {
      pickedBy: 'number',
      sourceId: bindingValue.sourceId,
      carNumberText: bindingValue.carNumberText.trim(),
      isLive: bindingValue.isLive,
    };
  }
  return {
    pickedBy: 'place',
    sourceId: bindingValue.sourceId,
    placeNumber: carPick.placeNumber,
    isLive: bindingValue.isLive,
  };
}

/** Whether two picks name the same car: the same way, and the same number or place. */
function doPicksNameTheSameCar(first: CarPickInForm, second: CarPickInForm): boolean {
  if (first.pickedBy === 'number' && second.pickedBy === 'number') {
    return first.carNumberText === second.carNumberText;
  }
  if (first.pickedBy === 'place' && second.pickedBy === 'place') {
    return first.placeNumber === second.placeNumber;
  }
  return false;
}

/** Reads whether the fields of one group agree on one car, are all typed, or neither. */
export function readAgreementOfCarGroupFields(
  carGroup: CarGroup,
  formValues: SchemaFormValues,
): CarGroupFieldsAgreement {
  const fieldEntries = Object.entries(carGroup.fields);
  const kinds = fieldEntries.map(
    ([fieldKey]) => readOwnValueOfRecord(formValues.kinds, fieldKey) ?? 'literal',
  );

  if (kinds.every((kind) => kind === 'literal')) {
    const isAnythingTyped = fieldEntries.some(([fieldKey]) => {
      const typedValue = readOwnValueOfRecord(formValues.values, fieldKey);
      return typedValue !== undefined && typedValue !== null && typedValue !== '';
    });
    return { status: 'typed', isAnythingTyped };
  }
  if (!kinds.every((kind) => kind === 'binding')) {
    return { status: 'notOnePick' };
  }

  const picks: CarPickInForm[] = [];
  for (const [fieldKey, meaning] of fieldEntries) {
    const pick = readCarPickOfBindingValue(meaning, readBindingValueOfField(formValues, fieldKey));
    if (pick === undefined) {
      return { status: 'notOnePick' };
    }
    picks.push(pick);
  }
  const firstPick = picks[0];
  if (firstPick === undefined) {
    return { status: 'notOnePick' };
  }
  const isEveryPickOfTheSameCar = picks.every((pick) => doPicksNameTheSameCar(firstPick, pick));
  if (!isEveryPickOfTheSameCar) {
    return { status: 'differentCars' };
  }
  const isEveryPickOneChoice = picks.every(
    (pick) => pick.sourceId === firstPick.sourceId && pick.isLive === firstPick.isLive,
  );
  return isEveryPickOneChoice
    ? { status: 'oneCarPick', pick: firstPick }
    : { status: 'notOnePick' };
}

/**
 * The way a group shows when its fields agree as they do now: its one car by number or by
 * place, typed by hand, or, when they disagree, `whenTheyDisagree`.
 */
function chooseWayFromAgreement(
  agreement: CarGroupFieldsAgreement,
  whenNothingIsTyped: CarGroupWay,
  whenTheyDisagree: CarGroupWay,
): CarGroupWay {
  switch (agreement.status) {
    case 'oneCarPick':
      return agreement.pick.pickedBy === 'number' ? 'carNumber' : 'place';
    case 'typed':
      return agreement.isAnythingTyped ? 'typed' : whenNothingIsTyped;
    case 'differentCars':
    case 'notOnePick':
      return whenTheyDisagree;
  }
}

/**
 * How a group opens in the editor: grouped when its fields agree (a new item, with
 * nothing typed, asks how to choose), and with "Campos separados" on when they do not, so
 * an item saved before the picker is shown as it is and never silently changed.
 */
export function chooseCarGroupWayAtOpening(
  carGroup: CarGroup,
  formValues: SchemaFormValues,
): CarGroupWay {
  return chooseWayFromAgreement(
    readAgreementOfCarGroupFields(carGroup, formValues),
    'notChosen',
    'separate',
  );
}

/**
 * How a group shows once "Campos separados" is turned off: grouped when its fields agree,
 * otherwise nothing chosen, so the next pick fills every field alike.
 */
export function chooseCarGroupWayAfterSeparateFields(
  carGroup: CarGroup,
  formValues: SchemaFormValues,
): CarGroupWay {
  return chooseWayFromAgreement(
    readAgreementOfCarGroupFields(carGroup, formValues),
    'typed',
    'notChosen',
  );
}

/** The way each group of a graphic opens, by group id, for the form's starting values. */
export function buildCarGroupWaysAtOpening(
  carGroups: CarGroup[],
  formValues: SchemaFormValues,
): Record<string, CarGroupWay> {
  const carGroupWays: Record<string, CarGroupWay> = {};
  for (const carGroup of carGroups) {
    carGroupWays[carGroup.id] = chooseCarGroupWayAtOpening(carGroup, formValues);
  }
  return carGroupWays;
}

/**
 * The pick a group shows, read from its first field's binding: the source and "Ao vivo"
 * as they are, the number as typed, the place when the field reads one. All fields hold
 * the same, as the picker writes them all at once.
 */
export function readCarPickShownInGroup(
  carGroup: CarGroup,
  formValues: SchemaFormValues,
  pickedBy: CarPickInForm['pickedBy'],
): CarPickInForm {
  const firstFieldEntry = Object.entries(carGroup.fields)[0];
  const bindingValue =
    firstFieldEntry === undefined
      ? emptySchemaFormBindingValue
      : readBindingValueOfField(formValues, firstFieldEntry[0]);
  const pickOfTheField =
    firstFieldEntry === undefined
      ? undefined
      : readCarPickOfBindingValue(firstFieldEntry[1], bindingValue);
  if (pickedBy === 'number') {
    return {
      pickedBy: 'number',
      sourceId: bindingValue.sourceId,
      carNumberText: bindingValue.carNumberText,
      isLive: bindingValue.isLive,
    };
  }
  return {
    pickedBy: 'place',
    sourceId: bindingValue.sourceId,
    placeNumber: pickOfTheField?.pickedBy === 'place' ? pickOfTheField.placeNumber : undefined,
    isLive: bindingValue.isLive,
  };
}

/**
 * The binding each field of a group holds for one pick: its own meaning of the car, by
 * number or at the place, with no transform. A place not chosen yet leaves the path
 * empty, which the form's check refuses with its usual message.
 */
export function buildBindingValuesOfCarPick(
  carGroup: CarGroup,
  pick: CarPickInForm,
): Record<string, SchemaFormBindingValue> {
  const bindingValues: Record<string, SchemaFormBindingValue> = {};
  for (const [fieldKey, meaning] of Object.entries(carGroup.fields)) {
    let pathKey = '';
    if (pick.pickedBy === 'number') {
      pathKey = buildBindingPathKey('positions', buildPathOfCarFieldChosenByNumber(meaning));
    } else if (pick.placeNumber !== undefined) {
      pathKey = buildBindingPathKey(
        'positions',
        buildPathOfCarFieldAtPlace(meaning, pick.placeNumber),
      );
    }
    bindingValues[fieldKey] = {
      ...emptySchemaFormBindingValue,
      sourceId: pick.sourceId,
      pathKey,
      carNumberText: pick.pickedBy === 'number' ? pick.carNumberText : '',
      isLive: pick.isLive,
    };
  }
  return bindingValues;
}
