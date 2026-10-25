// Test support: the table of moments that pins down findStatusOfScheduleSlot, the one rule
// the Programação tab and the sessions board (BAJAOVRLAY-46) both read a slot's status
// with. Shared's own test runs it, and the sessions board's model test runs the same rows
// through the board, so the graphic can never follow a copy of the rule. Plain data, no
// import, so a graphic's test can import it from `@bajaovrlay/shared/scheduleSlotStatusScenarios.testSupport`.

/** Saturday 14 November 2026 at a time of day in Brasília (UTC−3), in ms. */
export function atSaturdayBrasiliaTime(hoursAndMinutes: string): number {
  return Date.parse(`2026-11-14T${hoursAndMinutes}:00.000-03:00`);
}

/** One slot of the table's schedule: its id, session, kind, start and (maybe) end. */
export type ScheduleSlotOfTheScenarios = {
  slotId: string;
  sessionName: string;
  sessionKind: 'enduro' | 'other';
  startsAtMs: number;
  endsAtMs?: number;
};

/** Saturday's schedule: the briefing (no end), the enduro (10:00–14:00), the awards (no end). */
export function buildSaturdaySchedule(): ScheduleSlotOfTheScenarios[] {
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

/**
 * The moments of the table: which slot, at what time of Saturday, and the status the rule
 * must give. Each row says why it exists.
 */
export const scheduleSlotStatusScenarios: Array<{
  name: string;
  slotId: string;
  moment: string;
  expected: 'finished' | 'inProgress' | 'upcoming';
}> = [
  // Before the start, the enduro is what comes next.
  {
    name: 'the enduro is upcoming at 09:59',
    slotId: 'enduro',
    moment: '09:59',
    expected: 'upcoming',
  },
  // The start itself already counts: the green flag drops at 10:00.
  {
    name: 'the enduro is in progress at 10:00 sharp',
    slotId: 'enduro',
    moment: '10:00',
    expected: 'inProgress',
  },
  // In the middle of the race.
  {
    name: 'the enduro is in progress at 12:30',
    slotId: 'enduro',
    moment: '12:30',
    expected: 'inProgress',
  },
  // The end itself is over: at 14:00 the checkered flag is out.
  {
    name: 'the enduro is finished at 14:00 sharp',
    slotId: 'enduro',
    moment: '14:00',
    expected: 'finished',
  },
  // The briefing has no end: it runs until something else starts.
  {
    name: 'the briefing is in progress at 09:00',
    slotId: 'briefing',
    moment: '09:00',
    expected: 'inProgress',
  },
  // The enduro starting closes the briefing, whatever it said about its end.
  {
    name: 'the briefing is finished once the enduro starts',
    slotId: 'briefing',
    moment: '10:00',
    expected: 'finished',
  },
  // The last slot with no end stays in progress: nothing says it ended.
  {
    name: 'the awards, last and with no end, are in progress at 23:00',
    slotId: 'premiacao',
    moment: '23:00',
    expected: 'inProgress',
  },
];
