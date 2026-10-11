/**
 * Rundown panel: reordering by drag (apps/control)
 *
 * What this module is for:
 *   The operator changes the order of the rundown by dragging a row by its "Mover"
 *   handle, with the mouse or, without one, from the keyboard (Space or Enter to pick
 *   the row up, the arrows to move it, Space or Enter to drop it). The drop sends
 *   `reorderItems` with the ids of ALL the rundown's items in the new order.
 *
 * What these tests prove:
 *   - A real drag, driven through dnd-kit's keyboard sensor, sends one `reorderItems`
 *     naming the rundown and listing every item id in the new order.
 *   - Nothing is reordered on the page itself: after the drop the rows are still in the
 *     server's order, and they change only when the server's new items slice arrives.
 *   - Picking a row up and dropping it where it was sends nothing.
 *   - Picking a row up with Space does not fire the rundown (Space is also "take next").
 *   - Without a connection the handles are disabled.
 *
 * How, and why this way:
 *   The many "dragged X onto Y" cases are tested on the pure function, in
 *   itemIdsInOrderAfterDrag.test.ts. Here ONE drag goes through the real dnd-kit, to
 *   prove the panel is wired to it. The keyboard is used because the test browser
 *   (jsdom) has no mouse pointer and draws nothing; for the same reason the test tells
 *   it where each row "is" on screen (60 px tall, one under the other), which is what
 *   dnd-kit reads to know which row the dragged one is over.
 *
 * What these tests deliberately do not cover:
 *   - Dragging with the mouse, the animation of the rows, and what a screen reader
 *     announces; those are dnd-kit's and are checked by hand in the browser.
 *   - The server refusing a list that is not a full permutation (the server's tests).
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildEnduranceItemsWithTheStartMovedBelowTheYellowFlag,
  buildSlicesWithTheEnduranceRundown,
} from '@/state/rundownLikeTheServerSends.testSupport';

import { RundownPanel } from './RundownPanel';

// The item editor has its own tests; a stand-in takes its place here.
vi.mock('@/features/items/ItemEditorPanel', () => import('./itemEditorStandIn.testSupport'));

const heightOfOneRowInPixels = 60;
const widthOfTheRundownColumnInPixels = 320;

// The stand-in below replaces a browser function for the whole test file; this puts the
// real one back after each test so nothing leaks into the next.
afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Tells the test browser where each rundown row is on screen: the first row at the top,
 * each next one 60 px lower. Everything inside a row reports the place of its row.
 */
function giveEachRundownRowAPlaceOnScreen(): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const rowOfThisElement = this.closest('li');
    const rowsOnScreen = Array.from(document.querySelectorAll('li'));
    const rowIndex = rowOfThisElement === null ? 0 : rowsOnScreen.indexOf(rowOfThisElement);
    return new DOMRect(
      0,
      rowIndex * heightOfOneRowInPixels,
      widthOfTheRundownColumnInPixels,
      heightOfOneRowInPixels,
    );
  });
}

/**
 * Presses one key on a row's "Mover" handle and then waits a moment, because dnd-kit
 * reacts to each key a little later (it measures the rows between one key and the next).
 * `keyCode` is the physical key, as dnd-kit reads it: 'Space', 'ArrowDown', ...
 */
async function pressKeyOnMoveHandle(moveHandle: HTMLElement, keyCode: string): Promise<void> {
  const keyAsTheBrowserNamesIt = keyCode === 'Space' ? ' ' : keyCode;
  await act(async () => {
    fireEvent.keyDown(moveHandle, { code: keyCode, key: keyAsTheBrowserNamesIt });
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

/** Reads the item labels off the rows, top to bottom, as the operator sees them. */
function listItemLabelsInRowOrder(): (string | null)[] {
  return screen.getAllByRole('listitem').map((row) => row.getAttribute('aria-label'));
}

/** Finds the "Mover" handle on the row of the item with this label. */
function findMoveHandleOfItem(itemLabel: string): HTMLElement {
  const row = within(screen.getByRole('listitem', { name: itemLabel }));
  return row.getByRole('button', { name: 'Mover' });
}

describe('reordering the rundown by drag', () => {
  it('sends reorderItems with every item id in the new order when a row is moved down', async () => {
    // Arrange: the main rundown — start, yellow flag, finish — with each row given a place.
    giveEachRundownRowAPlaceOnScreen();
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);
    const moveHandleOfTheStart = findMoveHandleOfItem('Largada do enduro');

    // Act: pick the start up, move it one row down, and drop it.
    await pressKeyOnMoveHandle(moveHandleOfTheStart, 'Space');
    await pressKeyOnMoveHandle(moveHandleOfTheStart, 'ArrowDown');
    await pressKeyOnMoveHandle(moveHandleOfTheStart, 'Space');

    // Assert: one reorderItems with all three ids, the start now second. No take was
    // sent, although Space is also the "take next" key.
    expect(
      fakeServer.listCommandsReceived(),
      'the drop must send exactly one reorderItems listing every item of the rundown in the new order',
    ).toEqual([
      {
        type: 'reorderItems',
        rundownId: 'sessao-principal',
        orderedItemIds: [
          'item-bandeira-amarela',
          'item-largada-do-enduro',
          'item-chegada-do-enduro',
        ],
      },
    ]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it("keeps the rows in the server's order after the drop, until the new items slice arrives", async () => {
    // Arrange: the main rundown, and the start dragged one row down and dropped.
    giveEachRundownRowAPlaceOnScreen();
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);
    const moveHandleOfTheStart = findMoveHandleOfItem('Largada do enduro');
    await pressKeyOnMoveHandle(moveHandleOfTheStart, 'Space');
    await pressKeyOnMoveHandle(moveHandleOfTheStart, 'ArrowDown');
    await pressKeyOnMoveHandle(moveHandleOfTheStart, 'Space');
    const rowLabelsRightAfterTheDrop = listItemLabelsInRowOrder();

    // Act: the server accepts and sends the items with their new orders.
    fakeServer.acceptLastCommand();
    fakeServer.sendMessage({
      type: 'slice',
      name: 'items',
      slice: buildEnduranceItemsWithTheStartMovedBelowTheYellowFlag(),
    });

    // Assert: the page waited for the server, then followed it.
    expect(
      rowLabelsRightAfterTheDrop,
      'right after the drop the rows must still be in the order the server last sent',
    ).toEqual(['Largada do enduro', 'Bandeira amarela', 'Chegada do enduro']);
    expect(
      listItemLabelsInRowOrder(),
      'once the server sends the new orders the rows must follow them',
    ).toEqual(['Bandeira amarela', 'Largada do enduro', 'Chegada do enduro']);
  });

  it('sends nothing when a row is picked up and dropped where it was', async () => {
    // Arrange: the main rundown with each row given a place.
    giveEachRundownRowAPlaceOnScreen();
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);
    const moveHandleOfTheYellowFlag = findMoveHandleOfItem('Bandeira amarela');

    // Act: pick the yellow flag up and drop it at once, without moving it.
    await pressKeyOnMoveHandle(moveHandleOfTheYellowFlag, 'Space');
    await pressKeyOnMoveHandle(moveHandleOfTheYellowFlag, 'Space');

    // Assert: no reorder (the order did not change) and no take (Space on a handle is
    // "pick up" and "drop", never "take next").
    expect(
      fakeServer.listCommandsReceived(),
      'a row dropped where it was must send no command at all',
    ).toEqual([]);
  });

  it('tells a screen reader in pt-BR which row the dragged one is over, by the labels of the items', async () => {
    // Arrange: the main rundown with each row given a place.
    giveEachRundownRowAPlaceOnScreen();
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);
    const moveHandleOfTheStart = findMoveHandleOfItem('Largada do enduro');

    // Act: pick the start up from the keyboard and move it one row down.
    await pressKeyOnMoveHandle(moveHandleOfTheStart, 'Space');
    await pressKeyOnMoveHandle(moveHandleOfTheStart, 'ArrowDown');

    // Assert: the page's announcement area (what a screen reader reads out) says so in
    // pt-BR and names both items by their labels, not by their ids.
    expect(
      screen.getByRole('status'),
      'a move must be announced in pt-BR with the labels of the two items',
    ).toHaveTextContent('Item Largada do enduro sobre a posição de Bandeira amarela.');
    // (Then the row is dropped and the server answers, so nothing is left open or
    // waiting once the test is over.)
    await pressKeyOnMoveHandle(moveHandleOfTheStart, 'Space');
    fakeServer.acceptLastCommand();
  });

  it('disables the "Mover" handles while the connection is down', () => {
    // Arrange: the main rundown on a connected page.
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);

    // Act: the line drops.
    fakeServer.dropConnection();

    // Assert: no row can be picked up, because the new order could not be sent.
    expect(
      findMoveHandleOfItem('Largada do enduro'),
      'a row must not be draggable while the page cannot reach the server',
    ).toBeDisabled();
  });
});
