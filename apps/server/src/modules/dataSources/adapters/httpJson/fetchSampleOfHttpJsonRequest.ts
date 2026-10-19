// "Buscar da fonte": one request of a flex source fetched once for the form's "Testar"
// panel, with the poll's own fetch code, caps and pt-BR errors, and a timeout of its own.
import type { HttpJsonRequest, HttpJsonSampleAnswer } from '@bajaovrlay/shared';

import type { ServerLogger } from '../../../../core/logger/createLogger.js';
import { ptBR } from '../../../../core/messages/ptBR.js';
import { longestPollTimeoutInMilliseconds } from '../../pollTimeouts.js';
import { fetchHttpJsonRequest } from './fetchHttpJsonRequest.js';
import type { ReadEnvironmentVariable } from './httpJsonRequestAddress.js';
import type { SourceHostAllowlist } from './sourceHostAllowlist.js';

/**
 * How long a sample may take: the poll's own ceiling, the same constant, so a source
 * that answers the form's "Buscar da fonte" also answers its polls.
 */
export const sampleRequestTimeoutInMilliseconds = longestPollTimeoutInMilliseconds;

/** What fetching a sample needs. */
export type FetchSampleOptions = {
  /** Reads a BAJAOVRLAY_SOURCE_ variable on the server, so a token never reaches the page. */
  readEnvironmentVariable: ReadEnvironmentVariable;
  /** BAJAOVRLAY_SOURCE_ALLOWED_HOSTS as read at boot: a sample obeys it like a poll. */
  sourceHostAllowlist: SourceHostAllowlist;
  /** The request's logger, so its lines carry the request_id. */
  logger: ServerLogger;
  /** Defaults to 10 s; tests shorten it. */
  timeoutInMilliseconds?: number | undefined;
};

/**
 * Fetches one request of a flex source and answers its parsed JSON, or the pt-BR error a
 * poll would give. It only reads: no command, no state, no event-log row. When the
 * timeout fires the error says so with the seconds waited, as the poller's does.
 */
export async function fetchSampleOfHttpJsonRequest(
  request: HttpJsonRequest,
  options: FetchSampleOptions,
): Promise<HttpJsonSampleAnswer> {
  const timeoutInMilliseconds = options.timeoutInMilliseconds ?? sampleRequestTimeoutInMilliseconds;
  // AbortSignal.timeout keeps no timer that would hold the process open.
  const signal = AbortSignal.timeout(timeoutInMilliseconds);
  const fetchResult = await fetchHttpJsonRequest(request, {
    signal,
    readEnvironmentVariable: options.readEnvironmentVariable,
    sourceHostAllowlist: options.sourceHostAllowlist,
    logger: options.logger,
  });
  if (fetchResult.ok) {
    return fetchResult;
  }
  if (signal.aborted) {
    const timeoutSeconds = timeoutInMilliseconds / 1_000;
    const error = ptBR.httpJsonErrors.sampleRequestTimedOut(request.requestId, timeoutSeconds);
    return { ok: false, error };
  }
  return fetchResult;
}
