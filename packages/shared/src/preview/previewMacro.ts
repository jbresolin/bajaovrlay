import { z } from 'zod';

/**
 * A macro's "Prévia": shows on the preview output the screen as it will be when the
 * macro has ended. Every current preview and "will be cleared" marker is thrown away
 * first; then each step is played onto the preview only, in order, waits ignored. The
 * program output is never touched: "Tomar tudo" then applies that end state in one cut,
 * without the waits, while "Executar" (runMacro) still plays the macro with its timing.
 */
export const PreviewMacroCommandSchema = z.object({
  type: z.literal('previewMacro'),
  macroId: z.string().min(1),
});

/** A previewMacro command after validation. */
export type PreviewMacroCommand = z.infer<typeof PreviewMacroCommandSchema>;
