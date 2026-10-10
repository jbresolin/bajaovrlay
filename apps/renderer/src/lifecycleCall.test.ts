/**
 * Making one lifecycle call on a graphic, and logging it (apps/renderer)
 *
 * What this module is for:
 *   Every call the renderer makes on a graphic (load, playAction, updateAction, stopAction,
 *   dispose) goes through makeLifecycleCall. It writes what was asked and what the graphic
 *   answered to the log, always naming the instance, its layer and its graphic, because
 *   inside OBS the console is the only place to find out why a graphic is not on air. A
 *   graphic is someone else's code, so whatever it does, the call must never throw.
 *
 * What these tests prove:
 *   - An accepted call is logged when it is made and when it is answered, both lines
 *     carrying the instance id, the layer and the graphic, and the answer is "accepted".
 *   - A call the graphic refuses (a non-2xx status) is logged as a warning with the three
 *     ids, the status code and the graphic's message, and the answer is "not accepted".
 *   - A call that throws is logged as an error with the three ids and the reason.
 *   - A graphic that answers with nothing, or with no status code, is logged as an error
 *     and counts as "not accepted"; the call still does not throw.
 *
 * What these tests deliberately do not cover:
 *   - The console itself: the log is captured in a list here; rendererLog.test.ts checks
 *     the JSON line written to the console.
 *   - What the renderer does after a refusal (the layer stays empty);
 *     e2e/brokenGraphic.e2e.ts checks that in a real browser.
 */
import { describe, expect, it } from 'vitest';

import { ufprLowerThirdInstanceId } from './instancesOnAir.testSupport.js';
import { type LifecycleCallSubject, makeLifecycleCall } from './lifecycleCall.js';
import type { OGrafAnswer } from './ografGraphicElement.js';
import type { RendererLogLevel } from './rendererLog.js';

/** One captured log line: its level, its message and the details written with it. */
type CapturedLogLine = {
  level: RendererLogLevel;
  message: string;
  details: Record<string, unknown>;
};

/** Team 42's lower third: the instance every call in these tests is made for. */
const ufprLowerThird: LifecycleCallSubject = {
  instanceId: ufprLowerThirdInstanceId,
  layerId: 'lower-third',
  graphicId: 'team-lower-third',
};

/** Builds a log stand-in that keeps every line in a list the test reads afterwards. */
function createCapturedLog() {
  const logLines: CapturedLogLine[] = [];
  function logEvent(
    level: RendererLogLevel,
    message: string,
    details: Record<string, unknown> = {},
  ): void {
    logLines.push({ level, message, details });
  }
  return { logLines, logEvent };
}

describe('makeLifecycleCall', () => {
  it('logs an accepted call when it is made and when it is answered, with the three ids', async () => {
    // Arrange: a captured log, and a graphic that accepts its load with a 200.
    const { logLines, logEvent } = createCapturedLog();
    const loadThatIsAccepted = async (): Promise<OGrafAnswer> => ({ statusCode: 200 });

    // Act: make the load call for team 42's lower third.
    const wasAccepted = await makeLifecycleCall(
      ufprLowerThird,
      { action: 'load', skipAnimation: false, run: loadThatIsAccepted },
      logEvent,
    );

    // Assert: two info lines, both naming the instance, its layer and its graphic.
    expect(wasAccepted, 'a 200 answer must count as accepted').toBe(true);
    expect(
      logLines,
      'the call and its answer must both be logged with instance id, layer and graphic',
    ).toEqual([
      {
        level: 'info',
        message: 'graphic lifecycle call',
        details: {
          action: 'load',
          skipAnimation: false,
          instanceId: ufprLowerThirdInstanceId,
          layerId: 'lower-third',
          graphicId: 'team-lower-third',
        },
      },
      {
        level: 'info',
        message: 'graphic lifecycle call answered',
        details: {
          action: 'load',
          skipAnimation: false,
          instanceId: ufprLowerThirdInstanceId,
          layerId: 'lower-third',
          graphicId: 'team-lower-third',
          statusCode: 200,
        },
      },
    ]);
  });

  it('logs a refused call as a warning with the three ids, the status and the message', async () => {
    // Arrange: a captured log, and a graphic that refuses its data with a 400.
    const { logLines, logEvent } = createCapturedLog();
    const loadThatIsRefused = async (): Promise<OGrafAnswer> => ({
      statusCode: 400,
      statusMessage: 'O campo teamName é obrigatório.',
    });

    // Act: make the load call.
    const wasAccepted = await makeLifecycleCall(
      ufprLowerThird,
      { action: 'load', skipAnimation: false, run: loadThatIsRefused },
      logEvent,
    );

    // Assert: not accepted, and the last line is a warning that says who refused and why.
    expect(wasAccepted, 'a 400 answer must count as not accepted').toBe(false);
    expect(
      logLines.at(-1),
      'a refusal must be logged with instance id, layer, graphic, status code and message',
    ).toEqual({
      level: 'warn',
      message: 'graphic refused a lifecycle call',
      details: {
        action: 'load',
        skipAnimation: false,
        instanceId: ufprLowerThirdInstanceId,
        layerId: 'lower-third',
        graphicId: 'team-lower-third',
        statusCode: 400,
        statusMessage: 'O campo teamName é obrigatório.',
      },
    });
  });

  it('logs a call that throws as an error with the three ids, and does not throw itself', async () => {
    // Arrange: a captured log, and a graphic whose stop throws (a bug in the graphic).
    const { logLines, logEvent } = createCapturedLog();
    const stopThatThrows = async (): Promise<OGrafAnswer> => {
      throw new Error('A animação de saída não foi encontrada.');
    };

    // Act: make the stop call, without its animation.
    const wasAccepted = await makeLifecycleCall(
      ufprLowerThird,
      { action: 'stopAction', skipAnimation: true, run: stopThatThrows },
      logEvent,
    );

    // Assert: not accepted, and the last line is an error carrying the reason.
    expect(wasAccepted, 'a call that throws must count as not accepted').toBe(false);
    expect(
      logLines.at(-1),
      'a thrown error must be logged with instance id, layer, graphic and the reason',
    ).toEqual({
      level: 'error',
      message: 'graphic lifecycle call failed',
      details: {
        action: 'stopAction',
        skipAnimation: true,
        instanceId: ufprLowerThirdInstanceId,
        layerId: 'lower-third',
        graphicId: 'team-lower-third',
        reason: 'Error: A animação de saída não foi encontrada.',
      },
    });
  });

  // TypeScript says a graphic always answers with a status, but a graphic is plain
  // JavaScript loaded at run time, so the answers below do reach the renderer.
  const answersWithoutAStatusScenarios = [
    // The usual slip: an `async dispose()` that cleans up and forgets its `return`.
    {
      name: 'counts a call answered with nothing as not accepted, without throwing',
      answerOfTheGraphic: undefined,
    },
    // An answer object in some other shape, for example `{ ok: true }`.
    {
      name: 'counts a call answered without a status code as not accepted, without throwing',
      answerOfTheGraphic: { ok: true },
    },
  ];

  it.each(answersWithoutAStatusScenarios)('$name', async ({ answerOfTheGraphic }) => {
    // Arrange: a captured log, and a graphic whose dispose answers what the row says.
    const { logLines, logEvent } = createCapturedLog();
    const disposeWithoutAStatus = (): Promise<OGrafAnswer> =>
      Promise.resolve(answerOfTheGraphic as unknown as OGrafAnswer);

    // Act: make the dispose call.
    const wasAccepted = await makeLifecycleCall(
      ufprLowerThird,
      { action: 'dispose', skipAnimation: false, run: disposeWithoutAStatus },
      logEvent,
    );

    // Assert: not accepted, and the last line is an error naming the instance.
    expect(wasAccepted, 'an answer without a status must count as not accepted').toBe(false);
    expect(
      logLines.at(-1),
      'an answer without a status must be logged as an error with the three ids',
    ).toEqual({
      level: 'error',
      message: 'graphic answered a lifecycle call without a status',
      details: {
        action: 'dispose',
        skipAnimation: false,
        instanceId: ufprLowerThirdInstanceId,
        layerId: 'lower-third',
        graphicId: 'team-lower-third',
      },
    });
  });
});
