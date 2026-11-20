/**
 * A car group's pick read from, and written into, a stored item's fields without the item
 * editor (BAJAOVRLAY-82: the console's "Escolher carros"). The fields are read the way the
 * editor opens them (buildSchemaFormValuesFromItemFields, readAgreementOfCarGroupFields),
 * and each field's binding is built by the editor's picker (buildBindingValuesOfCarPick)
 * and checked by the rules a save runs (readBindingFromSchemaFormValue). So a pick made
 * from the console stores exactly what the same pick made in the editor stores.
 */
import type { CarGroup, ItemFields } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';

import { readBindingFromSchemaFormValue } from './bindingFormValue';
import { buildSchemaFormValuesFromItemFields } from './buildSchemaFormValuesFromItemFields';
import {
  buildBindingValuesOfCarPick,
  type CarPickInForm,
  readAgreementOfCarGroupFields,
} from './carGroupChoice';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import { readOwnValueOfRecord } from './plainRecord';

/** One group with the car picked for it, as the console hands it in. */
export type CarPickOfGroup = { carGroup: CarGroup; pick: CarPickInForm };

/** What building the fields of some picks gives: the fields, or the first problem. */
export type ItemFieldsOfCarPicks =
  { status: 'fields'; fields: ItemFields } | { status: 'problem'; message: string };

/**
 * The pick an item stores for one group, when every field of the group follows one car
 * of one source (by number or by place); undefined for a car typed by hand, read from an
 * event or a team record, or fields that follow different cars.
 */
export function readCarPickStoredInItemFields(
  carGroup: CarGroup,
  dataSchema: unknown,
  itemFields: ItemFields,
): CarPickInForm | undefined {
  const description = describeSchemaFormFromDataSchema(dataSchema);
  const formValues = buildSchemaFormValuesFromItemFields(description, itemFields).formValues;
  const agreement = readAgreementOfCarGroupFields(carGroup, formValues);
  return agreement.status === 'oneCarPick' ? agreement.pick : undefined;
}

/**
 * The source and "Ao vivo / Congelado" the item's cars already read: those of the first
 * field of these groups stored as a binding. Undefined when none is (cars typed by hand),
 * and the console then chooses a source itself. A new pick keeps both, so the console never
 * turns a frozen battle live, nor moves it to another source.
 */
export function readSourceAndWhenOfCarGroupsInItemFields(
  carGroups: CarGroup[],
  itemFields: ItemFields,
): { sourceId: string; isLive: boolean } | undefined {
  for (const carGroup of carGroups) {
    for (const fieldKey of Object.keys(carGroup.fields)) {
      const storedField = readOwnValueOfRecord(itemFields, fieldKey);
      if (storedField?.kind === 'binding') {
        return { sourceId: storedField.sourceId, isLive: storedField.isLive };
      }
    }
  }
  return undefined;
}

/**
 * The item fields of some picks: every field of each group as its own binding to the car
 * picked, exactly as the editor's picker writes it, each checked as a save checks it. The
 * first field that cannot be stored stops it, with the editor's pt-BR message naming it.
 */
export function buildItemFieldsOfCarPicks(
  dataSchema: unknown,
  picksOfGroups: CarPickOfGroup[],
): ItemFieldsOfCarPicks {
  const description = describeSchemaFormFromDataSchema(dataSchema);
  const fields: ItemFields = {};

  for (const { carGroup, pick } of picksOfGroups) {
    const bindingValuesOfTheGroup = buildBindingValuesOfCarPick(carGroup, pick);
    for (const [fieldKey, bindingValue] of Object.entries(bindingValuesOfTheGroup)) {
      const field = description.fields.find((candidate) => candidate.key === fieldKey);
      // A group whose field the form cannot describe was refused by the shared check of
      // the manifest already; this is only the guard for a schema that changed under it.
      if (field === undefined) {
        return { status: 'problem', message: ptBR.carGroups.fieldNotInTheForm(fieldKey) };
      }
      const bindingRead = readBindingFromSchemaFormValue(field, bindingValue, dataSchema, false);
      if (bindingRead.status === 'problem') {
        return { status: 'problem', message: bindingRead.message };
      }
      fields[fieldKey] = bindingRead.binding;
    }
  }
  return { status: 'fields', fields };
}
