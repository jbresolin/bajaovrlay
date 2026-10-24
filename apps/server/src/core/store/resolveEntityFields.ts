// One item field that reads the entity library, at the take or the preview: the case of
// resolveItemFieldsIntoGraphicData for an `entity` reference, kept in its own file.
import {
  type CommandError,
  type EntityFieldValue,
  type EntityLibrary,
  type Graphic,
  resolveEntityReferenceAgainstLibrary,
} from '@bajaovrlay/shared';

import { ptBR } from '../messages/ptBR.js';
import { readTitleOfField } from './itemBindingFields.js';

/** What one entity field gives: the keys and values it fills (none when left out), or why not. */
export type EntityFieldOutcome =
  | { status: 'filled'; keysAndValues: Array<[string, unknown]> }
  | { status: 'refused'; error: CommandError };

/**
 * One field read from the library: its value (an image as its /media URL), nothing when
 * the record lacks this attribute and the field is optional (no logo: the graphic shows
 * its no-logo state), or the refusal naming the field. A record that is not in the
 * library refuses always, as a missing source does: the operator deleted it, and the
 * graphic must not go on air with part of its data (concept §5.1).
 */
export function resolveEntityField(
  fieldKey: string,
  reference: EntityFieldValue,
  graphic: Graphic | undefined,
  entities: EntityLibrary,
  requiredFieldKeys: string[],
): EntityFieldOutcome {
  const resolution = resolveEntityReferenceAgainstLibrary(reference, entities);
  if (resolution.status === 'resolved') {
    return { status: 'filled', keysAndValues: [[fieldKey, resolution.value]] };
  }
  const isOptionalFieldWithoutValue =
    resolution.status === 'valueAbsent' && !requiredFieldKeys.includes(fieldKey);
  if (isOptionalFieldWithoutValue) {
    return { status: 'filled', keysAndValues: [] };
  }
  const fieldTitle = graphic === undefined ? fieldKey : readTitleOfField(graphic, fieldKey);
  return {
    status: 'refused',
    error: {
      code: 'ENTITY_NOT_RESOLVED',
      message: ptBR.bindingErrors.aboutField(fieldTitle, resolution.problem),
    },
  };
}
