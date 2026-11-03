import { z } from 'zod';

/** The shortest time a trigger may wait between two firings: one second. */
const shortestMinimumIntervalMs = 1000;

/** The longest: one hour, longer is surely a typo. */
const longestMinimumIntervalMs = 60 * 60_000;

/** The brief's default time between two firings of the same trigger: 10 s. */
export const defaultTriggerMinimumIntervalMs = 10_000;

/** How far from a slot's start a trigger may be set: twelve hours either way. */
const furthestMinutesFromSlotStart = 12 * 60;

/** The limits of a trigger's minimum interval, for the page's field and the commands. */
export const triggerMinimumIntervalLimitsMs = {
  shortest: shortestMinimumIntervalMs,
  longest: longestMinimumIntervalMs,
};

/** A time of day on a 24-hour clock, two digits each: "07:30", "19:05". */
const timeOfDayPattern = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The kinds of inbox event a `dataEvent` trigger may wait for, in the brief's words.
 * `penalty` is any event that says it is a penalty (detected or typed); `incident` is a
 * detected incident that is not one; `fastestLap` and `leaderChange` are the inbox's own
 * kinds (modules/triggers/dataEventsOfTheInbox.ts on the server reads them).
 */
export const TriggerDataEventKindSchema = z.enum([
  'penalty',
  'fastestLap',
  'leaderChange',
  'incident',
]);

/** One kind of inbox event a trigger may wait for. */
export type TriggerDataEventKind = z.infer<typeof TriggerDataEventKindSchema>;

/**
 * When a schedule trigger fires: a time of day on the server's clock (America/Sao_Paulo),
 * or some minutes before (negative) or after (positive) the start of a Programação slot.
 * `slotId` null means every slot. The slot's start is read at each tick, never copied
 * here, so a slot moved after the trigger was set is followed.
 */
export const TriggerScheduleMomentSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('timeOfDay'),
    timeOfDay: z.string().regex(timeOfDayPattern),
  }),
  z.object({
    kind: z.literal('slotStart'),
    slotId: z.string().min(1).nullable(),
    minutesFromStart: z
      .number()
      .int()
      .min(-furthestMinutesFromSlotStart)
      .max(furthestMinutesFromSlotStart),
  }),
]);

/** One schedule moment after validation. */
export type TriggerScheduleMoment = z.infer<typeof TriggerScheduleMomentSchema>;

/**
 * What a trigger waits for, told apart by `kind`, with its filter:
 * - `obsScene`: the scene on OBS's Program was entered or left (by name, as OBS names it);
 * - `http`: a call to POST /api/v1/triggers/<id>, whose body is the data;
 * - `dataEvent`: an inbox event of one kind was recorded;
 * - `schedule`: a moment of the day or of Programação came.
 */
export const TriggerWhenSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('obsScene'),
    change: z.enum(['entered', 'left']),
    sceneName: z.string().min(1),
  }),
  z.object({ kind: z.literal('http') }),
  z.object({ kind: z.literal('dataEvent'), eventKind: TriggerDataEventKindSchema }),
  z.object({ kind: z.literal('schedule'), moment: TriggerScheduleMomentSchema }),
]);

/** What a trigger waits for, after validation. */
export type TriggerWhen = z.infer<typeof TriggerWhenSchema>;

/**
 * What a firing does: `auto` runs the macro at once (unless another macro is running:
 * then the firing asks), `ask` waits for the operator in the Eventos tab.
 */
export const TriggerModeSchema = z.enum(['auto', 'ask']);

/** One mode of a trigger. */
export type TriggerMode = z.infer<typeof TriggerModeSchema>;

/** A trigger's name, as the page shows it; the same rule for the commands. */
export const TriggerNameSchema = z.string().trim().min(1).max(80);

/** A minimum interval in whole milliseconds, within its limits. */
export const TriggerMinimumIntervalMsSchema = z
  .number()
  .int()
  .min(shortestMinimumIntervalMs)
  .max(longestMinimumIntervalMs);

/**
 * One trigger: its name, whether it is on, what it waits for, the macro it runs, how
 * (auto or ask), and the least time between two of its firings.
 */
export const TriggerSchema = z.object({
  id: z.string().min(1),
  name: TriggerNameSchema,
  isEnabled: z.boolean(),
  when: TriggerWhenSchema,
  macroId: z.string().min(1),
  mode: TriggerModeSchema,
  minimumIntervalMs: TriggerMinimumIntervalMsSchema,
});

/** One trigger after validation. */
export type Trigger = z.infer<typeof TriggerSchema>;

/** The `triggers` slice: every trigger, in the order they were created. Saved. */
export const TriggersSchema = z.array(TriggerSchema);
