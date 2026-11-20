/**
 * A car group filled from one team record of Cadastros (BAJAOVRLAY-80), as pure functions:
 * which team a group's fields all reference, the team its picker shows, and the per-field
 * references a team pick writes. Each field keeps its own "Cadastro" reference
 * (entityReferenceFormValue.ts), so saving, the server's check and the resolution of a
 * reference at the take are exactly as they were before the group existed.
 */
import type { CarGroup } from '@bajaovrlay/shared';

import type { SchemaFormEntityReferenceValue } from './entityReferenceFormValue';
import { readOwnValueOfRecord } from './plainRecord';
import type { SchemaFormValues } from './schemaFormValues';

/** A field's "Cadastro" choice in the form, or undefined when it holds none. */
function readEntityReferenceOfField(
  formValues: SchemaFormValues,
  fieldKey: string,
): SchemaFormEntityReferenceValue | undefined {
  return readOwnValueOfRecord(formValues.entityReferences ?? {}, fieldKey);
}

/**
 * The team (its car number, as the form holds it) that every field of the group
 * references, each with the attribute of its own meaning; undefined when one field reads
 * another kind of record, another attribute, or another team. Kinds are not looked at:
 * the caller has already checked that every field is "Cadastro".
 */
export function readTeamRecordReferencedByEveryField(
  carGroup: CarGroup,
  formValues: SchemaFormValues,
): string | undefined {
  const carNumberTexts: string[] = [];
  for (const [fieldKey, meaning] of Object.entries(carGroup.fields)) {
    const reference = readEntityReferenceOfField(formValues, fieldKey);
    const isOwnAttributeOfATeam =
      reference !== undefined && reference.entityType === 'team' && reference.attribute === meaning;
    if (!isOwnAttributeOfATeam) {
      return undefined;
    }
    carNumberTexts.push(reference.recordKey);
  }
  const firstCarNumberText = carNumberTexts[0];
  if (firstCarNumberText === undefined) {
    return undefined;
  }
  const isEveryFieldOnTheSameTeam = carNumberTexts.every((text) => text === firstCarNumberText);
  return isEveryFieldOnTheSameTeam ? firstCarNumberText : undefined;
}

/**
 * The team the group's picker shows: the team its first field references, or '' (nothing
 * chosen) when that field holds no team. The picker writes every field alike, so the first
 * one speaks for all of them while the group is on "Equipe dos Cadastros".
 */
export function readTeamRecordShownInGroup(
  carGroup: CarGroup,
  formValues: SchemaFormValues,
): string {
  const firstFieldKey = Object.keys(carGroup.fields)[0];
  if (firstFieldKey === undefined) {
    return '';
  }
  const reference = readEntityReferenceOfField(formValues, firstFieldKey);
  return reference?.entityType === 'team' ? reference.recordKey : '';
}

/**
 * The "Cadastro" choice each field of the group holds for one team pick: that team, and
 * the attribute of the field's own meaning. '' (no team yet) leaves the record empty,
 * which the form's check refuses with its usual message.
 */
export function buildEntityReferenceValuesOfTeamRecord(
  carGroup: CarGroup,
  carNumberText: string,
): Record<string, SchemaFormEntityReferenceValue> {
  const referenceValues: Record<string, SchemaFormEntityReferenceValue> = {};
  for (const [fieldKey, meaning] of Object.entries(carGroup.fields)) {
    referenceValues[fieldKey] = {
      entityType: 'team',
      recordKey: carNumberText,
      attribute: meaning,
    };
  }
  return referenceValues;
}
