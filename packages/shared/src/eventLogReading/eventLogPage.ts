import { z } from 'zod';

import { EventLogEntrySchema } from '../slices/eventLogEntry.js';
import { EventLogActorKindSchema } from './eventLogActors.js';
import { EventLogCommandGroupSchema } from './eventLogCommandGroups.js';

/**
 * How many of the newest event-log rows the `eventLog` slice carries live. The history
 * page asks GET /api/v1/event-log for anything older, so it offers "Carregar mais" only
 * once the slice is full: with fewer rows the slice is the whole log.
 */
export const eventLogRowsSentLive = 200;

/** How many rows one page of GET /api/v1/event-log holds when no limit is asked for. */
export const eventLogPageDefaultLimit = 100;

/** The most rows one page of GET /api/v1/event-log may hold. */
export const eventLogPageLargestLimit = 500;

/**
 * The query of GET /api/v1/event-log (BAJAOVRLAY-30), as the address carries it: text,
 * turned into numbers and a switch here. `before` is a row id: the page holds the rows
 * below it (none: from the newest). The filters are EventLogFilters', one parameter each.
 */
export const EventLogPageQuerySchema = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(eventLogPageLargestLimit)
    .default(eventLogPageDefaultLimit),
  who: EventLogActorKindSchema.optional(),
  group: EventLogCommandGroupSchema.optional(),
  layerId: z.string().min(1).optional(),
  onlyRefusals: z
    .enum(['true', 'false'])
    .transform((switchText) => switchText === 'true')
    .optional(),
  text: z.string().optional(),
});

/** The query after validation: numbers are numbers, `limit` is filled. */
export type EventLogPageQuery = z.infer<typeof EventLogPageQuerySchema>;

/**
 * What GET /api/v1/event-log answers: the rows of the page, newest first, as the eventLog
 * slice holds them, and whether there are older rows (that pass the filters) below them.
 */
export const EventLogPageSchema = z.object({
  entries: z.array(EventLogEntrySchema),
  hasOlder: z.boolean(),
});

/** One page of the event log after validation. */
export type EventLogPage = z.infer<typeof EventLogPageSchema>;
