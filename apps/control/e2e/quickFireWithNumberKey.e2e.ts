/**
 * A quick-fire button fired with the number key, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   Quick-fire panels hold "the ten things we do every hour": buttons fired ad hoc, by a
 *   click or by the digits 1 to 9 (the first nine buttons of the tab shown). They never
 *   move the rundown's cursor, so the planned item stays next while the operator fires
 *   something unplanned. This test walks that path in a real Chromium against the real
 *   server, a real SQLite file and a page at `/render/` standing in for OBS.
 *
 * What these tests prove:
 *   - A button made with "+ Atalho" in the seeded panel "Atalhos" appears in the strip.
 *   - Pressing 1 puts that button's item on air: the OBS stand-in draws it and the clock
 *     layer reads "No ar" within 3 seconds, naming the button's label.
 *   - The rundown's cursor does not move: the rundown item made first is still "Próximo",
 *     and with "Prévia automática" on nothing is previewed after the take.
 *
 * What these tests deliberately do not cover:
 *   - F1 to F4, the Macros tab and every digit: QuickFireStripKeys.test.tsx.
 *   - That the server leaves every cursor alone for a panel item: its reducer tests.
 *   - The menu of a button ("Prévia", "Editar", "Mover para rundown"): QuickFireStrip.test.tsx.
 *
 * What it needs: the race clock and the renderer built (`pnpm build`), because the server
 * only registers built graphics and the OBS stand-in is the built renderer.
 *
 * Sharing the server with the other tests:
 *   Every test in this folder runs against the same server. Before each test the server
 *   is emptied (nothing on air, no items, no macros, only the panel "Atalhos"), so this
 *   test passes whatever ran before it, in any order.
 */
import { expect, test } from '@playwright/test';

import { emptyTheServerState } from './emptyTheServerState';
import {
  createRaceClockItemInTheEditor,
  findCentreArea,
  findClockLayerRow,
  findRaceClockInOutputPage,
  openControlPageAndWaitUntilConnected,
  openOutputInItsOwnPage,
} from './previewTestSteps';
import { createRaceClockButtonInPanelShown, findQuickFireArea } from './quickFireTestSteps';

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('a quick-fire button and the number key', () => {
  test('puts the button on air with 1 and leaves the rundown cursor where it was', async ({
    page,
    context,
  }) => {
    // Arrange: OBS's stand-in is open; the rundown holds one item, which has the cursor;
    // the panel "Atalhos" holds one button, the clock of the pit-lane interview.
    const programOutputPage = await openOutputInItsOwnPage(context, '/render/');
    await openControlPageAndWaitUntilConnected(page);
    await createRaceClockItemInTheEditor(page, 'Largada do enduro', 'Enduro — Largada');
    await expect(
      findQuickFireArea(page).getByRole('tab', { name: 'Atalhos' }),
      'the strip must open on the seeded panel "Atalhos"',
    ).toHaveAttribute('aria-selected', 'true');
    await createRaceClockButtonInPanelShown(page, 'Relógio do box', 'Entrevista no box');
    const startRow = page
      .getByRole('region', { name: 'Rundown' })
      .getByRole('listitem', { name: 'Largada do enduro' });
    await expect(startRow, 'the rundown item must have the cursor before the key').toHaveAttribute(
      'aria-current',
      'true',
    );
    // A click on the title leaves the focus on nothing in particular, as an operator's
    // hands would before reaching for the number row.
    await page.getByRole('heading', { name: 'BajaOvrLay' }).click();

    // Act: press 1, the first button of the tab shown.
    await page.keyboard.press('1');

    // Assert: the button's clock is on the program output (the OBS stand-in draws it and
    // the layer says "No ar" within 3 seconds, naming the button)...
    await expect(
      findRaceClockInOutputPage(programOutputPage).getByTestId('race-clock-session-name'),
      '1 must put the first button of "Atalhos" on the program output',
    ).toHaveText('Entrevista no box');
    await expect(
      findClockLayerRow(page),
      'the clock layer must read "No ar" within 3 seconds of the key',
    ).toContainText('No ar', { timeout: 3_000 });
    await expect(
      findClockLayerRow(page),
      'the clock layer must name the button that went on air',
    ).toContainText('Relógio do box');
    // ...and the rundown was not touched: the cursor is still on the start, and no
    // automatic preview followed, because the cursor did not move.
    await expect(
      startRow,
      'a quick-fire button must never move the rundown cursor',
    ).toHaveAttribute('aria-current', 'true');
    await expect(
      findCentreArea(page).getByText('Nada em prévia.'),
      'nothing may be previewed after a quick-fire take, since the cursor did not move',
    ).toBeVisible();

    // Tidy up: close the stand-in page; the next test empties the server.
    await programOutputPage.close();
  });
});
