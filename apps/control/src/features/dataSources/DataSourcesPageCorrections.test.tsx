/**
 * Correcting a source's values on the "Fontes de dados" page (apps/control)
 *
 * What this module is for:
 *   The detail tables of a source are where a data operator sees a wrong value (a team
 *   name misspelt by the timing system) and corrects it: a click or a right-click on the
 *   value opens "Corrigir valor…" and, while a correction is in force, "Remover
 *   correção". A corrected value shows the correction with the badge "corrigido", the
 *   reason in its tooltip. A correction belongs to the car, so it follows the car.
 *
 * What these tests prove:
 *   - A corrected team shows the corrected name, the badge and the reason.
 *   - "Corrigir valor…" on car 42's team sends setOverride for car 42's team name.
 *   - "Remover correção" sends clearOverride for that correction.
 *   - A corrected session name shows on the session card with its badge.
 *
 * What these tests deliberately do not cover:
 *   - The dialog's rules; OverrideDialog.test.tsx.
 */
import type { Override } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { buildSessionNameCorrection } from '@/state/boundInstancesLikeTheServerSends.testSupport';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildEnduroSnapshotAtLap34,
  buildSimulatorThatIsOk,
  buildSlicesWithDataSources,
  seededSimulatorId,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { DataSourcesPage } from './DataSourcesPage';

/** The correction of car 42's team name ("Jequitibá Racing" in the simulator). */
function buildCar42TeamCorrection(): Override {
  return {
    sourceId: seededSimulatorId,
    scope: 'car',
    carNumber: 42,
    field: 'teamName',
    value: 'Jequitibá Racing Team',
    reason: 'A equipe pediu a correção na secretaria de prova.',
    setBy: 'operador:3f2a9c1e',
    setAt: '2027-03-20T19:25:00.000Z',
  };
}

/** Draws the page with the simulator at lap 34 and the corrections given. */
function renderPageWithCorrections(overrides: Override[]) {
  return renderOnControlPageConnectedToFakeServer(<DataSourcesPage />, {
    ...buildSlicesWithDataSources({
      dataSources: [buildSimulatorThatIsOk()],
      dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
    }),
    overrides,
  });
}

/** The row of the positions table of one car. */
function findPositionsRowOfCar(carNumber: number): HTMLElement {
  const table = screen.getByRole('table', { name: 'Posições' });
  const row = within(table)
    .getAllByRole('row')
    .find(
      (candidate) => within(candidate).queryAllByRole('cell')[1]?.textContent === String(carNumber),
    );
  if (row === undefined) {
    throw new Error(`no row for car ${carNumber}`);
  }
  return row;
}

describe('corrections on the positions table', () => {
  it('shows the corrected team of car 42 with its badge and reason', () => {
    // Arrange and act: the page with car 42's team corrected.
    renderPageWithCorrections([buildCar42TeamCorrection()]);

    // Assert: the corrected name, and the badge carrying the reason.
    const row = within(findPositionsRowOfCar(42));
    expect(row.getByText('Jequitibá Racing Team'), 'the corrected name').toBeVisible();
    expect(row.getByText('corrigido'), 'the reason in its tooltip').toHaveAttribute(
      'title',
      'A equipe pediu a correção na secretaria de prova.',
    );
  });

  it('sends setOverride for car 42 from "Corrigir valor…" on its team', async () => {
    // Arrange: the page with no correction.
    const { fakeServer } = renderPageWithCorrections([]);

    // Act: open the team's menu, correct it with a reason.
    const positionsTable = within(screen.getByRole('table', { name: 'Posições' }));
    // (Opened with Enter, the keyboard way: a menu opens on the pointer going down, which
    // the test page does not do for a click.)
    fireEvent.keyDown(
      positionsTable.getByRole('button', { name: 'Equipe do carro 42: Jequitibá Racing' }),
      { key: 'Enter' },
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Corrigir valor…' }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Valor corrigido'), {
      target: { value: 'Jequitibá Racing Team' },
    });
    fireEvent.change(dialog.getByLabelText('Motivo (obrigatório)'), {
      target: { value: 'Nome oficial da inscrição.' },
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Salvar correção' }));

    // Assert: the correction of car 42's team, whatever its place.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the car correction').toEqual([
        {
          type: 'setOverride',
          sourceId: seededSimulatorId,
          scope: 'car',
          carNumber: 42,
          field: 'teamName',
          value: 'Jequitibá Racing Team',
          reason: 'Nome oficial da inscrição.',
        },
      ]);
    });
  });

  it('sends clearOverride from "Remover correção"', async () => {
    // Arrange: the page with car 42's team corrected.
    const { fakeServer } = renderPageWithCorrections([buildCar42TeamCorrection()]);

    // Act: right-click the corrected team and remove the correction.
    const positionsTable = within(screen.getByRole('table', { name: 'Posições' }));
    fireEvent.contextMenu(
      positionsTable.getByRole('button', { name: 'Equipe do carro 42: Jequitibá Racing Team' }),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remover correção' }));

    // Assert: the clear of that correction.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the correction must be removed').toEqual([
        {
          type: 'clearOverride',
          sourceId: seededSimulatorId,
          scope: 'car',
          carNumber: 42,
          field: 'teamName',
        },
      ]);
    });
  });
});

describe('corrections on the session card', () => {
  it('shows the corrected session name with its badge', () => {
    // Arrange and act: the page with the session name corrected.
    renderPageWithCorrections([buildSessionNameCorrection()]);

    // Assert: the corrected name on the card, with the badge.
    const sessionCard = within(
      screen.getByRole('heading', { name: 'Sessão' }).closest('[data-slot="card"]') as HTMLElement,
    );
    expect(sessionCard.getByText('Enduro — Etapa Nacional'), 'the corrected name').toBeVisible();
    expect(sessionCard.getByText('corrigido'), 'its badge').toBeVisible();
  });
});
