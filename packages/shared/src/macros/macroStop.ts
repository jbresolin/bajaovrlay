import { z } from 'zod';

/**
 * Where a run stopped short and why: the step that was refused, counted from 0, and the
 * refusal's pt-BR message ("O OBS não está conectado.").
 */
export const MacroStoppedAtStepSchema = z.object({
  stepIndex: z.number().int().min(0),
  reason: z.string().min(1),
});

/** A MacroStoppedAtStep that has passed MacroStoppedAtStepSchema. */
export type MacroStoppedAtStep = z.infer<typeof MacroStoppedAtStepSchema>;

/**
 * One macro whose last run stopped at a refused step (BAJAOVRLAY-27), so its button can
 * say where and why after the run is gone. The entry goes when the macro runs again or is
 * deleted.
 */
export const MacroStopSchema = MacroStoppedAtStepSchema.extend({
  macroId: z.string().min(1),
  /** When the run ended, as an ISO 8601 timestamp. */
  stoppedAt: z.iso.datetime(),
});

/** A MacroStop that has passed MacroStopSchema. */
export type MacroStop = z.infer<typeof MacroStopSchema>;

/**
 * The `macroStops` slice: at most one entry per macro. Kept in the server's memory only,
 * like the runs: after a restart it is empty.
 */
export const MacroStopsSchema = z.array(MacroStopSchema);
