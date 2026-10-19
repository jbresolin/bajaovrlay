// The module's REST routes: GET /api/v1/data-sources/{sourceId}/snapshot and
// POST /api/v1/data-sources/http-json/sample-request. Declared here with their Zod
// schemas and mounted by api/v1/createApiV1Routes.ts, which stays thin.
import {
  type DataSnapshot,
  DataSnapshotSchema,
  HttpJsonRequestSchema,
  HttpJsonSampleAnswerSchema,
  type Slices,
} from '@bajaovrlay/shared';
import { createRoute } from '@hono/zod-openapi';

import { type ErrorAnswerBody, ErrorAnswerBodySchema } from '../../core/http/errorAnswers.js';
import { ptBR } from '../../core/messages/ptBR.js';
import { DataSnapshotRouteParamsSchema } from './schema.js';

/**
 * `GET /api/v1/data-sources/{sourceId}/snapshot`: the latest good data of one source, as
 * the `dataSnapshots` slice holds it, for a look without a WebSocket (a curl while
 * debugging). Answers a JSON 404 when the source does not exist or has no data yet.
 */
export const getDataSnapshotRoute = createRoute({
  method: 'get',
  path: '/data-sources/{sourceId}/snapshot',
  summary: 'The latest good data of one data source',
  request: { params: DataSnapshotRouteParamsSchema },
  responses: {
    200: {
      description: 'The snapshot: when it was received and its canonical shapes.',
      content: { 'application/json': { schema: DataSnapshotSchema } },
    },
    404: {
      description: 'No such source, or the source has no data yet (message in pt-BR).',
      content: { 'application/json': { schema: ErrorAnswerBodySchema } },
    },
  },
});

/** What the route answers: the snapshot, or the 404 body to send. */
export type DataSnapshotAnswer =
  { isFound: true; snapshot: DataSnapshot } | { isFound: false; errorBody: ErrorAnswerBody };

/**
 * Looks up the snapshot of a source in the slices. An unknown source and a source that
 * never polled well are told apart, so the reader knows whether to fix the address or
 * to wait for the first poll.
 */
export function findDataSnapshotAnswer(slices: Slices, sourceId: string): DataSnapshotAnswer {
  const source = slices.dataSources.find((candidate) => candidate.id === sourceId);
  if (source === undefined) {
    const message = ptBR.dataSourceErrors.dataSourceNotFound(sourceId);
    return { isFound: false, errorBody: { error: { code: 'DATA_SOURCE_NOT_FOUND', message } } };
  }
  const snapshot = slices.dataSnapshots.find((candidate) => candidate.sourceId === sourceId);
  if (snapshot === undefined) {
    const message = ptBR.dataSourceErrors.dataSnapshotNotFound(source.label);
    return { isFound: false, errorBody: { error: { code: 'DATA_SNAPSHOT_NOT_FOUND', message } } };
  }
  return { isFound: true, snapshot };
}

/**
 * `POST /api/v1/data-sources/http-json/sample-request`: "Buscar da fonte" on the flex
 * source form. Takes one request of a flex source (the same schema a saved config's
 * requests pass), fetches it once and answers its parsed JSON or the poll's pt-BR error.
 * A read with no state change, so a REST route and not a command, and no event-log row.
 * POST only because the request config is a body; nothing is created.
 */
export const postHttpJsonSampleRequestRoute = createRoute({
  method: 'post',
  path: '/data-sources/http-json/sample-request',
  summary: 'Fetch one request of a flex HTTP/JSON source once, as a sample',
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: HttpJsonRequestSchema } },
    },
  },
  responses: {
    200: {
      description:
        'The status and parsed JSON the source answered, or the pt-BR error a poll would give.',
      content: { 'application/json': { schema: HttpJsonSampleAnswerSchema } },
    },
    400: {
      description: 'The request config is invalid (the config schema reason, in pt-BR).',
      content: { 'application/json': { schema: ErrorAnswerBodySchema } },
    },
  },
});

/**
 * The 400 body for a sample request the config schema refused: the schema's own pt-BR
 * sentence for the first problem, the same one the form shows.
 */
export function buildInvalidSampleRequestAnswer(
  firstIssueMessage: string | undefined,
): ErrorAnswerBody {
  const message = firstIssueMessage ?? ptBR.errors.invalidSampleRequest;
  return { error: { code: 'INVALID_SAMPLE_REQUEST', message } };
}
