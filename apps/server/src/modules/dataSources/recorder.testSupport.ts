// Test support for the recorder tests: a temporary recordings folder (removed after the
// test), a real store on a temporary SQLite file whose clock the test moves by hand, a
// recorder watching that store, timers the test runs by hand, and the recording commands
// of the operator and the polls the simulator's poller sends (turning the simulator on
// and off is in enduroSimulatorCommands.testSupport.ts). Every call builds new objects,
// its own database and its own folder, so no test can change what another test sees.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Recording } from '@bajaovrlay/shared';
import { onTestFinished } from 'vitest';

import type { ServerDatabase } from '../../core/db/openDatabase.js';
import { openTemporaryDatabase } from '../../core/db/temporaryDatabase.testSupport.js';
import { createLogger, type ServerLogger } from '../../core/logger/createLogger.js';
import { missingGraphicsFolderPath } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { buildDataSourcePollerActor } from '../../core/store/commandActors.js';
import { createStateStore, type StateStore } from '../../core/store/createStateStore.js';
import {
  enduroSimulatorId,
  operatorActor,
  startOfTheEnduroMs,
} from './enduroSimulatorCommands.testSupport.js';
import { type AppendLineToFile, startDataSourceRecorder } from './recorder.js';
import type { RecordingCaps } from './recordingCaps.js';
import { buildGreenFlagSessionAt } from './reducers/dataSourceSlices.testSupport.js';

/** The file a recording started at 14:00 is written to (decision D10: ':' made '-'). */
export const fileNameOfTheRecordingStartedAt1400 = '2027-08-14T14-00-00.000Z.jsonl';

/** Makes a new, empty recordings folder in the system's temporary folder; removed after the test. */
export function createTemporaryRecordingsFolder(): string {
  const recordingsFolder = mkdtempSync(join(tmpdir(), 'bajaovrlay-gravacoes-'));
  onTestFinished(() => rmSync(recordingsFolder, { recursive: true, force: true }));
  return recordingsFolder;
}

/**
 * Timers that only run when the test says so. The recorder starts two kinds: 0 ms timers
 * that defer its commands out of the store's listener (a stop, a progress report), and
 * the long wait of a recording's duration cap. `runEveryDeferredTimer` runs the 0 ms
 * ones, in the order they were started (and any they start in turn, which wait for the
 * next call); `runEveryTimerOfDelay` runs the ones started with that delay.
 */
export function createTimersRunByHand() {
  const pendingTimers = new Map<number, { onTimeIsUp: () => void; delayInMilliseconds: number }>();
  let nextTimerHandle = 1;

  /** Runs the pending timers started with this delay, taking them off the list first. */
  function runEveryTimerOfDelay(delayInMilliseconds: number): void {
    const timersToRun = [...pendingTimers.entries()].filter(
      ([, timer]) => timer.delayInMilliseconds === delayInMilliseconds,
    );
    for (const [timerHandle] of timersToRun) {
      pendingTimers.delete(timerHandle);
    }
    for (const [, timer] of timersToRun) {
      timer.onTimeIsUp();
    }
  }

  return {
    startTimer: (onTimeIsUp: () => void, delayInMilliseconds: number): unknown => {
      const timerHandle = nextTimerHandle;
      nextTimerHandle += 1;
      pendingTimers.set(timerHandle, { onTimeIsUp, delayInMilliseconds });
      return timerHandle;
    },
    cancelTimer: (timerHandle: unknown): void => {
      pendingTimers.delete(timerHandle as number);
    },
    countPendingTimers: () => pendingTimers.size,
    countPendingTimersOfDelay: (delayInMilliseconds: number) =>
      [...pendingTimers.values()].filter(
        (timer) => timer.delayInMilliseconds === delayInMilliseconds,
      ).length,
    runEveryDeferredTimer: () => runEveryTimerOfDelay(0),
    runEveryTimerOfDelay,
  };
}

/**
 * A file writer that takes the first lines it is given and then fails as a full disk
 * does, for every line after them. Counts how often it was called.
 */
export function createDiskThatFillsAfterLines(lineCountThatFits: number) {
  let numberOfWriteAttempts = 0;
  return {
    appendLine: (): void => {
      numberOfWriteAttempts += 1;
      if (numberOfWriteAttempts > lineCountThatFits) {
        throw new Error('ENOSPC: no space left on device, write');
      }
    },
    countWriteAttempts: () => numberOfWriteAttempts,
  };
}

/**
 * Starts what every recorder test needs: a recordings folder, a store on a fresh database
 * at 14:00 (the test moves the clock with `moveClockTo`), and a recorder watching it with
 * timers run by hand. `appendLine` replaces the recorder's file writing, to make it fail;
 * `logger` replaces the silent logger, to read what was logged; `recordingCaps` replaces
 * the 6 h and 300 MB caps with small ones.
 */
export function startRecorderWatchingAStore(
  options: {
    appendLine?: AppendLineToFile;
    logger?: ServerLogger;
    recordingCaps?: RecordingCaps;
  } = {},
) {
  const recordingsFolder = createTemporaryRecordingsFolder();
  const { database } = openTemporaryDatabase();
  const clock = { nowMs: startOfTheEnduroMs };
  const stateStore = openStoreOnTheDatabaseAndFolder(database, recordingsFolder, () => clock.nowMs);
  const timers = createTimersRunByHand();
  const logger = options.logger ?? createLogger({ level: 'silent' });
  const recorder = startDataSourceRecorder({
    stateStore,
    logger,
    recordingsFolder,
    startTimer: timers.startTimer,
    cancelTimer: timers.cancelTimer,
    appendLine: options.appendLine,
    recordingCaps: options.recordingCaps,
  });
  onTestFinished(() => recorder.stop());
  return {
    stateStore,
    recorder,
    timers,
    database,
    recordingsFolder,
    moveClockTo: (momentMs: number) => {
      clock.nowMs = momentMs;
    },
  };
}

/** Opens a store on a database and a recordings folder, as the server does at boot. */
export function openStoreOnTheDatabaseAndFolder(
  database: ServerDatabase,
  recordingsFolder: string,
  readNowMs: () => number,
): StateStore {
  return createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: missingGraphicsFolderPath,
    recordingsFolder,
    readCurrentTime: () => new Date(readNowMs()),
  });
}

/** The operator presses "Gravar" on the simulator. */
export function pressRecordOnTheSimulator(stateStore: StateStore): void {
  stateStore.applyCommand({ type: 'startRecording', sourceId: enduroSimulatorId }, operatorActor);
}

/** The operator presses "Parar gravação" on the simulator. */
export function pressStopRecordingOnTheSimulator(stateStore: StateStore): void {
  stateStore.applyCommand({ type: 'stopRecording', sourceId: enduroSimulatorId }, operatorActor);
}

/** The operator deletes the simulator. */
export function deleteTheSimulator(stateStore: StateStore): void {
  stateStore.applyCommand({ type: 'deleteDataSource', sourceId: enduroSimulatorId }, operatorActor);
}

/** The simulator's poller hands the store a good poll: the green-flag session of a moment. */
export function sendAGoodSimulatorPollAt(stateStore: StateStore, receivedAtMs: number): void {
  sendASimulatorPollOfTheSessionOf(stateStore, receivedAtMs, receivedAtMs);
}

/**
 * The simulator's poller hands the store a good poll received at one moment that carries
 * the session as it was at another (to repeat data already stored).
 */
export function sendASimulatorPollOfTheSessionOf(
  stateStore: StateStore,
  sessionMomentMs: number,
  receivedAtMs: number,
): void {
  stateStore.applyCommand(
    {
      type: 'recordDataSourcePoll',
      sourceId: enduroSimulatorId,
      result: {
        ok: true,
        shapes: { session: buildGreenFlagSessionAt(sessionMomentMs) },
        receivedAtMs,
      },
    },
    buildDataSourcePollerActor(enduroSimulatorId),
  );
}

/** The simulator's poller hands the store a failed poll ("Falha simulada.") at a moment. */
export function sendAFailedSimulatorPollAt(stateStore: StateStore, attemptedAtMs: number): void {
  stateStore.applyCommand(
    {
      type: 'recordDataSourcePoll',
      sourceId: enduroSimulatorId,
      result: { ok: false, error: 'Falha simulada.', attemptedAtMs },
    },
    buildDataSourcePollerActor(enduroSimulatorId),
  );
}

/**
 * Reads the lines of a recording file back as JSON, one object per line. A file that
 * does not exist reads as no line (nothing was ever written).
 */
export function readRecordedLines(filePath: string): unknown[] {
  if (!existsSync(filePath)) {
    return [];
  }
  const lineTexts = readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((lineText) => lineText !== '');
  return lineTexts.map((lineText) => JSON.parse(lineText) as unknown);
}

/** Reads the `atMs` of every line of a recording file, in file order. */
export function readRecordedMomentsMs(filePath: string): number[] {
  return readRecordedLines(filePath).map((line) => (line as { atMs: number }).atMs);
}

/** Lists the file names in a source's folder of the recordings folder (none when absent). */
export function listRecordingFilesOfSource(recordingsFolder: string, sourceId: string): string[] {
  const sourceFolder = join(recordingsFolder, sourceId);
  return existsSync(sourceFolder) ? readdirSync(sourceFolder).sort() : [];
}

/** Reads the one recording the store lists; fails the test if there is not exactly one. */
export function readTheOnlyRecording(stateStore: StateStore): Recording {
  const recordings = stateStore.readAllSlices().recordings;
  const [onlyRecording] = recordings;
  if (recordings.length !== 1 || onlyRecording === undefined) {
    throw new Error(`expected exactly one recording, found ${String(recordings.length)}`);
  }
  return onlyRecording;
}
