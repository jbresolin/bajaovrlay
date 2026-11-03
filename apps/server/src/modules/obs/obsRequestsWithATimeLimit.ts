// Requests to OBS that cannot wait for ever (BAJAOVRLAY-27). obs-websocket-js waits for
// an answer as long as the socket is open, and a frozen OBS keeps its socket open; so the
// connection asks OBS through here, where every request fails after the time limit or as
// soon as the connection it was sent on is gone.
import type { OBSWebSocket } from 'obs-websocket-js/json';

import { ObsAnswerTooLateError, ObsConnectionGoneError } from './obsAnswers.js';

/** The four requests the server sends to OBS. */
export type ObsRequestType =
  'GetSceneList' | 'GetStudioModeEnabled' | 'SetCurrentProgramScene' | 'SetCurrentPreviewScene';

/** The timers to use and the time limit; the connection passes its own. */
export type ObsRequestsWithATimeLimitOptions = {
  startTimer: (onTimeIsUp: () => void, delayInMilliseconds: number) => unknown;
  cancelTimer: (timerHandle: unknown) => void;
  timeObsHasToAnswerInMilliseconds: number;
};

/** How the connection asks OBS, and lets go of every request still waiting. */
export type ObsRequestsWithATimeLimit = {
  /** Resolves with OBS's answer; rejects on OBS's refusal, after the time limit, or a drop. */
  askObs: (
    client: OBSWebSocket,
    requestType: ObsRequestType,
    requestData: { sceneName: string } | undefined,
  ) => Promise<unknown>;
  /** Fails every request still waiting: the connection they were sent on is gone. */
  failEveryRequestWaitingForAnAnswer: () => void;
};

/** A request waiting for OBS's answer, so a drop or a stop can settle it at once. */
type RequestWaitingForObs = { timerHandle: unknown; failWith: (error: Error) => void };

/**
 * Creates the request sender of one OBS connection. An answer that comes after the
 * request was failed (too late, or after a drop) is dropped, so each request settles once.
 */
export function createObsRequestsWithATimeLimit(
  options: ObsRequestsWithATimeLimitOptions,
): ObsRequestsWithATimeLimit {
  const { startTimer, cancelTimer, timeObsHasToAnswerInMilliseconds } = options;
  const requestsWaitingForObs = new Set<RequestWaitingForObs>();

  function askObs(
    client: OBSWebSocket,
    requestType: ObsRequestType,
    requestData: { sceneName: string } | undefined,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const waitingRequest: RequestWaitingForObs = {
        timerHandle: undefined,
        failWith: (error) => {
          requestsWaitingForObs.delete(waitingRequest);
          cancelTimer(waitingRequest.timerHandle);
          reject(error);
        },
      };
      waitingRequest.timerHandle = startTimer(
        () => waitingRequest.failWith(new ObsAnswerTooLateError(requestType)),
        timeObsHasToAnswerInMilliseconds,
      );
      requestsWaitingForObs.add(waitingRequest);
      const request = client.call(requestType, requestData as never);
      request.then(
        (answer) => {
          if (requestsWaitingForObs.delete(waitingRequest)) {
            cancelTimer(waitingRequest.timerHandle);
            resolve(answer);
          }
        },
        (requestError: unknown) => {
          if (requestsWaitingForObs.has(waitingRequest)) {
            waitingRequest.failWith(
              requestError instanceof Error ? requestError : new Error(String(requestError)),
            );
          }
        },
      );
    });
  }

  function failEveryRequestWaitingForAnAnswer(): void {
    for (const waitingRequest of [...requestsWaitingForObs]) {
      waitingRequest.failWith(new ObsConnectionGoneError());
    }
  }

  return { askObs, failEveryRequestWaitingForAnAnswer };
}
