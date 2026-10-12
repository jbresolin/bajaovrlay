/**
 * Previewing an item, then sending the preview to air, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   Nothing should go on air without being seen first. The operator previews an item
 *   (its row's "Prévia" button, or just by moving the cursor while "Prévia automática" is
 *   on), sees it in the "Prévia" monitor drawn by the same renderer page OBS uses, and
 *   sends that very preview to air ("Tomar", or Space). These tests walk that path in a
 *   real Chromium against the real server, the real renderer page and a real SQLite file.
 *
 *   Two extra browser pages stand in for the two outputs, as `/render/` stands in for OBS
 *   in the other files of this folder: the program output is a page at `/render/`, and
 *   the preview output is a page at `/render/?target=preview`. What they draw is the
 *   truth about each output; the two monitor frames of the control page are the same
 *   renderer page, so they are checked alongside.
 *
 * What these tests prove:
 *   - "Prévia" on a row puts the item on the preview output and NOT on the program
 *     output: the clock appears in the preview stand-in and in the "Prévia" frame, the
 *     program stand-in and the "Programa" frame stay empty, the clock layer still says
 *     "vazia" and carries the chip "em prévia", and the item is listed under "Prévia".
 *   - "Tomar" sends it to air: the clock appears in the program stand-in, the layer says
 *     "No ar" within 3 seconds, the preview stand-in empties and the page says "Nada em
 *     prévia.".
 *   - Reloading the control page keeps the program (the layer still names the item, the
 *     program stand-in still draws it), and the preview that was taken stays gone.
 *   - A preview that was NOT taken survives a reload of the control page, because it is
 *     the server's state and not the page's; "Descartar" removes it, and after another
 *     reload it does not come back. The program output is untouched throughout.
 *
 * The steps both preview files share (opening the pages, finding the clock, preparing an
 * item) are in previewTestSteps.ts.
 *
 * What these tests deliberately do not cover:
 *   - That previews are dropped when the SERVER restarts (the brief's "loses preview").
 *     Restarting the shared server in the middle of this run would break the other test
 *     files; apps/server's storeRestartDropsPreviews.test.ts proves it.
 *   - That the clock taken from a preview starts counting at the take and not at the
 *     preview; apps/server's takePreview.test.ts proves the stamp.
 *   - The Right arrow previewing and Space sending the preview to air;
 *     previewKeyboardLoop.e2e.ts.
 *   - "Prévia" of "Edição rápida", Shift+Space, Backspace and the switch turned off; the
 *     component tests (QuickEditPanelPreview, RundownPanelPreviewKeys, App,
 *     RundownPanelPreview) and src/keyboard/commandForOperatorKey.test.ts cover those.
 *   - What the preview page does and does not report; the renderer's previewPage.e2e.ts.
 *   - OBS itself: its stand-in is the same `/render/` page in Chromium.
 *
 * What it needs: the race clock and the renderer built (`pnpm build`), because the server
 * only registers built graphics and every renderer page here is the built renderer.
 *
 * Sharing the server with the other tests:
 *   Every test in this folder runs against the same server. Before each test the server
 *   is emptied (nothing on air, nothing previewed, no item in the rundown), so a test
 *   here passes whatever ran before it, in any order.
 */
import { expect, test } from '@playwright/test';

import { emptyTheServerState } from './emptyTheServerState';
import {
  createRaceClockItemInTheEditor,
  findCentreArea,
  findClockLayerRow,
  findRaceClockInMonitorFrame,
  findRaceClockInOutputPage,
  openControlPageAndWaitUntilConnected,
  openOutputInItsOwnPage,
} from './previewTestSteps';

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('previewing an item and sending the preview to air', () => {
  test('shows the item in "Prévia" and not in "Programa", sends it to air with "Tomar", and keeps the program across a reload', async ({
    page,
    context,
  }) => {
    // Arrange: both outputs are being watched (a page at /render/ stands in for OBS, a
    // page at /render/?target=preview for the preview output), the control page is open,
    // and the start of the endurance race is prepared as an item.
    const programOutputPage = await openOutputInItsOwnPage(context, '/render/');
    const previewOutputPage = await openOutputInItsOwnPage(context, '/render/?target=preview');
    await openControlPageAndWaitUntilConnected(page);
    await createRaceClockItemInTheEditor(page, 'Largada do enduro', 'Enduro — Largada');
    const startRow = page
      .getByRole('region', { name: 'Rundown' })
      .getByRole('listitem', { name: 'Largada do enduro' });
    const clockLayerRow = findClockLayerRow(page);
    const centreArea = findCentreArea(page);
    const linesUnderPreview = centreArea.getByRole('list', { name: 'Em prévia' });
    await expect(
      centreArea.getByText('Nada em prévia.'),
      'preparing an item must preview nothing by itself',
    ).toBeVisible();

    // Act: press "Prévia" on the item's row.
    await startRow.getByRole('button', { name: 'Prévia', exact: true }).click();

    // Assert: the clock is on the preview output, with the item's session name...
    await expect(
      findRaceClockInOutputPage(previewOutputPage).getByTestId('race-clock-session-name'),
      'the preview output must draw the item, with the session name the item holds',
    ).toHaveText('Enduro — Largada');
    await expect(
      findRaceClockInMonitorFrame(page, 'Prévia').getByTestId('race-clock-session-name'),
      'the "Prévia" monitor of the control page must draw the same item',
    ).toHaveText('Enduro — Largada');
    // ...it is listed under the "Prévia" monitor, by its layer and its label...
    await expect(
      linesUnderPreview.getByRole('listitem', { name: 'Relógio' }),
      'the previewed item must be listed under "Prévia" with its label',
    ).toContainText('Largada do enduro');
    await expect(clockLayerRow, 'the clock layer must carry the chip "em prévia"').toContainText(
      'em prévia',
    );
    // ...and it is NOT on air. The preview stand-in drawing it (above) shows the server
    // has already told every page; so a program page that were going to draw it would
    // have been told too.
    await expect(
      findRaceClockInOutputPage(programOutputPage),
      'a previewed item must NOT be drawn on the program output',
    ).toHaveCount(0);
    await expect(
      findRaceClockInMonitorFrame(page, 'Programa'),
      'a previewed item must NOT be drawn in the "Programa" monitor',
    ).toHaveCount(0);
    await expect(
      clockLayerRow,
      'nothing went on air: the clock layer must still say "vazia"',
    ).toContainText('vazia');

    // Act: send the preview to air with "Tomar".
    await linesUnderPreview
      .getByRole('listitem', { name: 'Relógio' })
      .getByRole('button', { name: 'Tomar' })
      .click();

    // Assert: the clock is on the program output, and the layer says "No ar" within 3
    // seconds (the program page played the clock in and reported it; same limit as a take).
    await expect(
      clockLayerRow,
      'the layer panel must say "No ar" within 3 seconds of "Tomar", once the program output has reported the clock',
    ).toContainText('No ar', { timeout: 3_000 });
    await expect(
      findRaceClockInOutputPage(programOutputPage).getByTestId('race-clock-session-name'),
      'after "Tomar" the program output must draw what was previewed',
    ).toHaveText('Enduro — Largada');
    await expect(
      clockLayerRow,
      'the layer panel must name the item that went on air from the preview',
    ).toContainText('Largada do enduro');
    // The preview is empty again, on the output itself and on the control page.
    await expect(
      findRaceClockInOutputPage(previewOutputPage),
      'after "Tomar" the preview output must be empty',
    ).toHaveCount(0);
    await expect(
      centreArea.getByText('Nada em prévia.'),
      'after "Tomar" the page must say nothing is previewed',
    ).toBeVisible();
    await expect(
      clockLayerRow,
      'after "Tomar" the clock layer must no longer carry the chip',
    ).not.toContainText('em prévia');

    // Act: reload the control page, as an operator does when the browser misbehaves.
    await page.reload();

    // Assert: the program was kept, because it lives on the server; and the preview that
    // was taken did not come back.
    await expect(
      clockLayerRow,
      'after a reload the layer panel must still name the item that is on air',
    ).toContainText('Largada do enduro');
    await expect(
      findRaceClockInOutputPage(programOutputPage).getByTestId('race-clock-session-name'),
      'a reload of the control page must leave the program output as it was',
    ).toHaveText('Enduro — Largada');
    await expect(
      centreArea.getByText('Nada em prévia.'),
      'after a reload the taken preview must still be gone',
    ).toBeVisible();
    await expect(
      findRaceClockInOutputPage(previewOutputPage),
      'after a reload the preview output must still be empty',
    ).toHaveCount(0);

    // Tidy up: close the two stand-in pages. The item and the clock are left behind on
    // purpose: the next test, whichever it is, empties the server before it starts.
    await programOutputPage.close();
    await previewOutputPage.close();
  });

  test('keeps a preview that was not taken across a reload, removes it with "Descartar", and it does not come back', async ({
    page,
    context,
  }) => {
    // Arrange: both outputs are being watched, the control page is open, an item is
    // prepared and previewed.
    const programOutputPage = await openOutputInItsOwnPage(context, '/render/');
    const previewOutputPage = await openOutputInItsOwnPage(context, '/render/?target=preview');
    await openControlPageAndWaitUntilConnected(page);
    await createRaceClockItemInTheEditor(page, 'Bandeira amarela', 'Enduro — Bandeira amarela');
    const centreArea = findCentreArea(page);
    const lineOfTheClockLayer = centreArea
      .getByRole('list', { name: 'Em prévia' })
      .getByRole('listitem', { name: 'Relógio' });
    await page
      .getByRole('region', { name: 'Rundown' })
      .getByRole('listitem', { name: 'Bandeira amarela' })
      .getByRole('button', { name: 'Prévia', exact: true })
      .click();
    await expect(
      findRaceClockInOutputPage(previewOutputPage).getByTestId('race-clock-session-name'),
      'the preview output must draw the item before the reload',
    ).toHaveText('Enduro — Bandeira amarela');

    // Act: reload the control page.
    await page.reload();

    // Assert: the preview is still there. It is the server's state, not the page's, so a
    // page reload loses nothing; only a restart of the server drops previews.
    await expect(
      lineOfTheClockLayer,
      'a preview must still be listed after a reload of the control page',
    ).toContainText('Bandeira amarela');
    await expect(
      findRaceClockInOutputPage(previewOutputPage).getByTestId('race-clock-session-name'),
      'a reload of the control page must leave the preview output as it was',
    ).toHaveText('Enduro — Bandeira amarela');

    // Act: throw the preview away with "Descartar".
    await lineOfTheClockLayer.getByRole('button', { name: 'Descartar' }).click();

    // Assert: the preview is gone from the output and from the page.
    await expect(
      findRaceClockInOutputPage(previewOutputPage),
      'after "Descartar" the preview output must be empty',
    ).toHaveCount(0);
    await expect(
      centreArea.getByText('Nada em prévia.'),
      'after "Descartar" the page must say nothing is previewed',
    ).toBeVisible();

    // Act: reload once more.
    await page.reload();

    // Assert: the discarded preview did not come back, and nothing ever went on air.
    await expect(
      centreArea.getByText('Nada em prévia.'),
      'a discarded preview must not come back after a reload',
    ).toBeVisible();
    await expect(
      findRaceClockInOutputPage(previewOutputPage),
      'the preview output must still be empty after the reload',
    ).toHaveCount(0);
    await expect(
      findRaceClockInOutputPage(programOutputPage),
      'previewing and discarding must never put anything on the program output',
    ).toHaveCount(0);
    await expect(
      findClockLayerRow(page),
      'previewing and discarding must leave the clock layer "vazia"',
    ).toContainText('vazia');

    // Tidy up: close the two stand-in pages.
    await programOutputPage.close();
    await previewOutputPage.close();
  });
});
