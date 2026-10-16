/**
 * Control page shell (apps/control)
 *
 * What this module is for:
 *   The operator's control page as a whole: a header with the product name and the
 *   connection badge, and three areas that are always on screen — the rundown on the
 *   left; the two monitors ("Prévia" and "Programa") and "Edição rápida" (the panel that
 *   takes, previews and updates any graphic) in the centre; the layer status and "Limpar
 *   tudo" on the right.
 *
 * What these tests prove:
 *   - The page shows the title, the connection badge and the "Verificar servidor" button.
 *   - Pressing that button reads `GET /health` and shows the server's version; when the
 *     server cannot be reached, the page says so in pt-BR instead of breaking.
 *   - The three areas are there: the rundown with "+ Item"; the "Prévia" monitor (a frame
 *     on `/render/?target=preview&monitor=1`) to the left of the "Programa" monitor (a
 *     frame on `/render/?monitor=1`, the page OBS loads but marked as a monitor so it
 *     never reports what is on air), with what is previewed listed under "Prévia" and
 *     "Edição rápida" below; and on the right the quick-fire strip ("Atalhos e macros")
 *     above the layer list with "Limpar tudo".
 *   - The header has the "?" button that lists the keyboard shortcuts.
 *   - While something is on the preview output, Backspace throws that preview away and
 *     leaves the clock on air, but not while the operator is typing in a field, choosing
 *     in a dropdown (closed or open) or resting on the switch.
 *   - With nothing on the preview output Backspace sends nothing: it no longer clears
 *     the clock layer (João's ruling, gate 2 of BAJAOVRLAY-15).
 *   - When the server refuses a clear, its pt-BR message appears next to the layers.
 *
 * What these tests deliberately do not cover:
 *   - The real server: `fetch` is replaced with a stand-in that answers like the server,
 *     and a fake server stands in on the WebSocket; e2e/takeAndClear.e2e.ts uses the real one.
 *   - What the monitors show inside their frames: that is the renderer's page.
 *   - Every case of what Backspace sends: src/keyboard/commandForOperatorKey.test.ts.
 *   - What the rundown does (rows, drag, Space, Right arrow): features/rundown/ has
 *     tests of its own. What "Edição rápida" sends: features/playout/ has tests of its own.
 *   - Styling and the three-column layout; those are checked by eye in the browser.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { renderOnControlPageConnectedToFakeServer } from './state/controlPageOnFakeServer.testSupport';
import { buildRaceClockPreviewOfItem } from './state/previewLikeTheServerSends.testSupport';
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
  it('shows the rundown on the left, with the button that adds an item', () => {
    // Arrange: nothing to prepare beyond a connected page; the server's seeded rundown,
    // "Sessão principal", has no items yet.

    // Act: draw the page.
    renderControlPageWithTheRaceClockOnAir();

    // Assert: the left area names the rundown and offers "+ Item".
    const rundownArea = within(screen.getByRole('region', { name: 'Rundown' }));
    expect(
      rundownArea.getByRole('heading', { name: 'Sessão principal' }),
      'the left area must hold the rundown the server sent',
    ).toBeInTheDocument();
    expect(
      rundownArea.getByRole('button', { name: '+ Item' }),
      'the rundown must offer the button that opens the item editor',
    ).toBeInTheDocument();
  });

  it('shows the "Prévia" and "Programa" monitors and "Edição rápida" in the centre', () => {
    // Arrange: nothing to prepare beyond a connected page.

    // Act: draw the page.
    renderControlPageWithTheRaceClockOnAir();

    // Assert: the centre holds two frames on the renderer page, both marked as monitors:
    // "Prévia" first (it comes first in the page, so it is drawn on the left) on the
    // preview output, then "Programa"; the note that nothing is previewed; and the
    // "Edição rápida" panel with its take button.
    const centreArea = within(screen.getByRole('region', { name: 'Programa e edição rápida' }));
    const previewFrame = centreArea.getByTitle('Prévia');
    const programFrame = centreArea.getByTitle('Programa');
    expect(
      previewFrame,
      'the preview monitor must show the renderer page of the preview output',
    ).toHaveAttribute('src', '/render/?target=preview&monitor=1');
    expect(
      programFrame,
      'the program monitor must show the renderer page marked as a monitor, so only OBS reports what is on air',
    ).toHaveAttribute('src', '/render/?monitor=1');
    // `getAllByTitle` answers in the order of the page; both titles are asked for at once.
    const frameTitlesInPageOrder = centreArea
      .getAllByTitle(/^(Prévia|Programa)$/)
      .map((frame) => frame.getAttribute('title'));
    expect(
      frameTitlesInPageOrder,
      '"Prévia" must come before "Programa" in the page, which puts it on the left',
    ).toEqual(['Prévia', 'Programa']);
    expect(
      centreArea.getByRole('heading', { name: 'Prévia' }),
      'the preview monitor must be labelled "Prévia"',
    ).toBeInTheDocument();
    expect(
      centreArea.getByRole('heading', { name: 'Programa' }),
      'the program monitor must be labelled "Programa"',
    ).toBeInTheDocument();
    expect(
      centreArea.getByText('Nada em prévia.'),
      'under "Prévia" the page must say that nothing is previewed',
    ).toBeInTheDocument();
    expect(
      centreArea.getByRole('heading', { name: 'Edição rápida' }),
      'the quick edit panel must be in the centre area',
    ).toBeInTheDocument();
    expect(
      centreArea.getByRole('button', { name: 'Colocar no ar' }),
      'the quick edit panel must offer its take button',
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

describe('the right column and the header of the control page', () => {
  it('shows the quick-fire strip above the layers, and the "?" in the header', () => {
    // Arrange: nothing to prepare beyond a connected page; the server's seeded panel,
    // "Atalhos", has no buttons yet.

    // Act: draw the page.
    renderControlPageWithTheRaceClockOnAir();

    // Assert: the strip with its first tab, drawn before the layer panel; and "?" in the
    // header.
    const quickFireArea = screen.getByRole('region', { name: 'Atalhos e macros' });
    const layersArea = screen.getByRole('region', { name: 'Camadas' });
    expect(
      within(quickFireArea).getByRole('tab', { name: 'Atalhos' }),
      'the strip must show the seeded panel as its first tab',
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      quickFireArea.compareDocumentPosition(layersArea) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the strip must come before the layer panel, which puts it above',
    ).toBeTruthy();
    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: 'Atalhos do teclado' }),
      'the header must offer the "?" button that lists the shortcuts',
    ).toBeInTheDocument();
  });
});

/** Draws the whole page with the race clock on air and the yellow flag item previewed. */
function renderControlPageWithTheClockOnAirAndAPreview() {
  const slices = buildSlicesWithTheRaceClockOnAir('2026-10-10T13:00:00.000Z');
  slices.instances.push(
    buildRaceClockPreviewOfItem('item-bandeira-amarela', '2026-10-10T13:05:00.000Z'),
  );
  return renderOnControlPageConnectedToFakeServer(<App />, slices);
}

describe('the Backspace key while something is on the preview output', () => {
  it('throws the preview away and leaves the clock on air', () => {
    // Arrange: the clock is on air, and another clock is previewed on the same layer.
    const { fakeServer } = renderControlPageWithTheClockOnAirAndAPreview();

    // Act: press Backspace with the focus on the page itself.
    fireEvent.keyDown(document.body, { key: 'Backspace' });

    // Assert: one stopPreview for the previewed layer, and no clearLayer.
    expect(
      fakeServer.listCommandsReceived(),
      'Backspace with a preview showing must discard the preview and clear nothing on air',
    ).toEqual([{ type: 'stopPreview', layerId: 'clock' }]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout
    // once the test is over.)
    fakeServer.acceptLastCommand();
  });

  const placesWhereBackspaceBelongsToTheForm = [
    // Fixing a typo in the session name must never discard the preview being looked at.
    {
      name: 'only erases text while the operator types in a field',
      findThePlace: () => screen.getByLabelText('Nome da sessão'),
    },
    // The focus rests on the closed dropdown right after the operator has picked a flag.
    {
      name: 'discards nothing while the flag dropdown has focus',
      findThePlace: () => screen.getByRole('combobox', { name: 'Bandeira' }),
    },
    // The open list of the same dropdown, reached from the keyboard.
    {
      name: 'discards nothing while the list of an open dropdown has focus',
      findThePlace: () => {
        fireEvent.keyDown(screen.getByRole('combobox', { name: 'Bandeira' }), { key: 'Enter' });
        return screen.getByRole('option', { name: 'Verde' });
      },
    },
    // The switch is another control of the form being edited.
    {
      name: 'discards nothing while the "Relógio correndo" switch has focus',
      findThePlace: () => screen.getByRole('switch', { name: 'Relógio correndo' }),
    },
  ];

  it.each(placesWhereBackspaceBelongsToTheForm)('$name', ({ findThePlace }) => {
    // Arrange: the clock is on air and another clock is previewed, so a Backspace that
    // reached the shortcut WOULD send stopPreview; the focus is on the place of this row.
    const { fakeServer } = renderControlPageWithTheClockOnAirAndAPreview();
    const placeWithTheFocus = findThePlace();

    // Act: press Backspace there.
    fireEvent.keyDown(placeWithTheFocus, { key: 'Backspace' });

    // Assert: no command was sent; the operator is editing the form.
    expect(
      fakeServer.listCommandsReceived(),
      'Backspace on a form control must neither discard a preview nor clear a layer',
    ).toEqual([]);
  });
});

describe('the Backspace key with nothing on the preview output', () => {
  it('sends nothing, so the clock stays on air', () => {
    // Arrange: the page with the race clock on air and nothing previewed. Until gate 2
    // of BAJAOVRLAY-15 this press cleared the clock layer.
    const { fakeServer } = renderControlPageWithTheRaceClockOnAir();

    // Act: press Backspace with the focus on the page itself.
    fireEvent.keyDown(document.body, { key: 'Backspace' });

    // Assert: no command at all. The clock is taken off air with its row's "Limpar"
    // button or with Esc ("Limpar tudo"), never with Backspace.
    expect(
      fakeServer.listCommandsReceived(),
      'Backspace with nothing previewed must send nothing: it never clears a layer on air',
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
