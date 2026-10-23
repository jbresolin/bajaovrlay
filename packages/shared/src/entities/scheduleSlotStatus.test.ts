/**
 * What the schedule says now: concluída, em andamento, a seguir (packages/shared)
 *
 * What this module is for:
 *   A schedule slot stores when it starts and, when known, when it ends. Its status is
 *   never stored: it is worked out from a moment every time it is read, so it cannot go
 *   stale when nobody edits the schedule (BAJAOVRLAY-19). The Programação tab and any
 *   later graphic read the same function.
 *
 * What these tests prove:
 *   - A slot is "a seguir" before its start, "em andamento" from its start (that very
 *     millisecond included) until its end, and "concluída" from its end on.
 *   - A slot with no end is in progress until the next slot of the day starts, and the
 *     last slot with no end stays in progress.
 *   - Each status has its pt-BR label.
 *
 * What these tests deliberately do not cover:
 *   - Which clock the page reads (the server-aligned clock); the Programação tab's tests.
 */
import { describe, expect, it } from 'vitest';

import type { ScheduleSlot } from './scheduleSlot.js';
import { findStatusOfScheduleSlot, labelOfScheduleSlotStatus } from './scheduleSlotStatus.js';

/** Saturday 14 November 2026 at a time of day in Brasília (UTC−3), in ms. */
function atSaturdayBrasiliaTime(hoursAndMinutes: string): number {
  return Date.parse(`2026-11-14T${hoursAndMinutes}:00.000-03:00`);
}

/** Saturday's schedule: the briefing (no end), the enduro (10:00–14:00), the awards (no end). */
function buildSaturdaySchedule(): ScheduleSlot[] {
  return [
    {
      slotId: 'briefing',
      sessionName: 'Briefing das equipes',
      sessionKind: 'other',
      startsAtMs: atSaturdayBrasiliaTime('08:00'),
    },
    {
      slotId: 'enduro',
      sessionName: 'Enduro de Resistência',
      sessionKind: 'enduro',
      startsAtMs: atSaturdayBrasiliaTime('10:00'),
      endsAtMs: atSaturdayBrasiliaTime('14:00'),
    },
    {
      slotId: 'premiacao',
      sessionName: 'Premiação',
      sessionKind: 'other',
      startsAtMs: atSaturdayBrasiliaTime('18:00'),
    },
  ];
}

describe('findStatusOfScheduleSlot', () => {
  const momentsOfTheEnduro = [
    // Before the start, the enduro is what comes next.
    { name: 'the enduro is upcoming at 09:59', moment: '09:59', expected: 'upcoming' },
    // The start itself already counts: the green flag drops at 10:00.
    { name: 'the enduro is in progress at 10:00 sharp', moment: '10:00', expected: 'inProgress' },
    // In the middle of the race.
    { name: 'the enduro is in progress at 12:30', moment: '12:30', expected: 'inProgress' },
    // The end itself is over: at 14:00 the checkered flag is out.
    { name: 'the enduro is finished at 14:00 sharp', moment: '14:00', expected: 'finished' },
  ];

  it.each(momentsOfTheEnduro)('$name', ({ moment, expected }) => {
    // Arrange: Saturday's schedule and the enduro in it.
    const schedule = buildSaturdaySchedule();
    const enduro = schedule[1] as ScheduleSlot;

    // Act: ask what the enduro is at that moment.
    const status = findStatusOfScheduleSlot(enduro, schedule, atSaturdayBrasiliaTime(moment));

    // Assert: the status the Programação tab must show.
    expect(status, `the enduro's status at ${moment}`).toBe(expected);
  });

  const momentsOfTheBriefing = [
    // The briefing has no end: it runs until something else starts.
    { name: 'the briefing is in progress at 09:00', moment: '09:00', expected: 'inProgress' },
    // The enduro starting closes the briefing, whatever it said about its end.
    {
      name: 'the briefing is finished once the enduro starts',
      moment: '10:00',
      expected: 'finished',
    },
  ];

  it.each(momentsOfTheBriefing)('$name', ({ moment, expected }) => {
    // Arrange: Saturday's schedule and the briefing, which has no end.
    const schedule = buildSaturdaySchedule();
    const briefing = schedule[0] as ScheduleSlot;

    // Act: ask what the briefing is at that moment.
    const status = findStatusOfScheduleSlot(briefing, schedule, atSaturdayBrasiliaTime(moment));

    // Assert: the status the next slot's start decides.
    expect(status, `the briefing's status at ${moment}`).toBe(expected);
  });

  it('keeps the last slot with no end in progress', () => {
    // Arrange: the awards, the last slot of the day, with no end.
    const schedule = buildSaturdaySchedule();
    const awards = schedule[2] as ScheduleSlot;

    // Act: ask at 23:00, long after it started.
    const status = findStatusOfScheduleSlot(awards, schedule, atSaturdayBrasiliaTime('23:00'));

    // Assert: still in progress; nothing says it ended, so nothing is guessed.
    expect(status, 'a last slot with no end has no end').toBe('inProgress');
  });

  it('does not depend on the order the slots are listed in', () => {
    // Arrange: the same schedule, listed backwards.
    const scheduleBackwards = buildSaturdaySchedule().reverse();
    const briefing = scheduleBackwards[2] as ScheduleSlot;

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
