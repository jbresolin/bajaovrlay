/**
 * The firings the console's "Eventos" tab draws, read from the `triggerActivity` slice
 * (oldest first, as the server keeps them). Pure, so each rule is tested without a page.
 */
import type { TriggerFiring } from '@bajaovrlay/shared';

import { undoDismissWindowMs } from '@/features/events/inboxEventLists';

/** The firings that wait for the operator, newest first: what "Rodar" or "Descartar" decide. */
export function listWaitingTriggerFiringsNewestFirst(firings: TriggerFiring[]): TriggerFiring[] {
  return firings.filter((firing) => firing.status === 'pending').reverse();
}

/** The ids of the waiting firings: the badge counts them and the chime follows them. */
export function listWaitingTriggerFiringIds(firings: TriggerFiring[]): string[] {
  return firings.filter((firing) => firing.status === 'pending').map((firing) => firing.firingId);
}

/**
 * The firings dismissed within the same 30 s as an event's "Desfazer" (undoDismissWindowMs),
 * the latest dismissal first. `nowMs` must be the server-aligned now: the server stamped
 * the dismissal.
 */
export function listTriggerFiringsDismissedJustNow(
  firings: TriggerFiring[],
  nowMs: number,
): TriggerFiring[] {
  const dismissedJustNow = firings.filter(
    (firing) =>
      firing.status === 'dismissed' && nowMs - firing.statusChangedAtMs <= undoDismissWindowMs,
  );
  return dismissedJustNow.sort(
    (first, second) => second.statusChangedAtMs - first.statusChangedAtMs,
  );
}
