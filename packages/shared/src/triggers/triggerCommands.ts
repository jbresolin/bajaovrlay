// The commands of triggers (BAJAOVRLAY-48). Operators create, change, delete and pause
// triggers, and answer a firing that asks; only the server's trigger service
// (`sistema:gatilhos`) sends fireTrigger.
import { z } from 'zod';

import {
  defaultTriggerMinimumIntervalMs,
  TriggerMinimumIntervalMsSchema,
  TriggerModeSchema,
  TriggerNameSchema,
  TriggerWhenSchema,
} from './trigger.js';
import { TriggerDataSchema } from './triggerData.js';

/**
 * Adds a trigger. On, asking first and with 10 s between firings unless said otherwise:
 * a new trigger never puts anything on air by surprise. Refused when the macro is unknown.
 */
export const CreateTriggerCommandSchema = z.object({
  type: z.literal('createTrigger'),
  name: TriggerNameSchema,
  isEnabled: z.boolean().default(true),
  when: TriggerWhenSchema,
  macroId: z.string().min(1),
  mode: TriggerModeSchema.default('ask'),
  minimumIntervalMs: TriggerMinimumIntervalMsSchema.default(defaultTriggerMinimumIntervalMs),
});

/** A createTrigger command after validation. */
export type CreateTriggerCommand = z.infer<typeof CreateTriggerCommandSchema>;

/** Changes any of a trigger's name, on/off, kind and filter, macro, mode and interval. */
export const UpdateTriggerCommandSchema = z.object({
  type: z.literal('updateTrigger'),
  triggerId: z.string().min(1),
  name: TriggerNameSchema.optional(),
  isEnabled: z.boolean().optional(),
  when: TriggerWhenSchema.optional(),
  macroId: z.string().min(1).optional(),
  mode: TriggerModeSchema.optional(),
  minimumIntervalMs: TriggerMinimumIntervalMsSchema.optional(),
});

/** An updateTrigger command after validation. */
export type UpdateTriggerCommand = z.infer<typeof UpdateTriggerCommandSchema>;

/** Removes a trigger. Its firings stay in the list, named as they were. */
export const DeleteTriggerCommandSchema = z.object({
  type: z.literal('deleteTrigger'),
  triggerId: z.string().min(1),
});

/** A deleteTrigger command after validation. */
export type DeleteTriggerCommand = z.infer<typeof DeleteTriggerCommandSchema>;

/** "Pausar gatilhos": while paused no trigger fires. Kept in memory; a boot starts unpaused. */
export const SetTriggersPausedCommandSchema = z.object({
  type: z.literal('setTriggersPaused'),
  isPaused: z.boolean(),
});

/** A setTriggersPaused command after validation. */
export type SetTriggersPausedCommand = z.infer<typeof SetTriggersPausedCommandSchema>;

/**
 * One firing of a trigger, sent only by the server's trigger service. `causedBy` is the
 * actor behind what happened (the OBS scene switch's actor, the API device, the event
 * detection, the service itself for a time): the two rules against loops read it.
 * `triggerName` is there for the event-log row, which must name the trigger; the reducer
 * reads the trigger by its id. A firing the trigger may not make now (off, paused, too
 * soon, a loop) changes nothing and leaves no row.
 */
export const FireTriggerCommandSchema = z.object({
  type: z.literal('fireTrigger'),
  triggerId: z.string().min(1),
  triggerName: z.string().min(1),
  data: TriggerDataSchema,
  causedBy: z.string().min(1),
});

/** A fireTrigger command after validation. */
export type FireTriggerCommand = z.infer<typeof FireTriggerCommandSchema>;

/** "Rodar": runs the macro of a firing that waits, with its data. Operators only. */
export const RunTriggerFiringCommandSchema = z.object({
  type: z.literal('runTriggerFiring'),
  firingId: z.string().min(1),
});

/** A runTriggerFiring command after validation. */
export type RunTriggerFiringCommand = z.infer<typeof RunTriggerFiringCommandSchema>;

/** "Descartar": says no to a firing that waits. Operators only. */
export const DismissTriggerFiringCommandSchema = z.object({
  type: z.literal('dismissTriggerFiring'),
  firingId: z.string().min(1),
});

/** A dismissTriggerFiring command after validation. */
export type DismissTriggerFiringCommand = z.infer<typeof DismissTriggerFiringCommandSchema>;

/** "Desfazer": a dismissed firing waits for the operator again. Operators only. */
export const RestoreTriggerFiringCommandSchema = z.object({
  type: z.literal('restoreTriggerFiring'),
  firingId: z.string().min(1),
});

/** A restoreTriggerFiring command after validation. */
export type RestoreTriggerFiringCommand = z.infer<typeof RestoreTriggerFiringCommandSchema>;
