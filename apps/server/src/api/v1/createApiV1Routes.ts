import { OpenAPIHono } from '@hono/zod-openapi';

import type { ErrorAnswerBody } from '../../core/http/errorAnswers.js';
import type { ServerAppEnvironment } from '../../core/http/httpContextVariables.js';
import { ptBR } from '../../core/messages/ptBR.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { findDataSnapshotAnswer, getDataSnapshotRoute } from '../../modules/dataSources/index.js';
import { chooseSlicesForStateReader, getStateRoute } from './stateRoute.js';

/**
 * Builds every route under /api/v1 and the OpenAPI document generated from their Zod
 * schemas, served at /api/v1/openapi.json. Routes stay thin: parse, authorise, call.
 */
export function createApiV1Routes(options: {
  stateStore: StateStore;
  version: string;
}): OpenAPIHono<ServerAppEnvironment> {
  const apiRoutes = new OpenAPIHono<ServerAppEnvironment>();

  apiRoutes.openapi(
    getStateRoute,
    (context) => {
      const query = context.req.valid('query');
      const slices = chooseSlicesForStateReader(options.stateStore.readAllSlices(), query);
      return context.json(slices, 200);
    },
    // The only thing the query can get wrong is the role; the answer says which exist,
    // in the same JSON error shape as every other refusal, not Zod's own report.
    (validation, context) => {
      if (validation.success) {
        return undefined;
      }
      const body: ErrorAnswerBody = {
        error: { code: 'INVALID_STATE_ROLE', message: ptBR.errors.invalidStateRole },
      };
      return context.json(body, 400);
    },
  );

  apiRoutes.openapi(getDataSnapshotRoute, (context) => {
    const { sourceId } = context.req.valid('param');
    const answer = findDataSnapshotAnswer(options.stateStore.readAllSlices(), sourceId);
    if (!answer.isFound) {
      return context.json(answer.errorBody, 404);
    }
    return context.json(answer.snapshot, 200);
  });

  apiRoutes.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'BajaOvrLay server API', version: options.version },
    // Paths in the document are relative to this mount point.
    servers: [{ url: '/api/v1' }],
  });

  return apiRoutes;
}
