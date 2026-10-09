import { z } from 'zod';

/**
 * How the renderer swaps one graphic for the next on the same layer: animate the old
 * one out before the new one comes in, cut instantly, or crossfade the two.
 */
export const LayerReplacePolicySchema = z.enum(['out-then-in', 'cut', 'crossfade']);

/**
 * A layer is a fixed slot on screen (bug, ticker, clock, lower-third, fullscreen).
 * Higher `zIndex` draws on top. Each layer shows at most one graphic per output.
 */
export const LayerSchema = z.object({
  id: z.string().min(1),
  /** The name the operator sees, in pt-BR. */
  name: z.string().min(1),
  zIndex: z.number().int(),
  replacePolicy: LayerReplacePolicySchema,
  /** Whether the layer is meant to stay on across rundown items (used from M1). */
  persistent: z.boolean(),
});

/** A layer that has passed LayerSchema. */
export type Layer = z.infer<typeof LayerSchema>;
