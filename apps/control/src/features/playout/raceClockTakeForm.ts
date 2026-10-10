/**
 * Everything about the race clock take form that is not drawing: its values, its rules
 * with their pt-BR messages, the mm:ss conversion and the command built from it.
 *
 * The rules mirror by hand the data schema in
 * packages/graphics/race-clock/race-clock.ograf.json. That is a deliberate M0 shortcut:
 * BAJAOVRLAY-14 generates forms from the manifest and replaces this file. Until then a
 * change to the manifest's fields must be repeated here.
 */
import { z } from 'zod';

import { ptBR } from '@/i18n/ptBR';

/** The graphic this form takes; its id is its folder name under packages/graphics. */
export const raceClockGraphicId = 'race-clock';

/** The layer the race clock goes on (one of the layers the server seeds). */
export const clockLayerId = 'clock';

/** The six flag states of the race clock, in the order a session goes through them. */
export const flagStates = ['pre', 'green', 'yellow', 'red', 'checkered', 'finished'] as const;

/** Whether the clock counts time since the start or time left until the end. */
export const clockModes = ['elapsed', 'remaining'] as const;

export type FlagState = (typeof flagStates)[number];
export type ClockMode = (typeof clockModes)[number];

/**
 * The form as the operator edits it. The two typed fields stay text until the take:
 * `referenceTime` is "mm:ss", and `lapsCompletedByLeader` is digits or empty for "do
 * not show laps".
 */
export type RaceClockTakeFormValues = {
  sessionName: string;
  state: FlagState;
  clockMode: ClockMode;
  running: boolean;
  referenceTime: string;
  lapsCompletedByLeader: string;
};

/** The values the form opens with: the defaults the manifest declares. */
export const defaultRaceClockTakeFormValues: RaceClockTakeFormValues = {
  sessionName: ptBR.playout.defaultSessionName,
  state: 'pre',
  clockMode: 'elapsed',
  running: false,
  referenceTime: '0:00',
  lapsCompletedByLeader: '',
};

/** One pt-BR message per field that has a problem; an empty object means "all good". */
export type RaceClockTakeFormErrors = Partial<Record<keyof RaceClockTakeFormValues, string>>;

/** The data the race clock graphic receives, exactly as its manifest describes it. */
export type RaceClockData = {
  sessionName: string;
  state: FlagState;
  clockMode: ClockMode;
  referenceTimeMs: number;
  referenceWallClockMs: number;
  running: boolean;
  lapsCompletedByLeader?: number;
};

/** The `takeGraphic` command that puts the race clock on the clock layer. */
export type TakeRaceClockCommand = {
  type: 'takeGraphic';
  graphicId: typeof raceClockGraphicId;
  layerId: typeof clockLayerId;
  data: RaceClockData;
};

// Minutes may have up to three digits so the four-hour endurance race fits (240:00).
// Seconds always have two digits, from 00 to 59. There is no hours part.
const minutesAndSecondsPattern = /^(\d{1,3}):([0-5]\d)$/;
const millisecondsPerSecond = 1_000;
const secondsPerMinute = 60;

/**
 * Converts text typed as mm:ss ("12:34") into milliseconds. Returns undefined when the
 * text is not in that shape, which is how the form knows to show its format message.
 */
export function convertMinutesAndSecondsToMilliseconds(text: string): number | undefined {
  const match = minutesAndSecondsPattern.exec(text.trim());
  if (match === null) {
    return undefined;
  }
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return (minutes * secondsPerMinute + seconds) * millisecondsPerSecond;
}

const fieldErrorMessages = ptBR.playout.fieldErrors;

// The form is stricter than the manifest in one place: the manifest allows an empty
// session name, the form does not, because an empty title band on air is a mistake.
const RaceClockTakeFormSchema = z.object({
  sessionName: z
    .string({ error: fieldErrorMessages.sessionNameMissing })
    .trim()
    .min(1, { error: fieldErrorMessages.sessionNameMissing }),
  state: z.enum(flagStates, { error: fieldErrorMessages.stateMissing }),
  clockMode: z.enum(clockModes, { error: fieldErrorMessages.clockModeMissing }),
  running: z.boolean({ error: fieldErrorMessages.runningMissing }),
  referenceTime: z
    .string({ error: fieldErrorMessages.referenceTimeMissing })
    .trim()
    .min(1, { error: fieldErrorMessages.referenceTimeMissing })
    .refine((text) => convertMinutesAndSecondsToMilliseconds(text) !== undefined, {
      error: fieldErrorMessages.referenceTimeInvalid,
    }),
  // Digits only, or nothing at all: the laps are optional.
  lapsCompletedByLeader: z
    .string({ error: fieldErrorMessages.lapsCompletedByLeaderInvalid })
    .trim()
    .regex(/^\d*$/, { error: fieldErrorMessages.lapsCompletedByLeaderInvalid }),
});

/**
 * Checks the form and returns one pt-BR message for each field that has a problem.
 * Every wrong field is reported at once; for a field with several problems only the
 * first is kept (an empty time is "missing", not also "badly formatted").
 */
export function findRaceClockTakeFormErrors(formValues: unknown): RaceClockTakeFormErrors {
  const checkedForm = RaceClockTakeFormSchema.safeParse(formValues);
  if (checkedForm.success) {
    return {};
  }

  const fieldErrors: RaceClockTakeFormErrors = {};
  for (const issue of checkedForm.error.issues) {
    const fieldName = issue.path[0] as keyof RaceClockTakeFormValues;
    const fieldAlreadyHasAMessage = fieldErrors[fieldName] !== undefined;
    if (!fieldAlreadyHasAMessage) {
      fieldErrors[fieldName] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * Builds the `takeGraphic` command from form values that passed
 * findRaceClockTakeFormErrors. `nowInMilliseconds` (Date.now() at the press) becomes the
 * clock's reference moment: the graphic computes the running time from it on every frame.
 */
export function buildTakeRaceClockCommand(
  formValues: RaceClockTakeFormValues,
  nowInMilliseconds: number,
): TakeRaceClockCommand {
  const referenceTimeMs = convertMinutesAndSecondsToMilliseconds(formValues.referenceTime);
  if (referenceTimeMs === undefined) {
    throw new Error(
      'buildTakeRaceClockCommand needs form values that passed findRaceClockTakeFormErrors',
    );
  }

  const data: RaceClockData = {
    sessionName: formValues.sessionName.trim(),
    state: formValues.state,
    clockMode: formValues.clockMode,
    referenceTimeMs,
    referenceWallClockMs: nowInMilliseconds,
    running: formValues.running,
  };
  // The graphic refuses a null or unknown field, so blank laps are left out entirely.
  const lapsText = formValues.lapsCompletedByLeader.trim();
  if (lapsText !== '') {
    data.lapsCompletedByLeader = Number(lapsText);
  }

  return { type: 'takeGraphic', graphicId: raceClockGraphicId, layerId: clockLayerId, data };
}
