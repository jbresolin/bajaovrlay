/**
 * The light plate of a sponsor's logo on the "Cadastros" page (apps/control)
 *
 * What this module is for:
 *   A sponsor's logo goes on the sponsor bug's small light plate when it is dark or comes
 *   on its own white box, the team's rule (BAJAOVRLAY-24) given to sponsors
 *   (BAJAOVRLAY-23). The operator decides it by hand on the Patrocinadores tab, with the
 *   logo previewed on the on-air panel and on the plate side by side (the team's
 *   component).
 *
 * What these tests prove:
 *   - The master sponsor's form shows its logo on the panel and on the plate; "Logo sobre
 *     placa clara" ticked and saved sends the sponsor with the choice.
 *   - A sponsor with no logo is told to send one first, and no preview is drawn.
 *
 * What these tests deliberately do not cover:
 *   - The team's checkbox; EntityLibraryPage.test.tsx.
 *   - The placa_clara CSV column; entityCsvImport.test.ts and entityCsvExport.test.ts.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildLogoOfTheMasterSponsor,
  buildMasterSponsorWithItsLogo,
  buildSlicesWithTheLibrary,
  logoOfTheMasterSponsorMediaId,
} from '@/state/entitiesLikeTheServerSends.testSupport';

import { EntityLibraryPage } from './EntityLibraryPage';

/** Draws the page with the master sponsor (and its logo) and a support sponsor with none. */
function renderPageWithTwoSponsors() {
  return renderOnControlPageConnectedToFakeServer(
    <EntityLibraryPage />,
    buildSlicesWithTheLibrary({
      sponsors: [
        buildMasterSponsorWithItsLogo(),
        { sponsorId: 'apoio-pneus', name: 'Pneus Trilha', tier: 'apoio', rollWeight: 2 },
      ],
      media: [buildLogoOfTheMasterSponsor()],
    }),
  );
}

/** Opens the Patrocinadores tab and the form of the sponsor in the given row. */
function openTheFormOfSponsorInRow(rowIndex: number) {
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Patrocinadores' }));
  const table = screen.getByRole('table', { name: 'Patrocinadores cadastrados' });
  const row = within(table).getAllByRole('row').slice(1)[rowIndex] as HTMLElement;
  fireEvent.click(within(row).getByRole('button', { name: 'Editar' }));
  return within(screen.getByRole('form', { name: /^Editar: / }));
}

describe("the light plate of a sponsor's logo", () => {
  it('shows the master sponsor’s logo on the panel and on the plate, and saves the box ticked', async () => {
    // Arrange: the page drawn, the master sponsor's form open.
    const { fakeServer } = renderPageWithTwoSponsors();
    const form = openTheFormOfSponsorInRow(0);

    // Act: tick the box and save.
    fireEvent.click(form.getByRole('checkbox', { name: 'Logo sobre placa clara' }));
    fireEvent.click(form.getByRole('button', { name: 'Salvar' }));

    // Assert: both previews show the logo; the sponsor goes with its logo on the plate.
    expect(
      form.getByRole('img', { name: 'Logo no painel, como vai ao ar sem a placa' }),
      'the logo on the panel',
    ).toHaveAttribute('src', `/media/${logoOfTheMasterSponsorMediaId}`);
    expect(
      form.getByRole('img', { name: 'Logo na placa clara' }),
      'the logo on the plate',
    ).toHaveAttribute('src', `/media/${logoOfTheMasterSponsorMediaId}`);
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the sponsor with its logo on the plate').toEqual([
        {
          type: 'upsertEntity',
          entityType: 'sponsor',
          record: { ...buildMasterSponsorWithItsLogo(), logoOnLightPlate: true },
        },
      ]);
    });
  });

  it('asks for the logo first on a sponsor that has none', () => {
    // Arrange: the page drawn.
    renderPageWithTwoSponsors();

    // Act: open the support sponsor's form (no logo).
    const form = openTheFormOfSponsorInRow(1);

    // Assert: no preview, and a line saying what to do.
    expect(
      form.getByText('Envie o logo para ver como ele fica no painel e na placa clara.'),
      'the operator is told to send the logo first',
    ).toBeInTheDocument();
    expect(form.queryByRole('img', { name: 'Logo na placa clara' }), 'no preview').toBeNull();
  });
});
