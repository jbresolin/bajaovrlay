import { readCheckedFieldsOfValidSchemaForm } from './checkSchemaFormValues';
import type { SchemaFormDescription } from './schemaFormDescription';
import type { SchemaFormValues } from './schemaFormValues';

/** The two parts of a `takeGraphic` command that come from a generated form. */
export type TakeDataFromSchemaForm = {
  /** The graphic's data: one key per field that has a value. */
  data: Record<string, unknown>;
  /** Keys the server fills with the moment of the take before it checks the data. */
  takeTimeFieldKeys: string[];
};

/**
 * Builds a take's `data` and `takeTimeFieldKeys` from form values that passed the check
 * (it throws otherwise). The whole form is sent:
 * - a field with a value goes into `data`;
 * - a cleared field is left out, so the graphic never receives a null;
 * - a field set to "filled by the server at the take" is named in `takeTimeFieldKeys`
 *   and left out of `data`; this page never reads a clock to build data;
 * - a property the form cannot edit goes into `data` exactly as it was where the form
 *   was filled from, and is left out when it had no value there;
 * - a key that was on air without being declared by the schema goes into `data` the
 *   same way (buildSchemaFormValuesFromDataOnAir keeps it), so a new take of a graphic
 *   that is on air never removes data the form did not show.
 * What could go wrong: the JSON text of an unsupported property is written by this
 * folder (JSON.stringify) and never edited, so JSON.parse reads it back; text put there
 * by other code that is not JSON would make this throw.
 */
export function buildTakeDataFromSchemaForm(
  description: SchemaFormDescription,
  formValues: SchemaFormValues,
): TakeDataFromSchemaForm {
  const checkedFields = readCheckedFieldsOfValidSchemaForm(description, formValues);
  const dataPairs: Array<[string, unknown]> = [];
  const takeTimeFieldKeys: string[] = [];

  for (const unsupportedValue of formValues.unsupportedValuesAsJson) {
    const valueAsItWas: unknown = JSON.parse(unsupportedValue.jsonText);
    dataPairs.push([unsupportedValue.key, valueAsItWas]);
  }
  for (const checkedField of checkedFields) {
    if (checkedField.outcome === 'value') {
      dataPairs.push([checkedField.key, checkedField.value]);
    }
    if (checkedField.outcome === 'takeTime') {
      takeTimeFieldKeys.push(checkedField.key);
    }
  }

  // Built from pairs so that a key such as `__proto__` stays an ordinary key of the data.
  return { data: Object.fromEntries(dataPairs), takeTimeFieldKeys };
}
