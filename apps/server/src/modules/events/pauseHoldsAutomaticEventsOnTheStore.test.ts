/**
 * "Pausar gatilhos" holds the automatic events too (apps/server)
 *
 * What this module is for:
 *   During a podium or an interview the operator presses "Pausar gatilhos" so that nothing
 *   goes on air by itself. Before BAJAOVRLAY-73 that held the triggers only: a new fastest
 *   lap, whose rule says auto, still went on air for 8 s. Now, while paused, an event its
 *   rule would put on air by itself waits for the operator instead, as an event whose rule
 *   asks does: pending, with "No ar", "Prévia" and "Descartar", and the reason written on
 *   it (`heldByThePause`). Resuming replays nothing.
 *
 * What these tests prove (the store, the detection, the auto-out and the runner all on
 * the same clock, which only moves when the test says so):
 *   - A new event while paused: auto lands pending with the reason; ask lands pending as
 *     always, with no reason; a typed event under an auto rule is held too; unpaused, an
 *     auto event is queued and goes on air as before.
 *   - An event already queued when the pause begins is moved to pending at that moment,
 *     with its own reason, and is not shown when its layer empties.
 *   - Resuming replays nothing: what arrived while paused stays pending; a new fastest lap
 *     after the resume goes on air by itself again.
 *   - A held event keeps its rule's maximum wait (2 minutes for a fastest lap) and expires.
 *   - "No ar" puts a held fastest lap on air for its rule's 8 s.
 *   - The event log: the pause and the arrival are written, and no showEvent ever is.
 *
 * What these tests deliberately do not cover:
 *   - The triggers' own pause (no firing while paused); triggerFiring.test.ts and
 *     intervalTriggers.test.ts.
 *   - The page's list of held events; apps/control's HeldByThePauseRow.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import type { StateStore } from '../../core/store/createStateStore.js';
import {
  buildShapesWithCar31Leading,
  buildStartPenaltyOfCar47,
} from './detectors/raceSnapshots.testSupport.js';
import {
  applyOrThrow,
  createPlainClockItem,
  type EventInboxOnTheStore,
  pollTheSimulator,
  readEvent,
  typedEventId,
} from './eventInboxOnTheStore.testSupport.js';
import { gapBetweenEventsOnALayerMs } from './eventRunner.js';
import {
  buildPositionsWithCar31FastestOnLap36,
  buildPositionsWithCar47FastestOnLap34,
  firstFastestLapEventId,
  type InboxWithTheRunner,
  openInboxWithTheRunner,
  readClockLayerOnAir,
  secondFastestLapEventId,
  startMs,
} from './eventRunnerOnTheStore.testSupport.js';

/** Car 47's start penalty, as the inbox names it. */
const penaltyEventId = 'simulador-enduro:incident:ocorrencia-0007';

/** The notice the operator types with "+ Evento". */
const typedNoticeEventId = `manual:${typedEventId}`;

/** Presses "Pausar gatilhos" (or "Retomar") as the operator. */
function setThePause(inbox: EventInboxOnTheStore, isPaused: boolean): void {
  applyOrThrow(inbox.stateStore, { type: 'setTriggersPaused', isPaused });
}

/** Every event-log row from the first row of `firstCommand` on, as "actor command". */
function readLogRowsFrom(stateStore: StateStore, firstCommand: string): string[] {
  const eventLog = stateStore.readAllSlices().eventLog;
  const positionOfTheFirst = eventLog.findIndex((row) => row.command === firstCommand);
  if (positionOfTheFirst === -1) {
    return [];
  }
  return eventLog.slice(positionOfTheFirst).map((row) => `${row.actor} ${row.command}`);
}

const newEventScenarios = [
  // The reason for the change: the fastest lap's rule says auto, and the pause holds it.
  {
    name: 'holds a fastest lap that arrives while paused, with the reason',
    isPaused: true,
    eventId: firstFastestLapEventId,
    bringTheEvent: (inbox: InboxWithTheRunner) =>
      pollTheSimulator(inbox, { positions: buildPositionsWithCar47FastestOnLap34() }),
    expectedFirstStatus: 'pending',
    expectedHeldByThePause: 'arrivedWhilePaused',
  },
  // A penalty's rule asks: it waits for the operator as always, and the pause is no reason.
  {
    name: 'lists a penalty that arrives while paused as pending, as always, with no reason',
    isPaused: true,
    eventId: penaltyEventId,
    bringTheEvent: (inbox: InboxWithTheRunner) => {
      pollTheSimulator(inbox, buildShapesWithCar31Leading([]));
      pollTheSimulator(inbox, buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]));
    },
    expectedFirstStatus: 'pending',
    expectedHeldByThePause: undefined,
  },
  // "+ Evento" under a manual rule set to auto would go on air by itself: held too.
  {
    name: 'holds a notice typed while paused when the manual rule says auto',
    isPaused: true,
    eventId: typedNoticeEventId,
    bringTheEvent: (inbox: InboxWithTheRunner) => {
      applyOrThrow(inbox.stateStore, {
        type: 'updateEventRule',
        kind: 'manual',
        mode: 'auto',
        itemId: inbox.itemId,
      });
      applyOrThrow(inbox.stateStore, {
        type: 'createManualEvent',
        noticeKind: 'notice',
        reason: 'Largada adiada em 15 minutos',
      });
    },
    expectedFirstStatus: 'pending',
    expectedHeldByThePause: 'arrivedWhilePaused',
  },
  // Unpaused nothing changed: the fastest lap is queued for the runner, with no reason.
  {
    name: 'queues a fastest lap that arrives while the triggers run, as before',
    isPaused: false,
    eventId: firstFastestLapEventId,
    bringTheEvent: (inbox: InboxWithTheRunner) =>
      pollTheSimulator(inbox, { positions: buildPositionsWithCar47FastestOnLap34() }),
    expectedFirstStatus: 'queued',
    expectedHeldByThePause: undefined,
  },
];

describe('a new event and "Pausar gatilhos"', () => {
  it.each(newEventScenarios)(
    '$name',
    ({ isPaused, eventId, bringTheEvent, expectedFirstStatus, expectedHeldByThePause }) => {
      // Arrange: the runner watching, the clock layer empty, the pause on or off.
      const inbox = openInboxWithTheRunner();
      setThePause(inbox, isPaused);

      // Act: the event arrives.
      bringTheEvent(inbox);

      // Assert: it started where its rule and the pause say, with the reason or without.
      const event = readEvent(inbox.stateStore, eventId);
      expect(event?.statusChanges[0]?.status, 'the status the event arrived with').toBe(
        expectedFirstStatus,
      );
      expect(event?.heldByThePause, 'the reason the event waits, when the pause held it').toBe(
        expectedHeldByThePause,
      );
    },
  );

  it('leaves the air empty while a held fastest lap waits, however long', () => {
    // Arrange: the triggers paused, the clock layer empty.
    const inbox = openInboxWithTheRunner();
    setThePause(inbox, true);

    // Act: a fastest lap arrives; a minute passes.
    pollTheSimulator(inbox, { positions: buildPositionsWithCar47FastestOnLap34() });
    inbox.clock.letTimePass(60_000);

    // Assert: still pending, and nothing went on air.
    expect(readEvent(inbox.stateStore, firstFastestLapEventId)?.status, 'it waits').toBe('pending');
    expect(readClockLayerOnAir(inbox), 'nothing may go on air by itself').toBe(undefined);
  });
});

describe('an event already queued when the pause begins', () => {
  it('is moved to pending at the pause, with its reason, and not shown when the layer empties', () => {
    // Arrange: the operator's own race clock on the layer, so a fastest lap stays queued.
    const inbox = openInboxWithTheRunner();
    const plainClockItemId = createPlainClockItem(inbox.stateStore, 'Relógio da prova');
    applyOrThrow(inbox.stateStore, { type: 'takeItem', itemId: plainClockItemId });
    pollTheSimulator(inbox, { positions: buildPositionsWithCar47FastestOnLap34() });
    const statusBeforeThePause = readEvent(inbox.stateStore, firstFastestLapEventId)?.status;

    // Act: 5 s later the operator pauses, then clears the layer, and the gap passes.
    inbox.clock.letTimePass(5_000);
    setThePause(inbox, true);
    applyOrThrow(inbox.stateStore, { type: 'clearLayer', layerId: 'clock' });
    inbox.clock.letTimePass(gapBetweenEventsOnALayerMs);

    // Assert: queued before, pending from the pause's moment with its reason, never on air.
    const event = readEvent(inbox.stateStore, firstFastestLapEventId);
    expect(statusBeforeThePause, 'before the pause it waited for the runner').toBe('queued');
    expect(event?.statusChanges, 'moved to pending at the moment of the pause').toEqual([
      { status: 'queued', atMs: startMs },
      { status: 'pending', atMs: startMs + 5_000 },
    ]);
    expect(event?.heldByThePause, 'the reason: it was queued when paused').toBe('queuedWhenPaused');
    expect(readClockLayerOnAir(inbox), 'the empty layer must stay empty').toBe(undefined);
  });
});

describe('"Retomar" after a pause', () => {
  it('replays nothing: what arrived while paused stays pending, and the air stays empty', () => {
    // Arrange: paused, a fastest lap held.
    const inbox = openInboxWithTheRunner();
    setThePause(inbox, true);
    pollTheSimulator(inbox, { positions: buildPositionsWithCar47FastestOnLap34() });

    // Act: 10 s later the operator resumes; 30 s more pass.
    inbox.clock.letTimePass(10_000);
    setThePause(inbox, false);
    inbox.clock.letTimePass(30_000);

    // Assert: still pending, nothing on air.
    expect(readEvent(inbox.stateStore, firstFastestLapEventId)?.status, 'still waits').toBe(
      'pending',
    );
    expect(readClockLayerOnAir(inbox), 'resuming must put nothing on air').toBe(undefined);
  });

  it('lets a fastest lap that arrives after it go on air by itself again', () => {
    // Arrange: paused, car 47's fastest lap held, then resumed.
    const inbox = openInboxWithTheRunner();
    setThePause(inbox, true);
    pollTheSimulator(inbox, { positions: buildPositionsWithCar47FastestOnLap34() });
    setThePause(inbox, false);

    // Act: car 31 beats it 10 s later.
    inbox.clock.letTimePass(10_000);
    pollTheSimulator(inbox, { positions: buildPositionsWithCar31FastestOnLap36() });

    // Assert: car 31's lap is on air by itself; car 47's still waits for the operator.
    expect(readEvent(inbox.stateStore, secondFastestLapEventId)?.status, 'the new one').toBe(
      'onAir',
    );
    expect(readEvent(inbox.stateStore, firstFastestLapEventId)?.status, 'the held one').toBe(
      'pending',
    );
  });
});

describe('a held fastest lap and its rule', () => {
  it('expires after the rule’s 2 minutes, as a pending event with a maximum wait does', () => {
    // Arrange: paused, a fastest lap held.
    const inbox = openInboxWithTheRunner();
    setThePause(inbox, true);
    pollTheSimulator(inbox, { positions: buildPositionsWithCar47FastestOnLap34() });

    // Act: exactly 2 minutes pass, then 1 ms more.
    inbox.clock.letTimePass(120_000);
    const statusAtTwoMinutes = readEvent(inbox.stateStore, firstFastestLapEventId)?.status;
    inbox.clock.letTimePass(1);

    // Assert: still waiting at its maximum wait, expired just past it.
    expect(statusAtTwoMinutes, 'at exactly 2 minutes it may still be shown').toBe('pending');
    expect(readEvent(inbox.stateStore, firstFastestLapEventId)?.statusChanges, 'its life').toEqual([
      { status: 'pending', atMs: startMs },
      { status: 'expired', atMs: startMs + 120_001 },
    ]);
  });

  it('goes on air with "No ar" and leaves after the rule’s 8 s', () => {
    // Arrange: paused, a fastest lap held.
    const inbox = openInboxWithTheRunner();
    setThePause(inbox, true);
    pollTheSimulator(inbox, { positions: buildPositionsWithCar47FastestOnLap34() });

    // Act: the operator presses "No ar" 20 s later; 8 s pass.
    inbox.clock.letTimePass(20_000);
    applyOrThrow(inbox.stateStore, { type: 'showEvent', eventId: firstFastestLapEventId });
    const instanceAfterThePress = readClockLayerOnAir(inbox);
    inbox.clock.letTimePass(8_000);

    // Assert: on air carrying the event, then off after 8 s, shown.
    expect(instanceAfterThePress?.eventId, '"No ar" must put it on air').toBe(
      firstFastestLapEventId,
    );
    expect(readEvent(inbox.stateStore, firstFastestLapEventId)?.statusChanges, 'its life').toEqual([
      { status: 'pending', atMs: startMs },
      { status: 'onAir', atMs: startMs + 20_000 },
      { status: 'shown', atMs: startMs + 28_000 },
    ]);
  });
});

describe('the event log while paused', () => {
  it('writes the pause and the arrival, and never a showEvent of the runner', () => {
    // Arrange: the runner watching, the clock layer empty.
    const inbox = openInboxWithTheRunner();

    // Act: pause, a fastest lap arrives, a minute passes.
    setThePause(inbox, true);
    pollTheSimulator(inbox, { positions: buildPositionsWithCar47FastestOnLap34() });
    inbox.clock.letTimePass(60_000);

    // Assert: the operator's pause, then the detection's arrival, and nothing after.
    expect(readLogRowsFrom(inbox.stateStore, 'setTriggersPaused'), 'the rows').toEqual([
      'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81 setTriggersPaused',
      'sistema:eventos recordDetectedEvents',
    ]);
  });
});
