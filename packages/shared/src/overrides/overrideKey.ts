import { z } from 'zod';

import { OverridableCarFieldSchema, OverridableSessionFieldSchema } from './override.js';

/** What says which override a command is about: its source, scope, field and car. */
export const OverrideKeyFieldsSchema = z.object({
  /** The source whose data is corrected. */
  sourceId: z.string().min(1),
  /** A session field, or one car's field wherever the car is listed. */
  scope: z.enum(['session', 'car']),
  /** The car, for `scope: 'car'` only. */
  carNumber: z.number().int().positive().optional(),
  /** The field corrected: one of the session's or one of a car's correctable fields. */
  field: z.string().min(1),
});

/** The key of an override, as a command names it. */
export type OverrideKey = z.infer<typeof OverrideKeyFieldsSchema>;

/**
 * Checks that a command's key makes sense: a car correction names its car and a car
 * field; a session correction names a session field and no car (a number there would be
 * ignored while the operator believes the correction follows that car).
 */
export function checkOverrideKey(key: OverrideKey, context: z.RefinementCtx): void {
  const hasCarNumber = key.carNumber !== undefined;
  if (key.scope === 'car' && !hasCarNumber) {
    context.addIssue({
      code: 'custom',
      path: ['carNumber'],
      message: 'a car correction names its car',
    });
  }
  if (key.scope === 'session' && hasCarNumber) {
    context.addIssue({
      code: 'custom',
      path: ['carNumber'],
      message: 'a session correction names no car',
    });
  }
  const fieldsOfTheScope: readonly string[] =
    key.scope === 'car' ? OverridableCarFieldSchema.options : OverridableSessionFieldSchema.options;
  if (!fieldsOfTheScope.includes(key.field)) {
    context.addIssue({
      code: 'custom',
      path: ['field'],
      message: 'this field cannot be corrected here',
    });
  }
}

/** Whether a stored override has this key (same source, scope, field and car). */
export function doesOverrideHaveKey(
  override: { sourceId: string; scope: string; field: string; carNumber?: number },
  key: OverrideKey,
): boolean {
  return (
    override.sourceId === key.sourceId &&
    override.scope === key.scope &&
    override.field === key.field &&
    override.carNumber === key.carNumber
  );
}
