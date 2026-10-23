import { z } from 'zod';

import { BindingFieldValueSchema } from '../bindings/bindingFieldValue.js';
import { EntityFieldValueSchema } from '../entities/entityFieldValue.js';
import { EventFieldValueSchema } from '../eventInbox/eventFieldValue.js';

/** Answers whether a literal was given any value at all (null counts as a value). */
function isValuePresent(value: unknown): boolean {
  return value !== undefined;
}

/**
 * A field value typed by the operator and used exactly as typed. `value` may be
 * anything JSON can hold (text, number, boolean, null, list, object) but must be there:
 * a literal with no value would reach the graphic as a missing field.
 * `value` is `unknown`, like `data` in updateInstanceData, and not Zod's recursive JSON type,
 * because the OpenAPI generator behind GET /api/v1/openapi.json cannot describe that one.
 * What could go wrong: this schema does not know the graphic, so a text where the
 * graphic wants a number passes here and is only refused by the server at the take.
 */
export const LiteralFieldValueSchema = z.object({
  kind: z.literal('literal'),
  // TODO(M2): make this z.json() once the OpenAPI generator can describe it (gate-2 ruling on PR #8, point 8).
  value: z.unknown().refine(isValuePresent, { message: 'a literal field needs a value' }),
});

/** A literal field value that has passed LiteralFieldValueSchema. */
export type LiteralFieldValue = z.infer<typeof LiteralFieldValueSchema>;

/**
 * A field value the server fills in when the item goes on air: it resolves to the
 * wall-clock milliseconds of the take (the same moment as the instance's `takenAt`).
 * The race clock's `referenceWallClockMs` uses it, so a clock prepared the evening
 * before starts counting when it is fired, not from the moment it was saved.
 * It carries nothing but its kind, and the object is strict on purpose: a `value`
 * written next to it is refused rather than dropped, so nobody believes a moment they
 * wrote by hand is the one that goes on air.
 * What could go wrong: the same item taken twice gets two different moments, which is
 * the point; a field that must keep one fixed moment has to be a literal.
 */
export const TakeTimeFieldValueSchema = z.strictObject({
  kind: z.literal('takeTime'),
});

/** A take-time field value that has passed TakeTimeFieldValueSchema. */
export type TakeTimeFieldValue = z.infer<typeof TakeTimeFieldValueSchema>;

/**
 * How one field of an item gets its value, told apart by `kind`: a `literal` typed by
 * the operator, a `takeTime` stamped by the server at the take, a `binding` read from a
 * data source (BAJAOVRLAY-20, bindings/bindingFieldValue.ts), or an `entity` reference
 * read from the entity library (BAJAOVRLAY-19, entities/entityFieldValue.ts). A new kind
 * is one more member here, and code that switches on `kind` gains a branch instead of
 * being rewritten.
 * What could go wrong: only a literal has a `value`, so code must check `kind` before
 * reading it; the compiler refuses the read otherwise.
 */
export const FieldValueSchema = z.discriminatedUnion('kind', [
  LiteralFieldValueSchema,
  TakeTimeFieldValueSchema,
  BindingFieldValueSchema,
  // An item field filled by the event it shows (BAJAOVRLAY-44, eventInbox/eventFieldValue.ts).
  EventFieldValueSchema,
  EntityFieldValueSchema,
]);

/** A field value of any kind, after validation. */
export type FieldValue = z.infer<typeof FieldValueSchema>;

/**
 * The field values of an item, by field key (the keys of the graphic's data schema,
 * for example `sessionName`).
 */
export const ItemFieldsSchema = z.record(z.string().min(1), FieldValueSchema);

/** An item's field values by field key, after validation. */
export type ItemFields = z.infer<typeof ItemFieldsSchema>;
