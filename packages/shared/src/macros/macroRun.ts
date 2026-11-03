import { z } from 'zod';

import { TriggerDataSchema } from '../triggers/triggerData.js';

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
  /**
   * true once an operator pressed "Parar" (stopMacro): the runner sends no step after
   * the one in progress and ends the run. Pages show "Parando…" meanwhile.
   */
  isStopRequested: z.boolean(),
  /**
   * Set when a trigger started the run (BAJAOVRLAY-48), by itself or through "Rodar": the
   * trigger, its firing and the data its take steps' trigger fields read. Left out for a
   * run by hand. The rule against loops reads it: nothing this run causes fires a trigger.
   */
  trigger: z
    .object({
      triggerId: z.string().min(1),
      firingId: z.string().min(1),
      data: TriggerDataSchema,
    })
    .optional(),
});

/** A macro run that has passed MacroRunSchema. */
export type MacroRun = z.infer<typeof MacroRunSchema>;
