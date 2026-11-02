// The button state routes of the command API (BAJAOVRLAY-56): one flat answer per layer,
// quick-fire button and macro, for the Ulanzi D200's HTTP plugin, which polls a URL and
// reads one value by a one-word JSON path. Declared here with their Zod schemas so the
// OpenAPI document describes them; mountButtonStateRoutes.ts answers them.
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';

import { ErrorAnswerBodySchema } from '../../core/http/errorAnswers.js';
import { apiTokenSecurity } from './commandApiOpenApi.js';

/**
 * Deliberate: every value is a JSON boolean (or a text) at the top level of its answer.
 * The plugin's path may not go deeper than one key, and its expected value `true` is
 * meant to match a JSON `true` (to be confirmed on a real D200 at gate 2 of BAJAOVRLAY-56).
 */
const LayerButtonStateSchema = z.object({
  isOnAir: z.boolean(),
  isInPreview: z.boolean(),
  /** Marked "vai limpar" in Prévia: the next take of the layer clears it. */
  isMarkedToClear: z.boolean(),
  /** The label of the item on program; "" with nothing there or when its item was deleted. */
  itemName: z.string(),
});

const ShortcutButtonStateSchema = z.object({ isOnAir: z.boolean(), isInPreview: z.boolean() });

const MacroButtonStateSchema = z.object({ isRunning: z.boolean() });

const errorAnswerContent = { 'application/json': { schema: ErrorAnswerBodySchema } };

/** The refusals every state route shares: the access check's two, and an unknown id. */
const stateRouteRefusals = {
  401: {
    description: 'No token, a wrong one, or a header that is not "Bearer <token>" (pt-BR).',
    content: errorAnswerContent,
  },
  403: {
    description:
      'Neither BAJAOVRLAY_API_TOKENS nor BAJAOVRLAY_API_OPEN=true is set: the command API is off (pt-BR).',
    content: errorAnswerContent,
  },
  404: {
    description:
      'The id names nothing, so the button shows its "unmatched" image; the reason in pt-BR.',
    content: errorAnswerContent,
  },
};

/** `GET /api/v1/state/layer/{layerId}`: one layer, for a "LIMPAR" button. */
export const getLayerButtonStateRoute = createRoute({
  method: 'get',
  path: '/state/layer/{layerId}',
  summary: 'One layer for a button: on air, in preview, marked "vai limpar", the item on air',
  description: 'Read from memory; polled every second, so it logs at debug (errors at warn).',
  security: apiTokenSecurity,
  request: { params: z.object({ layerId: z.string().min(1) }) },
  responses: {
    200: {
      description: 'The layer, every value at the top level.',
      content: { 'application/json': { schema: LayerButtonStateSchema } },
    },
    ...stateRouteRefusals,
  },
});

/** `GET /api/v1/state/shortcut/{panelId}/{buttonNumber}`: the button fire-shortcut presses. */
export const getShortcutButtonStateRoute = createRoute({
  method: 'get',
  path: '/state/shortcut/{panelId}/{buttonNumber}',
  summary: 'A quick-fire button by its place: whether its item is on air or in Prévia',
  description:
    "Counted as fire-shortcut counts: from 1, in the panel's order. A panel or a button " +
    'number that does not exist answers 404 (QUICK_FIRE_PANEL_NOT_FOUND, ' +
    'QUICK_FIRE_BUTTON_NOT_FOUND). Read from memory; logs at debug (errors at warn).',
  security: apiTokenSecurity,
  // Read as text and checked by the finder, so "0" gets the same pt-BR 404 as a button
  // past the last one, as in fire-shortcut.
  request: { params: z.object({ panelId: z.string().min(1), buttonNumber: z.string().min(1) }) },
  responses: {
    200: {
      description: "The button's item: on air, in preview.",
      content: { 'application/json': { schema: ShortcutButtonStateSchema } },
    },
    ...stateRouteRefusals,
  },
});

/** `GET /api/v1/state/macro/{macroId}`: whether one macro runs. */
export const getMacroButtonStateRoute = createRoute({
  method: 'get',
  path: '/state/macro/{macroId}',
  summary: 'One macro for a button: whether it runs (until its run ends, "Parar" included)',
  description: 'Read from memory; polled every second, so it logs at debug (errors at warn).',
  security: apiTokenSecurity,
  request: { params: z.object({ macroId: z.string().min(1) }) },
  responses: {
    200: {
      description: 'The macro.',
      content: { 'application/json': { schema: MacroButtonStateSchema } },
    },
    ...stateRouteRefusals,
  },
});
