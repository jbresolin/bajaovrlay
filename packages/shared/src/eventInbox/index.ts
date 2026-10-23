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
