import { z } from 'zod';

/** Removes a macro. The server refuses it while that macro is running. */
export const DeleteMacroCommandSchema = z.object({
  type: z.literal('deleteMacro'),
  macroId: z.string().min(1),
});

/** A deleteMacro command after validation. */
export type DeleteMacroCommand = z.infer<typeof DeleteMacroCommandSchema>;
