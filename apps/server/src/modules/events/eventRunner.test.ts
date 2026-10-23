/**
 * The automatic runner of the event inbox, on a clock moved by hand (apps/server)
 *
 * What this module is for:
 *   An event whose rule says auto (a new fastest lap, a leader change) is queued, and
 *   the runner (eventRunner.ts) puts it on air by itself, through showEvent as
 *   `sistema:eventos`, with the same three queue rules every time:
 *   - it never replaces what is on the layer: it waits until the layer is empty, so an
 *     operator's graphic is never knocked off by an automatic one;
 *   - events of one layer go on one after another, in the order they were detected, with
 *     a gap of --motion-out plus 1 s between the previous one leaving and the next one
 *     going on, so two notices never overlap;
 *   - an event older than its rule's max age is expired, never shown late.
 *   Each event stays on air for its rule's duration (the auto-out takes it off).
 *
 * What these tests prove (the store, the detection, the auto-out and the runner all on
 * the same clock, which only moves when the test says so):
 *   - A fastest lap goes on air by itself and leaves after its rule's 8 s; it is shown.
 *   - Two fastest laps show one after the other: the second waits for the first to leave,
 *     then 1.25 s more, and not a millisecond less.
 *   - A race clock taken by hand on the layer makes the fastest lap wait, however long;
 *     once the operator clears it, the fastest lap goes on after the gap.
 *   - A fastest lap still queued after its 2 minutes is expired and never shown.
 *   - A queued fastest lap is expired as soon as a newer one of the same source arrives,
 *     so an outdated "Volta mais rápida" never airs (gate 2 of PR #22).
 *   - A penalty, whose rule asks, never goes on air by itself.
 *   - The gap is the theme's --motion-out (250 ms) plus 1 s.
 *
 * What these tests deliberately do not cover:
 *   - showEvent itself (the take, expiry, refusals); inboxCommandsOnTheStore.test.ts.
 *   - The real setTimeout: the runner takes its timers and clock from outside, so no test
 *     waits in real time (CI time is tracked in BAJAOVRLAY-42).
 */
import { readFileSync } from 'node:fs';

import type { PositionsShape } from '@bajaovrlay/shared';
import { onTestFinished } from 'vitest';
import { describe, expect, it } from 'vitest';

import { createLogger } from '../../core/logger/createLogger.js';
import { startAutoOutScheduler } from '../../core/store/autoOut.js';
import {
  buildPositionsInOrder,
  buildPositionsWithCar31Leading,
  buildShapesWithCar31Leading,
  buildStartPenaltyOfCar47,
} from './detectors/raceSnapshots.testSupport.js';
import {
  applyOrThrow,
  createClockItemForEvents,
  createPlainClockItem,
  type EventInboxOnTheStore,
  openEventInboxOnTheStore,
  pollTheSimulator,
  readEvent,
  startOfTheTests,
} from './eventInboxOnTheStore.testSupport.js';
import { gapBetweenEventsOnALayerMs, startEventRunner } from './eventRunner.js';

/** Car 47's fastest lap, 4:37,900 on its lap 34, as the inbox names it. */
const firstFastestLapEventId = 'simulador-enduro:fastestLap:enduro-2027-nacional:47:34';

/** Car 31's fastest lap after it, 4:37,500 on its lap 36. */
const secondFastestLapEventId = 'simulador-enduro:fastestLap:enduro-2027-nacional:31:36';

/** The moment the tests start, in ms. */
const startMs = Date.parse(startOfTheTests);

/** The positions after car 47 set 4:37,900 on its lap 34. */
function buildPositionsWithCar47FastestOnLap34(): PositionsShape {
  return buildPositionsInOrder([
    { carNumber: 31, laps: 35, bestLapMs: 278_291, bestLapNumber: 29 },
    { carNumber: 38, laps: 34, bestLapMs: 279_596, bestLapNumber: 12 },
    { carNumber: 47, laps: 34, bestLapMs: 277_900, bestLapNumber: 34 },
  ]);
}

/** The positions after car 31 answered with 4:37,500 on its lap 36. */
function buildPositionsWithCar31FastestOnLap36(): PositionsShape {
  return buildPositionsInOrder([
    { carNumber: 31, laps: 36, bestLapMs: 277_500, bestLapNumber: 36 },
    { carNumber: 38, laps: 35, bestLapMs: 279_596, bestLapNumber: 12 },
    { carNumber: 47, laps: 34, bestLapMs: 277_900, bestLapNumber: 34 },
  ]);
}

/**
 * The inbox with the auto-out and the runner started on its clock, a race clock item
 * ("Relógio — volta mais rápida", on the clock layer) as the fastest lap's and the
 * incidents' item, and the simulator's baseline poll in. Everything is stopped when the
 * test finishes.
 */
function openInboxWithTheRunner(): EventInboxOnTheStore & { itemId: string } {
  const inbox = openEventInboxOnTheStore();
  const itemId = createClockItemForEvents(inbox.stateStore, 'Relógio — volta mais rápida');
  applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind: 'fastestLap', itemId });
  applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind: 'newIncident', itemId });
  const logger = createLogger({ level: 'silent' });
  const autoOut = startAutoOutScheduler({
    stateStore: inbox.stateStore,
    logger,
    startTimer: inbox.clock.startTimer,
    cancelTimer: inbox.clock.cancelTimer,
  });
  const runner = startEventRunner({
    stateStore: inbox.stateStore,
    logger,
    readCurrentTime: inbox.clock.readCurrentTime,
    startTimer: inbox.clock.startTimer,
    cancelTimer: inbox.clock.cancelTimer,
  });
  onTestFinished(() => {
    runner.stop();
    autoOut.stop();
    inbox.shutDown();
  });
  pollTheSimulator(inbox, { positions: buildPositionsWithCar31Leading() });
  return { ...inbox, itemId };
}

/** The program instance on the clock layer, if any. */
function readClockLayerOnAir(inbox: EventInboxOnTheStore) {
  return inbox.stateStore
    .readAllSlices()
    .instances.find((instance) => instance.layerId === 'clock' && instance.target === 'program');
}

describe('the event runner', () => {
  it('puts a fastest lap on air by itself and takes it off after its 8 s', () => {
    // Arrange: the runner watching, the clock layer empty.
    const inbox = openInboxWithTheRunner();

    // Act: car 47 sets a new fastest lap; then 8 seconds pass.
    pollTheSimulator(inbox, { positions: buildPositionsWithCar47FastestOnLap34() });
    const eventOnAirAtFirst = readEvent(inbox.stateStore, firstFastestLapEventId);
    const instanceAtFirst = readClockLayerOnAir(inbox);
    inbox.clock.letTimePass(8_000);

    // Assert: on air at once with the event's id, then off after its rule's 8 s, shown.
    expect(eventOnAirAtFirst?.status, 'the fastest lap must go on air by itself').toBe('onAir');
    expect(instanceAtFirst?.eventId, 'the instance must carry the event').toBe(
      firstFastestLapEventId,
    );
    expect(readClockLayerOnAir(inbox), 'it must leave after its 8 s').toBe(undefined);
    expect(readEvent(inbox.stateStore, firstFastestLapEventId)?.statusChanges, 'its life').toEqual([
      { status: 'queued', atMs: startMs },
      { status: 'onAir', atMs: startMs },
      { status: 'shown', atMs: startMs + 8_000 },
    ]);
  });

  it('shows two fastest laps one after the other, with the gap between them', () => {
    // Arrange: car 47's fastest lap on air.
    const inbox = openInboxWithTheRunner();
    pollTheSimulator(inbox, { positions: buildPositionsWithCar47FastestOnLap34() });

    // Act: 2 s later car 31 beats it; the first leaves at 8 s; then the gap passes,
    // looking 1 ms before its end and at its end.
    inbox.clock.letTimePass(2_000);
    pollTheSimulator(inbox, { positions: buildPositionsWithCar31FastestOnLap36() });
    const secondWhileTheFirstIsOnAir = readEvent(inbox.stateStore, secondFastestLapEventId)?.status;
    inbox.clock.letTimePass(6_000 + gapBetweenEventsOnALayerMs - 1);
    const secondJustBeforeTheGapEnds = readEvent(inbox.stateStore, secondFastestLapEventId)?.status;
    inbox.clock.letTimePass(1);

    // Assert: the second waited for the first and then for the whole gap, never overlapping.
    expect(secondWhileTheFirstIsOnAir, 'the second must wait for the first').toBe('queued');
    expect(secondJustBeforeTheGapEnds, 'the second must wait the whole gap').toBe('queued');
    expect(readEvent(inbox.stateStore, secondFastestLapEventId)?.statusChanges, 'its life').toEqual(
      [
        { status: 'queued', atMs: startMs + 2_000 },
        { status: 'onAir', atMs: startMs + 8_000 + gapBetweenEventsOnALayerMs },
      ],
    );
  });

  it("waits while the operator's own graphic is on the layer, however long", () => {
    // Arrange: the operator's own race clock taken by hand on the clock layer.
    const inbox = openInboxWithTheRunner();
    const plainClockItemId = createPlainClockItem(inbox.stateStore, 'Relógio da prova');
    applyOrThrow(inbox.stateStore, { type: 'takeItem', itemId: plainClockItemId });
    const instanceTakenByHand = readClockLayerOnAir(inbox);

    // Act: a fastest lap arrives; a minute passes; the operator clears the layer; the
    // gap passes.
    pollTheSimulator(inbox, { positions: buildPositionsWithCar47FastestOnLap34() });
    inbox.clock.letTimePass(60_000);
    const statusAfterAMinute = readEvent(inbox.stateStore, firstFastestLapEventId)?.status;
    const instanceAfterAMinute = readClockLayerOnAir(inbox);
    applyOrThrow(inbox.stateStore, { type: 'clearLayer', layerId: 'clock' });
    inbox.clock.letTimePass(gapBetweenEventsOnALayerMs);

    // Assert: the operator's graphic stayed for the whole minute; the fastest lap went on
    // only after the clear and the gap.
    expect(statusAfterAMinute, 'the fastest lap must wait').toBe('queued');
    expect(instanceAfterAMinute?.id, "the operator's graphic must not be replaced").toBe(
      instanceTakenByHand?.id,
    );
    expect(
      readEvent(inbox.stateStore, firstFastestLapEventId)?.statusChanges.at(-1),
      'then on',
    ).toEqual({ status: 'onAir', atMs: startMs + 60_000 + gapBetweenEventsOnALayerMs });
  });

  it('expires a fastest lap still queued after its 2 minutes, never showing it late', () => {
    // Arrange: the operator's own race clock taken by hand, keeping the layer busy.
    const inbox = openInboxWithTheRunner();
    const plainClockItemId = createPlainClockItem(inbox.stateStore, 'Relógio da prova');
    applyOrThrow(inbox.stateStore, { type: 'takeItem', itemId: plainClockItemId });

    // Act: a fastest lap arrives; exactly 2 minutes pass, then 1 ms more.
    pollTheSimulator(inbox, { positions: buildPositionsWithCar47FastestOnLap34() });
    inbox.clock.letTimePass(120_000);
    const statusAtTwoMinutes = readEvent(inbox.stateStore, firstFastestLapEventId)?.status;
    inbox.clock.letTimePass(1);

    // Assert: still queued at its max age, expired just past it, never on air.
    expect(statusAtTwoMinutes, 'at exactly 2 minutes it may still be shown').toBe('queued');
    expect(readEvent(inbox.stateStore, firstFastestLapEventId)?.statusChanges, 'its life').toEqual([
      { status: 'queued', atMs: startMs },
      { status: 'expired', atMs: startMs + 120_001 },
    ]);
  });

  it('expires a queued fastest lap that a newer one beat, so the old time never airs', () => {
    // Arrange: the operator's own race clock on the layer, keeping it busy.
    const inbox = openInboxWithTheRunner();
    const plainClockItemId = createPlainClockItem(inbox.stateStore, 'Relógio da prova');
    applyOrThrow(inbox.stateStore, { type: 'takeItem', itemId: plainClockItemId });

    // Act: car 47 sets a fastest lap, car 31 beats it 10 s later, then the operator clears
    // the layer and the gap passes.
    pollTheSimulator(inbox, { positions: buildPositionsWithCar47FastestOnLap34() });
    inbox.clock.letTimePass(10_000);
    pollTheSimulator(inbox, { positions: buildPositionsWithCar31FastestOnLap36() });
    applyOrThrow(inbox.stateStore, { type: 'clearLayer', layerId: 'clock' });
    inbox.clock.letTimePass(gapBetweenEventsOnALayerMs);

    // Assert: car 47's lap expired the moment car 31's arrived, and only car 31's aired.
    expect(
      readEvent(inbox.stateStore, firstFastestLapEventId)?.statusChanges,
      'superseded',
    ).toEqual([
      { status: 'queued', atMs: startMs },
      { status: 'expired', atMs: startMs + 10_000 },
    ]);
    expect(readEvent(inbox.stateStore, secondFastestLapEventId)?.status, 'the newer one airs').toBe(
      'onAir',
    );
  });

  it('never puts a penalty on air by itself, because its rule asks', () => {
    // Arrange: the runner watching, the incidents' baseline in.
    const inbox = openInboxWithTheRunner();
    pollTheSimulator(inbox, buildShapesWithCar31Leading([]));

    // Act: a penalty arrives; ten minutes pass.
    pollTheSimulator(inbox, buildShapesWithCar31Leading([buildStartPenaltyOfCar47()]));
    inbox.clock.letTimePass(10 * 60_000);

    // Assert: still pending, nothing on air.
    expect(
      readEvent(inbox.stateStore, 'simulador-enduro:incident:ocorrencia-0007')?.status,
      'a penalty waits for the operator',
    ).toBe('pending');
    expect(readClockLayerOnAir(inbox), 'nothing may go on air').toBe(undefined);
  });
});

describe('the gap between two events on a layer', () => {
  it("is the theme's --motion-out plus one second", () => {
    // Arrange: the theme's tokens, as the renderer loads them.
    const tokensUrl = new URL('../../../../../packages/theme/ardosia/tokens.css', import.meta.url);
    const tokens = readFileSync(tokensUrl, 'utf8');

    // Act: read --motion-out.
    const motionOutMs = Number(/--motion-out:\s*(\d+)ms;/.exec(tokens)?.[1]);

    // Assert: the runner's gap is that plus a second, so a notice is fully out (and the
    // screen has had a breath) before the next one comes in.
    expect(motionOutMs, 'the theme must declare --motion-out in ms').toBe(250);
    expect(gapBetweenEventsOnALayerMs, 'the gap must follow the token').toBe(motionOutMs + 1_000);
  });
});
