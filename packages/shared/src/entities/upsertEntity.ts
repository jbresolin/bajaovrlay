import { z } from 'zod';

import { PersonSchema } from './person.js';
import { ScheduleSlotSchema } from './scheduleSlot.js';
import { SponsorSchema } from './sponsor.js';
import { TeamSchema } from './team.js';

/**
 * Adds a record to the entity library, or replaces the one with the same key in its
 * place ("Salvar" on a Cadastros tab). Operators only. `entityType` says which slice and
 * which schema the record is checked by, so a person's record sent as a team is refused
 * at the missing car number rather than stored somewhere it does not belong. The server
 * also refuses a record naming an image the media store does not hold (MEDIA_NOT_FOUND).
 * Every on-air field that references the record is refreshed at once.
 */
export const UpsertEntityCommandSchema = z.discriminatedUnion('entityType', [
  z.object({
    type: z.literal('upsertEntity'),
    entityType: z.literal('team'),
    record: TeamSchema,
  }),
  z.object({
    type: z.literal('upsertEntity'),
    entityType: z.literal('person'),
    record: PersonSchema,
  }),
  z.object({
    type: z.literal('upsertEntity'),
    entityType: z.literal('sponsor'),
    record: SponsorSchema,
  }),
  z.object({
    type: z.literal('upsertEntity'),
    entityType: z.literal('scheduleSlot'),
    record: ScheduleSlotSchema,
  }),
]);

/** An upsertEntity command after validation. */
export type UpsertEntityCommand = z.infer<typeof UpsertEntityCommandSchema>;
