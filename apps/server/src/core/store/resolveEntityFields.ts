// One item field that reads the entity library, at the take or the preview: the cases of
// resolveItemFieldsIntoGraphicData for an `entity` reference and an `entityList`, kept in
// their own file.
import {
  type CommandError,
  type EntityFieldValue,
  type EntityLibrary,
  type EntityListFieldValue,
  type Graphic,
  resolveEntityListAgainstLibrary,
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

/**
 * One field read from the library as a whole list (BAJAOVRLAY-46): every sponsor with a
 * logo, or every slot, in the shared order. An empty list leaves an optional field out
 * (the intermission board draws no sponsor line) and refuses a required one, naming it,
 * as a value absent on a required entity reference does.
 */
export function resolveEntityListField(
  fieldKey: string,
  list: EntityListFieldValue,
  graphic: Graphic | undefined,
  entities: EntityLibrary,
  requiredFieldKeys: string[],
): EntityFieldOutcome {
  const resolution = resolveEntityListAgainstLibrary(list, entities);
  if (resolution.status === 'resolved') {
    return { status: 'filled', keysAndValues: [[fieldKey, resolution.value]] };
  }
  if (!requiredFieldKeys.includes(fieldKey)) {
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
