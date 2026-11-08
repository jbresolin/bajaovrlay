/**
 * Who is logged in, in the header (apps/control)
 *
 * What this module is for:
 *   The header always says who operates this page (BAJAOVRLAY-29): "Produtor · Mesa 1" with
 *   "Sair" beside it while the PINs are set, or "Sem login" while they are not, so nobody
 *   forgets that anyone on the network may then operate the show.
 *
 * What these tests prove:
 *   - With the login off, the header says "Sem login" and offers no "Sair".
 *   - Logged in, it names the role and station, and "Sair" ends the session on the server
 *     before the page goes back to "#/entrar".
 *
 * What these tests deliberately do not cover:
 *   - The server's DELETE /api/v1/session; apps/server's operatorLoginRoutes.test.ts.
 */
import type { SessionAnswer } from '@bajaovrlay/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OperatorSessionProvider } from '@/state/operatorSessionContext';

import { OperatorBadge } from './OperatorBadge';

/** Draws the header's badge with the server's answer about the login. */
function renderBadgeWith(sessionAnswer: SessionAnswer) {
  const logOut = vi.fn(() => Promise.resolve());
  const onLoggedOut = vi.fn();
  render(
    <OperatorSessionProvider sessionAnswer={sessionAnswer}>
      <OperatorBadge logOut={logOut} onLoggedOut={onLoggedOut} />
    </OperatorSessionProvider>,
  );
  return { logOut, onLoggedOut };
}

describe('the operator badge', () => {
  it('says "Sem login" while no PINs are set', () => {
    // Arrange: nothing beyond the page of a server with no PINs.

    // Act: draw the badge.
    renderBadgeWith({ isLoginRequired: false, session: null });

    // Assert: "Sem login", and no "Sair".
    expect(screen.getByText('Sem login'), 'the header must say the page is open').toBeVisible();
    expect(screen.queryByRole('button', { name: 'Sair' }), 'nothing to leave').toBeNull();
  });

  it('names the role and station, and "Sair" ends the session before going to the login', async () => {
    // Arrange: the Produtor logged in at "Mesa 1".
    const { logOut, onLoggedOut } = renderBadgeWith({
      isLoginRequired: true,
      session: { role: 'produtor', station: 'Mesa 1', expiresAt: '2026-11-08T05:00:00.000Z' },
    });

    // Act: press "Sair".
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));

    // Assert: the role and station are shown; the server is told before the page leaves.
    expect(screen.getByText('Produtor · Mesa 1'), 'who operates this page').toBeVisible();
    await waitFor(() => expect(onLoggedOut, 'the page goes to the login').toHaveBeenCalled());
    expect(logOut, 'the server ends the session first').toHaveBeenCalledTimes(1);
  });
});
