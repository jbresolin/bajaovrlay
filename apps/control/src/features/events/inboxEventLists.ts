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

/** The ids of the events waiting for the operator: what the chime follows. */
export function listPendingEventIds(events: InboxEvent[]): string[] {
  return events.filter((event) => event.status === 'pending').map((event) => event.eventId);
}

/** How many events wait for the operator: the badge's number (queued ones need nobody). */
export function countPendingEvents(events: InboxEvent[]): number {
  return events.filter((event) => event.status === 'pending').length;
}

/** How long after "Descartar" the console still offers "Desfazer" (humans err). */
export const undoDismissWindowMs = 30_000;

/** The moment an event was dismissed: its last status change, or undefined if it was not. */
function readDismissedAtMs(event: InboxEvent): number | undefined {
  if (event.status !== 'dismissed') {
    return undefined;
  }
  return event.statusChanges.at(-1)?.atMs;
}

/**
 * The events dismissed within `undoDismissWindowMs` of `nowMs`, the latest dismissal
 * first: what the console offers to undo. An older dismissal is undone from the page's
 * history. `nowMs` must be the server-aligned now, since the server stamped the moments.
 */
export function listEventsDismissedJustNow(events: InboxEvent[], nowMs: number): InboxEvent[] {
  const recentlyDismissed = events.filter((event) => {
    const dismissedAtMs = readDismissedAtMs(event);
    return dismissedAtMs !== undefined && nowMs - dismissedAtMs <= undoDismissWindowMs;
  });
  return recentlyDismissed.sort(
    (first, second) => (readDismissedAtMs(second) ?? 0) - (readDismissedAtMs(first) ?? 0),
  );
}
