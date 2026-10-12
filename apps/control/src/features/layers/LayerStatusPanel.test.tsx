/**
 * Layer status panel (apps/control)
 *
 * What this module is for:
 *   The screen is made of fixed layers (logo, ticker, clock, lower third, fullscreen).
 *   The operator must always see what is on each one, with no hidden state. This panel
 *   lists every layer with what it shows, since when, in which status, and a "Limpar"
 *   button that takes that layer off air.
 *
 * What these tests prove:
 *   - There is one row per layer, in z-order from the bottom layer to the top one.
 *   - An empty layer says "vazia"; a layer with a graphic shows the graphic's name, how
 *     long ago it was taken ("há 2 min") and its status, and the time keeps up as
 *     minutes pass.
 *   - The status follows the server: "Carregando" at the take, "No ar" once the server
 *     passes on the renderer's acknowledgement, and "Falhou" with the renderer's detail in
 *     a tooltip when the graphic failed. A failed graphic stays listed on its layer.
 *   - A graphic the server no longer has registered is still listed, by its id.
 *   - "Limpar" sends `clearLayer` with the id of the layer of its own row.
 *   - While the page is not connected every "Limpar" is disabled and says why.
 *
 * What these tests deliberately do not cover:
 *   - The real server and WebSocket: a fake server stands in, driven by the test; the
 *     real ones are exercised by e2e/takeAndClear.e2e.ts.
 *   - The preview output: the rows describe the program output only, and a layer that
 *     holds a preview gets a chip; LayerStatusPanelPreviewChip.test.tsx covers that.
 *   - The message shown when the server refuses a clear; App.test.tsx covers it.
 *   - The colour of each status badge; InstanceStatusBadge.test.tsx covers it.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  focusAreaAroundDisabledButton,
  letTimePassOnThePage,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildRaceClockInstanceOnTheClockLayer,
  buildSlicesWithNothingOnAir,
  buildSlicesWithTheRaceClockOnAir,
} from '@/state/slicesLikeTheServerSends.testSupport';

import { LayerStatusPanel } from './LayerStatusPanel';

const momentTheClockWentOnAir = '2026-10-10T13:00:00.000Z';
const twoAndAHalfMinutesLater = new Date('2026-10-10T13:02:30.000Z');

describe('the layer status panel', () => {
  it('lists one row per layer, from the bottom layer to the top one', () => {
    // Arrange: a server with its five seeded layers and nothing on air.
    const slices = buildSlicesWithNothingOnAir();

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: five rows, named after the layers, lowest z-index first.
    const layerNamesInRowOrder = screen
      .getAllByRole('listitem')
      .map((row) => row.getAttribute('aria-label'));
    expect(layerNamesInRowOrder, 'the rows must follow the z-order of the layers').toEqual([
      'Logo',
      'Letreiro',
      'Relógio',
      'Tarja',
      'Tela cheia',
    ]);
  });

  it('orders the rows by z-index even when the server lists the layers out of order', () => {
    // Arrange: the same layers, but sent top layer first.
    const slices = buildSlicesWithNothingOnAir();
    slices.layers.reverse();

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: the rows are still bottom to top.
    const layerNamesInRowOrder = screen
      .getAllByRole('listitem')
      .map((row) => row.getAttribute('aria-label'));
    expect(layerNamesInRowOrder, 'the z-index decides the order, not the list order').toEqual([
      'Logo',
      'Letreiro',
      'Relógio',
      'Tarja',
      'Tela cheia',
    ]);
  });

  it('says "vazia" on every layer that has nothing on it', () => {
    // Arrange: a server with nothing on air.
    const slices = buildSlicesWithNothingOnAir();

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: each of the five rows says "vazia".
    const rows = screen.getAllByRole('listitem');
    for (const row of rows) {
      expect(
        within(row).getByText('vazia'),
        `the empty layer "${row.getAttribute('aria-label')}" must say "vazia"`,
      ).toBeInTheDocument();
    }
  });

  it('shows the graphic name, how long ago it was taken and its status on its layer', () => {
    // Arrange: the race clock went on air at 10:00, and it is now 10:02:30.
    vi.useFakeTimers();
    vi.setSystemTime(twoAndAHalfMinutesLater);
    const slices = buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir);

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: the clock row describes the race clock; the other rows still say "vazia".
    const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    expect(
      clockRow.getByText('Relógio de prova'),
      'the row must show the name of the graphic that is on the layer',
    ).toBeInTheDocument();
    expect(
      clockRow.getByText('há 2 min'),
      'the row must say how long ago the graphic was taken',
    ).toBeInTheDocument();
    expect(
      clockRow.getByText('Carregando'),
      'the row must show the status the server gives the instance',
    ).toBeInTheDocument();
    expect(clockRow.queryByText('vazia'), 'a layer with a graphic is not "vazia"').toBeNull();
    expect(
      screen.getAllByText('vazia'),
      'the four other layers must still say "vazia"',
    ).toHaveLength(4);
  });

  it('keeps the "há ... min" text up to date as minutes pass', () => {
    // Arrange: the panel drawn 2 min 30 s after the race clock went on air.
    vi.useFakeTimers();
    vi.setSystemTime(twoAndAHalfMinutesLater);
    const slices = buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir);
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Act: one more minute passes with the page left open.
    letTimePassOnThePage(60_000);

    // Assert: the row now says three minutes, without anyone touching the page.
    const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    expect(
      clockRow.getByText('há 3 min'),
      'the elapsed time must follow the clock while the page is open',
    ).toBeInTheDocument();
  });

  it('changes the status from "Carregando" to "No ar" when the server passes on the renderer\'s acknowledgement', () => {
    // Arrange: the panel with the race clock just taken, so still "Carregando".
    const slices = buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir);
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Act: the renderer reports the clock is on screen, and the server sends the same
    // instance (same id) with its new status.
    const raceClockInstanceAcknowledged = {
      ...buildRaceClockInstanceOnTheClockLayer(momentTheClockWentOnAir),
      status: 'on-air' as const,
    };
    fakeServer.sendMessage({
      type: 'slice',
      name: 'instances',
      slice: [raceClockInstanceAcknowledged],
    });

    // Assert: the clock row now says "No ar" and no longer "Carregando".
    const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    expect(
      clockRow.getByText('No ar'),
      'the row must say "No ar" once the renderer has acknowledged the take',
    ).toBeInTheDocument();
    expect(
      clockRow.queryByText('Carregando'),
      'an acknowledged graphic is not "Carregando" any more',
    ).toBeNull();
  });

  it('keeps a failed graphic on its row as "Falhou", with the renderer\'s detail in a tooltip', async () => {
    // Arrange: the race clock was taken, but the renderer could not load its package and
    // reported the failure. The server keeps the instance, marked as failed.
    const slices = buildSlicesWithNothingOnAir();
    slices.instances = [
      {
        ...buildRaceClockInstanceOnTheClockLayer(momentTheClockWentOnAir),
        status: 'failed',
        statusDetail:
          'Failed to fetch dynamically imported module: /graphics/race-clock/race-clock.js',
      },
    ];

    // Act: draw the panel, and rest on the status badge of the clock row.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);
    const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    const focusableAreaAroundTheBadge = clockRow.getByText('Falhou').parentElement;
    if (focusableAreaAroundTheBadge === null) {
      throw new Error('the "Falhou" badge is not on the page');
    }
    fireEvent.focus(focusableAreaAroundTheBadge);

    // Assert: the graphic is still listed (the layer is not "vazia": the operator must
    // clear or retake it), and the tooltip says why it failed.
    expect(
      clockRow.getByText('Relógio de prova'),
      'a failed graphic must stay listed on its layer',
    ).toBeInTheDocument();
    expect(
      clockRow.queryByText('vazia'),
      'a layer with a failed graphic is not "vazia"',
    ).toBeNull();
    expect(
      await screen.findByRole('tooltip'),
      'the tooltip must carry the detail the renderer reported',
    ).toHaveTextContent(
      'Failed to fetch dynamically imported module: /graphics/race-clock/race-clock.js',
    );
  });

  it('lists a graphic by its id when the server no longer has it registered', () => {
    // Arrange: the race clock is on air, but its package is gone from the graphics list
    // (the server keeps such an instance on air; see docs/decisions.md, PR #3).
    const slices = buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir);
    slices.graphics = [];

    // Act: draw the panel.
    renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Assert: the row falls back to the graphic's id rather than hiding the instance.
    const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    expect(
      clockRow.getByText('race-clock'),
      'an on-air graphic with no known name must still be listed, by its id',
    ).toBeInTheDocument();
  });

  const clearLayerScenarios = [
    // The layer that has something on it: the everyday case.
    { name: 'sends clearLayer for the clock layer', layerName: 'Relógio', layerId: 'clock' },
    // Another row, to prove each button carries the id of its own layer; its id
    // ("lower-third") also differs from its name ("Tarja").
    { name: 'sends clearLayer for the lower third', layerName: 'Tarja', layerId: 'lower-third' },
  ];

  it.each(clearLayerScenarios)('$name when its "Limpar" is pressed', ({ layerName, layerId }) => {
    // Arrange: the panel with the race clock on air.
    const slices = buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir);
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Act: press "Limpar" on that layer's row.
    const row = within(screen.getByRole('listitem', { name: layerName }));
    fireEvent.click(row.getByRole('button', { name: 'Limpar' }));

    // Assert: the server received one clearLayer command naming that layer.
    expect(
      fakeServer.listCommandsReceived(),
      `"Limpar" on "${layerName}" must send clearLayer for "${layerId}" and nothing else`,
    ).toEqual([{ type: 'clearLayer', layerId }]);
    // (Then the server answers, so no command is left waiting for its 5-second timeout
    // once the test is over.)
    fakeServer.acceptLastCommand();
  });

  it('shows "vazia" again once the server says the layer was cleared', () => {
    // Arrange: the panel with the race clock on air.
    const slices = buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir);
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Act: the server reports an empty instances slice, as it does after a clear.
    fakeServer.sendMessage({ type: 'slice', name: 'instances', slice: [] });

    // Assert: the clock row is back to "vazia". The page did not decide this by itself;
    // it only repeats what the server said.
    const clockRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    expect(
      clockRow.getByText('vazia'),
      'the row must follow the server and show the layer as empty',
    ).toBeInTheDocument();
  });

  it('disables every "Limpar" and says why while the connection is down', async () => {
    // Arrange: the panel with the race clock on air.
    const slices = buildSlicesWithTheRaceClockOnAir(momentTheClockWentOnAir);
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<LayerStatusPanel />, slices);

    // Act: the line drops, and the operator reaches for the clock row's button.
    fakeServer.dropConnection();
    const clearButtons = screen.getAllByRole('button', { name: 'Limpar' });
    const clearButtonOfTheClockRow = within(
      screen.getByRole('listitem', { name: 'Relógio' }),
    ).getByRole('button', { name: 'Limpar' });
    focusAreaAroundDisabledButton(clearButtonOfTheClockRow);

    // Assert: all five buttons are disabled, and the tooltip explains it in pt-BR.
    for (const clearButton of clearButtons) {
      expect(clearButton, 'no "Limpar" may be pressed without a connection').toBeDisabled();
    }
    expect(
      await screen.findByRole('tooltip'),
      'the tooltip must tell the operator why the button is disabled',
    ).toHaveTextContent('Sem conexão com o servidor. Os comandos voltam quando ela voltar.');
    expect(
      within(screen.getByRole('listitem', { name: 'Relógio' })).getByText('Relógio de prova'),
      'the last known state must stay readable while the connection is down',
    ).toBeInTheDocument();
  });
});
