/**
 * How the "Fontes de dados" page is reached and how it fits a tablet (apps/control, Playwright)
 *
 * What this module is for:
 *   The "Fontes de dados" page (#/fontes) is where the operator watches the race data
 *   while the console runs the show. The header's "Fontes" opens it in a new tab (João's
 *   ruling 2 at gate 2 of PR #16), so the console, its keys (Esc, "Limpar tudo"), an
 *   unsaved item draft and the monitors never unmount under the producer. On a 1024×768
 *   tablet the wide positions table must scroll inside its own box, never the whole page.
 *
 * What these tests prove:
 *   - "Fontes" in the console's header carries target="_blank", and pressing it opens
 *     #/fontes in a new tab while the first tab still shows the console.
 *   - At 1024×768, with the simulator's 60 cars shown, the positions table is wider than
 *     its box and scrolls inside it (scrollWidth > clientWidth of the box), and the page
 *     itself does not scroll sideways (scrollWidth <= clientWidth of the document).
 *
 * What these tests deliberately do not cover:
 *   - The header's health chip, which opens the same page in a new tab too: it is drawn
 *     only while a source is on; DataSourcesHealthChip.test.tsx checks its link.
 *   - "Console" in the header, a plain link in the same tab: AppPages.test.tsx.
 *   - Other widths: the operator's laptop (1600×900, every other test here) has room for
 *     the whole table.
 *
 * What it needs: `pnpm build` (the server registers built graphics only).
 *
 * Sharing the server with the other tests:
 *   Before each test the server is emptied, and the seeded simulator is turned off with
 *   its default settings back, so these tests pass whatever ran before them, in any order.
 */
import { expect, test } from '@playwright/test';

import {
  findPositionsTableOfSource,
  openDataSourcesPageAndWaitUntilConnected,
  seededSimulatorLabel,
  startTheSeededSimulatorFastFromTheGreenFlag,
} from './dataSourcesTestSteps';
import { emptyTheServerState } from './emptyTheServerState';

// The smallest screen the operator uses: a tablet in landscape.
const tabletViewport = { width: 1024, height: 768 };

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('the "Fontes de dados" page', () => {
  test('opens from the header\'s "Fontes" in a new tab, leaving the console in the first', async ({
    page,
  }) => {
    // Arrange: the console, connected to the server, and its header link "Fontes".
    await page.goto('/');
    await expect(
      page.getByRole('status', { name: 'Conexão com o servidor' }),
      'the console must connect to the server first',
    ).toHaveText('Conectado');
    const dataSourcesLink = page.getByRole('link', { name: 'Fontes', exact: true });

    // Act: press "Fontes", as the producer does, and catch the tab it opens.
    const newTabOpening = page.waitForEvent('popup');
    await dataSourcesLink.click();
    const newTab = await newTabOpening;

    // Assert: the link asks for a new tab, the new tab shows "Fontes de dados", and the
    // first tab is still the console.
    await expect(
      dataSourcesLink,
      'the header\'s "Fontes" must open in a new tab (João\'s ruling 2)',
    ).toHaveAttribute('target', '_blank');
    await expect(
      newTab.getByRole('heading', { name: 'Fontes de dados' }),
      'the new tab must show the "Fontes de dados" page',
    ).toBeVisible();
    expect(newTab.url(), 'the new tab must be at the address #/fontes').toMatch(/#\/fontes$/);
    expect(page.url(), 'the first tab must stay on the console').not.toMatch(/#\/fontes$/);
    await expect(
      page.getByRole('region', { name: 'Camadas' }),
      'the console must stay mounted in the first tab',
    ).toBeVisible();
  });

  test('scrolls the positions table inside its box at 1024×768, never the page', async ({
    page,
  }) => {
    // Arrange: a tablet-sized window on the page, with the simulator's 60 cars shown.
    await page.setViewportSize(tabletViewport);
    await openDataSourcesPageAndWaitUntilConnected(page);
    await startTheSeededSimulatorFastFromTheGreenFlag(page);
    const positionsTable = findPositionsTableOfSource(page, seededSimulatorLabel);
    // The box that scrolls is the table's parent (components/ui/table.tsx).
    const positionsTableBox = positionsTable.locator('xpath=..');

    // Act: measure how wide the table's box and the page are, and how wide they show.
    const boxWidths = await positionsTableBox.evaluate((box) => ({
      scrollWidth: box.scrollWidth,
      clientWidth: box.clientWidth,
    }));
    const pageWidths = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    // Assert: the table is wider than its box, so the box scrolls; the page does not.
    expect(
      boxWidths.scrollWidth,
      'at 1024×768 the positions table must be wider than its box and scroll inside it',
    ).toBeGreaterThan(boxWidths.clientWidth);
    expect(
      pageWidths.scrollWidth,
      'at 1024×768 the page itself must not scroll sideways',
    ).toBeLessThanOrEqual(pageWidths.clientWidth);
  });
});
