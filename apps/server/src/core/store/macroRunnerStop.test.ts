/**
 * The macro runner when an operator presses "Parar" (apps/server)
 *
 * What this module is for:
 *   stopMacro only marks the running macro's run `isStopRequested: true`. The runner
 *   (macroRunner.ts) watches the store and acts on the mark: it sends no step after the
 *   one in progress and ends the run with endMacroRun, as it does at the end of every
 *   run. A wait is not on-air work, so a wait in progress is cut short. Nothing the run
 *   already did is undone.
 *
 * What these tests prove (with a real store on a temporary SQLite file, and fake timers):
 *   - "Parar" during a wait ends the run at once: the step after the wait is never sent,
 *     what is on air stays, and a page sees the run marked ("Parando…") until the end.
 *   - "Parar" while a step is being sent lets that step finish and sends nothing after.
 *   - A stopped run frees the lock: runMacro is accepted right after the end.
 *   - "Parar" for a macro that is not running is answered ok, leaves no trace in the
 *     event log, and starts or ends nothing.
 *
 * What these tests deliberately do not cover:
 *   - The stopMacro reducer's own answers (an unknown macro, a run already marked):
 *     reducers/stopMacro.test.ts.
 *   - A run that goes on past its time limit: macroRunnerWatchdog.test.ts.
 *   - A stop on a real database across the whole store: storeMacroRun.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  cornerClockItemId,
  enduroClockItemId,
  openTheSessionMacroActor,
  openTheSessionMacroId,
  operatorActor,
  readCommandType,
  readEventLogFromTheRunMacro,
  readLayerIdsOnAir,
  startStoreAndRunnerWithMacro,
} from './macroRunner.testSupport.js';

/** The operator's "Parar" for "Abrir a sessão". */
const stopOpenTheSession = { type: 'stopMacro', macroId: openTheSessionMacroId };

describe('the macro runner, when an operator presses "Parar"', () => {
  it('cuts a wait short, sends nothing after it, and ends the run', () => {
    // Arrange: take the enduro clock, wait 5 s, clear the clock layer; pressed, and one
    // second into the wait.
    const { store } = startStoreAndRunnerWithMacro({
      steps: [
        { kind: 'takeItem', itemId: enduroClockItemId },
        { kind: 'wait', ms: 5_000 },
        { kind: 'clearLayer', layerId: 'clock' },
      ],
    });
    store.applyCommand({ type: 'runMacro', macroId: openTheSessionMacroId }, operatorActor);
    vi.advanceTimersByTime(1_000);

    // Act: press "Parar"; look at the run at once, then let the runner act, then let
    // more than the rest of the wait pass.
    const outcomeOfTheStop = store.applyCommand(stopOpenTheSession, operatorActor);
    const runsJustAfterThePress = store.readAllSlices().macroRuns;
    vi.advanceTimersByTime(0);
    const runsOnceTheRunnerActed = store.readAllSlices().macroRuns;
    vi.advanceTimersByTime(10_000);

    // Assert: accepted; marked until the runner ended it without waiting; the clear was
    // never sent and the clock is still on air.
    expect(outcomeOfTheStop, 'an operator may stop the running macro').toEqual({ ok: true });
    expect(
      runsJustAfterThePress.map((run) => run.isStopRequested),
      'a page must see the run marked as being stopped, to show "Parando…"',
    ).toEqual([true]);
    expect(runsOnceTheRunnerActed, 'the wait must be cut short and the run ended').toEqual([]);
    expect(
      readEventLogFromTheRunMacro(store),
      'nothing may be sent after the stop but the end of the run',
    ).toEqual([
      `${operatorActor} runMacro`,
      `${openTheSessionMacroActor} takeItem`,
      `${openTheSessionMacroActor} advanceMacroRun`,
      `${operatorActor} stopMacro`,
      `${openTheSessionMacroActor} endMacroRun`,
    ]);
    expect(readLayerIdsOnAir(store), 'what the run put on air must stay').toEqual(['clock']);
  });

  it('lets the step being sent finish, and sends nothing after it', () => {
    // Arrange: take the enduro clock, take the corner clock, clear the clock layer; the
    // runner's store lets "Parar" arrive just as the first take has gone through, while
    // the runner is still sending steps.
    const { store } = startStoreAndRunnerWithMacro({
      steps: [
        { kind: 'takeItem', itemId: enduroClockItemId },
        { kind: 'takeItem', itemId: cornerClockItemId },
        { kind: 'clearLayer', layerId: 'clock' },
      ],
      wrapStore: (realStore) => ({
        ...realStore,
        applyCommand: (commandInput, actor) => {
          const outcome = realStore.applyCommand(commandInput, actor);
          const isTheFirstTake =
            readCommandType(commandInput) === 'takeItem' &&
            readLayerIdsOnAir(realStore).length === 1;
          if (isTheFirstTake) {
            realStore.applyCommand(stopOpenTheSession, operatorActor);
          }
          return outcome;
        },
      }),
    });

    // Act: press the macro and let the runner start.
    store.applyCommand({ type: 'runMacro', macroId: openTheSessionMacroId }, operatorActor);
    vi.advanceTimersByTime(0);

    // Assert: the first take finished and stayed on air; the second take and the clear
    // were never sent; the run was ended.
    expect(
      readEventLogFromTheRunMacro(store),
      'the step in progress must finish, and nothing may follow but the end',
    ).toEqual([
      `${operatorActor} runMacro`,
      `${openTheSessionMacroActor} takeItem`,
      `${operatorActor} stopMacro`,
      `${openTheSessionMacroActor} endMacroRun`,
    ]);
    expect(readLayerIdsOnAir(store), 'only the first take may be on air').toEqual(['clock']);
    expect(store.readAllSlices().macroRuns, 'the run must be ended').toEqual([]);
  });

  it('frees the lock: the macro can be pressed again right after the stop', () => {
    // Arrange: take the enduro clock, wait 5 s, clear; pressed and waiting.
    const { store } = startStoreAndRunnerWithMacro({
      steps: [
        { kind: 'takeItem', itemId: enduroClockItemId },
        { kind: 'wait', ms: 5_000 },
        { kind: 'clearLayer', layerId: 'clock' },
      ],
    });
    store.applyCommand({ type: 'runMacro', macroId: openTheSessionMacroId }, operatorActor);
    vi.advanceTimersByTime(1_000);

    // Act: press "Parar", let the runner end the run, and press the macro again.
    store.applyCommand(stopOpenTheSession, operatorActor);
    vi.advanceTimersByTime(0);
    const outcomeOfTheNextPress = store.applyCommand(
      { type: 'runMacro', macroId: openTheSessionMacroId },
      operatorActor,
    );

    // Assert: the new run is accepted and starts afresh, not asked to stop.
    expect(outcomeOfTheNextPress, 'a stopped run must not lock the macros').toEqual({ ok: true });
    expect(
      store.readAllSlices().macroRuns.map((run) => [run.currentStep, run.isStopRequested]),
      'the new run must start at step 0, not marked as being stopped',
    ).toEqual([[0, false]]);
  });

  it('answers ok and leaves no trace for a macro that is not running', () => {
    // Arrange: "Abrir a sessão" saved and never pressed; the event log as it is.
    const { store } = startStoreAndRunnerWithMacro({
      steps: [{ kind: 'takeItem', itemId: enduroClockItemId }],
    });
    const eventLogLengthBefore = store.readAllSlices().eventLog.length;

    // Act: press "Parar" for it (a page that has not yet seen a run end), and let time pass.
    const outcome = store.applyCommand(stopOpenTheSession, operatorActor);
    vi.advanceTimersByTime(1_000);

    // Assert: ok, no event-log row, no run, nothing on air.
    expect(outcome, 'a stop with nothing to stop must not show an error').toEqual({ ok: true });
    expect(
      store.readAllSlices().eventLog.length,
      'a stop that changes nothing must leave no trace',
    ).toBe(eventLogLengthBefore);
    expect(store.readAllSlices().macroRuns, 'no run may be started by a stop').toEqual([]);
    expect(readLayerIdsOnAir(store), 'nothing may go on air').toEqual([]);
  });
});
