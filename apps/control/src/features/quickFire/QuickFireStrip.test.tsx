/**
 * The quick-fire strip: tabs and buttons (apps/control)
 *
 * What this module is for:
 *   Above the layer panel, a strip of tabs: one per quick-fire panel, in the panels'
 *   order, and "Macros". A panel is a grid of buttons, one per item, painted in the item's
 *   colour with its label and, small, its graphic's name. A click puts the item on air
 *   (`takeItem`); right-click or the small "⋯" opens "Prévia", "Editar" and "Mover para
 *   rundown". These buttons are ad hoc by definition: they never move the rundown's cursor.
 *
 * What these tests prove:
 *   - The tabs follow the panels' order and end with "Macros"; the first panel is shown,
 *     its buttons in their order with label, graphic name and the item's colour.
 *   - A click sends `takeItem` and nothing else — no `moveCursor`, no `previewItem` even
 *     with "Prévia automática" on and after the server's "ok".
 *   - The menu's "Prévia" sends `previewItem` (origin manual), "Mover para rundown" sends
 *     `moveItemToHome` to the end of the rundown on screen, and a right-click opens the
 *     same menu.
 *   - A refused take shows the server's pt-BR message in the strip.
 *   - An empty panel says "Crie um item aqui para ter um atalho".
 *
 * What these tests deliberately do not cover:
 *   - That the server leaves the cursor alone for a panel item: the server's reducer
 *     tests (quickFireItems.test.ts) prove it, and the e2e shows it end to end.
 *   - "Editar" and "+ Atalho" opening the editor, and making, renaming and deleting
 *     panels: QuickFireStripPanels.test.tsx. The keys 1–9 and F1–F4:
 *     QuickFireStripKeys.test.tsx. The Macros tab: MacroGrid.test.tsx.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  letThePageFinishWhatItStarted,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import {
  bajaLogoItemId,
  buildSlicesWithShortcutsAndMacros,
} from '@/state/quickFireLikeTheServerSends.testSupport';

import { QuickFireStrip } from './QuickFireStrip';

/** The grid of buttons of the panel shown, found by its name. */
function findButtonGridOfPanel(panelName: string) {
  return within(screen.getByRole('list', { name: `Atalhos de ${panelName}` }));
}

/** Opens the "⋯" menu of one button, as a keyboard or mouse user does. */
function openMoreActionsMenu(itemLabel: string): void {
  // Radix opens its menu on a pointer press or on Enter; Enter needs no pointer stand-in.
  fireEvent.keyDown(screen.getByRole('button', { name: `Mais ações: ${itemLabel}` }), {
    key: 'Enter',
  });
}

describe('the quick-fire strip', () => {
  it('shows one tab per panel in order, then Macros and Eventos, with the first panel open', () => {
    // Arrange: "Atalhos" (order 0) and "Box" (order 1), listed the other way round.
    const slices = buildSlicesWithShortcutsAndMacros();

    // Act: draw the strip.
    renderOnControlPageConnectedToFakeServer(<QuickFireStrip />, slices);

    // Assert: four tabs in order (the event inbox, BAJAOVRLAY-44, last), and "Atalhos"
    // selected.
    const tabs = screen.getAllByRole('tab');
    expect(
      tabs.map((tab) => tab.textContent),
      'the tabs must follow the panels’ order, end with Macros and Eventos and show their F-key',
    ).toEqual(['AtalhosF1', 'BoxF2', 'MacrosF3', 'EventosF4']);
    expect(
      screen.getByRole('tab', { name: 'Atalhos' }),
      'the first panel must be the one shown',
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the panel’s buttons in their order, with label, graphic and colour', () => {
    // Arrange: three buttons in "Atalhos", listed out of order in the slice.
    const slices = buildSlicesWithShortcutsAndMacros();

    // Act: draw the strip.
    renderOnControlPageConnectedToFakeServer(<QuickFireStrip />, slices);

    // Assert: the buttons in button order, each naming its graphic, the first in grey.
    const grid = findButtonGridOfPanel('Atalhos');
    const buttonRows = grid.getAllByRole('listitem');
    expect(
      buttonRows.map((row) => row.getAttribute('aria-label')),
      'the buttons must follow the items’ order in the panel',
    ).toEqual(['Logo Baja', 'Relógio do enduro', 'Bandeira vermelha']);
    const logoButton = grid.getByRole('button', { name: /^Logo Baja/ });
    expect(logoButton, 'a button must name the graphic it puts on air').toHaveTextContent(
      'Relógio de prova',
    );
    expect(
      logoButton,
      'a button must be painted in its item’s colour (neutral for the logo)',
    ).toHaveAttribute('data-item-color', 'neutral');
  });

  it('sends takeItem and nothing else when a button is clicked', async () => {
    // Arrange: the strip, with "Prévia automática" on (the default).
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <QuickFireStrip />,
      buildSlicesWithShortcutsAndMacros(),
    );

    // Act: click "Logo Baja", and let the server accept.
    fireEvent.click(findButtonGridOfPanel('Atalhos').getByRole('button', { name: /^Logo Baja/ }));
    fakeServer.acceptLastCommand();
    await letThePageFinishWhatItStarted();

    // Assert: one takeItem, saying the page showed nothing on air on the logo's layer
    // (BAJAOVRLAY-69); no cursor move and no preview follow a panel button.
    expect(
      fakeServer.listCommandsReceived(),
      'a panel button must send takeItem only: it never moves the cursor nor previews',
    ).toEqual([{ type: 'takeItem', itemId: bajaLogoItemId, instanceIdSeenOnAir: null }]);
  });

  it('shows the server’s refusal of a take in the strip', () => {
    // Arrange: the strip, and a click on "Logo Baja".
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <QuickFireStrip />,
      buildSlicesWithShortcutsAndMacros(),
    );
    fireEvent.click(findButtonGridOfPanel('Atalhos').getByRole('button', { name: /^Logo Baja/ }));

    // Act: the server refuses the take.
    fakeServer.refuseLastCommand({
      code: 'LAYER_NOT_FOUND',
      message: 'A camada "Relógio" não existe.',
    });

    // Assert: the message is in the strip.
    expect(
      within(screen.getByRole('region', { name: 'Atalhos e macros' })).getByRole('alert'),
      'a refused take must be explained in the strip where the button was pressed',
    ).toHaveTextContent('A camada "Relógio" não existe.');
  });

  it('previews the item with the menu’s "Prévia", as a preview asked for by hand', () => {
    // Arrange: the strip.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <QuickFireStrip />,
      buildSlicesWithShortcutsAndMacros(),
    );

    // Act: open the "⋯" of "Logo Baja" and choose "Prévia".
    openMoreActionsMenu('Logo Baja');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Prévia' }));

    // Assert: one previewItem, manual.
    expect(
      fakeServer.listCommandsReceived(),
      '"Prévia" must preview the item, marked as asked for by hand',
    ).toEqual([{ type: 'previewItem', itemId: bajaLogoItemId, origin: 'manual' }]);
  });

  it('moves the item to the end of the rundown with "Mover para rundown"', () => {
    // Arrange: the strip; the rundown on screen holds three items.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <QuickFireStrip />,
      buildSlicesWithShortcutsAndMacros(),
    );

    // Act: open the "⋯" of "Logo Baja" and choose "Mover para rundown".
    openMoreActionsMenu('Logo Baja');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mover para rundown' }));

    // Assert: moved to the rundown, after its three items.
    expect(
      fakeServer.listCommandsReceived(),
      '"Mover para rundown" must move the item to the end of the rundown on screen',
    ).toEqual([
      {
        type: 'moveItemToHome',
        itemId: bajaLogoItemId,
        home: { kind: 'rundown', rundownId: 'sessao-principal' },
        order: 3,
      },
    ]);
  });

  it('opens the same menu on a right-click of the button', () => {
    // Arrange: the strip.
    renderOnControlPageConnectedToFakeServer(
      <QuickFireStrip />,
      buildSlicesWithShortcutsAndMacros(),
    );

    // Act: right-click "Logo Baja".
    fireEvent.contextMenu(
      findButtonGridOfPanel('Atalhos').getByRole('button', { name: /^Logo Baja/ }),
    );

    // Assert: the menu's three actions are offered.
    expect(
      screen.getAllByRole('menuitem').map((menuItem) => menuItem.textContent),
      'a right-click must open the same three actions',
    ).toEqual(['Prévia', 'Editar', 'Mover para rundown']);
  });

  it('says how to fill an empty panel', () => {
    // Arrange: the strip, on "Atalhos".
    renderOnControlPageConnectedToFakeServer(
      <QuickFireStrip />,
      buildSlicesWithShortcutsAndMacros(),
    );

    // Act: open the empty "Box" tab.
    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: 'Box' }));
    });

    // Assert: the hint, and no grid of buttons.
    expect(
      screen.getByText('Crie um item aqui para ter um atalho'),
      'an empty panel must say how to give it a button',
    ).toBeVisible();
    expect(
      screen.queryByRole('list', { name: 'Atalhos de Box' }),
      'an empty panel must draw no grid',
    ).toBeNull();
  });
});
