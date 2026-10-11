/**
 * The values of a generated form as react-hook-form holds them while the operator edits.
 * Only types live here; buildSchemaFormValues.ts builds them and the files named
 * `...FromSchemaForm.ts` turn checked values into commands' data.
 */

/**
 * How a field gets its value:
 * - `literal`: what the operator typed or chose;
 * - `takeTime`: the server writes the moment of the take (wall-clock milliseconds) when
 *   the graphic goes on air. Offered only where the description says `offersTakeTime`.
 * M2 adds `binding` and `entity` here.
 */
export type SchemaFormFieldKind = 'literal' | 'takeTime';

/**
 * What one control holds:
 * - text, number, duration and date-time controls hold the text in the input (a number
 *   stays text until the form is checked, so "12:3" can be shown back with a message);
 * - a dropdown holds the chosen option's value;
 * - a switch holds true or false;
 * - null means "cleared": the field has no value and is not sent (or, on an update of
 *   what is on air, is taken off).
 */
export type SchemaFormFieldValue = string | boolean | null;

/** The value of a property the form cannot edit, kept as JSON text so it is never altered. */
export type UnsupportedValueAsJson = {
  key: string;
  /** The value written by JSON.stringify with two-space indentation. */
  jsonText: string;
};

/**
 * Everything a generated form holds.
 * `values` and `kinds` have one entry per field the form can edit, by property key, so
 * react-hook-form names them `values.<key>` and `kinds.<key>`.
 * `unsupportedValuesAsJson` is a list and holds text on purpose: react-hook-form copies
 * and compares what it holds key by key, and a property key such as `__proto__` or `a.b`
 * would be lost or misread on the way. Text in a list passes through it unharmed. It has
 * an entry only for a property that had a value where the form was filled from; nothing
 * is ever invented for a property the form cannot edit.
 */
export type SchemaFormValues = {
  values: Record<string, SchemaFormFieldValue>;
  kinds: Record<string, SchemaFormFieldKind>;
  unsupportedValuesAsJson: UnsupportedValueAsJson[];
};

/**
 * Which fields the operator changed since the form was last filled: the part of
 * react-hook-form's `formState.dirtyFields` this folder reads. `formState.dirtyFields`
 * of a `useForm<SchemaFormValues>()` can be passed as it is.
 */
export type SchemaFormDirtyFields = {
  values?: Partial<Record<string, boolean>>;
  kinds?: Partial<Record<string, boolean>>;
};
