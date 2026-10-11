/**
 * Rundown panel: moving the cursor by hand (apps/control)
 *
 * What this module is for:
 *   The cursor marks the item Space puts on air next. A take moves it on by itself; the
 *   operator moves it by hand in three ways, none of which puts anything on air: the
 *   Right arrow (one item forward, to skip one), the Left arrow (one item back, to line
 *   one up again) and a click on a row's label (straight to that row).
 *
 * What these tests prove:
 *   - The Right arrow sends `moveCursor` to the item after the cursor; to the first item
 *     when there is no cursor; and nothing on the last item or in an empty rundown.
 *   - The Left arrow sends `moveCursor` to the item before the cursor; to the LAST item
 *     when there is no cursor; and nothing on the first item or in an empty rundown.
 *   - Both arrows are left alone while the operator types in a text field, when held
 *     down, and together with Ctrl, Alt or Meta.
 *   - Both arrows still work while the focus is on a button, such as the label that was
 *     just clicked.
 *   - A row's label is a button named "Marcar como próximo: <label>". Clicking it sends
 *     `moveCursor` with the id of that row and nothing else: no take, no editor.
 *   - The page moves no mark by itself: the mark follows the server's next rundowns slice.
 *
 * What these tests deliberately do not cover:
 *   - Which item is before or after the cursor in every case; itemBeforeCursor.test.ts
 *     and itemAfterCursor.test.ts do.
 *   - The Space key (RundownPanelKeyboard.test.tsx).
 *   - The arrows during a keyboard drag, where they move the dragged row
 *     (RundownPanelReorder.test.tsx).
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildMainRundown,
  buildSlicesWithTheEnduranceRundown,
} from '@/state/rundownLikeTheServerSends.testSupport';
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

/** Reads the labels of the rows that are marked as the next item (the cursor). */
function listItemLabelsMarkedAsNext(): (string | null)[] {
  return screen
    .getAllByRole('listitem')
    .filter((row) => row.getAttribute('aria-current') === 'true')
    .map((row) => row.getAttribute('aria-label'));
}

describe('the Right and Left arrow keys', () => {
  const arrowScenarios = [
    // Right, the everyday case: skip the item that is next.
    {
      name: 'the Right arrow moves the cursor from the first item to the second',
      arrowKey: 'ArrowRight',
      cursorItemId: 'item-largada-do-enduro',
      expectedCommands: [
        { type: 'moveCursor', rundownId: 'sessao-principal', itemId: 'item-bandeira-amarela' },
      ],
    },
    // Right with nothing next (the last item was fired): start again at the top.
    {
      name: 'the Right arrow moves the cursor to the first item when there is no cursor',
      arrowKey: 'ArrowRight',
      cursorItemId: null,
      expectedCommands: [
        { type: 'moveCursor', rundownId: 'sessao-principal', itemId: 'item-largada-do-enduro' },
      ],
    },
    // Right at the end of the list: the cursor stays; it does not wrap round to the top.
    {
      name: 'the Right arrow sends nothing when the cursor is on the last item',
      arrowKey: 'ArrowRight',
      cursorItemId: 'item-chegada-do-enduro',
      expectedCommands: [],
    },
    // Left, the everyday case: line up again the item that was just fired.
    {
      name: 'the Left arrow moves the cursor from the second item back to the first',
      arrowKey: 'ArrowLeft',
      cursorItemId: 'item-bandeira-amarela',
      expectedCommands: [
        { type: 'moveCursor', rundownId: 'sessao-principal', itemId: 'item-largada-do-enduro' },
      ],
    },
    // Left with nothing next: the cursor is past the end, so one step back is the last item.
    {
      name: 'the Left arrow moves the cursor to the last item when there is no cursor',
      arrowKey: 'ArrowLeft',
      cursorItemId: null,
      expectedCommands: [
        { type: 'moveCursor', rundownId: 'sessao-principal', itemId: 'item-chegada-do-enduro' },
      ],
    },
    // Left at the top of the list: the cursor stays; it does not wrap round to the bottom.
    {
      name: 'the Left arrow sends nothing when the cursor is on the first item',
      arrowKey: 'ArrowLeft',
      cursorItemId: 'item-largada-do-enduro',
      expectedCommands: [],
    },
  ];

  it.each(arrowScenarios)('$name', ({ arrowKey, cursorItemId, expectedCommands }) => {
    // Arrange: the main rundown with its cursor where the scenario says.
    const { fakeServer } = renderRundownPanelNextToATextField(cursorItemId);

    // Act: press the arrow with the focus on the page itself.
    fireEvent.keyDown(document.body, { key: arrowKey });

    // Assert: the expected moveCursor, or nothing; and never a take.
    expect(
      fakeServer.listCommandsReceived(),
      'an arrow must move the cursor one item, stop at the end of the list and never put anything on air',
    ).toEqual(expectedCommands);
  });

  const arrowKeys = [
    // Forward.
    { arrowName: 'the Right arrow', arrowKey: 'ArrowRight' },
    // Back. Every guard below must hold for both, so each is run once per key.
    { arrowName: 'the Left arrow', arrowKey: 'ArrowLeft' },
  ];

  it.each(arrowKeys)('$arrowName sends nothing in a rundown with no items', ({ arrowKey }) => {
    // Arrange: a server right after its first boot: the seeded rundown, no items.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <RundownPanel />,
      buildSlicesWithNothingOnAir(),
    );

    // Act: press the arrow on the page.
    fireEvent.keyDown(document.body, { key: arrowKey });

    // Assert: there is no item to move the cursor to.
    expect(
      fakeServer.listCommandsReceived(),
      'an arrow must do nothing in an empty rundown',
    ).toEqual([]);
  });

  it.each(arrowKeys)(
    '$arrowName moves nothing while the operator types in a text field',
    ({ arrowKey }) => {
      // Arrange: the main rundown with its cursor on the yellow flag, in the middle.
      const { fakeServer } = renderRundownPanelNextToATextField('item-bandeira-amarela');

      // Act: press the arrow inside the text field, as when moving through a name.
      fireEvent.keyDown(screen.getByLabelText('Nome da sessão'), { key: arrowKey });

      // Assert: the cursor of the rundown was left alone.
      expect(
        fakeServer.listCommandsReceived(),
        'an arrow inside a text field moves the text caret, not the rundown cursor',
      ).toEqual([]);
    },
  );

  it.each(arrowKeys)(
    '$arrowName moves nothing when held down or pressed with Ctrl',
    ({ arrowKey }) => {
      // Arrange: the main rundown with its cursor on the yellow flag, in the middle.
      const { fakeServer } = renderRundownPanelNextToATextField('item-bandeira-amarela');

      // Act: the key repeating by itself, then the key with Ctrl (a browser shortcut).
      fireEvent.keyDown(document.body, { key: arrowKey, repeat: true });
      fireEvent.keyDown(document.body, { key: arrowKey, ctrlKey: true });

      // Assert: neither moved the cursor; a held key must not run through the rundown.
      expect(
        fakeServer.listCommandsReceived(),
        'a held-down arrow, or an arrow with Ctrl, must not move the cursor',
      ).toEqual([]);
    },
  );

  it.each(arrowKeys)(
    '$arrowName still moves the cursor while the focus is on a button',
    ({ arrowKey }) => {
      // Arrange: the main rundown with its cursor on the yellow flag, and the focus on
      // that row's label, where a click on the label leaves it.
      const { fakeServer } = renderRundownPanelNextToATextField('item-bandeira-amarela');
      const labelOfTheYellowFlag = screen.getByRole('button', {
        name: 'Marcar como próximo: Bandeira amarela',
      });
      labelOfTheYellowFlag.focus();

      // Act: press the arrow with the focus still on the label.
      fireEvent.keyDown(labelOfTheYellowFlag, { key: arrowKey });

      // Assert: one moveCursor. An arrow has no job of its own on a button, so nothing
      // is lost by letting it through, and the operator need not click elsewhere first.
      expect(
        fakeServer.listCommandsReceived(),
        'an arrow must move the cursor even when the last click left the focus on a button',
      ).toHaveLength(1);
      expect(
        fakeServer.listCommandsReceived()[0],
        'the one command must be a moveCursor of the rundown on screen',
      ).toMatchObject({ type: 'moveCursor', rundownId: 'sessao-principal' });
    },
  );
});

describe("a click on a row's label", () => {
  it('sends moveCursor with the id of that row, and neither takes nor opens the editor', () => {
    // Arrange: the main rundown with its cursor on the start.
    const { fakeServer } = renderRundownPanelNextToATextField('item-largada-do-enduro');
    const finishRow = within(screen.getByRole('listitem', { name: 'Chegada do enduro' }));

    // Act: click the label of the finish, two rows further down.
    fireEvent.click(
      finishRow.getByRole('button', { name: 'Marcar como próximo: Chegada do enduro' }),
    );

    // Assert: one moveCursor naming the finish; nothing went on air and no editor opened.
    expect(
      fakeServer.listCommandsReceived(),
      'a click on a label must only ask the server to put the cursor on that row',
    ).toEqual([
      { type: 'moveCursor', rundownId: 'sessao-principal', itemId: 'item-chegada-do-enduro' },
    ]);
    expect(
      screen.queryByRole('region', { name: 'Editor de item' }),
      'a click on a label must not open the item editor',
    ).toBeNull();
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it('shows the label as the text of the button, so the row still reads as before', () => {
    // Arrange: the main rundown with its cursor on the start.
    renderRundownPanelNextToATextField('item-largada-do-enduro');

    // Act: find the label button of the yellow flag row.
    const labelOfTheYellowFlag = screen.getByRole('button', {
      name: 'Marcar como próximo: Bandeira amarela',
    });

    // Assert: what the eye reads is the plain label; the longer name is for a screen reader.
    expect(
      labelOfTheYellowFlag,
      'the label button must show the label the operator gave the item',
    ).toHaveTextContent('Bandeira amarela');
  });

  it('leaves the mark where the server has it until the server sends the new cursor', () => {
    // Arrange: the main rundown with its cursor on the start, and the label of the
    // finish clicked.
    const { fakeServer } = renderRundownPanelNextToATextField('item-largada-do-enduro');
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como próximo: Chegada do enduro' }));
    const rowsMarkedRightAfterTheClick = listItemLabelsMarkedAsNext();

    // Act: the server accepts and sends the rundown with its cursor on the finish.
    fakeServer.acceptLastCommand();
    fakeServer.sendMessage({
      type: 'slice',
      name: 'rundowns',
      slice: [buildMainRundown('item-chegada-do-enduro')],
    });

    // Assert: the page waited for the server, then followed it.
    expect(
      rowsMarkedRightAfterTheClick,
      'right after the click the mark must still be where the server last had it',
    ).toEqual(['Largada do enduro']);
    expect(
      listItemLabelsMarkedAsNext(),
      'once the server sends the new cursor the mark must be on the clicked row',
    ).toEqual(['Chegada do enduro']);
  });

  it('cannot be clicked while the connection is down', () => {
    // Arrange: the main rundown on a connected page.
    const { fakeServer } = renderRundownPanelNextToATextField('item-largada-do-enduro');

    // Act: the line drops.
    fakeServer.dropConnection();

    // Assert: the label is still readable but is switched off, like every other button.
    expect(
      screen.getByRole('button', { name: 'Marcar como próximo: Chegada do enduro' }),
      'the cursor cannot be moved while the page cannot reach the server',
    ).toBeDisabled();
  });
});
