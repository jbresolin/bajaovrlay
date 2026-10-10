/**
 * Connection badge (apps/control)
 *
 * What this module is for:
 *   The control page only works while it can talk to the server. The badge in the
 *   header always says how that connection is doing, so the operator knows at a glance
 *   whether what is on screen is live or only the last thing the page heard.
 *
 * What these tests prove:
 *   - The badge reads "Conectando…" before the server answers, "Conectado" once it
 *     has, and "Reconectando…" after the line drops.
 *
 * What these tests deliberately do not cover:
 *   - Redialling after a drop; serverConnection.test.ts covers the waits between calls.
 *   - Disabling the buttons while disconnected; ActionButton.test.tsx covers that.
 *   - The badge colours; styling is checked by eye in the browser.
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  renderOnControlPageConnectedToFakeServer,
  renderOnControlPageStillWaitingForTheServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import { ConnectionBadge } from './ConnectionBadge';

describe('the connection badge', () => {
  it('reads "Conectando…" while the server has not answered yet', () => {
    // Arrange: nothing to prepare.

    // Act: draw the badge on a page still waiting for the server's hello.
    renderOnControlPageStillWaitingForTheServer(<ConnectionBadge />);

    // Assert: the badge says the page is connecting.
    expect(
      screen.getByRole('status', { name: 'Conexão com o servidor' }),
      'before the hello the badge must say the page is connecting',
    ).toHaveTextContent('Conectando…');
  });

  it('reads "Conectado" once the server has said hello', () => {
    // Arrange: nothing to prepare.

    // Act: draw the badge on a connected page.
    renderOnControlPageConnectedToFakeServer(<ConnectionBadge />, buildSlicesWithNothingOnAir());

    // Assert: the badge says the page is connected.
    expect(
      screen.getByRole('status', { name: 'Conexão com o servidor' }),
      'after the hello the badge must say the page is connected',
    ).toHaveTextContent('Conectado');
  });

  it('reads "Reconectando…" after the line drops', () => {
    // Arrange: the badge on a connected page.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <ConnectionBadge />,
      buildSlicesWithNothingOnAir(),
    );

    // Act: the line drops.
    fakeServer.dropConnection();

    // Assert: the badge says the page is trying to get back.
    expect(
      screen.getByRole('status', { name: 'Conexão com o servidor' }),
      'after a drop the badge must say the page is reconnecting',
    ).toHaveTextContent('Reconectando…');
  });
});
