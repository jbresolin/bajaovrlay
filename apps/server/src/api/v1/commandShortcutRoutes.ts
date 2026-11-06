// The button shortcuts of the command API (BAJAOVRLAY-28): fixed URLs with no body, which
// Companion's generic HTTP module handles best. Each builds one command; mountCommandApiRoutes
// runs it through the store's one path. Declared here with their Zod schemas so the
// OpenAPI document describes them.
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';

import { apiTokenSecurity, commandRouteResponses } from './commandApiOpenApi.js';

const ItemIdParameterSchema = z.object({ itemId: z.string().min(1) });
const LayerIdParameterSchema = z.object({ layerId: z.string().min(1) });
const MacroIdParameterSchema = z.object({ macroId: z.string().min(1) });

/** `POST /api/v1/take-next`: "Tomar", the item under the cursor of the rundown shown. */
export const postTakeNextRoute = createRoute({
  method: 'post',
  path: '/take-next',
  summary: '"Tomar": takeNext on the rundown the control page shows',
  security: apiTokenSecurity,
  responses: commandRouteResponses,
});

/** `POST /api/v1/take-item/{itemId}`: takeItem of one item, rundown or quick-fire. */
export const postTakeItemRoute = createRoute({
  method: 'post',
  path: '/take-item/{itemId}',
  summary: 'takeItem: put one item on air',
  security: apiTokenSecurity,
  request: { params: ItemIdParameterSchema },
  responses: commandRouteResponses,
});

/** `POST /api/v1/preview-item/{itemId}`: previewItem of one item, asked for by hand. */
export const postPreviewItemRoute = createRoute({
  method: 'post',
  path: '/preview-item/{itemId}',
  summary: 'previewItem: show one item in Prévia (origin manual)',
  security: apiTokenSecurity,
  request: { params: ItemIdParameterSchema },
  responses: commandRouteResponses,
});

/** `POST /api/v1/take-all-previews`: "Tomar tudo". */
export const postTakeAllPreviewsRoute = createRoute({
  method: 'post',
  path: '/take-all-previews',
  summary: '"Tomar tudo": takeAllPreviews',
  security: apiTokenSecurity,
  responses: commandRouteResponses,
});

/** `POST /api/v1/clear-layer/{layerId}`: clearLayer, on both outputs. */
export const postClearLayerRoute = createRoute({
  method: 'post',
  path: '/clear-layer/{layerId}',
  summary: 'clearLayer: take everything off one layer',
  security: apiTokenSecurity,
  request: { params: LayerIdParameterSchema },
  responses: commandRouteResponses,
});

/** `POST /api/v1/clear-all`: "Limpar tudo", the panic button. */
export const postClearAllRoute = createRoute({
  method: 'post',
  path: '/clear-all',
  summary: '"Limpar tudo": clearAll',
  security: apiTokenSecurity,
  responses: commandRouteResponses,
});

/** `POST /api/v1/next-on-layer/{layerId}`: "Próximo", from the step on air now. */
export const postNextOnLayerRoute = createRoute({
  method: 'post',
  path: '/next-on-layer/{layerId}',
  summary: '"Próximo": nextOnLayer from the step the graphic on air is on now',
  description:
    'The control page names the step the operator saw, so a double press is refused; this ' +
    'route reads the step on air when the request arrives, so two presses move two steps.',
  security: apiTokenSecurity,
  request: { params: LayerIdParameterSchema },
  responses: commandRouteResponses,
});

/** `POST /api/v1/run-macro/{macroId}`: a macro's button. */
export const postRunMacroRoute = createRoute({
  method: 'post',
  path: '/run-macro/{macroId}',
  summary: 'runMacro: start one macro',
  security: apiTokenSecurity,
  request: { params: MacroIdParameterSchema },
  responses: commandRouteResponses,
});

/**
 * `POST /api/v1/fire-shortcut/{panelId}/{buttonNumber}`: a quick-fire button by its place,
 * so a pad maps to positions rather than item ids, which change when an item is remade.
 */
export const postFireShortcutRoute = createRoute({
  method: 'post',
  path: '/fire-shortcut/{panelId}/{buttonNumber}',
  summary: 'takeItem of the n-th button of a quick-fire panel, as a click on it',
  description:
    "Buttons are counted from 1 in the panel's order, as the digit keys count them, with no " +
    "cap at nine. The rundown's cursor does not move. A panel or a button number that does " +
    'not exist answers 422 (QUICK_FIRE_PANEL_NOT_FOUND, QUICK_FIRE_BUTTON_NOT_FOUND).',
  security: apiTokenSecurity,
  // The number is read as text and checked by the route, so "0" or "dois" get the same
  // pt-BR 422 as a button past the last one, not Zod's report.
  request: { params: z.object({ panelId: z.string().min(1), buttonNumber: z.string().min(1) }) },
  responses: commandRouteResponses,
});

/** `POST /api/v1/stop-macro`: "Parar", the macro running now. */
export const postStopMacroRoute = createRoute({
  method: 'post',
  path: '/stop-macro',
  summary: '"Parar": stopMacro of the macro running now; ok with nothing running',
  security: apiTokenSecurity,
  responses: commandRouteResponses,
});

/**
 * `POST /api/v1/obs-scene/{sceneName}`: one of OBS's scenes on Program (BAJAOVRLAY-27), the
 * name URL-encoded as OBS spells it ("P%C3%B3dio" for "Pódio").
 */
export const postObsSceneRoute = createRoute({
  method: 'post',
  path: '/obs-scene/{sceneName}',
  summary: "switchObsScene: put one of OBS's scenes on Program",
  description:
    'The scene name is URL-encoded and must be spelt as OBS spells it. OBS not connected ' +
    'answers 409 (OBS_NOT_CONNECTED); a scene OBS does not have answers 422 ' +
    '(OBS_SCENE_NOT_FOUND). 200 means the switch was sent: OBS’s own answer reaches the ' +
    'control page’s tally, and a refusal by OBS is written to the event log.',
  security: apiTokenSecurity,
  request: { params: z.object({ sceneName: z.string().min(1) }) },
  responses: commandRouteResponses,
});

/** `POST /api/v1/undo-layer/{layerId}`: "Desfazer" on one layer (BAJAOVRLAY-30). */
export const postUndoLayerRoute = createRoute({
  method: 'post',
  path: '/undo-layer/{layerId}',
  summary: '"Desfazer": undoOnLayer, what the layer\'s program showed before its last change',
  security: apiTokenSecurity,
  request: { params: LayerIdParameterSchema },
  responses: commandRouteResponses,
});

/** `POST /api/v1/undo-last`: "Desfazer última", the newest change on program (BAJAOVRLAY-30). */
export const postUndoLastRoute = createRoute({
  method: 'post',
  path: '/undo-last',
  summary: '"Desfazer última": undoLastChangeOnProgram, every layer of the newest change',
  security: apiTokenSecurity,
  responses: commandRouteResponses,
});
