/**
 * The lists the console's "Eventos" tab and the "Eventos" page draw, read from the
 * `events` slice (oldest first, as the server keeps it). Pure, so each rule is tested
 * without a page.
 */
import type { InboxEvent } from '@bajaovrlay/shared';

/** True while an event waits: for the operator (pending) or for the runner (queued). */
function isWaiting(event: InboxEvent): boolean {
  return event.status === 'pending' || event.status === 'queued';
}

/** The waiting events, newest first: what the operator decides about. */
export function listWaitingEventsNewestFirst(events: InboxEvent[]): InboxEvent[] {
  return events.filter(isWaiting).reverse();
}

/** Every event the server keeps (its newest 200), newest first: the page's history. */
export function listAllEventsNewestFirst(events: InboxEvent[]): InboxEvent[] {
  return [...events].reverse();
}

/** The ids of the events waiting for the operator: what the chime follows. */
export function listPendingEventIds(events: InboxEvent[]): string[] {
  return events.filter((event) => event.status === 'pending').map((event) => event.eventId);
}

/** How many events wait for the operator: the badge's number (queued ones need nobody). */
export function countPendingEvents(events: InboxEvent[]): number {
  return events.filter((event) => event.status === 'pending').length;
}
