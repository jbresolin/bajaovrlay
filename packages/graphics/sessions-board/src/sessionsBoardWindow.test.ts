/**
 * What the sessions board shows at a moment (packages/graphics/sessions-board)
 *
 * What this module is for:
 *   sessionsBoardWindow.ts works out, for a moment, each slot's status (by shared's own
 *   findStatusOfScheduleSlot, never a copy), which slots fit the board (twelve at most) and
 *   the next moment a status changes, which the board's re-check timer waits for.
 *
 * What these tests prove:
 *   - Shared's own table of moments (scheduleSlotStatusScenarios.testSupport.ts) gives the
 *     same statuses through the board: the board cannot drift from the Programação tab.
 *   - Slots are shown by start, whatever the order they come in.
 *   - Twelve slots or fewer are all shown; with twenty the window starts two before the
 *     slot in progress, holds at the list's start and end, with none in progress anchors
 *     on the next to start, and with none in progress or to come holds the last twelve.
 *   - The next change is the earliest start or end still to come, an end being the next
 *     slot's start when a slot has none; none once nothing will change.
 *
 * What these tests deliberately do not cover:
 *   - The timer and the crossfade on air; sessions-board.test.ts.
 */
import {
  atSaturdayBrasiliaTime,
  buildSaturdaySchedule,
  scheduleSlotStatusScenarios,
} from '@bajaovrlay/shared/scheduleSlotStatusScenarios.testSupport';
import { describe, expect, it } from 'vitest';

import type { SessionsBoardSlot } from './sessionsBoardModel.js';
import {
  findNextStatusChangeAfter,
  listEverySlotWithItsStatusAt,
  listSlotsOnTheBoardAt,
} from './sessionsBoardWindow.js';

/** Twenty half-hour heats from 08:00 on Saturday, each with no end: "Bateria 1" … "Bateria 20". */
function buildTwentyHeats(): SessionsBoardSlot[] {
  return Array.from({ length: 20 }, (_, index) => ({
    slotId: `bateria-${String(index + 1)}`,
    sessionName: `Bateria ${String(index + 1)}`,
    sessionKind: 'speed',
    startsAtMs: atSaturdayBrasiliaTime('08:00') + index * 30 * 60_000,
  }));
}

/** The names of the slots a list of slots on the board holds, in order. */
function readNames(slotsOnTheBoard: Array<{ slot: SessionsBoardSlot }>): string[] {
  return slotsOnTheBoard.map((entry) => entry.slot.sessionName);
}

describe('the status of each slot, by shared’s own table', () => {
  it.each(scheduleSlotStatusScenarios)('$name', ({ slotId, moment, expected }) => {
    // Arrange: Saturday's schedule, as shared's own test reads it.
    const schedule = buildSaturdaySchedule();

    // Act: list every slot with its status at that moment, as the board does.
    const slotsWithStatus = listEverySlotWithItsStatusAt(schedule, atSaturdayBrasiliaTime(moment));

    // Assert: the slot of this row has the status shared's rule gives it.
    const slotOfTheRow = slotsWithStatus.find((entry) => entry.slot.slotId === slotId);
    expect(slotOfTheRow?.status, `the board's status of ${slotId} at ${moment}`).toBe(expected);
  });

  it('shows the slots by start, whatever the order they come in', () => {
    // Arrange: Saturday's schedule, backwards.
    const scheduleBackwards = buildSaturdaySchedule().reverse();

    // Act: list them at 09:00.
    const slotsWithStatus = listEverySlotWithItsStatusAt(
      scheduleBackwards,
      atSaturdayBrasiliaTime('09:00'),
    );

    // Assert: the briefing, the enduro, the awards.
    expect(readNames(slotsWithStatus), 'by start').toEqual([
      'Briefing das equipes',
      'Enduro de Resistência',
      'Premiação',
    ]);
  });
});

describe('listSlotsOnTheBoardAt', () => {
  it('shows every slot when there are twelve or fewer', () => {
    // Arrange: Saturday's three slots.
    const schedule = buildSaturdaySchedule();

    // Act: list what the board shows at 12:00.
    const slotsOnTheBoard = listSlotsOnTheBoardAt(schedule, atSaturdayBrasiliaTime('12:00'));

    // Assert: all three.
    expect(slotsOnTheBoard.length, 'nothing left out').toBe(3);
  });

  const windowScenarios = [
    // Bateria 8 runs 11:30–12:00: the window starts two before it, with Bateria 6.
    {
      name: 'starts two slots before the slot in progress',
      moment: '11:40',
      expectedFirst: 'Bateria 6',
      expectedLast: 'Bateria 17',
    },
    // Bateria 1 runs first: the window cannot start before the list does.
    {
      name: 'holds at the start of the list',
      moment: '08:10',
      expectedFirst: 'Bateria 1',
      expectedLast: 'Bateria 12',
    },
    // Bateria 19 runs near the end: the window holds the last twelve.
    {
      name: 'holds at the end of the list',
      moment: '17:10',
      expectedFirst: 'Bateria 9',
      expectedLast: 'Bateria 20',
    },
    // Before the day starts nothing runs: the window anchors on the next to start.
    {
      name: 'anchors on the next slot before the day starts',
      moment: '07:00',
      expectedFirst: 'Bateria 1',
      expectedLast: 'Bateria 12',
    },
  ];

  it.each(windowScenarios)('$name', ({ moment, expectedFirst, expectedLast }) => {
    // Arrange: twenty heats, more than the board holds.
    const heats = buildTwentyHeats();

    // Act: list what the board shows at that moment.
    const slotsOnTheBoard = listSlotsOnTheBoardAt(heats, atSaturdayBrasiliaTime(moment));

    // Assert: twelve, from the expected first to the expected last.
    const names = readNames(slotsOnTheBoard);
    expect(names.length, 'the board holds twelve').toBe(12);
    expect([names[0], names.at(-1)], `the window at ${moment}`).toEqual([
      expectedFirst,
      expectedLast,
    ]);
  });
  it('holds the last twelve once every slot has finished, none in progress or to come', () => {
    // Arrange: the twenty heats, the last one given an end at 18:00, so that from then on
    // nothing runs and nothing is still to start.
    const heats = buildTwentyHeats();
    const lastHeat = heats[heats.length - 1];
    if (lastHeat === undefined) {
      throw new Error('the twenty heats have a last one');
    }
    lastHeat.endsAtMs = atSaturdayBrasiliaTime('18:00');

    // Act: list what the board shows at 19:00, after the day.
    const slotsOnTheBoard = listSlotsOnTheBoardAt(heats, atSaturdayBrasiliaTime('19:00'));

    // Assert: the last twelve, every one finished.
    const names = readNames(slotsOnTheBoard);
    expect([names[0], names.at(-1)], 'the window after the day').toEqual([
      'Bateria 9',
      'Bateria 20',
    ]);
    expect(new Set(slotsOnTheBoard.map((entry) => entry.status)), 'all twelve finished').toEqual(
      new Set(['finished']),
    );
  });
});

describe('findNextStatusChangeAfter', () => {
  const changeScenarios = [
    // At 09:00 the briefing runs; it ends when the enduro starts, at 10:00.
    { name: 'is the enduro’s start while the briefing runs', moment: '09:00', expected: '10:00' },
    // During the enduro, its own end comes first.
    { name: 'is the enduro’s end during the enduro', moment: '12:00', expected: '14:00' },
    // Between the enduro and the awards, the awards' start.
    { name: 'is the awards’ start in the afternoon gap', moment: '15:00', expected: '18:00' },
    // The awards run last with no end: nothing will change.
    { name: 'is none once the last slot runs with no end', moment: '19:00', expected: undefined },
  ];

  it.each(changeScenarios)('$name', ({ moment, expected }) => {
    // Arrange: Saturday's schedule.
    const schedule = buildSaturdaySchedule();

    // Act: find the next change after the moment.
    const nextChangeMs = findNextStatusChangeAfter(schedule, atSaturdayBrasiliaTime(moment));

    // Assert: the expected moment, or none.
    const expectedMs = expected === undefined ? undefined : atSaturdayBrasiliaTime(expected);
    expect(nextChangeMs, `the next change after ${moment}`).toBe(expectedMs);
  });
});
