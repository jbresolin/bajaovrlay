// Two facts about the fields of a graphic's data schema that the take-readiness checks
// (a source's, itemTakeReadiness.ts; the library's, entityLibrary/itemEntityReadiness.ts)
// both need to write a refusal as the server writes it.

/** The keys a data schema lists under `required`. */
export function readRequiredFieldKeys(dataSchema: Record<string, unknown> | undefined): string[] {
  const required = dataSchema?.required;
  return Array.isArray(required) ? required.filter((key) => typeof key === 'string') : [];
}

/** A field's title in the data schema, or its key. */
export function readTitleOfField(
  dataSchema: Record<string, unknown> | undefined,
  fieldKey: string,
): string {
  const properties = dataSchema?.properties;
  const property =
    typeof properties === 'object' && properties !== null && Object.hasOwn(properties, fieldKey)
      ? (properties as Record<string, unknown>)[fieldKey]
      : undefined;
  const title =
    typeof property === 'object' && property !== null
      ? (property as Record<string, unknown>).title
      : undefined;
  return typeof title === 'string' ? title : fieldKey;
}
