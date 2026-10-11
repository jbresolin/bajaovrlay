/**
 * A lifecycle call that takes too long (apps/renderer)
 *
 * What this module is for:
 *   The renderer waits for a graphic's promises and never gives up on them (concept §6).
 *   A graphic whose load or playAction never answers therefore blocks its layer, and
 *   inside OBS nobody would know why the layer stays empty. So after ten seconds of
 *   waiting for a load or a playAction, makeLifecycleCall writes a warning that names the
 *   instance, its layer and its graphic. It keeps waiting all the same.
 *
 * What these tests prove:
 *   - A load, and a playAction, awaited for ten seconds are logged as a warning with the
 *     instance id, the layer and the graphic; nothing is logged a millisecond earlier, and
 *     the warning is written once, however long the wait goes on.
 *   - The call is not abandoned: when the graphic finally answers, the answer counts.
 *   - A load that answers in time leaves no warning behind, even ten seconds later.
 *   - The other calls (updateAction, stopAction, dispose) are never warned about; the
 *     brief asks for the warning on load and playAction only.
 *
 * What these tests deliberately do not cover:
 *   - Real time: the clock is Vitest's fake one, so ten seconds pass in an instant.
 *   - What an answered, refused or thrown call logs; lifecycleCall.test.ts.
 *   - A way out of a blocked layer: there is none short of reloading the page
 *     (docs/decisions.md), which the warning is there to tell the operator.
 */
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { enduroClockInstanceId } from './instancesOnAir.testSupport.js';
import {
  type LifecycleCall,
  type LifecycleCallSubject,
  makeLifecycleCall,
} from './lifecycleCall.js';
import type { OGrafAnswer } from './ografGraphicElement.js';
import type { RendererLogLevel } from './rendererLog.js';

/** One captured log line: its level, its message and the details written with it. */
type CapturedLogLine = {
  level: RendererLogLevel;
  message: string;
  details: Record<string, unknown>;
};

/** The enduro's race clock: the instance every call in these tests is made for. */
const enduroClock: LifecycleCallSubject = {
  instanceId: enduroClockInstanceId,
  layerId: 'clock',
  graphicId: 'race-clock',
};

/** Builds a log stand-in that keeps every line, and can hand back only the warnings. */
function createCapturedLog() {
  const logLines: CapturedLogLine[] = [];
  function logEvent(
    level: RendererLogLevel,
    message: string,
    details: Record<string, unknown> = {},
  ): void {
    logLines.push({ level, message, details });
  }
  function readWarnings(): CapturedLogLine[] {
    return logLines.filter((line) => line.level === 'warn');
  }
  return { logEvent, readWarnings };
}

/**
 * Builds a graphic's answer that stays pending until the test releases it, standing in
 * for a graphic that is waiting for something (its fonts, a long animation).
 */
function createAnswerReleasedByHand() {
  let releaseTheAnswer: () => void = () => undefined;
  const answerUnderWay = new Promise<OGrafAnswer>((resolve) => {
    releaseTheAnswer = () => resolve({ statusCode: 200 });
  });
  return { waitForTheAnswer: () => answerUnderWay, releaseTheAnswer: () => releaseTheAnswer() };
}

/** Puts Vitest's fake clock in place for one test and the real one back afterwards. */
function fakeTheClockForThisTest(): void {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

describe('a lifecycle call that has been awaited for ten seconds', () => {
  const callsThatAreWarnedAboutScenarios = [
    // A graphic stuck in its load: a font or an image that never arrives.
    { name: 'warns once about a load, and keeps waiting for it', action: 'load' as const },
    // A graphic stuck in its in-animation: a timeline that never reaches its end.
    {
      name: 'warns once about a playAction, and keeps waiting for it',
      action: 'playAction' as const,
    },
  ];

  it.each(callsThatAreWarnedAboutScenarios)('$name', async ({ action }) => {
    // Arrange: the clock faked, a captured log, and a graphic that does not answer yet.
    fakeTheClockForThisTest();
    const { logEvent, readWarnings } = createCapturedLog();
    const { waitForTheAnswer, releaseTheAnswer } = createAnswerReleasedByHand();
    const slowCall: LifecycleCall = { action, skipAnimation: false, run: waitForTheAnswer };

    // Act: the call is made; 9.999 s pass, then one more millisecond, then a whole
    // minute; only then does the graphic answer.
    const outcomeUnderWay = makeLifecycleCall(enduroClock, slowCall, logEvent);
    await vi.advanceTimersByTimeAsync(9_999);
    const warningsJustBeforeTenSeconds = [...readWarnings()];
    await vi.advanceTimersByTimeAsync(1);
    const warningsAtTenSeconds = [...readWarnings()];
    await vi.advanceTimersByTimeAsync(60_000);
    const warningsAMinuteLater = [...readWarnings()];
    releaseTheAnswer();
    const outcome = await outcomeUnderWay;

    // Assert: silence before ten seconds, one warning at ten seconds naming the
    // instance, its layer and its graphic, no second warning, and the late answer counts.
    expect(
      warningsJustBeforeTenSeconds,
      'nothing may be logged as slow before ten seconds have passed',
    ).toEqual([]);
    expect(
      warningsAtTenSeconds,
      'at ten seconds the call must be logged as slow, with instance id, layer and graphic',
    ).toEqual([
      {
        level: 'warn',
        message: 'graphic lifecycle call is slow; still waiting for its answer',
        details: {
          action,
          skipAnimation: false,
          instanceId: enduroClockInstanceId,
          layerId: 'clock',
          graphicId: 'race-clock',
          waitedMilliseconds: 10_000,
        },
      },
    ]);
    expect(
      warningsAMinuteLater,
      'the warning must be written once, not again every ten seconds',
    ).toHaveLength(1);
    expect(
      outcome,
      'the call must not be abandoned: an answer that comes late is still the answer',
    ).toEqual({ wasAccepted: true });
  });

  it('writes no warning when the load answered in time, even ten seconds later', async () => {
    // Arrange: the clock faked, a captured log, and a graphic that answers at once.
    fakeTheClockForThisTest();
    const { logEvent, readWarnings } = createCapturedLog();
    const loadThatAnswersAtOnce = async (): Promise<OGrafAnswer> => ({ statusCode: 200 });

    // Act: the load is made and answered; then ten seconds and more pass.
    await makeLifecycleCall(
      enduroClock,
      { action: 'load', skipAnimation: false, run: loadThatAnswersAtOnce },
      logEvent,
    );
    await vi.advanceTimersByTimeAsync(15_000);

    // Assert: no warning, because the wait ended long before ten seconds.
    expect(readWarnings(), 'a call that was answered in time must never be logged as slow').toEqual(
      [],
    );
  });

  const callsThatAreNotWarnedAboutScenarios = [
    // An update happens on a graphic that is already on air; the brief leaves it out.
    { name: 'does not warn about a slow updateAction', action: 'updateAction' as const },
    // An out-animation may be long by design.
    { name: 'does not warn about a slow stopAction', action: 'stopAction' as const },
    // A dispose only cleans up; nothing is waiting to go on air behind the warning.
    { name: 'does not warn about a slow dispose', action: 'dispose' as const },
  ];

  it.each(callsThatAreNotWarnedAboutScenarios)('$name', async ({ action }) => {
    // Arrange: the clock faked, a captured log, and a graphic that does not answer yet.
    fakeTheClockForThisTest();
    const { logEvent, readWarnings } = createCapturedLog();
    const { waitForTheAnswer, releaseTheAnswer } = createAnswerReleasedByHand();
    const slowCall: LifecycleCall = { action, skipAnimation: false, run: waitForTheAnswer };

    // Act: the call is made and a whole minute passes before the graphic answers.
    const outcomeUnderWay = makeLifecycleCall(enduroClock, slowCall, logEvent);
    await vi.advanceTimersByTimeAsync(60_000);
    const warningsAfterAMinute = [...readWarnings()];
    releaseTheAnswer();
    await outcomeUnderWay;

    // Assert: no warning; only load and playAction are watched.
    expect(
      warningsAfterAMinute,
      'only a slow load or playAction is warned about, never this call',
    ).toEqual([]);
  });
});
