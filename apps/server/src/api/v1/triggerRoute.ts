// POST /api/v1/triggers/{triggerId} (BAJAOVRLAY-48): the address of an HTTP trigger, for a
// D200 through Companion, a script or another machine. Declared here with its Zod schema
// so the OpenAPI document describes it; mountCommandApiRoutes puts the command API's
// access in front of it, and the triggers module handles the call.
import {
  CommandResultMessageSchema,
  largestTriggerHttpBodyBytes,
  ptBRTriggers,
} from '@bajaovrlay/shared';
import { createRoute } from '@hono/zod-openapi';
import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';

import type { ServerAppEnvironment } from '../../core/http/httpContextVariables.js';
import { buildErrorCommandResult } from '../../core/ws/serverMessageBuilding.js';
import { apiTokenSecurity, commandRouteResponses } from './commandApiOpenApi.js';

/** `POST /api/v1/triggers/{triggerId}`: fire one HTTP trigger, its body as the data. */
export const postTriggerRoute = createRoute({
  method: 'post',
  path: '/triggers/{triggerId}',
  summary: 'Fire an HTTP trigger: its macro runs, or waits for the operator',
  description:
    'The optional body is a flat JSON object of texts and numbers, at most 8 KB, as ' +
    '{"nome": "Ana Souza"}; it becomes the trigger’s data. A body that is not flat or is too ' +
    'large answers 400 (INVALID_TRIGGER_BODY); an id that is no HTTP trigger 404 ' +
    '(TRIGGER_NOT_FOUND); a trigger that is off, paused or within its minimum interval 409 ' +
    '(TRIGGER_NOT_FIRED). Any Content-Type is read as JSON.',
  security: apiTokenSecurity,
  request: { params: z.object({ triggerId: z.string().min(1) }) },
  responses: {
    ...commandRouteResponses,
    404: {
      description: 'The id names no HTTP trigger (TRIGGER_NOT_FOUND, pt-BR).',
      content: { 'application/json': { schema: CommandResultMessageSchema } },
    },
  },
});

/**
 * Refuses a body over 8 KB with 400 before it is read in full, in the commandResult shape
 * the route answers everything else in.
 */
export function refuseTriggerBodyOverTheLimit(): MiddlewareHandler<ServerAppEnvironment> {
  return bodyLimit({
    maxSize: largestTriggerHttpBodyBytes,
    onError: (context) => {
      const body = buildErrorCommandResult(null, {
        code: 'INVALID_TRIGGER_BODY',
        message: ptBRTriggers.httpBodyReasons.tooLarge,
      });
      return context.json(body, 400);
    },
  });
}
