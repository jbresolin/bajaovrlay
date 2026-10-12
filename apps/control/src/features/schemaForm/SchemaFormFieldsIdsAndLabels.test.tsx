/**
 * Element ids and labels of a generated form (apps/control)
 *
 * What this module is for:
 *   A label, a help text and an error message reach their control through element ids.
 *   SchemaFormFields builds those ids for properties whose keys a graphic's author chose,
 *   so the ids must work whatever the key is, and a label must never point at something
 *   that is not a control.
 *
 * What these tests prove:
 *   - A property whose key has a space still has its help text read with its control.
 *   - Two properties whose keys differ only by an ending such as "-help" never share an
 *     element id, and each label finds its own control.
 *   - While a field is "filled by the server", its label points at nothing and the note
 *     is read with the kind selector, the one control left in the row.
 *   - An uneditable property without a value has a label that points at nothing.
 *
 * What these tests deliberately do not cover:
 *   - Which control a property gets, and its values: SchemaFormFields.test.tsx.
 *   - Typing and error messages: SchemaFormFieldsEditing.test.tsx.
 *   - A real screen reader; the tests read the same attributes one would.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildEmptySchemaFormValues } from './buildSchemaFormValues';
import { describeSchemaFormFromDataSchema } from './describeSchemaFormFromDataSchema';
import { describeLowerThirdFixtureForm } from './lowerThirdFixtureSchema.testSupport';
import { renderSchemaFormOnTestPage } from './schemaFormOnTestPage.testSupport';

/** Draws the empty form of a schema with these properties, as a new item opens it. */
function renderEmptyFormOfProperties(properties: Record<string, unknown>) {
  const description = describeSchemaFormFromDataSchema({ type: 'object', properties });
  return renderSchemaFormOnTestPage({
    description,
    formValues: buildEmptySchemaFormValues(description),
  });
}

/** Lists every element id that appears more than once on the page. */
function listElementIdsUsedMoreThanOnce(): string[] {
  const idsOnThePage = Array.from(document.querySelectorAll('[id]')).map((element) => element.id);
  return idsOnThePage.filter((id, position) => idsOnThePage.indexOf(id) !== position);
}

describe('the element ids of a generated form', () => {
  it('reads the help text with the control of a property whose key has a space', () => {
    // Arrange: a manifest whose author wrote the key with spaces, "nome da equipe".
    const properties = {
      'nome da equipe': {
        type: 'string',
        title: 'Nome da equipe',
        description: 'Como a equipe aparece na tarja.',
      },
    };

    // Act: draw the form.
    renderEmptyFormOfProperties(properties);

    // Assert: `aria-describedby` is a list of ids separated by spaces, so an id with a
    // space in it would name three elements that do not exist and the help would be lost.
    expect(
      screen.getByLabelText('Nome da equipe'),
      'the help must be read with the field whatever its key is',
    ).toHaveAccessibleDescription('Como a equipe aparece na tarja.');
  });

  it('gives every element its own id when one key is another key plus "-help"', () => {
    // Arrange: "titulo" has a help text, and the next property is named "titulo-help".
    const properties = {
      titulo: { type: 'string', title: 'Título', description: 'Texto principal da tarja.' },
      'titulo-help': { type: 'string', title: 'Texto de apoio' },
    };

    // Act: draw the form.
    renderEmptyFormOfProperties(properties);

    // Assert: no id is used twice, and the second label finds its own input.
    expect(listElementIdsUsedMoreThanOnce(), 'no two elements may share an id').toEqual([]);
    expect(
      screen.getByLabelText('Texto de apoio').tagName,
      'the label of the second field must point at its input, not at the first help text',
    ).toBe('INPUT');
  });
});

describe('the label of a row that has no control for the value', () => {
  it('leaves the label unattached and reads the note with the kind selector while the server fills the field', () => {
    // Arrange: a start moment the server may fill, which is how such a field opens.
    const properties = {
      momentoDaLargadaMs: {
        type: 'integer',
        title: 'Momento da largada',
        v_baja: { role: 'wallClock' },
      },
    };

    // Act: draw the form.
    renderEmptyFormOfProperties(properties);

    // Assert: there is no control to type the value in, so the label names none, and the
    // note is read with the selector that explains it.
    expect(
      screen.getByText('Momento da largada'),
      'a label must not point at the note, which is not a control',
    ).not.toHaveAttribute('for');
    expect(
      screen.getByRole('combobox', { name: 'Como preencher Momento da largada' }),
      'the note must be read with the kind selector',
    ).toHaveAccessibleDescription('Preenchido pelo servidor no momento em que entra no ar.');
  });

  it('leaves the label of an uneditable property without a value unattached', () => {
    // Arrange: a new lower third: nobody has given it sponsors, so no box is drawn.
    const description = describeLowerThirdFixtureForm();

    // Act: draw the empty form.
    renderSchemaFormOnTestPage({
      description,
      formValues: buildEmptySchemaFormValues(description),
    });

    // Assert: with no box on the page, the label must not name an id that is not there.
    expect(
      screen.getByText('Patrocinadores'),
      'a label must not point at an element that does not exist',
    ).not.toHaveAttribute('for');
  });
});
