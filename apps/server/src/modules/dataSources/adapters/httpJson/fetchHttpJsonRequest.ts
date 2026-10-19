// Fetching one request of a flex source: the one GET a poll makes per request, and the
// one the sample route ("Buscar da fonte") makes, so both read the same answer with the
// same caps and the same pt-BR errors.
import { STATUS_CODES } from 'node:http';

import type { HttpJsonRequest } from '@bajaovrlay/shared';

import type { ServerLogger } from '../../../../core/logger/createLogger.js';
import { ptBR } from '../../../../core/messages/ptBR.js';
import {
  buildHttpJsonRequestToSend,
  type ReadEnvironmentVariable,
} from './httpJsonRequestAddress.js';
import { largestResponseBodyInBytes, readResponseBodyWithinCap } from './responseBodyWithinCap.js';
import type { SourceHostAllowlist } from './sourceHostAllowlist.js';

/** What fetching one request needs. */
export type FetchHttpJsonRequestOptions = {
  /** Fires when the caller gives up (the poll's timeout); the fetch stops at once. */
  signal: AbortSignal;
  readEnvironmentVariable: ReadEnvironmentVariable;
  /** BAJAOVRLAY_SOURCE_ALLOWED_HOSTS as read at boot; checked before anything is sent. */
  sourceHostAllowlist: SourceHostAllowlist;
  logger: ServerLogger;
};

/** The parsed JSON body and its status, or the pt-BR reason the request failed. */
export type HttpJsonFetchResult =
  { ok: true; status: number; body: unknown } | { ok: false; error: string };

/**
 * GETs one request with Node's own fetch and reads its body as JSON. It never throws: every
 * failure is a pt-BR sentence naming the request (and the host at most), checked in this
 * order: a host not on BAJAOVRLAY_SOURCE_ALLOWED_HOSTS, a variable named with no such
 * list set, a variable not set, the signal fired ("Tempo esgotado"), no connection, an
 * answer outside 2xx, a body over 5 MB, a body that is not JSON. No retry: the poller's
 * rhythm is the retry.
 *
 * Redirects are not followed (`redirect: 'manual'`, so a 3xx is an answer outside 2xx):
 * following one would send the headers, a token among them, to an address the operator
 * never typed.
 *
 * Network reach: with BAJAOVRLAY_SOURCE_ALLOWED_HOSTS set, only its hosts are fetched;
 * without it, any http(s) address an operator typed is, private or local ones included,
 * but no BAJAOVRLAY_SOURCE_ variable's value goes with it (gate 2 on PR #17). There is
 * no filter on private addresses as such: the timing system on the LAN is the main case.
 *
 * The log line carries the request id, host, path, status and size, never the query
 * (which may hold a variable's value) and never a header.
 */
export async function fetchHttpJsonRequest(
  request: HttpJsonRequest,
  options: FetchHttpJsonRequestOptions,
): Promise<HttpJsonFetchResult> {
  const { signal, readEnvironmentVariable, sourceHostAllowlist, logger } = options;
  const requestToSend = buildHttpJsonRequestToSend(request, {
    readEnvironmentVariable,
    sourceHostAllowlist,
  });
  if (!requestToSend.ok) {
    return requestToSend;
  }
  const { address, headers } = requestToSend;
  const whereItWasSent = {
    source_request: request.requestId,
    host: address.host,
    path: address.pathname,
  };

  let response: Response;
  try {
    response = await fetch(address, { method: 'GET', headers, signal, redirect: 'manual' });
  } catch (fetchError) {
    const error = describeFailureBeforeTheAnswer(
      fetchError,
      signal,
      address.host,
      request.requestId,
    );
    logger.debug({ ...whereItWasSent, error }, 'flex source request failed');
    return { ok: false, error };
  }

  const isSuccessStatus = response.status >= 200 && response.status <= 299;
  if (!isSuccessStatus) {
    // The body is not read, so it is cancelled to free the connection.
    await response.body?.cancel().catch(() => undefined);
    const statusName = STATUS_CODES[response.status] ?? response.statusText;
    const error = ptBR.httpJsonErrors.statusOutside2xx(
      response.status,
      statusName,
      request.requestId,
    );
    logger.debug(
      { ...whereItWasSent, status: response.status },
      'flex source request answered outside 2xx',
    );
    return { ok: false, error };
  }

  const bodyReading = await readTheBody(response, signal, address.host, request.requestId);
  if (!bodyReading.ok) {
    logger.debug(
      { ...whereItWasSent, status: response.status, error: bodyReading.error },
      'flex source request failed',
    );
    return bodyReading;
  }

  logger.debug(
    {
      ...whereItWasSent,
      status: response.status,
      body_bytes: bodyReading.bytesRead,
    },
    'flex source request answered',
  );
  return parseTheBodyAsJson(bodyReading.text, response.status, request.requestId);
}

/** Reads the body up to the cap, wording a cut-off or a stream that failed mid-way. */
async function readTheBody(
  response: Response,
  signal: AbortSignal,
  host: string,
  requestId: string,
): Promise<{ ok: true; text: string; bytesRead: number } | { ok: false; error: string }> {
  try {
    const reading = await readResponseBodyWithinCap(response.body, largestResponseBodyInBytes);
    if (!reading.isWithinCap) {
      const capInMegabytes = largestResponseBodyInBytes / 1_000_000;
      return { ok: false, error: ptBR.httpJsonErrors.bodyOverCap(requestId, capInMegabytes) };
    }
    return { ok: true, text: reading.text, bytesRead: reading.bytesRead };
  } catch (streamError) {
    return {
      ok: false,
      error: describeFailureBeforeTheAnswer(streamError, signal, host, requestId),
    };
  }
}

/** Parses the body as JSON, or says it is not JSON. */
function parseTheBodyAsJson(text: string, status: number, requestId: string): HttpJsonFetchResult {
  try {
    const body: unknown = JSON.parse(text);
    return { ok: true, status, body };
  } catch {
    return { ok: false, error: ptBR.httpJsonErrors.notValidJson(requestId) };
  }
}

/**
 * Words a fetch that threw: "Tempo esgotado" when the signal fired, otherwise "Não
 * consegui conectar a <host> (<request>): <reason>". The reason comes from the network
 * error's code only, never from its message, which could quote what was being sent.
 */
function describeFailureBeforeTheAnswer(
  fetchError: unknown,
  signal: AbortSignal,
  host: string,
  requestId: string,
): string {
  if (signal.aborted) {
    return ptBR.httpJsonErrors.requestTimedOut(requestId);
  }
  const reason = describeNetworkReason(readNetworkErrorCode(fetchError));
  return ptBR.httpJsonErrors.couldNotConnect(host, requestId, reason);
}

/**
 * The code of a network error. Node's fetch rejects with a TypeError ("fetch failed")
 * whose `cause` carries the code (ECONNREFUSED); a stream that fails mid-body may carry
 * the code itself.
 */
function readNetworkErrorCode(fetchError: unknown): string | undefined {
  const cause = fetchError instanceof Error ? fetchError.cause : undefined;
  const codeOfTheCause = readCodeOf(cause);
  return codeOfTheCause ?? readCodeOf(fetchError);
}

/** The text `code` of an error-like value, or undefined. */
function readCodeOf(value: unknown): string | undefined {
  const hasACode = typeof value === 'object' && value !== null && 'code' in value;
  if (!hasACode) {
    return undefined;
  }
  return typeof value.code === 'string' ? value.code : undefined;
}

/** The pt-BR reason for a network error code. */
function describeNetworkReason(code: string | undefined): string {
  if (code === undefined) {
    return ptBR.httpJsonErrors.networkReasonWithoutCode;
  }
  return (
    ptBR.httpJsonErrors.networkReasonsByCode[code] ??
    ptBR.httpJsonErrors.networkReasonWithCode(code)
  );
}
