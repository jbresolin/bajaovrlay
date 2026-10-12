/**
 * The keyboard loop: Right arrow to preview, Space to air (apps/control, Playwright)
 *
 * What this module is for:
 *   During a show the operator's hands stay on the keyboard. With the switch "Prévia
 *   automática" on, as it starts, moving the cursor with the Right arrow also shows the
 *   item the cursor lands on on the preview output; Space then sends that very preview to
 *   air. This test walks those two keys in a real Chromium against the real server, the
 *   real renderer page and a real SQLite file.
 *
 *   As in previewThenTake.e2e.ts, two extra browser pages stand in for the two outputs:
 *   the program output is a page at `/render/` (what OBS loads), the preview output a
 *   page at `/render/?target=preview`. The shared steps are in previewTestSteps.ts.
 *
 * What these tests prove:
 *   - A cursor the server placed (on the first item made) previews nothing by itself.
 *   - The Right arrow moves the cursor to the next item, and with no other press that
 *     item appears on the preview output and not on the program output.
 *   - Space then sends it to air: the program output draws it, the layer says "No ar"
 *     within 3 seconds, the preview output empties, and the cursor moves on (here past
 *     the last item, so the panel says the rundown ended).
 *
 * What these tests deliberately do not cover:
 *   - What happens AFTER Space with more items left: the cursor moves on to the next
 *     item and that item is not previewed by itself (only a move made by hand previews);
 *     src/features/rundown/RundownPanelPreview.test.tsx proves that rule.
 *   - Shift+Space, Backspace, the switch turned off, and every case of what Space sends;
 *     the component tests and src/keyboard/commandForOperatorKey.test.ts.
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
});
