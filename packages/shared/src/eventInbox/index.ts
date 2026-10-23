// Everything about the event inbox that @bajaovrlay/shared exports. The package's own
// index.ts re-exports this file with one line; other packages import from
// '@bajaovrlay/shared', never from here.

// One event as detected or typed: its kinds, what a notice calls it, and its payload.
export {
  type DetectedEvent,
  DetectedEventSchema,
  type EventNoticeKind,
  EventNoticeKindSchema,
  type InboxEventKind,
  InboxEventKindSchema,
  type InboxEventPayload,
  InboxEventPayloadSchema,
} from './inboxEvent.js';
// The events slice: an event with its status and the history of its statuses.
export {
  type InboxEvent,
  InboxEventSchema,
  InboxEventsSchema,
  inboxEventsSliceSize,
  type InboxEventStatus,
  type InboxEventStatusChange,
  InboxEventStatusChangeSchema,
  InboxEventStatusSchema,
} from './inboxEventsSlice.js';
// The eventRules slice: one rule per kind (ask, auto or ignore, item, duration, max age).
export {
  type EventRule,
  type EventRuleMode,
  EventRuleModeSchema,
  EventRuleSchema,
  EventRulesSchema,
  eventRuleTimeLimitsMs,
} from './eventRule.js';
// The five inbox commands: show, dismiss, type by hand, change a rule, record detected.
export {
  type CreateManualEventCommand,
  CreateManualEventCommandSchema,
  type DismissEventCommand,
  DismissEventCommandSchema,
  type RecordDetectedEventsCommand,
  RecordDetectedEventsCommandSchema,
  type ShowEventCommand,
  ShowEventCommandSchema,
  type UpdateEventRuleCommand,
  UpdateEventRuleCommandSchema,
} from './eventCommands.js';
// The pt-BR reasons of the schemas above.
export { ptBREventInbox } from './ptBREventInbox.js';
