// The small steps every inbox reducer is made of: finding an event, changing its status
// with the moment of the change, and keeping the slice to its newest events.
import {
  type EventRule,
  type InboxEvent,
  type InboxEventKind,
  inboxEventsSliceSize,
  type InboxEventStatus,
} from '@bajaovrlay/shared';

/** The event of this id in the slice, or undefined. */
export function findInboxEvent(events: InboxEvent[], eventId: string): InboxEvent | undefined {
  return events.find((event) => event.eventId === eventId);
}

/** The rule of this kind, or undefined (only a database edited by hand could lack one). */
export function findRuleOfKind(rules: EventRule[], kind: InboxEventKind): EventRule | undefined {
  return rules.find((rule) => rule.kind === kind);
}

/** True while an event waits for a decision: the operator's (pending) or the runner's. */
export function isEventWaiting(event: InboxEvent): boolean {
  return event.status === 'pending' || event.status === 'queued';
}

/**
 * The event with a new status, the change added to its history at `atMs`. An event that
 * leaves the air forgets its instance; one going on air is given it by the caller.
 */
export function changeStatusOfEvent(
  event: InboxEvent,
  status: InboxEventStatus,
  atMs: number,
): InboxEvent {
  const changedEvent: InboxEvent = {
    ...event,
    status,
    statusChanges: [...event.statusChanges, { status, atMs }],
  };
  if (status !== 'onAir') {
    delete changedEvent.instanceId;
  }
  return changedEvent;
}

/** The slice with one event replaced by its changed copy, in its place. */
export function replaceInboxEvent(events: InboxEvent[], changedEvent: InboxEvent): InboxEvent[] {
  return events.map((event) => (event.eventId === changedEvent.eventId ? changedEvent : event));
}

/**
 * The slice with new events at its end, keeping only the newest `inboxEventsSliceSize`.
 * The event log table keeps every event; the slice is what the page lists and what the
 * inbox checks a new id against.
 */
export function appendInboxEvents(events: InboxEvent[], newEvents: InboxEvent[]): InboxEvent[] {
  return [...events, ...newEvents].slice(-inboxEventsSliceSize);
}

/** The status a new event starts with: queued for the runner, or pending for the operator. */
export function findStatusOfNewEvent(rule: EventRule | undefined): InboxEventStatus {
  return rule?.mode === 'auto' ? 'queued' : 'pending';
}

/** A moment of the store (ISO 8601 text) in ms since 1970. */
export function readMomentMs(isoMoment: string): number {
  return Date.parse(isoMoment);
}
