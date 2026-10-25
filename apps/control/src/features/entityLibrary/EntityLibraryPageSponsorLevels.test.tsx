/**
 * The sponsor levels on the Patrocinadores tab of Cadastros (apps/control)
 *
 * What this module is for:
 *   BAJAOVRLAY-46 gives sponsors the design's six levels: Diamante, Ouro, Prata, Bronze,
 *   Apoio and Realização (the organiser). Cadastros shows each by its pt-BR name, lists
 *   the sponsors in the order every round on air goes through them, and offers the six,
 *   in that order, in the form's "Cota".
 *
 * What these tests prove:
 *   - The table shows "Diamante", "Apoio" and "Realização", in round order, whatever the
 *     order the slice holds them in.
 *   - The form's "Cota" offers the six pt-BR names in round order, and choosing
 *     "Realização" saves the level `realizacao`.
 *
 * What these tests deliberately do not cover:
 *   - The rest of the tab (the plate, delete); EntityLibraryPageSponsorPlate.test.tsx and
 *     EntityLibraryPage.test.tsx.
 *   - The levels themselves; packages/shared's sponsorLevels.test.ts.
 */
import type { Sponsor } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithTheLibrary } from '@/state/entitiesLikeTheServerSends.testSupport';

import { EntityLibraryPage } from './EntityLibraryPage';

/** The organiser, Bosch at the top and a supporter, held in no particular order. */
function buildThreeSponsorsOutOfOrder(): Sponsor[] {
  return [
    { sponsorId: 'sae-brasil', name: 'SAE Brasil', tier: 'realizacao', rollWeight: 5 },
    { sponsorId: 'apoio-pneus', name: 'Pneus Trilha', tier: 'apoio', rollWeight: 2 },
    { sponsorId: 'bosch', name: 'Bosch', tier: 'diamante', rollWeight: 10 },
  ];
}

/** Draws the page with the three sponsors and opens the Patrocinadores tab. */
function renderThePatrocinadoresTab() {
  const rendered = renderOnControlPageConnectedToFakeServer(
    <EntityLibraryPage />,
    buildSlicesWithTheLibrary({ sponsors: buildThreeSponsorsOutOfOrder() }),
  );
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Patrocinadores' }));
  return rendered;
}

describe('the sponsor levels in Cadastros', () => {
  it('lists the sponsors by level in round order, each level by its pt-BR name', () => {
    // Arrange and act: draw the page on the Patrocinadores tab.
    renderThePatrocinadoresTab();

    // Assert: Bosch (Diamante), then Pneus Trilha (Apoio), then SAE Brasil (Realização).
    const table = screen.getByRole('table', { name: 'Patrocinadores cadastrados' });
    const rows = within(table).getAllByRole('row').slice(1);
    const rowTexts = rows.map((row) => row.textContent);
    expect(rowTexts[0], 'Bosch first, at Diamante').toContain('Diamante');
    expect(rowTexts[1], 'the supporter next, at Apoio').toContain('Apoio');
    expect(rowTexts[2], 'the organiser last, with its accent').toContain('Realização');
  });

  it('offers the six levels in round order in the form, and saves Realização as realizacao', async () => {
    // Arrange: the tab drawn, the new sponsor's form open with a name and a weight.
    const { fakeServer } = renderThePatrocinadoresTab();
    fireEvent.click(screen.getByRole('button', { name: '+ Patrocinador' }));
    const form = within(screen.getByRole('form', { name: 'Novo patrocinador' }));
    fireEvent.change(form.getByLabelText('Nome'), {
      target: { value: 'Prefeitura de Piracicaba' },
    });
    fireEvent.change(form.getByLabelText('Peso no rodízio'), { target: { value: '3' } });

    // Act: open "Cota", read its options, choose Realização and save.
    fireEvent.keyDown(form.getByLabelText('Cota'), { key: 'Enter' });
    const optionNames = screen.getAllByRole('option').map((option) => option.textContent);
    fireEvent.click(screen.getByRole('option', { name: 'Realização' }));
    fireEvent.click(form.getByRole('button', { name: 'Salvar' }));

    // Assert: the six names in round order, and the level sent as realizacao.
    expect(optionNames, 'the six levels, Diamante first, Realização last').toEqual([
      'Diamante',
      'Ouro',
      'Prata',
      'Bronze',
      'Apoio',
      'Realização',
    ]);
    await waitFor(() => {
      const [command] = fakeServer.listCommandsReceived();
      expect(command, 'the new sponsor goes at Realização').toMatchObject({
        type: 'upsertEntity',
        entityType: 'sponsor',
        record: { name: 'Prefeitura de Piracicaba', tier: 'realizacao', rollWeight: 3 },
      });
    });
  });
});
