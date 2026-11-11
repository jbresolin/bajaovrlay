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

/**
 * True while an event waits for a decision: the operator's (pending, or a Super Chat
 * approved and waiting for "No ar") or the runner's (queued).
 */
export function isEventWaiting(event: InboxEvent): boolean {
  return event.status === 'pending' || event.status === 'approved' || event.status === 'queued';
}

/**
 * True for a Super Chat no person has approved (BAJAOVRLAY-35): it may wait, be previewed
 * and be discarded, but never go on air, by "No ar" or by "Tomar" on its Prévia. Every
 * other kind needs no approval. Any status but approved counts as not approved (gate 2 of
 * PR #54), so a queued Super Chat could never pass if the rule schema ever let one be auto.
 */
export function isSuperChatAwaitingApproval(event: InboxEvent): boolean {
  return event.kind === 'superChat' && event.status !== 'approved';
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
 * The slice with one event replaced by its changed copy, moved to the end where the newest
 * events are. For an event that waits again (a restore): left in its old place, it would be
 * the next to fall out of a full slice while the operator still has to act on it.
 */
export function replaceInboxEventAtTheEnd(
  events: InboxEvent[],
  changedEvent: InboxEvent,
): InboxEvent[] {
  const otherEvents = events.filter((event) => event.eventId !== changedEvent.eventId);
  return [...otherEvents, changedEvent];
}

/**
 * The slice with new events at its end, keeping only the newest `inboxEventsSliceSize`.
 * The event log table keeps every event; the slice is what the page lists and what the
 * inbox checks a new id against.
 */
export function appendInboxEvents(events: InboxEvent[], newEvents: InboxEvent[]): InboxEvent[] {
  return [...events, ...newEvents].slice(-inboxEventsSliceSize);
}

/**
 * The status a new event starts with: queued for the runner when its rule says auto and
 * names an item to show it with, pending for the operator otherwise. An auto rule with no
 * item asks instead: no runner could show its events, and the operator still sees them
 * (gate 2 of PR #22).
 */
export function findStatusOfNewEvent(rule: EventRule | undefined): InboxEventStatus {
  const canTheRunnerShowIt = rule?.mode === 'auto' && rule.itemId !== null;
  return canTheRunnerShowIt ? 'queued' : 'pending';
}

/**
 * The moment an event's wait is measured from: its latest restore, or its detection when it
 * was never restored (BAJAOVRLAY-67). A fastest lap brought back with "Mostrar de novo" ten
 * minutes after it was shown would otherwise expire the moment "No ar" is pressed.
 */
export function readMomentTheWaitCountsFrom(event: InboxEvent): number {
  return event.restoresAtMs?.at(-1) ?? event.detectedAtMs;
}

/** A moment of the store (ISO 8601 text) in ms since 1970. */
export function readMomentMs(isoMoment: string): number {
  return Date.parse(isoMoment);
}
