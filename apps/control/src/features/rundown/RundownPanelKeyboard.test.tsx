/**
 * Rundown panel: the Space and Right arrow keys (apps/control)
 *
 * What this module is for:
 *   During a show the operator fires the rundown from the keyboard: Space puts the item
 *   at the cursor on air (`takeNext`), and the Right arrow moves the cursor one item
 *   forward without putting anything on air (`moveCursor`), to skip an item.
 *
 * What these tests prove:
 *   - Space sends `takeNext` for the rundown on screen, and stops the browser from also
 *     scrolling the page. With no cursor it still sends: the server decides and explains.
 *   - Space is left alone while the operator types in a field, while the focus is on a
 *     button (there, Space presses that button), when the key is held down, with
 *     Ctrl/Alt/Meta, and while the connection is down.
 *   - The Right arrow sends `moveCursor` to the item after the cursor; to the first item
 *     when there is no cursor; and nothing on the last item or in an empty rundown.
 *   - The Right arrow is left alone while the operator types in a field.
 *
 * What these tests deliberately do not cover:
 *   - Which item comes after the cursor in every case; itemAfterCursor.test.ts does.
 *   - The cursor moving after a take: the server does that, and the panel only shows it
 *     (RundownPanel.test.tsx).
 *   - Esc and Backspace, which belong to features/playout and are tested in App.test.tsx.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithTheEnduranceRundown } from '@/state/rundownLikeTheServerSends.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { RundownPanel } from './RundownPanel';

// The item editor has its own tests; a stand-in takes its place here.
vi.mock('@/features/items/ItemEditorPanel', () => import('./itemEditorStandIn.testSupport'));

/**
 * Draws the rundown panel next to one text field, like the session name field of the
 * take panel, so a test can press a key "while typing".
 */
function renderRundownPanelNextToATextField(cursorItemId: string | null) {
  return renderOnControlPageConnectedToFakeServer(
    <>
      <input aria-label="Nome da sessão" />
      <RundownPanel />
    </>,
    buildSlicesWithTheEnduranceRundown(cursorItemId),
  );
}

describe('the Space key', () => {
  it('sends takeNext for the rundown on screen', () => {
    // Arrange: the main rundown with its cursor on the start.
    const { fakeServer } = renderRundownPanelNextToATextField('item-largada-do-enduro');

    // Act: press Space with the focus on the page itself.
    fireEvent.keyDown(document.body, { key: ' ' });

    // Assert: one takeNext naming the rundown; the server knows where the cursor is.
    expect(
      fakeServer.listCommandsReceived(),
      'Space outside a field must take the item at the cursor of the rundown on screen',
    ).toEqual([{ type: 'takeNext', rundownId: 'sessao-principal' }]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it('stops the browser from scrolling the page when it takes', () => {
    // Arrange: the main rundown with its cursor on the start.
    const { fakeServer } = renderRundownPanelNextToATextField('item-largada-do-enduro');

    // Act: press Space on the page. `fireEvent` answers false when something on the page
    // told the browser "do not also do your own thing with this key".
    const wasLeftToTheBrowser = fireEvent.keyDown(document.body, { key: ' ' });

    // Assert: the browser was told not to use the key (it would scroll the page down).
    expect(
      wasLeftToTheBrowser,
      'a Space that takes must not also scroll the page under the operator',
    ).toBe(false);
    fakeServer.acceptLastCommand();
  });

  it('still sends takeNext when there is no cursor, and shows the reason the server gives', async () => {
    // Arrange: the main rundown after its last item was fired: nothing is next.
    const { fakeServer } = renderRundownPanelNextToATextField(null);

    // Act: press Space, and the server refuses because the cursor is empty.
    fireEvent.keyDown(document.body, { key: ' ' });
    fakeServer.refuseLastCommand({
      code: 'RUNDOWN_CURSOR_EMPTY',
      message: 'O rundown não tem próximo item. Escolha um item antes de disparar.',
    });

    // Assert: the page did not decide by itself; it asked, and shows the server's answer.
    expect(
      fakeServer.listCommandsReceived(),
      'the page must ask the server even with no cursor, because the server owns the cursor',
    ).toEqual([{ type: 'takeNext', rundownId: 'sessao-principal' }]);
    expect(
      await screen.findByRole('alert'),
      'the refusal must be explained in the rundown panel in pt-BR',
    ).toHaveTextContent('O rundown não tem próximo item. Escolha um item antes de disparar.');
  });

  it('takes nothing while the operator types in a text field', () => {
    // Arrange: the main rundown with its cursor on the start.
    const { fakeServer } = renderRundownPanelNextToATextField('item-largada-do-enduro');

    // Act: press Space inside the text field, as when typing "Enduro de Resistência".
    fireEvent.keyDown(screen.getByLabelText('Nome da sessão'), { key: ' ' });

    // Assert: nothing was sent; a space in a name must never fire the rundown.
    expect(
      fakeServer.listCommandsReceived(),
      'Space inside a text field types a space and must not take',
    ).toEqual([]);
  });

  it('takes nothing while the focus is on a button, where Space presses that button', () => {
    // Arrange: the main rundown with its cursor on the start.
    const { fakeServer } = renderRundownPanelNextToATextField('item-largada-do-enduro');
    const yellowFlagRow = within(screen.getByRole('listitem', { name: 'Bandeira amarela' }));

    // Act: press Space with the focus on the "Editar" button of the yellow flag row. (The
    // browser then presses that button by itself; that part is the browser's, not ours.)
    fireEvent.keyDown(yellowFlagRow.getByRole('button', { name: 'Editar' }), { key: ' ' });

    // Assert: no take was sent; one press must not do two things.
    expect(
      fakeServer.listCommandsReceived(),
      'Space on a focused button belongs to that button and must not also take',
    ).toEqual([]);
  });

  const waysOfPressingSpaceThatMustNotTake = [
    // A key held down repeats many times a second: one press is one take.
    { name: 'when the key is held down', keyDetails: { repeat: true } },
    // Ctrl+Space and the like belong to the browser or the operating system.
    { name: 'together with Ctrl', keyDetails: { ctrlKey: true } },
    // Alt+Space opens the window menu on Windows.
    { name: 'together with Alt', keyDetails: { altKey: true } },
    // Cmd+Space opens the search on a Mac.
    { name: 'together with Meta', keyDetails: { metaKey: true } },
  ];

  it.each(waysOfPressingSpaceThatMustNotTake)('takes nothing $name', ({ keyDetails }) => {
    // Arrange: the main rundown with its cursor on the start.
    const { fakeServer } = renderRundownPanelNextToATextField('item-largada-do-enduro');

    // Act: press Space on the page itself, in the way the scenario says.
    fireEvent.keyDown(document.body, { key: ' ', ...keyDetails });

    // Assert: nothing was sent.
    expect(
      fakeServer.listCommandsReceived(),
      'a held-down Space, or Space with Ctrl, Alt or Meta, must not take',
    ).toEqual([]);
  });

  it('takes nothing while the connection is down', () => {
    // Arrange: the main rundown with its cursor on the start, and the line dropped.
    const { fakeServer } = renderRundownPanelNextToATextField('item-largada-do-enduro');
    fakeServer.dropConnection();

    // Act: press Space on the page.
    fireEvent.keyDown(document.body, { key: ' ' });

    // Assert: nothing was sent (it could not arrive anyway).
    expect(
      fakeServer.listCommandsReceived(),
      'Space must be switched off while the page is not connected',
    ).toEqual([]);
  });
});

describe('the Right arrow key', () => {
  const rightArrowScenarios = [
    // The everyday case: skip the item that is next.
    {
      name: 'moves the cursor from the first item to the second',
      cursorItemId: 'item-largada-do-enduro',
      expectedCommands: [
        { type: 'moveCursor', rundownId: 'sessao-principal', itemId: 'item-bandeira-amarela' },
      ],
    },
    // Nothing is next (the last item was fired): the arrow starts again at the top.
    {
      name: 'moves the cursor to the first item when there is no cursor',
      cursorItemId: null,
      expectedCommands: [
        { type: 'moveCursor', rundownId: 'sessao-principal', itemId: 'item-largada-do-enduro' },
      ],
    },
    // The end of the list: the cursor stays; it does not wrap round to the opening.
    {
      name: 'sends nothing when the cursor is on the last item',
      cursorItemId: 'item-chegada-do-enduro',
      expectedCommands: [],
    },
  ];

  it.each(rightArrowScenarios)('$name', ({ cursorItemId, expectedCommands }) => {
    // Arrange: the main rundown with its cursor where the scenario says.
    const { fakeServer } = renderRundownPanelNextToATextField(cursorItemId);

    // Act: press the Right arrow with the focus on the page itself.
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });

    // Assert: the expected moveCursor, or nothing; and never a take.
    expect(
      fakeServer.listCommandsReceived(),
      'the Right arrow must move the cursor one item forward and never put anything on air',
    ).toEqual(expectedCommands);
  });

  it('sends nothing in a rundown with no items', () => {
    // Arrange: a server right after its first boot: the seeded rundown, no items.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <RundownPanel />,
      buildSlicesWithNothingOnAir(),
    );

    // Act: press the Right arrow on the page.
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });

    // Assert: there is no item to move the cursor to.
    expect(
      fakeServer.listCommandsReceived(),
      'the Right arrow must do nothing in an empty rundown',
    ).toEqual([]);
  });

  it('moves nothing while the operator types in a text field', () => {
    // Arrange: the main rundown with its cursor on the start.
    const { fakeServer } = renderRundownPanelNextToATextField('item-largada-do-enduro');

    // Act: press the Right arrow inside the text field, as when moving through a name.
    fireEvent.keyDown(screen.getByLabelText('Nome da sessão'), { key: 'ArrowRight' });

    // Assert: the cursor of the rundown was left alone.
    expect(
      fakeServer.listCommandsReceived(),
      'the Right arrow inside a text field moves the text caret, not the rundown cursor',
    ).toEqual([]);
  });
});
