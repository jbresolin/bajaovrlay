import { Agent as HttpAgent, request as requestOverHttp } from 'node:http';
import { Agent as HttpsAgent, request as requestOverHttps } from 'node:https';
import type { LookupFunction } from 'node:net';

import type { HeadRequestOutcome, SendHeadRequest } from './httpDateClient.js';
import {
  buildLookupOptionForNodeRequests,
  type LookUpIpv4Addresses,
  lookUpIpv4AddressesThroughDns,
} from './ipv4LookUpThroughCAres.js';

/** The connections of one poll: a request function, and the close of every connection. */
export type ConnectionsForHeadRequests = {
  sendHeadRequest: SendHeadRequest;
  /** Closes every connection, idle or busy; called when the poll ends, however it ends. */
  closeEveryConnection: () => void;
};

/**
 * Opens the connections of one poll of the HTTP Date client (BAJAOVRLAY-76): HEAD
 * requests through node:http and node:https (no dependency), one connection per server,
 * kept open between its requests so that only the first pays for the TLS handshake and
 * the later round trips stay short.
 * Why not fetch: aborting a fetch mid-request, or timing it out, left its connection open
 * (httpHeadRequest.test.ts showed it); here a timeout or an abort destroys the request's
 * socket at once, and `closeEveryConnection` destroys the rest, as the NTP client closes
 * its socket.
 * A server's name is looked up through c-ares (ipv4LookUpThroughCAres.ts, as for NTP),
 * never the system's getaddrinfo: when DNS never answers, getaddrinfo holds a thread of
 * Node's pool for 10–30 s and cannot be cancelled, while a c-ares look-up gives up after
 * its own tries and a request destroyed meanwhile ignores its late answer.
 * `lookUpIpv4Addresses` is for tests; the default is c-ares.
 */
export function openConnectionsForHeadRequests(
  options: { lookUpIpv4Addresses?: LookUpIpv4Addresses | undefined } = {},
): ConnectionsForHeadRequests {
  const agentOverHttp = new HttpAgent({ keepAlive: true, maxSockets: 1 });
  const agentOverHttps = new HttpsAgent({ keepAlive: true, maxSockets: 1 });
  const lookup = buildLookupOptionForNodeRequests(
    options.lookUpIpv4Addresses ?? lookUpIpv4AddressesThroughDns,
  );
  return {
    sendHeadRequest: (address, requestOptions) =>
      sendOneHeadRequest(address, { ...requestOptions, agentOverHttp, agentOverHttps, lookup }),
    closeEveryConnection: () => {
      agentOverHttp.destroy();
      agentOverHttps.destroy();
    },
  };
}

/**
 * One HEAD request for the Date header. Never rejects: a timeout, an abort (the server
 * clock's discipline stopped) and a network error are each an outcome with its reason.
 * A redirect is not followed: its answer carries a Date header too.
 */
function sendOneHeadRequest(
  address: string,
  options: {
    timeoutMs: number;
    abortSignal: AbortSignal;
    agentOverHttp: HttpAgent;
    agentOverHttps: HttpsAgent;
    lookup: LookupFunction;
  },
): Promise<HeadRequestOutcome> {
  const { abortSignal } = options;
  if (abortSignal.aborted) {
    return Promise.resolve({ isAnswered: false, reason: 'aborted' });
  }
  return new Promise((resolve) => {
    const url = new URL(address);
    // A cache on the way would hand back an old Date.
    const headers = { 'cache-control': 'no-cache' };
    const { lookup } = options;
    const request =
      url.protocol === 'https:'
        ? requestOverHttps(url, { method: 'HEAD', agent: options.agentOverHttps, headers, lookup })
        : requestOverHttp(url, { method: 'HEAD', agent: options.agentOverHttp, headers, lookup });
    let isFinished = false;
    function finish(outcome: HeadRequestOutcome, isTheConnectionToBeClosed: boolean): void {
      if (isFinished) {
        return;
      }
      isFinished = true;
      clearTimeout(timeoutHandle);
      abortSignal.removeEventListener('abort', finishAsAborted);
      if (isTheConnectionToBeClosed) {
        request.destroy();
      }
      resolve(outcome);
    }
    function finishAsAborted(): void {
      finish({ isAnswered: false, reason: 'aborted' }, true);
    }
    abortSignal.addEventListener('abort', finishAsAborted, { once: true });
    const timeoutHandle = setTimeout(
      () => finish({ isAnswered: false, reason: 'timeout' }, true),
      options.timeoutMs,
    );
    request.on('response', (response) => {
      // A HEAD answer has no body; reading the empty one hands the connection back.
      response.resume();
      finish({ isAnswered: true, dateHeader: response.headers.date }, false);
    });
    // Also heard after a destroy above, when the outcome is already given.
    request.on('error', (requestError: NodeJS.ErrnoException) => {
      const detail = requestError.code ?? requestError.message;
      finish({ isAnswered: false, reason: 'unreachable', detail }, false);
    });
    request.end();
  });
}
