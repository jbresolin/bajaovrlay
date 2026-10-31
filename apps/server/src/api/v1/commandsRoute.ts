import { CommandMessageSchema } from '@bajaovrlay/shared';
import { createRoute } from '@hono/zod-openapi';

import { apiTokenSecurity, commandRouteResponses } from './commandApiOpenApi.js';

/**
 * `POST /api/v1/commands`: any operator command, in the very envelope the control page
 * sends over the WebSocket ({ type: 'command', requestId?, command }), answered with the
 * very commandResult it gets back (BAJAOVRLAY-28). The envelope leaves `command` unchecked
 * on purpose, as on the WebSocket: the store checks it against CommandSchema, so a bad
 * command is still written to the event log with the wrong field named. Its shapes are in
 * the document as the `Command` component.
 */
export const postCommandsRoute = createRoute({
  method: 'post',
  path: '/commands',
  summary: 'Run one operator command, as the control page does over the WebSocket',
  description:
    'The body is the WebSocket command envelope; `command` is one of the shapes of the ' +
    '`Command` component. Commands only the server sends (reportInstanceStatus, ' +
    'recordDataSourcePoll, ...) are refused with 403. The event log names the sender ' +
    '`api:<token name>`.',
  security: apiTokenSecurity,
  request: {
    body: {
      required: true,
      content: { 'application/json': { schema: CommandMessageSchema } },
    },
  },
  responses: commandRouteResponses,
});
