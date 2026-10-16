/**
 * Rundown panel: a row's "⋯" menu and "Mover para atalhos" (apps/control)
 *
 * What this module is for:
 *   An item prepared in the rundown sometimes belongs on a quick-fire button instead (a
 *   red flag that can come at any moment). Each rundown row has a small "⋯" that opens a
 *   menu, also opened by a right-click on the row's "Disparar"; its "Mover para atalhos"
 *   sends `moveItemToHome` with the item going to the end of a quick-fire panel, the
 *   mirror of the quick-fire button's "Mover para rundown".
 *
 * What these tests prove:
 *   - With one panel the menu has the single entry "Mover para atalhos", which moves the
 *     item after the panel's last button.
 *   - With several panels it lists one entry per panel, in the panels' tab order
 *     ("Mover para atalhos: Atalhos", "Mover para atalhos: Box"), and each moves the item
 *     to the end of its own panel.
 *   - A right-click on "Disparar" opens the same menu, and puts nothing on air.
 *   - The server's refusal of the move is shown in the rundown column.
 *
 * What these tests deliberately do not cover:
 *   - What the server does with the move (the cursor rule, the order it keeps): its
 *     reducer tests (quickFireItems.test.ts).
 *   - The keys on an open menu: they are left alone by every shortcut but Esc, which
 *     QuickFireStripKeys.test.tsx proves for the quick-fire button's menu (the same rule).
 */
import type { Slices } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildSlicesWithShortcutsAndMacros,
  pitBoxPanelId,
  shortcutsPanelId,
} from '@/state/quickFireLikeTheServerSends.testSupport';
import { yellowFlagItemId } from '@/state/rundownLikeTheServerSends.testSupport';

import { RundownPanel } from './RundownPanel';

/** The endurance rundown and the panel "Atalhos" with its three buttons, and no other panel. */
function buildSlicesWithOnlyTheShortcutsPanel(): Slices {
  const slices = buildSlicesWithShortcutsAndMacros();
  return {
    ...slices,
    quickFirePanels: slices.quickFirePanels.filter((panel) => panel.id === shortcutsPanelId),
  };
}

/** Opens the "⋯" menu of one rundown row, as a keyboard user does (Enter on the "⋯"). */
function openMoreActionsMenuOfRow(itemLabel: string): void {
  // Radix opens its menu on a pointer press or on Enter; Enter needs no pointer stand-in.
  fireEvent.keyDown(screen.getByRole('button', { name: `Mais ações: ${itemLabel}` }), {
    key: 'Enter',
  });
}

/** The text of every entry of the menu open now, top to bottom. */
function listEntriesOfOpenMenu(): Array<string | null> {
  return screen.getAllByRole('menuitem').map((menuEntry) => menuEntry.textContent);
}

describe('"Mover para atalhos" on a rundown row', () => {
  it('with one panel, offers one entry that moves the item after the panel’s last button', () => {
    // Arrange: the rundown beside the one panel "Atalhos", which has three buttons.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <RundownPanel />,
      buildSlicesWithOnlyTheShortcutsPanel(),
    );
    openMoreActionsMenuOfRow('Bandeira amarela');
    const entriesOffered = listEntriesOfOpenMenu();

    // Act: choose "Mover para atalhos".
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mover para atalhos' }));

    // Assert: one entry was offered, and it moved the yellow flag to the end of "Atalhos".
    expect(entriesOffered, 'with one panel the menu must offer one plain entry').toEqual([
      'Mover para atalhos',
    ]);
    expect(
      fakeServer.listCommandsReceived(),
      'the item must go after the three buttons of the panel',
    ).toEqual([
      {
        type: 'moveItemToHome',
        itemId: yellowFlagItemId,
        home: { kind: 'quickFire', panelId: shortcutsPanelId },
        order: 3,
      },
    ]);
  });

  it('with several panels, offers one entry per panel in tab order', () => {
    // Arrange: the rundown beside "Atalhos" (first tab) and "Box" (second tab), which the
    // server lists the other way round.

    // Act: open the "⋯" of the yellow flag.
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, buildSlicesWithShortcutsAndMacros());
    openMoreActionsMenuOfRow('Bandeira amarela');

    // Assert: one entry per panel, named with the panel, in the order of the tabs.
    expect(
      listEntriesOfOpenMenu(),
      'each panel must have its own entry, in the order of the quick-fire tabs',
    ).toEqual(['Mover para atalhos: Atalhos', 'Mover para atalhos: Box']);
  });

  it('moves the item to the end of the panel chosen when there are several', () => {
    // Arrange: the rundown beside "Atalhos" and the empty "Box".
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <RundownPanel />,
      buildSlicesWithShortcutsAndMacros(),
    );
    openMoreActionsMenuOfRow('Bandeira amarela');

    // Act: choose the entry of "Box".
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mover para atalhos: Box' }));

    // Assert: the yellow flag becomes the first button of "Box", which had none.
    expect(
      fakeServer.listCommandsReceived(),
      'the item must go to the end of the panel chosen, here the first place of "Box"',
    ).toEqual([
      {
        type: 'moveItemToHome',
        itemId: yellowFlagItemId,
        home: { kind: 'quickFire', panelId: pitBoxPanelId },
        order: 0,
      },
    ]);
  });

  it('opens the same menu on a right-click of "Disparar", without taking anything', () => {
    // Arrange: the rundown beside the one panel "Atalhos".
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <RundownPanel />,
      buildSlicesWithOnlyTheShortcutsPanel(),
    );
    const yellowFlagRow = within(screen.getByRole('listitem', { name: 'Bandeira amarela' }));

    // Act: right-click the row's "Disparar".
    fireEvent.contextMenu(yellowFlagRow.getByRole('button', { name: 'Disparar' }));

    // Assert: the menu is open, and nothing was sent.
    expect(listEntriesOfOpenMenu(), 'a right-click must open the row’s menu').toEqual([
      'Mover para atalhos',
    ]);
    expect(
      fakeServer.listCommandsReceived(),
      'a right-click must never put the item on air',
    ).toEqual([]);
  });

  it('shows the server’s refusal of the move in the rundown column', () => {
    // Arrange: the rundown, and the move of the yellow flag sent.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <RundownPanel />,
      buildSlicesWithOnlyTheShortcutsPanel(),
    );
    openMoreActionsMenuOfRow('Bandeira amarela');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mover para atalhos' }));

    // Act: the server refuses it (another operator deleted the panel meanwhile).
    fakeServer.refuseLastCommand({
      code: 'QUICK_FIRE_PANEL_NOT_FOUND',
      message: 'O painel de atalhos "atalhos" não existe.',
    });

    // Assert: the message is shown where the move was asked for.
    expect(
      screen.getByRole('alert'),
      'a refused move must be explained in the rundown column',
    ).toHaveTextContent('O painel de atalhos "atalhos" não existe.');
  });
});

describe('the edit button of a rundown row', () => {
  it('is called "Editar item", to tell it apart from "Edição rápida"', () => {
    // Arrange: the rundown.

    // Act: draw it.
    renderOnControlPageConnectedToFakeServer(
      <RundownPanel />,
      buildSlicesWithOnlyTheShortcutsPanel(),
    );

    // Assert: the row's button names what it edits: the item, not what is on air.
    const yellowFlagRow = within(screen.getByRole('listitem', { name: 'Bandeira amarela' }));
    expect(
      yellowFlagRow.getByRole('button', { name: 'Editar item' }),
      'the row must offer "Editar item"',
    ).toBeInTheDocument();
  });
});
