/**
 * The lists the console's "Eventos" tab and the "Eventos" page draw, read from the
 * `events` slice (oldest first, as the server keeps it). Pure, so each rule is tested
 * without a page.
 */
import type { InboxEvent } from '@bajaovrlay/shared';

/**
 * True while an event waits: for the operator (pending), for the runner (queued), or, a
 * Super Chat a person approved, for the Produtor's "No ar" (approved, BAJAOVRLAY-35).
 */
function isWaiting(event: InboxEvent): boolean {
  return event.status === 'pending' || event.status === 'queued' || event.status === 'approved';
}

/**
 * True for a viewer's Super Chat no person has approved yet: it must never reach the air.
 * The server's rule (inboxEventChanges.ts): any status but approved counts as not approved,
 * so the page never offers "No ar" on a Super Chat the server would refuse.
 */
export function isSuperChatAwaitingApproval(event: InboxEvent): boolean {
  return event.kind === 'superChat' && event.status !== 'approved';
}

/**
 * The waiting events, newest first: what the operator decides about. The Super Chats still
 * awaiting approval are left out: they are listed apart, with "Aprovar"
 * (listSuperChatsAwaitingApprovalNewestFirst), and only an approved one joins this list.
 */
export function listWaitingEventsNewestFirst(events: InboxEvent[]): InboxEvent[] {
  return events
    .filter((event) => isWaiting(event) && !isSuperChatAwaitingApproval(event))
    .reverse();
}

/**
 * The Super Chats still waiting and awaiting approval, newest first: what Dados reads and
 * approves. A discarded or expired one waits for nobody, so it is left out.
 */
export function listSuperChatsAwaitingApprovalNewestFirst(events: InboxEvent[]): InboxEvent[] {
  return events.filter((event) => isWaiting(event) && isSuperChatAwaitingApproval(event)).reverse();
}

/** The ids of the events waiting for the operator: what the chime follows. */
export function listPendingEventIds(events: InboxEvent[]): string[] {
  return events.filter((event) => event.status === 'pending').map((event) => event.eventId);
}

/**
 * How many events wait for a person: the badge's number. Pending ones, and approved Super
 * Chats, which wait for the Produtor's "No ar"; queued ones need nobody.
 */
export function countPendingEvents(events: InboxEvent[]): number {
  return events.filter((event) => event.status === 'pending' || event.status === 'approved').length;
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
