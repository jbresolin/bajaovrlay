// The adapter of kind `httpJson`: a flex source, any JSON API read with the requests and
// the mapping its config lists.
import {
  applyFlexMapping,
  type DataShapeKey,
  type HttpJsonConfig,
  HttpJsonConfigSchema,
  type HttpJsonRequest,
} from '@bajaovrlay/shared';

import type { ServerLogger } from '../../../../core/logger/createLogger.js';
import type {
  DataSourceAdapter,
  DataSourcePollContext,
  PolledShapes,
} from '../dataSourceAdapter.js';
import { fetchHttpJsonRequest, type HttpJsonFetchResult } from './fetchHttpJsonRequest.js';
import type { ReadEnvironmentVariable } from './httpJsonRequestAddress.js';
import { createRememberedResponses } from './rememberedResponses.js';
import type { SourceHostAllowlist } from './sourceHostAllowlist.js';

/** What the httpJson adapter needs. */
export type HttpJsonAdapterOptions = {
  /** For one debug line per request: never a header, never the query. */
  logger: ServerLogger;
  /** Reads a BAJAOVRLAY_SOURCE_ variable at poll time; the server reads process.env. */
  readEnvironmentVariable: ReadEnvironmentVariable;
  /** BAJAOVRLAY_SOURCE_ALLOWED_HOSTS as read at boot; a request to a host off it fails the poll. */
  sourceHostAllowlist: SourceHostAllowlist;
};

/**
 * Builds the httpJson adapter. Each poll fetches every request of the config at once,
 * each with the poll's signal, then maps their JSON with the shared applyFlexMapping at
 * the poll's moment. All or nothing: one request that fails fails the whole poll, with
 * the error of the first failing request in the config's order, because a source never
 * half-succeeds (the same rule as the shapes). The shapes go back unvalidated; the store
 * validates them, as it does every adapter's (recordDataSourcePoll).
 *
 * A request with `refreshEveryMs` (BAJAOVRLAY-53) is fetched only once in that time: the
 * polls between reuse its last good response (rememberedResponses.ts). prepareForPolling,
 * which the poller calls when the source is turned on and when its config is saved, forgets
 * them, so either fetches afresh. The environment variables are read at each fetch, so a
 * token changed on the server is sent from the next fetch on without touching the source.
 */
export function createHttpJsonAdapter(
  options: HttpJsonAdapterOptions,
): DataSourceAdapter<HttpJsonConfig> {
  const { logger, readEnvironmentVariable, sourceHostAllowlist } = options;
  const rememberedResponses = createRememberedResponses();

  /** Gives a remembered response still within its time, or fetches the request afresh. */
  async function reuseOrFetchRequest(
    config: HttpJsonConfig,
    request: HttpJsonRequest,
    context: DataSourcePollContext,
    pollMomentMs: number,
  ): Promise<HttpJsonFetchResult> {
    const remembered = rememberedResponses.findStillFresh(config, request, pollMomentMs);
    if (remembered !== undefined) {
      logger.debug({ requestId: request.requestId }, 'flex source request reused');
      return { ok: true, status: remembered.status, body: remembered.body };
    }
    const fetchResult = await fetchHttpJsonRequest(request, {
      signal: context.signal,
      readEnvironmentVariable,
      sourceHostAllowlist,
      logger,
    });
    // Remembered as soon as it is fetched good, before mapping: an answer the poll then
    // refuses (by a refuseWhen flag, or by the shape's validation) is still reused for its
    // refreshEveryMs. That is acceptable because a request with a refresh time is a lookup
    // list (the teams), which carries no flag: the race or table that would raise one is
    // fetched at every poll. A broken list stays at most refreshEveryMs (an hour at most).
    if (fetchResult.ok) {
      rememberedResponses.remember(config, request, fetchResult, pollMomentMs);
    }
    return fetchResult;
  }

  async function pollOnce(
    config: HttpJsonConfig,
    context: DataSourcePollContext,
  ): Promise<PolledShapes> {
    const pollMomentMs = context.readCurrentTime().getTime();
    const fetchResults = await Promise.all(
      config.requests.map((request) => reuseOrFetchRequest(config, request, context, pollMomentMs)),
    );

    const responsesByRequestId = collectResponsesOrThrowTheFirstFailure(
      config.requests.map((request) => request.requestId),
      fetchResults,
    );
    const mappingResult = applyFlexMapping(config.mappings, responsesByRequestId, pollMomentMs);
    if (!mappingResult.ok) {
      throw new Error(mappingResult.summary);
    }
    return { shapes: mappingResult.shapes };
  }

  return {
    kind: 'httpJson',
    configSchema: HttpJsonConfigSchema,
    listProducedShapes: (config): DataShapeKey[] =>
      config.mappings.map((mapping) => mapping.shapeKey),
    pollOnce,
    prepareForPolling: (config) => {
      rememberedResponses.forgetEveryResponseOf(config);
    },
  };
}

/**
 * Puts each request's parsed body under its id, or throws the pt-BR error of the first
 * request (in the config's order) that failed, so the error a poll gives is the same
 * whichever request happened to answer first.
 */
function collectResponsesOrThrowTheFirstFailure(
  requestIds: string[],
  fetchResults: HttpJsonFetchResult[],
): Record<string, unknown> {
  const responsesByRequestId: Record<string, unknown> = {};
  for (let requestIndex = 0; requestIndex < fetchResults.length; requestIndex += 1) {
    const fetchResult = fetchResults[requestIndex];
    const requestId = requestIds[requestIndex];
    if (fetchResult === undefined || requestId === undefined) {
      continue;
    }
    if (!fetchResult.ok) {
      throw new Error(fetchResult.error);
    }
    responsesByRequestId[requestId] = fetchResult.body;
  }
  return responsesByRequestId;
}
