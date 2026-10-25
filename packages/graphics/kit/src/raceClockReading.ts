/**
 * The race clock's reading, as every graphic with a clock reads it: the race clock's card,
 * and the clock block of the lower strip and the message ticker (BAJAOVRLAY-23). A reading
 * is five fields, the flag and the four the control page and the server know by role
 * (clockMode, clockTime, wallClock, clockRunning); each graphic spreads the field schemas
 * below into its own strict data schema and writes its time with the one function here, so
 * the three show the same text for the same reading at the same moment.
 *
 * The sum and the H:MM:SS text are `@bajaovrlay/shared/clock` (shared with the server and
 * the control page's session card); this module only names them for the graphics.
 */
import {
  computeClockTimeMsAtWallClock,
  formatClockTimeAsHoursMinutesSeconds,
} from '@bajaovrlay/shared/clock';
import { z } from 'zod';

/** The six flag states, in the order a session goes through them. */
export const flagStates = ['pre', 'green', 'yellow', 'red', 'checkered', 'finished'] as const;

/** Whether the clock counts time since the start or time left until the end. */
export const clockModes = ['elapsed', 'remaining'] as const;

export type FlagState = (typeof flagStates)[number];
export type ClockMode = (typeof clockModes)[number];

/**
 * The five fields of a reading as Zod schemas, keyed by the field names every clock
 * graphic's manifest uses. Spread into a graphic's `z.strictObject({...})`; the manifests
 * declare the same fields with their roles, and each graphic's ManifestDataAgreement test
 * keeps the two in step.
 */
export const raceClockReadingFieldSchemas = {
  state: z.enum(flagStates),
  clockMode: z.enum(clockModes),
  referenceTimeMs: z.int().min(0),
  referenceWallClockMs: z.int().min(0),
  running: z.boolean(),
};

/** One reading of the session's clock, with its flag. */
export type RaceClockReading = {
  state: FlagState;
  clockMode: ClockMode;
  referenceTimeMs: number;
  referenceWallClockMs: number;
  running: boolean;
};

/**
 * Writes the clock's H:MM:SS text as it is at `nowWallClockMs`. Pass the server-aligned
 * "now" (`readServerAlignedTimeMs`), never `Date.now()`: the reading was stamped by the
 * server's clock, and the OBS machine's may differ from it.
 */
export function writeRaceClockTimeTextAt(
  reading: RaceClockReading,
  nowWallClockMs: number,
): string {
  const clockTimeMs = computeClockTimeMsAtWallClock(reading, nowWallClockMs);
  return formatClockTimeAsHoursMinutesSeconds(clockTimeMs, reading.clockMode);
}
