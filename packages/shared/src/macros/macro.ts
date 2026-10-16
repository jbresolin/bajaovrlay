import { z } from 'zod';

import { ItemColorSchema } from '../rundown/itemColor.js';
import { MacroStepSchema } from './macroStep.js';

/**
 * A macro: one button that runs several steps in a row ("Abrir a sessão": clock on,
 * bug on). The steps run strictly in the order of the list.
 */
export const MacroSchema = z.object({
  id: z.string().min(1),
  /** The button's text, in pt-BR. */
  label: z.string().min(1),
  /** One of the six item colour names, so a macro button is painted like an item's. */
  color: ItemColorSchema,
  /** May be empty: a macro being written may have no step yet, and runs as nothing. */
  steps: z.array(MacroStepSchema),
});

/** A macro that has passed MacroSchema. */
export type Macro = z.infer<typeof MacroSchema>;
