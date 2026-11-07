import { z } from 'zod';

import { TriggerDataSchema } from './triggerData.js';

/**
 * A field of a macro's take step filled from the data of the trigger that started the
 * run ("Dado do gatilho › <chave>" in the macro editor, BAJAOVRLAY-48). Strict, like an
 * event field: a value written beside the key is refused, not dropped.
 */
export const TriggerDataFieldValueSchema = z.strictObject({
  kind: z.literal('triggerData'),
  key: z.string().min(1).max(64),
});

/** A trigger data field after validation. */
export type TriggerDataFieldValue = z.infer<typeof TriggerDataFieldValueSchema>;

/**
 * The fields of one take step filled from the trigger, by the graphic's field key. The
 * item's other fields keep their own values.
 */
export const TriggerFieldsOfTakeSchema = z.record(z.string().min(1), TriggerDataFieldValueSchema);

/** A take step's trigger fields after validation. */
export type TriggerFieldsOfTake = z.infer<typeof TriggerFieldsOfTakeSchema>;

/**
 * What the macro runner hands takeItem for a take step with trigger fields: the fields,
 * and the run's trigger data (empty for a macro run by hand, so every such field is
 * missing). Read once, at that step, and frozen into the instance like a snapshot binding.
 */
export const TriggerFillOfTakeSchema = z.object({
  fields: TriggerFieldsOfTakeSchema,
  data: TriggerDataSchema,
});

/** A trigger fill after validation. */
export type TriggerFillOfTake = z.infer<typeof TriggerFillOfTakeSchema>;
