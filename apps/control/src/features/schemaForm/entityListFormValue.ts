/**
 * A list field's "Lista dos cadastros" choice as the form holds it, and how it becomes the
 * entity list an item stores (BAJAOVRLAY-46): every sponsor, or every slot of the
 * schedule. The form holds the kind of list under `entityLists.<key>`; the offer and the
 * fit are the shared rule the server's save runs, so the editor never offers a list the
 * save would refuse.
 */
import {
  type EntityLibrary,
  type EntityListFieldValue,
  type EntityListType,
  listEntityListTypesThatFitDataSchemaField,
  resolveEntityListAgainstLibrary,
} from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

/** The lists one field is offered, in the editor's order: sponsors, then the schedule. */
export function listEntityListTypesOfferedToField(
  dataSchema: unknown,
  fieldKey: string,
): EntityListType[] {
  return listEntityListTypesThatFitDataSchemaField(dataSchema, fieldKey);
}

/** Whether "Lista dos cadastros" is offered on a field: some list of the library fits it. */
export function canFieldReadAnEntityList(dataSchema: unknown, fieldKey: string): boolean {
  return listEntityListTypesOfferedToField(dataSchema, fieldKey).length > 0;
}

/**
 * The list a field reads, from what the form holds: the kind chosen when it fits, or else
 * the first that does (a field usually fits one list only, so choosing "Lista dos
 * cadastros" is the whole choice). Undefined when no list fits, which the offer prevents.
 */
export function readEntityListOfFormField(
  dataSchema: unknown,
  fieldKey: string,
  chosenListType: EntityListType | undefined,
): EntityListFieldValue | undefined {
  const listTypesOffered = listEntityListTypesOfferedToField(dataSchema, fieldKey);
  const isChosenListOffered =
    chosenListType !== undefined && listTypesOffered.includes(chosenListType);
  const listType = isChosenListOffered ? chosenListType : listTypesOffered[0];
  return listType === undefined ? undefined : { kind: 'entityList', entityType: listType };
}

/**
 * "Valor agora": how long the list is now, read with the shared resolution the server's
 * take runs ("17 patrocinadores", "6 sessões"), or why it is empty.
 */
export function writeEntityListValueNowText(
  listType: EntityListType,
  entityLibrary: EntityLibrary,
): string {
  const texts = ptBR.entityLibrary.editor;
  const resolution = resolveEntityListAgainstLibrary(
    { kind: 'entityList', entityType: listType },
    entityLibrary,
  );
  if (resolution.status === 'valueAbsent') {
    return texts.noValueNow(resolution.problem);
  }
  const countText = texts.entityListCount[listType](resolution.value.length);
  return texts.valueNow(countText);
}
