/**
 * The command "Atualizar" sends while the race clock is on air.
 *
 * There is no update command yet (`updateItemFields` comes in M1), so "Atualizar" is a
 * second `takeGraphic` and the server replaces the instance on the layer. The command is
 * therefore the whole of the clock's data, put together from two sources: a field the
 * operator changed comes from the form, and a field the operator left alone comes from
 * what is on air. A flag change in the middle of a race then changes the flag and
 * nothing else; it cannot reset the clock, stop it or rename the session.
 */
import { findTimeShownOnAir, readRaceClockDataOnAir } from './raceClockDataOnAir';
import {
  buildTakeRaceClockCommand,
  type RaceClockData,
  type RaceClockTakeFormValues,
  type TakeRaceClockCommand,
} from './raceClockTakeForm';

/**
 * Which form fields the operator changed since the form was last filled. This is the
 * shape of react-hook-form's `formState.dirtyFields`: a changed field is `true`, and an
 * unchanged one is absent or `false`.
 */
export type RaceClockFieldsTheOperatorChanged = Partial<
  Record<keyof RaceClockTakeFormValues, boolean>
>;

/** Everything buildUpdateRaceClockCommand needs, named so a call reads on its own. */
export type UpdateRaceClockCommandInput = {
  /** The form as it stands, already checked by the form's rules. */
  formValues: RaceClockTakeFormValues;
  fieldsTheOperatorChanged: RaceClockFieldsTheOperatorChanged;
  /** The on-air instance's `resolvedData`, unchecked, exactly as the server sent it. */
  raceClockDataOnAir: unknown;
  /** Date.now() at the press. */
  nowInMilliseconds: number;
};

/**
 * Builds the `takeGraphic` command for "Atualizar". Each changed field comes from the
 * form and each unchanged field from the instance on air. An unchanged time is the time
 * the clock on air shows at `nowInMilliseconds`; a changed time is the typed one. Either
 * way `nowInMilliseconds` becomes the clock's new reference moment.
 *
 * If the on-air data cannot be read as race clock data there is nothing to keep, and
 * the command is the same one "Colocar no ar" sends: every field from the form.
 */
export function buildUpdateRaceClockCommand(
  input: UpdateRaceClockCommandInput,
): TakeRaceClockCommand {
  const { formValues, fieldsTheOperatorChanged, nowInMilliseconds } = input;
  const commandFromTheFormAlone = buildTakeRaceClockCommand(formValues, nowInMilliseconds);

  const dataOnAir = readRaceClockDataOnAir(input.raceClockDataOnAir);
  if (dataOnAir === undefined) {
    return commandFromTheFormAlone;
  }
  const dataFromTheForm = commandFromTheFormAlone.data;

  // If only the clock mode was changed, the number on screen is kept and only its
  // direction changes: 27:34 elapsed becomes 27:34 remaining. Nothing better can be
  // guessed without knowing how long the session lasts.
  const timeShownOnAir = findTimeShownOnAir(dataOnAir, nowInMilliseconds);

  // One line per field, written out, so each can be read against the rule: changed in
  // the form, or else as it is on air.
  const data: RaceClockData = {
    sessionName:
      fieldsTheOperatorChanged.sessionName === true
        ? dataFromTheForm.sessionName
        : dataOnAir.sessionName,
    state: fieldsTheOperatorChanged.state === true ? dataFromTheForm.state : dataOnAir.state,
    clockMode:
      fieldsTheOperatorChanged.clockMode === true ? dataFromTheForm.clockMode : dataOnAir.clockMode,
    referenceTimeMs:
      fieldsTheOperatorChanged.referenceTime === true
        ? dataFromTheForm.referenceTimeMs
        : timeShownOnAir,
    // Always the press: both a typed time and a carried-forward time are "the time at
    // this moment". Keeping the old reference moment would count the time since it twice.
    referenceWallClockMs: nowInMilliseconds,
    running:
      fieldsTheOperatorChanged.running === true ? dataFromTheForm.running : dataOnAir.running,
  };
  // The graphic refuses a null or unknown field, so absent laps are left out entirely:
  // erased in the form if the operator changed them, or simply not on air.
  const laps =
    fieldsTheOperatorChanged.lapsCompletedByLeader === true
      ? dataFromTheForm.lapsCompletedByLeader
      : dataOnAir.lapsCompletedByLeader;
  if (laps !== undefined) {
    data.lapsCompletedByLeader = laps;
  }

  return { ...commandFromTheFormAlone, data };
}
