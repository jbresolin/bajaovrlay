// Test support: a real store on a temporary SQLite file, holding two clock items and the
// macro "Abrir a sessão", with a macro runner watching it, for macroRunner.test.ts and
// macroRunnerWhenAStepGoesWrong.test.ts. Every call builds new objects and its own
// database, so no test can change what another test sees.
import type { MacroStep } from '@bajaovrlay/shared';
import { onTestFinished, vi } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger, type ServerLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from './createStateStore.js';
import { startMacroRunner } from './macroRunner.js';

export const operatorActor = 'operador:conexao-7';
export const openTheSessionMacroId = 'macro-abrir-sessao';
export const openTheSessionMacroActor = 'sistema:macro:macro-abrir-sessao';
export const enduroClockItemId = 'item-relogio-do-enduro';
export const cornerClockItemId = 'item-relogio-no-canto';

/** Builds the createItem of a race clock item under green flag on the given layer. */
function buildCreateClockItemCommand(label: string, layerId: string) {
  return {
    type: 'createItem',
    home: { kind: 'quickFire', panelId: 'atalhos' },
    graphicId: 'race-clock',
    layerId,
    label,
    fields: {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: 'green' },
      clockMode: { kind: 'literal', value: 'elapsed' },
      referenceTimeMs: { kind: 'literal', value: 3_900_000 },
      referenceWallClockMs: { kind: 'literal', value: 1_791_550_800_000 },
      running: { kind: 'literal', value: true },
    },
  };
}

/**
 * Builds what every runner test starts from: fake timers (put back after the test), a
 * store on a fresh database with two clock items ("Relógio do enduro" on the clock
 * layer, "Relógio no canto" on the bug layer), the macro "Abrir a sessão" saved with
 * the given steps, and a running macro runner. `wrapStore` lets a test hand the runner
 * a store that fails in a chosen way; the test itself keeps the real one.
 */
export function startStoreAndRunnerWithMacro(options: {
  steps: MacroStep[];
  logger?: ServerLogger;
  wrapStore?: (store: StateStore) => StateStore;
}) {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const { database } = openTemporaryDatabase();
  const itemIdsInCreationOrder = [enduroClockItemId, cornerClockItemId];
  const store = createStateStore({
    database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    createItemId: () => itemIdsInCreationOrder.shift() ?? 'item-sem-id',
    createMacroId: () => openTheSessionMacroId,
  });
  store.applyCommand(buildCreateClockItemCommand('Relógio do enduro', 'clock'), operatorActor);
  store.applyCommand(buildCreateClockItemCommand('Relógio no canto', 'bug'), operatorActor);
  store.applyCommand(
    { type: 'createMacro', label: 'Abrir a sessão', color: 'success', steps: options.steps },
    operatorActor,
  );
  const storeSeenByTheRunner = options.wrapStore ? options.wrapStore(store) : store;
  const runner = startMacroRunner({
    stateStore: storeSeenByTheRunner,
    logger: options.logger ?? createLogger({ level: 'silent' }),
  });
  onTestFinished(() => runner.stop());
  return { store, runner };
}

/** Reads which layers have something on air, to say in a few words what is on screen. */
export function readLayerIdsOnAir(store: StateStore): string[] {
  return store.readAllSlices().instances.map((instance) => instance.layerId);
}

/** Reads the event log as `actor command` lines, from the press of the macro on. */
export function readEventLogFromTheRunMacro(store: StateStore): string[] {
  const eventLog = store.readAllSlices().eventLog;
  const positionOfTheRun = eventLog.findIndex((entry) => entry.command === 'runMacro');
  return eventLog.slice(positionOfTheRun).map((entry) => `${entry.actor} ${entry.command}`);
}

/** Reads the `type` of a command input handed to applyCommand, or '' when it has none. */
export function readCommandType(commandInput: unknown): string {
  const hasAType =
    typeof commandInput === 'object' && commandInput !== null && 'type' in commandInput;
  return hasAType ? String(commandInput.type) : '';
}
