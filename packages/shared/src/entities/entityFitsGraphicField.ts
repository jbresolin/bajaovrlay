import { readSchemaPropertyOfField } from '../bindings/bindingFitsGraphicField.js';
import {
  type EntityAttribute,
  type EntityValueType,
  findEntityAttribute,
  labelOfEntityAttribute,
  listAttributesOfEntityType,
} from './entityAttributes.js';
import type { EntityFieldValue } from './entityFieldValue.js';
import type { EntityType } from './entityType.js';
import { ptBREntities } from './ptBREntities.js';

/**
 * The manifest convention for an image field: a string whose `v_baja.role` is `imageUrl`
 * (packages/graphics/README.md). The editor offers image attributes, and the image
 * picker, on such a field only.
 */
export const imageUrlRole = 'imageUrl';

/** Says whether a value read from a manifest is a plain object, so its fields can be read. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Whether a data schema marks one field as an image field (`v_baja.role: imageUrl`). */
export function isImageFieldOfDataSchema(dataSchema: unknown, fieldKey: string): boolean {
  const schemaProperty = readSchemaPropertyOfField(dataSchema, fieldKey);
  const vendorHints = schemaProperty?.v_baja;
  const role = isPlainObject(vendorHints) ? vendorHints.role : undefined;
  return schemaProperty?.type === 'string' && role === imageUrlRole;
}

/**
 * The value types of the library one field takes, from its JSON Schema type: an image
 * URL on an image field and nothing else (a name would be read as an address), text on
 * any other string field unless it is a fixed list (an `enum`, such as the flag: no text
 * of the library is one of its values), a whole number on an integer or number field, a
 * yes or no on a boolean field, and nothing on any other field or one the schema does not
 * declare.
 */
export function listEntityValueTypesThatFitDataSchemaField(
  dataSchema: unknown,
  fieldKey: string,
): EntityValueType[] {
  const schemaProperty = readSchemaPropertyOfField(dataSchema, fieldKey);
  if (schemaProperty === undefined) {
    return [];
  }
  if (isImageFieldOfDataSchema(dataSchema, fieldKey)) {
    return ['imageUrl'];
  }
  switch (schemaProperty.type) {
    case 'string':
      return schemaProperty.enum === undefined ? ['text'] : [];
    case 'integer':
    case 'number':
      return ['integer'];
    case 'boolean':
      return ['boolean'];
    default:
      return [];
  }
}

/** The attributes of one kind of record that fit one field, in the editor's order. */
export function listAttributesThatFitDataSchemaField(
  entityType: EntityType,
  dataSchema: unknown,
  fieldKey: string,
): EntityAttribute[] {
  const typesThatFit = listEntityValueTypesThatFitDataSchemaField(dataSchema, fieldKey);
  return listAttributesOfEntityType(entityType).filter((attribute) =>
    typesThatFit.includes(attribute.valueType),
  );
}

/**
 * Says what is wrong with storing this reference on this field, as one pt-BR sentence
 * (the server puts the field's title before it), or undefined when it fits: the
 * attribute must exist for its kind of record and give a value the field takes.
 * Whether the record exists is the server's check, against the slices of now.
 */
export function findProblemInEntityReferenceForDataSchemaField(
  reference: EntityFieldValue,
  dataSchema: unknown,
  fieldKey: string,
): string | undefined {
  const attribute = findEntityAttribute(reference.entityType, reference.attribute);
  if (attribute === undefined) {
    const typeName = ptBREntities.entityTypeNames[reference.entityType];
    return ptBREntities.referenceProblems.unknownAttribute(typeName, reference.attribute);
  }
  const typesThatFit = listEntityValueTypesThatFitDataSchemaField(dataSchema, fieldKey);
  if (typesThatFit.includes(attribute.valueType)) {
    return undefined;
  }
  const attributeLabel = labelOfEntityAttribute(reference.entityType, attribute);
  return ptBREntities.referenceProblems.attributeDoesNotFitField(attributeLabel);
}
