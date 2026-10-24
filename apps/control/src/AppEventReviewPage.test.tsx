/**
 * The "Eventos" page in the frame of the control page (apps/control)
 *
 * What this module is for:
 *   The event inbox has a review page of its own, "#/eventos" (gate 2 of PR #22), opened
 *   from the header's "Eventos" in a new tab, as "Fontes" and "Cadastros" are, so the
 *   console never unmounts under the producer and the review can sit on a second screen.
 *
 * What these tests prove:
 *   - "Eventos" in the header is a link to "#/eventos" that opens in a new tab.
 *   - The page opened at "#/eventos" shows the review page under the same header, with
 *     the history of the inbox.
 *
 * What these tests deliberately do not cover:
 *   - What the page shows and does; features/events/EventReviewPage.test.tsx.
 */
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { renderOnControlPageConnectedToFakeServer } from './state/controlPageOnFakeServer.testSupport';
import {
  buildPendingPenaltyOfCar47,
  buildSlicesWithTheInbox,
} from './state/eventsLikeTheServerSends.testSupport';

describe('the "Eventos" link in the header', () => {
  it('opens "#/eventos" in a new tab', () => {
    // Arrange: the console.
    window.location.hash = '';
    renderOnControlPageConnectedToFakeServer(<App />, buildSlicesWithTheInbox([]));

    // Act: find "Eventos" in the header.
    const header = within(screen.getByRole('navigation', { name: 'Páginas do controle' }));
    const eventsLink = header.getByRole('link', { name: 'Eventos' });

    // Assert: a link to the page, in a new tab with no way back into this one.
    expect(eventsLink, '"Eventos" leads to the review page').toHaveAttribute('href', '#/eventos');
    expect(eventsLink, 'in a new tab').toHaveAttribute('target', '_blank');
    expect(eventsLink, 'that cannot reach back').toHaveAttribute('rel', 'noopener');
  });
});

describe('the page at "#/eventos"', () => {
  it('shows the review page with the history, under the header', () => {
    // Arrange: the address the new tab opens, car 47's penalty in the inbox.
    window.location.hash = '#/eventos';

    // Act: draw the whole control page.
    renderOnControlPageConnectedToFakeServer(
      <App />,
      buildSlicesWithTheInbox([buildPendingPenaltyOfCar47(2)]),
    );

    // Assert: the page's title, the history, and the header's links still there.
    expect(screen.getByRole('heading', { name: 'Eventos' }), 'the page title').toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: 'Histórico de eventos' }),
      'the history',
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Páginas do controle' }),
      'the header stays',
    ).toBeInTheDocument();
    window.location.hash = '';
  });
});
