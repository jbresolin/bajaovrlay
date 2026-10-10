/**
 * The command "Atualizar" sends while the race clock is on air.
 *
 * There is no update command yet (`updateItemFields` comes in M1), so "Atualizar" is a
 * second `takeGraphic` and the server replaces the instance on the layer. The command is
 * built so that the replacement shows the same time as the clock it replaces: a flag
 * change in the middle of a race must never reset the clock.
 *
 * Trade-off, written here on purpose: the time typed in the form is NOT used by
 * "Atualizar" (unless the on-air data cannot be read). To set the clock to a typed time
 * the operator presses "Colocar no ar" again.
 */
import { z } from 'zod';

import {
  buildTakeRaceClockCommand,
  clockModes,
  type RaceClockTakeFormValues,
  type TakeRaceClockCommand,
} from './raceClockTakeForm';

// Only the four fields that decide which time the clock shows. The server stores an
// instance's data as "any object", so it is checked here before any arithmetic on it.
// Unknown fields are ignored; the rest of the on-air data is not needed.
const ClockReadingOnAirSchema = z.object({
  clockMode: z.enum(clockModes),
  referenceTimeMs: z.number().min(0),
  referenceWallClockMs: z.number().min(0),
  running: z.boolean(),
});

type ClockReadingOnAir = z.infer<typeof ClockReadingOnAirSchema>;

/**
 * The time the clock on air shows at `nowInMilliseconds`, in milliseconds. This is the
 * same sum the graphic does on every frame (clockExtrapolation.ts in the race clock
 * package), repeated here because the control page does not import code from graphics.
 * Nothing checks that the two stay in step; a change there must be repeated here.
 */
function findTimeShownOnAir(clockReading: ClockReadingOnAir, nowInMilliseconds: number): number {
  if (!clockReading.running) {
    return clockReading.referenceTimeMs;
  }

  const timeSinceTheReading = nowInMilliseconds - clockReading.referenceWallClockMs;
  const timeShown =
    clockReading.clockMode === 'elapsed'
      ? clockReading.referenceTimeMs + timeSinceTheReading
      : clockReading.referenceTimeMs - timeSinceTheReading;
  // A countdown that ran out shows zero, and the graphic refuses a negative time.
  return Math.max(0, timeShown);
}

/**
 * Builds the `takeGraphic` command for "Atualizar". Session name, flag, clock mode,
 * running and laps come from the form; the clock's time is the one the instance on air
 * shows at `nowInMilliseconds`, which also becomes the new reference moment.
 *
 * `raceClockDataOnAir` is the on-air instance's `resolvedData`. If it cannot be read as
 * race clock data the command is the same one "Colocar no ar" sends (the typed time).
 */
export function buildUpdateRaceClockCommand(
  formValues: RaceClockTakeFormValues,
  raceClockDataOnAir: unknown,
  nowInMilliseconds: number,
): TakeRaceClockCommand {
  const commandFromTheFormAlone = buildTakeRaceClockCommand(formValues, nowInMilliseconds);

  const clockReadingOnAir = ClockReadingOnAirSchema.safeParse(raceClockDataOnAir);
  if (!clockReadingOnAir.success) {
    return commandFromTheFormAlone;
  }

  // If the form changes the clock mode, the number on screen is kept and only its
  // direction changes: 27:34 elapsed becomes 27:34 remaining. Nothing better can be
  // guessed without knowing how long the session lasts.
  const timeShownOnAir = findTimeShownOnAir(clockReadingOnAir.data, nowInMilliseconds);
  return {
    ...commandFromTheFormAlone,
    data: { ...commandFromTheFormAlone.data, referenceTimeMs: timeShownOnAir },
  };
}
