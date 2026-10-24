/**
 * Whether a bound item can be taken now, and why not, so a rundown row or a shortcut
 * button says so before the press (brief G). The same rules as the server's take
 * (resolveItemFieldsIntoGraphicData): a field whose source does not exist, has no data or
 * does not send its shape cannot be read, nor can a required field whose value is absent;
 * an absent optional value is left out and does not stop the take. The reason is written
 * as the server writes it, the field's title first.
 */
import {
  type Graphic,
  type Item,
  resolveBindingAgainstSources,
  type SourcesForBindings,
} from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

import { readRequiredFieldKeys, readTitleOfField } from './dataSchemaFieldFacts';

/** Says whether an item reads any field from a source. */
export function doesItemReadASource(item: Item): boolean {
  return Object.values(item.fields).some((fieldValue) => fieldValue.kind === 'binding');
}

/** The first reason the item cannot be taken now, or undefined when it can. */
export function findWhyItemCannotBeTakenNow(
  item: Item,
  graphic: Graphic | undefined,
  sources: SourcesForBindings,
): string | undefined {
  const dataSchema = graphic?.manifest.schema;
  const requiredFieldKeys = readRequiredFieldKeys(dataSchema);
  for (const [fieldKey, fieldValue] of Object.entries(item.fields)) {
    if (fieldValue.kind !== 'binding') {
      continue;
    }
    const resolution = resolveBindingAgainstSources(fieldValue, sources);
    const isRefused =
      resolution.status === 'unresolvable' ||
      (resolution.status === 'valueAbsent' && requiredFieldKeys.includes(fieldKey));
    if (isRefused) {
      return ptBR.bindings.formErrors.aboutField(
        readTitleOfField(dataSchema, fieldKey),
        resolution.problem,
      );
    }
  }
  return undefined;
}
