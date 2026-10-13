/**
 * "Prévia automática" across layers: only the item at the cursor stays in preview
 * (apps/control, Playwright)
 *
 * What this module is for:
 *   Items of a rundown can live on different layers, and a preview only replaces the
 *   preview of its own layer. So an operator arrowing down the rundown with "Prévia
 *   automática" on used to leave a preview behind on every layer the cursor passed.
 *   João's ruling (gate 2 of BAJAOVRLAY-15): an automatic preview first throws away
 *   every other AUTOMATIC preview; a preview the operator asked for by hand (a row's
 *   "Prévia" button) stays. This test arrows across two layers in a real Chromium
 *   against the real server and watches the real preview output.
 *
 * What these tests prove:
 *   - Arrowing from an item on the "Relógio" layer to an item on the "Tarja" layer
 *     leaves only the second in preview: the preview output draws it on the "Tarja"
 *     layer and draws nothing on the "Relógio" layer any more, and the page lists one
 *     preview line.
 *   - A preview asked for with a row's "Prévia" button is NOT thrown away by the next
 *     arrow to an item on another layer: both are then in preview.
 *   - Nothing of this touches the program output.
 *
 * What these tests deliberately do not cover:
 *   - Every combination of automatic and manual previews: apps/server's
 *     previewItemOrigin.test.ts, row by row.
 *   - Space; previewKeyboardLoop.e2e.ts.
 *   - A real lower third: both items use the race clock graphic, the only graphic these
 *     tests can count on being built; the second is simply prepared on the "Tarja" layer.
 *
 * What it needs: the race clock and the renderer built (`pnpm build`).
 *
 * Sharing the server with the other tests:
 *   Before each test the server is emptied, so this test passes whatever ran before it.
 */
import { expect, test } from '@playwright/test';

import { emptyTheServerState } from './emptyTheServerState';
import {
  createRaceClockItemInTheEditor,
  findCentreArea,
  findRaceClockInOutputPage,
  findRaceClockOnLowerThirdLayerOfOutputPage,
  openControlPageAndWaitUntilConnected,
  openOutputInItsOwnPage,
} from './previewTestSteps';

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('arrowing across layers with "Prévia automática" on', () => {
  test('leaves only the item at the cursor in preview, and keeps a preview asked for by hand', async ({
    page,
    context,
  }) => {
    // Arrange: both outputs are being watched, and three items are prepared: the start
    // (it gets the cursor) and a yellow flag on the "Relógio" layer, and a sponsor clock
    // on the "Tarja" layer.
    const programOutputPage = await openOutputInItsOwnPage(context, '/render/');
    const previewOutputPage = await openOutputInItsOwnPage(context, '/render/?target=preview');
    await openControlPageAndWaitUntilConnected(page);
    await createRaceClockItemInTheEditor(page, 'Largada do enduro', 'Enduro — Largada');
    await createRaceClockItemInTheEditor(page, 'Bandeira amarela', 'Enduro — Bandeira amarela');
    await createRaceClockItemInTheEditor(
      page,
      'Relógio do patrocinador',
      'Enduro — Patrocinador',
      'Tarja',
    );
    const rundownArea = page.getByRole('region', { name: 'Rundown' });
    const startRow = rundownArea.getByRole('listitem', { name: 'Largada do enduro' });
    const sponsorRow = rundownArea.getByRole('listitem', { name: 'Relógio do patrocinador' });
    const previewLines = findCentreArea(page).getByRole('list', { name: 'Em prévia' });
    const clockLayerOfPreview = findRaceClockInOutputPage(previewOutputPage);
    const lowerThirdLayerOfPreview = findRaceClockOnLowerThirdLayerOfOutputPage(previewOutputPage);
    await expect(startRow, 'the first item made must have the cursor').toHaveAttribute(
      'aria-current',
      'true',
    );
    // The keys are for the page, not for a field: click the page's title.
    await page.getByRole('heading', { name: 'BajaOvrLay' }).click();

    // Act: the Right arrow, to the yellow flag on the "Relógio" layer.
    await page.keyboard.press('ArrowRight');

    // Assert: the yellow flag is previewed on the "Relógio" layer.
    await expect(
      clockLayerOfPreview.getByTestId('race-clock-session-name'),
      'the first arrow must preview the yellow flag on the "Relógio" layer',
    ).toHaveText('Enduro — Bandeira amarela');

    // Act: the Right arrow again, to the sponsor clock on the "Tarja" layer.
    await page.keyboard.press('ArrowRight');

    // Assert: the sponsor clock is previewed on the "Tarja" layer, and the yellow flag's
    // automatic preview is gone although it was on another layer: one preview is left.
    await expect(sponsorRow, 'the second arrow must move the cursor').toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(
      lowerThirdLayerOfPreview.getByTestId('race-clock-session-name'),
      'the second arrow must preview the sponsor clock on the "Tarja" layer',
    ).toHaveText('Enduro — Patrocinador');
    await expect(
      clockLayerOfPreview,
      'the automatic preview of the item the cursor left must be thrown away',
    ).toHaveCount(0);
    await expect(
      previewLines.getByRole('listitem'),
      'the page must list one preview only: the item at the cursor',
    ).toHaveCount(1);

    // Act: ask for the sponsor clock by hand with its row's "Prévia" (it is now a preview
    // the operator asked for, on the "Tarja" layer), then arrow back to the yellow flag
    // on the "Relógio" layer. The server handles the two commands in the order sent.
    await sponsorRow.getByRole('button', { name: 'Prévia' }).click();
    // The click left the focus on a button; the title is no control, so the next key is
    // for the page itself.
    await page.getByRole('heading', { name: 'BajaOvrLay' }).click();
    await page.keyboard.press('ArrowLeft');

    // Assert: the yellow flag is previewed on "Relógio", and the sponsor clock, asked for
    // by hand on another layer, is still in preview: two previews.
    await expect(
      clockLayerOfPreview.getByTestId('race-clock-session-name'),
      'the arrow must preview the yellow flag on the "Relógio" layer',
    ).toHaveText('Enduro — Bandeira amarela');
    await expect(
      previewLines.getByRole('listitem'),
      'the page must list both previews: the one asked for by hand and the item at the cursor',
    ).toHaveCount(2);
    await expect(
      lowerThirdLayerOfPreview.getByTestId('race-clock-session-name'),
      'a preview asked for by hand must survive the automatic preview of another layer',
    ).toHaveText('Enduro — Patrocinador');
    await expect(
      findRaceClockInOutputPage(programOutputPage),
      'none of this may put anything on the program output',
    ).toHaveCount(0);

    // Tidy up: close the two stand-in pages; the next test empties the server.
    await programOutputPage.close();
    await previewOutputPage.close();
  });
});
