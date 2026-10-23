import { z } from 'zod';

import {
  checkModeAllowedForKind,
  EventRuleModeSchema,
  eventRuleTimeLimitsMs,
} from './eventRule.js';
import { DetectedEventSchema, InboxEventKindSchema } from './inboxEvent.js';

/**
 * Puts an event on air ("No ar"): the rule's item, filled from the event, on the program
 * output, leaving after the rule's duration. Operators and the automatic runner
 * (`sistema:eventos`) send it. An event older than its rule's maxAgeMs is expired instead.
 */
export const ShowEventCommandSchema = z.object({
  type: z.literal('showEvent'),
  eventId: z.string().min(1),
});

/** A showEvent command after validation. */
export type ShowEventCommand = z.infer<typeof ShowEventCommandSchema>;

/** Says no to a waiting event ("Descartar"). Operators only. */
export const DismissEventCommandSchema = z.object({
  type: z.literal('dismissEvent'),
  eventId: z.string().min(1),
});

/** A dismissEvent command after validation. */
export type DismissEventCommand = z.infer<typeof DismissEventCommandSchema>;

/**
 * Undoes "Descartar" ("Desfazer" on the console, "Restaurar" on the "Eventos" page): a
 * dismissed event waits for the operator again. Operators only.
 */
export const RestoreEventCommandSchema = z.object({
  type: z.literal('restoreEvent'),
  eventId: z.string().min(1),
});

/** A restoreEvent command after validation. */
export type RestoreEventCommand = z.infer<typeof RestoreEventCommandSchema>;

/**
 * Types an event by hand ("+ Evento"): a penalty or a notice about one car. Team and
 * school may be left out; the server fills them from the cars the sources list.
 * Operators only.
 */
export const CreateManualEventCommandSchema = z.object({
  type: z.literal('createManualEvent'),
  noticeKind: z.enum(['penalty', 'notice']),
  carNumber: z.number().int().positive(),
  teamName: z.string().trim().min(1).optional(),
  schoolName: z.string().trim().min(1).optional(),
  reason: z.string().trim().min(1),
  penaltyText: z.string().trim().min(1).optional(),
});

/** A createManualEvent command after validation. */
export type CreateManualEventCommand = z.infer<typeof CreateManualEventCommandSchema>;

/**
 * Changes the rule of one kind ("Regras"): any of its mode, item (null: none), duration
 * and max age (null: none). Operators only. A Super Chat rule set to auto, or a manual
 * rule set to ignore, is refused here, by the schema.
 */
export const UpdateEventRuleCommandSchema = z
  .object({
    type: z.literal('updateEventRule'),
    kind: InboxEventKindSchema,
    mode: EventRuleModeSchema.optional(),
    itemId: z.string().min(1).nullable().optional(),
    durationMs: z
      .number()
      .int()
      .min(eventRuleTimeLimitsMs.shortest)
      .max(eventRuleTimeLimitsMs.longest)
      .optional(),
    maxAgeMs: z
      .number()
      .int()
      .min(eventRuleTimeLimitsMs.shortest)
      .max(eventRuleTimeLimitsMs.longest)
      .nullable()
      .optional(),
  })
  .superRefine((command, context) => checkModeAllowedForKind(command, context));

/** An updateEventRule command after validation. */
export type UpdateEventRuleCommand = z.infer<typeof UpdateEventRuleCommandSchema>;

/**
 * Records events the detection found in a source's new snapshot. Only the server's event
 * detection (`sistema:eventos`) sends it; an id already in the inbox is skipped.
 */
export const RecordDetectedEventsCommandSchema = z.object({
  type: z.literal('recordDetectedEvents'),
  events: z.array(DetectedEventSchema).min(1),
});

/** A recordDetectedEvents command after validation. */
export type RecordDetectedEventsCommand = z.infer<typeof RecordDetectedEventsCommandSchema>;
