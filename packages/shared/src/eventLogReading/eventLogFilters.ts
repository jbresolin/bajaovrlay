import { z } from 'zod';

import type { DescribedEventLogEntry } from './describeEventLogEntry.js';
import { EventLogActorKindSchema } from './eventLogActors.js';
import { EventLogCommandGroupSchema } from './eventLogCommandGroups.js';

/**
 * The history page's filters (BAJAOVRLAY-30), each left out when not in use: who sent the
 * command, its group, a layer it touched, refusals only, and free text over the sentence.
 * The page applies them to the live rows; GET /api/v1/event-log takes the same ones as
 * query parameters for the older pages.
 */
export const EventLogFiltersSchema = z.object({
  who: EventLogActorKindSchema.optional(),
  group: EventLogCommandGroupSchema.optional(),
  layerId: z.string().min(1).optional(),
  onlyRefusals: z.boolean().optional(),
  text: z.string().optional(),
});

/** The filters after validation. */
export type EventLogFilters = z.infer<typeof EventLogFiltersSchema>;

/**
 * Lower case with the accents taken off, so "relogio" finds "Relógio" and "LIMPOU" finds
 * "Limpou": the operator types fast and without accents.
 */
function simplifyForSearch(text: string): string {
  const withAccentsApart = text.normalize('NFD');
  const withoutAccents = withAccentsApart.replace(/[̀-ͯ]/g, '');
  return withoutAccents.toLowerCase().trim();
}

/** Whether a described row passes every filter in use. */
export function doesEventLogEntryMatchFilters(
  described: DescribedEventLogEntry,
  filters: EventLogFilters,
): boolean {
  if (filters.who !== undefined && described.who.kind !== filters.who) {
    return false;
  }
  if (filters.group !== undefined && described.group !== filters.group) {
    return false;
  }
  if (filters.layerId !== undefined && !described.layerIds.includes(filters.layerId)) {
    return false;
  }
  if (filters.onlyRefusals === true && !described.isRefusal) {
    return false;
  }
  const searchedText = simplifyForSearch(filters.text ?? '');
  if (searchedText === '') {
    return true;
  }
  return simplifyForSearch(described.sentence).includes(searchedText);
}

/** Whether any filter is in use (an empty or blank text counts as none). */
export function hasAnyEventLogFilter(filters: EventLogFilters): boolean {
  const hasText = (filters.text ?? '').trim() !== '';
  return (
    filters.who !== undefined ||
    filters.group !== undefined ||
    filters.layerId !== undefined ||
    filters.onlyRefusals === true ||
    hasText
  );
}
