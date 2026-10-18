// The module's REST route: GET /api/v1/data-sources/{sourceId}/snapshot. Declared here
// with its Zod schemas and mounted by api/v1/createApiV1Routes.ts, which stays thin.
import { type DataSnapshot, DataSnapshotSchema, type Slices } from '@bajaovrlay/shared';
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
