/**
 * A fastest lap held by "Pausar gatilhos", over time (apps/server)
 *
 * What this module is for:
 *   While "Pausar gatilhos" is on, a new fastest lap does not go on air by itself: it waits
 *   in Eventos, marked as held by the pause (BAJAOVRLAY-73). A pause can last a whole
 *   podium, so a held lap meets time passing, the operator, a better lap and even a server
 *   restart. These tests follow one held lap through each of them.
 *
 * What these tests prove (the store, the detection, the auto-out and the runner all on
 * the same clock, which only moves when the test says so):
 *   - A held lap keeps its rule's maximum wait (2 minutes for a fastest lap) and expires.
 *   - "No ar" puts a held lap on air for its rule's 8 s.
 *   - A better lap during the pause makes the held one expire at its detection, so only
 *     the newest waits in Eventos (gate 2 of PR #70). A lap that waits because its rule
 *     asks is the operator's and is left alone, as before.
 *   - The pause survives a server restart: a lap detected after it is held too.
 *
 * What these tests deliberately do not cover:
 *   - How an event arrives while paused, the events queued when the pause begins, and
 *     "Retomar"; pauseHoldsAutomaticEventsOnTheStore.test.ts.
 *   - A firing that waited before a restart (not offered again); triggerCommands.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { applyOrThrow, pollTheSimulator, readEvent } from './eventInboxOnTheStore.testSupport.js';
import {
  buildPositionsWithCar31FastestOnLap36,
  buildPositionsWithCar47FastestOnLap34,
  firstFastestLapEventId,
  type InboxWithTheRunner,
  openInboxWithTheRunner,
  readClockLayerOnAir,
  restartTheServerWithTheRunner,
  secondFastestLapEventId,
  startMs,
} from './eventRunnerOnTheStore.testSupport.js';

/** Presses "Pausar gatilhos" (or "Retomar") as the operator. */
function setThePause(inbox: InboxWithTheRunner, isPaused: boolean): void {
  applyOrThrow(inbox.stateStore, { type: 'setTriggersPaused', isPaused });
}

/** The fastest laps waiting in Eventos now, by id. */
function readWaitingFastestLapIds(inbox: InboxWithTheRunner): string[] {
  return inbox.stateStore
    .readAllSlices()
    .events.filter((event) => event.kind === 'fastestLap' && event.status === 'pending')
    .map((event) => event.eventId);
}

describe('a held fastest lap and its rule', () => {
  it('expires after the rule’s 2 minutes, as a pending event with a maximum wait does', () => {
    // Arrange: paused, car 47's fastest lap held.
    const inbox = openInboxWithTheRunner();
    setThePause(inbox, true);
    pollTheSimulator(inbox, { positions: buildPositionsWithCar47FastestOnLap34() });

    // Act: exactly 2 minutes pass, then 1 ms more.
    inbox.clock.letTimePass(120_000);
    const statusAtTwoMinutes = readEvent(inbox.stateStore, firstFastestLapEventId)?.status;
    inbox.clock.letTimePass(1);

    // Assert: still waiting at its maximum wait, expired just past it.
    expect(statusAtTwoMinutes, 'at exactly 2 minutes the held lap must still wait').toBe('pending');
    expect(
      readEvent(inbox.stateStore, firstFastestLapEventId)?.statusChanges,
      'the held lap must expire 1 ms after its rule’s 2 minutes',
    ).toEqual([
      { status: 'pending', atMs: startMs },
      { status: 'expired', atMs: startMs + 120_001 },
    ]);
  });

  it('goes on air with "No ar" and leaves after the rule’s 8 s', () => {
    // Arrange: paused, car 47's fastest lap held.
    const inbox = openInboxWithTheRunner();
    setThePause(inbox, true);
    pollTheSimulator(inbox, { positions: buildPositionsWithCar47FastestOnLap34() });

    // Act: the operator presses "No ar" 20 s later; 8 s pass.
    inbox.clock.letTimePass(20_000);
    applyOrThrow(inbox.stateStore, { type: 'showEvent', eventId: firstFastestLapEventId });
    const instanceAfterThePress = readClockLayerOnAir(inbox);
    inbox.clock.letTimePass(8_000);

    // Assert: on air carrying the event, then off after 8 s, shown.
    expect(instanceAfterThePress?.eventId, '"No ar" must put the held lap on air').toBe(
      firstFastestLapEventId,
    );
    expect(
      readEvent(inbox.stateStore, firstFastestLapEventId)?.statusChanges,
      'the held lap must go on air at the press and be shown 8 s later',
    ).toEqual([
      { status: 'pending', atMs: startMs },
      { status: 'onAir', atMs: startMs + 20_000 },
      { status: 'shown', atMs: startMs + 28_000 },
    ]);
  });
});

describe('a better fastest lap during the pause', () => {
  it('makes the held lap expire at its detection, so only the newest waits in Eventos', () => {
    // Arrange: paused, car 47's 4:37,900 held.
    const inbox = openInboxWithTheRunner();
    setThePause(inbox, true);
    pollTheSimulator(inbox, { positions: buildPositionsWithCar47FastestOnLap34() });

    // Act: 15 s later car 31 beats it with 4:37,500.
    inbox.clock.letTimePass(15_000);
    pollTheSimulator(inbox, { positions: buildPositionsWithCar31FastestOnLap36() });

    // Assert: car 47's lap expired at car 31's detection; car 31's waits, held; nothing on air.
    expect(
      readEvent(inbox.stateStore, firstFastestLapEventId)?.statusChanges,
      "car 47's held lap must expire the moment car 31's better lap is detected",
    ).toEqual([
      { status: 'pending', atMs: startMs },
      { status: 'expired', atMs: startMs + 15_000 },
    ]);
    expect(
      readWaitingFastestLapIds(inbox),
      "only car 31's lap must wait in Eventos while the pause is on",
    ).toEqual([secondFastestLapEventId]);
    expect(
      readEvent(inbox.stateStore, secondFastestLapEventId)?.heldByThePause,
      "car 31's lap must say it arrived while the pause was on",
    ).toBe('arrivedWhilePaused');
    expect(readClockLayerOnAir(inbox), 'the clock layer must stay empty while paused').toBe(
      undefined,
    );
  });

  it('leaves alone a lap that waits because its rule asks, as before', () => {
    // Arrange: the fastest lap's rule set to ask, then paused; car 47's lap waits.
    const inbox = openInboxWithTheRunner();
    applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind: 'fastestLap', mode: 'ask' });
    setThePause(inbox, true);
    pollTheSimulator(inbox, { positions: buildPositionsWithCar47FastestOnLap34() });

    // Act: 15 s later car 31 beats it.
    inbox.clock.letTimePass(15_000);
    pollTheSimulator(inbox, { positions: buildPositionsWithCar31FastestOnLap36() });

    // Assert: both wait: a lap the operator was asked about is the operator's to decide.
    expect(
      readWaitingFastestLapIds(inbox),
      'a lap waiting because its rule asks must not be expired by a newer one',
    ).toEqual([firstFastestLapEventId, secondFastestLapEventId]);
  });
});

describe('a server restart while paused', () => {
  it('comes back paused, and a fastest lap detected after it is held', () => {
    // Arrange: the operator pauses; the server restarts on the same database file.
    const inbox = openInboxWithTheRunner();
    setThePause(inbox, true);
    const inboxAfterTheRestart = restartTheServerWithTheRunner(inbox);
    const isPausedAfterTheRestart =
      inboxAfterTheRestart.stateStore.readAllSlices().triggerActivity.isPaused;

    // Act: 30 s after the restart, car 47 sets the fastest lap.
    inboxAfterTheRestart.clock.letTimePass(30_000);
    pollTheSimulator(inboxAfterTheRestart, {
      positions: buildPositionsWithCar47FastestOnLap34(),
    });

    // Assert: still paused after the restart; the lap waits in Eventos, held by the pause.
    expect(isPausedAfterTheRestart, 'a server restarted while paused must come back paused').toBe(
      true,
    );
    const event = readEvent(inboxAfterTheRestart.stateStore, firstFastestLapEventId);
    expect(event?.status, "car 47's lap must wait in Eventos after the restart").toBe('pending');
    expect(event?.heldByThePause, "car 47's lap must say the pause held it").toBe(
      'arrivedWhilePaused',
    );
    expect(
      readClockLayerOnAir(inboxAfterTheRestart),
      'nothing may go on air by itself after a restart while paused',
    ).toBe(undefined);
  });
});
