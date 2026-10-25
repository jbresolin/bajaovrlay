/**
 * What the sessions board shows at a moment (BAJAOVRLAY-46): each slot with its status by
 * shared's own rule, findStatusOfScheduleSlot (imported from `@bajaovrlay/shared/
 * scheduleSlotStatus`, a module with no import, never a copy), the window of at most
 * twelve slots, and the next moment any status changes, which the board's re-check timer
 * is booked for. Pure: "now" is always handed in.
 *
 * The window: up to twelve slots fit the board (catalogue entry 9). With more, the board
 * shows twelve in a row starting two slots before the slot in progress, so the two just
 * finished stay as context; with none in progress, before the next to start; with none to
 * come, the last twelve. The start is held inside the list, so the window is always full.
 */
import {
  findEndOfScheduleSlot,
  findStatusOfScheduleSlot,
  type ScheduleSlotStatus,
} from '@bajaovrlay/shared/scheduleSlotStatus';

import type { SessionsBoardSlot } from './sessionsBoardModel.js';

/** The most slots the board shows at once. */
export const mostSlotsOnTheBoard = 12;

/** How many slots before the anchor (the one in progress, or the next) the window keeps. */
const slotsKeptBeforeTheAnchor = 2;

/** One slot as the board shows it now: the slot and its status at the moment asked. */
export type SlotOnTheBoard = { slot: SessionsBoardSlot; status: ScheduleSlotStatus };

/** Every slot by start (a stable sort, so slots at one start keep the list's order). */
function sortSlotsByStart(slots: SessionsBoardSlot[]): SessionsBoardSlot[] {
  return [...slots].sort((first, second) => first.startsAtMs - second.startsAtMs);
}

/** Every slot with its status at `nowMs`, by start. */
export function listEverySlotWithItsStatusAt(
  slots: SessionsBoardSlot[],
  nowMs: number,
): SlotOnTheBoard[] {
  return sortSlotsByStart(slots).map((slot) => ({
    slot,
    status: findStatusOfScheduleSlot(slot, slots, nowMs),
  }));
}

/** Where the window is anchored: the first slot in progress, else the next, else the last. */
function findIndexOfTheAnchor(slotsWithStatus: SlotOnTheBoard[]): number {
  const indexInProgress = slotsWithStatus.findIndex((entry) => entry.status === 'inProgress');
  if (indexInProgress !== -1) {
    return indexInProgress;
  }
  const indexOfTheNext = slotsWithStatus.findIndex((entry) => entry.status === 'upcoming');
  if (indexOfTheNext !== -1) {
    return indexOfTheNext;
  }
  return slotsWithStatus.length - 1;
}

/** The slots the board shows at `nowMs`, with their statuses: all of them, or the window. */
export function listSlotsOnTheBoardAt(slots: SessionsBoardSlot[], nowMs: number): SlotOnTheBoard[] {
  const slotsWithStatus = listEverySlotWithItsStatusAt(slots, nowMs);
  if (slotsWithStatus.length <= mostSlotsOnTheBoard) {
    return slotsWithStatus;
  }
  const wantedStart = findIndexOfTheAnchor(slotsWithStatus) - slotsKeptBeforeTheAnchor;
  const lastPossibleStart = slotsWithStatus.length - mostSlotsOnTheBoard;
  const windowStart = Math.min(Math.max(wantedStart, 0), lastPossibleStart);
  return slotsWithStatus.slice(windowStart, windowStart + mostSlotsOnTheBoard);
}

/**
 * The next moment after `nowMs` at which some slot's status changes: the earliest start or
 * end (its own, or the next slot's start, by the rule) still to come. Undefined when
 * nothing changes any more (every slot finished, or the last one running with no end).
 */
export function findNextStatusChangeAfter(
  slots: SessionsBoardSlot[],
  nowMs: number,
): number | undefined {
  let earliestChangeMs: number | undefined;
  for (const slot of slots) {
    const endMs = findEndOfScheduleSlot(slot, slots);
    for (const momentMs of [slot.startsAtMs, endMs]) {
      const isStillToCome = momentMs !== undefined && momentMs > nowMs;
      const isEarlierThanTheBestSoFar =
        earliestChangeMs === undefined || (momentMs !== undefined && momentMs < earliestChangeMs);
      if (isStillToCome && isEarlierThanTheBestSoFar) {
        earliestChangeMs = momentMs;
      }
    }
  }
  return earliestChangeMs;
}
