// Test support for the event inbox through a real store: a store on a temporary database
// with the race clock built, the seeded simulator turned on and polled by hand (the poller
// is not started, so no poll arrives that the test did not send), and the event detection
// watching it with a clock and timers the test moves by hand. Every function builds fresh
// objects on each call.
import type { DataSnapshotShapes, InboxEvent, ItemFields } from '@bajaovrlay/shared';

import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../../core/db/temporaryDatabase.testSupport.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { buildDataSourcePollerActor } from '../../core/store/commandActors.js';
import { createStateStore, type StateStore } from '../../core/store/createStateStore.js';
import {
  type ClockAndTimersMovedByHand,
  createClockAndTimersMovedByHand,
} from './clockAndTimersMovedByHand.testSupport.js';
import { startEventDetection } from './eventDetection.js';

/** The operator's page, which approves, dismisses and types events. */
export const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';

/** The seeded simulator every new database has. */
export const enduroSimulatorId = 'simulador-enduro';

/** 14:00:00 UTC on 14 August 2027, the enduro day: where the tests' clock starts. */
export const startOfTheTests = '2027-08-14T14:00:00.000Z';

/** The id the store gives an event the operator types, in these tests. */
export const typedEventId = '7d0e4a52-9c1b-4f36-8e2a-5b3c1d9f0a68';

/** A store with the inbox's detection, its database file, and the clock that moves both. */
export type EventInboxOnTheStore = {
  stateStore: StateStore;
  clock: ClockAndTimersMovedByHand;
  databasePath: string;
  graphicPackagesFolder: string;
  /** Closes the database and stops the detection, as a server shutting down does. */
  shutDown: () => void;
};

/**
 * Opens a store with the event detection on a new temporary database (or the one given,
 * for a restart), its clock at 14:00 (or the clock given), and the simulator turned on.
 */
export function openEventInboxOnTheStore(
  restartOf?: Pick<EventInboxOnTheStore, 'databasePath' | 'graphicPackagesFolder' | 'clock'>,
): EventInboxOnTheStore {
  const databasePath = restartOf?.databasePath ?? createTemporaryDatabasePath();
  const graphicPackagesFolder =
    restartOf?.graphicPackagesFolder ?? createGraphicsFolderWithBuiltRaceClock();
  const clock = restartOf?.clock ?? createClockAndTimersMovedByHand(startOfTheTests);
  const database = openDatabaseForTests(databasePath);
  const stateStore = createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder,
    readCurrentTime: clock.readCurrentTime,
    // The store makes one for every command and only createManualEvent uses it; a fixed
    // id is enough, since no test types more than one event on a store.
    createEventId: () => typedEventId,
  });
  const detection = startEventDetection({
    stateStore,
    logger: createLogger({ level: 'silent' }),
    startTimer: clock.startTimer,
    cancelTimer: clock.cancelTimer,
  });
  applyOrThrow(stateStore, {
    type: 'setDataSourceEnabled',
    sourceId: enduroSimulatorId,
    isEnabled: true,
  });
  return {
    stateStore,
    clock,
    databasePath,
    graphicPackagesFolder,
    shutDown: () => {
      detection.stop();
      database.$client.close();
    },
  };
}

/** Shuts the store down and opens it again on the same database: a server restart. */
export function restartTheServer(inbox: EventInboxOnTheStore): EventInboxOnTheStore {
  inbox.shutDown();
  return openEventInboxOnTheStore(inbox);
}

/**
 * Records one good poll of the simulator carrying the shapes given, as its poller, then
 * lets the detection send what it found (it sends from a 0 ms timer).
 */
export function pollTheSimulator(inbox: EventInboxOnTheStore, shapes: DataSnapshotShapes): void {
  applyOrThrow(
    inbox.stateStore,
    {
      type: 'recordDataSourcePoll',
      sourceId: enduroSimulatorId,
      result: { ok: true, shapes, receivedAtMs: inbox.clock.readCurrentTime().getTime() },
    },
    buildDataSourcePollerActor(enduroSimulatorId),
  );
  inbox.clock.runTheTimersDueNow();
}

/**
 * Creates a race clock item on the clock layer (the only graphic these tests build), with
 * the fields given laid over a typed green enduro, and answers its id: the item the rules
 * show events with in these tests.
 */
export function createClockItemForEvents(
  stateStore: StateStore,
  label: string,
  fields: ItemFields = {},
): string {
  const outcome = stateStore.applyCommand(
    {
      type: 'createItem',
      home: { kind: 'quickFire', panelId: 'atalhos' },
      graphicId: 'race-clock',
      layerId: 'clock',
      label,
      fields: {
        sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
        state: { kind: 'literal', value: 'green' },
        clockMode: { kind: 'literal', value: 'remaining' },
        referenceTimeMs: { kind: 'literal', value: 4_560_000 },
        referenceWallClockMs: { kind: 'literal', value: Date.parse(startOfTheTests) },
        running: { kind: 'literal', value: true },
        ...fields,
      },
    },
    operatorActor,
  );
  if (!outcome.ok || outcome.createdItemId === undefined) {
    throw new Error(`createItem was refused: ${JSON.stringify(outcome)}`);
  }
  return outcome.createdItemId;
}

/** The inbox event of this id, read from the store. */
export function readEvent(stateStore: StateStore, eventId: string): InboxEvent | undefined {
  return stateStore.readAllSlices().events.find((event) => event.eventId === eventId);
}

/** The commands of the event log's newest rows, oldest first. */
export function readCommandsOfNewestLogRows(stateStore: StateStore, rowCount: number): string[] {
  return stateStore
    .readAllSlices()
    .eventLog.slice(-rowCount)
    .map((row) => row.command);
}

/** Sends one command to the store (as the operator unless told); throws on a refusal. */
export function applyOrThrow(
  stateStore: StateStore,
  command: Record<string, unknown>,
  actor: string = operatorActor,
): void {
  const outcome = stateStore.applyCommand(command, actor);
  if (!outcome.ok) {
    throw new Error(`The store refused ${String(command.type)}: ${JSON.stringify(outcome)}`);
  }
}
