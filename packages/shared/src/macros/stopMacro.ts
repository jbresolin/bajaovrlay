import { z } from 'zod';

/**
 * The operator's "Parar" (button or key P): ends a macro's run after the step in
 * progress. A wait in progress is cut short, since it puts nothing on air; nothing the
 * run already did is undone. The command only marks the run (`isStopRequested`); the
 * server's macro runner sees the mark and ends the run. Refused for an unknown macro;
 * for a macro that is not running it is answered ok and leaves no trace.
 */
export const StopMacroCommandSchema = z.object({
  type: z.literal('stopMacro'),
  macroId: z.string().min(1),
});

/** A stopMacro command after validation. */
export type StopMacroCommand = z.infer<typeof StopMacroCommandSchema>;
