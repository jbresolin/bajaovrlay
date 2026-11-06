import { z } from 'zod';

// Two commands are not stored whole in the event log (apps/server, commandEventLogPayload.ts):
// a data-source poll keeps its source and how it went, never the race data, and an entity
// import keeps its kind and count, never the records. Their rows therefore never pass
// CommandSchema, so the history reads them with these two schemas of what is kept.

/** What a logged poll row keeps: the source and ok, or the error; or, invalid, no result. */
export const PollAsTheLogKeepsItSchema = z.union([
  z.object({
    type: z.literal('recordDataSourcePoll'),
    sourceId: z.string().min(1),
    result: z.discriminatedUnion('ok', [
      z.object({ ok: z.literal(true) }),
      z.object({ ok: z.literal(false), error: z.string() }),
    ]),
  }),
  z.object({
    type: z.literal('recordDataSourcePoll'),
    sourceId: z.string().min(1).nullable(),
    isResultLeftOut: z.literal(true),
  }),
]);

/** A poll as its event-log row keeps it. */
export type PollAsTheLogKeepsIt = z.infer<typeof PollAsTheLogKeepsItSchema>;

/**
 * What a logged import row keeps: the entity type (as it was sent, so maybe a wrong one on
 * a refused import) and how many records it carried.
 */
export const ImportAsTheLogKeepsItSchema = z.object({
  type: z.literal('importEntities'),
  entityType: z.unknown(),
  recordCount: z.number().int().min(0),
});

/** An import as its event-log row keeps it. */
export type ImportAsTheLogKeepsIt = z.infer<typeof ImportAsTheLogKeepsItSchema>;
