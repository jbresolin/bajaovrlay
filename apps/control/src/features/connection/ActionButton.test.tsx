/**
 * Action button (apps/control)
 *
 * What this module is for:
 *   The control page only works while it can talk to the server. ActionButton is the
 *   button every command uses ("Colocar no ar", "Limpar", "Limpar tudo"): while the
 *   connection is down it disables itself and explains why in a tooltip, so the
 *   operator never presses something that silently does nothing.
 *
 * What these tests prove:
 *   - The button works normally while connected, with no tooltip in the way.
 *   - While connecting or reconnecting it is disabled and its tooltip gives the reason.
 *   - A button its owner disabled for another reason stays disabled when connected.
 *
 * What these tests deliberately do not cover:
 *   - Showing the tooltip on mouse hover: the tests reach the button with the keyboard
 *     focus instead, which opens the same tooltip without needing a real mouse.
 *   - The commands the buttons send; each button's own test file covers its command.
 */
import { fireEvent, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  focusAreaAroundDisabledButton,
  renderOnControlPageConnectedToFakeServer,
  renderOnControlPageStillWaitingForTheServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { ActionButton } from './ActionButton';

/** Draws the button on a page that has dialled the server and not heard from it yet. */
function renderOnPageStillConnecting(actionButton: ReactElement): void {
  renderOnControlPageStillWaitingForTheServer(actionButton);
}

/** Draws the button on a page that was connected and then lost the line. */
function renderOnPageThatLostItsConnection(actionButton: ReactElement): void {
  const { fakeServer } = renderOnControlPageConnectedToFakeServer(
    actionButton,
    buildSlicesWithNothingOnAir(),
  );
  fakeServer.dropConnection();
}

describe('an action button', () => {
  it('can be pressed while the page is connected', () => {
    // Arrange: a button that notes each press, on a connected page.
    const notePress = vi.fn();
    renderOnControlPageConnectedToFakeServer(
      <ActionButton onClick={notePress}>Colocar no ar</ActionButton>,
      buildSlicesWithNothingOnAir(),
    );

    // Act: press it.
    fireEvent.click(screen.getByRole('button', { name: 'Colocar no ar' }));

    // Assert: the press went through, and no tooltip is shown.
    expect(notePress, 'a connected page must let the press through').toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('tooltip'), 'a working button needs no explanation').toBeNull();
  });

  const disconnectedScenarios = [
    // The page has just opened and the server has not answered yet.
    {
      name: 'while the page is still connecting',
      renderOnDisconnectedPage: renderOnPageStillConnecting,
    },
    // The page was working and the line dropped.
    {
      name: 'while the page is reconnecting',
      renderOnDisconnectedPage: renderOnPageThatLostItsConnection,
    },
  ];

  it.each(disconnectedScenarios)(
    'is disabled and explains why $name',
    async ({ renderOnDisconnectedPage }) => {
      // Arrange: a button that notes each press, on a page in the scenario's state.
      const notePress = vi.fn();
      renderOnDisconnectedPage(<ActionButton onClick={notePress}>Colocar no ar</ActionButton>);

      // Act: the operator tries to press the button, then rests on it to see why it
      // did nothing (in that order: a click on a tooltip's owner closes the tooltip).
      const button = screen.getByRole('button', { name: 'Colocar no ar' });
      fireEvent.click(button);
      focusAreaAroundDisabledButton(button);

      // Assert: the button is disabled, the press went nowhere, and the tooltip says why.
      expect(button, 'the button must be disabled without a connection').toBeDisabled();
      expect(notePress, 'a disabled button must not let the press through').not.toHaveBeenCalled();
      expect(
        await screen.findByRole('tooltip'),
        'the tooltip must give the reason in pt-BR',
      ).toHaveTextContent('Sem conexão com o servidor. Os comandos voltam quando ela voltar.');
    },
  );

  it('stays disabled on a connected page when its owner disabled it', () => {
    // Arrange: a button its owner switched off (for example, while a form is being sent).
    renderOnControlPageConnectedToFakeServer(
      <ActionButton disabled>Colocar no ar</ActionButton>,
      buildSlicesWithNothingOnAir(),
    );

    // Act: nothing; the button is only looked at.

    // Assert: being connected does not switch it back on.
    expect(
      screen.getByRole('button', { name: 'Colocar no ar' }),
      'the connection must never enable a button its owner disabled',
    ).toBeDisabled();
  });
});
