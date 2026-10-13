/**
 * The keyboard loop: Space, Space, Space (apps/control, Playwright)
 *
 * What this module is for:
 *   During a show the operator's hands stay on the keyboard. With the switch "Prévia
 *   automática" on, as it starts, the item the cursor arrives on is shown on the preview
 *   output: when the operator moves the cursor with an arrow, and (João's ruling, gate 2
 *   of BAJAOVRLAY-15) when a take moves the cursor on. Space sends the preview of the
 *   cursor item to air. So one key walks the whole rundown, and every item is seen
 *   before it airs. These tests press those keys in a real Chromium against the real
 *   server, the real renderer page and a real SQLite file.
 *
 *   As in previewThenTake.e2e.ts, two extra browser pages stand in for the two outputs:
 *   the program output is a page at `/render/` (what OBS loads), the preview output a
 *   page at `/render/?target=preview`. The shared steps are in previewTestSteps.ts.
 *
 * What these tests prove:
 *   - A cursor the server placed (on the first item made) previews nothing by itself.
 *   - The Right arrow moves the cursor to the next item, and with no other press that
 *     item appears on the preview output and not on the program output. Space then
 *     sends it to air and the preview output empties (it was the last item).
 *   - Space, Space, Space on three items: after Shift+Space showed the first, each Space
 *     puts the previewed item on the program output AND shows the next one on the
 *     preview output, so each of the three is seen in preview before it reaches program.
 *   - Backspace with nothing previewed leaves the clock on air (it used to clear it),
 *     and Backspace with a preview showing discards that preview only.
 *
 * What these tests deliberately do not cover:
 *   - Items on different layers, where the automatic preview of the item the cursor
 *     left is thrown away: autoPreviewAcrossLayers.e2e.ts.
 *   - The switch turned off, a refused take, another operator's take, and every case of
 *     what Space sends; the component tests (RundownPanelPreviewAfterTake.test.tsx) and
 *     src/keyboard/commandForOperatorKey.test.ts.
 *   - Space with nothing previewed (`takeNext`); rundownTakeWithSpace.e2e.ts.
 *   - OBS itself: its stand-in is the same `/render/` page in Chromium.
 *
 * What it needs: the race clock and the renderer built (`pnpm build`), because the server
 * only registers built graphics and every renderer page here is the built renderer.
 *
 * Sharing the server with the other tests:
 *   Every test in this folder runs against the same server. Before each test the server
 *   is emptied (nothing on air, nothing previewed, no item in the rundown), so this test
 *   passes whatever ran before it, in any order.
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

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('the keyboard loop with "Prévia automática" on', () => {
  test('previews the next item with the Right arrow and sends it to air with Space', async ({
    page,
    context,
  }) => {
    // Arrange: both outputs are being watched, the control page is open, and two items
    // are prepared: the start and the finish of the endurance race. The first item made
    // gets the cursor (the server puts it there); nothing is previewed by that.
    const programOutputPage = await openOutputInItsOwnPage(context, '/render/');
    const previewOutputPage = await openOutputInItsOwnPage(context, '/render/?target=preview');
    await openControlPageAndWaitUntilConnected(page);
    await createRaceClockItemInTheEditor(page, 'Largada do enduro', 'Enduro — Largada');
    await createRaceClockItemInTheEditor(page, 'Chegada do enduro', 'Enduro — Chegada');
    const rundownArea = page.getByRole('region', { name: 'Rundown' });
    const startRow = rundownArea.getByRole('listitem', { name: 'Largada do enduro' });
    const finishRow = rundownArea.getByRole('listitem', { name: 'Chegada do enduro' });
    const centreArea = findCentreArea(page);
    const clockLayerRow = findClockLayerRow(page);
    await expect(startRow, 'the first item made must have the cursor').toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(
      rundownArea.getByRole('switch', { name: 'Prévia automática' }),
      '"Prévia automática" must start switched on',
    ).toBeChecked();
    await expect(
      centreArea.getByText('Nada em prévia.'),
      'a cursor the server placed must preview nothing by itself',
    ).toBeVisible();
    // The keys are for the page, not for a field: click the page's title, which is no
    // control, so the keyboard focus is on the page itself.
    await page.getByRole('heading', { name: 'BajaOvrLay' }).click();

    // Act: press the Right arrow.
    await page.keyboard.press('ArrowRight');

    // Assert: the cursor moved to the finish, and the finish is previewed without any
    // other press: it is on the preview output and not on the program output.
    await expect(finishRow, 'the Right arrow must move the cursor to the finish').toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(
      findRaceClockInOutputPage(previewOutputPage).getByTestId('race-clock-session-name'),
      'with "Prévia automática" on, the item the cursor landed on must appear on the preview output',
    ).toHaveText('Enduro — Chegada');
    await expect(
      findRaceClockInOutputPage(programOutputPage),
      'the Right arrow must put nothing on the program output',
    ).toHaveCount(0);
    await expect(clockLayerRow, 'the Right arrow must put nothing on air').toContainText('vazia');

    // Act: press Space.
    await page.keyboard.press('Space');

    // Assert: the previewed finish went on air (within the 3 seconds of every take), the
    // preview emptied, and the cursor moved on past the last item.
    await expect(
      clockLayerRow,
      'the layer panel must say "No ar" within 3 seconds of Space, once the program output has reported the clock',
    ).toContainText('No ar', { timeout: 3_000 });
    await expect(
      findRaceClockInOutputPage(programOutputPage).getByTestId('race-clock-session-name'),
      'Space must send to air the item that was previewed',
    ).toHaveText('Enduro — Chegada');
    await expect(
      clockLayerRow,
      'the layer panel must name the item Space put on air',
    ).toContainText('Chegada do enduro');
    await expect(
      findRaceClockInOutputPage(previewOutputPage),
      'after Space the preview output must be empty: the preview itself went on air',
    ).toHaveCount(0);
    await expect(
      centreArea.getByText('Nada em prévia.'),
      'after Space the page must say nothing is previewed',
    ).toBeVisible();
    await expect(
      rundownArea.getByText('Fim do rundown — clique num item para posicionar o cursor'),
      'the finish was the last item and was taken at the cursor, so the rundown has ended',
    ).toBeVisible();

    // Tidy up: close the two stand-in pages. The items and the clock are left behind on
    // purpose: the next test, whichever it is, empties the server before it starts.
    await programOutputPage.close();
    await previewOutputPage.close();
  });

  test('walks three items with Space alone, each one seen in preview before it airs', async ({
    page,
    context,
  }) => {
    // Arrange: both outputs are being watched, the control page is open, and three items
    // are prepared: the start, a yellow flag and the finish of the endurance race. The
    // first item made has the cursor; nothing is previewed yet.
    const programOutputPage = await openOutputInItsOwnPage(context, '/render/');
    const previewOutputPage = await openOutputInItsOwnPage(context, '/render/?target=preview');
    await openControlPageAndWaitUntilConnected(page);
    await createRaceClockItemInTheEditor(page, 'Largada do enduro', 'Enduro — Largada');
    await createRaceClockItemInTheEditor(page, 'Bandeira amarela', 'Enduro — Bandeira amarela');
    await createRaceClockItemInTheEditor(page, 'Chegada do enduro', 'Enduro — Chegada');
    const rundownArea = page.getByRole('region', { name: 'Rundown' });
    const startRow = rundownArea.getByRole('listitem', { name: 'Largada do enduro' });
    const yellowFlagRow = rundownArea.getByRole('listitem', { name: 'Bandeira amarela' });
    const finishRow = rundownArea.getByRole('listitem', { name: 'Chegada do enduro' });
    const centreArea = findCentreArea(page);
    const clockLayerRow = findClockLayerRow(page);
    const sessionNameOnProgram =
      findRaceClockInOutputPage(programOutputPage).getByTestId('race-clock-session-name');
    const sessionNameOnPreview =
      findRaceClockInOutputPage(previewOutputPage).getByTestId('race-clock-session-name');
    await expect(startRow, 'the first item made must have the cursor').toHaveAttribute(
      'aria-current',
      'true',
    );
    // The keys are for the page, not for a field: click the page's title.
    await page.getByRole('heading', { name: 'BajaOvrLay' }).click();

    // Act: Shift+Space, to look at the first item before the loop starts.
    await page.keyboard.press('Shift+Space');

    // Assert: the start is on the preview output, and nothing is on air yet.
    await expect(
      sessionNameOnPreview,
      'Shift+Space must show the item at the cursor on the preview output',
    ).toHaveText('Enduro — Largada');
    await expect(
      findRaceClockInOutputPage(programOutputPage),
      'nothing may be on the program output before the first Space',
    ).toHaveCount(0);

    // Act: the first Space.
    await page.keyboard.press('Space');

    // Assert: the start is on air, the cursor moved on to the yellow flag, and the yellow
    // flag is already on the preview output without any other press. At this moment it is
    // in preview and NOT on program: it is being seen before it airs.
    await expect(
      sessionNameOnProgram,
      'the first Space must send the previewed start to air',
    ).toHaveText('Enduro — Largada');
    await expect(
      yellowFlagRow,
      'the take must move the cursor on to the yellow flag',
    ).toHaveAttribute('aria-current', 'true');
    await expect(
      sessionNameOnPreview,
      'after the take the next item, the yellow flag, must appear on the preview output by itself',
    ).toHaveText('Enduro — Bandeira amarela');
    await expect(
      sessionNameOnProgram,
      'the yellow flag must be in preview only, while the start is still on air',
    ).toHaveText('Enduro — Largada');

    // Act: the second Space.
    await page.keyboard.press('Space');

    // Assert: the yellow flag is on air, the cursor moved on to the finish, and the
    // finish is on the preview output, again before it airs.
    await expect(
      sessionNameOnProgram,
      'the second Space must send the previewed yellow flag to air',
    ).toHaveText('Enduro — Bandeira amarela');
    await expect(finishRow, 'the take must move the cursor on to the finish').toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(
      sessionNameOnPreview,
      'after the second take the finish must appear on the preview output by itself',
    ).toHaveText('Enduro — Chegada');
    await expect(
      sessionNameOnProgram,
      'the finish must be in preview only, while the yellow flag is still on air',
    ).toHaveText('Enduro — Bandeira amarela');

    // Act: the third Space.
    await page.keyboard.press('Space');

    // Assert: the finish is on air; it was the last item, so nothing is previewed after
    // it and the rundown has ended.
    await expect(
      sessionNameOnProgram,
      'the third Space must send the previewed finish to air',
    ).toHaveText('Enduro — Chegada');
    await expect(
      clockLayerRow,
      'the layer panel must say "No ar" within 3 seconds of the last Space',
    ).toContainText('No ar', { timeout: 3_000 });
    await expect(
      centreArea.getByText('Nada em prévia.'),
      'after the last item there is no next item, so nothing may be previewed',
    ).toBeVisible();
    await expect(
      findRaceClockInOutputPage(previewOutputPage),
      'the preview output must be empty after the last item was taken',
    ).toHaveCount(0);
    await expect(
      rundownArea.getByText('Fim do rundown — clique num item para posicionar o cursor'),
      'the finish was the last item, so the rundown has ended',
    ).toBeVisible();

    // Act: press Backspace with nothing previewed and the finish on air. Then press
    // "Prévia" on the start: the server handles commands in the order they arrive, so
    // once that preview is on the preview output, a clear sent by Backspace would have
    // happened already.
    await page.keyboard.press('Backspace');
    await startRow.getByRole('button', { name: 'Prévia' }).click();
    await expect(
      sessionNameOnPreview,
      '"Prévia" on the start must show the start on the preview output',
    ).toHaveText('Enduro — Largada');

    // Assert: the finish is still on air. Backspace with nothing previewed sends nothing;
    // until gate 2 it cleared the clock layer.
    await expect(
      sessionNameOnProgram,
      'Backspace with nothing previewed must not take the clock off the program output',
    ).toHaveText('Enduro — Chegada');
    await expect(
      clockLayerRow,
      'the layer panel must still say the clock is on air after that Backspace',
    ).toContainText('No ar');

    // Act: press Backspace again, now with the start in preview. The click left the
    // focus on the "Prévia" button, where Backspace is still the page's key.
    await page.keyboard.press('Backspace');

    // Assert: the preview is discarded, and the finish is still on air.
    await expect(
      centreArea.getByText('Nada em prévia.'),
      'Backspace with a preview showing must discard that preview',
    ).toBeVisible();
    await expect(
      findRaceClockInOutputPage(previewOutputPage),
      'the preview output must be empty after Backspace',
    ).toHaveCount(0);
    await expect(
      sessionNameOnProgram,
      'discarding a preview must leave the program output alone',
    ).toHaveText('Enduro — Chegada');

    // Tidy up: close the two stand-in pages; the next test empties the server.
    await programOutputPage.close();
    await previewOutputPage.close();
  });
});
