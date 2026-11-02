// Test support: a real store on a temporary SQLite file with the server's real OBS
// connection, pointed at a fake OBS (fakeObsWebSocketServer.testSupport.ts), its log lines
// kept in memory and its two waits moved by hand. Every call builds its own store, fake
// OBS, timers and logger, so no test can change what another test sees; the connection
// is stopped when the test ends.
import type { ObsSlice } from '@bajaovrlay/shared';
import { onTestFinished } from 'vitest';

import { openTemporaryDatabase } from '../../core/db/temporaryDatabase.testSupport.js';
import {
  createRecordingLogger,
  type RecordedLogLine,
} from '../../core/logger/recordingLogger.testSupport.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from '../../core/store/createStateStore.js';
import { type FakeObs, type FakeObsSetup, startFakeObs } from './fakeObsWebSocketServer.testSupport.js';
import { type ObsConnection, startObsConnection } from './obsConnection.js';
import { createTimersMovedByHand, type TimersMovedByHand } from './timersMovedByHand.testSupport.js';

/** The operator's actor in these tests: one control page's connection. */
export const operatorActor = 'operador:conexao-3';

/** The password set in the fake OBS's WebSocket Server Settings. */
export const obsPasswordOfTheStreamPc = 'senha-do-obs-pista-2026';

/**
 * The stream PC's OBS on race day: four scenes, the break scene on Program before the
 * session starts, Studio Mode off.
 */
export const raceDayObsSetup: FakeObsSetup = {
  password: obsPasswordOfTheStreamPc,
  sceneNames: ['Pista', 'Box', 'Pódio', 'Intervalo'],
  programSceneName: 'Intervalo',
  isStudioModeOn: false,
  previewSceneName: 'Pista',
};

/** A store and the OBS connection beside it, with what a test needs to drive and read them. */
export type StoreWithObsConnection = {
  store: StateStore;
  obsConnection: ObsConnection;
  timers: TimersMovedByHand;
  readLogLines: () => RecordedLogLine[];
};

/** Creates a store on a fresh database, with a race clock graphic, logging to `logger`. */
function createStoreForObsTests(logger: ReturnType<typeof createRecordingLogger>['logger']) {
  const { database } = openTemporaryDatabase();
  return createStateStore({
    database,
    logger,
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
  });
}

/**
 * Starts a store and the server's OBS connection to `address` with `password` (undefined:
 * BAJAOVRLAY_OBS_PASSWORD not set), as the boot does. It does not wait for OBS to answer.
 */
export function startStoreWithObsConnectionTo(
  address: string,
  password: string | undefined,
): StoreWithObsConnection {
  const { logger, readRecordedLines } = createRecordingLogger();
  const store = createStoreForObsTests(logger);
  const timers = createTimersMovedByHand();
  const obsConnection = startObsConnection({
    stateStore: store,
    logger,
    settings: { url: address, password },
    startTimer: timers.startTimer,
    cancelTimer: timers.cancelTimer,
  });
  onTestFinished(() => obsConnection.stop());
  return { store, obsConnection, timers, readLogLines: readRecordedLines };
}

/**
 * Starts a fake OBS with `setup` (race day's when left out), a store and the server's OBS
 * connection to it with the right password, and waits until the slice says connected.
 */
export async function startStoreConnectedToFakeObs(setup: FakeObsSetup = raceDayObsSetup) {
  const fakeObs: FakeObs = await startFakeObs(setup);
  const storeWithObs = startStoreWithObsConnectionTo(fakeObs.address, setup.password ?? undefined);
  await waitForTheObsSlice(storeWithObs.store, (obs) => obs.connectionState === 'conectado');
  return { ...storeWithObs, fakeObs };
}

/**
 * Resolves with the `obs` slice as soon as it passes `isWhatTheTestWaitsFor`: at once if it
 * already does, otherwise at the first change that makes it. A test waits on the slice
 * itself, never on the clock; Vitest's own time limit ends a wait that never comes.
 */
export function waitForTheObsSlice(
  store: StateStore,
  isWhatTheTestWaitsFor: (obs: ObsSlice) => boolean,
): Promise<ObsSlice> {
  const obsNow = store.readAllSlices().obs;
  if (isWhatTheTestWaitsFor(obsNow)) {
    return Promise.resolve(obsNow);
  }
  return new Promise((resolve) => {
    const stopWatching = store.subscribeToSliceChanges((changedSliceNames, slices) => {
      if (changedSliceNames.includes('obs') && isWhatTheTestWaitsFor(slices.obs)) {
        stopWatching();
        resolve(slices.obs);
      }
    });
  });
}

/** Reads the log lines a test cares about: level and message, in order. */
export function readLevelAndMessageOfEachLine(readLogLines: () => RecordedLogLine[]): string[] {
  return readLogLines()
    .filter((line) => line.message.includes('OBS'))
    .map((line) => `${line.level} ${line.message}`);
}
