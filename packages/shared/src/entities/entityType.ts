import { z } from 'zod';

/**
 * The four kinds of record in the entity library, each a slice of its own: `team`
 * (teams), `person` (people), `sponsor` (sponsors) and `scheduleSlot` (scheduleSlots).
 */
export const EntityTypeSchema = z.enum(['team', 'person', 'sponsor', 'scheduleSlot']);

/** One of EntityTypeSchema's values. */
export type EntityType = z.infer<typeof EntityTypeSchema>;
