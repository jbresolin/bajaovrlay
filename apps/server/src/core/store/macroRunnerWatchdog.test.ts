/**
 * The macro watchdog: ending a run that went on too long (apps/server)
 *
 * What this module is for:
 *   While a macro runs, every other runMacro is refused with MACRO_RUNNING. A run that
 *   never ends (a fault the runner cannot get past) would lock every macro until a
 *   restart. The watchdog (macroRunWatchdog.ts, started and stopped with the runner)
 *   gives each run a time limit: the sum of its waits plus 30 s. A run still listed at
 *   its limit is ended through the store's single command path, as the actor
 *   `sistema:macro-watchdog`, with a warning log line naming the macro and the limit.
 *   Nothing is rolled back.
 *
 * What these tests prove (with a real store on a temporary SQLite file, and fake timers):
 *   - The limit is the sum of the waits plus 30 000 ms, row by row.
 *   - A stuck run (the store throws on every endMacroRun the runner sends) is ended at
 *     its limit and not a millisecond before, signed by the watchdog in the event log,
 *     with one warning line; the runner stops trying to end it, and the macro can be
 *     pressed again.
 *   - A run that ended on time leaves no watchdog timer behind and is never ended twice.
 *   - stop() calls the watchdog off with the runner.
 *
 * What these tests deliberately do not cover:
 *   - A store that also throws on the watchdog's own endMacroRun: it is logged as an
 *     error and the run stays until a restart; there is nothing more to see.
 *   - Who may sign as the watchdog: authorizeQuickFireAndMacroCommands.test.ts.
 */
import type { MacroStep } from '@bajaovrlay/shared';
import { describe, expect, it, vi } from 'vitest';

import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import {
  enduroClockItemId,
  openTheSessionMacroActor,
  openTheSessionMacroId,
  operatorActor,
  readCommandType,
  readEventLogFromTheRunMacro,
  startStoreAndRunnerWithMacro,
} from './macroRunner.testSupport.js';
import { computeMacroRunTimeLimitInMilliseconds } from './macroRunWatchdog.js';

/** Take the enduro clock, wait half a second, clear the clock layer: a 30.5 s limit. */
const takeWaitAndClearSteps: MacroStep[] = [
  { kind: 'takeItem', itemId: enduroClockItemId },
  { kind: 'wait', ms: 500 },
  { kind: 'clearLayer', layerId: 'clock' },
];

describe('the time limit of a macro run', () => {
  const timeLimitScenarios: Array<{
    name: string;
    steps: MacroStep[];
    expectedLimitInMilliseconds: number;
  }> = [
    // A macro with no wait still gets the 30 s margin, for its steps to be sent.
    {
      name: 'gives a macro without waits 30 s',
      steps: [{ kind: 'clearAll' }],
      expectedLimitInMilliseconds: 30_000,
    },
    // An empty macro starts and ends at once; the margin is all it gets.
    { name: 'gives a macro with no step 30 s', steps: [], expectedLimitInMilliseconds: 30_000 },
    // Every wait is added: half a second and two seconds.
    {
      name: 'adds every wait to the 30 s',
      steps: [
        { kind: 'wait', ms: 500 },
        { kind: 'takeItem', itemId: enduroClockItemId },
        { kind: 'wait', ms: 2_000 },
      ],
      expectedLimitInMilliseconds: 32_500,
    },
  ];

  it.each(timeLimitScenarios)('$name', ({ steps, expectedLimitInMilliseconds }) => {
    // Arrange: this row's steps.

    // Act: work out the limit.
    const limitInMilliseconds = computeMacroRunTimeLimitInMilliseconds(steps);

    // Assert: the waits plus 30 s.
    expect(limitInMilliseconds, 'the limit must be the waits plus 30 s').toBe(
      expectedLimitInMilliseconds,
    );
  });
});

describe('the macro watchdog', () => {
  it('ends a stuck run at its limit, signed by the watchdog, and frees the macros', () => {
    // Arrange: take, wait 500 ms, clear; the runner's store throws on every endMacroRun
    // the runner sends, as a fault the retry never gets past; and a logger that remembers.
    const { logger, readRecordedLines } = createRecordingLogger();
    const { store } = startStoreAndRunnerWithMacro({
      steps: takeWaitAndClearSteps,
      logger,
      wrapStore: (realStore) => ({
        ...realStore,
        applyCommand: (commandInput, actor) => {
          const isTheRunnersEnd =
            readCommandType(commandInput) === 'endMacroRun' && actor === openTheSessionMacroActor;
          if (isTheRunnersEnd) {
            throw new Error('SQLITE_IOERR: disk I/O error');
          }
          return realStore.applyCommand(commandInput, actor);
        },
      }),
    });
    const countRetryLines = () =>
      readRecordedLines().filter(
        (line) => line.message === 'macro run could not be ended; trying again',
      ).length;

    // Act: press the macro; look just before the limit, at the limit, and 10 s later;
    // then press it again.
    store.applyCommand({ type: 'runMacro', macroId: openTheSessionMacroId }, operatorActor);
    vi.advanceTimersByTime(30_499);
    const runsJustBeforeTheLimit = store.readAllSlices().macroRuns.length;
    vi.advanceTimersByTime(1);
    const runsAtTheLimit = store.readAllSlices().macroRuns.length;
    const retryLinesAtTheLimit = countRetryLines();
    vi.advanceTimersByTime(10_000);
    const retryLinesTenSecondsLater = countRetryLines();
    const outcomeOfTheNextPress = store.applyCommand(
      { type: 'runMacro', macroId: openTheSessionMacroId },
      operatorActor,
    );

    // Assert: the run lasted exactly to its limit, was ended by the watchdog, which
    // warned once; the runner stopped retrying; the macros are free.
    expect(runsJustBeforeTheLimit, 'the run must be left alone before its limit').toBe(1);
    expect(runsAtTheLimit, 'the run must be ended at its limit').toBe(0);
    expect(
      readEventLogFromTheRunMacro(store).slice(-2),
      'the end must be signed by the watchdog in the event log',
    ).toEqual(['sistema:macro-watchdog endMacroRun', `${operatorActor} runMacro`]);
    expect(
      readRecordedLines()
        .filter((line) => line.message === 'macro run ended by the watchdog')
        .map((line) => [line.level, line.macro_id, line.limit_ms]),
      'one warning must name the macro and the limit',
    ).toEqual([['warn', openTheSessionMacroId, 30_500]]);
    expect(
      retryLinesTenSecondsLater,
      'the runner must stop retrying an end the watchdog already made',
    ).toBe(retryLinesAtTheLimit);
    expect(outcomeOfTheNextPress, 'the macros must be free again').toEqual({ ok: true });
  });

  it('leaves no timer behind for a run that ended on time, and never ends it twice', () => {
    // Arrange: take, wait 500 ms, clear, on a store that works.
    const { store } = startStoreAndRunnerWithMacro({ steps: takeWaitAndClearSteps });

    // Act: press the macro, let it end at 500 ms, then let a minute pass.
    store.applyCommand({ type: 'runMacro', macroId: openTheSessionMacroId }, operatorActor);
    vi.advanceTimersByTime(500);
    const timersLeftAtTheEnd = vi.getTimerCount();
    vi.advanceTimersByTime(60_000);

    // Assert: no timer was left once the run ended, and the watchdog never acted.
    expect(timersLeftAtTheEnd, 'the watchdog timer must be called off at the end').toBe(0);
    expect(
      readEventLogFromTheRunMacro(store).filter((line) =>
        line.startsWith('sistema:macro-watchdog'),
      ),
      'the watchdog must never act on a run that ended on time',
    ).toEqual([]);
  });

  it('is called off with the runner when the server closes', () => {
    // Arrange: take, wait 500 ms, clear; pressed and waiting.
    const { store, runner } = startStoreAndRunnerWithMacro({ steps: takeWaitAndClearSteps });
    store.applyCommand({ type: 'runMacro', macroId: openTheSessionMacroId }, operatorActor);
    vi.advanceTimersByTime(100);

    // Act: stop the runner, as the server does when it closes, and let a minute pass.
    runner.stop();
    const timersLeftAfterTheStop = vi.getTimerCount();
    vi.advanceTimersByTime(60_000);

    // Assert: no timer left, and the watchdog never acted.
    expect(timersLeftAfterTheStop, 'stop() must call the watchdog off too').toBe(0);
    expect(
      readEventLogFromTheRunMacro(store).filter((line) =>
        line.startsWith('sistema:macro-watchdog'),
      ),
      'a stopped watchdog must send nothing',
    ).toEqual([]);
  });
});
