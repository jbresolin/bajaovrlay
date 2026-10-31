// The good responses of the requests that set `refreshEveryMs` (BAJAOVRLAY-53), kept in
// the adapter's memory so the polls between two refreshes reuse them: a teams list that
// changes once an event is fetched every 10 minutes while the race is fetched every 2 s.
import type { HttpJsonConfig, HttpJsonRequest } from '@bajaovrlay/shared';

/** One good response, as fetched, with when it was fetched and for how long it holds. */
type RememberedResponse = {
  status: number;
  body: unknown;
  fetchedAtMs: number;
  refreshEveryMs: number;
};

/** What the adapter does with the remembered responses. */
export type RememberedResponses = {
  /** The response of this request, when it was fetched less than refreshEveryMs ago. */
  findStillFresh: (
    config: HttpJsonConfig,
    request: HttpJsonRequest,
    nowMs: number,
  ) => { status: number; body: unknown } | undefined;
  /** Keeps a good response of a request that sets refreshEveryMs; ignores any other. */
  remember: (
    config: HttpJsonConfig,
    request: HttpJsonRequest,
    goodResponse: { status: number; body: unknown },
    fetchedAtMs: number,
  ) => void;
  /** Forgets every response of this config, so the next poll fetches each afresh. */
  forgetEveryResponseOf: (config: HttpJsonConfig) => void;
};

/**
 * Starts an empty memory. A response is kept under its config's whole JSON and its request
 * id, so a config saved with any change starts with nothing remembered ("a config change
 * fetches it again"), and so does a restart, which starts a new memory. Responses past their
 * time are dropped at each lookup, so responses of an old config do not pile up for more
 * than an hour (the longest refreshEveryMs). What could go wrong: a clock set back (a
 * replayed day) would make a response look younger than it is, so a response "fetched in
 * the future" is never reused.
 */
export function createRememberedResponses(): RememberedResponses {
  const responsesByKey = new Map<string, RememberedResponse>();

  function keyOf(config: HttpJsonConfig, requestId: string): string {
    return `${JSON.stringify(config)}\n${requestId}`;
  }

  function isStillFresh(remembered: RememberedResponse, nowMs: number): boolean {
    const ageMs = nowMs - remembered.fetchedAtMs;
    return ageMs >= 0 && ageMs < remembered.refreshEveryMs;
  }

  function dropResponsesPastTheirTime(nowMs: number): void {
    for (const [key, remembered] of responsesByKey) {
      if (!isStillFresh(remembered, nowMs)) {
        responsesByKey.delete(key);
      }
    }
  }

  return {
    findStillFresh: (config, request, nowMs) => {
      dropResponsesPastTheirTime(nowMs);
      if (request.refreshEveryMs === undefined) {
        return undefined;
      }
      const remembered = responsesByKey.get(keyOf(config, request.requestId));
      if (remembered === undefined) {
        return undefined;
      }
      return { status: remembered.status, body: remembered.body };
    },
    remember: (config, request, goodResponse, fetchedAtMs) => {
      if (request.refreshEveryMs === undefined) {
        return;
      }
      responsesByKey.set(keyOf(config, request.requestId), {
        status: goodResponse.status,
        body: goodResponse.body,
        fetchedAtMs,
        refreshEveryMs: request.refreshEveryMs,
      });
    },
    forgetEveryResponseOf: (config) => {
      for (const request of config.requests) {
        responsesByKey.delete(keyOf(config, request.requestId));
      }
    },
  };
}
