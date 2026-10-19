import { type Slices, SlicesSchema } from '@bajaovrlay/shared';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';

import { ErrorAnswerBodySchema } from '../../core/http/errorAnswers.js';
import { buildSlicesForAScreen } from '../../core/ws/slicesSentToScreens.js';

/**
 * The query of GET /state. `role` names the screen asking (`renderer` for the page OBS
 * loads, `monitor` for the control page's frames), as the WebSocket address does; with
 * no role the caller gets every slice.
 */
export const StateRouteQuerySchema = z.object({
  role: z.enum(['renderer', 'monitor']).optional(),
});

/** The query of GET /state after validation. */
export type StateRouteQuery = z.infer<typeof StateRouteQuerySchema>;

/**
 * `GET /api/v1/state`: every slice at once. A renderer page calls it with its own role
 * when its hello is late; the WebSocket keeps it up to date afterwards. Declared with
 * its Zod schemas so the OpenAPI document describes the question and the answer exactly.
 */
export const getStateRoute = createRoute({
  method: 'get',
  path: '/state',
  summary: 'Every state slice the server holds',
  request: { query: StateRouteQuerySchema },
  responses: {
    200: {
      description:
        'All slices: layers, graphics, instances and the newest event-log entries. With a ' +
        'role, only layers, graphics, instances and previewClearedLayerIds are filled and ' +
        'every other slice is an empty list, as the WebSocket sends a screen.',
      content: { 'application/json': { schema: SlicesSchema } },
    },
    400: {
      description: 'A role other than renderer or monitor (message in pt-BR).',
      content: { 'application/json': { schema: ErrorAnswerBodySchema } },
    },
  },
});

/**
 * The slices GET /state answers: every slice with no role, and for a screen the same
 * copy its WebSocket hello carries (slicesSentToScreens.ts: the four slices it draws,
 * the rest empty), so the fallback for a late hello never brings a screen a slice the
 * hub keeps from it.
 */
export function chooseSlicesForStateReader(slices: Slices, query: StateRouteQuery): Slices {
  if (query.role === undefined) {
    return slices;
  }
  return buildSlicesForAScreen(slices);
}
