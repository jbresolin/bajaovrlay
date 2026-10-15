import { z } from 'zod';

import { ItemColorSchema } from '../rundown/itemColor.js';
import { MacroStepSchema } from './macroStep.js';

/**
 * Changes a macro's label, colour or steps; only what the command carries changes.
 * `steps` is always the whole new list (it replaces the old one), never a patch of one
 * step. The server refuses it while that macro is running.
 */
export const UpdateMacroCommandSchema = z.object({
  type: z.literal('updateMacro'),
  macroId: z.string().min(1),
  label: z.string().min(1).optional(),
  color: ItemColorSchema.optional(),
  steps: z.array(MacroStepSchema).optional(),
});

/** An updateMacro command after validation. */
export type UpdateMacroCommand = z.infer<typeof UpdateMacroCommandSchema>;
