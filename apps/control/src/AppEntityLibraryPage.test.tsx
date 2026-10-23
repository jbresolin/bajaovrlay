/**
 * The "Cadastros" page in the frame of the control page (apps/control)
 *
 * What this module is for:
 *   The entity library has a page of its own, "#/cadastros" (BAJAOVRLAY-19), opened from
 *   the header's "Cadastros" in a new tab, as "Fontes" is, so the console never unmounts
 *   under the producer and a data operator can keep it open on a tablet.
 *
 * What these tests prove:
 *   - "Cadastros" in the header is a link to "#/cadastros" that opens in a new tab.
 *   - The page opened at "#/cadastros" shows the Cadastros page under the same header,
 *     with the Equipes tab first.
 *
 * What these tests deliberately do not cover:
 *   - What the page shows and does; features/entityLibrary.
 *   - Following a link in jsdom; AppPages.test.tsx proves it for "Fontes".
 */
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { renderOnControlPageConnectedToFakeServer } from './state/controlPageOnFakeServer.testSupport';
import {
  buildSlicesWithTheLibrary,
  buildTeam42WithItsLogo,
} from './state/entitiesLikeTheServerSends.testSupport';

describe('the "Cadastros" link in the header', () => {
  it('opens "#/cadastros" in a new tab', () => {
    // Arrange: the console.
    window.location.hash = '';
    renderOnControlPageConnectedToFakeServer(<App />, buildSlicesWithTheLibrary({}));

    // Act: find "Cadastros" in the header.
    const header = within(screen.getByRole('navigation', { name: 'Páginas do controle' }));
    const cadastrosLink = header.getByRole('link', { name: 'Cadastros' });

    // Assert: a link to the page, in a new tab with no way back into this one.
    expect(cadastrosLink, '"Cadastros" leads to the entity library').toHaveAttribute(
      'href',
      '#/cadastros',
    );
    expect(cadastrosLink, 'in a new tab').toHaveAttribute('target', '_blank');
    expect(cadastrosLink, 'that cannot reach back').toHaveAttribute('rel', 'noopener');
  });
});

describe('the page at "#/cadastros"', () => {
  it('shows the Cadastros page with Equipes first, under the header', () => {
    // Arrange: the address the new tab opens, team 42 in the library.
    window.location.hash = '#/cadastros';

    // Act: draw the whole control page.
    renderOnControlPageConnectedToFakeServer(
      <App />,
      buildSlicesWithTheLibrary({ teams: [buildTeam42WithItsLogo()] }),
    );

    // Assert: the page's title, the teams' table, and the header's links still there.
    expect(
      screen.getByRole('heading', { name: 'Cadastros' }),
      'the page title',
    ).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: 'Equipes cadastradas' }),
      'Equipes first',
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Páginas do controle' }),
      'the header stays',
    ).toBeInTheDocument();
    window.location.hash = '';
  });
});
