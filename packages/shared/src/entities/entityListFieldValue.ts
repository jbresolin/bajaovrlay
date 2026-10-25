import { z } from 'zod';

/**
 * The two kinds of record a graphic reads as a whole list (BAJAOVRLAY-46): every sponsor
 * (the sponsor roll, the intermission's sponsor line) and every slot of the schedule (the
 * sessions board). Teams are left out on purpose: the teams on air come from a source
 * (the tower, the standings), keyed by car number.
 */
export const EntityListTypeSchema = z.enum(['sponsor', 'scheduleSlot']);

/** One of EntityListTypeSchema's values. */
export type EntityListType = z.infer<typeof EntityListTypeSchema>;

/**
 * A field value read from the entity library as a whole list (concept §4, the entity
 * list): every record of one kind, in a fixed order, each as the hand-written item
 * entityListItems.ts describes. Always live, as an entity reference is: an edit, add or
 * delete of any record of that kind reaches the air through refreshBoundInstanceData.
 * Strict: a record key or an attribute beside it is refused, not dropped; one record's
 * one attribute is the entity reference's job.
 */
export const EntityListFieldValueSchema = z.strictObject({
  kind: z.literal('entityList'),
  entityType: EntityListTypeSchema,
});

/** An entity list that has passed EntityListFieldValueSchema. */
export type EntityListFieldValue = z.infer<typeof EntityListFieldValueSchema>;
