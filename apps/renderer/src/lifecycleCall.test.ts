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
 *   - A call the graphic answers with nothing at all (`undefined`) counts as accepted with
 *     a 200, because OGraf v1 says so: "If the returned Promise resolves to `undefined`,
 *     it MUST be treated as a `{ statusCode: 200 }`." The log line says the 200 was assumed.
 *   - Any other answer with no status code (`null`, an object in another shape) is not
 *     what OGraf allows: it is logged as an error and counts as "not accepted"; the call
 *     still does not throw.
 *   - Every "not accepted" answer says why in a few words (`whyNot`), which the renderer
 *     passes on to the server as the reason an instance failed.
 *
 * What these tests deliberately do not cover:
 *   - The warning written when a load or a playAction has been awaited for ten seconds;
 *     lifecycleCall.slow.test.ts.
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
    const outcome = await makeLifecycleCall(
      ufprLowerThird,
      { action: 'load', skipAnimation: false, run: loadThatIsAccepted },
      logEvent,
    );

    // Assert: two info lines, both naming the instance, its layer and its graphic.
    expect(outcome, 'a 200 answer must count as accepted').toEqual({ wasAccepted: true });
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
    const outcome = await makeLifecycleCall(
      ufprLowerThird,
      { action: 'load', skipAnimation: false, run: loadThatIsRefused },
      logEvent,
    );

    // Assert: not accepted, with the status and the graphic's own words as the reason,
    // and the last line is a warning that says who refused and why.
    expect(outcome, 'a 400 answer must count as not accepted, and say why').toEqual({
      wasAccepted: false,
      whyNot: 'it answered 400: O campo teamName é obrigatório.',
    });
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
    const outcome = await makeLifecycleCall(
      ufprLowerThird,
      { action: 'stopAction', skipAnimation: true, run: stopThatThrows },
      logEvent,
    );

    // Assert: not accepted, with the thrown error as the reason, and the last line is an
    // error carrying the same reason.
    expect(outcome, 'a call that throws must count as not accepted, and say why').toEqual({
      wasAccepted: false,
      whyNot: 'Error: A animação de saída não foi encontrada.',
    });
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

  it('counts a call answered with nothing as accepted with a 200, as OGraf requires', async () => {
    // Arrange: a captured log, and a graphic whose dispose cleans up and returns nothing,
    // which OGraf v1 allows: a promise resolving to `undefined` means `{ statusCode: 200 }`.
    const { logLines, logEvent } = createCapturedLog();
    const disposeThatReturnsNothing = async (): Promise<void> => {};

    // Act: make the dispose call.
    const outcome = await makeLifecycleCall(
      ufprLowerThird,
      { action: 'dispose', skipAnimation: false, run: disposeThatReturnsNothing },
      logEvent,
    );

    // Assert: accepted, and the last line is the ordinary "answered" info line with the
    // 200 the renderer assumed and a note that the graphic itself answered nothing.
    expect(outcome, 'an answer of nothing must count as accepted').toEqual({ wasAccepted: true });
    expect(
      logLines.at(-1),
      'an answer of nothing must be logged as an assumed 200 at info level, not as a fault',
    ).toEqual({
      level: 'info',
      message: 'graphic lifecycle call answered',
      details: {
        action: 'dispose',
        skipAnimation: false,
        instanceId: ufprLowerThirdInstanceId,
        layerId: 'lower-third',
        graphicId: 'team-lower-third',
        statusCode: 200,
        wasAnsweredWithNothing: true,
      },
    });
  });

  // TypeScript says a graphic answers with a status or with nothing, but a graphic is
  // plain JavaScript loaded at run time, so the answers below do reach the renderer.
  // OGraf excuses only `undefined`; anything else without a status code is a fault.
  const answersWithoutAStatusScenarios = [
    // `null` is a value the graphic chose to return, not a missing `return`.
    {
      name: 'counts a call answered with null as not accepted, without throwing',
      answerOfTheGraphic: null,
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
    const outcome = await makeLifecycleCall(
      ufprLowerThird,
      { action: 'dispose', skipAnimation: false, run: disposeWithoutAStatus },
      logEvent,
    );

    // Assert: not accepted, and the last line is an error naming the instance.
    expect(outcome, 'an answer without a status must count as not accepted').toEqual({
      wasAccepted: false,
      whyNot: 'it answered without a status code',
    });
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
