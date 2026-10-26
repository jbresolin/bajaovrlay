/**
 * Where listBindingPathChoicesOfField (bindingChoices.ts) keeps the path choices it has
 * worked out: per graphic data schema object, then per field key (BAJAOVRLAY-45). The
 * choices depend only on the schema and on the shapes' paths, which are written in code,
 * never on the data a source sends, so they hold for as long as the schema object lives.
 *
 * A WeakMap, so a schema that is no longer used (the editor closed, a graphic registered
 * again after a reconnect) is forgotten with its choices; nothing here must be cleared.
 * What could go wrong: a schema object changed in place after its choices were kept would
 * keep its old choices. Nothing changes a schema in place: the manifest comes from the
 * server and the form keeps it as received.
 */
import type { BindingPathChoice } from './bindingChoices';

const choicesOfEachFieldOfEachSchema = new WeakMap<
  object,
  Map<string, readonly BindingPathChoice[]>
>();

/** The choices kept for this field of this schema, or undefined when none are kept yet. */
export function findKeptBindingPathChoices(
  dataSchema: object,
  fieldKey: string,
): readonly BindingPathChoice[] | undefined {
  return choicesOfEachFieldOfEachSchema.get(dataSchema)?.get(fieldKey);
}

/** Keeps the choices worked out for this field of this schema. */
export function keepBindingPathChoices(
  dataSchema: object,
  fieldKey: string,
  choices: readonly BindingPathChoice[],
): void {
  const choicesOfEachField = choicesOfEachFieldOfEachSchema.get(dataSchema) ?? new Map();
  choicesOfEachField.set(fieldKey, choices);
  choicesOfEachFieldOfEachSchema.set(dataSchema, choicesOfEachField);
}
