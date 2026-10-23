import { z } from 'zod';

import { SessionKindSchema } from '../dataShapes/dataShapeKey.js';
import {
  buildMomentSchema,
  buildOptionalTextSchema,
  buildRecordIdSchema,
  buildRequiredTextSchema,
} from './entityFieldSchemas.js';
import { reportKeysListedTwice } from './entityKeysListedOnce.js';
import { ptBREntities } from './ptBREntities.js';

const labels = ptBREntities.scheduleSlotFieldLabels;
const problems = ptBREntities.recordProblems;

/**
 * One slot of the day's schedule: what session, which kind (the session shape's own
 * list, so a slot and a source say the same word), when it starts and, when known, when
 * it ends, in ms since 1970, and where. Its status (concluída, em andamento, a seguir) is
 * never stored: findStatusOfScheduleSlot works it out from a moment, so it cannot go stale.
 */
export const ScheduleSlotSchema = z
  .object({
    slotId: buildRecordIdSchema(labels.slotId),
    sessionName: buildRequiredTextSchema(labels.sessionName, 80),
    // The shape's own list, with the reason in pt-BR for the CSV preview.
    sessionKind: z.enum(SessionKindSchema.options, { error: problems.unknownSessionKind }),
    startsAtMs: buildMomentSchema(labels.startsAtMs),
    endsAtMs: buildMomentSchema(labels.endsAtMs).optional(),
    /** Where it happens, as free text: "Pista principal", "Box 3". */
    place: buildOptionalTextSchema(labels.place, 80),
  })
  .superRefine((slot, context) => {
    if (slot.endsAtMs !== undefined && slot.endsAtMs <= slot.startsAtMs) {
      context.addIssue({ code: 'custom', path: ['endsAtMs'], message: problems.endBeforeStart });
    }
  });

/** A schedule slot that has passed ScheduleSlotSchema. */
export type ScheduleSlot = z.infer<typeof ScheduleSlotSchema>;

/** A list of schedule slots in which each id appears once (a slice, or an import). */
export function buildListOfScheduleSlotsSchema() {
  return z.array(ScheduleSlotSchema).superRefine((slots, context) => {
    reportKeysListedTwice(
      slots.map((slot) => slot.slotId),
      'slotId',
      ptBREntities.sliceProblems.idListedTwice,
      context,
    );
  });
}

/** The `scheduleSlots` slice: every slot of the schedule, each id once. Saved. */
export const ScheduleSlotsSchema = buildListOfScheduleSlotsSchema();

/** The `scheduleSlots` slice, after validation. */
export type ScheduleSlots = z.infer<typeof ScheduleSlotsSchema>;
