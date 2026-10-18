/**
 * The two pages of the control page (apps/control)
 *
 * What this module is for:
 *   The control page has the console (rundown, monitors, layers) and the "Fontes de
 *   dados" page. The header stays on both and links to both; the address after "#"
 *   says which is shown (src/app/currentPage.ts). From the console, "Fontes" and the
 *   header's data sources chip open "#/fontes" in a new tab (João's ruling 2 at gate 2 of
 *   PR #16), so the console never unmounts: an item draft, the monitors and the console's
 *   keys (Esc, "Limpar tudo") stay with the producer. The console's keys belong to the
 *   console, so they are off on the "Fontes" page (decision D16 of BAJAOVRLAY-17).
 *
 * What these tests prove:
 *   - "Fontes" in the header is a link to "#/fontes" that opens in a new tab; following
 *     it leaves the console on screen and the address as it was.
 *   - The "Fontes" page, opened at "#/fontes", keeps the header; there "Console" is a
 *     plain link in the same tab, and it brings the console back.
 *   - On the "Fontes" page Backspace discards no preview.
 *   - The wait those "console stays" checks use is long enough: in it, a plain link to
 *     "#/fontes" does move the tab.
 *   - The header shows the data sources chip once a source is on; it opens "Fontes" in a
 *     new tab too, and the console stays.
 *
 * What these tests deliberately do not cover:
 *   - Reading the address: src/app/currentPage.test.ts.
 *   - The new tab itself: jsdom opens no tabs, so the link's target is what is checked;
 *     the real browser is the e2e tests' job.
 *   - What the "Fontes" page shows and does, and the chip's counts:
 *     features/dataSources/ has tests of its own.
 *   - Every console key one by one: each lives in its feature (rundown, quick-fire,
 *     outputMonitors, playout), all inside the console view; Backspace stands for them.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
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

/**
 * How long jsdom is given to follow a clicked link. It follows a same-page link in a task
 * queued by the click, so a few milliseconds are enough; 50 leaves room on a slow CI box.
 * What could go wrong: if jsdom ever took longer, the "the console stays" checks below
 * would pass without proving anything, because they check that nothing changed. The
 * control test "is long enough for a plain link to #/fontes to move this tab" guards
 * that: with the same wait, a link without target="_blank" must change the address.
 */
const millisecondsJsdomTakesToFollowALink = 50;

/**
 * Waits until the browser has done what a click on a link asks: jsdom follows a link a
 * moment after the click, not during it, so checking at once would prove nothing.
 */
async function waitForTheBrowserToActOnTheClick(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, millisecondsJsdomTakesToFollowALink));
  });
}

/** Draws the whole control page opened at "#/fontes", as the new tab opens it. */
function renderTheFontesPageAsItsTabOpensIt(
  slices = buildSlicesWithTheRaceClockOnAir('2026-10-10T13:00:00.000Z'),
) {
  window.location.hash = '#/fontes';
  return renderOnControlPageConnectedToFakeServer(<App />, slices);
}

describe('the wait the "console stays" tests rely on', () => {
  it('is long enough for a plain link to #/fontes to move this tab', async () => {
    // Arrange: a bare link to "#/fontes" with no target, the control case for "Fontes".
    const plainLink = document.createElement('a');
    plainLink.href = '#/fontes';
    plainLink.textContent = 'Fontes sem nova aba';
    document.body.append(plainLink);

    // Act: follow it, and wait as the tests below wait.
    fireEvent.click(plainLink);
    await waitForTheBrowserToActOnTheClick();
    plainLink.remove();

    // Assert: this tab moved, so a tab that did not move below really stayed.
    expect(
      window.location.hash,
      'within the wait, jsdom must follow a link that has no target',
    ).toBe('#/fontes');
  });
});

describe('the "Fontes" link in the header', () => {
  it('opens "#/fontes" in a new tab', () => {
    // Arrange: the console, with the race clock on air.
    renderTheConsoleWithTheRaceClockOnAir();

    // Act: find "Fontes" in the header.
    const fontesLink = findPageLinks().getByRole('link', { name: 'Fontes' });

    // Assert: a link to the data sources page, in a new tab with no way back into this one.
    expect(fontesLink, '"Fontes" must lead to the data sources page').toHaveAttribute(
      'href',
      '#/fontes',
    );
    expect(fontesLink, '"Fontes" must open in a new tab').toHaveAttribute('target', '_blank');
    expect(fontesLink, 'the new tab must not reach back into the console').toHaveAttribute(
      'rel',
      'noopener',
    );
  });

  it('leaves the console on screen when followed', async () => {
    // Arrange: the console, with the race clock on air.
    renderTheConsoleWithTheRaceClockOnAir();

    // Act: follow "Fontes", and give the browser a moment to act on the click.
    fireEvent.click(findPageLinks().getByRole('link', { name: 'Fontes' }));
    await waitForTheBrowserToActOnTheClick();

    // Assert: this tab still shows the console, at the same address.
    expect(
      screen.getByRole('region', { name: 'Rundown' }),
      'the console must stay on screen: "Fontes" opens elsewhere',
    ).toBeInTheDocument();
    expect(window.location.hash, 'this tab must stay on the console address').toBe('');
  });
});

describe('the "Fontes" page in its own tab', () => {
  it('shows the data sources page in place of the console, keeping the header', () => {
    // Arrange: nothing beyond the page itself.

    // Act: open the control page at "#/fontes", as the new tab does.
    renderTheFontesPageAsItsTabOpensIt();

    // Assert: the data sources page, the header still there, no console.
    expect(
      screen.getByRole('heading', { name: 'Fontes de dados' }),
      '"#/fontes" must show the data sources page',
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

  it('brings the console back with "Console", a plain link in the same tab', async () => {
    // Arrange: the "Fontes" page in its tab.
    renderTheFontesPageAsItsTabOpensIt();
    const consoleLink = findPageLinks().getByRole('link', { name: 'Console' });

    // Act: follow "Console".
    fireEvent.click(consoleLink);

    // Assert: a same-tab link, and the rundown is back.
    expect(consoleLink, '"Console" must stay in this tab').not.toHaveAttribute('target');
    expect(
      await screen.findByRole('region', { name: 'Rundown' }),
      '"Console" must bring the console back',
    ).toBeInTheDocument();
  });

  it('leaves the console keys behind: Backspace discards no preview on the "Fontes" page', () => {
    // Arrange: the clock on air and another clock previewed, the "Fontes" page open.
    const slices = buildSlicesWithTheRaceClockOnAir('2026-10-10T13:00:00.000Z');
    slices.instances.push(
      buildRaceClockPreviewOfItem('item-bandeira-amarela', '2026-10-10T13:05:00.000Z'),
    );
    const { fakeServer } = renderTheFontesPageAsItsTabOpensIt(slices);

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
  it('shows on the console once a source is on, and opens "Fontes" in a new tab', async () => {
    // Arrange: the console with the simulator on and healthy.
    renderOnControlPageConnectedToFakeServer(
      <App />,
      buildSlicesWithDataSources({ dataSources: [buildSimulatorThatIsOk()] }),
    );
    const chipLink = within(screen.getByRole('banner')).getByRole('link', { name: 'Fontes: 1 ok' });

    // Act: follow the chip, and give the browser a moment to act on the click.
    fireEvent.click(chipLink);
    await waitForTheBrowserToActOnTheClick();

    // Assert: the chip opens "#/fontes" in a new tab, and this tab keeps the console.
    expect(chipLink, 'the chip must open the data sources page in a new tab').toHaveAttribute(
      'target',
      '_blank',
    );
    expect(
      screen.getByRole('region', { name: 'Rundown' }),
      'the console must stay on screen after the chip is followed',
    ).toBeInTheDocument();
  });
});
