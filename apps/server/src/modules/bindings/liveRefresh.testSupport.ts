// Test support for the live refresh through a real store: a store on a temporary
// database with the race clock built, the seeded simulator turned on and polled by hand
// (the poller is not started, so no poll arrives that the test did not send), and the
// refresher started with a timer the test runs by hand. Every function builds fresh
// objects on each call.
import type { ItemFields, SessionShape } from '@bajaovrlay/shared';

import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../../core/db/temporaryDatabase.testSupport.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { buildDataSourcePollerActor } from '../../core/store/commandActors.js';
import { createStateStore, type StateStore } from '../../core/store/createStateStore.js';
import { startLiveRefresher } from './liveRefresher.js';

/** The operator's page, which prepares and takes the items. */
export const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';

/** The seeded simulator every new database has. */
export const enduroSimulatorId = 'simulador-enduro';

/** 14:00:00 UTC on 14 August 2027, the enduro day: the store's clock in these tests. */
export const momentOfTheCommandsMs = Date.parse('2027-08-14T14:00:00.000Z');

/**
 * The enduro session as the simulator sends it under green, its clock counting down
 * from 1:16:00 at 14:00:00 and the leader on 34 laps, with the changes given.
 */
export function buildEnduroSession(changes: Partial<SessionShape> = {}): SessionShape {
  return {
    sessionId: 'enduro-2027-nacional',
    eventName: 'Baja SAE Brasil 2027 — Etapa Nacional',
    sessionName: 'Enduro de Resistência',
    sessionKind: 'enduro',
    state: 'green',
    clock: {
      clockMode: 'remaining',
      referenceTimeMs: 4_560_000,
      referenceWallClockMs: momentOfTheCommandsMs,
      running: true,
    },
    scheduledDurationMs: 14_400_000,
    lapsCompletedByLeader: 34,
    updatedAtMs: momentOfTheCommandsMs,
    ...changes,
  };
}

/**
 * Timers that run only when the test says so. The refresher starts one 0 ms timer per
 * pass; `runThePendingRefresh` runs it.
 */
export function createRefreshTimerRunByHand() {
  const pendingTimers = new Map<number, () => void>();
  let nextTimerHandle = 1;
  return {
    startTimer: (onTimeIsUp: () => void): unknown => {
      const timerHandle = nextTimerHandle;
      nextTimerHandle += 1;
      pendingTimers.set(timerHandle, onTimeIsUp);
      return timerHandle;
    },
    cancelTimer: (timerHandle: unknown): void => {
      pendingTimers.delete(timerHandle as number);
    },
    runThePendingRefresh: (): void => {
      const timersToRun = [...pendingTimers.values()];
      pendingTimers.clear();
      for (const onTimeIsUp of timersToRun) {
        onTimeIsUp();
      }
    },
  };
}

/**
 * A store on a temporary database with the race clock built (or the graphics folder
 * given), the seeded simulator on, and the refresher watching it with a hand-run timer.
 */
export function openStoreWithTheRefresher(graphicPackagesFolder?: string) {
  const database = openDatabaseForTests(createTemporaryDatabasePath());
  const stateStore = createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: graphicPackagesFolder ?? createGraphicsFolderWithBuiltRaceClock(),
    readCurrentTime: () => new Date(momentOfTheCommandsMs),
  });
  const refreshTimer = createRefreshTimerRunByHand();
  const refresher = startLiveRefresher({
    stateStore,
    logger: createLogger({ level: 'silent' }),
    startTimer: refreshTimer.startTimer,
    cancelTimer: refreshTimer.cancelTimer,
  });
  applyOrThrow(stateStore, {
    type: 'setDataSourceEnabled',
    sourceId: enduroSimulatorId,
    isEnabled: true,
  });
  return { stateStore, refreshTimer, refresher };
}

/** Records one good poll of the simulator carrying the session given, as its poller. */
export function pollTheSimulatorWithSession(stateStore: StateStore, session: SessionShape): void {
  applyOrThrow(
    stateStore,
    {
      type: 'recordDataSourcePoll',
      sourceId: enduroSimulatorId,
      result: { ok: true, shapes: { session }, receivedAtMs: session.updatedAtMs },
    },
    buildDataSourcePollerActor(enduroSimulatorId),
  );
}

/** A binding to the simulator's session at the path given, live unless said otherwise. */
export function buildSessionBinding(path: string, isLive = true) {
  return {
    kind: 'binding' as const,
    sourceId: enduroSimulatorId,
    shapeKey: 'session' as const,
    path,
    isLive,
  };
}

/**
 * Creates a race clock item with the fields given (the rest typed as a green enduro) on
 * the layer given, and answers its id.
 */
export function createClockItem(
  stateStore: StateStore,
  label: string,
  layerId: string,
  fields: ItemFields,
): string {
  const outcome = stateStore.applyCommand(
    {
      type: 'createItem',
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
      graphicId: 'race-clock',
      layerId,
      label,
      fields: {
        sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
        state: { kind: 'literal', value: 'green' },
        clockMode: { kind: 'literal', value: 'remaining' },
        referenceTimeMs: { kind: 'literal', value: 4_560_000 },
        referenceWallClockMs: { kind: 'literal', value: momentOfTheCommandsMs },
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

/** The instance on this layer and output, read from the store. */
export function readInstanceOn(stateStore: StateStore, layerId: string, target: string) {
  return stateStore
    .readAllSlices()
    .instances.find((instance) => instance.layerId === layerId && instance.target === target);
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
