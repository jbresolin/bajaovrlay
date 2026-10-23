import { z } from 'zod';

import { buildCarNumberSchema, buildRecordIdSchema } from './entityFieldSchemas.js';
import { ptBREntities } from './ptBREntities.js';

/**
 * Removes one record from the entity library by its key: a team by its car number, a
 * person, sponsor or schedule slot by its id. Operators only. Deleting a record that
 * items reference is allowed (BAJAOVRLAY-19): those items then refuse to be taken, with a
 * pt-BR sentence naming the record, and what is on air keeps its last value (rule 4).
 * Deleting a record that is not there changes nothing and is answered ok, as clearing an
 * override that is not there is: the record is gone either way.
 */
export const DeleteEntityCommandSchema = z.discriminatedUnion('entityType', [
  z.object({
    type: z.literal('deleteEntity'),
    entityType: z.literal('team'),
    carNumber: buildCarNumberSchema(ptBREntities.teamFieldLabels.carNumber),
  }),
  z.object({
    type: z.literal('deleteEntity'),
    entityType: z.literal('person'),
    personId: buildRecordIdSchema(ptBREntities.personFieldLabels.personId),
  }),
  z.object({
    type: z.literal('deleteEntity'),
    entityType: z.literal('sponsor'),
    sponsorId: buildRecordIdSchema(ptBREntities.sponsorFieldLabels.sponsorId),
  }),
  z.object({
    type: z.literal('deleteEntity'),
    entityType: z.literal('scheduleSlot'),
    slotId: buildRecordIdSchema(ptBREntities.scheduleSlotFieldLabels.slotId),
  }),
]);

/** A deleteEntity command after validation. */
export type DeleteEntityCommand = z.infer<typeof DeleteEntityCommandSchema>;
