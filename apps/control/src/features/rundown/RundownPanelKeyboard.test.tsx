/**
 * Rundown panel: the Space key (apps/control)
 *
 * What this module is for:
 *   During a show the operator fires the rundown from the keyboard: Space puts the item
 *   at the cursor on air (`takeNext`). By João's ruling Space ALWAYS does that, also when
 *   the last mouse click left the focus on a button: the key takes, and the button under
 *   the focus is not pressed. The few places where Space keeps another job are the ones
 *   where the operator is plainly doing something else with it.
 *
 * What these tests prove:
 *   - Space sends `takeNext` for the rundown on screen, and stops the browser from also
 *     scrolling the page. With no cursor it still sends: the server decides and explains.
 *   - With the focus on "Disparar", on "Editar item" or on "Limpar tudo", Space sends
 *     `takeNext` and nothing else, and the browser is told, at the press and at the
 *     release of the key, not to press that button.
 *   - Space is left alone while the operator types in a text field; on a closed dropdown
 *     (there it opens the dropdown); on an option of an open dropdown (there it picks the
 *     option); and on the "Relógio correndo" switch (there it flips the switch).
 *   - Space on a row's "Mover" handle picks the row up for a keyboard drag and takes
 *     nothing, because the drag used the key first.
 *   - Space takes nothing when the key is held down, with Ctrl/Alt/Meta, and while the
 *     connection is down.
 *   - "Disparar" gives the focus away after a click, so the focus does not sit on it.
 *
 * What these tests deliberately do not cover:
 *   - A real browser pressing a focused button at Space. The test browser (jsdom) never
 *     does that by itself, so here the proof is that the browser was TOLD not to;
 *     e2e/rundownTakeWithSpace.e2e.ts presses Space on a focused button in Chromium.
 *   - Space while the preview output shows the item at the cursor (it then sends that
 *     preview to air instead of `takeNext`), and Shift+Space: RundownPanelPreviewKeys.test.tsx.
 *     Nothing is previewed in any test of this file.
 *   - The arrow keys and the click on a row's label (RundownPanelCursor.test.tsx).
 *   - Dropping the row again after a keyboard pick-up (RundownPanelReorder.test.tsx).
 *   - Esc and Backspace, which belong to features/playout and are tested in App.test.tsx.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LayerStatusPanel } from '@/features/layers/LayerStatusPanel';
import { ClearAllButton } from '@/features/playout/ClearAllButton';
import { QuickEditPanel } from '@/features/playout/QuickEditPanel';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithTheEnduranceRundown } from '@/state/rundownLikeTheServerSends.testSupport';
import { buildRaceClockInstanceOnTheClockLayer } from '@/state/slicesLikeTheServerSends.testSupport';

import { RundownPanel } from './RundownPanel';

// The item editor has its own tests; a stand-in takes its place here.
vi.mock('@/features/items/ItemEditorPanel', () => import('./itemEditorStandIn.testSupport'));

const takeNextOfTheMainRundown = { type: 'takeNext', rundownId: 'sessao-principal' };

/**
 * Draws the rundown panel with its neighbours on the real page: the race clock on air,
 * loaded into "Edição rápida" with the "Editar" of its Camadas row so the panel shows its
 * form (a text field, dropdowns and a switch), and the "Limpar tudo" button.
 */
function renderRundownPanelWithItsNeighbours(cursorItemId: string | null) {
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <>
      <QuickEditPanel />
      <LayerStatusPanel />
      <ClearAllButton />
      <RundownPanel />
    </>,
    {
      ...buildSlicesWithTheEnduranceRundown(cursorItemId),
      instances: [buildRaceClockInstanceOnTheClockLayer('2026-10-10T13:00:00.000Z')],
    },
  );
  const clockLayerRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
  fireEvent.click(clockLayerRow.getByRole('button', { name: 'Editar' }));
  return controlPage;
}

/** Finds a button on the row of the item with this label. */
function findButtonOnTheRowOfItem(itemLabel: string, buttonName: string): HTMLElement {
  const row = within(screen.getByRole('listitem', { name: itemLabel }));
  return row.getByRole('button', { name: buttonName });
}

describe('the Space key', () => {
  it('sends takeNext for the rundown on screen', () => {
    // Arrange: the main rundown with its cursor on the start.
    const { fakeServer } = renderRundownPanelWithItsNeighbours('item-largada-do-enduro');

    // Act: press Space with the focus on the page itself.
    fireEvent.keyDown(document.body, { key: ' ' });

    // Assert: one takeNext naming the rundown; the server knows where the cursor is.
    expect(
      fakeServer.listCommandsReceived(),
      'Space outside a field must take the item at the cursor of the rundown on screen',
    ).toEqual([takeNextOfTheMainRundown]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it('stops the browser from scrolling the page when it takes', () => {
    // Arrange: the main rundown with its cursor on the start.
    const { fakeServer } = renderRundownPanelWithItsNeighbours('item-largada-do-enduro');

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
    const { fakeServer } = renderRundownPanelWithItsNeighbours(null);

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
    ).toEqual([takeNextOfTheMainRundown]);
    expect(
      await screen.findByRole('alert'),
      'the refusal must be explained in the rundown panel in pt-BR',
    ).toHaveTextContent('O rundown não tem próximo item. Escolha um item antes de disparar.');
  });
});

describe('the Space key while the focus is on a button', () => {
  const buttonsThatSpaceMustNotPress = [
    // The button the operator clicks most: pressed again by Space, it would fire that
    // row a second time instead of the next item.
    {
      name: '"Disparar" of another row',
      findTheButton: () => findButtonOnTheRowOfItem('Bandeira amarela', 'Disparar'),
    },
    // Pressed by Space, "Editar item" would open the editor in the middle of the show.
    {
      name: '"Editar item" of a row',
      findTheButton: () => findButtonOnTheRowOfItem('Bandeira amarela', 'Editar item'),
    },
    // The dangerous one: two Spaces on the panic button would blank the stream.
    {
      name: '"Limpar tudo"',
      findTheButton: () => screen.getByRole('button', { name: 'Limpar tudo' }),
    },
  ];

  it.each(buttonsThatSpaceMustNotPress)(
    'takes the next item and keeps the browser from pressing $name',
    ({ findTheButton }) => {
      // Arrange: the main rundown with its cursor on the start, and the focus on the
      // button, as a mouse click leaves it.
      const { fakeServer } = renderRundownPanelWithItsNeighbours('item-largada-do-enduro');
      const focusedButton = findTheButton();
      focusedButton.focus();

      // Act: press Space and let it go. A browser presses a focused button when Space is
      // released, unless it was told at the press or at the release to leave the key alone.
      const wasPressLeftToTheBrowser = fireEvent.keyDown(focusedButton, { key: ' ' });
      const wasReleaseLeftToTheBrowser = fireEvent.keyUp(focusedButton, { key: ' ' });

      // Assert: exactly one takeNext, and nothing of what the three buttons would do:
      // no takeItem, no editor on screen, "Limpar tudo" not armed.
      expect(
        fakeServer.listCommandsReceived(),
        'Space on a focused button must take the next item and send nothing else',
      ).toEqual([takeNextOfTheMainRundown]);
      expect(
        wasPressLeftToTheBrowser,
        'the browser must be told at the press not to use Space on the focused button',
      ).toBe(false);
      expect(
        wasReleaseLeftToTheBrowser,
        'the browser must be told at the release not to press the focused button',
      ).toBe(false);
      expect(
        screen.queryByRole('region', { name: 'Editor de item' }),
        'Space must not open the item editor',
      ).toBeNull();
      expect(
        screen.getByRole('button', { name: 'Limpar tudo' }),
        'Space must not arm the panic button',
      ).toBeInTheDocument();
      fakeServer.acceptLastCommand();
    },
  );
});

describe('the Space key where it keeps another job', () => {
  it('takes nothing while the operator types in a text field', () => {
    // Arrange: the main rundown with its cursor on the start.
    const { fakeServer } = renderRundownPanelWithItsNeighbours('item-largada-do-enduro');

    // Act: press Space inside the text field, as when typing "Enduro de Resistência".
    const wasLeftToTheBrowser = fireEvent.keyDown(screen.getByLabelText('Título'), {
      key: ' ',
    });

    // Assert: nothing was sent, and the browser types the space as usual.
    expect(
      fakeServer.listCommandsReceived(),
      'Space inside a text field types a space and must not take',
    ).toEqual([]);
    expect(wasLeftToTheBrowser, 'the space must still be typed into the field').toBe(true);
  });

  it('takes nothing on the "Relógio correndo" switch, where Space flips the switch', () => {
    // Arrange: the main rundown with its cursor on the start.
    const { fakeServer } = renderRundownPanelWithItsNeighbours('item-largada-do-enduro');
    const runningSwitch = screen.getByRole('switch', { name: 'Relógio correndo' });

    // Act: press Space on the switch and let it go.
    const wasPressLeftToTheBrowser = fireEvent.keyDown(runningSwitch, { key: ' ' });
    const wasReleaseLeftToTheBrowser = fireEvent.keyUp(runningSwitch, { key: ' ' });

    // Assert: no take, and the key is left to the switch, which the browser then flips.
    expect(
      fakeServer.listCommandsReceived(),
      'Space on a switch belongs to the switch and must not take',
    ).toEqual([]);
    expect(wasPressLeftToTheBrowser, 'the press must be left to the switch').toBe(true);
    expect(wasReleaseLeftToTheBrowser, 'the release must be left to the switch').toBe(true);
  });

  it('takes nothing on a closed dropdown, where Space opens the dropdown', () => {
    // Arrange: the main rundown with its cursor on the start.
    const { fakeServer } = renderRundownPanelWithItsNeighbours('item-largada-do-enduro');

    // Act: press Space on the flag dropdown.
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Bandeira' }), { key: ' ' });

    // Assert: no take; the dropdown opened and shows its options.
    expect(
      fakeServer.listCommandsReceived(),
      'Space on a dropdown belongs to the dropdown and must not take',
    ).toEqual([]);
    expect(
      screen.getByRole('option', { name: 'Verde' }),
      'Space must still open the dropdown it was pressed on',
    ).toBeInTheDocument();
  });

  it('takes nothing on an option of an open dropdown, where Space picks the option', () => {
    // Arrange: the main rundown with its cursor on the start, and the flag dropdown open.
    const { fakeServer } = renderRundownPanelWithItsNeighbours('item-largada-do-enduro');
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Bandeira' }), { key: 'Enter' });

    // Act: press Space on the option "Verde".
    fireEvent.keyDown(screen.getByRole('option', { name: 'Verde' }), { key: ' ' });

    // Assert: no take; the dropdown picked the green flag.
    expect(
      fakeServer.listCommandsReceived(),
      'Space inside an open dropdown belongs to the dropdown and must not take',
    ).toEqual([]);
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }),
      'Space must still pick the option it was pressed on',
    ).toHaveTextContent('Verde');
  });

  it('picks the row up on a "Mover" handle and takes nothing', async () => {
    // Arrange: the main rundown with its cursor on the start.
    const { fakeServer } = renderRundownPanelWithItsNeighbours('item-largada-do-enduro');
    const moveHandleOfTheYellowFlag = findButtonOnTheRowOfItem('Bandeira amarela', 'Mover');

    // Act: press Space on the handle. `code` is the physical key, which is what the
    // drag library reads; `key` is what the Space shortcut reads.
    fireEvent.keyDown(moveHandleOfTheYellowFlag, { code: 'Space', key: ' ' });

    // Assert: the row was picked up (the handle then says "pressed" to a screen reader;
    // the drag library marks it a moment after the key), and no take was sent: the drag
    // used the key first, so the shortcut stood back.
    await waitFor(() => {
      expect(
        moveHandleOfTheYellowFlag,
        'Space on the handle must pick the row up for a keyboard drag',
      ).toHaveAttribute('aria-pressed', 'true');
    });
    expect(
      fakeServer.listCommandsReceived(),
      'Space on the "Mover" handle is "pick up" and must not also take',
    ).toEqual([]);
  });
});

describe('the Space key when it must do nothing at all', () => {
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
    const { fakeServer } = renderRundownPanelWithItsNeighbours('item-largada-do-enduro');

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
    const { fakeServer } = renderRundownPanelWithItsNeighbours('item-largada-do-enduro');
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

describe('the "Disparar" button and the keyboard focus', () => {
  it('gives the focus away after a click, so the focus does not sit on the button', () => {
    // Arrange: the main rundown, with the focus on "Disparar" of the finish row, where a
    // mouse click puts it.
    const { fakeServer } = renderRundownPanelWithItsNeighbours('item-largada-do-enduro');
    const takeButtonOfTheFinish = findButtonOnTheRowOfItem('Chegada do enduro', 'Disparar');
    takeButtonOfTheFinish.focus();
    const hadFocusBeforeTheClick = document.activeElement === takeButtonOfTheFinish;

    // Act: click it.
    fireEvent.click(takeButtonOfTheFinish);

    // Assert: the take was sent and the button no longer has the focus.
    expect(hadFocusBeforeTheClick, 'the test must start with the focus on the button').toBe(true);
    expect(
      fakeServer.listCommandsReceived(),
      '"Disparar" must still send takeItem for its row',
    ).toEqual([{ type: 'takeItem', itemId: 'item-chegada-do-enduro' }]);
    expect(
      takeButtonOfTheFinish,
      '"Disparar" must not keep the focus after a click',
    ).not.toHaveFocus();
    fakeServer.acceptLastCommand();
  });
});
