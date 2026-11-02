import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';

import type { ApiTokens } from '../../core/apiAccess/apiTokens.js';
import { requireApiAccess } from '../../core/apiAccess/requireApiAccess.js';
import type { ErrorAnswerBody } from '../../core/http/errorAnswers.js';
import type { ServerAppEnvironment } from '../../core/http/httpContextVariables.js';
import { markRequestAsPolledByButtons } from '../../core/http/requestLogging.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import {
  getLayerButtonStateRoute,
  getMacroButtonStateRoute,
  getShortcutButtonStateRoute,
} from './buttonStateRoutes.js';
import {
  type ButtonStateLookup,
  readStateOfLayerForAButton,
  readStateOfMacroForAButton,
  readStateOfQuickFireButtonForAButton,
} from './buttonStates.js';

/**
 * Mounts the button state routes (BAJAOVRLAY-56) on the /api/v1 routes, behind the same
 * access as the rest of the command API (open mode or tokens; 403 when off). Each reads
 * the slices in memory only and never runs a command, so it writes no event-log row; its
 * request lines go to debug, or warn when refused (markRequestAsPolledByButtons).
 */
export function mountButtonStateRoutes(
  apiRoutes: OpenAPIHono<ServerAppEnvironment>,
  options: { stateStore: StateStore; apiTokens: ApiTokens; isOpenToTheNetwork: boolean },
): void {
  const { stateStore } = options;
  // The mark first, so the access check's own line of an open call is quiet too.
  const middleware = [
    markRequestAsPolledByButtons(),
    requireApiAccess({
      apiTokens: options.apiTokens,
      isOpenToTheNetwork: options.isOpenToTheNetwork,
    }),
  ];

  apiRoutes.openapi({ ...getLayerButtonStateRoute, middleware }, (context) => {
    const { layerId } = context.req.valid('param');
    const lookup = readStateOfLayerForAButton(stateStore.readAllSlices(), layerId);
    return answerWithButtonState(context, lookup);
  });

  apiRoutes.openapi({ ...getShortcutButtonStateRoute, middleware }, (context) => {
    const { panelId, buttonNumber } = context.req.valid('param');
    const lookup = readStateOfQuickFireButtonForAButton(
      stateStore.readAllSlices(),
      panelId,
      buttonNumber,
    );
    return answerWithButtonState(context, lookup);
  });

  apiRoutes.openapi({ ...getMacroButtonStateRoute, middleware }, (context) => {
    const { macroId } = context.req.valid('param');
    const lookup = readStateOfMacroForAButton(stateStore.readAllSlices(), macroId);
    return answerWithButtonState(context, lookup);
  });
}

/**
 * Answers a state with 200, or a refusal with 404 in the shared error shape: an id that
 * names nothing is "not found" here, not the 422 a command naming it gets, because a GET
 * of a missing thing is the plain 404 the D200 shows as "unmatched".
 */
function answerWithButtonState<State extends object>(
  context: Context<ServerAppEnvironment>,
  lookup: ButtonStateLookup<State>,
) {
  if (!lookup.isFound) {
    const body: ErrorAnswerBody = { error: lookup.refusal };
    return context.json(body, 404);
  }
  return context.json(lookup.state, 200);
}
