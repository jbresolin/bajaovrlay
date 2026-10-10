/**
 * The race clock data the server holds for the instance on air: reading it safely,
 * working out which time the clock shows right now, and turning it into form values.
 *
 * The panel uses this to fill the form with what is on air, and "Atualizar" uses it for
 * every field the operator did not touch (raceClockUpdateCommand.ts).
 */
import { z } from 'zod';

import { formatMillisecondsAsMinutesAndSeconds } from './minutesAndSeconds';
import {
  clockModes,
  flagStates,
  type RaceClockData,
  type RaceClockTakeFormValues,
} from './raceClockTakeForm';

const millisecondsPerSecond = 1_000;

// The server stores an instance's data as "any object", so it is checked here before
// anything is built on it. The rules repeat the manifest's data schema by hand, as
// raceClockTakeForm.ts does; a field the manifest does not know is dropped. What could
// go wrong: a manifest that gains a field makes this page silently drop it on
// "Atualizar" until the field is added here (BAJAOVRLAY-14 replaces all of this).
const RaceClockDataOnAirSchema = z.object({
  sessionName: z.string(),
  state: z.enum(flagStates),
  clockMode: z.enum(clockModes),
  referenceTimeMs: z.number().min(0),
  referenceWallClockMs: z.number().min(0),
  running: z.boolean(),
  lapsCompletedByLeader: z.number().int().min(0).optional(),
});

/**
 * Reads an on-air instance's `resolvedData` as race clock data. Returns undefined when
 * it is absent or does not follow the manifest, so callers never build on a guess.
 */
export function readRaceClockDataOnAir(resolvedData: unknown): RaceClockData | undefined {
  const checkedData = RaceClockDataOnAirSchema.safeParse(resolvedData);
  if (!checkedData.success) {
    return undefined;
  }

  return checkedData.data;
}

/**
 * The time the clock on air shows at `nowInMilliseconds`, in milliseconds. This is the
 * same sum the graphic does on every frame (clockExtrapolation.ts in the race clock
 * package), repeated here because the control page does not import code from graphics.
 * Nothing checks that the two stay in step; a change there must be repeated here.
 */
export function findTimeShownOnAir(
  raceClockDataOnAir: RaceClockData,
  nowInMilliseconds: number,
): number {
  if (!raceClockDataOnAir.running) {
    return raceClockDataOnAir.referenceTimeMs;
  }

  const timeSinceTheReference = nowInMilliseconds - raceClockDataOnAir.referenceWallClockMs;
  const timeShown =
    raceClockDataOnAir.clockMode === 'elapsed'
      ? raceClockDataOnAir.referenceTimeMs + timeSinceTheReference
      : raceClockDataOnAir.referenceTimeMs - timeSinceTheReference;
  // A countdown that ran out shows zero, and the graphic refuses a negative time.
  return Math.max(0, timeShown);
}

/**
 * The form's values for what is on air at `nowInMilliseconds`: every field as the
 * server holds it, and the time the clock shows at that moment as mm:ss. The text does
 * not tick: it is the time at the moment the form was filled. That is harmless for
 * "Atualizar", which reads an untouched time from the air and not from this text, but
 * "Colocar no ar" sends the text as it stands.
 */
export function buildRaceClockFormValuesFromDataOnAir(
  raceClockDataOnAir: RaceClockData,
  nowInMilliseconds: number,
): RaceClockTakeFormValues {
  const timeShownOnAir = findTimeShownOnAir(raceClockDataOnAir, nowInMilliseconds);
  // The graphic rounds a part of a second down on an elapsed clock and up on a
  // countdown (so a countdown reads 0:00 only at zero). The form shows the same digits.
  const timeAsTheScreenRoundsIt =
    raceClockDataOnAir.clockMode === 'elapsed'
      ? timeShownOnAir
      : Math.ceil(timeShownOnAir / millisecondsPerSecond) * millisecondsPerSecond;

  const lapsOnAir = raceClockDataOnAir.lapsCompletedByLeader;
  return {
    sessionName: raceClockDataOnAir.sessionName,
    state: raceClockDataOnAir.state,
    clockMode: raceClockDataOnAir.clockMode,
    running: raceClockDataOnAir.running,
    referenceTime: formatMillisecondsAsMinutesAndSeconds(timeAsTheScreenRoundsIt),
    lapsCompletedByLeader: lapsOnAir === undefined ? '' : String(lapsOnAir),
  };
}
