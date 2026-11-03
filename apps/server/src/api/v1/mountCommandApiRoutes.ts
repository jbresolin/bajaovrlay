import { type Command, CommandSchema } from '@bajaovrlay/shared';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { z } from 'zod';

import type { ApiTokens } from '../../core/apiAccess/apiTokens.js';
import { requireApiAccess } from '../../core/apiAccess/requireApiAccess.js';
import type { ServerAppEnvironment } from '../../core/http/httpContextVariables.js';
import { ptBR } from '../../core/messages/ptBR.js';
import { buildApiActor } from '../../core/store/commandActors.js';
import { describeInvalidMessage } from '../../core/store/commandRefusals.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import {
  buildErrorCommandResult,
  buildOkCommandResult,
} from '../../core/ws/serverMessageBuilding.js';
import {
  fireTriggerFromAnHttpCall,
  type HttpTriggerCallOutcome,
} from '../../modules/triggers/index.js';
import {
  answerOkWithoutACommand,
  type CommandApiAnswer,
  runCommandFromTheApi,
} from './commandApiAnswers.js';
import { apiTokenSecurityScheme, apiTokenSecuritySchemeName } from './commandApiOpenApi.js';
import {
  refuseCommandBodyNotSentAsJson,
  refuseCommandBodyOverTheLimit,
} from './commandBodyChecks.js';
import {
  chooseHttpStatusOfCommandRefusal,
  type CommandRefusalHttpStatus,
} from './commandRefusalHttpStatus.js';
import {
  postClearAllRoute,
  postClearLayerRoute,
  postFireShortcutRoute,
  postNextOnLayerRoute,
  postObsSceneRoute,
  postPreviewItemRoute,
  postRunMacroRoute,
  postStopMacroRoute,
  postTakeAllPreviewsRoute,
  postTakeItemRoute,
  postTakeNextRoute,
} from './commandShortcutRoutes.js';
import { postCommandsRoute } from './commandsRoute.js';
import { postTriggerRoute, refuseTriggerBodyOverTheLimit } from './triggerRoute.js';
import { buildLayersStatus, getLayersStatusRoute } from './layersStatusRoute.js';
import {
  buildNextOnLayerCommandFromTheStepOnAir,
  buildStopMacroCommandOfTheRunningMacro,
  buildTakeItemCommandOfQuickFireButton,
  buildTakeNextCommandOfTheShownRundown,
} from './shortcutCommands.js';

/**
 * Mounts the command API (BAJAOVRLAY-28) on the /api/v1 routes: POST /commands, the ten
 * button shortcuts, OBS's scene button (BAJAOVRLAY-27), an HTTP trigger's address
 * (BAJAOVRLAY-48) and GET /layers/status, each behind requireApiAccess (named on each
 * route, never by a path pattern, so no other route can fall under it by accident), plus
 * the bearer scheme and the `Command` component in the OpenAPI document.
 */
export function mountCommandApiRoutes(
  apiRoutes: OpenAPIHono<ServerAppEnvironment>,
  options: { stateStore: StateStore; apiTokens: ApiTokens; isOpenToTheNetwork: boolean },
): void {
  const { stateStore } = options;
  const middleware = [
    requireApiAccess({
      apiTokens: options.apiTokens,
      isOpenToTheNetwork: options.isOpenToTheNetwork,
    }),
  ];

  apiRoutes.openAPIRegistry.registerComponent(
    'securitySchemes',
    apiTokenSecuritySchemeName,
    apiTokenSecurityScheme,
  );
  apiRoutes.openAPIRegistry.registerComponent('schemas', 'Command', buildCommandComponent());

  apiRoutes.openapi(
    {
      ...postCommandsRoute,
      // Access first, so nobody without it learns what the body checks accept.
      middleware: [
        ...middleware,
        refuseCommandBodyNotSentAsJson(),
        refuseCommandBodyOverTheLimit(),
      ],
    },
    (context) => {
      const envelope = context.req.valid('json');
      const answer = runCommandFromTheApi({
        commandInput: envelope.command,
        requestId: envelope.requestId ?? null,
        stateStore,
        tokenName: readApiCallerName(context),
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

  apiRoutes.openapi({ ...postFireShortcutRoute, middleware }, (context) => {
    const { panelId, buttonNumber } = context.req.valid('param');
    const built = buildTakeItemCommandOfQuickFireButton(
      stateStore.readAllSlices(),
      panelId,
      buttonNumber,
    );
    if (!built.isFound) {
      const body = buildErrorCommandResult(null, built.refusal);
      return context.json(body, chooseHttpStatusOfCommandRefusal(built.refusal.code));
    }
    return answerWithCommand(context, stateStore, built.command);
  });

  apiRoutes.openapi({ ...postStopMacroRoute, middleware }, (context) => {
    const command = buildStopMacroCommandOfTheRunningMacro(stateStore.readAllSlices());
    if (command === undefined) {
      const answer = answerOkWithoutACommand(
        readApiCallerName(context),
        context.get('requestLogger'),
      );
      return context.json(answer.body, answer.httpStatus);
    }
    return answerWithCommand(context, stateStore, command);
  });

  apiRoutes.openapi({ ...postObsSceneRoute, middleware }, (context) => {
    const { sceneName } = context.req.valid('param');
    return answerWithCommand(context, stateStore, {
      type: 'switchObsScene',
      sceneName,
      target: 'program',
    });
  });

  // An HTTP trigger (BAJAOVRLAY-48): the size check after access, as for /commands.
  apiRoutes.openapi(
    { ...postTriggerRoute, middleware: [...middleware, refuseTriggerBodyOverTheLimit()] },
    async (context) => {
      const { triggerId } = context.req.valid('param');
      const callerName = readApiCallerName(context);
      const outcome = fireTriggerFromAnHttpCall({
        stateStore,
        triggerId,
        bodyText: await context.req.text(),
        callerActor: buildApiActor(callerName),
      });
      const httpStatus = chooseHttpStatusOfTriggerCall(outcome);
      context.get('requestLogger').info(
        { api_token_name: callerName, trigger_id: triggerId, status: httpStatus },
        'api trigger call answered',
      );
      if (outcome.status === 'fired') {
        return context.json(buildOkCommandResult(null), 200);
      }
      return context.json(buildErrorCommandResult(null, outcome.error), httpStatus);
    },
  );

  apiRoutes.openapi({ ...getLayersStatusRoute, middleware }, (context) => {
    return context.json(
      buildLayersStatus(stateStore.readAllSlices(), readApiCallerName(context)),
      200,
    );
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
    tokenName: readApiCallerName(context),
    logger: context.get('requestLogger'),
  });
  return context.json(answer.body, answer.httpStatus);
}

/**
 * Who requireApiAccess let in: a device's name, or "rede" when the API is open. It always
 * ran first on these routes, so a missing name is a bug in the mounting, and throwing
 * makes it a 500, never a command signed by nobody.
 */
function readApiCallerName(context: Context<ServerAppEnvironment>): string {
  const callerName = context.get('apiCallerName');
  if (callerName === undefined) {
    throw new Error('a route of the command API ran without requireApiAccess in front of it');
  }
  return callerName;
}

/** The answer of "Tomar" when the server has no rundown at all (a damaged database). */
function buildNoRundownAnswer(): CommandApiAnswer {
  return {
    httpStatus: chooseHttpStatusOfCommandRefusal('RUNDOWN_NOT_FOUND'),
    body: buildErrorCommandResult(null, {
      code: 'RUNDOWN_NOT_FOUND',
      message: ptBR.errors.noRundownToTakeFrom,
    }),
  };
}

/**
 * The status of a call to an HTTP trigger: 200 fired, 404 when the address names no HTTP
 * trigger (here the id is the address itself, unlike a command naming a missing id, which
 * answers 422), and the usual status of any other refusal (400 body, 409 not fired).
 */
function chooseHttpStatusOfTriggerCall(outcome: HttpTriggerCallOutcome): 200 | 404 | CommandRefusalHttpStatus {
  if (outcome.status === 'fired') {
    return 200;
  }
  if (outcome.error.code === 'TRIGGER_NOT_FOUND') {
    return 404;
  }
  return chooseHttpStatusOfCommandRefusal(outcome.error.code);
}
