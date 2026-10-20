import { z } from 'zod';

import { BindingFieldValueSchema } from './bindingFieldValue.js';

/** One bound field of an instance: its key in the graphic's data, and how it is read. */
export const InstanceBoundFieldSchema = z.object({
  fieldKey: z.string().min(1),
  binding: BindingFieldValueSchema,
});

/** One bound field of an instance, after validation. */
export type InstanceBoundField = z.infer<typeof InstanceBoundFieldSchema>;

/**
 * The bindings one instance kept from its take: on program its live bindings, which the
 * live refreshes read; on preview its frozen ones as well, which "Tomar" reads again.
 * An instance with no binding has no entry.
 */
export const InstanceBindingsEntrySchema = z.object({
  instanceId: z.string().min(1),
  boundFields: z.array(InstanceBoundFieldSchema).min(1),
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
