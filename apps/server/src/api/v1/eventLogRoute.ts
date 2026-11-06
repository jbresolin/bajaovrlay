import { EventLogPageQuerySchema, EventLogPageSchema } from '@bajaovrlay/shared';
import { createRoute } from '@hono/zod-openapi';

import { ErrorAnswerBodySchema } from '../../core/http/errorAnswers.js';
import { apiTokenSecurity } from './commandApiOpenApi.js';

/**
 * `GET /api/v1/event-log` (BAJAOVRLAY-30): the history's older pages, newest first, with
 * the page's filters. Declared with its Zod schemas so the OpenAPI document describes the
 * question and the answer exactly.
 */
export const getEventLogRoute = createRoute({
  method: 'get',
  path: '/event-log',
  summary: 'One page of the event log, newest first, with the history page’s filters',
  description:
    'The rows below `before` (from the newest when left out) that pass every filter given, ' +
    '`limit` of them (100 when left out, 500 at most). One request looks at 5,000 rows at ' +
    'most: a page may come back short or empty with `hasOlder` true, and `nextBefore` is ' +
    'the `before` of the next page. The control page reads it with no ' +
    'token; any other caller follows the command API’s access rules.',
  security: apiTokenSecurity,
  request: { query: EventLogPageQuerySchema },
  responses: {
    200: {
      description: 'The rows of the page and whether older ones pass the filters too.',
      content: { 'application/json': { schema: EventLogPageSchema } },
    },
    400: {
      description:
        'A limit outside 1–500, a `before` that is not a row id, or an unknown filter value.',
      content: { 'application/json': { schema: ErrorAnswerBodySchema } },
    },
    401: {
      description: 'From outside the control page: a missing, malformed or wrong token.',
      content: { 'application/json': { schema: ErrorAnswerBodySchema } },
    },
    403: {
      description: 'From outside the control page, with the command API turned off.',
      content: { 'application/json': { schema: ErrorAnswerBodySchema } },
    },
  },
});
