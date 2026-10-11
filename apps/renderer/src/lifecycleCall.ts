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
 * an answer of "not accepted" with a few words about why, which the renderer passes on to
 * the server when the instance could not go on air.
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

/** What came of a call: accepted, or not accepted with a few words about why. */
export type LifecycleCallOutcome =
  | { wasAccepted: true }
  | {
      wasAccepted: false;
      /** For example `it answered 400: O campo teamName é obrigatório.` */
      whyNot: string;
    };

// How long a load or a playAction may be awaited before the log says it is slow. Ten
// seconds is far longer than any font, image or in-animation should take, so a warning
// means something is stuck, not merely slow.
const slowCallWarningWaitInMilliseconds = 10_000;

/**
 * Runs the call and resolves with whether the graphic accepted it: a 2xx answer, or no
 * answer at all, which OGraf counts as a 200. Never rejects: a refusal is logged as a
 * warning; a thrown error, or an answer that is neither a status nor nothing, as an error.
 * A load or a playAction still unanswered after ten seconds is logged as slow, once, and
 * awaited all the same.
 */
export async function makeLifecycleCall(
  subject: LifecycleCallSubject,
  call: LifecycleCall,
  logEvent: typeof logRendererEvent,
): Promise<LifecycleCallOutcome> {
  const callDetails = { action: call.action, skipAnimation: call.skipAnimation, ...subject };
  logEvent('info', 'graphic lifecycle call', callDetails);

  // Only the two calls a graphic goes through on its way on air are watched: while one
  // of them is pending the layer is blocked and, inside OBS, nothing else would say why.
  // The timer only writes a log line. The call is never abandoned (concept §6: the
  // renderer only awaits the graphic's promises), so a graphic that never answers still
  // blocks its layer until the page is reloaded.
  const isWatchedForSlowness = call.action === 'load' || call.action === 'playAction';
  let slowCallWarningTimer: ReturnType<typeof setTimeout> | undefined = undefined;
  if (isWatchedForSlowness) {
    slowCallWarningTimer = setTimeout(() => {
      logEvent('warn', 'graphic lifecycle call is slow; still waiting for its answer', {
        ...callDetails,
        waitedMilliseconds: slowCallWarningWaitInMilliseconds,
      });
    }, slowCallWarningWaitInMilliseconds);
  }

  // `unknown` on purpose: the type says a status or nothing comes back, but that is a
  // promise about JavaScript loaded at run time, so it is checked below.
  let answer: unknown;
  try {
    answer = await call.run();
  } catch (callError) {
    const reason = String(callError);
    logEvent('error', 'graphic lifecycle call failed', { ...callDetails, reason });
    return { wasAccepted: false, whyNot: reason };
  } finally {
    // Answered or thrown, the wait is over: without this the warning would be written
    // ten seconds after a call that finished in time.
    clearTimeout(slowCallWarningTimer);
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
    return { wasAccepted: true };
  }

  // For example `null` or `{ ok: true }`. Reading `statusCode` of `null` would throw
  // from here and leave the caller's element orphaned on its layer.
  if (!isAnswerWithStatusCode(answer)) {
    logEvent('error', 'graphic answered a lifecycle call without a status', callDetails);
    return { wasAccepted: false, whyNot: 'it answered without a status code' };
  }

  const wasAccepted = answer.statusCode >= 200 && answer.statusCode < 300;
  if (!wasAccepted) {
    logEvent('warn', 'graphic refused a lifecycle call', {
      ...callDetails,
      statusCode: answer.statusCode,
      statusMessage: answer.statusMessage,
    });
    return { wasAccepted: false, whyNot: describeRefusal(answer) };
  }
  logEvent('info', 'graphic lifecycle call answered', {
    ...callDetails,
    statusCode: answer.statusCode,
  });
  return { wasAccepted: true };
}

/** Puts a refusal in words: the status, and the graphic's own message when it gave one. */
function describeRefusal(answer: OGrafAnswer): string {
  if (answer.statusMessage === undefined || answer.statusMessage === '') {
    return `it answered ${answer.statusCode}`;
  }
  return `it answered ${answer.statusCode}: ${answer.statusMessage}`;
}

/** Whether what a graphic resolved with is an object carrying a numeric status code. */
function isAnswerWithStatusCode(answer: unknown): answer is OGrafAnswer {
  if (typeof answer !== 'object' || answer === null) {
    return false;
  }
  return typeof (answer as { statusCode?: unknown }).statusCode === 'number';
}
