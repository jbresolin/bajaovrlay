/**
 * Rundown panel: the Esc key while a row is being dragged (apps/control)
 *
 * What this module is for:
 *   Esc means two things on the control page. While a rundown row is being dragged it
 *   means "cancel this drag". Everywhere else it is the panic key: the first Esc arms
 *   "Limpar tudo" and a second one within 3 seconds takes every graphic off air. An Esc
 *   that cancels a drag must do only that; it must never also count as a panic press.
 *
 * What these tests prove:
 *   - Esc pressed while a row is held with the mouse but has not moved yet (the press
 *     that may still become a drag) leaves "Limpar tudo" unarmed and sends nothing.
 *   - Esc pressed while a row is being dragged with the mouse does the same, and the
 *     drag is still cancelled (the page announces that the row stays where it was).
 *   - Two Esc presses during one drag still send nothing: the second cannot confirm.
 *   - Once the drag is over, Esc is the panic key again: it arms "Limpar tudo".
 *   - A handle that was only clicked (pressed and released without moving) leaves Esc
 *     as the panic key too.
 *
 * How, and why this way:
 *   The mouse is played by pointer events sent by hand: a press on the "Mover" handle,
 *   then a move on the page. The test browser (jsdom) draws nothing, so the rows never
 *   really move; that does not matter here, because only the Esc key is being checked.
 *   The clear all button is drawn next to the panel, as on the real page.
 *
 * What these tests deliberately do not cover:
 *   - Where a dragged row lands, and what a drop sends (RundownPanelReorder.test.tsx).
 *   - Esc during a keyboard drag: there dnd-kit itself marks the key as used.
 *   - Everything else about the clear all button (ClearAllButton.test.tsx).
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ClearAllButton } from '@/features/playout/ClearAllButton';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithTheEnduranceRundown } from '@/state/rundownLikeTheServerSends.testSupport';

import { RundownPanel } from './RundownPanel';

// The item editor has its own tests; a stand-in takes its place here.
vi.mock('@/features/items/ItemEditorPanel', () => import('./itemEditorStandIn.testSupport'));

// Where on the page the mouse goes down, and how far it travels to start a drag (a move
// of 4 px or more is a drag; 30 px is about half a row).
const mouseStartsAt = { clientX: 20, clientY: 20 };
const mouseAfterMovingDownHalfARow = { clientX: 20, clientY: 50 };

/** Draws the rundown panel and the clear all button together, as the page has them. */
function renderRundownPanelNextToTheClearAllButton() {
  return renderOnControlPageConnectedToFakeServer(
    <>
      <RundownPanel />
      <ClearAllButton />
    </>,
    buildSlicesWithTheEnduranceRundown('item-largada-do-enduro'),
  );
}

/** Finds the "Mover" handle on the row of the item with this label. */
function findMoveHandleOfItem(itemLabel: string): HTMLElement {
  const row = within(screen.getByRole('listitem', { name: itemLabel }));
  return row.getByRole('button', { name: 'Mover' });
}

/** Presses the main mouse button down on a handle and keeps it down. */
function pressMouseDownOnHandle(moveHandle: HTMLElement): void {
  fireEvent.pointerDown(moveHandle, { ...mouseStartsAt, isPrimary: true, button: 0 });
}

/** Moves the held mouse half a row down, which is far enough to start a drag. */
function moveHeldMouseDownHalfARow(): void {
  fireEvent.pointerMove(document, { ...mouseAfterMovingDownHalfARow, isPrimary: true });
}

/** Lets go of the mouse button without having moved the mouse: a plain click. */
function releaseMouseWhereItWentDown(): void {
  fireEvent.pointerUp(document, { ...mouseStartsAt, isPrimary: true, button: 0 });
}

/** Presses Esc with the focus on the page itself, as an operator holding the mouse does. */
function pressEscapeKey(): void {
  fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
}

/** Reads what the clear all button says: "Limpar tudo", or "Confirmar: limpar tudo" when armed. */
function readClearAllButtonText(): string | null {
  return screen.getByRole('button', { name: /limpar tudo/i }).textContent;
}

describe('Esc while a rundown row is held or dragged with the mouse', () => {
  it('does not arm clear all when the row is held but has not moved yet', () => {
    // Arrange: the rundown next to the clear all button, with the mouse pressed down on
    // the handle of the start and not moved.
    const { fakeServer } = renderRundownPanelNextToTheClearAllButton();
    pressMouseDownOnHandle(findMoveHandleOfItem('Largada do enduro'));

    // Act: press Esc to give up before dragging.
    pressEscapeKey();

    // Assert: the panic button is as it was and nothing was sent.
    expect(readClearAllButtonText(), 'an Esc that gives up a held row must not arm clear all').toBe(
      'Limpar tudo',
    );
    expect(
      fakeServer.listCommandsReceived(),
      'an Esc that gives up a held row must send no command',
    ).toEqual([]);
  });

  it('does not arm clear all when it cancels a drag in progress', () => {
    // Arrange: the start picked up with the mouse and dragged half a row down.
    const { fakeServer } = renderRundownPanelNextToTheClearAllButton();
    pressMouseDownOnHandle(findMoveHandleOfItem('Largada do enduro'));
    moveHeldMouseDownHalfARow();
    const announcementWhileDragging = screen.getByRole('status').textContent;

    // Act: press Esc to cancel the drag.
    pressEscapeKey();

    // Assert: a drag really was going on (the page had announced the row as lifted and
    // hanging over its own place), it was cancelled, and that is all; the panic button
    // is not armed.
    expect(
      announcementWhileDragging,
      'the mouse must really have picked the row up before Esc was pressed',
    ).toBe('Item Largada do enduro no lugar de onde saiu.');
    expect(
      screen.getByRole('status'),
      'the Esc must still cancel the drag, and the page must say so',
    ).toHaveTextContent('Item Largada do enduro continua onde estava.');
    expect(readClearAllButtonText(), 'an Esc that cancels a drag must not arm clear all').toBe(
      'Limpar tudo',
    );
    expect(
      fakeServer.listCommandsReceived(),
      'an Esc that cancels a drag must send no command, neither a reorder nor a clear',
    ).toEqual([]);
  });

  it('sends nothing when Esc is pressed twice while the mouse still holds the row', () => {
    // Arrange: the start picked up with the mouse and dragged half a row down. Two Esc
    // presses in a row are exactly what would take everything off air if the first one
    // armed the panic button.
    const { fakeServer } = renderRundownPanelNextToTheClearAllButton();
    pressMouseDownOnHandle(findMoveHandleOfItem('Largada do enduro'));
    moveHeldMouseDownHalfARow();

    // Act: press Esc, and once more right away.
    pressEscapeKey();
    const clearAllButtonTextAfterTheFirstEscape = readClearAllButtonText();
    pressEscapeKey();

    // Assert: the first Esc cancelled the drag without arming, so the second one is only
    // a first panic press: it arms, and nothing has been cleared.
    expect(
      clearAllButtonTextAfterTheFirstEscape,
      'the Esc that cancels the drag must leave clear all unarmed',
    ).toBe('Limpar tudo');
    expect(
      fakeServer.listCommandsReceived(),
      'two Esc presses, the first of which cancelled a drag, must not clear everything',
    ).toEqual([]);
  });
});

describe('Esc after the mouse let go of the row', () => {
  it('arms clear all again once a drag has been cancelled', () => {
    // Arrange: a drag of the start that was cancelled with Esc.
    const { fakeServer } = renderRundownPanelNextToTheClearAllButton();
    pressMouseDownOnHandle(findMoveHandleOfItem('Largada do enduro'));
    moveHeldMouseDownHalfARow();
    pressEscapeKey();

    // Act: press Esc again, now with no drag going on.
    pressEscapeKey();

    // Assert: Esc is the panic key again. It arms and, being a first press, clears nothing.
    expect(
      readClearAllButtonText(),
      'with no drag going on, Esc must arm clear all as it always did',
    ).toBe('Confirmar: limpar tudo');
    expect(fakeServer.listCommandsReceived(), 'one panic press alone must clear nothing').toEqual(
      [],
    );
  });

  it('arms clear all after a handle was only clicked, not dragged', () => {
    // Arrange: the handle of the start pressed and released without moving the mouse.
    renderRundownPanelNextToTheClearAllButton();
    pressMouseDownOnHandle(findMoveHandleOfItem('Largada do enduro'));
    releaseMouseWhereItWentDown();

    // Act: press Esc.
    pressEscapeKey();

    // Assert: the click left nothing behind; Esc is the panic key.
    expect(
      readClearAllButtonText(),
      'a click on a handle must not keep Esc away from clear all afterwards',
    ).toBe('Confirmar: limpar tudo');
  });
});
