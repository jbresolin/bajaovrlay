/**
 * The lower third's item form, from its real manifest (apps/control, BAJAOVRLAY-85)
 *
 * What this module is for:
 *   The item editor draws a graphic's form from its manifest. BAJAOVRLAY-85 gave the
 *   lower third ("Tarja") a place along the bottom of the stage, "Posição": Esquerda,
 *   Centro or Direita. These tests read the real manifest the way the editor does.
 *
 * What these tests prove:
 *   - "Posição" is offered as an optional dropdown of Esquerda, Centro and Direita, in
 *     that order, that starts on Esquerda in a new item, so a new lower third sits where
 *     every lower third sat before.
 *   - The fields of before ("Nome", "Função", "Equipe") are still there, "Posição" after
 *     them, and only "Nome" is required.
 *
 * What these tests deliberately do not cover:
 *   - Drawing the form; the SchemaFormFields component tests.
 *   - The lower third drawing the place; packages/graphics/lower-third.
 */
import lowerThirdManifest from '@bajaovrlay/lower-third/lower-third.ograf.json';
import { describe, expect, it } from 'vitest';

import { buildStartingValueOfField } from './buildSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';

/** Finds one field of the lower third's form by its key, failing the test when it is missing. */
function findFieldOfTheLowerThirdForm(fieldKey: string) {
  const formDescription = describeSchemaFormFromDataSchema(lowerThirdManifest.schema);
  const field = formDescription.fields.find((candidate) => candidate.key === fieldKey);
  if (field === undefined) {
    throw new Error(`the lower third's form should have the field ${fieldKey}`);
  }
  return field;
}

describe('the lower third’s item form', () => {
  it('offers "Posição" as a dropdown of Esquerda, Centro and Direita that starts on Esquerda', () => {
    // Arrange: the position field of the lower third's form.
    const positionField = findFieldOfTheLowerThirdForm('position');

    // Act: read how the form draws it and what a new item starts with.
    const positionFieldAsDrawn = {
      label: positionField.label,
      control: positionField.control,
      isRequired: positionField.isRequired,
      options: positionField.selectOptions,
      startingValue: buildStartingValueOfField(positionField),
    };

    // Assert: an optional dropdown with the three pt-BR places, the left preselected.
    expect(positionFieldAsDrawn, 'the position as the editor draws it').toEqual({
      label: 'Posição',
      control: 'select',
      isRequired: false,
      options: [
        { value: 'left', label: 'Esquerda' },
        { value: 'center', label: 'Centro' },
        { value: 'right', label: 'Direita' },
      ],
      startingValue: 'left',
    });
  });

  it('keeps "Nome", "Função" and "Equipe" before "Posição", with only "Nome" required', () => {
    // Arrange: the lower third's data schema, as the editor reads it.
    const dataSchema = lowerThirdManifest.schema;

    // Act: list the form's fields with whether each is required.
    const fieldsInOrder = describeSchemaFormFromDataSchema(dataSchema).fields.map((field) => ({
      label: field.label,
      isRequired: field.isRequired,
    }));

    // Assert: the fields of before, then the new one, only the name required.
    expect(fieldsInOrder, 'the lower third’s form, field by field').toEqual([
      { label: 'Nome', isRequired: true },
      { label: 'Função', isRequired: false },
      { label: 'Equipe', isRequired: false },
      { label: 'Posição', isRequired: false },
    ]);
  });
});
