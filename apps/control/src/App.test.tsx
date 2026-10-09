/**
 * Control page shell (apps/control)
 *
 * What this module is for:
 *   The operator's control page. For now it only proves the toolchain end to end: it
 *   shows the product name and one button that asks the server whether it is up.
 *
 * What these tests prove:
 *   - The page shows the title "BajaOvrLay" and the "Verificar servidor" button.
 *   - Pressing the button reads `GET /health` and shows the server's version.
 *   - When the server cannot be reached, the page says so in pt-BR instead of breaking.
 *
 * What these tests deliberately do not cover:
 *   - The real server: `fetch` is replaced with a stand-in that answers like the server.
 *   - Styling and layout; those are checked by eye in the browser.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App';

/** Builds a stand-in for `fetch` that answers like a healthy server at version 0.3.1. */
function createFetchAnsweringLikeAHealthyServer() {
  const healthyServerAnswer = { ok: true, version: '0.3.1' };
  return vi.fn(async () => Response.json(healthyServerAnswer));
}

/** Builds a stand-in for `fetch` that fails like a server that is switched off. */
function createFetchFailingLikeAServerThatIsOff() {
  return vi.fn(async () => {
    throw new TypeError('Failed to fetch');
  });
}

describe('the control page', () => {
  it('shows the title and the button to check the server', () => {
    // Arrange: nothing to prepare; the page needs no data to appear.

    // Act: draw the page.
    render(<App />);

    // Assert: the title and the button are on screen.
    expect(
      screen.getByRole('heading', { name: 'BajaOvrLay' }),
      'the page must show the product name as its title',
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Verificar servidor' }),
      'the page must offer the button that checks the server',
    ).toBeInTheDocument();
  });

  it('shows the server version after the operator checks the server', async () => {
    // Arrange: a server that answers /health with version 0.3.1.
    const fetchLikeAHealthyServer = createFetchAnsweringLikeAHealthyServer();
    vi.stubGlobal('fetch', fetchLikeAHealthyServer);
    render(<App />);

    // Act: press the button.
    fireEvent.click(screen.getByRole('button', { name: 'Verificar servidor' }));

    // Assert: the page asked /health and shows the version it got back.
    expect(
      await screen.findByText('Servidor no ar, versão 0.3.1.'),
      'the page must show the version the server reported',
    ).toBeInTheDocument();
    expect(fetchLikeAHealthyServer, 'the page must ask the /health address').toHaveBeenCalledWith(
      '/health',
    );
  });

  it('says the server is unreachable when the check fails', async () => {
    // Arrange: a server that is switched off, so the request never gets an answer.
    vi.stubGlobal('fetch', createFetchFailingLikeAServerThatIsOff());
    render(<App />);

    // Act: press the button.
    fireEvent.click(screen.getByRole('button', { name: 'Verificar servidor' }));

    // Assert: the page explains the problem in pt-BR.
    expect(
      await screen.findByText('Não foi possível falar com o servidor.'),
      'the page must tell the operator the server did not answer',
    ).toBeInTheDocument();
  });
});
