/**
 * The "Lista dos cadastros" kind of a list field in the item editor (apps/control)
 *
 * What this module is for:
 *   A graphic's list field (the sponsor roll's sponsors, the sessions board's slots) may
 *   read a whole list of the entity library (BAJAOVRLAY-46). Where the item editor hands
 *   the library and some list fits the field, the field's selector offers "Lista dos
 *   cadastros" beside "Valor como está" (and "Fonte" when a source fits too); chosen, it
 *   shows which list ("Patrocinadores" or "Programação") and a "Valor agora" line with
 *   how long the list is now.
 *
 * What these tests prove:
 *   - The sponsors field offers "Lista dos cadastros" when the library is handed, and has
 *     no selector at all without it ("Edição rápida").
 *   - Chosen, it shows "Patrocinadores" and "Valor agora: 17 patrocinadores", and the form
 *     holds every sponsor, so the checked form stores { kind: 'entityList' }.
 *   - The slots field shows "Programação" and "Valor agora: 6 sessões".
 *
 * What these tests deliberately do not cover:
 *   - The rule of which list fits which field; entityListFormValue.test.ts and shared's
 *     entityListFitsGraphicField.test.ts.
 *   - Saving the item to the server; the item editor's tests and the e2e walk.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  buildLibraryOfThe30thCompetition,
  describeBoardWithEntityListsForm,
} from './boardWithEntityListsFixtureSchema.testSupport';
import { buildEmptySchemaFormValues } from './buildSchemaFormValues';
import { buildItemFieldsFromSchemaForm } from './itemFieldsFromSchemaForm';
import {
  chooseOptionInDropdown,
  renderSchemaFormOnTestPage,
} from './schemaFormOnTestPage.testSupport';

/** Draws the board's form, empty, with the library handed as the item editor does. */
function renderTheBoardFormWithTheLibrary() {
  return renderSchemaFormOnTestPage({
    description: describeBoardWithEntityListsForm(),
    formValues: buildEmptySchemaFormValues(describeBoardWithEntityListsForm()),
    entityLibrary: buildLibraryOfThe30thCompetition(),
  });
}

/** The option labels of a dropdown, read by opening it. */
function readOptionsOfDropdown(dropdownName: string): string[] {
  fireEvent.keyDown(screen.getByRole('combobox', { name: dropdownName }), { key: 'Enter' });
  const options = screen.getAllByRole('option').map((option) => option.textContent ?? '');
  fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
  return options;
}

describe('the "Lista dos cadastros" kind', () => {
  it('is offered on the sponsors field when the editor hands the library', () => {
    // Arrange and act: the form with the library.
    renderTheBoardFormWithTheLibrary();
    const kinds = readOptionsOfDropdown('Como preencher Patrocinadores');

    // Assert: the list beside the value as it is.
    expect(kinds, 'offered in the item editor').toEqual(['Valor como está', 'Lista dos cadastros']);
  });

  it('is not offered when the panel hands no library', () => {
    // Arrange and act: the form as "Edição rápida" draws it.
    renderSchemaFormOnTestPage({
      description: describeBoardWithEntityListsForm(),
      formValues: buildEmptySchemaFormValues(describeBoardWithEntityListsForm()),
    });

    // Assert: no kind selector; the list stays read-only.
    expect(
      screen.queryByRole('combobox', { name: 'Como preencher Patrocinadores' }),
      'nothing to choose',
    ).not.toBeInTheDocument();
  });

  it('reads every sponsor, says there are 17 now, and stores the list', () => {
    // Arrange: the form with the library.
    const formOnThePage = renderTheBoardFormWithTheLibrary();

    // Act: choose the list for the sponsors, then build the item's fields.
    chooseOptionInDropdown('Como preencher Patrocinadores', 'Lista dos cadastros');
    const itemFields = buildItemFieldsFromSchemaForm(
      describeBoardWithEntityListsForm(),
      formOnThePage.readFormValues(),
    );

    // Assert: the list named, its length now, and the field stored as every sponsor.
    expect(
      screen.getByRole('combobox', { name: 'Lista dos cadastros de Patrocinadores' }),
      'the list chosen',
    ).toHaveTextContent('Patrocinadores');
    expect(
      screen.getByText('Valor agora: 17 patrocinadores'),
      'the sponsor without a logo is not counted',
    ).toBeInTheDocument();
    expect(itemFields.sponsors, 'the item reads every sponsor').toEqual({
      kind: 'entityList',
      entityType: 'sponsor',
    });
  });

  it('reads the schedule on the slots field, six sessions now', () => {
    // Arrange: the form with the library.
    renderTheBoardFormWithTheLibrary();

    // Act: choose the list for the slots.
    chooseOptionInDropdown('Como preencher Sessões', 'Lista dos cadastros');

    // Assert: the schedule named, and its length now.
    expect(
      screen.getByRole('combobox', { name: 'Lista dos cadastros de Sessões' }),
      'the list chosen',
    ).toHaveTextContent('Programação');
    expect(screen.getByText('Valor agora: 6 sessões'), 'Sunday’s six slots').toBeInTheDocument();
  });
});
