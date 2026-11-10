import {
  ptBRTriggers,
  type ScheduleSlot,
  type TriggerData,
  type TriggerDayWindow,
  type TriggerScheduleMoment,
} from '@bajaovrlay/shared';

/** The time zone of the server's clock for schedule triggers: the races are in Brazil. */
const timeZoneOfTheSchedule = 'America/Sao_Paulo';

/** One minute, in milliseconds. */
const oneMinuteMs = 60_000;

/** One day, in milliseconds. */
const oneDayMs = 24 * 60 * oneMinuteMs;

/**
 * The most steps of an every-N-minutes grid one look examines: 1000, three and a half days
 * of a 5-minute grid. A look spans a second, or the 5 s a late tick may still fire, so only a
 * step of the clock by days reaches it, and the moments of such a step are only counted for
 * the log, never fired. Without it a step of a year would examine 100 000 steps, each read on
 * the São Paulo calendar, in one go, blocking the event loop with graphics on air.
 */
export const mostIntervalStepsLookedAtOnce = 1000;

/**
 * São Paulo's wall clock, field by field, built once: building an Intl.DateTimeFormat is far
 * slower than formatting with one, and a look may read many moments.
 */
const saoPauloWallClockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: timeZoneOfTheSchedule,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});

/** The stretch of time looked at, and the moment an interval trigger counts from. */
export type ScheduleLook = {
  /** The look holds the moments after this one… */
  afterMs: number;
  /** …up to and including this one. */
  upToMs: number;
  /** The trigger's `intervalCountedFromMs`; undefined fires no interval moment. */
  intervalCountedFromMs: number | undefined;
};

/**
 * The data of every moment of a schedule trigger that falls after `afterMs` and at or
 * before `upToMs`, oldest first. The slots are read as they are now, never as they were
 * when the trigger was set, so a slot moved since is followed. A time of day and an
 * interval have no data; a slot's has `sessao` (its name), `prova` (its kind, in pt-BR) and
 * `inicio` (its start, ms since 1970, so it can fill a countdown's start).
 */
export function listScheduleMomentsDue(
  moment: TriggerScheduleMoment,
  scheduleSlots: ScheduleSlot[],
  look: ScheduleLook,
): TriggerData[] {
  const { afterMs, upToMs } = look;
  if (moment.kind === 'everyMinutes') {
    return listIntervalMomentsDue(moment, look).map(() => ({}));
  }
  if (moment.kind === 'timeOfDay') {
    // Today's moment and yesterday's: a window just after midnight may still hold
    // yesterday's 23:59.
    const momentsToCheck = [
      findMomentOfTimeOfDayInSaoPaulo(upToMs - oneDayMs, moment.timeOfDay),
      findMomentOfTimeOfDayInSaoPaulo(upToMs, moment.timeOfDay),
    ];
    return momentsToCheck
      .filter((momentMs) => momentMs > afterMs && momentMs <= upToMs)
      .map(() => ({}));
  }
  const slotsOfTheTrigger = scheduleSlots
    .filter((slot) => moment.slotId === null || slot.slotId === moment.slotId)
    .map((slot) => ({ slot, momentMs: slot.startsAtMs + moment.minutesFromStart * oneMinuteMs }))
    .filter(({ momentMs }) => momentMs > afterMs && momentMs <= upToMs)
    .sort((first, second) => first.momentMs - second.momentMs);
  return slotsOfTheTrigger.map(({ slot }) => ({
    sessao: slot.sessionName,
    prova: ptBRTriggers.sessionKindLabels[slot.sessionKind],
    inicio: slot.startsAtMs,
  }));
}

/**
 * The moments of an interval trigger in the look, oldest first: the switch-on moment plus
 * one, two, three… times N minutes (the switch-on itself is not one), kept when they fall
 * inside the trigger's part of the day, from at most mostIntervalStepsLookedAtOnce steps
 * after the look's start. Never switched on, it has none.
 */
function listIntervalMomentsDue(
  moment: Extract<TriggerScheduleMoment, { kind: 'everyMinutes' }>,
  look: ScheduleLook,
): number[] {
  const countedFromMs = look.intervalCountedFromMs;
  if (countedFromMs === undefined) {
    return [];
  }
  const stepMs = moment.everyMinutes * oneMinuteMs;
  // The first step after the look's start: a whole number of steps past the switch-on.
  const stepsBeforeTheLook = Math.floor((look.afterMs - countedFromMs) / stepMs);
  const firstStep = Math.max(1, stepsBeforeTheLook + 1);
  const lastStepLookedAt = firstStep + mostIntervalStepsLookedAtOnce - 1;
  const momentsDue: number[] = [];
  for (
    let step = firstStep;
    step <= lastStepLookedAt && countedFromMs + step * stepMs <= look.upToMs;
    step += 1
  ) {
    const momentMs = countedFromMs + step * stepMs;
    const isInsideTheWindow =
      moment.window === null || isMomentInsideTheDayWindow(momentMs, moment.window);
    if (momentMs > look.afterMs && isInsideTheWindow) {
      momentsDue.push(momentMs);
    }
  }
  return momentsDue;
}

/**
 * Whether a moment falls inside a part of the day, both ends included, by its São Paulo
 * wall clock to the minute (13:00:40 is still inside a window that ends at 13:00). A
 * window whose start is after its end crosses midnight: 22:00 to 02:00 holds 23:30 and 01:30.
 */
function isMomentInsideTheDayWindow(momentMs: number, window: TriggerDayWindow): boolean {
  const wallClock = readSaoPauloWallClock(momentMs);
  const minuteOfTheDay = wallClock.hour * 60 + wallClock.minute;
  const fromMinute = readMinuteOfTheDay(window.from);
  const toMinute = readMinuteOfTheDay(window.to);
  if (fromMinute <= toMinute) {
    return minuteOfTheDay >= fromMinute && minuteOfTheDay <= toMinute;
  }
  return minuteOfTheDay >= fromMinute || minuteOfTheDay <= toMinute;
}

/** The minute of the day of an "HH:MM": 0 for 00:00, 1439 for 23:59. */
function readMinuteOfTheDay(timeOfDay: string): number {
  const [hoursText = '0', minutesText = '0'] = timeOfDay.split(':');
  return Number(hoursText) * 60 + Number(minutesText);
}

/**
 * The moment (ms since 1970) of a time of day, "HH:MM", on the São Paulo calendar day
 * that holds `dayOfMs`. The wall time is first read as if it were UTC, then moved by the
 * zone's offset at that moment, which Intl works out from the zone's own rules. Brazil
 * has kept one offset all year since 2019; on a day the offset changed, a time inside the
 * skipped or repeated hour would be off by that hour.
 */
export function findMomentOfTimeOfDayInSaoPaulo(dayOfMs: number, timeOfDay: string): number {
  const calendarDay = readSaoPauloWallClock(dayOfMs);
  const [hoursText = '0', minutesText = '0'] = timeOfDay.split(':');
  const wallTimeReadAsUtcMs = Date.UTC(
    calendarDay.year,
    calendarDay.month - 1,
    calendarDay.day,
    Number(hoursText),
    Number(minutesText),
  );
  const offsetMs = findOffsetOfSaoPauloAt(wallTimeReadAsUtcMs);
  return wallTimeReadAsUtcMs - offsetMs;
}

/** São Paulo's wall clock minus UTC at a moment, in ms (−3 h, as ms, all year now). */
function findOffsetOfSaoPauloAt(momentMs: number): number {
  const wallClock = readSaoPauloWallClock(momentMs);
  const wallClockReadAsUtcMs = Date.UTC(
    wallClock.year,
    wallClock.month - 1,
    wallClock.day,
    wallClock.hour,
    wallClock.minute,
    wallClock.second,
  );
  const momentToTheSecondMs = Math.floor(momentMs / 1000) * 1000;
  return wallClockReadAsUtcMs - momentToTheSecondMs;
}

/** The São Paulo wall clock at a moment, field by field. */
function readSaoPauloWallClock(momentMs: number) {
  const parts = saoPauloWallClockFormatter.formatToParts(new Date(momentMs));
  const readPart = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  return {
    year: readPart('year'),
    month: readPart('month'),
    day: readPart('day'),
    hour: readPart('hour'),
    minute: readPart('minute'),
    second: readPart('second'),
  };
}

/**
 * Whether a look this long at this moment examines fewer steps than it spans, so a count of
 * its moments is cut at the cap: only an every-N-minutes grid can be, after a step of days.
 */
export function isTheCountOfMomentsCapped(moment: TriggerScheduleMoment, lookMs: number): boolean {
  if (moment.kind !== 'everyMinutes') {
    return false;
  }
  const stepsInTheLook = lookMs / (moment.everyMinutes * oneMinuteMs);
  return stepsInTheLook > mostIntervalStepsLookedAtOnce;
}
