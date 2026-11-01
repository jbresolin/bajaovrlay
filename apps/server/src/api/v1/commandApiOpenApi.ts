// What every route of the command API (BAJAOVRLAY-28) says alike in the OpenAPI document:
// the bearer scheme it asks for, and the answers it can give.
import { CommandResultMessageSchema } from '@bajaovrlay/shared';

import { ErrorAnswerBodySchema } from '../../core/http/errorAnswers.js';

/** The name of the bearer scheme in the document's components.securitySchemes. */
export const apiTokenSecuritySchemeName = 'apiToken';

/** The bearer scheme itself, registered once by mountCommandApiRoutes. */
export const apiTokenSecurityScheme = {
  type: 'http' as const,
  scheme: 'bearer',
  description:
    'One token per device, listed in the server variable BAJAOVRLAY_API_TOKENS as ' +
    'name=token pairs separated by commas. With BAJAOVRLAY_API_OPEN=true a request with no ' +
    'Authorization header is accepted too, as the device "rede". With neither, every route ' +
    'of the command API answers 403.',
};

/** What each route of the command API puts in its `security`: the bearer token. */
export const apiTokenSecurity = [{ [apiTokenSecuritySchemeName]: [] }];

const commandResultContent = { 'application/json': { schema: CommandResultMessageSchema } };
const errorAnswerContent = { 'application/json': { schema: ErrorAnswerBodySchema } };

/**
 * The answers of a route that runs a command: the WebSocket's commandResult, ok or a
 * refusal (whose `error` has the `{ code, message }` of every error answer), and the
 * token check's own two.
 */
export const commandRouteResponses = {
  200: {
    description: 'The command was run: the commandResult, ok.',
    content: commandResultContent,
  },
  400: {
    description: 'The command, or the body, is malformed; the message (pt-BR) names the field.',
    content: commandResultContent,
  },
  401: {
    description: 'No token, a wrong one, or a header that is not "Bearer <token>" (pt-BR).',
    content: errorAnswerContent,
  },
  403: {
    description:
      'Neither BAJAOVRLAY_API_TOKENS nor BAJAOVRLAY_API_OPEN=true is set (code API_TURNED_OFF), or the command is one only ' +
      'the server sends (code NOT_ALLOWED, in a commandResult); pt-BR.',
    content: commandResultContent,
  },
  409: {
    description:
      'The state right now is in the way (nothing in Prévia, a macro already running, the ' +
      'cursor on nothing); pressing again later may work. The commandResult, pt-BR.',
    content: commandResultContent,
  },
  422: {
    description:
      'The command names something that does not exist (an item, a layer, a macro) or ' +
      'carries content that cannot be used. The commandResult, pt-BR.',
    content: commandResultContent,
  },
  500: {
    description: 'The server broke while saving; look up the request id in its log.',
    content: commandResultContent,
  },
};
