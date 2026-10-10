/**
 * What "Atualizar" sends while the race clock is on air: an `updateInstanceData` command
 * for the instance on air, holding only the fields the operator changed.
 *
 * The server lays those fields over the data it holds for the instance and keeps the
 * instance's id, so the graphic changes in place instead of leaving the screen and
 * coming back. A flag change in the middle of a race then sends the flag and nothing
 * else: it cannot reset the clock, stop it or rename the session.
 */
import { findTimeShownOnAir, readRaceClockDataOnAir } from './raceClockDataOnAir';
import {
  buildTakeRaceClockCommand,
  type RaceClockData,
  type RaceClockTakeFormValues,
} from './raceClockTakeForm';

/**
 * Which form fields the operator changed since the form was last filled. This is the
 * shape of react-hook-form's `formState.dirtyFields`: a changed field is `true`, and an
 * unchanged one is absent or `false`.
 */
export type RaceClockFieldsTheOperatorChanged = Partial<
  Record<keyof RaceClockTakeFormValues, boolean>
>;

/** The `updateInstanceData` command that changes the race clock on air in place. */
export type UpdateRaceClockInstanceCommand = {
  type: 'updateInstanceData';
  instanceId: string;
  /** Only the fields that change; a field that is not here stays as it is on air. */
  data: Partial<RaceClockData>;
};

/** Everything buildRaceClockInstanceUpdate needs, named so a call reads on its own. */
export type RaceClockInstanceUpdateInput = {
  /** The id of the race clock instance on air, which the server keeps through updates. */
  instanceId: string;
  /** The form as it stands, already checked by the form's rules. */
  formValues: RaceClockTakeFormValues;
  fieldsTheOperatorChanged: RaceClockFieldsTheOperatorChanged;
  /** The on-air instance's `resolvedData`, unchecked, exactly as the server sent it. */
  raceClockDataOnAir: unknown;
  /** Date.now() at the press. */
  nowInMilliseconds: number;
};

/**
 * What a press of "Atualizar" comes to. Either there is a command to send, or there is a
 * named reason why nothing is sent, which the panel turns into what the operator sees.
 */
export type RaceClockInstanceUpdate =
  | { outcome: 'sendCommand'; command: UpdateRaceClockInstanceCommand }
  | { outcome: 'nothingChanged' }
  | { outcome: 'lapsCannotBeRemoved' };

/**
 * Works out what "Atualizar" sends. Each field the operator changed goes into the
 * command as the form has it; a field left alone is left out, so it stays as it is on
 * air. If the on-air data cannot be read as race clock data, the form was never filled
 * from it and "changed" means nothing, so every field of the form is sent.
 */
export function buildRaceClockInstanceUpdate(
  input: RaceClockInstanceUpdateInput,
): RaceClockInstanceUpdate {
  const { instanceId, formValues, fieldsTheOperatorChanged, nowInMilliseconds } = input;
  const dataFromTheForm = buildTakeRaceClockCommand(formValues, nowInMilliseconds).data;

  const dataOnAir = readRaceClockDataOnAir(input.raceClockDataOnAir);
  if (dataOnAir === undefined) {
    return {
      outcome: 'sendCommand',
      command: { type: 'updateInstanceData', instanceId, data: dataFromTheForm },
    };
  }

  // The server lays the sent fields over what is on air, so a field can be changed but
  // never taken away: laps left out of the command stay on screen, and the graphic
  // refuses a null. Rather than send the other changes and leave the laps on air as if
  // all had worked, nothing is sent and the panel tells the operator what to press.
  // That applies only while laps are on air. An emptied field can still count as changed
  // when there are none: the operator erased laps, then another operator put a clock
  // without laps on air, and react-hook-form keeps the field marked. Then there is
  // nothing to remove, and the empty field is simply left out further down.
  const wereTheLapsChanged = fieldsTheOperatorChanged.lapsCompletedByLeader === true;
  const isTheLapsFieldEmpty = dataFromTheForm.lapsCompletedByLeader === undefined;
  const areLapsOnAir = dataOnAir.lapsCompletedByLeader !== undefined;
  const wereLapsOnAirErased = wereTheLapsChanged && isTheLapsFieldEmpty && areLapsOnAir;
  if (wereLapsOnAirErased) {
    return { outcome: 'lapsCannotBeRemoved' };
  }

  // One step per field, written out, so each can be read against the rule: in the
  // command if the operator changed it, otherwise absent.
  const changedData: Partial<RaceClockData> = {};
  if (fieldsTheOperatorChanged.sessionName === true) {
    changedData.sessionName = dataFromTheForm.sessionName;
  }
  if (fieldsTheOperatorChanged.state === true) {
    changedData.state = dataFromTheForm.state;
  }
  if (fieldsTheOperatorChanged.clockMode === true) {
    changedData.clockMode = dataFromTheForm.clockMode;
  }
  if (fieldsTheOperatorChanged.running === true) {
    changedData.running = dataFromTheForm.running;
  }
  if (wereTheLapsChanged && dataFromTheForm.lapsCompletedByLeader !== undefined) {
    changedData.lapsCompletedByLeader = dataFromTheForm.lapsCompletedByLeader;
  }

  // The graphic works out the time on screen from three fields together: the reference
  // time, the moment it was true, and whether the clock runs (and in which direction).
  // Changing "running" or the mode alone would make it count from the old reference: a
  // clock stopped at 27:34 would jump back to the 12:34 it was taken with. So whenever
  // the operator changed the time, the mode or "running", both time fields are sent: the
  // typed time, or else the time the clock on air shows at the press, and the press as
  // the moment it is true. A changed mode therefore keeps the number on screen and turns
  // only its direction. When none of the three changed, neither field is sent and the
  // clock on air goes on counting from its own reference, untouched.
  const wasTheTimeTyped = fieldsTheOperatorChanged.referenceTime === true;
  const wasTheClockItselfChanged =
    wasTheTimeTyped ||
    fieldsTheOperatorChanged.clockMode === true ||
    fieldsTheOperatorChanged.running === true;
  if (wasTheClockItselfChanged) {
    changedData.referenceTimeMs = wasTheTimeTyped
      ? dataFromTheForm.referenceTimeMs
      : findTimeShownOnAir(dataOnAir, nowInMilliseconds);
    changedData.referenceWallClockMs = nowInMilliseconds;
  }

  const numberOfChangedFields = Object.keys(changedData).length;
  if (numberOfChangedFields === 0) {
    return { outcome: 'nothingChanged' };
  }

  return {
    outcome: 'sendCommand',
    command: { type: 'updateInstanceData', instanceId, data: changedData },
  };
}
