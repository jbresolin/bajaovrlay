// The two commands the server's macro runner sends about a run it is carrying out, so
// the `macroRuns` slice changes only through commands like every other slice. Only the
// runner of that very macro may send them (actor `sistema:macro:<macroId>`); operators
// and renderers are refused. A control page never sends either.
import { z } from 'zod';

import { MacroStoppedAtStepSchema } from './macroStop.js';

/** Says which step a running macro is at now, counted from 0. */
export const AdvanceMacroRunCommandSchema = z.object({
  type: z.literal('advanceMacroRun'),
  macroId: z.string().min(1),
  currentStep: z.number().int().min(0),
});

/** An advanceMacroRun command after validation. */
export type AdvanceMacroRunCommand = z.infer<typeof AdvanceMacroRunCommandSchema>;

/**
 * Says a macro's run is over, whatever the outcome: its entry leaves `macroRuns`. A run
 * that stopped at a refused step also says which step and why (BAJAOVRLAY-27), and that
 * stays on the macro's button (the `macroStops` slice) until the macro runs again.
 */
export const EndMacroRunCommandSchema = z.object({
  type: z.literal('endMacroRun'),
  macroId: z.string().min(1),
  /** Left out when the run went to its end or an operator stopped it ("Parar"). */
  stoppedAtStep: MacroStoppedAtStepSchema.optional(),
});

/** An endMacroRun command after validation. */
export type EndMacroRunCommand = z.infer<typeof EndMacroRunCommandSchema>;
