import { z } from 'zod';

import { buildCarNumberSchema, buildRecordIdSchema } from './entityFieldSchemas.js';
import { ptBREntities } from './ptBREntities.js';

/** The attribute a reference reads: a key of entityAttributes.ts ("teamName", "logoUrl"). */
const AttributeKeySchema = z.string().min(1);

/**
 * A field value read from the entity library instead of typed (concept §4, the entity
 * reference): which kind of record, the record by its fixed key (a team by its car
 * number, the key the positions use; a person, sponsor or schedule slot by its id), and
 * one attribute of it. Always live: an edit of the record reaches the air through the
 * same refresh as a source's new data, so there is no isLive to choose.
 * Strict, as the binding is: a misspelt key is refused, not dropped. Whether the
 * attribute exists and fits the field is findProblemInEntityReferenceForDataSchemaField's
 * job, and whether the record exists the server's, each refusal a pt-BR sentence naming
 * the field.
 */
export const EntityFieldValueSchema = z.discriminatedUnion('entityType', [
  z.strictObject({
    kind: z.literal('entity'),
    entityType: z.literal('team'),
    carNumber: buildCarNumberSchema(ptBREntities.teamFieldLabels.carNumber),
    attribute: AttributeKeySchema,
  }),
  z.strictObject({
    kind: z.literal('entity'),
    entityType: z.literal('person'),
    personId: buildRecordIdSchema(ptBREntities.personFieldLabels.personId),
    attribute: AttributeKeySchema,
  }),
  z.strictObject({
    kind: z.literal('entity'),
    entityType: z.literal('sponsor'),
    sponsorId: buildRecordIdSchema(ptBREntities.sponsorFieldLabels.sponsorId),
    attribute: AttributeKeySchema,
  }),
  z.strictObject({
    kind: z.literal('entity'),
    entityType: z.literal('scheduleSlot'),
    slotId: buildRecordIdSchema(ptBREntities.scheduleSlotFieldLabels.slotId),
    attribute: AttributeKeySchema,
  }),
]);

/** An entity reference that has passed EntityFieldValueSchema. */
export type EntityFieldValue = z.infer<typeof EntityFieldValueSchema>;
