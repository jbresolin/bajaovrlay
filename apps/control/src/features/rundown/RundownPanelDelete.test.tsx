/**
 * Rundown panel: deleting an item with two presses (apps/control)
 *
 * What this module is for:
 *   "Excluir" on a rundown row deletes that item for good; there is no undo. One stray
 *   click in the middle of a show must not lose a prepared item, so "Excluir" works like
 *   "Limpar tudo": the first press only arms the button, which then reads "Confirmar:
 *   excluir", and a second press within 3 seconds sends `deleteItem`.
 *
 * What these tests prove:
 *   - The first press sends nothing and turns the label into "Confirmar: excluir".
 *   - A second press within 3 seconds sends `deleteItem` with the id of that row, once,
 *     and the label goes back.
 *   - Without a second press the button goes back to "Excluir" after 3 seconds, and a
 *     later press counts as a first press again.
 *   - Arming is per row: arming one row leaves the other rows' buttons as they were, and
 *     a press on another row's "Excluir" only arms that other row.
 *   - The row leaves the list only when the server sends the items without it.
 *
 * What these tests deliberately do not cover:
 *   - What the server does with `deleteItem`, the cursor included (apps/server).
 *   - The real clock: time is moved by hand, so "3 seconds" takes no time to test.
 *   - The Space key on a focused "Excluir": Space never presses a button
 *     (RundownPanelKeyboard.test.tsx).
 *   - The disabled button without a connection (RundownPanel.test.tsx).
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  letTimePassOnThePage,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithTheEnduranceRundown } from '@/state/rundownLikeTheServerSends.testSupport';

import { RundownPanel } from './RundownPanel';

// The item editor has its own tests; a stand-in takes its place here.
vi.mock('@/features/items/ItemEditorPanel', () => import('./itemEditorStandIn.testSupport'));

/** Draws the main rundown (start, yellow flag, finish) with time standing still. */
function renderRundownPanelWithTimeStandingStill() {
  vi.useFakeTimers();
  return renderOnControlPageConnectedToFakeServer(
    <RundownPanel />,
    buildSlicesWithTheEnduranceRundown('item-largada-do-enduro'),
  );
}

/** Finds the delete button on the row of the item with this label, by its current name. */
function findDeleteButtonOfItem(itemLabel: string, buttonName: string): HTMLElement {
  const row = within(screen.getByRole('listitem', { name: itemLabel }));
  return row.getByRole('button', { name: buttonName });
}

/** Reads the item labels off the rows, top to bottom, as the operator sees them. */
function listItemLabelsInRowOrder(): (string | null)[] {
  return screen.getAllByRole('listitem').map((row) => row.getAttribute('aria-label'));
}

describe('the "Excluir" button of a rundown row', () => {
  it('sends nothing on the first press and asks for confirmation instead', () => {
    // Arrange: the main rundown with its three items.
    const { fakeServer } = renderRundownPanelWithTimeStandingStill();

    // Act: press "Excluir" on the yellow flag once.
    fireEvent.click(findDeleteButtonOfItem('Bandeira amarela', 'Excluir'));

    // Assert: no command left the page, and that row's button now asks to confirm.
    expect(fakeServer.listCommandsReceived(), 'one press alone must not delete anything').toEqual(
      [],
    );
    expect(
      findDeleteButtonOfItem('Bandeira amarela', 'Confirmar: excluir'),
      'after the first press the button must ask for confirmation',
    ).toBeInTheDocument();
  });

  it('sends deleteItem for its row once on a second press within 3 seconds', () => {
    // Arrange: "Excluir" on the yellow flag already pressed once.
    const { fakeServer } = renderRundownPanelWithTimeStandingStill();
    fireEvent.click(findDeleteButtonOfItem('Bandeira amarela', 'Excluir'));

    // Act: 2.9 seconds later, press it again.
    letTimePassOnThePage(2_900);
    fireEvent.click(findDeleteButtonOfItem('Bandeira amarela', 'Confirmar: excluir'));

    // Assert: exactly one deleteItem naming that row; the button is back to its first
    // label; and the rows are untouched until the server says the item is gone.
    expect(
      fakeServer.listCommandsReceived(),
      'the second press must send deleteItem for that row, exactly once',
    ).toEqual([{ type: 'deleteItem', itemId: 'item-bandeira-amarela' }]);
    expect(
      findDeleteButtonOfItem('Bandeira amarela', 'Excluir'),
      'after confirming, the button must be ready for a new first press',
    ).toBeInTheDocument();
    expect(
      listItemLabelsInRowOrder(),
      'the rows must stay as the server last sent them until a new slice arrives',
    ).toEqual(['Largada do enduro', 'Bandeira amarela', 'Chegada do enduro']);
    // (Then the server answers, so no command is left waiting for its 5-second timeout
    // once the test is over.)
    fakeServer.acceptLastCommand();
  });

  it('goes back to "Excluir" after 3 seconds, so a late second press only arms it again', () => {
    // Arrange: "Excluir" on the yellow flag already pressed once.
    const { fakeServer } = renderRundownPanelWithTimeStandingStill();
    fireEvent.click(findDeleteButtonOfItem('Bandeira amarela', 'Excluir'));

    // Act: let the 3 seconds run out, then press again.
    letTimePassOnThePage(3_000);
    const wasBackToItsFirstLabel =
      within(screen.getByRole('listitem', { name: 'Bandeira amarela' })).queryByRole('button', {
        name: 'Excluir',
      }) !== null;
    fireEvent.click(findDeleteButtonOfItem('Bandeira amarela', 'Excluir'));

    // Assert: the label had gone back, nothing was sent, and it asks to confirm again.
    expect(wasBackToItsFirstLabel, 'the confirmation must expire after 3 seconds').toBe(true);
    expect(
      fakeServer.listCommandsReceived(),
      'a press after the confirmation expired must not delete anything',
    ).toEqual([]);
    expect(
      findDeleteButtonOfItem('Bandeira amarela', 'Confirmar: excluir'),
      'the late press must start a new confirmation',
    ).toBeInTheDocument();
  });

  it('arms only its own row: a press on another row does not delete either item', () => {
    // Arrange: "Excluir" on the yellow flag already pressed once.
    const { fakeServer } = renderRundownPanelWithTimeStandingStill();
    fireEvent.click(findDeleteButtonOfItem('Bandeira amarela', 'Excluir'));
    const numberOfButtonsAskingToConfirm = screen.getAllByRole('button', {
      name: 'Confirmar: excluir',
    }).length;

    // Act: a second later, press "Excluir" on the finish row instead.
    letTimePassOnThePage(1_000);
    fireEvent.click(findDeleteButtonOfItem('Chegada do enduro', 'Excluir'));

    // Assert: only the yellow flag was armed by the first press; the press on the finish
    // was a FIRST press for the finish, so nothing was deleted and both rows now wait.
    expect(
      numberOfButtonsAskingToConfirm,
      'arming one row must not arm the delete button of any other row',
    ).toBe(1);
    expect(
      fakeServer.listCommandsReceived(),
      'a press on another row must not confirm the first row, nor delete its own',
    ).toEqual([]);
    expect(
      findDeleteButtonOfItem('Chegada do enduro', 'Confirmar: excluir'),
      'the press on the finish must arm the finish',
    ).toBeInTheDocument();
    expect(
      findDeleteButtonOfItem('Bandeira amarela', 'Confirmar: excluir'),
      'the yellow flag must still be waiting for its own second press',
    ).toBeInTheDocument();
  });

  it('removes the row once the server sends the items without it', () => {
    // Arrange: "Excluir" pressed twice on the yellow flag, and the delete accepted.
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    const { fakeServer } = renderRundownPanelWithTimeStandingStill();
    fireEvent.click(findDeleteButtonOfItem('Bandeira amarela', 'Excluir'));
    fireEvent.click(findDeleteButtonOfItem('Bandeira amarela', 'Confirmar: excluir'));
    fakeServer.acceptLastCommand();

    // Act: the server sends the items slice that no longer has the yellow flag.
    const itemsWithoutTheYellowFlag = slices.items.filter(
      (item) => item.id !== 'item-bandeira-amarela',
    );
    fakeServer.sendMessage({ type: 'slice', name: 'items', slice: itemsWithoutTheYellowFlag });

    // Assert: two rows are left.
    expect(
      listItemLabelsInRowOrder(),
      'the deleted item must leave the list when the server says it is gone',
    ).toEqual(['Largada do enduro', 'Chegada do enduro']);
  });
});
