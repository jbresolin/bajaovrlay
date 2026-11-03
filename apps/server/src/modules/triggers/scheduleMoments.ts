import {
  ptBRTriggers,
  type ScheduleSlot,
  type TriggerData,
  type TriggerScheduleMoment,
} from '@bajaovrlay/shared';

/** The time zone of the server's clock for schedule triggers: the races are in Brazil. */
const timeZoneOfTheSchedule = 'America/Sao_Paulo';

/** One minute, in milliseconds. */
const oneMinuteMs = 60_000;

/** One day, in milliseconds. */
const oneDayMs = 24 * 60 * oneMinuteMs;

/**
 * The data of every moment of a schedule trigger that falls after `afterMs` and at or
 * before `upToMs`, oldest first. The slots are read as they are now, never as they were
 * when the trigger was set, so a slot moved since is followed. A time of day has no data;
 * a slot's has `sessao` (its name), `prova` (its kind, in pt-BR) and `inicio` (its start,
 * ms since 1970, so it can fill a countdown's start).
 */
export function listScheduleMomentsDue(
  moment: TriggerScheduleMoment,
  scheduleSlots: ScheduleSlot[],
  afterMs: number,
  upToMs: number,
): TriggerData[] {
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
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZoneOfTheSchedule,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(new Date(momentMs));
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
