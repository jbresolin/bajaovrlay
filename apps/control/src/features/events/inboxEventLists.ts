/**
 * The lists the "Eventos" tab draws, read from the `events` slice (oldest first, as the
 * server keeps it). Pure, so each rule is tested without a page.
 */
import type { InboxEvent } from '@bajaovrlay/shared';

/** How many events that are over the tab lists under the waiting ones. */
export const finishedEventsListed = 20;

/** True while an event waits: for the operator (pending) or for the runner (queued). */
function isWaiting(event: InboxEvent): boolean {
  return event.status === 'pending' || event.status === 'queued';
}

/** True once an event is over: shown, dismissed or expired. */
function isFinished(event: InboxEvent): boolean {
  return event.status === 'shown' || event.status === 'dismissed' || event.status === 'expired';
}

/** The waiting events, newest first: what the operator decides about. */
export function listWaitingEventsNewestFirst(events: InboxEvent[]): InboxEvent[] {
  return events.filter(isWaiting).reverse();
}

/** The events that are over, newest first, at most `finishedEventsListed` of them. */
export function listFinishedEventsNewestFirst(events: InboxEvent[]): InboxEvent[] {
  return events.filter(isFinished).reverse().slice(0, finishedEventsListed);
}

/** The ids of the events waiting for the operator: what the chime follows. */
export function listPendingEventIds(events: InboxEvent[]): string[] {
  return events.filter((event) => event.status === 'pending').map((event) => event.eventId);
}

/** How many events wait for the operator: the badge's number (queued ones need nobody). */
export function countPendingEvents(events: InboxEvent[]): number {
  return events.filter((event) => event.status === 'pending').length;
}
