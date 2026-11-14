// Test support for the automatic runner of the event inbox through a real store: the inbox
// of eventInboxOnTheStore.testSupport.ts with the auto-out and the runner started on its
// clock, and the two fastest laps the runner's tests and the pause's tests share. Every
// function builds fresh objects on each call.
import type { PositionsShape } from '@bajaovrlay/shared';
import { onTestFinished } from 'vitest';

import { createLogger } from '../../core/logger/createLogger.js';
import { startAutoOutScheduler } from '../../core/store/autoOut.js';
import {
  buildPositionsInOrder,
  buildPositionsWithCar31Leading,
} from './detectors/raceSnapshots.testSupport.js';
import {
  applyOrThrow,
  createClockItemForEvents,
  type EventInboxOnTheStore,
  openEventInboxOnTheStore,
  pollTheSimulator,
  startOfTheTests,
} from './eventInboxOnTheStore.testSupport.js';
import { startEventRunner } from './eventRunner.js';

/** Car 47's fastest lap, 4:37,900 on its lap 34, as the inbox names it. */
export const firstFastestLapEventId = 'simulador-enduro:fastestLap:enduro-2027-nacional:47:34';

/** Car 31's fastest lap after it, 4:37,500 on its lap 36. */
export const secondFastestLapEventId = 'simulador-enduro:fastestLap:enduro-2027-nacional:31:36';

/** The moment the tests start, in ms. */
export const startMs = Date.parse(startOfTheTests);

/** The positions after car 47 set 4:37,900 on its lap 34. */
export function buildPositionsWithCar47FastestOnLap34(): PositionsShape {
  return buildPositionsInOrder([
    { carNumber: 31, laps: 35, bestLapMs: 278_291, bestLapNumber: 29 },
    { carNumber: 38, laps: 34, bestLapMs: 279_596, bestLapNumber: 12 },
    { carNumber: 47, laps: 34, bestLapMs: 277_900, bestLapNumber: 34 },
  ]);
}

/** The positions after car 31 answered with 4:37,500 on its lap 36. */
export function buildPositionsWithCar31FastestOnLap36(): PositionsShape {
  return buildPositionsInOrder([
    { carNumber: 31, laps: 36, bestLapMs: 277_500, bestLapNumber: 36 },
    { carNumber: 38, laps: 35, bestLapMs: 279_596, bestLapNumber: 12 },
    { carNumber: 47, laps: 34, bestLapMs: 277_900, bestLapNumber: 34 },
  ]);
}

/** The inbox with the runner started, and the id of the item its rules show events with. */
export type InboxWithTheRunner = EventInboxOnTheStore & { itemId: string };

/**
 * The inbox with the auto-out and the runner started on its clock, a race clock item
 * ("Relógio — volta mais rápida", on the clock layer) as the fastest lap's and the
 * incidents' item, and the simulator's baseline poll in. Everything is stopped when the
 * test finishes.
 */
export function openInboxWithTheRunner(): InboxWithTheRunner {
  const inbox = openEventInboxOnTheStore();
  const itemId = createClockItemForEvents(inbox.stateStore, 'Relógio — volta mais rápida');
  applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind: 'fastestLap', itemId });
  applyOrThrow(inbox.stateStore, { type: 'updateEventRule', kind: 'newIncident', itemId });
  const inboxWithTheRunner = startTheRunnerAndTheAutoOut(inbox, itemId);
  pollTheSimulator(inboxWithTheRunner, { positions: buildPositionsWithCar31Leading() });
  return inboxWithTheRunner;
}

/**
 * A server restart: shuts the inbox, its runner and its auto-out down, opens the store
 * again on the same database file and clock, and starts the runner and the auto-out again.
 * The item and the rules come back from the database, as they do in production.
 */
export function restartTheServerWithTheRunner(inbox: InboxWithTheRunner): InboxWithTheRunner {
  inbox.shutDown();
  const inboxAfterTheRestart = openEventInboxOnTheStore(inbox);
  return startTheRunnerAndTheAutoOut(inboxAfterTheRestart, inbox.itemId);
}

/**
 * Starts the auto-out and the runner on the inbox's clock. Its shutDown stops them before
 * closing the database, so that no timer of theirs can reach a closed store; it runs once,
 * whether the test calls it (a restart) or the test's end does.
 */
function startTheRunnerAndTheAutoOut(
  inbox: EventInboxOnTheStore,
  itemId: string,
): InboxWithTheRunner {
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
  let isShutDown = false;
  const shutDownEverything = () => {
    if (isShutDown) {
      return;
    }
    isShutDown = true;
    runner.stop();
    autoOut.stop();
    inbox.shutDown();
  };
  onTestFinished(shutDownEverything);
  return { ...inbox, itemId, shutDown: shutDownEverything };
}

/** The program instance on the clock layer, if any. */
export function readClockLayerOnAir(inbox: EventInboxOnTheStore) {
  return inbox.stateStore
    .readAllSlices()
    .instances.find((instance) => instance.layerId === 'clock' && instance.target === 'program');
}
