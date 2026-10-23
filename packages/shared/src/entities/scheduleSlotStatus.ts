import { ptBREntities } from './ptBREntities.js';
import type { ScheduleSlot } from './scheduleSlot.js';

/** What the schedule says about a slot at a moment; never stored. */
export type ScheduleSlotStatus = 'finished' | 'inProgress' | 'upcoming';

/**
 * Works out what a slot is at a moment: "a seguir" before its start, "em andamento" from
 * its start until its end, "concluída" from its end on. A slot with no end runs until
 * the next slot of the schedule starts (the next by start time, wherever it is listed);
 * the last slot with no end stays in progress, because nothing says it ended.
 * Read at every draw from a clock (the page's server-aligned clock), never stored, so it
 * cannot go stale while nobody edits the schedule.
 */
export function findStatusOfScheduleSlot(
  slot: ScheduleSlot,
  slotsOfTheSchedule: ScheduleSlot[],
  momentInMilliseconds: number,
): ScheduleSlotStatus {
  if (momentInMilliseconds < slot.startsAtMs) {
    return 'upcoming';
  }
  const endInMilliseconds = slot.endsAtMs ?? findStartOfTheNextSlot(slot, slotsOfTheSchedule);
  if (endInMilliseconds !== undefined && momentInMilliseconds >= endInMilliseconds) {
    return 'finished';
  }
  return 'inProgress';
}

/** The start of the first slot that starts after this one, or undefined when none does. */
function findStartOfTheNextSlot(
  slot: ScheduleSlot,
  slotsOfTheSchedule: ScheduleSlot[],
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

/** The pt-BR word for a status: "concluída", "em andamento", "a seguir". */
export function labelOfScheduleSlotStatus(status: ScheduleSlotStatus): string {
  return ptBREntities.scheduleSlotStatusLabels[status];
}
