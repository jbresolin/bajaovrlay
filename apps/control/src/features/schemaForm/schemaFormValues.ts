import type { SchemaFormEntityReferenceValue } from './entityReferenceFormValue';

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
 * - `binding` ("Fonte", BAJAOVRLAY-20): read from a data source, as `bindings` says.
 *   Offered only in the item editor, where some bindable path fits the field.
 * - `wholeClock` ("Relógio da fonte"): the whole session clock of a source, on the time
 *   field of a graphic that marks the four clock roles; it fills the other three too.
 * - `eventField` ("Evento", BAJAOVRLAY-44): filled by the event the item shows, the
 *   payload field `eventPaths` names. Offered only in the item editor, where some payload
 *   field fits the field.
 * - `entity` ("Cadastro", BAJAOVRLAY-19): one attribute of one record of the entity
 *   library, as `entityReferences` says. Offered only in the item editor, where some
 *   attribute fits the field (entityReferenceFormValue.ts).
 */
export type SchemaFormFieldKind =
  'literal' | 'takeTime' | 'binding' | 'wholeClock' | 'eventField' | 'entity';

/**
 * A binding as the form holds it while the operator chooses: plain texts and a switch,
 * so react-hook-form copies and compares them like any value. bindingFormValue.ts turns
 * it into the binding an item stores when the form is checked.
 * - `sourceId`: the source chosen, '' for none yet;
 * - `pathKey`: the shape and path chosen, "positions:entries.0.teamName", '' for none;
 * - `carNumberText`: the car number typed, for a path that follows a car by number;
 * - `isLive`: "Ao vivo" (true) or "Congelado na entrada" (false);
 * - `transformId`: a binding transform, '' for none;
 * - `transformParameterText`: its one parameter as text (each binding transform takes at
 *   most one), '' when it takes none.
 */
export type SchemaFormBindingValue = {
  sourceId: string;
  pathKey: string;
  carNumberText: string;
  isLive: boolean;
  transformId: string;
  transformParameterText: string;
};

/**
 * One line of a list of texts as the form holds it. An object, not the bare text, because
 * react-hook-form's useFieldArray keeps a list of objects (it adds its own id to each).
 */
export type SchemaFormTextListLine = { text: string };

/**
 * What one control holds:
 * - text, number, duration and date-time controls hold the text in the input (a number
 *   stays text until the form is checked, so "12:3" can be shown back with a message);
 * - a dropdown holds the chosen option's value;
 * - a switch holds true or false;
 * - a list of texts holds its lines, in order (BAJAOVRLAY-23);
 * - null means "cleared": the field has no value and is not sent (or, on an update of
 *   what is on air, is taken off).
 */
export type SchemaFormFieldValue = string | boolean | SchemaFormTextListLine[] | null;

/** The value of a property the form cannot edit, kept as JSON text so it is never altered. */
export type UnsupportedValueAsJson = {
  key: string;
  /** The value written by JSON.stringify with two-space indentation. */
  jsonText: string;
};

/**
 * Everything a generated form holds.
 * `values`, `kinds` and `bindings` have one entry per field the form can edit, by property
 * key, so react-hook-form names them `values.<key>`, `kinds.<key>` and `bindings.<key>`.
 * `unsupportedValuesAsJson` is a list and holds text on purpose: react-hook-form copies
 * and compares what it holds key by key, and a property key such as `__proto__` or `a.b`
 * would be lost or misread on the way. Text in a list passes through it unharmed. It has
 * an entry only for a property that had a value where the form was filled from; nothing
 * is ever invented for a property the form cannot edit. A form filled from what is on
 * air also has an entry for every key on air that the schema does not declare.
 */
export type SchemaFormValues = {
  values: Record<string, SchemaFormFieldValue>;
  kinds: Record<string, SchemaFormFieldKind>;
  /** One per editable field: what "Fonte" or "Relógio da fonte" holds, kept while unused. */
  bindings: Record<string, SchemaFormBindingValue>;
  /**
   * What "Evento" reads, by field key: a payload field ("teamName"), or '' for none yet.
   * Optional: a form that never offered "Evento" (Edição rápida) has none, and a field
   * not listed reads as nothing chosen (eventFieldFormValue.ts).
   */
  eventPaths?: Record<string, string>;
  /**
   * What "Cadastro" holds, for the fields that hold a choice (BAJAOVRLAY-19). Left out
   * until one does: a control with no entry reads it as nothing chosen, so a form that
   * reads nothing of the library is exactly what it was before.
   */
  entityReferences?: Record<string, SchemaFormEntityReferenceValue>;
  unsupportedValuesAsJson: UnsupportedValueAsJson[];
};

/**
 * Which fields the operator changed since the form was last filled: the part of
 * react-hook-form's `formState.dirtyFields` this folder reads. `formState.dirtyFields`
 * of a `useForm<SchemaFormValues>()` can be passed as it is.
 */
export type SchemaFormDirtyFields = {
  /**
   * True for a changed value; for a list of texts, react-hook-form marks each line instead
   * (`[{ text: true }]`), which instanceUpdateFromSchemaForm.ts reads as changed.
   */
  values?: Partial<Record<string, unknown>>;
  kinds?: Partial<Record<string, boolean>>;
  bindings?: Partial<Record<string, unknown>>;
  eventPaths?: Partial<Record<string, boolean>>;
};
