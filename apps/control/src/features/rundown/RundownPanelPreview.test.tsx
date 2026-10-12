/**
 * Rundown panel: previewing an item (apps/control)
 *
 * What this module is for:
 *   Nothing should go on air without being seen first. Every row of the rundown has a
 *   "Prévia" button that shows its item on the preview output (`previewItem`) without
 *   putting anything on air and without moving the cursor. And while the switch "Prévia
 *   automática" at the top of the rundown is on (it starts on), moving the cursor BY HAND
 *   also previews the item the cursor lands on, so the operator's loop is: Right arrow
 *   (look at it), Space (it goes on air).
 *
 *   "By hand" means this operator's own Right arrow, Left arrow or click on a row's
 *   label. A cursor that moves for another reason (a take moved it on, or another
 *   operator moved it) previews nothing: the page never sends a command the operator at
 *   this keyboard did not ask for. The switch is remembered in this browser, not on the
 *   server.
 *
 * What these tests prove:
 *   - "Prévia" on a row sends `previewItem` with the id of that row and nothing else; it
 *     is disabled while the connection is down; a refusal is shown in the panel.
 *   - With the switch on, the Right arrow, the Left arrow and a click on a label each
 *     send `moveCursor` and then, once the server has accepted it, `previewItem` for
 *     that same item. Before the server answers, and when it refuses, nothing is previewed.
 *   - A cursor moved by the server's news alone (a take, another operator) sends nothing.
 *   - The switch is drawn on, can be switched off, and then the arrow sends `moveCursor`
 *     only. It lets go of the keyboard focus after a click, so the arrows keep working.
 *   - The choice is remembered: a page opened later in the same browser starts with the
 *     switch as it was left.
 *   - In a browser that refuses to store anything the switch starts on and still works.
 *
 * What these tests deliberately do not cover:
 *   - Where the arrows are ignored and which item is next: RundownPanelCursor.test.tsx.
 *   - Space, Shift+Space and Backspace: RundownPanelPreviewKeys.test.tsx and
 *     src/keyboard/commandForOperatorKey.test.ts.
 *   - The storage functions case by case: autoPreviewSetting.test.ts.
 *   - What the server does with `previewItem`; apps/server's previewItem.test.ts.
 *   - The preview appearing in the "Prévia" monitor; e2e/previewThenTake.e2e.ts.
 */
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  type ControlPageOnFakeServer,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildMainRundown,
  buildSlicesWithTheEnduranceRundown,
} from '@/state/rundownLikeTheServerSends.testSupport';

import { RundownPanel } from './RundownPanel';

// The item editor has its own tests; a stand-in takes its place here.
vi.mock('@/features/items/ItemEditorPanel', () => import('./itemEditorStandIn.testSupport'));

const moveCursorToTheYellowFlag = {
  type: 'moveCursor',
  rundownId: 'sessao-principal',
  itemId: 'item-bandeira-amarela',
};
const previewTheYellowFlag = { type: 'previewItem', itemId: 'item-bandeira-amarela' };

/** Draws the rundown panel with the three endurance items and the cursor on the start. */
function renderRundownPanelWithTheCursorOnTheStart(): ControlPageOnFakeServer {
  return renderOnControlPageConnectedToFakeServer(
    <RundownPanel />,
    buildSlicesWithTheEnduranceRundown('item-largada-do-enduro'),
  );
}

/**
 * Gives the page a moment to do whatever it does after the server's answer (here: send
 * the preview, or not). Tests that expect NOTHING more to be sent wait this way first,
 * so "nothing was sent" is not just "nothing was sent yet".
 */
async function letThePageFinishWhatItStarted(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Makes every read and write of the browser's storage fail, as a browser that blocks it does. */
function makeBrowserStorageRefuseEverything() {
  const refuse = () => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  };
  const refusedRead = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse);
  const refusedWrite = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse);
  return {
    /** Gives the browser a working storage again, for the tests that follow. */
    letBrowserStorageWorkAgain: () => {
      refusedRead.mockRestore();
      refusedWrite.mockRestore();
    },
  };
}

describe('the "Prévia" button of a rundown row', () => {
  it('sends previewItem with the id of its row, and neither takes nor moves the cursor', () => {
    // Arrange: the main rundown with its cursor on the start.
    const { fakeServer } = renderRundownPanelWithTheCursorOnTheStart();
    const finishRow = within(screen.getByRole('listitem', { name: 'Chegada do enduro' }));

    // Act: press "Prévia" on the finish, two rows below the cursor.
    fireEvent.click(finishRow.getByRole('button', { name: 'Prévia' }));

    // Assert: one previewItem naming the finish; no take and no moveCursor.
    expect(
      fakeServer.listCommandsReceived(),
      '"Prévia" must only ask the server to show that row on the preview output',
    ).toEqual([{ type: 'previewItem', itemId: 'item-chegada-do-enduro' }]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout.)
    fakeServer.acceptLastCommand();
  });

  it('cannot be pressed while the connection is down', () => {
    // Arrange: the main rundown on a connected page.
    const { fakeServer } = renderRundownPanelWithTheCursorOnTheStart();

    // Act: the line drops.
    fakeServer.dropConnection();

    // Assert: the button is switched off, like every other button of the row.
    const finishRow = within(screen.getByRole('listitem', { name: 'Chegada do enduro' }));
    expect(
      finishRow.getByRole('button', { name: 'Prévia' }),
      'nothing can be previewed while the page cannot reach the server',
    ).toBeDisabled();
  });

  it("shows the server's pt-BR message in the panel when the preview is refused", async () => {
    // Arrange: "Prévia" was pressed on the yellow flag.
    const { fakeServer } = renderRundownPanelWithTheCursorOnTheStart();
    const yellowFlagRow = within(screen.getByRole('listitem', { name: 'Bandeira amarela' }));
    fireEvent.click(yellowFlagRow.getByRole('button', { name: 'Prévia' }));

    // Act: the server refuses, because the item's data does not fit its graphic.
    fakeServer.refuseLastCommand({
      code: 'INVALID_GRAPHIC_DATA',
      message:
        'Dados inválidos para o gráfico "race-clock": o campo "sessionName" é obrigatório e não foi enviado.',
    });

    // Assert: the reason is on screen, in the rundown panel.
    expect(
      await screen.findByRole('alert'),
      'a refused preview must be explained in the rundown panel, in the words of the server',
    ).toHaveTextContent(
      'Dados inválidos para o gráfico "race-clock": o campo "sessionName" é obrigatório e não foi enviado.',
    );
  });
});

describe('moving the cursor by hand while "Prévia automática" is on', () => {
  const waysOfMovingTheCursorToTheYellowFlag = [
    // The key of the operator's loop: one item forward.
    {
      name: 'the Right arrow',
      moveTheCursor: () => fireEvent.keyDown(document.body, { key: 'ArrowRight' }),
      cursorItemIdBefore: 'item-largada-do-enduro',
    },
    // One item back, to line an item up again: it is previewed again too.
    {
      name: 'the Left arrow',
      moveTheCursor: () => fireEvent.keyDown(document.body, { key: 'ArrowLeft' }),
      cursorItemIdBefore: 'item-chegada-do-enduro',
    },
    // Straight to a row with the mouse.
    {
      name: "a click on the row's label",
      moveTheCursor: () =>
        fireEvent.click(
          screen.getByRole('button', { name: 'Marcar como próximo: Bandeira amarela' }),
        ),
      cursorItemIdBefore: 'item-largada-do-enduro',
    },
  ];

  it.each(waysOfMovingTheCursorToTheYellowFlag)(
    '$name previews the item the cursor lands on, once the server accepted the move',
    async ({ moveTheCursor, cursorItemIdBefore }) => {
      // Arrange: the main rundown with its cursor one step away from the yellow flag (or
      // anywhere, for the click), and "Prévia automática" as it starts: on.
      const { fakeServer } = renderOnControlPageConnectedToFakeServer(
        <RundownPanel />,
        buildSlicesWithTheEnduranceRundown(cursorItemIdBefore),
      );

      // Act: move the cursor to the yellow flag; then the server accepts the move.
      moveTheCursor();
      const commandsBeforeTheServerAnswered = [...fakeServer.listCommandsReceived()];
      fakeServer.acceptLastCommand();

      // Assert: first only the moveCursor, and after the "ok" a previewItem for the same
      // item.
      expect(
        commandsBeforeTheServerAnswered,
        'until the server accepts the move, only moveCursor may have been sent',
      ).toEqual([moveCursorToTheYellowFlag]);
      await waitFor(() => {
        expect(
          fakeServer.listCommandsReceived(),
          'once the move is accepted the page must preview the item the cursor landed on',
        ).toEqual([moveCursorToTheYellowFlag, previewTheYellowFlag]);
      });
      fakeServer.acceptLastCommand();
    },
  );

  it('previews nothing when the server refuses to move the cursor', async () => {
    // Arrange: the Right arrow was pressed with the cursor on the start.
    const { fakeServer } = renderRundownPanelWithTheCursorOnTheStart();
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });

    // Act: the server refuses: another operator deleted the yellow flag a moment earlier.
    fakeServer.refuseLastCommand({
      code: 'ITEM_NOT_FOUND',
      message: 'O item "item-bandeira-amarela" não existe.',
    });
    await letThePageFinishWhatItStarted();

    // Assert: no preview followed, and the refusal is on screen.
    expect(
      fakeServer.listCommandsReceived(),
      'a cursor that did not move must not be followed by a preview',
    ).toEqual([moveCursorToTheYellowFlag]);
    expect(
      screen.getByRole('alert'),
      'the refused move must be explained in the panel',
    ).toHaveTextContent('O item "item-bandeira-amarela" não existe.');
  });

  it('previews nothing when the cursor moves without this operator moving it', async () => {
    // Arrange: the main rundown with its cursor on the start; nobody touches this page.
    const { fakeServer } = renderRundownPanelWithTheCursorOnTheStart();

    // Act: the server sends the rundown with its cursor on the yellow flag, as it does
    // after a take moved the cursor on, or after another operator pressed the Right arrow.
    fakeServer.sendMessage({
      type: 'slice',
      name: 'rundowns',
      slice: [buildMainRundown('item-bandeira-amarela')],
    });
    await letThePageFinishWhatItStarted();

    // Assert: the mark followed the server, and the page sent nothing at all.
    expect(
      screen.getByRole('listitem', { name: 'Bandeira amarela' }),
      'the mark must follow the cursor the server sent',
    ).toHaveAttribute('aria-current', 'true');
    expect(
      fakeServer.listCommandsReceived(),
      'a cursor moved by a take or by someone else must not make this page preview anything',
    ).toEqual([]);
  });
});

describe('the "Prévia automática" switch', () => {
  it('is drawn at the top of the rundown, switched on', () => {
    // Arrange: a browser that never saw the page.

    // Act: draw the panel.
    renderRundownPanelWithTheCursorOnTheStart();

    // Assert: the switch is there and on.
    expect(
      screen.getByRole('switch', { name: 'Prévia automática' }),
      '"Prévia automática" must start switched on',
    ).toBeChecked();
  });

  it('when switched off, lets the arrow move the cursor without previewing', async () => {
    // Arrange: the main rundown with its cursor on the start, and the switch clicked off.
    const { fakeServer } = renderRundownPanelWithTheCursorOnTheStart();
    fireEvent.click(screen.getByRole('switch', { name: 'Prévia automática' }));

    // Act: press the Right arrow, and the server accepts the move.
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    fakeServer.acceptLastCommand();
    await letThePageFinishWhatItStarted();

    // Assert: the switch is off, and the one command is the moveCursor.
    expect(
      screen.getByRole('switch', { name: 'Prévia automática' }),
      'a click must switch "Prévia automática" off',
    ).not.toBeChecked();
    expect(
      fakeServer.listCommandsReceived(),
      'with "Prévia automática" off an arrow must move the cursor and preview nothing',
    ).toEqual([moveCursorToTheYellowFlag]);
  });

  it('lets go of the keyboard focus after a click, so the arrow keys keep working', () => {
    // Arrange: the panel, with the focus on the switch, where a mouse click puts it.
    const { fakeServer } = renderRundownPanelWithTheCursorOnTheStart();
    const autoPreviewSwitch = screen.getByRole('switch', { name: 'Prévia automática' });
    autoPreviewSwitch.focus();
    const hadFocusBeforeTheClick = document.activeElement === autoPreviewSwitch;

    // Act: click the switch, then press the Right arrow without clicking anywhere else.
    fireEvent.click(autoPreviewSwitch);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'ArrowRight' });

    // Assert: the focus left the switch, so the arrow reached the rundown. (On a switch
    // the keys are left to the switch, which is why the focus must not stay there.)
    expect(hadFocusBeforeTheClick, 'the test must start with the focus on the switch').toBe(true);
    expect(autoPreviewSwitch, 'the switch must not keep the focus after a click').not.toHaveFocus();
    expect(
      fakeServer.listCommandsReceived(),
      'the arrow pressed right after the click must still move the cursor',
    ).toEqual([moveCursorToTheYellowFlag]);
    fakeServer.acceptLastCommand();
  });

  it('is remembered in the browser: a page opened later starts as it was left', () => {
    // Arrange: the operator switched "Prévia automática" off, and that page was closed.
    // (`cleanup` takes the drawn page away, which is what closing the tab does.)
    renderRundownPanelWithTheCursorOnTheStart();
    fireEvent.click(screen.getByRole('switch', { name: 'Prévia automática' }));
    cleanup();

    // Act: open the page again in the same browser.
    renderRundownPanelWithTheCursorOnTheStart();

    // Assert: the switch is still off.
    expect(
      screen.getByRole('switch', { name: 'Prévia automática' }),
      'a page opened later in the same browser must find "Prévia automática" as it was left',
    ).not.toBeChecked();
  });

  it('starts on and still works in a browser that refuses to store anything', async () => {
    // Arrange: a browser whose storage throws on every read and write.
    const browserStorage = makeBrowserStorageRefuseEverything();

    // Act: draw the panel, switch "Prévia automática" off, press the Right arrow, and the
    // server accepts the move.
    const { fakeServer } = renderRundownPanelWithTheCursorOnTheStart();
    const wasOnWhenThePageOpened =
      screen.getByRole('switch', { name: 'Prévia automática' }).getAttribute('aria-checked') ===
      'true';
    fireEvent.click(screen.getByRole('switch', { name: 'Prévia automática' }));
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    fakeServer.acceptLastCommand();
    await letThePageFinishWhatItStarted();
    browserStorage.letBrowserStorageWorkAgain();

    // Assert: the page drew, started with the default, and the switch did its job for
    // this page although nothing could be stored.
    expect(
      wasOnWhenThePageOpened,
      'without storage "Prévia automática" must start on, the default',
    ).toBe(true);
    expect(
      screen.getByRole('switch', { name: 'Prévia automática' }),
      'the switch must still switch off on a page that cannot store the choice',
    ).not.toBeChecked();
    expect(
      fakeServer.listCommandsReceived(),
      'the switched-off page must move the cursor without previewing, storage or not',
    ).toEqual([moveCursorToTheYellowFlag]);
  });
});
