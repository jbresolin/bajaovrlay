/**
 * Makes one OGraf lifecycle call on a graphic and logs it. Every call the renderer makes
 * goes through here, so the console (the only log OBS has) shows, for each instance, what
 * was asked of the graphic and what it answered.
 *
 * A graphic may answer with nothing at all. OGraf v1 allows it: "If the returned Promise
 * resolves to `undefined`, it MUST be treated as a `{ statusCode: 200 }`." So that is an
 * accepted call here.
 *
 * A graphic is also someone else's code: it may answer a non-2xx status, throw even
 * though OGraf says it should not, or answer something that is neither a status nor
 * nothing. None of these may stop the renderer, so all three end here as a log line and
 * an answer of "not accepted".
 */
import type { OGrafAnswer, OGrafAnswerOrNothing } from './ografGraphicElement.js';
import type { logRendererEvent } from './rendererLog.js';

/** Which instance a call is for; written on every log line of that call. */
export type LifecycleCallSubject = {
  instanceId: string;
  layerId: string;
  graphicId: string;
};

/** The call to make: its OGraf name, whether it skips its animation, and how to make it. */
export type LifecycleCall = {
  action: 'load' | 'playAction' | 'updateAction' | 'stopAction' | 'dispose';
  skipAnimation: boolean;
  run: () => Promise<OGrafAnswerOrNothing>;
};

/**
 * Runs the call and resolves with whether the graphic accepted it: a 2xx answer, or no
 * answer at all, which OGraf counts as a 200. Never rejects: a refusal is logged as a
 * warning; a thrown error, or an answer that is neither a status nor nothing, as an error.
 */
export async function makeLifecycleCall(
  subject: LifecycleCallSubject,
  call: LifecycleCall,
  logEvent: typeof logRendererEvent,
): Promise<boolean> {
  const callDetails = { action: call.action, skipAnimation: call.skipAnimation, ...subject };
  logEvent('info', 'graphic lifecycle call', callDetails);

  // `unknown` on purpose: the type says a status or nothing comes back, but that is a
  // promise about JavaScript loaded at run time, so it is checked below.
  let answer: unknown;
  try {
    answer = await call.run();
  } catch (callError) {
    logEvent('error', 'graphic lifecycle call failed', {
      ...callDetails,
      reason: String(callError),
    });
    return false;
  }

  // For example an `async dispose()` with no `return`. OGraf v1 says a renderer MUST
  // treat that as `{ statusCode: 200 }`. Only `undefined` is excused: `null` is checked
  // below like any other answer. The log line says the 200 was assumed, in case someone
  // is looking for a graphic that forgot to report a failure.
  if (answer === undefined) {
    logEvent('info', 'graphic lifecycle call answered', {
      ...callDetails,
      statusCode: 200,
      wasAnsweredWithNothing: true,
    });
    return true;
  }

  // For example `null` or `{ ok: true }`. Reading `statusCode` of `null` would throw
  // from here and leave the caller's element orphaned on its layer.
  if (!isAnswerWithStatusCode(answer)) {
    logEvent('error', 'graphic answered a lifecycle call without a status', callDetails);
    return false;
  }

  const wasAccepted = answer.statusCode >= 200 && answer.statusCode < 300;
  if (!wasAccepted) {
    logEvent('warn', 'graphic refused a lifecycle call', {
      ...callDetails,
      statusCode: answer.statusCode,
      statusMessage: answer.statusMessage,
    });
    return false;
  }
  logEvent('info', 'graphic lifecycle call answered', {
    ...callDetails,
    statusCode: answer.statusCode,
  });
  return true;
}

/** Whether what a graphic resolved with is an object carrying a numeric status code. */
function isAnswerWithStatusCode(answer: unknown): answer is OGrafAnswer {
  if (typeof answer !== 'object' || answer === null) {
    return false;
  }
  return typeof (answer as { statusCode?: unknown }).statusCode === 'number';
}
