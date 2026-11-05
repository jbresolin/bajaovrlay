/**
 * The "Histórico" page in the frame of the control page (apps/control)
 *
 * What this module is for:
 *   Every change of the show is read back on a page of its own, "#/historico"
 *   (BAJAOVRLAY-30), opened from the header's "Histórico" in a new tab, as "Eventos" is, so
 *   the console never unmounts under the producer and the history can sit on a second screen.
 *
 * What these tests prove:
 *   - "Histórico" in the header is a link to "#/historico" that opens in a new tab.
 *   - The page opened at "#/historico" shows the history under the same header.
 *
 * What these tests deliberately do not cover:
 *   - What the page shows and does; features/history/HistoryPage.test.tsx.
 */
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { renderOnControlPageConnectedToFakeServer } from './state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from './state/slicesLikeTheServerSends.testSupport';

describe('the "Histórico" link in the header', () => {
  it('opens "#/historico" in a new tab', () => {
    // Arrange: the console.
    window.location.hash = '';
    renderOnControlPageConnectedToFakeServer(<App />, buildSlicesWithNothingOnAir());

    // Act: find "Histórico" in the header.
    const header = within(screen.getByRole('navigation', { name: 'Páginas do controle' }));
    const historyLink = header.getByRole('link', { name: 'Histórico' });

    // Assert: a link to the page, in a new tab with no way back into this one.
    expect(historyLink, '"Histórico" leads to the history').toHaveAttribute('href', '#/historico');
    expect(historyLink, 'in a new tab').toHaveAttribute('target', '_blank');
    expect(historyLink, 'that cannot reach back').toHaveAttribute('rel', 'noopener');
  });
});

describe('the page at "#/historico"', () => {
  it('shows the history under the header', () => {
    // Arrange: the address the new tab opens, with one "Limpar tudo" in the log.
    window.location.hash = '#/historico';
    const slices = {
      ...buildSlicesWithNothingOnAir(),
      eventLog: [
        {
          id: 7,
          ts: '2026-11-05T14:04:00.000Z',
          actor: 'operador:conexao-7',
          command: 'clearAll',
          payload: { type: 'clearAll' },
          result: { status: 'ok' as const },
        },
      ],
    };

    // Act: draw the whole control page.
    renderOnControlPageConnectedToFakeServer(<App />, slices);

    // Assert: the page's title, its row, and the header's links still there.
    expect(
      screen.getByRole('heading', { name: 'Histórico' }),
      'the page title',
    ).toBeInTheDocument();
    expect(screen.getByText('Limpou tudo'), 'the row of the log').toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Páginas do controle' }),
      'the header stays',
    ).toBeInTheDocument();
    window.location.hash = '';
  });
});
