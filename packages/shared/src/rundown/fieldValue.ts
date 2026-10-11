import { z } from 'zod';

/** Answers whether a literal was given any value at all (null counts as a value). */
function isValuePresent(value: unknown): boolean {
  return value !== undefined;
}

/**
 * A field value typed by the operator and used exactly as typed. `value` may be
 * anything JSON can hold (text, number, boolean, null, list, object) but must be there:
 * a literal with no value would reach the graphic as a missing field.
 * `value` is `unknown`, like `data` in takeGraphic, and not Zod's recursive JSON type,
 * because the OpenAPI generator behind GET /api/v1/openapi.json cannot describe that one.
 * What could go wrong: this schema does not know the graphic, so a text where the
 * graphic wants a number passes here and is only refused by the server at the take.
 */
export const LiteralFieldValueSchema = z.object({
  kind: z.literal('literal'),
  value: z.unknown().refine(isValuePresent, { message: 'a literal field needs a value' }),
});

/** A literal field value that has passed LiteralFieldValueSchema. */
export type LiteralFieldValue = z.infer<typeof LiteralFieldValueSchema>;

/**
 * How one field of an item gets its value, told apart by `kind`. Today the only kind
 * is `literal`. It is already a union so that M2 (BAJAOVRLAY-20) adds `binding` and
 * `entity` as new members here, and code that switches on `kind` gains a branch
 * instead of being rewritten.
 */
export const FieldValueSchema = z.discriminatedUnion('kind', [LiteralFieldValueSchema]);

/** A field value of any kind, after validation. */
export type FieldValue = z.infer<typeof FieldValueSchema>;

/**
 * The field values of an item, by field key (the keys of the graphic's data schema,
 * for example `sessionName`).
 */
export const ItemFieldsSchema = z.record(z.string().min(1), FieldValueSchema);

/** An item's field values by field key, after validation. */
export type ItemFields = z.infer<typeof ItemFieldsSchema>;
