import { z } from 'zod';

import { defaultItemColor, ItemColorSchema } from '../rundown/itemColor.js';
import { MacroStepSchema } from './macroStep.js';

/**
 * Adds a macro after the last one. The server gives it its id. The items and layers its
 * steps name are not checked here or by the server at save time; a step naming one that
 * does not exist is refused when it runs.
 */
export const CreateMacroCommandSchema = z.object({
  type: z.literal('createMacro'),
  label: z.string().min(1),
  /** Leaving it out gives the macro the neutral colour, as for an item. */
  color: ItemColorSchema.default(defaultItemColor),
  steps: z.array(MacroStepSchema),
});

/** A createMacro command after validation (colour filled in). */
export type CreateMacroCommand = z.infer<typeof CreateMacroCommandSchema>;
