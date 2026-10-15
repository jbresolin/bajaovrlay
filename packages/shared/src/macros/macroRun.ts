import { z } from 'zod';

/**
 * A macro that is running now, so its button can show it. The entry appears when
 * runMacro is accepted and is removed when the run ends, whatever the outcome. The
 * `macroRuns` slice lives in the server's memory only: after a restart it is empty.
 */
export const MacroRunSchema = z.object({
  macroId: z.string().min(1),
  /** When the server accepted the runMacro, as an ISO 8601 timestamp. */
  startedAt: z.iso.datetime(),
  /** The step running now (a wait included), counted from 0. */
  currentStep: z.number().int().min(0),
});

/** A macro run that has passed MacroRunSchema. */
export type MacroRun = z.infer<typeof MacroRunSchema>;
