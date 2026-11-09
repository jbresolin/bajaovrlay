/**
 * Schedule triggers: a time of day, or minutes from a Programação slot (apps/server)
 *
 * What this module is for:
 *   A schedule trigger (BAJAOVRLAY-48) fires at a time of day on the server's clock
 *   (America/Sao_Paulo), or some minutes before or after the start of a Programação slot,
 *   one named slot or every slot. The trigger service looks once a second at which moments
 *   came since it last looked, reading the slots each time, so a slot moved after the
 *   trigger was set is followed. A slot's firing carries `{ sessao, prova, inicio }`,
 *   `inicio` in ms since 1970 so it can fill a countdown's start.
 *
 * What these tests prove, on fake time from 11:00 in São Paulo on race day:
 *   - 10 minutes before the "Enduro" slot runs the countdown macro, with the slot's name and
 *     start on air, and not a second earlier;
 *   - a slot moved after the trigger was set fires at its new time, not its old one;
 *   - "every slot" fires once per slot, each with its own data;
 *   - a time of day fires once at that time in São Paulo, never again within the minute;
 *   - a moment that had already passed when the server started is not fired late;
 *   - a moment that came while the machine slept (10 minutes with no tick) is not fired
 *     when it wakes, and is logged as skipped, naming its trigger (a forward step of the
 *     server clock, BAJAOVRLAY-62, skips moments the same way);
 *   - a moment the server clock stepped back over, already fired, is not sent again.
 *
 * What these tests deliberately do not cover:
 *   - A day with a different UTC offset: Brazil has had none since 2019. The moment is
 *     still worked out through the time zone's own rules (scheduleMoments.ts).
 */
import { describe, expect, it, vi } from 'vitest';

import {
  applyAsTheOperatorOrThrow,
  createTrigger,
  enduroCountdownMacroId,
  readDataOnAirOnLayer,
  readFirings,
  startTriggersOnTheStore,
  trackReplayMacroId,
} from './triggersOnTheStore.testSupport.js';

/** 13:00 in São Paulo on race day: when the Enduro starts. */
const enduroStartsAtMs = Date.parse('2027-08-14T16:00:00.000Z');

/** One minute, in milliseconds. */
const oneMinuteMs = 60_000;

/** The Enduro's slot as "Programação" in Cadastros holds it. */
function buildEnduroSlot(startsAtMs: number) {
  return {
    slotId: 'enduro-sabado',
    sessionName: 'Enduro',
    sessionKind: 'enduro',
    startsAtMs,
    endsAtMs: startsAtMs + 4 * 60 * oneMinuteMs,
    place: 'Pista principal',
  };
}

/** Saves a slot as the operator does on "Programação". */
function saveSlot(
  store: ReturnType<typeof startTriggersOnTheStore>['store'],
  slot: ReturnType<typeof buildEnduroSlot>,
): void {
  applyAsTheOperatorOrThrow(store, {
    type: 'upsertEntity',
    entityType: 'scheduleSlot',
    record: slot,
  });
}

/** "Contagem do Enduro": ten minutes before the Enduro slot, by itself. */
const tenMinutesBeforeTheEnduro = {
  name: 'Contagem do Enduro',
  when: {
    kind: 'schedule',
    moment: { kind: 'slotStart', slotId: 'enduro-sabado', minutesFromStart: -10 },
  },
  macroId: enduroCountdownMacroId,
  mode: 'auto',
};

describe('minutes from a slot', () => {
  it('runs the countdown macro 10 minutes before the "Enduro" slot, not a second earlier', () => {
    // Arrange: the Enduro at 13:00 and its trigger; it is 11:00.
    const { store, passTime } = startTriggersOnTheStore();
    saveSlot(store, buildEnduroSlot(enduroStartsAtMs));
    createTrigger(store, tenMinutesBeforeTheEnduro);

    // Act: time runs to one second before 12:50, then past it.
    passTime(110 * oneMinuteMs - 1_000);
    const firingsJustBefore = readFirings(store).length;
    passTime(2_000);

    // Assert: nothing before; then the countdown, filled from the slot.
    expect(firingsJustBefore, 'nothing may fire before 12:50').toBe(0);
    expect(readFirings(store)[0]?.data, 'the firing carries the slot').toEqual({
      sessao: 'Enduro',
      prova: 'Enduro',
      inicio: enduroStartsAtMs,
    });
    expect(
      readDataOnAirOnLayer(store, 'clock'),
      'the countdown must count down to the Enduro’s start',
    ).toEqual({ layout: 'card', sessionName: 'Enduro', startsAtMs: enduroStartsAtMs });
  });

  it('follows a slot moved after the trigger was set', () => {
    // Arrange: the Enduro at 13:00 and its trigger; at 12:00 the start is moved to 13:30.
    const { store, passTime } = startTriggersOnTheStore();
    saveSlot(store, buildEnduroSlot(enduroStartsAtMs));
    createTrigger(store, tenMinutesBeforeTheEnduro);
    passTime(60 * oneMinuteMs);
    const movedStartMs = enduroStartsAtMs + 30 * oneMinuteMs;
    saveSlot(store, buildEnduroSlot(movedStartMs));

    // Act: time runs past the old moment (12:50) and then past the new one (13:20).
    passTime(51 * oneMinuteMs);
    const firingsAtTheOldMoment = readFirings(store).length;
    passTime(30 * oneMinuteMs);

    // Assert: nothing at the old moment; one firing at the new, with the new start.
    expect(firingsAtTheOldMoment, 'the old start no longer counts').toBe(0);
    expect(
      readFirings(store).map((firing) => firing.data.inicio),
      'one firing, at the moved start',
    ).toEqual([movedStartMs]);
  });

  it('fires once for each slot when the trigger names every slot', () => {
    // Arrange: the Enduro at 13:00 and the acceleration at 15:00; five minutes after every
    // slot, asking.
    const { store, passTime } = startTriggersOnTheStore();
    saveSlot(store, buildEnduroSlot(enduroStartsAtMs));
    applyAsTheOperatorOrThrow(store, {
      type: 'upsertEntity',
      entityType: 'scheduleSlot',
      record: {
        slotId: 'aceleracao-sabado',
        sessionName: 'Aceleração',
        sessionKind: 'acceleration',
        startsAtMs: enduroStartsAtMs + 2 * 60 * oneMinuteMs,
      },
    });
    createTrigger(store, {
      name: 'Depois da largada',
      when: { kind: 'schedule', moment: { kind: 'slotStart', slotId: null, minutesFromStart: 5 } },
      macroId: trackReplayMacroId,
      mode: 'ask',
    });

    // Act: the whole afternoon passes.
    passTime(5 * 60 * oneMinuteMs);

    // Assert: two firings, each naming its session.
    expect(
      readFirings(store).map((firing) => firing.data.sessao),
      'one firing per slot, in order',
    ).toEqual(['Enduro', 'Aceleração']);
  });
});

describe('a time of day', () => {
  it('fires once at 11:30 in São Paulo, and not again within that minute', () => {
    // Arrange: a trigger at 11:30; it is 11:00 in São Paulo (14:00 UTC).
    const { store, passTime } = startTriggersOnTheStore();
    createTrigger(store, {
      name: 'Abertura da transmissão',
      when: { kind: 'schedule', moment: { kind: 'timeOfDay', timeOfDay: '11:30' } },
      macroId: trackReplayMacroId,
      mode: 'ask',
    });

    // Act: time runs to 11:29:59, then on to 11:31.
    passTime(30 * oneMinuteMs - 1_000);
    const firingsJustBefore = readFirings(store).length;
    passTime(oneMinuteMs + 1_000);

    // Assert: none before, exactly one after: 11:30 São Paulo, not 11:30 UTC.
    expect(firingsJustBefore, 'nothing before 11:30').toBe(0);
    expect(readFirings(store).length, 'exactly one firing at 11:30').toBe(1);
  });
});

describe('a moment that passed while the server was off', () => {
  it('is not fired late when the server starts after it', () => {
    // Arrange: the Enduro starts at 11:05, so its trigger's moment, 10:55, has passed at 11:00.
    const { store, passTime } = startTriggersOnTheStore();
    saveSlot(store, buildEnduroSlot(Date.parse('2027-08-14T14:05:00.000Z')));
    createTrigger(store, tenMinutesBeforeTheEnduro);

    // Act: time runs on past the start.
    passTime(10 * oneMinuteMs);

    // Assert: nothing fired: a countdown five minutes late would be wrong on air.
    expect(readFirings(store), 'a passed moment is never fired late').toEqual([]);
  });
});

describe('a moment that came while the machine slept', () => {
  it('is not fired when a laptop wakes 10 minutes later', () => {
    // Arrange: the Enduro at 13:00 and its trigger at 12:50; it is 12:45.
    const { store, passTime, sleep } = startTriggersOnTheStore();
    saveSlot(store, buildEnduroSlot(enduroStartsAtMs));
    createTrigger(store, tenMinutesBeforeTheEnduro);
    passTime(105 * oneMinuteMs);

    // Act: the laptop sleeps for 10 minutes, over 12:50, and wakes at 12:55 for its next tick.
    sleep(10 * oneMinuteMs);
    passTime(2_000);

    // Assert: nothing fired from the gap: a countdown to a session 5 minutes away would be
    // wrong on air.
    expect(readFirings(store), 'a moment from the sleep is never fired on waking').toEqual([]);
  });

  it('is logged as skipped, naming the trigger, when the clock jumps past it', () => {
    // Arrange: the same, at 12:45: the Enduro at 13:00 and its trigger at 12:50.
    const { store, passTime, sleep, readRecordedLogLines } = startTriggersOnTheStore();
    saveSlot(store, buildEnduroSlot(enduroStartsAtMs));
    createTrigger(store, tenMinutesBeforeTheEnduro);
    passTime(105 * oneMinuteMs);

    // Act: the server clock steps 10 minutes forwards, over 12:50 (a sleep stepped by NTP).
    sleep(10 * oneMinuteMs);
    passTime(2_000);

    // Assert: one warning naming "Contagem do Enduro" and the one moment it skipped.
    const skippedWarnings = readRecordedLogLines().filter(
      (line) => line.level === 'warn' && line.message.includes('skipped'),
    );
    expect(skippedWarnings, 'the operator reading the log must see what did not fire').toHaveLength(
      1,
    );
    expect(
      skippedWarnings[0],
      'the warning names the trigger and counts the moments',
    ).toMatchObject({
      trigger_name: 'Contagem do Enduro',
      moments_skipped: 1,
    });
  });
});

describe('a moment the server clock stepped back over', () => {
  it('is not sent to fire a second time', () => {
    // Arrange: the Enduro at 13:00 and its trigger at 12:50; time runs to 12:50:03, so the
    // countdown has fired once. Every fireTrigger the service sends is counted.
    const { store, passTime, stepTheClockBack } = startTriggersOnTheStore();
    saveSlot(store, buildEnduroSlot(enduroStartsAtMs));
    createTrigger(store, tenMinutesBeforeTheEnduro);
    const commandsSent = vi.spyOn(store, 'applyCommand');
    passTime(110 * oneMinuteMs + 3_000);
    const firingsSentBeforeTheStep = countFireTriggerCommands(commandsSent.mock.calls);

    // Act: the server clock steps back 10 s to 12:49:53 ("Acertar relógio agora" on a
    // clock that ran ahead), and time runs on past 12:50 again.
    stepTheClockBack(10_000);
    passTime(15_000);

    // Assert: one firing sent, and still one. The trigger's 10 s interval would refuse a
    // second one today, but a moment already looked at must not depend on it.
    expect(firingsSentBeforeTheStep, 'the moment was sent once at 12:50').toBe(1);
    expect(
      countFireTriggerCommands(commandsSent.mock.calls),
      'a moment already looked at is never sent again after a step back',
    ).toBe(1);
    expect(readFirings(store).length, 'and the countdown macro ran once').toBe(1);
  });
});

/** How many of the commands sent to the store were a trigger's firing. */
function countFireTriggerCommands(calls: readonly (readonly unknown[])[]): number {
  return calls.filter((call) => {
    const command: unknown = call[0];
    return (
      typeof command === 'object' &&
      command !== null &&
      'type' in command &&
      command.type === 'fireTrigger'
    );
  }).length;
}
