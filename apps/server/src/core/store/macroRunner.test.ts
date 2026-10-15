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
 *   endMacroRun.
 *
 * What these tests prove (with a real store on a temporary SQLite file, and fake timers):
 *   - The steps run strictly in order, each signed by the macro, and the event log shows
 *     the bookkeeping between them.
 *   - A wait of 500 ms holds the next step back exactly 500 ms.
 *   - The run's current step goes 0, 1, 2 and the entry is removed at the end.
 *   - While a macro runs, an operator's runMacro of any macro is refused; once it ended,
 *     a new run is accepted.
 *   - A macro with no step runs as nothing and ends.
 *   - stop() calls a pending wait off: no later step is sent.
 *
 * What these tests deliberately do not cover:
 *   - A refused step, a step that throws and an end that throws:
 *     macroRunnerWhenAStepGoesWrong.test.ts.
 *   - runMacro's own refusals and the bookkeeping reducers; runMacro.test.ts.
 *   - What the authorisation hook allows each actor; the authorisation tests.
 *   - A restart in the middle of a run; storeMacroRun.test.ts covers it.
 */
import type { Slices } from '@bajaovrlay/shared';
import { describe, expect, it, vi } from 'vitest';

import {
  cornerClockItemId,
  enduroClockItemId,
  openTheSessionMacroActor,
  openTheSessionMacroId,
  operatorActor,
  readEventLogFromTheRunMacro,
  readLayerIdsOnAir,
  startStoreAndRunnerWithMacro,
} from './macroRunner.testSupport.js';

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
