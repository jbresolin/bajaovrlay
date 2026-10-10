/**
 * Makes one OGraf lifecycle call on a graphic and logs it. Every call the renderer makes
 * goes through here, so the console (the only log OBS has) shows, for each instance, what
 * was asked of the graphic and what it answered.
 *
 * A graphic is someone else's code: it may answer a non-2xx status, throw even though
 * OGraf says it should not, or answer with nothing at all. None of these may stop the
 * renderer, so all three end here as a log line and an answer of "not accepted".
 */
import type { OGrafAnswer } from './ografGraphicElement.js';
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
  run: () => Promise<OGrafAnswer>;
};

/**
 * Runs the call and resolves with whether the graphic accepted it (a 2xx answer). Never
 * rejects: a refusal is logged as a warning; a thrown error, or an answer with no status
 * code, as an error.
 */
export async function makeLifecycleCall(
  subject: LifecycleCallSubject,
  call: LifecycleCall,
  logEvent: typeof logRendererEvent,
): Promise<boolean> {
  const callDetails = { action: call.action, skipAnimation: call.skipAnimation, ...subject };
  logEvent('info', 'graphic lifecycle call', callDetails);

  // `unknown` on purpose: the type says an answer with a status always comes back, but
  // that is a promise about JavaScript loaded at run time, so it is checked below.
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

  // For example an `async dispose()` that forgets its `return`. Reading `statusCode` of
  // that would throw from here and leave the caller's element orphaned on its layer.
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
