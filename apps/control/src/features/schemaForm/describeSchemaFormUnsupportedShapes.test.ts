/**
 * Reading a manifest's data schema: fallbacks and unsupported shapes (apps/control)
 *
 * What this module is for:
 *   describeSchemaFormFromDataSchema reads whatever a graphic's manifest declares. A
 *   manifest is written by hand, so the reader must cope with missing words, shapes the
 *   form cannot edit, keys react-hook-form cannot hold, and schemas that are not a list
 *   of properties at all, without ever throwing or drawing a control that misleads.
 *
 * What these tests prove:
 *   - A property without a title is labelled with its key; a dropdown value without a
 *     label shows as itself.
 *   - An integer whose `v_baja.role` is `wallClock` may be filled by the server.
 *   - Shapes the form cannot edit, and keys react-hook-form cannot hold (a dot, a
 *     bracket, a leading digit, `__proto__`), become the read-only unsupported control.
 *   - No schema gives no fields; a schema that is not an object with properties is
 *     marked as unsupported as a whole.
 *
 * What these tests deliberately do not cover:
 *   - The supported shapes and the real race clock manifest:
 *     describeSchemaFormFromDataSchema.test.ts.
 *   - How the unsupported control is drawn: SchemaFormFields.test.tsx.
 */
import { describe, expect, it } from 'vitest';

import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';

/** Reads a schema with this one property and answers that property's description. */
function describeTheOnlyPropertyOf(key: string, propertySchema: unknown) {
  const description = describeSchemaFormFromDataSchema({
    type: 'object',
    properties: { [key]: propertySchema },
  });
  const [onlyField] = description.fields;
  if (onlyField === undefined) {
    throw new Error('The schema of one property must give one field description');
  }
  return onlyField;
}

describe('describeSchemaFormFromDataSchema, on single properties', () => {
  it('labels a property with its key when the manifest gives no title', () => {
    // Arrange: a text property with nothing but its type.
    const propertySchema = { type: 'string' };

    // Act: read it.
    const field = describeTheOnlyPropertyOf('apelido', propertySchema);

    // Assert: the key is better than an empty label.
    expect(field.label, 'the key must stand in for a missing title').toBe('apelido');
    expect(field.help, 'there is no help without a description').toBeUndefined();
  });

  it('shows a dropdown value as itself when the manifest gives it no label', () => {
    // Arrange: a category with labels for one of its two values only.
    const propertySchema = {
      type: 'string',
      enum: ['4x2', '4x4'],
      gddOptions: { labels: { '4x4': 'Tração nas quatro' } },
    };

    // Act: read it.
    const field = describeTheOnlyPropertyOf('tracao', propertySchema);

    // Assert: the unlabelled value is still offered, under its own name.
    expect(field.selectOptions, 'every enum value must be offered').toEqual([
      { value: '4x2', label: '4x2' },
      { value: '4x4', label: 'Tração nas quatro' },
    ]);
  });

  it('offers "filled at the take" for an integer whose role is wallClock', () => {
    // Arrange: a reference moment, as the race clock declares it.
    const propertySchema = { type: 'integer', minimum: 0, v_baja: { role: 'wallClock' } };

    // Act: read it.
    const field = describeTheOnlyPropertyOf('momentoDaLargadaMs', propertySchema);

    // Assert: it is a number the server may fill.
    expect(field.control, 'a wall-clock moment is edited as a number').toBe('number');
    expect(field.offersTakeTime, 'a wall-clock moment may be filled by the server').toBe(true);
  });

  const propertiesTheFormCannotEdit = [
    // A choice between shapes needs one control per shape.
    {
      name: 'a property with oneOf',
      key: 'piloto',
      propertySchema: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
    },
    // A type given as a list ("text or nothing") is a choice between shapes too.
    {
      name: 'a property whose type is a list of types',
      key: 'cargo',
      propertySchema: { type: ['string', 'null'] },
    },
    // A dropdown of numbers is not built before M3.
    {
      name: 'a number with enum',
      key: 'bateria',
      propertySchema: { type: 'integer', enum: [1, 2, 3] },
    },
    // The dropdown keeps the empty text for "nothing chosen", so it cannot be an option.
    {
      name: 'a text enum that contains the empty text',
      key: 'bandeira',
      propertySchema: { type: 'string', enum: ['', 'verde'] },
    },
    // A manifest written by hand can hold anything; a number is not a property schema.
    { name: 'a property whose schema is not an object', key: 'voltas', propertySchema: 7 },
    // react-hook-form reads a dot as "inside": values.piloto.nome would be stored elsewhere.
    { name: 'a key with a dot', key: 'piloto.nome', propertySchema: { type: 'string' } },
    // A bracket means "position in a list" to react-hook-form.
    { name: 'a key with a bracket', key: 'pilotos[0]', propertySchema: { type: 'string' } },
    // A key starting with a digit is taken for a position in a list as well.
    {
      name: 'a key that starts with a digit',
      key: '1aBateria',
      propertySchema: { type: 'string' },
    },
  ];

  it.each(propertiesTheFormCannotEdit)('reads $name as unsupported', ({ key, propertySchema }) => {
    // Arrange: the property of this scenario (see the table).

    // Act: read it.
    const field = describeTheOnlyPropertyOf(key, propertySchema);

    // Assert: it is shown read-only instead of with a control that would mislead.
    expect(field.control, 'the form must not offer to edit what it cannot').toBe('unsupported');
    expect(field.offersTakeTime, 'an unsupported field has no kind to choose').toBe(false);
  });

  it('reads a property named __proto__ as unsupported instead of losing it', () => {
    // Arrange: a schema as JSON text, because only JSON.parse makes `__proto__` a real key.
    const dataSchema: unknown = JSON.parse(
      '{ "type": "object", "properties": { "__proto__": { "type": "string", "title": "Protótipo" } } }',
    );

    // Act: read it.
    const description = describeSchemaFormFromDataSchema(dataSchema);

    // Assert: the property is listed, read-only, under its title.
    expect(description.fields, 'the property must not vanish').toHaveLength(1);
    expect(description.fields[0]?.control, 'react-hook-form cannot hold this key').toBe(
      'unsupported',
    );
    expect(description.fields[0]?.label, 'its title must still be read').toBe('Protótipo');
  });
});

describe('describeSchemaFormFromDataSchema, on schemas that are not a list of properties', () => {
  it('gives no fields for a graphic that has no data schema', () => {
    // Arrange: a manifest without `schema`, which OGraf allows.
    const dataSchema = undefined;

    // Act: read it.
    const description = describeSchemaFormFromDataSchema(dataSchema);

    // Assert: there is nothing to fill, and nothing is wrong.
    expect(description.fields, 'a graphic without data has no fields').toEqual([]);
    expect(
      description.isWholeDataSchemaUnsupported,
      'a missing schema is not an unsupported one',
    ).toBe(false);
  });

  const schemasThatAreNotAnObjectWithProperties = [
    // The data is a list at the top: nothing to draw field by field.
    {
      name: 'a schema whose type is array',
      dataSchema: { type: 'array', items: { type: 'string' } },
    },
    // An object schema that names no properties says nothing about what to draw.
    { name: 'an object schema without properties', dataSchema: { type: 'object' } },
    // A choice between two whole shapes.
    {
      name: 'a schema that is only a oneOf',
      dataSchema: { oneOf: [{ type: 'object' }, { type: 'array' }] },
    },
    // Not a schema at all.
    { name: 'a text where the schema should be', dataSchema: 'relógio' },
  ];

  it.each(schemasThatAreNotAnObjectWithProperties)(
    'marks $name as unsupported as a whole',
    ({ dataSchema }) => {
      // Arrange: the schema of this scenario (see the table).

      // Act: read it.
      const description = describeSchemaFormFromDataSchema(dataSchema);

      // Assert: no fields, and the form is told to show the read-only box.
      expect(description.fields, 'there is no field to draw').toEqual([]);
      expect(
        description.isWholeDataSchemaUnsupported,
        'the form must fall back to the read-only box',
      ).toBe(true);
    },
  );
});
