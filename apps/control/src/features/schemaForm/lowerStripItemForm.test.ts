/**
 * The lower strip's item form, from its real manifest (apps/control, BAJAOVRLAY-81)
 *
 * What this module is for:
 *   The item editor draws a graphic's form from its manifest. BAJAOVRLAY-81 made the
 *   strip's flag ("Bandeira") optional and added two choices of what each car shows,
 *   "Mostrar as voltas" and "Diferença para o líder", whose values come from the same
 *   positions list the cars are bound to ("Lista completa"). These tests read the real
 *   manifest the way the editor does.
 *
 * What these tests prove:
 *   - "Carros" can still read the positions' whole list ("Lista completa"), which carries
 *     the laps and gaps the new cells show.
 *   - "Mostrar as voltas" is an optional switch that starts off, and "Diferença para o
 *     líder" an optional dropdown of four pt-BR choices that starts on "Não mostrar".
 *   - "Bandeira" is no longer required (the editor offers "Limpar") but still starts on
 *     "Pré-largada" in a new item, as before.
 *
 * What these tests deliberately do not cover:
 *   - Drawing the form; the SchemaFormFields component tests.
 *   - The strip drawing the cells; packages/graphics/lower-strip.
 */
import lowerStripManifest from '@bajaovrlay/lower-strip/lower-strip.ograf.json';
import { describe, expect, it } from 'vitest';

import { listBindingPathChoicesOfField } from './bindingChoices';
import { buildStartingValueOfField } from './buildSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';

/** Finds one field of the strip's form by its key, failing the test when it is missing. */
function findFieldOfTheStripForm(fieldKey: string) {
  const formDescription = describeSchemaFormFromDataSchema(lowerStripManifest.schema);
  const field = formDescription.fields.find((candidate) => candidate.key === fieldKey);
  if (field === undefined) {
    throw new Error(`the strip's form should have the field ${fieldKey}`);
  }
  return field;
}

describe('the lower strip’s item form', () => {
  it('lets "Carros" read the positions’ whole list, laps and gaps included', () => {
    // Arrange: the strip's data schema, as the editor reads it.
    const dataSchema = lowerStripManifest.schema;

    // Act: list what "Carros" may read from a source.
    const pathKeys = listBindingPathChoicesOfField(dataSchema, 'entries').map(
      (choice) => choice.pathKey,
    );

    // Assert: the positions' whole list is offered.
    expect(pathKeys, '"Lista completa" of the positions must be offered').toContain(
      'positions:entries',
    );
  });

  it('offers "Mostrar as voltas" as an optional switch that starts off', () => {
    // Arrange: the laps switch of the strip's form.
    const lapsField = findFieldOfTheStripForm('showLaps');

    // Act: read how the form draws it and what it starts with.
    const lapsFieldAsDrawn = {
      label: lapsField.label,
      control: lapsField.control,
      isRequired: lapsField.isRequired,
      startingValue: buildStartingValueOfField(lapsField),
    };

    // Assert: a switch, not required, off in a new item.
    expect(lapsFieldAsDrawn, 'the laps switch as the editor draws it').toEqual({
      label: 'Mostrar as voltas',
      control: 'switch',
      isRequired: false,
      startingValue: false,
    });
  });

  it('offers "Diferença para o líder" as a dropdown of four choices that starts on "Não mostrar"', () => {
    // Arrange: the gap choice of the strip's form.
    const gapField = findFieldOfTheStripForm('gapDisplay');

    // Act: read how the form draws it and what it starts with.
    const gapFieldAsDrawn = {
      label: gapField.label,
      control: gapField.control,
      isRequired: gapField.isRequired,
      optionLabels: gapField.selectOptions.map((option) => option.label),
      startingValue: buildStartingValueOfField(gapField),
    };

    // Assert: a dropdown with the four pt-BR choices, "Não mostrar" first and preselected.
    expect(gapFieldAsDrawn, 'the gap choice as the editor draws it').toEqual({
      label: 'Diferença para o líder',
      control: 'select',
      isRequired: false,
      optionLabels: [
        'Não mostrar',
        'Só voltas (+2 voltas)',
        'Voltas e tempo (+2 voltas ou +12,3)',
        'Só tempo (+12,3)',
      ],
      startingValue: 'none',
    });
  });

  it('lets "Bandeira" be cleared, still starting on "Pré-largada"', () => {
    // Arrange: the flag field of the strip's form.
    const flagField = findFieldOfTheStripForm('state');

    // Act: read whether it is required and what a new item starts with.
    const flagFieldAsDrawn = {
      isRequired: flagField.isRequired,
      startingValue: buildStartingValueOfField(flagField),
    };

    // Assert: optional (so "Limpar" is offered), "pre" as before.
    expect(flagFieldAsDrawn, 'the flag as the editor draws it').toEqual({
      isRequired: false,
      startingValue: 'pre',
    });
  });
});
