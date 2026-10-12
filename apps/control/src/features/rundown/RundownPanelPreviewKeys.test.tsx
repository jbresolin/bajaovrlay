/**
 * Rundown panel: Space and Shift+Space with a preview (apps/control)
 *
 * What this module is for:
 *   With previews, the Space key has two ways of putting the next item on air. When the
 *   preview output shows the item at the cursor, Space sends that very preview to air
 *   (`takePreview`): what goes on air is what the operator was looking at. Otherwise it
 *   takes the item at the cursor as it always did (`takeNext`). Shift+Space shows the
 *   item at the cursor on the preview output (`previewItem`), for an operator who keeps
 *   "Prévia automática" off. Which command a key means is decided by one function
 *   (src/keyboard/commandForOperatorKey.ts); these tests prove the keys of the real page
 *   are wired to it, and that Shift+Space obeys the same guards as Space.
 *
 * What these tests prove:
 *   - Space sends `takePreview` for the previewed layer when the preview shows the cursor
 *     item, and `takeNext` when the preview shows another item.
 *   - A refused `takePreview` is explained once, under the "Prévia" monitor's lines.
 *   - Shift+Space sends `previewItem` for the cursor item and keeps the browser from
 *     scrolling the page; with the cursor on nothing it sends nothing and shows no error.
 *   - Shift+Space is left alone while the operator types in a text field, when held
 *     down, together with Ctrl, Alt or Meta, and while the connection is down.
 *
 * What these tests deliberately do not cover:
 *   - Every case of the rule, row by row: src/keyboard/commandForOperatorKey.test.ts.
 *   - Plain Space on buttons, dropdowns, switches and the "Mover" handle:
 *     RundownPanelKeyboard.test.tsx; those guards are the same listener.
 *   - Backspace, which belongs to the page as a whole: App.test.tsx.
 *   - The Right arrow previewing by itself: RundownPanelPreview.test.tsx.
 */
import type { Instance } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PreviewedLayersList } from '@/features/outputMonitors/PreviewedLayersList';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildRaceClockPreviewOfItem } from '@/state/previewLikeTheServerSends.testSupport';
import { buildSlicesWithTheEnduranceRundown } from '@/state/rundownLikeTheServerSends.testSupport';

import { RundownPanel } from './RundownPanel';

// The item editor has its own tests; a stand-in takes its place here.
vi.mock('@/features/items/ItemEditorPanel', () => import('./itemEditorStandIn.testSupport'));

const momentOfThePreview = '2026-10-10T12:58:00.000Z';

/**
 * Draws the rundown panel next to a text field (to press a key "while typing") and the
 * lines under the "Prévia" monitor, with the cursor and the instances the test names.
 */
function renderRundownPanelWithThesePreviews(cursorItemId: string | null, instances: Instance[]) {
  return renderOnControlPageConnectedToFakeServer(
    <>
      <input aria-label="Nome da sessão" />
      <PreviewedLayersList />
      <RundownPanel />
    </>,
    { ...buildSlicesWithTheEnduranceRundown(cursorItemId), instances },
  );
}

describe('the Space key with something on the preview output', () => {
  it('sends the preview to air when it shows the item at the cursor', () => {
    // Arrange: the cursor is on the start, and the start is what the preview shows.
    const { fakeServer } = renderRundownPanelWithThesePreviews('item-largada-do-enduro', [
      buildRaceClockPreviewOfItem('item-largada-do-enduro', momentOfThePreview),
    ]);

    // Act: press Space on the page.
    fireEvent.keyDown(document.body, { key: ' ' });

    // Assert: one takePreview for the clock layer, and no takeNext beside it.
    expect(
      fakeServer.listCommandsReceived(),
      'Space must send to air the very preview the operator is looking at, and nothing else',
    ).toEqual([{ type: 'takePreview', layerId: 'clock' }]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it('takes the item at the cursor when the preview shows another item', () => {
    // Arrange: the cursor is on the start, but the preview shows the yellow flag.
    const { fakeServer } = renderRundownPanelWithThesePreviews('item-largada-do-enduro', [
      buildRaceClockPreviewOfItem('item-bandeira-amarela', momentOfThePreview),
    ]);

    // Act: press Space on the page.
    fireEvent.keyDown(document.body, { key: ' ' });

    // Assert: the planned item is taken; the preview of the other item is left alone.
    expect(
      fakeServer.listCommandsReceived(),
      'Space must fire the item at the cursor, not whatever happens to be previewed',
    ).toEqual([{ type: 'takeNext', rundownId: 'sessao-principal' }]);
    fakeServer.acceptLastCommand();
  });

  it('explains a refused take of the preview once, under the lines of the "Prévia" monitor', async () => {
    // Arrange: the start is previewed and at the cursor, and Space was pressed.
    const { fakeServer } = renderRundownPanelWithThesePreviews('item-largada-do-enduro', [
      buildRaceClockPreviewOfItem('item-largada-do-enduro', momentOfThePreview),
    ]);
    fireEvent.keyDown(document.body, { key: ' ' });

    // Act: the server refuses: another operator discarded that preview a moment earlier.
    fakeServer.refuseLastCommand({
      code: 'LAYER_PREVIEW_EMPTY',
      message: 'Não há nada em prévia na camada "Relógio" para colocar no ar.',
    });

    // Assert: the reason is on screen, in one place only.
    expect(
      await screen.findAllByRole('alert'),
      'the refusal must be shown once, next to "Tomar", and not a second time in the rundown',
    ).toHaveLength(1);
    expect(
      screen.getByRole('alert'),
      'the refusal must be in the words of the server',
    ).toHaveTextContent('Não há nada em prévia na camada "Relógio" para colocar no ar.');
  });
});

describe('Shift+Space', () => {
  it('previews the item at the cursor and keeps the browser from scrolling the page', () => {
    // Arrange: the cursor is on the start and nothing is previewed.
    const { fakeServer } = renderRundownPanelWithThesePreviews('item-largada-do-enduro', []);

    // Act: press Shift+Space on the page. `fireEvent` answers false when something on the
    // page told the browser "do not also do your own thing with this key".
    const wasLeftToTheBrowser = fireEvent.keyDown(document.body, { key: ' ', shiftKey: true });

    // Assert: one previewItem for the start; nothing went on air; the page did not scroll.
    expect(
      fakeServer.listCommandsReceived(),
      'Shift+Space must show the item at the cursor on the preview output and take nothing',
    ).toEqual([{ type: 'previewItem', itemId: 'item-largada-do-enduro' }]);
    expect(
      wasLeftToTheBrowser,
      'a Shift+Space that previews must not also scroll the page up',
    ).toBe(false);
    fakeServer.acceptLastCommand();
  });

  it('sends nothing and shows no error when the cursor is on nothing', () => {
    // Arrange: the rundown after its last item was fired: the cursor is on nothing.
    const { fakeServer } = renderRundownPanelWithThesePreviews(null, []);

    // Act: press Shift+Space on the page.
    fireEvent.keyDown(document.body, { key: ' ', shiftKey: true });

    // Assert: there is no item to name, so nothing was sent; the panel's own hint about
    // placing the cursor is the explanation, not an error.
    expect(
      fakeServer.listCommandsReceived(),
      'with the cursor on nothing there is no item to preview, so nothing may be sent',
    ).toEqual([]);
    expect(screen.queryByRole('alert'), 'no error may be shown for it').toBeNull();
    expect(
      screen.getByText('Clique num item para posicionar o cursor'),
      'the panel must still tell the operator to place the cursor',
    ).toBeInTheDocument();
  });

  it('previews nothing while the operator types in a text field', () => {
    // Arrange: the cursor is on the start.
    const { fakeServer } = renderRundownPanelWithThesePreviews('item-largada-do-enduro', []);

    // Act: press Shift+Space inside the text field.
    const wasLeftToTheBrowser = fireEvent.keyDown(screen.getByLabelText('Nome da sessão'), {
      key: ' ',
      shiftKey: true,
    });

    // Assert: nothing was sent, and the browser types the space as usual.
    expect(
      fakeServer.listCommandsReceived(),
      'Shift+Space inside a text field types a space and must not preview',
    ).toEqual([]);
    expect(wasLeftToTheBrowser, 'the space must still be typed into the field').toBe(true);
  });

  const waysOfPressingShiftSpaceThatMustNotPreview = [
    // A key held down repeats many times a second: one press is one preview.
    { name: 'when the keys are held down', keyDetails: { repeat: true } },
    // Ctrl+Shift+Space and the like belong to the browser or the operating system.
    { name: 'together with Ctrl', keyDetails: { ctrlKey: true } },
    // Alt+Shift+Space.
    { name: 'together with Alt', keyDetails: { altKey: true } },
    // Cmd+Shift+Space.
    { name: 'together with Meta', keyDetails: { metaKey: true } },
  ];

  it.each(waysOfPressingShiftSpaceThatMustNotPreview)(
    'previews nothing $name',
    ({ keyDetails }) => {
      // Arrange: the cursor is on the start.
      const { fakeServer } = renderRundownPanelWithThesePreviews('item-largada-do-enduro', []);

      // Act: press Shift+Space on the page, in the way the scenario says.
      fireEvent.keyDown(document.body, { key: ' ', shiftKey: true, ...keyDetails });

      // Assert: nothing was sent.
      expect(
        fakeServer.listCommandsReceived(),
        'a held-down Shift+Space, or one with Ctrl, Alt or Meta, must not preview',
      ).toEqual([]);
    },
  );

  it('previews nothing while the connection is down', () => {
    // Arrange: the cursor is on the start, and the line dropped.
    const { fakeServer } = renderRundownPanelWithThesePreviews('item-largada-do-enduro', []);
    fakeServer.dropConnection();

    // Act: press Shift+Space on the page.
    fireEvent.keyDown(document.body, { key: ' ', shiftKey: true });

    // Assert: nothing was sent (it could not arrive anyway).
    expect(
      fakeServer.listCommandsReceived(),
      'Shift+Space must be switched off while the page is not connected',
    ).toEqual([]);
  });
});
