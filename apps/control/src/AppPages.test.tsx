/**
 * The two pages of the control page (apps/control)
 *
 * What this module is for:
 *   The control page has the console (rundown, monitors, layers) and the "Fontes de
 *   dados" page. The header stays on both and links to both; the address after "#"
 *   says which is shown (src/app/currentPage.ts). The console's keys belong to the
 *   console, so they are off on the "Fontes" page (decision D16 of BAJAOVRLAY-17).
 *
 * What these tests prove:
 *   - "Fontes" in the header opens the data sources page in place of the console,
 *     keeping the header, and "Console" brings the console back.
 *   - On the "Fontes" page Backspace discards no preview.
 *   - The header shows the data sources chip once a source is on, linking to "Fontes".
 *
 * What these tests deliberately do not cover:
 *   - Reading the address: src/app/currentPage.test.ts.
 *   - What the "Fontes" page shows and does, and the chip's counts:
 *     features/dataSources/ has tests of its own.
 *   - Every console key one by one: each lives in its feature (rundown, quick-fire,
 *     outputMonitors, playout), all inside the console view; Backspace stands for them.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { renderOnControlPageConnectedToFakeServer } from './state/controlPageOnFakeServer.testSupport';
import {
  buildSimulatorThatIsOk,
  buildSlicesWithDataSources,
} from './state/dataSourcesLikeTheServerSends.testSupport';
import { buildRaceClockPreviewOfItem } from './state/previewLikeTheServerSends.testSupport';
import { buildSlicesWithTheRaceClockOnAir } from './state/slicesLikeTheServerSends.testSupport';

/** Draws the whole control page on the console, with the race clock on air. */
function renderTheConsoleWithTheRaceClockOnAir() {
  return renderOnControlPageConnectedToFakeServer(
    <App />,
    buildSlicesWithTheRaceClockOnAir('2026-10-10T13:00:00.000Z'),
  );
}

/** The header's links to the two pages. */
function findPageLinks() {
  return within(screen.getByRole('navigation', { name: 'Páginas do controle' }));
}

describe('the "Fontes" link in the header', () => {
  it('opens the data sources page in place of the console, keeping the header', async () => {
    // Arrange: the console, with the race clock on air.
    renderTheConsoleWithTheRaceClockOnAir();

    // Act: follow "Fontes".
    fireEvent.click(findPageLinks().getByRole('link', { name: 'Fontes' }));

    // Assert: the data sources page, the header still there, the console gone.
    expect(
      await screen.findByRole('heading', { name: 'Fontes de dados' }),
      '"Fontes" must open the data sources page',
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Conexão com o servidor' }),
      'the header stays on the data sources page',
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Rundown' }),
      'the console makes room for the data sources page',
    ).not.toBeInTheDocument();
  });

  it('"Console" brings the console back from the "Fontes" page', async () => {
    // Arrange: the console, then the "Fontes" page.
    renderTheConsoleWithTheRaceClockOnAir();
    fireEvent.click(findPageLinks().getByRole('link', { name: 'Fontes' }));
    await screen.findByRole('heading', { name: 'Fontes de dados' });

    // Act: follow "Console".
    fireEvent.click(findPageLinks().getByRole('link', { name: 'Console' }));

    // Assert: the rundown is back.
    expect(
      await screen.findByRole('region', { name: 'Rundown' }),
      '"Console" must bring the console back',
    ).toBeInTheDocument();
  });

  it('leaves the console keys behind: Backspace discards no preview on the "Fontes" page', async () => {
    // Arrange: the clock on air and another clock previewed, then the "Fontes" page.
    const slices = buildSlicesWithTheRaceClockOnAir('2026-10-10T13:00:00.000Z');
    slices.instances.push(
      buildRaceClockPreviewOfItem('item-bandeira-amarela', '2026-10-10T13:05:00.000Z'),
    );
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(<App />, slices);
    fireEvent.click(screen.getByRole('link', { name: 'Fontes' }));
    await screen.findByRole('heading', { name: 'Fontes de dados' });

    // Act: press Backspace with the focus on the page itself.
    fireEvent.keyDown(document.body, { key: 'Backspace' });

    // Assert: nothing sent; the console's keys belong to the console.
    expect(
      fakeServer.listCommandsReceived(),
      'away from the console, Backspace must not discard the preview',
    ).toEqual([]);
  });
});

describe('the data sources chip in the header', () => {
  it('shows on the console once a source is on, and takes the operator to "Fontes"', async () => {
    // Arrange: the console with the simulator on and healthy.
    renderOnControlPageConnectedToFakeServer(
      <App />,
      buildSlicesWithDataSources({ dataSources: [buildSimulatorThatIsOk()] }),
    );
    const header = within(screen.getByRole('banner'));

    // Act: follow the chip.
    fireEvent.click(header.getByRole('link', { name: 'Fontes: 1 ok' }));

    // Assert: the chip was in the header, and it opened the data sources page.
    expect(
      await screen.findByRole('heading', { name: 'Fontes de dados' }),
      'the chip must lead to the data sources page',
    ).toBeInTheDocument();
  });
});
