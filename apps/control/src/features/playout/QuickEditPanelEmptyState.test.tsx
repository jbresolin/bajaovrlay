/**
 * "Edição rápida" with nothing loaded (apps/control)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-37 "Edição rápida" only changes what is already up: an instance
 *   loaded with "Editar" (or "Editar prévia") on a Camadas row. With nothing loaded it
 *   has nothing to edit, so it shows one line saying how to load something and one
 *   button, "Novo gráfico…", which opens the item editor: a new graphic on air is a new
 *   item. "Onde" starts on the shortcuts panel the strip shows, because a graphic made on
 *   the spot is an ad hoc button, not a step of the rundown.
 *
 * What these tests prove:
 *   - With nothing loaded the panel shows the hint and "Novo gráfico…" and nothing else:
 *     no graphic or layer dropdown, no field, no "Colocar no ar", "Prévia" or "Salvar
 *     como item".
 *   - "Novo gráfico…" opens the editor for a new item in the panel the strip shows: the
 *     first panel at page load, "Box" once the operator opened that tab, and the first
 *     panel again while the "Macros" tab is shown (a macro tab holds no items).
 *
 * What these tests deliberately do not cover:
 *   - The editor itself, here a stand-in: features/items has its tests ("Onde" included,
 *     ItemEditorPanelWhere.test.tsx; "Salvar e disparar", ItemEditorPanelSaveAndUse.test.tsx).
 *   - The panel with an instance loaded: QuickEditPanelTarget.test.tsx and its siblings.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { QuickFireStrip } from '@/features/quickFire/QuickFireStrip';
import { RundownPanel } from '@/features/rundown/RundownPanel';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithShortcutsAndMacros } from '@/state/quickFireLikeTheServerSends.testSupport';
import { buildRaceClockGraphic } from '@/state/slicesLikeTheServerSends.testSupport';

import { QuickEditPanel } from './QuickEditPanel';

vi.mock(
  '@/features/items/ItemEditorPanel',
  () => import('@/features/rundown/itemEditorStandIn.testSupport'),
);

/**
 * The centre panel, the shortcuts strip and the rundown column (which draws the item
 * editor), as on the page: the panels "Atalhos" and "Box", nothing on air.
 */
function renderEmptyQuickEditBesideTheStripAndTheRundown() {
  return renderOnControlPageConnectedToFakeServer(
    <div>
      <RundownPanel />
      <QuickEditPanel />
      <QuickFireStrip />
    </div>,
    { ...buildSlicesWithShortcutsAndMacros(), graphics: [buildRaceClockGraphic()] },
  );
}

/** The "Edição rápida" panel's own area. */
function findQuickEditArea() {
  return within(screen.getByRole('region', { name: 'Edição rápida' }));
}

/** What the item editor stand-in says it was opened for. */
function readWhatTheEditorWasOpenedFor(): string | null {
  return within(screen.getByRole('region', { name: 'Editor de item' })).getByText(
    /^Editor aberto para/,
  ).textContent;
}

describe('"Edição rápida" with nothing loaded', () => {
  it('shows the hint and "Novo gráfico…", and nothing else', () => {
    // Arrange and act: the page opens with nothing loaded into the panel.
    renderEmptyQuickEditBesideTheStripAndTheRundown();

    // Assert: one line saying how to load something, one button, no form at all.
    const quickEditArea = findQuickEditArea();
    expect(
      quickEditArea.getByText('Use Editar numa camada para alterar o que está no ar'),
      'the panel must say how to load what is on air',
    ).toBeVisible();
    expect(
      quickEditArea.getAllByRole('button').map((button) => button.textContent),
      '"Novo gráfico…" must be the only button: nothing can go up from here',
    ).toEqual(['Novo gráfico…']);
    expect(
      quickEditArea.queryAllByRole('combobox'),
      'there must be no graphic or layer dropdown any more',
    ).toEqual([]);
    expect(quickEditArea.queryAllByRole('textbox'), 'there must be no field to type into').toEqual(
      [],
    );
  });

  const panelShownScenarios = [
    // At page load the strip shows its first tab, "Atalhos".
    {
      name: 'opens the editor on the first panel at page load',
      tabOpenedFirst: undefined,
      expectedOpening: 'Editor aberto para um novo item no painel atalhos',
    },
    // The operator is working on the pit box buttons: the new graphic goes there.
    {
      name: 'opens the editor on "Box" when the strip shows "Box"',
      tabOpenedFirst: 'Box',
      expectedOpening: 'Editor aberto para um novo item no painel painel-box',
    },
    // A macro is no place for an item, so the first panel stands in for it.
    {
      name: 'opens the editor on the first panel while the strip shows "Macros"',
      tabOpenedFirst: 'Macros',
      expectedOpening: 'Editor aberto para um novo item no painel atalhos',
    },
  ];

  it.each(panelShownScenarios)('$name', ({ tabOpenedFirst, expectedOpening }) => {
    // Arrange: the page, with the strip on this row's tab.
    renderEmptyQuickEditBesideTheStripAndTheRundown();
    if (tabOpenedFirst !== undefined) {
      fireEvent.click(screen.getByRole('tab', { name: tabOpenedFirst }));
    }

    // Act: "Novo gráfico…".
    fireEvent.click(findQuickEditArea().getByRole('button', { name: 'Novo gráfico…' }));

    // Assert: the editor is open for a new item, "Onde" on the panel this row expects.
    expect(
      readWhatTheEditorWasOpenedFor(),
      '"Novo gráfico…" must open a new item in the shortcuts panel shown',
    ).toBe(expectedOpening);
  });
});
