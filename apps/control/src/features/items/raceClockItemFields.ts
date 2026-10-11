/**
 * The race clock's field values as an item stores them: built from the race clock form
 * when an item is saved, and read back into form values when an item is opened.
 *
 * How a prepared clock behaves (João's ruling at gate 2 of BAJAOVRLAY-13): an item
 * stores exactly what the operator typed, as literals, and its reference moment
 * (`referenceWallClockMs`, the instant a running clock counts from) as
 * `{ kind: 'takeTime' }`. The server writes the instant of the take into that field
 * when the item goes on air. So a clock saved running at 240:00 on Friday starts at
 * 240:00 when it is taken on Saturday, and a clock saved stopped shows the typed time.
 *
 * Items saved before that ruling, or stored by a script, may hold a literal number
 * there. They are read as before, and nothing rewrites the number until a save changes
 * the clock's time or its "running" switch (raceClockReferenceRules.ts). What could go
 * wrong: until such an edit, a clock stored running still counts from that number.
 *
 * The rules repeat the manifest (packages/graphics/race-clock/race-clock.ograf.json) by
 * hand, as features/playout does; BAJAOVRLAY-14 replaces all of it with generated forms.
 */
import type { ItemFields } from '@bajaovrlay/shared';
import { z } from 'zod';

import { formatMillisecondsAsMinutesAndSeconds } from '@/features/playout/minutesAndSeconds';
import {
  buildTakeRaceClockCommand,
  clockModes,
  defaultRaceClockTakeFormValues,
  flagStates,
  type RaceClockTakeFormValues,
} from '@/features/playout/raceClockTakeForm';

/** What reading an item's fields gives: form values, and the fields that fell back. */
export type RaceClockFormValuesReadFromItem = {
  formValues: RaceClockTakeFormValues;
  /** Form fields shown with the form's default because the stored value was unusable. */
  formFieldsThatCouldNotBeRead: Array<keyof RaceClockTakeFormValues>;
};

// What each stored literal must look like for the form to show it.
const StoredSessionNameSchema = z.string();
const StoredFlagStateSchema = z.enum(flagStates);
const StoredClockModeSchema = z.enum(clockModes);
const StoredRunningSchema = z.boolean();
const StoredMillisecondsSchema = z.number().int().min(0);
const StoredLapsSchema = z.number().int().min(0);

// The take panel's builder wants a moment for the clock to count from. An item has none
// until it is taken, so the builder is given this one and its answer for that field is
// thrown away: the item stores `{ kind: 'takeTime' }` there instead.
const referenceMomentThatIsNeverStored = 0;

/**
 * Builds the stored fields from race clock form values that passed the take panel's
 * rules: one literal per typed field, the reference moment as "the moment of the take"
 * (the server stamps it when the item goes on air), and no laps field when the laps are
 * blank.
 */
export function buildRaceClockItemFieldsFromFormValues(
  formValues: RaceClockTakeFormValues,
): ItemFields {
  // The take panel's builder already turns the form into the data the graphic expects
  // (trimmed name, mm:ss to milliseconds, blank laps left out). It is reused here so an
  // item and a take by hand can never disagree about that conversion.
  const raceClockData = buildTakeRaceClockCommand(
    formValues,
    referenceMomentThatIsNeverStored,
  ).data;

  const itemFields: ItemFields = {
    sessionName: { kind: 'literal', value: raceClockData.sessionName },
    state: { kind: 'literal', value: raceClockData.state },
    clockMode: { kind: 'literal', value: raceClockData.clockMode },
    referenceTimeMs: { kind: 'literal', value: raceClockData.referenceTimeMs },
    referenceWallClockMs: { kind: 'takeTime' },
    running: { kind: 'literal', value: raceClockData.running },
  };
  if (raceClockData.lapsCompletedByLeader !== undefined) {
    itemFields.lapsCompletedByLeader = {
      kind: 'literal',
      value: raceClockData.lapsCompletedByLeader,
    };
  }
  return itemFields;
}

/**
 * The literal value stored under `fieldKey`, or undefined when the item has no such
 * field or the field is not a literal: "the moment of the take" has no value to show,
 * and neither have the kinds M2 brings (bindings).
 */
function readLiteralValueOfField(itemFields: ItemFields, fieldKey: string): unknown {
  const fieldValue = itemFields[fieldKey];
  if (fieldValue === undefined || fieldValue.kind !== 'literal') {
    return undefined;
  }
  return fieldValue.value;
}

/**
 * Reads an item's stored fields as race clock form values. A stored field that is
 * missing, is not a literal or holds a value the form cannot show takes the form's
 * default and is named in `formFieldsThatCouldNotBeRead`, in the order of the form.
 * Missing laps are normal (they are optional) and are not named. The time is the stored
 * one: an item is not on air, so nothing is carried forward to "now".
 */
export function readRaceClockFormValuesFromItemFields(
  itemFields: ItemFields,
): RaceClockFormValuesReadFromItem {
  const formValues: RaceClockTakeFormValues = { ...defaultRaceClockTakeFormValues };
  const formFieldsThatCouldNotBeRead: Array<keyof RaceClockTakeFormValues> = [];

  const storedSessionName = StoredSessionNameSchema.safeParse(
    readLiteralValueOfField(itemFields, 'sessionName'),
  );
  if (storedSessionName.success) {
    formValues.sessionName = storedSessionName.data;
  } else {
    formFieldsThatCouldNotBeRead.push('sessionName');
  }

  const storedFlagState = StoredFlagStateSchema.safeParse(
    readLiteralValueOfField(itemFields, 'state'),
  );
  if (storedFlagState.success) {
    formValues.state = storedFlagState.data;
  } else {
    formFieldsThatCouldNotBeRead.push('state');
  }

  const storedClockMode = StoredClockModeSchema.safeParse(
    readLiteralValueOfField(itemFields, 'clockMode'),
  );
  if (storedClockMode.success) {
    formValues.clockMode = storedClockMode.data;
  } else {
    formFieldsThatCouldNotBeRead.push('clockMode');
  }

  const storedRunning = StoredRunningSchema.safeParse(
    readLiteralValueOfField(itemFields, 'running'),
  );
  if (storedRunning.success) {
    formValues.running = storedRunning.data;
  } else {
    formFieldsThatCouldNotBeRead.push('running');
  }

  const storedReferenceTimeMs = StoredMillisecondsSchema.safeParse(
    readLiteralValueOfField(itemFields, 'referenceTimeMs'),
  );
  if (storedReferenceTimeMs.success) {
    formValues.referenceTime = formatMillisecondsAsMinutesAndSeconds(storedReferenceTimeMs.data);
  } else {
    formFieldsThatCouldNotBeRead.push('referenceTime');
  }

  const hasLapsField = itemFields.lapsCompletedByLeader !== undefined;
  if (hasLapsField) {
    const storedLaps = StoredLapsSchema.safeParse(
      readLiteralValueOfField(itemFields, 'lapsCompletedByLeader'),
    );
    if (storedLaps.success) {
      formValues.lapsCompletedByLeader = String(storedLaps.data);
    } else {
      formFieldsThatCouldNotBeRead.push('lapsCompletedByLeader');
    }
  }

  return { formValues, formFieldsThatCouldNotBeRead };
}

/**
 * Answers whether the item stores the time the form holds, as far as the form can tell.
 * The form shows and reads whole seconds (mm:ss), so a stored 90 500 ms (written by a
 * script; the editor itself only stores whole seconds) is shown as "1:30" and comes back
 * as 90 000 ms. That difference is the form's rounding, not a change by the operator,
 * so both are compared as the mm:ss text the form shows.
 * A stored time the form cannot show (missing, not a literal, not a whole number of
 * milliseconds) is never the same: the form then shows its default, and saving replaces it.
 * What could go wrong: the part of a second stays stored until the operator types a
 * different time; typing the same mm:ss again does not remove it.
 */
export function isStoredReferenceTimeTheOneTheFormHolds(
  itemFields: ItemFields,
  referenceTimeFromTheFormInMilliseconds: number,
): boolean {
  const storedReferenceTimeMs = StoredMillisecondsSchema.safeParse(
    readLiteralValueOfField(itemFields, 'referenceTimeMs'),
  );
  if (!storedReferenceTimeMs.success) {
    return false;
  }
  const storedTimeAsTheFormShowsIt = formatMillisecondsAsMinutesAndSeconds(
    storedReferenceTimeMs.data,
  );
  const timeOfTheFormAsTheFormShowsIt = formatMillisecondsAsMinutesAndSeconds(
    referenceTimeFromTheFormInMilliseconds,
  );
  return storedTimeAsTheFormShowsIt === timeOfTheFormAsTheFormShowsIt;
}

/**
 * Answers whether the item stores a reference moment the clock can use: "the moment of
 * the take" (what this editor saves), or a literal whole number of milliseconds (what an
 * earlier editor saved and what a script may store). Without one the graphic refuses
 * the item's data at the take.
 */
export function hasReferenceMomentTheClockCanUse(itemFields: ItemFields): boolean {
  const isStampedAtTheTake = itemFields.referenceWallClockMs?.kind === 'takeTime';
  if (isStampedAtTheTake) {
    return true;
  }
  const storedReferenceMoment = StoredMillisecondsSchema.safeParse(
    readLiteralValueOfField(itemFields, 'referenceWallClockMs'),
  );
  return storedReferenceMoment.success;
}

/**
 * Answers whether the form has blank laps while the item stores laps. `updateItemFields`
 * merges fields key by key and cannot remove one, and the graphic refuses a null field,
 * so such a save cannot be expressed; the panel refuses it with a message instead.
 */
export function isFormBlankingLapsTheItemHas(
  itemFields: ItemFields,
  formValues: RaceClockTakeFormValues,
): boolean {
  const hasLapsField = itemFields.lapsCompletedByLeader !== undefined;
  const areLapsBlankInTheForm = formValues.lapsCompletedByLeader.trim() === '';
  return hasLapsField && areLapsBlankInTheForm;
}
