/**
 * Rundown panel: opening and closing the item editor (apps/control)
 *
 * What this module is for:
 *   Items are prepared in the item editor. The rundown panel decides when the editor is
 *   on screen and what for: "+ Item" opens it for a new item at the end of the rundown,
 *   "Editar item" on a row opens it for that row's item, and the editor asks to be closed
 *   when the operator saves or cancels.
 *
 * What these tests prove:
 *   - The editor is not on screen until asked for.
 *   - "+ Item" opens it for a new item, telling it which rundown the item goes into.
 *   - "Editar item" opens it for the item of that row.
 *   - When the editor asks to be closed, it leaves the screen.
 *   - If the item being edited is deleted meanwhile (by another operator), the editor
 *     leaves the screen instead of editing something that no longer exists.
 *   - Opening the editor sends no command: nothing changes on the server until a save.
 *
 * What these tests deliberately do not cover:
 *   - The editor itself (its fields, and the createItem / updateItemFields it sends):
 *     a stand-in takes its place here, and features/items/ has the real one's tests.
 *   - The list, the row buttons and the keys; see the other RundownPanel*.test.tsx files.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithTheEnduranceRundown } from '@/state/rundownLikeTheServerSends.testSupport';

import { RundownPanel } from './RundownPanel';

// The stand-in writes one line saying what it was opened for and has a "Fechar editor"
// button that asks to be closed, as the real editor does after a save or a cancel.
vi.mock('@/features/items/ItemEditorPanel', () => import('./itemEditorStandIn.testSupport'));

describe('the item editor in the rundown panel', () => {
  it('is not on screen until the operator asks for it', () => {
    // Arrange: the main rundown with its three endurance items.
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');

    // Act: draw the panel and touch nothing.
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);

    // Assert: there is no editor area.
    expect(
      screen.queryByRole('region', { name: 'Editor de item' }),
      'the editor must stay off screen until "+ Item" or "Editar item" is pressed',
    ).toBeNull();
  });

  it('opens for a new item in the rundown on screen when "+ Item" is pressed', () => {
    // Arrange: the panel showing the main rundown.
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);

    // Act: press "+ Item".
    fireEvent.click(screen.getByRole('button', { name: '+ Item' }));

    // Assert: the editor is open for a new item of that rundown, and nothing was sent.
    const editorArea = within(screen.getByRole('region', { name: 'Editor de item' }));
    expect(
      editorArea.getByText('Editor aberto para um novo item no rundown sessao-principal'),
      'the editor must be opened for a new item and told the id of the rundown on screen',
    ).toBeInTheDocument();
    expect(
      fakeServer.listCommandsReceived(),
      'opening the editor must not send any command',
    ).toEqual([]);
  });

  it('opens for the item of the row whose "Editar item" is pressed', () => {
    // Arrange: the panel showing the main rundown.
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);

    // Act: press "Editar item" on the yellow flag row.
    const yellowFlagRow = within(screen.getByRole('listitem', { name: 'Bandeira amarela' }));
    fireEvent.click(yellowFlagRow.getByRole('button', { name: 'Editar item' }));

    // Assert: the editor is open for the yellow flag item, and nothing was sent.
    const editorArea = within(screen.getByRole('region', { name: 'Editor de item' }));
    expect(
      editorArea.getByText('Editor aberto para o item Bandeira amarela'),
      'the editor must be opened for the item of the row that was pressed',
    ).toBeInTheDocument();
    expect(
      fakeServer.listCommandsReceived(),
      'opening the editor must not send any command',
    ).toEqual([]);
  });

  it('leaves the screen when the editor asks to be closed', () => {
    // Arrange: the panel with the editor open for a new item.
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);
    fireEvent.click(screen.getByRole('button', { name: '+ Item' }));

    // Act: the editor asks to be closed, as after a save the server accepted or a cancel.
    fireEvent.click(screen.getByRole('button', { name: 'Fechar editor' }));

    // Assert: the editor area is gone and the rundown is still there.
    expect(
      screen.queryByRole('region', { name: 'Editor de item' }),
      'the editor must leave the screen once it asks to be closed',
    ).toBeNull();
    expect(
      screen.getAllByRole('listitem'),
      'closing the editor must leave the three rows of the rundown in place',
    ).toHaveLength(3);
  });

  it('switches to the other item when "Editar item" is pressed on another row', () => {
    // Arrange: the panel with the editor open for the yellow flag.
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);
    const yellowFlagRow = within(screen.getByRole('listitem', { name: 'Bandeira amarela' }));
    fireEvent.click(yellowFlagRow.getByRole('button', { name: 'Editar item' }));

    // Act: press "Editar item" on the finish row.
    const finishRow = within(screen.getByRole('listitem', { name: 'Chegada do enduro' }));
    fireEvent.click(finishRow.getByRole('button', { name: 'Editar item' }));

    // Assert: one editor, now for the finish.
    const editorArea = within(screen.getByRole('region', { name: 'Editor de item' }));
    expect(
      editorArea.getByText('Editor aberto para o item Chegada do enduro'),
      'the editor must show the item of the row pressed last',
    ).toBeInTheDocument();
  });

  it('leaves the screen when the item being edited is deleted on the server', () => {
    // Arrange: the panel with the editor open for the yellow flag.
    const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<RundownPanel />, slices);
    const yellowFlagRow = within(screen.getByRole('listitem', { name: 'Bandeira amarela' }));
    fireEvent.click(yellowFlagRow.getByRole('button', { name: 'Editar item' }));

    // Act: the server sends the items without the yellow flag (another operator deleted it).
    const itemsWithoutTheYellowFlag = slices.items.filter(
      (item) => item.id !== 'item-bandeira-amarela',
    );
    fakeServer.sendMessage({ type: 'slice', name: 'items', slice: itemsWithoutTheYellowFlag });

    // Assert: there is no editor left open on an item that does not exist.
    expect(
      screen.queryByRole('region', { name: 'Editor de item' }),
      'the editor must not stay open for an item the server no longer has',
    ).toBeNull();
  });
});
