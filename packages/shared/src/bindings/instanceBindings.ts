import { z } from 'zod';

import { EntityFieldValueSchema } from '../entities/entityFieldValue.js';
import { BindingFieldValueSchema } from './bindingFieldValue.js';

/** One bound field of an instance: its key in the graphic's data, and how it is read. */
export const InstanceBoundFieldSchema = z.object({
  fieldKey: z.string().min(1),
  binding: BindingFieldValueSchema,
});

/** One bound field of an instance, after validation. */
export type InstanceBoundField = z.infer<typeof InstanceBoundFieldSchema>;

/**
 * One field of an instance that reads the entity library (BAJAOVRLAY-19): its key in the
 * graphic's data, and the reference. Always live, on program and on preview alike.
 */
export const InstanceEntityFieldSchema = z.object({
  fieldKey: z.string().min(1),
  entityReference: EntityFieldValueSchema,
});

/** One entity field of an instance, after validation. */
export type InstanceEntityField = z.infer<typeof InstanceEntityFieldSchema>;

/**
 * The bindings one instance kept from its take: on program its live bindings, which the
 * live refreshes read; on preview its frozen ones as well, which "Tomar" reads again.
 * `entityFields` (BAJAOVRLAY-19): the fields it reads from the entity library, which an
 * edit of a record refreshes through the same command; kept on this entry rather than a
 * slice of their own, so a spell of refusals, a value typed on air and the instance
 * leaving work for them as for bindings. Left out when there is none; `boundFields` is
 * empty for an instance that reads the library only. An instance that reads neither has
 * no entry.
 * `refusedFieldKeys`: the fields whose last refresh the graphic's schema refused, kept on
 * air as they were while the others went on (gate 2 of PR #18); Camadas shows them as
 * "atualização recusada". Absent once a refresh fits as a whole.
 */
export const InstanceBindingsEntrySchema = z
  .object({
    instanceId: z.string().min(1),
    boundFields: z.array(InstanceBoundFieldSchema),
    entityFields: z.array(InstanceEntityFieldSchema).min(1).optional(),
    refusedFieldKeys: z.array(z.string().min(1)).min(1).optional(),
  })
  .refine((entry) => entry.boundFields.length > 0 || entry.entityFields !== undefined, {
    message: 'an entry keeps at least one bound or entity field',
  });

/** One entry of the `instanceBindings` slice, after validation. */
export type InstanceBindingsEntry = z.infer<typeof InstanceBindingsEntrySchema>;

/**
 * The `instanceBindings` slice (BAJAOVRLAY-20): the bindings of each instance on air or in
 * preview, written at its take and removed with it. Refreshes read this, never the item,
 * so editing or deleting the item does not change what is on air. Saved with the
 * instances, so a restart refreshes what was on air. Screens never receive it: graphics
 * get resolved data only (architecture rule 3).
 */
export const InstanceBindingsSchema = z.array(InstanceBindingsEntrySchema);

/** The `instanceBindings` slice, after validation. */
export type InstanceBindings = z.infer<typeof InstanceBindingsSchema>;
