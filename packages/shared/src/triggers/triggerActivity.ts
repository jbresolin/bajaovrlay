import { z } from 'zod';

import { TriggerDataSchema } from './triggerData.js';

/**
 * Where a firing stands:
 * - `pending`: waiting for the operator in the Eventos tab ("Rodar" or "Descartar"),
 *   because its trigger asks, or because it was auto while another macro was running;
 * - `ran`: its macro was started, by itself or by "Rodar";
 * - `dismissed`: the operator said no ("Descartar"); "Desfazer" brings it back to pending.
 */
export const TriggerFiringStatusSchema = z.enum(['pending', 'ran', 'dismissed']);

/** One status of a firing. */
export type TriggerFiringStatus = z.infer<typeof TriggerFiringStatusSchema>;

/**
 * One firing of a trigger: which trigger and macro (the trigger's name as it was then, so
 * an entry still reads after the trigger is renamed or deleted), the data it carries, when
 * it fired and when its status last changed (ms since 1970, server clock), and, for an
 * auto firing that had to ask instead, why it could not run by itself (pt-BR).
 */
export const TriggerFiringSchema = z.object({
  firingId: z.string().min(1),
  triggerId: z.string().min(1),
  triggerName: z.string().min(1),
  macroId: z.string().min(1),
  data: TriggerDataSchema,
  firedAtMs: z.number().int().min(0),
  status: TriggerFiringStatusSchema,
  statusChangedAtMs: z.number().int().min(0),
  autoRunRefusal: z.string().min(1).nullable(),
});

/** One firing after validation. */
export type TriggerFiring = z.infer<typeof TriggerFiringSchema>;

/**
 * How many firings the slice keeps, newest last; every firing is in the event log too.
 * Past it the oldest answered firings go; a waiting firing is never dropped, so waiting
 * firings alone can pass it.
 */
export const triggerFiringsKept = 50;

/**
 * The `triggerActivity` slice: "Pausar gatilhos" (one global switch for rehearsals), when
 * each trigger last fired (for its minimum interval), and the newest firings. Kept in the
 * server's memory only: a boot starts unpaused, with no firing, as the brief asks, and a
 * firing waiting before a restart is not offered again afterwards.
 */
export const TriggerActivitySchema = z.object({
  isPaused: z.boolean(),
  lastFiredAtMsByTriggerId: z.record(z.string(), z.number().int().min(0)),
  firings: z.array(TriggerFiringSchema),
});

/** The `triggerActivity` slice after validation. */
export type TriggerActivity = z.infer<typeof TriggerActivitySchema>;

/** The slice every boot starts with: unpaused, nothing fired. */
export const triggerActivityAtBoot: TriggerActivity = {
  isPaused: false,
  lastFiredAtMsByTriggerId: {},
  firings: [],
};
