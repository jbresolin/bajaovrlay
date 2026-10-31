import { type Command, CommandSchema } from '@bajaovrlay/shared';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { z } from 'zod';

import type { ApiTokens } from '../../core/apiAccess/apiTokens.js';
import { requireApiToken } from '../../core/apiAccess/requireApiToken.js';
import type { ServerAppEnvironment } from '../../core/http/httpContextVariables.js';
import { ptBR } from '../../core/messages/ptBR.js';
import { describeInvalidMessage } from '../../core/store/commandRefusals.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { buildErrorCommandResult } from '../../core/ws/serverMessageBuilding.js';
import {
  answerOkWithoutACommand,
  type CommandApiAnswer,
  runCommandFromTheApi,
} from './commandApiAnswers.js';
import { apiTokenSecurityScheme, apiTokenSecuritySchemeName } from './commandApiOpenApi.js';
import {
  postClearAllRoute,
  postClearLayerRoute,
  postNextOnLayerRoute,
  postPreviewItemRoute,
  postRunMacroRoute,
  postStopMacroRoute,
  postTakeAllPreviewsRoute,
  postTakeItemRoute,
  postTakeNextRoute,
} from './commandShortcutRoutes.js';
import { postCommandsRoute } from './commandsRoute.js';
import { buildLayersStatus, getLayersStatusRoute } from './layersStatusRoute.js';
import {
  buildNextOnLayerCommandFromTheStepOnAir,
  buildStopMacroCommandOfTheRunningMacro,
  buildTakeNextCommandOfTheShownRundown,
} from './shortcutCommands.js';

/**
 * Mounts the command API (BAJAOVRLAY-28) on the /api/v1 routes: POST /commands, the nine
 * button shortcuts and GET /layers/status, each behind requireApiToken (named on each
 * route, never by a path pattern, so no other route can fall under it by accident), plus
 * the bearer scheme and the `Command` component in the OpenAPI document.
 */
export function mountCommandApiRoutes(
  apiRoutes: OpenAPIHono<ServerAppEnvironment>,
  options: { stateStore: StateStore; apiTokens: ApiTokens },
): void {
  const { stateStore } = options;
  const middleware = [requireApiToken(options.apiTokens)];

  apiRoutes.openAPIRegistry.registerComponent(
    'securitySchemes',
    apiTokenSecuritySchemeName,
    apiTokenSecurityScheme,
  );
  apiRoutes.openAPIRegistry.registerComponent('schemas', 'Command', buildCommandComponent());

  apiRoutes.openapi(
    { ...postCommandsRoute, middleware },
    (context) => {
      const envelope = context.req.valid('json');
      const answer = runCommandFromTheApi({
        commandInput: envelope.command,
        requestId: envelope.requestId ?? null,
        stateStore,
        tokenName: readTokenName(context),
        logger: context.get('requestLogger'),
      });
      return context.json(answer.body, answer.httpStatus);
    },
    // A body that is JSON but not the envelope gets the code a WebSocket message outside
    // the protocol gets, in the commandResult shape, not Zod's own report.
    (validation, context) => {
      if (validation.success) {
        return undefined;
      }
      return context.json(buildErrorCommandResult(null, describeInvalidMessage()), 400);
    },
  );

  apiRoutes.openapi({ ...postTakeNextRoute, middleware }, (context) => {
    const command = buildTakeNextCommandOfTheShownRundown(stateStore.readAllSlices());
    if (command === undefined) {
      const answer = buildNoRundownAnswer();
      return context.json(answer.body, answer.httpStatus);
    }
    return answerWithCommand(context, stateStore, command);
  });

  apiRoutes.openapi({ ...postTakeItemRoute, middleware }, (context) => {
    const { itemId } = context.req.valid('param');
    return answerWithCommand(context, stateStore, { type: 'takeItem', itemId });
  });

  apiRoutes.openapi({ ...postPreviewItemRoute, middleware }, (context) => {
    const { itemId } = context.req.valid('param');
    return answerWithCommand(context, stateStore, {
      type: 'previewItem',
      itemId,
      origin: 'manual',
    });
  });

  apiRoutes.openapi({ ...postTakeAllPreviewsRoute, middleware }, (context) => {
    return answerWithCommand(context, stateStore, { type: 'takeAllPreviews' });
  });

  apiRoutes.openapi({ ...postClearLayerRoute, middleware }, (context) => {
    const { layerId } = context.req.valid('param');
    return answerWithCommand(context, stateStore, { type: 'clearLayer', layerId });
  });

  apiRoutes.openapi({ ...postClearAllRoute, middleware }, (context) => {
    return answerWithCommand(context, stateStore, { type: 'clearAll' });
  });

  apiRoutes.openapi({ ...postNextOnLayerRoute, middleware }, (context) => {
    const { layerId } = context.req.valid('param');
    const command = buildNextOnLayerCommandFromTheStepOnAir(stateStore.readAllSlices(), layerId);
    return answerWithCommand(context, stateStore, command);
  });

  apiRoutes.openapi({ ...postRunMacroRoute, middleware }, (context) => {
    const { macroId } = context.req.valid('param');
    return answerWithCommand(context, stateStore, { type: 'runMacro', macroId });
  });

  apiRoutes.openapi({ ...postStopMacroRoute, middleware }, (context) => {
    const command = buildStopMacroCommandOfTheRunningMacro(stateStore.readAllSlices());
    if (command === undefined) {
      const answer = answerOkWithoutACommand(readTokenName(context), context.get('requestLogger'));
      return context.json(answer.body, answer.httpStatus);
    }
    return answerWithCommand(context, stateStore, command);
  });

  apiRoutes.openapi({ ...getLayersStatusRoute, middleware }, (context) => {
    return context.json(buildLayersStatus(stateStore.readAllSlices(), readTokenName(context)), 200);
  });
}

/** What the registry takes as a component; its own type is not exported. */
type OpenApiComponent = Parameters<OpenAPIHono['openAPIRegistry']['registerComponent']>[2];

/**
 * Every command's shape, generated from the shared CommandSchema by Zod itself, as a
 * client writes it (defaults may be left out). The registry's own conversion needs
 * schemas built with its extended Zod, which @bajaovrlay/shared does not use; anything
 * JSON Schema cannot say (a refinement) is left out of the description, not refused.
 */
function buildCommandComponent(): OpenApiComponent {
  const commandJsonSchema = z.toJSONSchema(CommandSchema, {
    io: 'input',
    unrepresentable: 'any',
    target: 'draft-2020-12',
  });
  // The document names its own dialect (OpenAPI 3.1); a component carries none.
  delete commandJsonSchema.$schema;
  // Zod's JSONSchema type and the registry's schema object describe the same JSON Schema
  // 2020-12 object (OpenAPI 3.1's schema object), but their TypeScript types differ (Zod
  // allows `false` for a schema, the registry's type does not), so the object is passed
  // as it is under the registry's type.
  return commandJsonSchema as OpenApiComponent;
}

/** Runs one command a shortcut built and answers with its commandResult and status. */
function answerWithCommand(
  context: Context<ServerAppEnvironment>,
  stateStore: StateStore,
  command: Command,
) {
  const answer = runCommandFromTheApi({
    commandInput: command,
    requestId: null,
    stateStore,
    tokenName: readTokenName(context),
    logger: context.get('requestLogger'),
  });
  return context.json(answer.body, answer.httpStatus);
}

/**
 * The name of the token requireApiToken matched. It always ran first on these routes, so
 * a missing name is a bug in the mounting, and throwing makes it a 500, never a command
 * signed by nobody.
 */
function readTokenName(context: Context<ServerAppEnvironment>): string {
  const tokenName = context.get('apiTokenName');
  if (tokenName === undefined) {
    throw new Error('a route of the command API ran without requireApiToken in front of it');
  }
  return tokenName;
}

/** The answer of "Tomar" when the server has no rundown at all (a damaged database). */
function buildNoRundownAnswer(): CommandApiAnswer {
  return {
    httpStatus: 409,
    body: buildErrorCommandResult(null, {
      code: 'RUNDOWN_NOT_FOUND',
      message: ptBR.errors.noRundownToTakeFrom,
    }),
  };
}
