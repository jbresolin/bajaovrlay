/**
 * The macro runner: carrying out a macro's steps (apps/server)
 *
 * What this module is for:
 *   runMacro only records a run in the `macroRuns` slice. The runner watches the store,
 *   and when a run appears it sends the macro's steps one by one through the store's
 *   single command path, signed `sistema:macro:<macroId>`, so each step is validated,
 *   authorised, saved, logged and broadcast like any other command. A `wait` step holds
 *   the next step back. After each step the runner says where the run is with
 *   advanceMacroRun, and when the run is over, whatever the outcome, it ends it with
 *   endMacroRun. A refused step stops the macro and is logged; what earlier steps put on
 *   air stays there (on-air state is never undone automatically).
 *
 * What these tests prove (with a real store on a temporary SQLite file, and fake timers):
 *   - The steps run strictly in order, each signed by the macro, and the event log shows
 *     the bookkeeping between them.
 *   - A wait of 500 ms holds the next step back exactly 500 ms.
 *   - The run's current step goes 0, 1, 2 and the entry is removed at the end.
 *   - A refused step (an item deleted since the macro was saved) stops the macro: later
 *     steps are never sent, earlier ones stay on air, a warning names the macro, the
 *     step and the error, and the run is ended.
 *   - A step that throws is logged as an error, never thrown from the timer, and the
 *     run is ended.
 *   - While a macro runs, an operator's runMacro of any macro is refused; once it ended,
 *     a new run is accepted.
 *   - A macro with no step runs as nothing and ends.
 *   - stop() calls a pending wait off: no later step is sent.
 *
 * What these tests deliberately do not cover:
 *   - runMacro's own refusals and the bookkeeping reducers; runMacro.test.ts.
 *   - What the authorisation hook allows each actor; the authorisation tests.
 *   - A restart in the middle of a run; storeMacroRun.test.ts covers it.
 */
import type { MacroStep, Slices } from '@bajaovrlay/shared';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger, type ServerLogger } from '../logger/createLogger.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from './createStateStore.js';
import { startMacroRunner } from './macroRunner.js';

const operatorActor = 'operador:conexao-7';
const openTheSessionMacroId = 'macro-abrir-sessao';
const openTheSessionMacroActor = 'sistema:macro:macro-abrir-sessao';
const enduroClockItemId = 'item-relogio-do-enduro';
const cornerClockItemId = 'item-relogio-no-canto';

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
 * Builds what every test here starts from: fake timers (put back after the test), a
 * store on a fresh database with two clock items ("Relógio do enduro" on the clock
 * layer, "Relógio no canto" on the bug layer), the macro "Abrir a sessão" saved with
 * the given steps, and a running macro runner.
 */
function startStoreAndRunnerWithMacro(options: {
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
function readLayerIdsOnAir(store: StateStore): string[] {
  return store.readAllSlices().instances.map((instance) => instance.layerId);
}

/** Reads the event log as `actor command` lines, from the press of the macro on. */
function readEventLogFromTheRunMacro(store: StateStore): string[] {
  const eventLog = store.readAllSlices().eventLog;
  const positionOfTheRun = eventLog.findIndex((entry) => entry.command === 'runMacro');
  return eventLog.slice(positionOfTheRun).map((entry) => `${entry.actor} ${entry.command}`);
}

describe('the macro runner, on a macro that goes well', () => {
  it('sends the steps strictly in order, signed by the macro, with its bookkeeping between', () => {
    // Arrange: a macro that takes the enduro clock, the corner clock, then clears the
    // clock layer.
    const { store } = startStoreAndRunnerWithMacro({
      steps: [
        { kind: 'takeItem', itemId: enduroClockItemId },
        { kind: 'takeItem', itemId: cornerClockItemId },
        { kind: 'clearLayer', layerId: 'clock' },
      ],
    });

    // Act: press the macro, and let the runner start.
    store.applyCommand({ type: 'runMacro', macroId: openTheSessionMacroId }, operatorActor);
    vi.advanceTimersByTime(0);

    // Assert: the event log shows the steps in order, each signed by the macro; only the
    // corner clock is left on air.
    expect(
      readEventLogFromTheRunMacro(store),
      'each step must be its own command, in order, signed by the macro',
    ).toEqual([
      `${operatorActor} runMacro`,
      `${openTheSessionMacroActor} takeItem`,
      `${openTheSessionMacroActor} advanceMacroRun`,
      `${openTheSessionMacroActor} takeItem`,
      `${openTheSessionMacroActor} advanceMacroRun`,
      `${openTheSessionMacroActor} clearLayer`,
      `${openTheSessionMacroActor} endMacroRun`,
    ]);
    expect(readLayerIdsOnAir(store), 'the last step cleared the clock layer').toEqual(['bug']);
  });

  it('holds the step after a 500 ms wait back exactly 500 ms', () => {
    // Arrange: take the enduro clock, wait half a second, clear the clock layer.
    const { store } = startStoreAndRunnerWithMacro({
      steps: [
        { kind: 'takeItem', itemId: enduroClockItemId },
        { kind: 'wait', ms: 500 },
        { kind: 'clearLayer', layerId: 'clock' },
      ],
    });

    // Act: press the macro; look at 0 ms, at 499 ms and at 500 ms.
    store.applyCommand({ type: 'runMacro', macroId: openTheSessionMacroId }, operatorActor);
    vi.advanceTimersByTime(0);
    const layerIdsOnAirAtTheStart = readLayerIdsOnAir(store);
    vi.advanceTimersByTime(499);
    const layerIdsOnAirJustBefore = readLayerIdsOnAir(store);
    vi.advanceTimersByTime(1);

    // Assert: on air through the wait, cleared at exactly 500 ms.
    expect(layerIdsOnAirAtTheStart, 'the first step must run at once').toEqual(['clock']);
    expect(layerIdsOnAirJustBefore, 'the clear must wait the whole 500 ms').toEqual(['clock']);
    expect(readLayerIdsOnAir(store), 'the clear must come at 500 ms').toEqual([]);
  });

  it('moves the current step 0, 1, 2 and removes the run at the end', () => {
    // Arrange: the same three steps, and a note of the runs each time they change.
    const { store } = startStoreAndRunnerWithMacro({
      steps: [
        { kind: 'takeItem', itemId: enduroClockItemId },
        { kind: 'wait', ms: 500 },
        { kind: 'clearLayer', layerId: 'clock' },
      ],
    });
    const runsSeenByAPage: Array<Slices['macroRuns']> = [];
    store.subscribeToSliceChanges((changedSliceNames, slices) => {
      if (changedSliceNames.includes('macroRuns')) {
        runsSeenByAPage.push(slices.macroRuns);
      }
    });

    // Act: press the macro and let it run to its end.
    store.applyCommand({ type: 'runMacro', macroId: openTheSessionMacroId }, operatorActor);
    vi.advanceTimersByTime(1_000);

    // Assert: the steps a page saw, then no run at all.
    expect(
      runsSeenByAPage.map((runs) => runs.map((run) => run.currentStep)),
      'a page must see the run at step 0, then 1 (the wait), then 2, then no run',
    ).toEqual([[0], [1], [2], []]);
  });

  it('runs a macro with no step as nothing, and ends it', () => {
    // Arrange: "Abrir a sessão" saved before any step was added.
    const { store } = startStoreAndRunnerWithMacro({ steps: [] });

    // Act: press it.
    store.applyCommand({ type: 'runMacro', macroId: openTheSessionMacroId }, operatorActor);
    vi.advanceTimersByTime(0);

    // Assert: started and ended, nothing on air.
    expect(readEventLogFromTheRunMacro(store), 'an empty macro must start and end').toEqual([
      `${operatorActor} runMacro`,
      `${openTheSessionMacroActor} endMacroRun`,
    ]);
    expect(store.readAllSlices().macroRuns, 'no run may be left behind').toEqual([]);
  });
});

describe('the macro runner, when a step goes wrong', () => {
  it('stops at a refused step, keeps what is on air, logs it and ends the run', () => {
    // Arrange: take the enduro clock, take an item deleted since, then clear everything;
    // and a logger that remembers its lines.
    const { logger, readRecordedLines } = createRecordingLogger();
    const { store } = startStoreAndRunnerWithMacro({
      steps: [
        { kind: 'takeItem', itemId: enduroClockItemId },
        { kind: 'takeItem', itemId: 'item-apagado' },
        { kind: 'clearAll' },
      ],
      logger,
    });

    // Act: press the macro.
    store.applyCommand({ type: 'runMacro', macroId: openTheSessionMacroId }, operatorActor);
    vi.advanceTimersByTime(0);

    // Assert: the clear was never sent, the clock stayed on air, the run was ended, and
    // one warning says which macro, which step and why.
    expect(
      readEventLogFromTheRunMacro(store),
      'nothing may be sent after the refused step',
    ).toEqual([
      `${operatorActor} runMacro`,
      `${openTheSessionMacroActor} takeItem`,
      `${openTheSessionMacroActor} advanceMacroRun`,
      `${openTheSessionMacroActor} takeItem`,
      `${openTheSessionMacroActor} endMacroRun`,
    ]);
    expect(readLayerIdsOnAir(store), 'what the first step put on air must stay').toEqual(['clock']);
    expect(store.readAllSlices().macroRuns, 'the run must be ended').toEqual([]);
    const refusalLines = readRecordedLines().filter(
      (line) => line.message === 'macro stopped at a refused step',
    );
    expect(
      refusalLines.map((line) => [line.level, line.macro_id, line.step_index, line.error]),
      'one warning must name the macro, the step and the refusal',
    ).toEqual([
      [
        'warn',
        openTheSessionMacroId,
        1,
        {
          code: 'ITEM_NOT_FOUND',
          message: 'O item "item-apagado" não existe; ele pode ter sido excluído.',
        },
      ],
    ]);
  });

  it('logs a step that throws as an error, never throws from the timer, and ends the run', () => {
    // Arrange: wait 200 ms, then clear the clock layer; the store throws on that clear,
    // as a full disk would.
    const { logger, readRecordedLines } = createRecordingLogger();
    const { store } = startStoreAndRunnerWithMacro({
      steps: [
        { kind: 'wait', ms: 200 },
        { kind: 'clearLayer', layerId: 'clock' },
      ],
      logger,
      wrapStore: (realStore) => ({
        ...realStore,
        applyCommand: (commandInput, actor) => {
          const isTheClear =
            typeof commandInput === 'object' &&
            commandInput !== null &&
            'type' in commandInput &&
            commandInput.type === 'clearLayer';
          if (isTheClear) {
            throw new Error('SQLITE_FULL: database or disk is full');
          }
          return realStore.applyCommand(commandInput, actor);
        },
      }),
    });
    store.applyCommand({ type: 'runMacro', macroId: openTheSessionMacroId }, operatorActor);
    vi.advanceTimersByTime(0);

    // Act: let the wait end, which is when the clear is sent from a timer.
    const letTheWaitEnd = () => vi.advanceTimersByTime(200);

    // Assert: nothing escapes the timer, an error line is written, and the run ended.
    expect(letTheWaitEnd, 'an error in a step must never escape the timer').not.toThrow();
    const errorLines = readRecordedLines().filter(
      (line) => line.message === 'macro stopped: a step could not be sent',
    );
    expect(
      errorLines.map((line) => [line.level, line.macro_id, line.step_index]),
      'one error line must name the macro and the step',
    ).toEqual([['error', openTheSessionMacroId, 1]]);
    expect(store.readAllSlices().macroRuns, 'the run must be ended').toEqual([]);
  });
});

describe('the macro runner, one macro at a time', () => {
  it("refuses an operator's runMacro while a macro waits, and accepts one after it ended", () => {
    // Arrange: take the enduro clock, wait 500 ms, clear; pressed and running.
    const { store } = startStoreAndRunnerWithMacro({
      steps: [
        { kind: 'takeItem', itemId: enduroClockItemId },
        { kind: 'wait', ms: 500 },
        { kind: 'clearLayer', layerId: 'clock' },
      ],
    });
    store.applyCommand({ type: 'runMacro', macroId: openTheSessionMacroId }, operatorActor);
    vi.advanceTimersByTime(100);

    // Act: press it again during the wait, then again after it ended.
    const outcomeDuringTheWait = store.applyCommand(
      { type: 'runMacro', macroId: openTheSessionMacroId },
      operatorActor,
    );
    vi.advanceTimersByTime(400);
    const outcomeAfterTheEnd = store.applyCommand(
      { type: 'runMacro', macroId: openTheSessionMacroId },
      operatorActor,
    );

    // Assert: refused while running, accepted once the run was over.
    expect(
      outcomeDuringTheWait,
      'a macro cannot start while another is running, this one included',
    ).toEqual({
      ok: false,
      error: {
        code: 'MACRO_RUNNING',
        message:
          'A macro "Abrir a sessão" não pode começar enquanto a macro "Abrir a sessão" está rodando.',
      },
    });
    expect(outcomeAfterTheEnd, 'a new run must be accepted after the end').toEqual({ ok: true });
  });

  it('sends no later step once stopped during a wait', () => {
    // Arrange: take the enduro clock, wait 500 ms, clear; pressed and waiting.
    const { store, runner } = startStoreAndRunnerWithMacro({
      steps: [
        { kind: 'takeItem', itemId: enduroClockItemId },
        { kind: 'wait', ms: 500 },
        { kind: 'clearLayer', layerId: 'clock' },
      ],
    });
    store.applyCommand({ type: 'runMacro', macroId: openTheSessionMacroId }, operatorActor);
    vi.advanceTimersByTime(100);

    // Act: stop the runner, as the server does when it closes, and let time pass.
    runner.stop();
    vi.advanceTimersByTime(10_000);

    // Assert: the clock is still on air; the clear was never sent.
    expect(readLayerIdsOnAir(store), 'a stopped runner must send nothing more').toEqual(['clock']);
  });
});
