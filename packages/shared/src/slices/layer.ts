import { z } from 'zod';

import { reportKeysListedTwice } from '../entities/entityKeysListedOnce.js';
import { OutputIdSchema } from '../outputs/output.js';
import { ptBROutputs } from '../outputs/ptBROutputs.js';

/**
 * How the renderer swaps one graphic for the next on the same layer: animate the old
 * one out before the new one comes in, cut instantly, or crossfade the two.
 */
export const LayerReplacePolicySchema = z.enum(['out-then-in', 'cut', 'crossfade']);

/**
 * A layer is a slot on one output's screen (bug, ticker, clock, lower-third, fullscreen,
 * a PiP's frame). Higher `zIndex` draws on top within its output. Each layer shows at
 * most one graphic on air and one in preview. Since BAJAOVRLAY-49 the operator adds,
 * edits and deletes layers on "Saídas e camadas"; a new database is seeded with the
 * program output's seven.
 */
export const LayerSchema = z.object({
  id: z.string().min(1),
  /** The output whose renderer draws this layer (`program`, `pip`). */
  outputId: OutputIdSchema,
  /** The name the operator sees, in pt-BR. */
  name: z.string().min(1),
  zIndex: z.number().int(),
  replacePolicy: LayerReplacePolicySchema,
  /** Whether the layer is meant to stay on across rundown items (used from M1). */
  persistent: z.boolean(),
});

/** A layer that has passed LayerSchema. */
export type Layer = z.infer<typeof LayerSchema>;

/**
 * The `layers` slice: each id once across every output (an item, a macro step or a
 * clear names a layer by its id alone), and each zIndex once within its output, so the
 * renderer never has to guess which of two layers draws on top.
 */
export const LayersSchema = z.array(LayerSchema).superRefine((layers, context) => {
  reportKeysListedTwice(
    layers.map((layer) => layer.id),
    'id',
    ptBROutputs.layerListedTwice,
    context,
  );
  const heightsTakenByOutput = new Map<string, Set<number>>();
  layers.forEach((layer, index) => {
    const heightsTaken = heightsTakenByOutput.get(layer.outputId) ?? new Set<number>();
    if (heightsTaken.has(layer.zIndex)) {
      context.addIssue({
        code: 'custom',
        path: [index, 'zIndex'],
        message: ptBROutputs.zIndexTakenInOutput(layer.name, layer.zIndex, layer.outputId),
      });
    }
    heightsTaken.add(layer.zIndex);
    heightsTakenByOutput.set(layer.outputId, heightsTaken);
  });
});
