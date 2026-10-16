import { z } from 'zod';

/**
 * Starts a macro: one press of its button. The command only records the run in the
 * `macroRuns` slice; the server's macro runner then sends each step as a command of its
 * own. Refused while any macro is running, this one included.
 */
export const RunMacroCommandSchema = z.object({
  type: z.literal('runMacro'),
  macroId: z.string().min(1),
});

/** A runMacro command after validation. */
export type RunMacroCommand = z.infer<typeof RunMacroCommandSchema>;
