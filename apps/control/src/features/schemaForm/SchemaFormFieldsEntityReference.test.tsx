/**
 * The "Cadastro" kind of a field in the item editor (apps/control)
 *
 * What this module is for:
 *   In the item editor a field may read one attribute of one record of the entity library
 *   (BAJAOVRLAY-19): the kind selector offers "Cadastro" wherever some attribute fits the
 *   field. Its controls choose the kind of record, then the record with a searchable
 *   picker (by car number or team for teams, by name for people and sponsors), then the
 *   attribute, filtered by the field's type (text, or an image URL for an image field),
 *   and a "Valor agora" line says what the field would get now, an image as a thumbnail.
 *   An image field typed by hand gets an image picker that uploads the file at once.
 *
 * What these tests prove:
 *   - "Cadastro" is offered when the editor hands the library, and not otherwise
 *     ("Edição rápida").
 *   - Searching "juriti" lists team 7 only; picked, the title is offered the team's texts
 *     but not its images, and "Valor agora" reads the team name.
 *   - The logo field is offered the logo and the car photo only, and team 42's logo shows
 *     as a thumbnail on the "Valor agora" line.
 *   - The logo field typed by hand uploads a chosen file and holds its /media URL.
 *
 * What these tests deliberately do not cover:
 *   - Saving the item; schemaFormEntityReferences.test.ts and the item editor's tests.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { buildEmptySchemaFormValues } from './buildSchemaFormValues';
import {
  chooseOptionInDropdown,
  renderSchemaFormOnTestPage,
} from './schemaFormOnTestPage.testSupport';
import {
  buildLibraryForTheTeamCard,
  describeTeamCardFixture,
  logoOfTeam42MediaId,
} from './teamCardFixtureSchema.testSupport';

/** Draws the team card's form, empty, with the library handed as the item editor does. */
function renderTheTeamCardFormWithTheLibrary() {
  return renderSchemaFormOnTestPage({
    description: describeTeamCardFixture(),
    formValues: buildEmptySchemaFormValues(describeTeamCardFixture()),
    entityLibrary: buildLibraryForTheTeamCard(),
  });
}

/** The option labels of a dropdown, read by opening it. */
function readOptionsOfDropdown(dropdownName: string): string[] {
  fireEvent.keyDown(screen.getByRole('combobox', { name: dropdownName }), { key: 'Enter' });
  const options = screen.getAllByRole('option').map((option) => option.textContent ?? '');
  fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
  return options;
}

describe('the "Cadastro" kind', () => {
  it('is offered when the editor hands the library', () => {
    // Arrange and act: the form with the library, then a second one without.
    renderTheTeamCardFormWithTheLibrary();
    const kindsWithTheLibrary = readOptionsOfDropdown('Como preencher Título');

    // Assert: "Cadastro" beside the typed value.
    expect(kindsWithTheLibrary, 'offered in the item editor').toContain('Cadastro');
  });

  it('is not offered when the panel hands no library', () => {
    // Arrange and act: the form as "Edição rápida" draws it.
    renderSchemaFormOnTestPage({
      description: describeTeamCardFixture(),
      formValues: buildEmptySchemaFormValues(describeTeamCardFixture()),
    });

    // Assert: no kind selector at all, the typed value being the only kind.
    expect(
      screen.queryByRole('combobox', { name: 'Como preencher Título' }),
      'nothing to choose',
    ).not.toBeInTheDocument();
  });

  it('finds team 7 by name, offers its texts on the title and shows its name now', () => {
    // Arrange: the form, the title set to "Cadastro", kind Equipe.
    renderTheTeamCardFormWithTheLibrary();
    chooseOptionInDropdown('Como preencher Título', 'Cadastro');
    chooseOptionInDropdown('Tipo de cadastro de Título', 'Equipe');

    // Act: search "juriti", pick the team, read the attributes offered, pick the name.
    fireEvent.change(screen.getByLabelText('Buscar cadastro de Título'), {
      target: { value: 'juriti' },
    });
    const recordsListed = readOptionsOfDropdown('Cadastro de Título');
    chooseOptionInDropdown('Cadastro de Título', 'Equipe 7 (Juriti Off-Road)');
    const attributesOffered = readOptionsOfDropdown('Campo do cadastro de Título');
    chooseOptionInDropdown('Campo do cadastro de Título', 'Nome da equipe');

    // Assert: one team found, texts only, and the value it would show now.
    expect(recordsListed, 'the search finds team 7 only').toEqual(['Equipe 7 (Juriti Off-Road)']);
    expect(attributesOffered, 'texts only on the title').toEqual([
      'Nome da equipe',
      'Escola (sigla)',
      'Escola (nome completo)',
      'Cidade',
      'UF',
    ]);
    expect(screen.getByText('Valor agora: Juriti Off-Road'), 'the value now').toBeInTheDocument();
  });

  it("offers images only on the logo, and shows team 42's logo now", () => {
    // Arrange: the form, the logo set to "Cadastro", team 42 chosen by its number.
    renderTheTeamCardFormWithTheLibrary();
    chooseOptionInDropdown('Como preencher Logo', 'Cadastro');
    chooseOptionInDropdown('Tipo de cadastro de Logo', 'Equipe');
    fireEvent.change(screen.getByLabelText('Buscar cadastro de Logo'), { target: { value: '42' } });
    chooseOptionInDropdown('Cadastro de Logo', 'Equipe 42 (Baja UFPR)');

    // Act: read the attributes offered, pick the logo.
    const attributesOffered = readOptionsOfDropdown('Campo do cadastro de Logo');
    chooseOptionInDropdown('Campo do cadastro de Logo', 'Logo');

    // Assert: the two images only, and the logo drawn from the media store.
    expect(attributesOffered, 'images only on an image field').toEqual(['Logo', 'Foto do carro']);
    expect(
      screen.getByRole('img', { name: 'Logo agora' }),
      'the value now as a thumbnail',
    ).toHaveAttribute('src', `/media/${logoOfTeam42MediaId}`);
  });
});

describe('the image picker of an image field typed by hand', () => {
  it('uploads the chosen file and holds its /media URL', async () => {
    // Arrange: the form, the server ready to answer the upload.
    const newLogoMediaId = 'c'.repeat(64);
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              mediaId: newLogoMediaId,
              contentType: 'image/png',
              widthPx: 64,
              heightPx: 64,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        ),
      ),
    );
    const formOnThePage = renderTheTeamCardFormWithTheLibrary();

    // Act: choose a file in the logo's picker and wait for its thumbnail.
    fireEvent.change(screen.getByLabelText('Logo'), {
      target: {
        files: [new File([new Uint8Array([0x89, 0x50])], 'logo.png', { type: 'image/png' })],
      },
    });
    const thumbnail = await screen.findByRole('img', { name: 'Logo atual' });

    // Assert: the field holds the image's address, drawn from it.
    expect(thumbnail, 'the thumbnail').toHaveAttribute('src', `/media/${newLogoMediaId}`);
    expect(formOnThePage.readFormValues().values.logo, 'the field holds the URL').toBe(
      `/media/${newLogoMediaId}`,
    );
    expect(within(document.body).queryByRole('alert'), 'no refusal').not.toBeInTheDocument();
  });
});
