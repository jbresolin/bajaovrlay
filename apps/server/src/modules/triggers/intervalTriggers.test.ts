/**
 * Schedule triggers every N minutes (apps/server)
 *
 * What this module is for:
 *   The "Horário" trigger's third form (BAJAOVRLAY-64): every N minutes (5 to 240), counted
 *   from the moment the operator switched it on, all day or only between two times of the
 *   day on the server's clock (Brasília). It is what brings the plain sponsor roll back
 *   every 30 minutes. It keeps every rule of the other schedule triggers: auto or ask, the
 *   minimum interval, "Pausar gatilhos", no late firing after a sleep. One rule is its own:
 *   while a graphic its macro takes is still on air (the roll's pass has not ended), a
 *   firing does nothing, and the server log says why.
 *
 * What these tests prove, on fake time from 11:00 in São Paulo on race day:
 *   - On at 11:00 every 5 minutes, it fires at 11:05 and 11:10, not a second before.
 *   - It counts from the moment it is switched on, not from when it was made, and a change
 *     of N counts again from the save.
 *   - Between 12:00 and 13:00 it fires at 12:00, 12:30 and 13:00 only; a window across
 *     midnight holds 23:30 and 01:30, not 03:00.
 *   - The moments a sleep jumped over are not fired late; the next one on its grid is. A step
 *     of the clock by days looks at no more than 1000 steps of the grid at once, and the
 *     warning of the moments skipped says its count was cut there.
 *   - Paused, it fires nothing; unpaused, it goes on at the next moment of its grid.
 *
 * What these tests deliberately do not cover:
 *   - The schema of the form; shared's trigger.test.ts.
 *   - How the server clock itself runs; core/time.
 *   - The roll on air (its layer busy, nothing to show, a restart mid-pass);
 *     intervalTriggersAndTheRoll.test.ts.
 *   - The roll's pass length; core/store/plainSponsorRollAutoOut.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  buildSponsorsEveryMinutesTrigger,
  momentOfRaceDayAt,
  oneMinuteMs,
  readFiringTimesOfDay,
} from './intervalTriggers.testSupport.js';
import { listScheduleMomentsDue, mostIntervalStepsLookedAtOnce } from './scheduleMoments.js';
import {
  applyAsTheOperatorOrThrow,
  createTrigger,
  readFirings,
  startOfRaceDay,
  startTriggersOnTheStore,
} from './triggersOnTheStore.testSupport.js';

describe('every N minutes', () => {
  it('fires at 11:05 and 11:10 when switched on at 11:00 every 5 minutes', () => {
    // Arrange: the trigger made, on, at 11:00.
    const { store, passTime } = startTriggersOnTheStore();
    createTrigger(store, buildSponsorsEveryMinutesTrigger(5));

    // Act: time runs to a second before 11:05, then on to 11:10:01.
    passTime(5 * oneMinuteMs - 1_000);
    const firingsJustBefore = readFirings(store).length;
    passTime(5 * oneMinuteMs + 2_000);

    // Assert: nothing before 11:05; then one firing at each moment.
    expect(firingsJustBefore, 'nothing may fire before 11:05').toBe(0);
    expect(readFiringTimesOfDay(store), 'one firing every 5 minutes').toEqual(['11:05', '11:10']);
  });

  it('counts from the moment it is switched on, not from when it was made', () => {
    // Arrange: the trigger made off at 11:00; the operator switches it on at 11:03.
    const { store, passTime } = startTriggersOnTheStore();
    const triggerId = createTrigger(
      store,
      buildSponsorsEveryMinutesTrigger(5, { isEnabled: false }),
    );
    passTime(3 * oneMinuteMs);
    applyAsTheOperatorOrThrow(store, { type: 'updateTrigger', triggerId, isEnabled: true });

    // Act: time runs to 11:08:01.
    passTime(5 * oneMinuteMs + 1_000);

    // Assert: one firing, at 11:08, five minutes after it was switched on.
    expect(readFiringTimesOfDay(store), 'the count starts at the switch-on').toEqual(['11:08']);
  });

  it('counts again from the save when N is changed', () => {
    // Arrange: every 30 minutes from 11:00; at 11:20 the operator changes it to every 15.
    const { store, passTime } = startTriggersOnTheStore();
    const triggerId = createTrigger(store, buildSponsorsEveryMinutesTrigger(30));
    passTime(20 * oneMinuteMs);
    applyAsTheOperatorOrThrow(store, {
      type: 'updateTrigger',
      triggerId,
      when: { kind: 'schedule', moment: { kind: 'everyMinutes', everyMinutes: 15, window: null } },
    });

    // Act: time runs to 11:36.
    passTime(16 * oneMinuteMs);

    // Assert: 11:35, fifteen minutes after the save; not 11:30 on the old grid.
    expect(readFiringTimesOfDay(store), 'a new N counts from its save').toEqual(['11:35']);
  });

  it('counts on from the stamp after a server restart, which the triggers row keeps', () => {
    // Arrange: on at 11:00 every 5 minutes.
    const { store } = startTriggersOnTheStore();

    // Act: make it.
    createTrigger(store, buildSponsorsEveryMinutesTrigger(5));

    // Assert: the switch-on moment is on the stored trigger, so a restart counts on from it.
    expect(
      store.readAllSlices().triggers[0]?.intervalCountedFromMs,
      'the server must stamp the moment it was switched on',
    ).toBe(Date.parse(startOfRaceDay));
  });
});

describe('only between two times of the day', () => {
  it('fires at 12:00, 12:30 and 13:00 between 12:00 and 13:00, and at no other time', () => {
    // Arrange: every 30 minutes from 11:00, only from 12:00 to 13:00.
    const { store, passTime } = startTriggersOnTheStore();
    createTrigger(store, {
      ...buildSponsorsEveryMinutesTrigger(30),
      when: {
        kind: 'schedule',
        moment: { kind: 'everyMinutes', everyMinutes: 30, window: { from: '12:00', to: '13:00' } },
      },
    });

    // Act: the whole afternoon to 14:01 passes.
    passTime(3 * 60 * oneMinuteMs + oneMinuteMs);

    // Assert: 11:30, 13:30 and 14:00 are outside; both ends of the window are inside.
    expect(readFiringTimesOfDay(store), 'only the moments inside the window').toEqual([
      '12:00',
      '12:30',
      '13:00',
    ]);
  });

  it('holds 23:30 and 01:30 in a window from 22:00 to 02:00, but not 03:00', () => {
    // Arrange: every 2 hours from 21:30 on race day, only from 22:00 to 02:00 (a night enduro).
    const moment = {
      kind: 'everyMinutes' as const,
      everyMinutes: 120,
      window: { from: '22:00', to: '02:00' },
    };
    const switchedOnAtMs = momentOfRaceDayAt('21:30');

    // Act: list the moments due from 21:30 to 04:00 the next day.
    const momentsDue = listScheduleMomentsDue(moment, [], {
      afterMs: switchedOnAtMs,
      upToMs: switchedOnAtMs + 6.5 * 60 * oneMinuteMs,
      intervalCountedFromMs: switchedOnAtMs,
    });

    // Assert: 23:30 and 01:30 (21:30 itself is the switch-on, and 03:30 is past 02:00).
    expect(momentsDue, 'two moments inside the window across midnight').toHaveLength(2);
  });
});

describe('a moment that came while the machine slept', () => {
  it('is not fired on waking; the next moment on the grid is', () => {
    // Arrange: on at 11:00 every 5 minutes; it is 11:04.
    const { store, passTime, sleep } = startTriggersOnTheStore();
    createTrigger(store, buildSponsorsEveryMinutesTrigger(5));
    passTime(4 * oneMinuteMs);

    // Act: the laptop sleeps over 11:05 and 11:10 and wakes at 11:14, then time runs to 11:15:01.
    sleep(10 * oneMinuteMs);
    passTime(2_000);
    const firingsOnWaking = readFirings(store).length;
    passTime(oneMinuteMs - 1_000);

    // Assert: nothing from the sleep; 11:15 fires as planned.
    expect(firingsOnWaking, 'a moment from the sleep is never fired late').toBe(0);
    expect(readFiringTimesOfDay(store), 'the grid goes on after the sleep').toEqual(['11:15']);
  });
});

describe('a forward step of the clock by days', () => {
  it('looks at no more than 1000 steps of the grid at once, so one look stays short', () => {
    // Arrange: every 5 minutes between 12:00 and 13:00, switched on at 11:00 on race day.
    const moment = {
      kind: 'everyMinutes' as const,
      everyMinutes: 5,
      window: { from: '12:00', to: '13:00' },
    };
    const switchedOnAtMs = momentOfRaceDayAt('11:00');

    // Act: list the moments over a whole year, as a look after a step of the clock would.
    const momentsDue = listScheduleMomentsDue(moment, [], {
      afterMs: switchedOnAtMs,
      upToMs: switchedOnAtMs + 365 * 24 * 60 * oneMinuteMs,
      intervalCountedFromMs: switchedOnAtMs,
    });

    // Assert: some moments, and none past the first 1000 steps of 5 minutes.
    expect(mostIntervalStepsLookedAtOnce, 'the cap is 1000 steps').toBe(1000);
    expect(momentsDue.length, 'the window’s moments of those steps are listed').toBeGreaterThan(0);
    expect(
      momentsDue.length,
      'never more than the steps looked at: 13 moments a day for about 3,5 days',
    ).toBeLessThanOrEqual(13 * 4);
  });

  it('logs the moments it skipped as a count cut at the cap', () => {
    // Arrange: every 5 minutes from 11:00, between 12:00 and 13:00.
    const { store, passTime, sleep, readRecordedLogLines } = startTriggersOnTheStore();
    createTrigger(store, {
      ...buildSponsorsEveryMinutesTrigger(5),
      when: {
        kind: 'schedule',
        moment: { kind: 'everyMinutes', everyMinutes: 5, window: { from: '12:00', to: '13:00' } },
      },
    });

    // Act: the server clock steps 30 days forwards, and the next tick comes.
    sleep(30 * 24 * 60 * oneMinuteMs);
    passTime(2_000);

    // Assert: nothing fired, and one warning whose count says it was cut at the cap.
    expect(readFirings(store), 'nothing from the step is fired').toEqual([]);
    const skippedWarnings = readRecordedLogLines().filter(
      (line) => line.level === 'warn' && line.message.includes('skipped'),
    );
    expect(skippedWarnings, 'one warning, its count cut at the cap').toEqual([
      expect.objectContaining({
        trigger_name: 'Patrocinadores a cada 5 min',
        is_count_capped: true,
      }),
    ]);
  });
});

describe('"Pausar gatilhos"', () => {
  it('fires nothing while paused, and goes on at the next moment of its grid once unpaused', () => {
    // Arrange: on at 11:00 every 5 minutes; the operator pauses the triggers.
    const { store, passTime } = startTriggersOnTheStore();
    createTrigger(store, buildSponsorsEveryMinutesTrigger(5));
    applyAsTheOperatorOrThrow(store, { type: 'setTriggersPaused', isPaused: true });

    // Act: time runs to 11:11, the pause is lifted, and time runs to 11:15:01.
    passTime(11 * oneMinuteMs);
    const firingsWhilePaused = readFirings(store).length;
    applyAsTheOperatorOrThrow(store, { type: 'setTriggersPaused', isPaused: false });
    passTime(4 * oneMinuteMs + 1_000);

    // Assert: nothing at 11:05 or 11:10; 11:15 fires.
    expect(firingsWhilePaused, 'a paused trigger never fires').toBe(0);
    expect(readFiringTimesOfDay(store), 'the grid goes on after the pause').toEqual(['11:15']);
  });
});
