import { OpenAPIHono } from '@hono/zod-openapi';

import type { ServerAppEnvironment } from '../../core/http/httpContextVariables.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { findDataSnapshotAnswer, getDataSnapshotRoute } from '../../modules/dataSources/index.js';
import { getStateRoute } from './stateRoute.js';

/**
 * Builds every route under /api/v1 and the OpenAPI document generated from their Zod
 * schemas, served at /api/v1/openapi.json. Routes stay thin: parse, authorise, call.
 */
export function createApiV1Routes(options: {
  stateStore: StateStore;
  version: string;
}): OpenAPIHono<ServerAppEnvironment> {
  const apiRoutes = new OpenAPIHono<ServerAppEnvironment>();

  apiRoutes.openapi(getStateRoute, (context) =>
    context.json(options.stateStore.readAllSlices(), 200),
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
