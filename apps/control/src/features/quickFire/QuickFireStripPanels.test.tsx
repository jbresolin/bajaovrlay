/**
 * The quick-fire strip: making, renaming and deleting panels, and opening the item
 * editor (apps/control)
 *
 * What this module is for:
 *   The operator makes a panel with "+ Painel", renames the panel shown with "Renomear"
 *   and deletes it with "Excluir painel"; the server refuses a panel that still has
 *   buttons, and the last panel, in pt-BR. "+ Atalho" opens the page's item editor for a
 *   new item that goes in the panel shown, and a button's "Editar" opens it for that item.
 *   The editor is drawn in the rundown column (features/rundown/RundownPanel.tsx).
 *
 * What these tests prove:
 *   - "+ Painel", a name and "Criar painel" send createQuickFirePanel with that name; an
 *     empty name sends nothing and says what is missing.
 *   - "Renomear" sends renameQuickFirePanel for the panel shown.
 *   - "Excluir painel" sends deleteQuickFirePanel for the panel shown, and the server's
 *     refusal is shown in the strip.
 *   - "+ Atalho" opens the editor for a new item in the panel shown, and the menu's
 *     "Editar" opens it for that button's item.
 *
 * What these tests deliberately do not cover:
 *   - The editor itself, here a stand-in: features/items has its tests, the "Onde"
 *     selector included (ItemEditorPanelWhere.test.tsx).
 *   - Which panels the server refuses to delete: its reducer tests.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RundownPanel } from '@/features/rundown/RundownPanel';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithShortcutsAndMacros } from '@/state/quickFireLikeTheServerSends.testSupport';

import { QuickFireStrip } from './QuickFireStrip';

vi.mock(
  '@/features/items/ItemEditorPanel',
  () => import('@/features/rundown/itemEditorStandIn.testSupport'),
);

/** The right column's strip and the rundown column side by side, as on the page. */
function renderStripBesideTheRundown() {
  return renderOnControlPageConnectedToFakeServer(
    <div>
      <RundownPanel />
      <QuickFireStrip />
    </div>,
    buildSlicesWithShortcutsAndMacros(),
  );
}

/** The strip's own area, so its buttons are not confused with the rundown's. */
function findStripArea() {
  return within(screen.getByRole('region', { name: 'Atalhos e macros' }));
}

describe('making, renaming and deleting panels', () => {
  it('creates a panel with the name typed after "+ Painel"', () => {
    // Arrange: the strip.
    const { fakeServer } = renderStripBesideTheRundown();

    // Act: "+ Painel", type "Patrocinadores", "Criar painel".
    fireEvent.click(findStripArea().getByRole('button', { name: '+ Painel' }));
    fireEvent.change(findStripArea().getByLabelText('Nome do novo painel'), {
      target: { value: ' Patrocinadores ' },
    });
    fireEvent.click(findStripArea().getByRole('button', { name: 'Criar painel' }));

    // Assert: one createQuickFirePanel, the name trimmed.
    expect(
      fakeServer.listCommandsReceived(),
      '"Criar painel" must ask the server for a panel with the typed name',
    ).toEqual([{ type: 'createQuickFirePanel', name: 'Patrocinadores' }]);
  });

  it('sends nothing for an empty name and says what is missing', () => {
    // Arrange: the strip, with the new-panel form open.
    const { fakeServer } = renderStripBesideTheRundown();
    fireEvent.click(findStripArea().getByRole('button', { name: '+ Painel' }));

    // Act: "Criar painel" with only spaces typed.
    fireEvent.change(findStripArea().getByLabelText('Nome do novo painel'), {
      target: { value: '   ' },
    });
    fireEvent.click(findStripArea().getByRole('button', { name: 'Criar painel' }));

    // Assert: nothing sent, and the pt-BR message.
    expect(fakeServer.listCommandsReceived(), 'an empty name must not be sent').toEqual([]);
    expect(
      findStripArea().getByText('Informe o nome do painel.'),
      'the operator must be told the name is missing',
    ).toBeVisible();
  });

  it('renames the panel shown', () => {
    // Arrange: the strip, on "Atalhos".
    const { fakeServer } = renderStripBesideTheRundown();

    // Act: "Renomear", type "Atalhos da prova", "Salvar nome".
    fireEvent.click(findStripArea().getByRole('button', { name: 'Renomear' }));
    fireEvent.change(findStripArea().getByLabelText('Novo nome do painel'), {
      target: { value: 'Atalhos da prova' },
    });
    fireEvent.click(findStripArea().getByRole('button', { name: 'Salvar nome' }));

    // Assert: one renameQuickFirePanel for "Atalhos".
    expect(fakeServer.listCommandsReceived(), '"Salvar nome" must rename the panel shown').toEqual([
      { type: 'renameQuickFirePanel', panelId: 'atalhos', name: 'Atalhos da prova' },
    ]);
  });

  it('asks to delete the panel shown and shows the server’s refusal', () => {
    // Arrange: the strip, on "Atalhos", which still has three buttons.
    const { fakeServer } = renderStripBesideTheRundown();

    // Act: "Excluir painel", and the server refuses.
    fireEvent.click(findStripArea().getByRole('button', { name: 'Excluir painel' }));
    fakeServer.refuseLastCommand({
      code: 'QUICK_FIRE_PANEL_NOT_EMPTY',
      message: 'O painel "Atalhos" ainda tem itens. Mova ou exclua os itens antes.',
    });

    // Assert: the command named the panel shown, and the refusal is in the strip.
    expect(fakeServer.listCommandsReceived(), '"Excluir painel" must name the panel shown').toEqual(
      [{ type: 'deleteQuickFirePanel', panelId: 'atalhos' }],
    );
    expect(
      findStripArea().getByRole('alert'),
      'the server’s refusal must be shown in the strip',
    ).toHaveTextContent('O painel "Atalhos" ainda tem itens.');
  });
});

describe('opening the item editor from the strip', () => {
  it('opens the editor for a new item in the panel shown with "+ Atalho"', () => {
    // Arrange: the strip beside the rundown, on "Atalhos".
    renderStripBesideTheRundown();

    // Act: "+ Atalho".
    fireEvent.click(findStripArea().getByRole('button', { name: '+ Atalho' }));

    // Assert: the editor is open for a new item of the panel "Atalhos".
    expect(
      within(screen.getByRole('region', { name: 'Editor de item' })).getByText(
        'Editor aberto para um novo item no painel atalhos',
      ),
      '"+ Atalho" must open the editor for a new item in the panel shown',
    ).toBeVisible();
  });

  it('opens the editor for the button’s item with the menu’s "Editar"', () => {
    // Arrange: the strip beside the rundown.
    renderStripBesideTheRundown();

    // Act: "⋯" of "Relógio do enduro", then "Editar".
    fireEvent.keyDown(
      findStripArea().getByRole('button', { name: 'Mais ações: Relógio do enduro' }),
      { key: 'Enter' },
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));

    // Assert: the editor is open for that item, although it is not in the rundown.
    expect(
      within(screen.getByRole('region', { name: 'Editor de item' })).getByText(
        'Editor aberto para o item Relógio do enduro',
      ),
      '"Editar" must open the editor for the button’s item',
    ).toBeVisible();
  });
});
