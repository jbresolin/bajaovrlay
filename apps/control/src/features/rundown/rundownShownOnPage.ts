import type { Rundown } from '@bajaovrlay/shared';

/**
 * Says which rundown the control page shows: the first one the server lists, undefined
 * while it lists none. The rundown column draws it, and a take sent from this page
 * (features/autoPreview/useTakeThenPreviewNextItem.ts) watches its cursor.
 * Deliberate: the server seeds exactly one ("Sessão principal") and has no command that
 * makes another, so there is nothing to choose between yet; its id is read from the
 * server's list, never written into the page.
 */
export function findRundownShownOnPage(rundowns: Rundown[]): Rundown | undefined {
  return rundowns[0];
}
