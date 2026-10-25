/**
 * Test support for mappableFields: walking a shape's Zod schema by a mappable field's
 * dotted name ("clock.running", "carB.wins"), and listing a schema's fields the same way,
 * so each test can hold the hand-written list of fields against the schemas.
 */
import { z } from 'zod';

/** What a field's walk through the schema found: its own schema, and whether it may be left out. */
export type FieldSchemaFound = { fieldSchema: z.ZodType; isRequiredAlongItsPath: boolean };

/**
 * Finds the Zod schema of a field by its target name, walking into nested objects for a
 * dotted name such as "clock.running", and into an optional one such as a bracket's carB.
 * A field inside an optional object is not required, whatever its own schema says: the
 * object may be left out whole (a bye has no carB). Undefined when there is no such field.
 */
export function findFieldSchema(
  objectSchema: z.ZodObject,
  targetField: string,
): FieldSchemaFound | undefined {
  const [firstName, ...restOfNames] = targetField.split('.');
  if (firstName === undefined) {
    return undefined;
  }
  const fieldSchema = objectSchema.shape[firstName];
  if (fieldSchema === undefined) {
    return undefined;
  }
  const isRequiredHere = !fieldSchema.safeParse(undefined).success;
  if (restOfNames.length === 0) {
    return { fieldSchema, isRequiredAlongItsPath: isRequiredHere };
  }
  const nestedObjectSchema =
    fieldSchema instanceof z.ZodOptional ? fieldSchema.unwrap() : fieldSchema;
  if (!(nestedObjectSchema instanceof z.ZodObject)) {
    return undefined;
  }
  const nestedFound = findFieldSchema(nestedObjectSchema, restOfNames.join('.'));
  if (nestedFound === undefined) {
    return undefined;
  }
  return {
    fieldSchema: nestedFound.fieldSchema,
    isRequiredAlongItsPath: isRequiredHere && nestedFound.isRequiredAlongItsPath,
  };
}

/** Lists a schema's field names, nested objects (optional ones too) as dotted names ("clock.running"). */
export function listFieldNamesOfSchema(objectSchema: z.ZodObject): string[] {
  const fieldNames: string[] = [];
  for (const [fieldName, fieldSchema] of Object.entries(objectSchema.shape)) {
    const nestedObjectSchema =
      fieldSchema instanceof z.ZodOptional ? fieldSchema.unwrap() : fieldSchema;
    if (nestedObjectSchema instanceof z.ZodObject) {
      for (const nestedName of listFieldNamesOfSchema(nestedObjectSchema)) {
        fieldNames.push(`${fieldName}.${nestedName}`);
      }
    } else {
      fieldNames.push(fieldName);
    }
  }
  return fieldNames;
}
