import { z } from 'zod';

import { checkCarNumberForKind, DetectedEventFieldsSchema } from './inboxEvent.js';

/**
 * Where an event stands in the inbox:
 * - `pending`: waiting for the operator (its rule says "ask"); a Super Chat waits here
 *   for Dados (or the Produtor) to approve it;
 * - `approved`: a Super Chat a person approved (BAJAOVRLAY-35), waiting for the
 *   Produtor's "No ar"; no other kind is ever approved;
 * - `queued`: waiting for the automatic runner (its rule says "auto"), until its layer is
 *   free;
 * - `onAir`: an instance carrying its id is on the program output;
 * - `shown`: that instance has left the air;
 * - `dismissed`: the operator said no ("Descartar");
 * - `expired`: not shown within its rule's maxAgeMs; never shown late.
 * A dismissed, shown or expired event may be brought back by restoreEvent ("Desfazer",
 * "Restaurar", "Mostrar de novo"), to pending, or to approved for a Super Chat a person
 * had approved and that was not dismissed (BAJAOVRLAY-67).
 */
export const InboxEventStatusSchema = z.enum([
  'pending',
  'approved',
  'queued',
  'onAir',
  'shown',
  'dismissed',
  'expired',
]);

/** One status of an inbox event. */
export type InboxEventStatus = z.infer<typeof InboxEventStatusSchema>;

/** One change of an event's status, and when it happened (ms since 1970, server clock). */
export const InboxEventStatusChangeSchema = z.object({
  status: InboxEventStatusSchema,
  atMs: z.number().int().min(0),
});

/** One status change after validation. */
export type InboxEventStatusChange = z.infer<typeof InboxEventStatusChangeSchema>;

/**
 * One event of the inbox: the detected (or typed) event, its status now, every change of
 * status with its moment (the first one is its arrival), the instance showing it while
 * it is on air, and the moment of each restore ("Desfazer", "Restaurar", "Mostrar de novo";
 * BAJAOVRLAY-67), oldest first: the rule's maximum wait counts from the latest one.
 * `restoresAtMs` is left out until the first restore, as in every event saved before.
 */
export const InboxEventSchema = DetectedEventFieldsSchema.extend({
  status: InboxEventStatusSchema,
  statusChanges: z.array(InboxEventStatusChangeSchema).min(1),
  instanceId: z.string().min(1).optional(),
  restoresAtMs: z.array(z.number().int().min(0)).optional(),
}).superRefine((event, context) => checkCarNumberForKind(event, context));

/** One inbox event after validation. */
export type InboxEvent = z.infer<typeof InboxEventSchema>;

/**
 * The `events` slice: the newest inbox events, oldest first. Saved, so a restart keeps
 * the inbox and the ids already seen. Every event's whole history is in the event log
 * table too; screens never receive this slice.
 */
export const InboxEventsSchema = z.array(InboxEventSchema);

/** How many events the slice keeps; the event log table keeps them all. */
export const inboxEventsSliceSize = 200;
