import { z } from 'zod';

import { ptBREventInbox } from './ptBREventInbox.js';

/**
 * What an inbox event is about. Each kind has one rule (eventRules), which says whether
 * its events wait for the operator, go on air by themselves, or are ignored.
 * - `newIncident`: a source listed an incident it had not listed before (a penalty).
 * - `fastestLap`: the session's best lap improved.
 * - `leaderChanged`: another car is in 1st place.
 * - `manual`: the operator typed it ("+ Evento").
 * - `superChat`: a viewer's paid message (BAJAOVRLAY-35); never shown without approval.
 */
export const InboxEventKindSchema = z.enum([
  'newIncident',
  'fastestLap',
  'leaderChanged',
  'manual',
  'superChat',
]);

/** One kind of inbox event. */
export type InboxEventKind = z.infer<typeof InboxEventKindSchema>;

/**
 * What a notice says the event is, for its head ("PENALIDADE", "ADVERTÊNCIA",
 * "INCIDENTE", "AVISO"): an incident's own kind, or `notice` for a manual event that is
 * not a penalty.
 */
export const EventNoticeKindSchema = z.enum(['penalty', 'warning', 'incident', 'notice']);

/** One kind of notice. */
export type EventNoticeKind = z.infer<typeof EventNoticeKindSchema>;

/**
 * What a graphic needs to show the event: the car, and the fields of the kind that has
 * them. An item's event fields (kind `eventField`) read these by name, so the names are
 * the paths the item editor offers. Strict: a key no graphic can read is refused.
 * The car is optional here because a Super Chat has none, and neither has a general notice
 * typed in "+ Evento" (BAJAOVRLAY-67); every other event must carry one, checked with the
 * kind by checkCarNumberForKind below.
 */
export const InboxEventPayloadSchema = z.strictObject({
  carNumber: z.number().int().positive().optional(),
  teamName: z.string().min(1).optional(),
  /** The university, short form ("UFPR"). */
  schoolName: z.string().min(1).optional(),
  noticeKind: EventNoticeKindSchema.optional(),
  /** Why, in pt-BR: "Queima de largada". */
  reason: z.string().min(1).optional(),
  /** The penalty, when there is one: "+30 segundos". */
  penaltyText: z.string().min(1).optional(),
  /** The lap it happened on, or on which the fastest lap was set. */
  lapNumber: z.number().int().min(1).optional(),
  /** The fastest lap's time in ms, and the same as the timing screen writes it. */
  lapTimeMs: z.number().int().positive().optional(),
  lapTimeText: z.string().min(1).optional(),
  /** A Super Chat's viewer, as YouTube names them (BAJAOVRLAY-35). */
  authorName: z.string().min(1).optional(),
  /** A Super Chat's amount as YouTube writes it: "R$ 50,00". */
  amountText: z.string().min(1).optional(),
  /** What the viewer wrote; empty when they paid without a message. */
  messageText: z.string().optional(),
});

/** A payload that has passed InboxEventPayloadSchema. */
export type InboxEventPayload = z.infer<typeof InboxEventPayloadSchema>;

/**
 * The one place that says which events need a car: every one but a `superChat`, a viewer's
 * message about no car in particular, and a typed notice (`manual` with noticeKind
 * `notice`), which may be about the event itself, "Largada adiada em 15 minutos"
 * (BAJAOVRLAY-67). A typed penalty still needs one: a penalty is always given to a car.
 * Reported at `payload.carNumber`. Used by DetectedEventSchema and the slice's
 * InboxEventSchema alike.
 */
export function checkCarNumberForKind(
  event: { kind: InboxEventKind; payload: InboxEventPayload },
  context: z.RefinementCtx,
): void {
  const isAGeneralNoticeAllowed = event.kind === 'manual' && event.payload.noticeKind === 'notice';
  const doesTheEventNeedACar = event.kind !== 'superChat' && !isAGeneralNoticeAllowed;
  if (doesTheEventNeedACar && event.payload.carNumber === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['payload', 'carNumber'],
      message: ptBREventInbox.payloadReasons.carNumberMissing,
    });
  }
}

/**
 * The fields of a detected event, before the car rule is added: InboxEventSchema extends
 * these, and Zod cannot extend a schema that already carries a refinement.
 */
export const DetectedEventFieldsSchema = z.object({
  eventId: z.string().min(1),
  kind: InboxEventKindSchema,
  sourceId: z.string().min(1).nullable(),
  /** When it was detected (or typed), in ms since 1970 on the server's clock. */
  detectedAtMs: z.number().int().min(0),
  payload: InboxEventPayloadSchema,
});

/**
 * One event as detected (or typed), before the inbox gives it a status.
 * `eventId` is deterministic (`<sourceId>:incident:<incidentId>`…), so the same happening
 * detected twice, before and after a restart, is one event; `sourceId` is null for a
 * manual event, which no source produced.
 */
export const DetectedEventSchema = DetectedEventFieldsSchema.superRefine((event, context) =>
  checkCarNumberForKind(event, context),
);

/** One event that has passed DetectedEventSchema. */
export type DetectedEvent = z.infer<typeof DetectedEventSchema>;
