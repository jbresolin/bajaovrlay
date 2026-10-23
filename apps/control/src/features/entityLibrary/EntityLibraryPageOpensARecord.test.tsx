/**
 * Cadastros opened on one record (apps/control)
 *
 * What this module is for:
 *   "Editar no cadastro" in "Edição rápida" (gate 2 of PR #23) opens a new browser tab at
 *   the record's address, "#/cadastros/person/narrador-joao". Cadastros then shows that
 *   record's tab with its form open, so the data operator fixes the name where it lives
 *   and the air follows through the library's refresh.
 *
 * What these tests prove:
 *   - The narrator's address opens Pessoas with the narrator's form.
 *   - Team 42's address opens Equipes with team 42's form.
 *   - The address of a record no longer in the library opens its tab, with no form.
 *
 * What these tests deliberately do not cover:
 *   - Writing and reading the address; app/recordToOpen.test.ts.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it, onTestFinished } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildNarrator,
  buildSlicesWithTheLibrary,
  buildTeam42WithItsLogo,
} from '@/state/entitiesLikeTheServerSends.testSupport';

import { EntityLibraryPage } from './EntityLibraryPage';

/** Puts the address in the browser's bar, as the new tab opened, until the test ends. */
function openTheAddress(hash: string): void {
  window.location.hash = hash;
  onTestFinished(() => {
    window.location.hash = '';
  });
}

/** Draws Cadastros with team 42 and the narrator. */
function renderCadastrosWithTeam42AndTheNarrator() {
  return renderOnControlPageConnectedToFakeServer(
    <EntityLibraryPage />,
    buildSlicesWithTheLibrary({ teams: [buildTeam42WithItsLogo()], people: [buildNarrator()] }),
  );
}

describe('Cadastros opened at the address of a record', () => {
  it("opens Pessoas with the narrator's form", () => {
    // Arrange: the narrator's address.
    openTheAddress('#/cadastros/person/narrador-joao');

    // Act: draw Cadastros.
    renderCadastrosWithTeam42AndTheNarrator();

    // Assert: the Pessoas tab chosen, the narrator's form open.
    expect(
      screen.getByRole('tab', { name: 'Pessoas' }),
      'the tab of the record is chosen',
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('form', { name: 'Editar: João Bresolin (Narrador)' }),
      "the narrator's form is open",
    ).toBeVisible();
  });

  it("opens Equipes with team 42's form", () => {
    // Arrange: team 42's address.
    openTheAddress('#/cadastros/team/42');

    // Act: draw Cadastros.
    renderCadastrosWithTeam42AndTheNarrator();

    // Assert: team 42's form open.
    expect(
      screen.getByRole('form', { name: 'Editar: Equipe 42 (Baja UFPR)' }),
      "team 42's form is open",
    ).toBeVisible();
  });

  it('opens the tab of a record no longer in the library, with no form', () => {
    // Arrange: the address of a sponsor deleted since.
    openTheAddress('#/cadastros/sponsor/patrocinador-master');

    // Act: draw Cadastros.
    renderCadastrosWithTeam42AndTheNarrator();

    // Assert: Patrocinadores chosen, no form.
    expect(
      screen.getByRole('tab', { name: 'Patrocinadores' }),
      'the tab of the record is chosen',
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('form'), 'there is no record to open').toBeNull();
  });
});
