/**
 * The macro runner when a step goes wrong (apps/server)
 *
 * What this module is for:
 *   The runner (macroRunner.ts) sends a macro's steps through the store's single command
 *   path from timers. A step can be refused (an item deleted since the macro was saved)
 *   or the store can throw (a full disk, a locked database). Neither may escape the timer,
 *   where an error nobody catches would stop the whole server with graphics on air, and
 *   neither may leave the run behind in `macroRuns`, where it would refuse every runMacro
 *   with MACRO_RUNNING until a restart.
 *
 * What these tests prove (with a real store on a temporary SQLite file, and fake timers):
 *   - A refused step stops the macro: later steps are never sent, earlier ones stay on
 *     air, a warning names the macro, the step and the error, and the run is ended.
 *   - A step that throws is logged as an error, never thrown from the timer, and the run
 *     is ended.
 *   - When the endMacroRun after a failed step throws too, it is logged and sent again a
 *     second later; once it goes through, the macro can be pressed again.
 *
 * What these tests deliberately do not cover:
 *   - A macro that goes well, waits, and one run at a time: macroRunner.test.ts.
 *   - A store that throws on endMacroRun for good: the runner keeps trying every second
 *     until it is stopped, which only a restart ends; there is nothing more to see.
 */
import { describe, expect, it, vi } from 'vitest';

import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import {
  enduroClockItemId,
  openTheSessionMacroActor,
  openTheSessionMacroId,
  operatorActor,
  readCommandType,
  readEventLogFromTheRunMacro,
  readLayerIdsOnAir,
  startStoreAndRunnerWithMacro,
} from './macroRunner.testSupport.js';

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
          if (readCommandType(commandInput) === 'clearLayer') {
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

  it('tries the end of the run again a second later when the end throws too', () => {
    // Arrange: one step, clear the clock layer; the store throws once on that clear and
    // once on the endMacroRun that follows, as a database briefly locked would.
    const { logger, readRecordedLines } = createRecordingLogger();
    const commandTypesThatThrowOnce = new Set(['clearLayer', 'endMacroRun']);
    const { store } = startStoreAndRunnerWithMacro({
      steps: [{ kind: 'clearLayer', layerId: 'clock' }],
      logger,
      wrapStore: (realStore) => ({
        ...realStore,
        applyCommand: (commandInput, actor) => {
          const commandType = readCommandType(commandInput);
          if (commandTypesThatThrowOnce.has(commandType)) {
            commandTypesThatThrowOnce.delete(commandType);
            throw new Error('SQLITE_BUSY: database is locked');
          }
          return realStore.applyCommand(commandInput, actor);
        },
      }),
    });
    store.applyCommand({ type: 'runMacro', macroId: openTheSessionMacroId }, operatorActor);
    vi.advanceTimersByTime(0);
    const runsJustAfterTheFailedEnd = store.readAllSlices().macroRuns.length;

    // Act: let a second pass, then press the macro again.
    vi.advanceTimersByTime(1_000);
    const outcomeOfTheNextPress = store.applyCommand(
      { type: 'runMacro', macroId: openTheSessionMacroId },
      operatorActor,
    );

    // Assert: the run was still there after the failed end, the second try ended it so
    // the macro could be pressed again, and the failure was logged.
    expect(runsJustAfterTheFailedEnd, 'the failed end must leave the run in place').toBe(1);
    expect(
      outcomeOfTheNextPress,
      'once the end went through, no macro may stay locked as running',
    ).toEqual({ ok: true });
    expect(
      readRecordedLines()
        .filter((line) => line.message === 'macro run could not be ended; trying again')
        .map((line) => [line.level, line.macro_id]),
      'the failed end must be logged once as an error naming the macro',
    ).toEqual([['error', openTheSessionMacroId]]);
  });
});
