// Test support for the poller tests: a real store on a temporary SQLite file (so the
// seeded "Simulador — Enduro" is there, off), fake timers and a fake clock that start at
// 14:00 on the enduro day, a poller watching the store, and hand-written fake simulator
// adapters, each named for what it does. Every call builds new objects and its own
// database, so no test can change what another test sees.
import { type DataSource, type SimulatorConfig, SimulatorConfigSchema } from '@bajaovrlay/shared';
import { onTestFinished, vi } from 'vitest';

import { openTemporaryDatabase } from '../../core/db/temporaryDatabase.testSupport.js';
import { createLogger, type ServerLogger } from '../../core/logger/createLogger.js';
import { missingGraphicsFolderPath } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from '../../core/store/createStateStore.js';
import type { DataSourceAdapters } from './adapters/createDataSourceAdapters.js';
import type { DataSourceAdapter, PolledShapes } from './adapters/dataSourceAdapter.js';
import { startDataSourcePoller } from './poller.js';
import { buildGreenFlagSessionAt } from './reducers/dataSourceSlices.testSupport.js';

export const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';
export const enduroSimulatorId = 'simulador-enduro';
/** 14:00 UTC on 14 August 2027: the moment every poller test starts at. */
export const startOfTheEnduroMs = Date.parse('2027-08-14T14:00:00.000Z');

/** One command the poller handed the store, and the actor it signed it with. */
export type CommandSentByThePoller = { command: unknown; actor: string };

/**
 * Starts what every poller test needs: fake timers and clock at 14:00 (put back after the
 * test), a store on a fresh database, and a poller using the given adapters. The poller
 * sees the store through a spy that keeps every command it sends, so a test can check
 * that a late answer was dropped. `wrapStore` lets a test hand the poller a store that
 * fails in a chosen way. `isSimulatorOnBeforeThePollerStarts` turns the simulator on
 * before the poller starts. `isSimulatorLeftOnAcrossARestart` goes further: the simulator
 * is turned on in a first store, and the poller watches a second store opened on the same
 * database, as after a real restart (the source comes back stale, with no error).
 */
export function startPollerWatchingTheStore(options: {
  adapters: DataSourceAdapters;
  logger?: ServerLogger;
  isSimulatorOnBeforeThePollerStarts?: boolean;
  isSimulatorLeftOnAcrossARestart?: boolean;
  wrapStore?: (store: StateStore) => StateStore;
}) {
  vi.useFakeTimers();
  vi.setSystemTime(startOfTheEnduroMs);
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const { database } = openTemporaryDatabase();
  const openStoreOnTheDatabase = () =>
    createStateStore({
      database,
      logger: createLogger({ level: 'silent' }),
      graphicPackagesFolder: missingGraphicsFolderPath,
    });
  let stateStore = openStoreOnTheDatabase();
  if (options.isSimulatorOnBeforeThePollerStarts === true) {
    turnTheSimulatorOn(stateStore);
  }
  if (options.isSimulatorLeftOnAcrossARestart === true) {
    turnTheSimulatorOn(stateStore);
    stateStore = openStoreOnTheDatabase();
  }
  const commandsSentByThePoller: CommandSentByThePoller[] = [];
  const storeSeenByThePoller = options.wrapStore ? options.wrapStore(stateStore) : stateStore;
  const spyingStore: StateStore = {
    ...storeSeenByThePoller,
    applyCommand: (command, actor) => {
      commandsSentByThePoller.push({ command, actor });
      return storeSeenByThePoller.applyCommand(command, actor);
    },
  };
  const poller = startDataSourcePoller({
    stateStore: spyingStore,
    logger: options.logger ?? createLogger({ level: 'silent' }),
    adapters: options.adapters,
  });
  onTestFinished(() => poller.stop());
  return {
    stateStore,
    poller,
    readCommandsSentByThePoller: () => [...commandsSentByThePoller],
  };
}

/** The operator turns "Simulador — Enduro" on. */
export function turnTheSimulatorOn(stateStore: StateStore): void {
  stateStore.applyCommand(
    { type: 'setDataSourceEnabled', sourceId: enduroSimulatorId, isEnabled: true },
    operatorActor,
  );
}

/** The operator turns "Simulador — Enduro" off. */
export function turnTheSimulatorOff(stateStore: StateStore): void {
  stateStore.applyCommand(
    { type: 'setDataSourceEnabled', sourceId: enduroSimulatorId, isEnabled: false },
    operatorActor,
  );
}

/** The operator changes how often the simulator is polled ("Editar"). */
export function setTheSimulatorPollInterval(stateStore: StateStore, pollIntervalMs: number): void {
  stateStore.applyCommand(
    { type: 'updateDataSource', sourceId: enduroSimulatorId, pollIntervalMs },
    operatorActor,
  );
}

/** The operator presses "Atualizar agora" on the simulator. */
export function pressPollNowOnTheSimulator(stateStore: StateStore): void {
  stateStore.applyCommand(
    { type: 'pollDataSourceNow', sourceId: enduroSimulatorId },
    operatorActor,
  );
}

/** Reads "Simulador — Enduro" as the store holds it now; fails the test if it is gone. */
export function readTheSimulator(stateStore: StateStore): DataSource {
  const simulator = stateStore
    .readAllSlices()
    .dataSources.find((source) => source.id === enduroSimulatorId);
  if (simulator === undefined) {
    throw new Error('the seeded simulator is missing from the store');
  }
  return simulator;
}

/** Counts the poll results (recordDataSourcePoll) among the commands the poller sent. */
export function countPollResults(commandsSent: CommandSentByThePoller[]): number {
  return commandsSent.filter((sent) => isPollResultCommand(sent.command)).length;
}

/** Tells whether a command handed to applyCommand is a poll result (recordDataSourcePoll). */
export function isPollResultCommand(command: unknown): boolean {
  return readCommandType(command) === 'recordDataSourcePoll';
}

/** Reads the `type` of a command handed to applyCommand, or '' when it has none. */
function readCommandType(command: unknown): string {
  const hasAType = typeof command === 'object' && command !== null && 'type' in command;
  return hasAType ? String(command.type) : '';
}

/** Builds a fake simulator adapter around the given pollOnce. */
function buildFakeSimulatorAdapter(
  pollOnce: DataSourceAdapter<SimulatorConfig>['pollOnce'],
): DataSourceAdapter<SimulatorConfig> {
  return {
    kind: 'simulator',
    configSchema: SimulatorConfigSchema,
    listProducedShapes: () => ['session'],
    pollOnce,
  };
}

/** The green-flag session, as a good poll at that moment answers it. */
function answerTheGreenFlagSessionAt(momentMs: number): PolledShapes {
  return { shapes: { session: buildGreenFlagSessionAt(momentMs) } };
}

/**
 * A simulator adapter that answers at once with the green-flag session of the moment, or,
 * once broken, throws the given error until it is repaired. Remembers when each poll
 * started.
 */
export function createSimulatorAdapterAnsweringAtOnce() {
  const pollMomentsMs: number[] = [];
  let errorWhileBroken: string | undefined;
  const adapter = buildFakeSimulatorAdapter((_config, context) => {
    const momentMs = context.readCurrentTime().getTime();
    pollMomentsMs.push(momentMs);
    if (errorWhileBroken !== undefined) {
      return Promise.reject(new Error(errorWhileBroken));
    }
    return Promise.resolve(answerTheGreenFlagSessionAt(momentMs));
  });
  return {
    adapter,
    readPollMomentsMs: () => [...pollMomentsMs],
    breakIt: (error: string) => {
      errorWhileBroken = error;
    },
    repairIt: () => {
      errorWhileBroken = undefined;
    },
  };
}

/**
 * A simulator adapter that answers the green-flag session `answerDelayMs` after each poll
 * starts, paying no attention to the signal. Remembers when each poll started and the
 * most polls it ever had in flight at once.
 */
export function createSimulatorAdapterAnsweringAfter(answerDelayMs: number) {
  const pollMomentsMs: number[] = [];
  let pollsInFlight = 0;
  let mostPollsInFlightAtOnce = 0;
  const adapter = buildFakeSimulatorAdapter((_config, context) => {
    const momentMs = context.readCurrentTime().getTime();
    pollMomentsMs.push(momentMs);
    pollsInFlight += 1;
    mostPollsInFlightAtOnce = Math.max(mostPollsInFlightAtOnce, pollsInFlight);
    return new Promise((resolve) => {
      setTimeout(() => {
        pollsInFlight -= 1;
        resolve(answerTheGreenFlagSessionAt(momentMs));
      }, answerDelayMs);
    });
  });
  return {
    adapter,
    readPollMomentsMs: () => [...pollMomentsMs],
    readMostPollsInFlightAtOnce: () => mostPollsInFlightAtOnce,
  };
}

/**
 * A simulator adapter whose polls wait until the test answers them, oldest first. Keeps
 * each poll's signal, so a test can see which polls were called off.
 */
export function createSimulatorAdapterAnsweredByHand() {
  const pendingAnswers: Array<() => void> = [];
  const signals: AbortSignal[] = [];
  const adapter = buildFakeSimulatorAdapter((_config, context) => {
    const momentMs = context.readCurrentTime().getTime();
    signals.push(context.signal);
    return new Promise((resolve) => {
      pendingAnswers.push(() => resolve(answerTheGreenFlagSessionAt(momentMs)));
    });
  });
  return {
    adapter,
    countPollsStarted: () => signals.length,
    readSignals: () => [...signals],
    answerTheOldestPendingPoll: () => {
      const answer = pendingAnswers.shift();
      if (answer === undefined) {
        throw new Error('no poll is waiting for an answer');
      }
      answer();
    },
  };
}

/**
 * A simulator adapter that never answers and pays no attention to the signal: a source
 * stuck on a dead connection. Keeps each poll's signal.
 */
export function createSimulatorAdapterThatNeverAnswers() {
  const signals: AbortSignal[] = [];
  const adapter = buildFakeSimulatorAdapter((_config, context) => {
    signals.push(context.signal);
    return new Promise<PolledShapes>(() => {
      // Never settles, on purpose.
    });
  });
  return { adapter, readSignals: () => [...signals] };
}

/**
 * A simulator adapter that never answers on its own but gives up (rejects) as soon as the
 * signal fires, as a well-behaved adapter does. Keeps each poll's signal and the moment
 * it fired.
 */
export function createSimulatorAdapterThatGivesUpWhenSignalled() {
  const signals: AbortSignal[] = [];
  const abortMomentsMs: number[] = [];
  const adapter = buildFakeSimulatorAdapter((_config, context) => {
    signals.push(context.signal);
    return new Promise<PolledShapes>((_resolve, reject) => {
      context.signal.addEventListener('abort', () => {
        abortMomentsMs.push(context.readCurrentTime().getTime());
        reject(new Error('The operation was aborted.'));
      });
    });
  });
  return {
    adapter,
    readSignals: () => [...signals],
    readAbortMomentsMs: () => [...abortMomentsMs],
  };
}
