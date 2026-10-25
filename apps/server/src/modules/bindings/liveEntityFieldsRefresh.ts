// The part of a live refresh that reads the entity library: the values to send for an
// instance's entity fields after a record changed (BAJAOVRLAY-19).
import {
  type EntityLibrary,
  type EntityListResolution,
  type EntityReferenceResolution,
  type InstanceEntityField,
  resolveEntityListAgainstLibrary,
  resolveEntityReferenceAgainstLibrary,
} from '@bajaovrlay/shared';

/**
 * The value of each entity field of one instance as the library says now, by field key,
 * under the same rules as a binding's refresh (rule 4): a value read is sent; an optional
 * attribute the record no longer has (the logo removed) is sent as null, so it leaves
 * the air and the graphic shows its no-logo state; a record that is gone (deleted) or a
 * required attribute that is gone sends nothing, so the last good value stays on air.
 * An entity list (BAJAOVRLAY-46) follows the same rules: the list now is sent; an empty
 * list leaves an optional field (sent as null) and leaves a required one as it was.
 */
export function readEntityFieldValuesForRefresh(
  entityFields: InstanceEntityField[],
  entities: EntityLibrary,
  requiredFieldKeys: string[],
): Record<string, unknown> {
  const valuesToSend: Record<string, unknown> = {};
  for (const { fieldKey, entityReference } of entityFields) {
    const resolution: EntityReferenceResolution | EntityListResolution =
      entityReference.kind === 'entityList'
        ? resolveEntityListAgainstLibrary(entityReference, entities)
        : resolveEntityReferenceAgainstLibrary(entityReference, entities);
    if (resolution.status === 'resolved') {
      valuesToSend[fieldKey] = resolution.value;
      continue;
    }
    const isOptionalValueGone =
      resolution.status === 'valueAbsent' && !requiredFieldKeys.includes(fieldKey);
    if (isOptionalValueGone) {
      valuesToSend[fieldKey] = null;
    }
  }
  return valuesToSend;
}
