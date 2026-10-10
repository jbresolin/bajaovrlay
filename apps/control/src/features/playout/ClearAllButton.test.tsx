/**
 * Clear all button (apps/control)
 *
 * What this module is for:
 *   "Limpar tudo" is the panic button: it takes every graphic off every layer at once.
 *   It is always on screen and red. Because one stray click would blank the stream's
 *   graphics, it asks for a second press within 3 seconds before doing anything. The
 *   Esc key presses the same button.
 *
 * What these tests prove:
 *   - The first press sends nothing and turns the label into "Confirmar: limpar tudo".
 *   - A second press within 3 seconds sends `clearAll`, once, and the label goes back.
 *   - Without a second press the button resets after 3 seconds, and a later press
 *     counts as a first press again.
 *   - Esc counts as a press, alone or mixed with a click; a held-down Esc counts once.
 *   - While the page is not connected the button is disabled and says why, and Esc does
 *     nothing.
 *
 * What these tests deliberately do not cover:
 *   - What the server does with `clearAll`; the server's own tests cover that.
 *   - The real clock: time is moved by hand, so "3 seconds" takes no time to test.
 *   - The red colour; styling is checked by eye in the browser.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  focusAreaAroundDisabledButton,
  letTimePassOnThePage,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithTheRaceClockOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { ClearAllButton } from './ClearAllButton';

/** Draws the button on a connected page that has the race clock on air. */
function renderClearAllButtonOnConnectedPage() {
  return renderOnControlPageConnectedToFakeServer(
    <ClearAllButton />,
    buildSlicesWithTheRaceClockOnAir('2026-10-10T13:00:00.000Z'),
  );
}

/** Presses the Esc key with the focus on the page itself, not in any field. */
function pressEscapeKey() {
  fireEvent.keyDown(document.body, { key: 'Escape' });
}

describe('the clear all button', () => {
  it('sends nothing on the first press and asks for confirmation instead', () => {
    // Arrange: the button on a connected page.
    vi.useFakeTimers();
    const { fakeServer } = renderClearAllButtonOnConnectedPage();

    // Act: press it once.
    fireEvent.click(screen.getByRole('button', { name: 'Limpar tudo' }));

    // Assert: no command left the page, and the button now asks to confirm.
    expect(fakeServer.listCommandsReceived(), 'one press alone must not clear anything').toEqual(
      [],
    );
    expect(
      screen.getByRole('button', { name: 'Confirmar: limpar tudo' }),
      'after the first press the button must ask for confirmation',
    ).toBeInTheDocument();
  });

  it('sends clearAll once on a second press within 3 seconds', () => {
    // Arrange: the button already pressed once.
    vi.useFakeTimers();
    const { fakeServer } = renderClearAllButtonOnConnectedPage();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar tudo' }));

    // Act: 2.9 seconds later, press it again.
    letTimePassOnThePage(2_900);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: limpar tudo' }));

    // Assert: exactly one clearAll was sent, and the button is back to its first label.
    expect(
      fakeServer.listCommandsReceived(),
      'the second press must send clearAll, exactly once',
    ).toEqual([{ type: 'clearAll' }]);
    expect(
      screen.getByRole('button', { name: 'Limpar tudo' }),
      'after confirming, the button must be ready for a new first press',
    ).toBeInTheDocument();
    fakeServer.acceptLastCommand();
  });

  it('resets after 3 seconds, so a late second press only counts as a first press', () => {
    // Arrange: the button already pressed once.
    vi.useFakeTimers();
    const { fakeServer } = renderClearAllButtonOnConnectedPage();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar tudo' }));

    // Act: let the 3 seconds run out, then press again.
    letTimePassOnThePage(3_000);
    const labelAfterThreeSeconds = screen.getByRole('button').textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Limpar tudo' }));

    // Assert: the label had gone back, nothing was sent, and it asks to confirm again.
    expect(labelAfterThreeSeconds, 'the confirmation must expire after 3 seconds').toBe(
      'Limpar tudo',
    );
    expect(
      fakeServer.listCommandsReceived(),
      'a press after the confirmation expired must not clear anything',
    ).toEqual([]);
    expect(
      screen.getByRole('button', { name: 'Confirmar: limpar tudo' }),
      'the late press must start a new confirmation',
    ).toBeInTheDocument();
  });

  it('sends clearAll when Esc is pressed twice within 3 seconds', () => {
    // Arrange: the button on a connected page.
    vi.useFakeTimers();
    const { fakeServer } = renderClearAllButtonOnConnectedPage();

    // Act: press Esc, wait a second, press Esc again.
    pressEscapeKey();
    const commandsAfterTheFirstEscape = fakeServer.listCommandsReceived();
    letTimePassOnThePage(1_000);
    pressEscapeKey();

    // Assert: the first Esc only armed the button; the second one cleared everything.
    expect(commandsAfterTheFirstEscape, 'one Esc alone must not clear anything').toEqual([]);
    expect(fakeServer.listCommandsReceived(), 'the second Esc must send clearAll, once').toEqual([
      { type: 'clearAll' },
    ]);
    fakeServer.acceptLastCommand();
  });

  it('accepts Esc as the first press and a click as the second', () => {
    // Arrange: the button on a connected page.
    vi.useFakeTimers();
    const { fakeServer } = renderClearAllButtonOnConnectedPage();

    // Act: press Esc, then click the button that now asks to confirm.
    pressEscapeKey();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: limpar tudo' }));

    // Assert: the two presses together cleared everything.
    expect(
      fakeServer.listCommandsReceived(),
      'Esc and the button are the same action, so they confirm each other',
    ).toEqual([{ type: 'clearAll' }]);
    fakeServer.acceptLastCommand();
  });

  it('counts a held-down Esc as one press, not as its own confirmation', () => {
    // Arrange: the button on a connected page.
    vi.useFakeTimers();
    const { fakeServer } = renderClearAllButtonOnConnectedPage();

    // Act: press Esc and keep it down; the keyboard repeats the key by itself.
    pressEscapeKey();
    fireEvent.keyDown(document.body, { key: 'Escape', repeat: true });
    fireEvent.keyDown(document.body, { key: 'Escape', repeat: true });

    // Assert: nothing was cleared; the button is still waiting for a real second press.
    expect(
      fakeServer.listCommandsReceived(),
      'a key repeating by itself must never confirm a clear all',
    ).toEqual([]);
    expect(
      screen.getByRole('button', { name: 'Confirmar: limpar tudo' }),
      'the button must still be asking for confirmation',
    ).toBeInTheDocument();
  });

  it('is disabled and says why while the connection is down, and Esc does nothing', async () => {
    // Arrange: the button on a connected page.
    const { fakeServer } = renderClearAllButtonOnConnectedPage();

    // Act: the line drops; the operator reaches for the button and presses Esc twice.
    fakeServer.dropConnection();
    const clearAllButton = screen.getByRole('button', { name: 'Limpar tudo' });
    focusAreaAroundDisabledButton(clearAllButton);
    pressEscapeKey();
    pressEscapeKey();

    // Assert: the button cannot be pressed, explains itself, and nothing was sent.
    expect(clearAllButton, 'clear all cannot work without a connection').toBeDisabled();
    expect(
      await screen.findByRole('tooltip'),
      'the tooltip must tell the operator why the button is disabled',
    ).toHaveTextContent('Sem conexão com o servidor. Os comandos voltam quando ela voltar.');
    expect(
      fakeServer.listCommandsReceived(),
      'Esc must not try to send anything while disconnected',
    ).toEqual([]);
  });
});
