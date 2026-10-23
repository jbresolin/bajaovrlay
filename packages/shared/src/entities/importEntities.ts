import { z } from 'zod';

import { buildListOfPeopleSchema } from './person.js';
import { buildListOfScheduleSlotsSchema } from './scheduleSlot.js';
import { buildListOfSponsorsSchema } from './sponsor.js';
import { buildListOfTeamsSchema } from './team.js';

/** The most records one import may carry: far above a Baja field (about 100 cars). */
export const mostRecordsInOneImport = 1000;

/**
 * Upserts many records of one type at once: the valid rows of a CSV ("Importar") or the
 * simulator's fictional teams ("Importar equipes do simulador"). Operators only. One
 * batch, not one command per row (the plainer of the brief's two choices): a hundred
 * teams are one state change, one event-log row and one broadcast, and an import is never
 * left half applied. Each record replaces the one of the same key or is added; records
 * of the type that the import does not name are kept. Each key appears once in the list.
 */
export const ImportEntitiesCommandSchema = z.discriminatedUnion('entityType', [
  z.object({
    type: z.literal('importEntities'),
    entityType: z.literal('team'),
    records: buildListOfTeamsSchema().min(1).max(mostRecordsInOneImport),
  }),
  z.object({
    type: z.literal('importEntities'),
    entityType: z.literal('person'),
    records: buildListOfPeopleSchema().min(1).max(mostRecordsInOneImport),
  }),
  z.object({
    type: z.literal('importEntities'),
    entityType: z.literal('sponsor'),
    records: buildListOfSponsorsSchema().min(1).max(mostRecordsInOneImport),
  }),
  z.object({
    type: z.literal('importEntities'),
    entityType: z.literal('scheduleSlot'),
    records: buildListOfScheduleSlotsSchema().min(1).max(mostRecordsInOneImport),
  }),
]);

/** An importEntities command after validation. */
export type ImportEntitiesCommand = z.infer<typeof ImportEntitiesCommandSchema>;
