import type { Instance, Slices } from '@bajaovrlay/shared';
import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';

import { ErrorAnswerBodySchema } from '../../core/http/errorAnswers.js';
import { apiTokenSecurity } from './commandApiOpenApi.js';
import { findInstanceOnLayer, readItemLabelOfInstance } from './instancesOnLayers.js';

/** One layer as a button reads it: on air, in preview, and the name of each one's item. */
const LayerStatusSchema = z.object({
  /** The layer's name as the operator sees it ("Relógio"). */
  name: z.string(),
  isOnAir: z.boolean(),
  /** The label of the item on air; null with nothing on air or when its item was deleted. */
  onAirItemName: z.string().nullable(),
  isInPreview: z.boolean(),
  /** The label of the item in Prévia; null with nothing there or when its item was deleted. */
  previewItemName: z.string().nullable(),
});

/**
 * The answer of GET /layers/status: each output by its id, with its layers by their ids,
 * the macro running, and the name of the token that asked, so a device set up with the
 * wrong token shows it at once.
 * Deliberate: outputs and layers are objects keyed by id, not lists, so a button reads
 * its value at a fixed path (`outputs.program.layers.clock.isOnAir`); Companion's
 * expressions can follow a path but not search a list. Their keys come in the order of
 * the slices (outputs by their order, layers as the layers slice lists them).
 */
export const LayersStatusSchema = z.object({
  tokenName: z.string(),
  runningMacro: z
    .object({
      macroId: z.string(),
      label: z.string(),
      /** "Parar" was pressed; the run ends after the step in progress. */
      isStopping: z.boolean(),
    })
    .nullable(),
  outputs: z.record(
    z.string(),
    z.object({ name: z.string(), layers: z.record(z.string(), LayerStatusSchema) }),
  ),
});

/** The answer of GET /layers/status, as a TypeScript type. */
export type LayersStatus = z.infer<typeof LayersStatusSchema>;

/**
 * `GET /api/v1/layers/status`: the feed that colours a pad's buttons. Small and read from
 * memory only, so Companion can poll it every second (BAJAOVRLAY-28).
 */
export const getLayersStatusRoute = createRoute({
  method: 'get',
  path: '/layers/status',
  summary: 'What is on air and in preview on each layer, and the macro running, for button colours',
  security: apiTokenSecurity,
  responses: {
    200: {
      description: 'Each output and layer, with the item on air and in preview by name.',
      content: { 'application/json': { schema: LayersStatusSchema } },
    },
    401: {
      description: 'No token, a wrong one, or a header that is not "Bearer <token>" (pt-BR).',
      content: { 'application/json': { schema: ErrorAnswerBodySchema } },
    },
    403: {
      description: 'BAJAOVRLAY_API_TOKENS is not set: the command API is off (pt-BR).',
      content: { 'application/json': { schema: ErrorAnswerBodySchema } },
    },
  },
});

/**
 * Builds the status from the slices. A layer counts as on air while any instance of its
 * program output is there (loading, on air, stopping or failed: something is on that
 * layer's screen, or meant to be), and in preview the same way.
 */
export function buildLayersStatus(slices: Slices, tokenName: string): LayersStatus {
  const outputsInOrder = [...slices.outputs].sort((first, second) => first.order - second.order);
  // Object.fromEntries defines each key as the object's own property, so an id such as
  // "__proto__" is listed like any other; assigning `layers[layer.id] = ...` to a plain
  // object would set its prototype instead and the layer would vanish (gate 2 of PR #34).
  const outputEntries = outputsInOrder.map((output) => {
    const layersOfOutput = slices.layers.filter((layer) => layer.outputId === output.outputId);
    const layerEntries = layersOfOutput.map((layer) => {
      const onAir = findInstanceOnLayer(slices.instances, layer.id, 'program');
      const inPreview = findInstanceOnLayer(slices.instances, layer.id, 'preview');
      const layerStatus = {
        name: layer.name,
        isOnAir: onAir !== undefined,
        onAirItemName: readItemNameOfInstance(slices, onAir),
        isInPreview: inPreview !== undefined,
        previewItemName: readItemNameOfInstance(slices, inPreview),
      };
      return [layer.id, layerStatus] as const;
    });
    const outputStatus = { name: output.name, layers: Object.fromEntries(layerEntries) };
    return [output.outputId, outputStatus] as const;
  });
  return {
    tokenName,
    runningMacro: readRunningMacro(slices),
    outputs: Object.fromEntries(outputEntries),
  };
}

/** The label of the item an instance came from, or null when there is none. */
function readItemNameOfInstance(slices: Slices, instance: Instance | undefined): string | null {
  return readItemLabelOfInstance(slices, instance) ?? null;
}

/** The macro running now with its label, or null. Only one runs at a time. */
function readRunningMacro(slices: Slices): LayersStatus['runningMacro'] {
  const run = slices.macroRuns[0];
  if (run === undefined) {
    return null;
  }
  const macro = slices.macros.find((candidate) => candidate.id === run.macroId);
  return {
    macroId: run.macroId,
    label: macro?.label ?? run.macroId,
    isStopping: run.isStopRequested,
  };
}
