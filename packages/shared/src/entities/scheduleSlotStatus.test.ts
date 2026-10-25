/**
 * What the schedule says now: concluída, em andamento, a seguir (packages/shared)
 *
 * What this module is for:
 *   A schedule slot stores when it starts and, when known, when it ends. Its status is
 *   never stored: it is worked out from a moment every time it is read, so it cannot go
 *   stale when nobody edits the schedule (BAJAOVRLAY-19). The Programação tab and the
 *   sessions board on air (BAJAOVRLAY-46) read the same function, from a module with no
 *   import so the graphic can bundle it.
 *
 * What these tests prove:
 *   - The table of moments (scheduleSlotStatusScenarios.testSupport.ts, which the sessions
 *     board's test runs too): a slot is "a seguir" before its start, "em andamento" from
 *     its start (that very millisecond included) until its end, and "concluída" from its
 *     end on; a slot with no end is in progress until the next slot starts, and the last
 *     slot with no end stays in progress.
 *   - The next slot is found by its start, not by its place in the list.
 *   - A slot's end by the rule: its own, the next start, or none for the last.
 *   - Each status has its pt-BR label.
 *
 * What these tests deliberately do not cover:
 *   - Which clock the page reads (the server-aligned clock); the Programação tab's tests.
 */
import { describe, expect, it } from 'vitest';

import { findEndOfScheduleSlot, findStatusOfScheduleSlot } from './scheduleSlotStatus.js';
import { labelOfScheduleSlotStatus } from './scheduleSlotStatusLabel.js';
import {
  atSaturdayBrasiliaTime,
  buildSaturdaySchedule,
  type ScheduleSlotOfTheScenarios,
  scheduleSlotStatusScenarios,
} from './scheduleSlotStatusScenarios.testSupport.js';

/** One slot of Saturday's schedule by its id; a missing id is a bug in the table. */
function findSlotOfSaturday(
  schedule: ScheduleSlotOfTheScenarios[],
  slotId: string,
): ScheduleSlotOfTheScenarios {
  const slot = schedule.find((candidate) => candidate.slotId === slotId);
  if (slot === undefined) {
    throw new Error(`the table names a slot Saturday does not have: ${slotId}`);
  }
  return slot;
}

describe('findStatusOfScheduleSlot', () => {
  it.each(scheduleSlotStatusScenarios)('$name', ({ slotId, moment, expected }) => {
    // Arrange: Saturday's schedule and the slot of this row.
    const schedule = buildSaturdaySchedule();
    const slot = findSlotOfSaturday(schedule, slotId);

    // Act: ask what the slot is at that moment.
    const status = findStatusOfScheduleSlot(slot, schedule, atSaturdayBrasiliaTime(moment));

    // Assert: the status the Programação tab and the board must show.
    expect(status, `the status of ${slotId} at ${moment}`).toBe(expected);
  });

  it('does not depend on the order the slots are listed in', () => {
    // Arrange: the same schedule, listed backwards.
    const scheduleBackwards = buildSaturdaySchedule().reverse();
    const briefing = findSlotOfSaturday(scheduleBackwards, 'briefing');

    // Act: ask about the briefing once the enduro started.
    const status = findStatusOfScheduleSlot(
      briefing,
      scheduleBackwards,
      atSaturdayBrasiliaTime('10:30'),
    );

    // Assert: the next slot is found by its start, not by its place in the list.
    expect(status, 'the next slot is the next one to start').toBe('finished');
  });
});

describe('findEndOfScheduleSlot', () => {
  const ends = [
    // The enduro says when it ends.
    { name: 'gives the enduro its own end', slotId: 'enduro', expected: '14:00' },
    // The briefing ends when the enduro starts.
    { name: 'ends the briefing at the next start', slotId: 'briefing', expected: '10:00' },
    // The awards are last with no end.
    { name: 'gives the last slot with no end no end', slotId: 'premiacao', expected: undefined },
  ];

  it.each(ends)('$name', ({ slotId, expected }) => {
    // Arrange: Saturday's schedule and the slot of this row.
    const schedule = buildSaturdaySchedule();
    const slot = findSlotOfSaturday(schedule, slotId);

    // Act: find its end.
    const end = findEndOfScheduleSlot(slot, schedule);

    // Assert: the moment the rule reads, or none.
    const expectedEnd = expected === undefined ? undefined : atSaturdayBrasiliaTime(expected);
    expect(end, `the end of ${slotId}`).toBe(expectedEnd);
  });
});

describe('labelOfScheduleSlotStatus', () => {
  const labels = [
    // The three words the Programação tab prints next to each slot.
    { name: 'labels a finished slot', status: 'finished' as const, expected: 'concluída' },
    { name: 'labels a slot in progress', status: 'inProgress' as const, expected: 'em andamento' },
    { name: 'labels an upcoming slot', status: 'upcoming' as const, expected: 'a seguir' },
  ];

  it.each(labels)('$name', ({ status, expected }) => {
    // Arrange: the status of this row.

    // Act: read its label.
    const label = labelOfScheduleSlotStatus(status);

    // Assert: the pt-BR word.
    expect(label, 'the label must be the pt-BR word').toBe(expected);
  });
});
