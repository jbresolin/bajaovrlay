/**
 * The status of a schedule slot at a moment: the one rule the Programação tab and the
 * sessions board (BAJAOVRLAY-46) read it with. It imports nothing on purpose: the graphic
 * bundles it from `@bajaovrlay/shared/scheduleSlotStatus`, and every dependency there is
 * a frame-drop risk in OBS. Its pt-BR word is scheduleSlotStatusLabel.ts's.
 */

/** What the schedule says about a slot at a moment; never stored. */
export type ScheduleSlotStatus = 'finished' | 'inProgress' | 'upcoming';

/**
 * The two moments of a slot the rule reads: a record of the library and an item of an
 * entity list both have them, so either can be passed.
 */
export type ScheduleSlotTiming = { startsAtMs: number; endsAtMs?: number | undefined };

/**
 * Works out what a slot is at a moment: "a seguir" before its start, "em andamento" from
 * its start until its end, "concluída" from its end on. A slot with no end runs until
 * the next slot of the schedule starts (the next by start time, wherever it is listed);
 * the last slot with no end stays in progress, because nothing says it ended.
 * Read at every draw from a clock (the page's server-aligned clock), never stored, so it
 * cannot go stale while nobody edits the schedule.
 */
export function findStatusOfScheduleSlot(
  slot: ScheduleSlotTiming,
  slotsOfTheSchedule: ScheduleSlotTiming[],
  momentInMilliseconds: number,
): ScheduleSlotStatus {
  if (momentInMilliseconds < slot.startsAtMs) {
    return 'upcoming';
  }
  const endInMilliseconds = findEndOfScheduleSlot(slot, slotsOfTheSchedule);
  if (endInMilliseconds !== undefined && momentInMilliseconds >= endInMilliseconds) {
    return 'finished';
  }
  return 'inProgress';
}

/**
 * When a slot ends by the rule above: its own end, or else the start of the next slot, or
 * undefined for a last slot with no end. The sessions board books its next re-check at the
 * earliest start or end still to come, so it reads the same ends the rule does.
 */
export function findEndOfScheduleSlot(
  slot: ScheduleSlotTiming,
  slotsOfTheSchedule: ScheduleSlotTiming[],
): number | undefined {
  return slot.endsAtMs ?? findStartOfTheNextSlot(slot, slotsOfTheSchedule);
}

/** The start of the first slot that starts after this one, or undefined when none does. */
function findStartOfTheNextSlot(
  slot: ScheduleSlotTiming,
  slotsOfTheSchedule: ScheduleSlotTiming[],
): number | undefined {
  let earliestLaterStart: number | undefined;
  for (const candidate of slotsOfTheSchedule) {
    const startsLater = candidate.startsAtMs > slot.startsAtMs;
    const isEarlierThanTheBestSoFar =
      earliestLaterStart === undefined || candidate.startsAtMs < earliestLaterStart;
    if (startsLater && isEarlierThanTheBestSoFar) {
      earliestLaterStart = candidate.startsAtMs;
    }
  }
  return earliestLaterStart;
}
