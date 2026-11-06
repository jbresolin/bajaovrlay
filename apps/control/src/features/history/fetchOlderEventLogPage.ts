import { type EventLogFilters, type EventLogPage, EventLogPageSchema } from '@bajaovrlay/shared';

/** The address of the history's older pages, on the page's own server (BAJAOVRLAY-30). */
export const eventLogPageAddress = '/api/v1/event-log';

/** What asking for an older page gives: the page, or that it could not be read. */
export type OlderEventLogPageOutcome =
  { isFetched: true; page: EventLogPage } | { isFetched: false };

/**
 * Asks the server for the rows below `beforeId` that pass the filters (GET
 * /api/v1/event-log), a page of 100. The browser marks this fetch as the page's own
 * (same origin), so it needs no token. Never throws: a server it cannot reach, or an
 * answer it cannot read, gives `isFetched: false`, and the page says so.
 */
export async function fetchOlderEventLogPage(
  beforeId: number | undefined,
  filters: EventLogFilters,
): Promise<OlderEventLogPageOutcome> {
  const query = new URLSearchParams();
  if (beforeId !== undefined) {
    query.set('before', String(beforeId));
  }
  if (filters.who !== undefined) {
    query.set('who', filters.who);
  }
  if (filters.group !== undefined) {
    query.set('group', filters.group);
  }
  if (filters.layerId !== undefined) {
    query.set('layerId', filters.layerId);
  }
  if (filters.onlyRefusals === true) {
    query.set('onlyRefusals', 'true');
  }
  const typedText = filters.text?.trim() ?? '';
  if (typedText !== '') {
    query.set('text', typedText);
  }
  try {
    const response = await fetch(`${eventLogPageAddress}?${query.toString()}`);
    if (!response.ok) {
      return { isFetched: false };
    }
    const page = EventLogPageSchema.parse(await response.json());
    return { isFetched: true, page };
  } catch {
    return { isFetched: false };
  }
}
