/**
 * Control page shell (apps/control)
 *
 * What this module is for:
 *   The operator's control page as a whole: a header with the product name and the
 *   connection badge, and three areas that are always on screen — the rundown on the
 *   left (a placeholder until M1), the program monitor and the race clock panel in the
 *   centre, the layer status and "Limpar tudo" on the right.
 *
 * What these tests prove:
 *   - The page shows the title, the connection badge and the "Verificar servidor" button.
 *   - Pressing that button reads `GET /health` and shows the server's version; when the
 *     server cannot be reached, the page says so in pt-BR instead of breaking.
 *   - The three areas are there: the rundown placeholder, the program monitor (a frame
 *     showing `/render/`, the same page OBS loads) with the race clock panel, and the
 *     layer list with "Limpar tudo".
 *   - Backspace clears the clock layer, but not while the operator is typing in a field.
 *   - When the server refuses a clear, its pt-BR message appears next to the layers.
 *
 * What these tests deliberately do not cover:
 *   - The real server: `fetch` is replaced with a stand-in that answers like the server,
 *     and a fake server stands in on the WebSocket; e2e/takeAndClear.e2e.ts uses the real one.
 *   - What the program monitor shows inside its frame: that is the renderer's page.
 *   - Styling and the three-column layout; those are checked by eye in the browser.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { renderOnControlPageConnectedToFakeServer } from './state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithTheRaceClockOnAir } from './state/slicesLikeTheServerSends.testSupport';

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

/** Draws the whole page, connected to a fake server that has the race clock on air. */
function renderControlPageWithTheRaceClockOnAir() {
  return renderOnControlPageConnectedToFakeServer(
    <App />,
    buildSlicesWithTheRaceClockOnAir('2026-10-10T13:00:00.000Z'),
  );
}

describe('the control page', () => {
  it('shows the title, the connection badge and the button to check the server', () => {
    // Arrange: nothing to prepare beyond a connected page.

    // Act: draw the page.
    renderControlPageWithTheRaceClockOnAir();

    // Assert: the title, the badge and the button are on screen.
    expect(
      screen.getByRole('heading', { name: 'BajaOvrLay' }),
      'the page must show the product name as its title',
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Conexão com o servidor' }),
      'the header must show the connection badge',
    ).toHaveTextContent('Conectado');
    expect(
      screen.getByRole('button', { name: 'Verificar servidor' }),
      'the page must offer the button that checks the server',
    ).toBeInTheDocument();
  });

  it('shows the server version after the operator checks the server', async () => {
    // Arrange: a server that answers /health with version 0.3.1.
    const fetchLikeAHealthyServer = createFetchAnsweringLikeAHealthyServer();
    vi.stubGlobal('fetch', fetchLikeAHealthyServer);
    renderControlPageWithTheRaceClockOnAir();

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
    renderControlPageWithTheRaceClockOnAir();

    // Act: press the button.
    fireEvent.click(screen.getByRole('button', { name: 'Verificar servidor' }));

    // Assert: the page explains the problem in pt-BR.
    expect(
      await screen.findByText('Não foi possível falar com o servidor.'),
      'the page must tell the operator the server did not answer',
    ).toBeInTheDocument();
  });
});

describe('the three areas of the control page', () => {
  it('shows the rundown placeholder on the left', () => {
    // Arrange: nothing to prepare beyond a connected page.

    // Act: draw the page.
    renderControlPageWithTheRaceClockOnAir();

    // Assert: the rundown area exists and says it arrives in M1.
    const rundownArea = within(screen.getByRole('region', { name: 'Rundown' }));
    expect(
      rundownArea.getByText('Rundown — M1'),
      'the left area must hold the rundown placeholder',
    ).toBeInTheDocument();
  });

  it('shows the program monitor and the race clock panel in the centre', () => {
    // Arrange: nothing to prepare beyond a connected page.

    // Act: draw the page.
    renderControlPageWithTheRaceClockOnAir();

    // Assert: the centre holds a frame on /render/ labelled "Programa", and the take form.
    const centreArea = within(screen.getByRole('region', { name: 'Programa e relógio' }));
    expect(
      centreArea.getByTitle('Programa'),
      'the program monitor must show the renderer page, the same one OBS loads',
    ).toHaveAttribute('src', '/render/');
    expect(
      centreArea.getByRole('heading', { name: 'Programa' }),
      'the program monitor must be labelled "Programa"',
    ).toBeInTheDocument();
    expect(
      centreArea.getByRole('button', { name: 'Colocar no ar' }),
      'the race clock panel must be in the centre area',
    ).toBeInTheDocument();
  });

  it('shows the layer status and the clear all button on the right', () => {
    // Arrange: nothing to prepare beyond a connected page.

    // Act: draw the page.
    renderControlPageWithTheRaceClockOnAir();

    // Assert: the right area lists the five layers and has "Limpar tudo".
    const layersArea = within(screen.getByRole('region', { name: 'Camadas' }));
    expect(layersArea.getAllByRole('listitem'), 'all five layers must be listed').toHaveLength(5);
    expect(
      layersArea.getByRole('button', { name: 'Limpar tudo' }),
      'the clear all button must sit next to the layers',
    ).toBeInTheDocument();
  });
});

describe('the Backspace key', () => {
  it('clears the clock layer when the focus is not in a field', () => {
    // Arrange: the page with the race clock on air.
    const { fakeServer } = renderControlPageWithTheRaceClockOnAir();

    // Act: press Backspace with the focus on the page itself.
    fireEvent.keyDown(document.body, { key: 'Backspace' });

    // Assert: the server received clearLayer for the clock layer.
    expect(
      fakeServer.listCommandsReceived(),
      'Backspace outside a field must clear the clock layer',
    ).toEqual([{ type: 'clearLayer', layerId: 'clock' }]);
    fakeServer.acceptLastCommand();
  });

  it('only erases text, and clears nothing, while the operator types in a field', () => {
    // Arrange: the page with the race clock on air.
    const { fakeServer } = renderControlPageWithTheRaceClockOnAir();

    // Act: press Backspace inside the session name field, as when fixing a typo.
    fireEvent.keyDown(screen.getByLabelText('Nome da sessão'), { key: 'Backspace' });

    // Assert: no command was sent; fixing a typo must never take the clock off air.
    expect(
      fakeServer.listCommandsReceived(),
      'Backspace inside a text field must not clear any layer',
    ).toEqual([]);
  });
});

describe('a clear the server refuses', () => {
  it("shows the server's pt-BR message next to the layers", async () => {
    // Arrange: the page with the race clock on air, and "Limpar" pressed on the clock row.
    const { fakeServer } = renderControlPageWithTheRaceClockOnAir();
    const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    fireEvent.click(clockRow.getByRole('button', { name: 'Limpar' }));

    // Act: the server answers that it failed to save the change.
    fakeServer.refuseLastCommand({
      code: 'UNEXPECTED_SERVER_ERROR',
      message:
        'Erro inesperado no servidor ao executar o comando. Procure o erro no log do servidor.',
    });

    // Assert: the message is shown in the layers area, in the server's own words.
    const layersArea = within(screen.getByRole('region', { name: 'Camadas' }));
    expect(
      await layersArea.findByRole('alert'),
      'the refusal must be shown where the operator pressed the button',
    ).toHaveTextContent(
      'Erro inesperado no servidor ao executar o comando. Procure o erro no log do servidor.',
    );
  });
});
