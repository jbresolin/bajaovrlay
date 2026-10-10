import { SlicesSchema } from '@bajaovrlay/shared';
import { createRoute } from '@hono/zod-openapi';

/**
 * `GET /api/v1/state`: every slice at once. The renderer calls it when it reconnects;
 * the WebSocket keeps it up to date afterwards. Declared with its Zod schema so the
 * OpenAPI document describes the answer exactly.
 */
export const getStateRoute = createRoute({
  method: 'get',
  path: '/state',
  summary: 'Every state slice the server holds',
  responses: {
    200: {
      description: 'All slices: layers, graphics, instances and the newest event-log entries.',
      content: { 'application/json': { schema: SlicesSchema } },
    },
  },
});
