/**
 * "Tomar" previews the next item, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   With the switch "Prévia automática" on, a take that moves the rundown's cursor on
 *   also shows the item the cursor arrives on in the preview output. Space did it from
 *   BAJAOVRLAY-15; since BAJAOVRLAY-16 the mouse's "Tomar" under the "Prévia" monitor does
 *   it too, so an operator who works with the mouse has the same loop: "Tomar", "Tomar".
 *   This test presses "Tomar" in a real Chromium against the real server, the real
 *   renderer page and a real SQLite file.
 *
 *   As in previewThenTake.e2e.ts, two extra browser pages stand in for the two outputs:
 *   `/render/` for the program output (what OBS loads), `/render/?target=preview` for the
 *   preview output. The shared steps are in previewTestSteps.ts.
 *
 * What these tests prove:
 *   - "Tomar" on the preview of the cursor item puts that item on the program output,
 *     moves the cursor on, and the next item then appears on the preview output (and is
 *     listed under "Prévia") without any other press, while it is NOT on program.
 *
 * What these tests deliberately do not cover:
 *   - The switch turned off, a "Tomar" that leaves the cursor where it was, a refused
 *     take, and the switch in the rundown changing what "Tomar" does; the component
 *     tests (PreviewedLayersListPreviewAfterTake.test.tsx) cover those.
 *   - Space and the arrows: previewKeyboardLoop.e2e.ts.
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
  findRaceClockInOutputPage,
  openControlPageAndWaitUntilConnected,
  openOutputInItsOwnPage,
} from './previewTestSteps';

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('"Tomar" with "Prévia automática" on', () => {
  test('airs the previewed item and shows the next cursor item on the preview output', async ({
    page,
    context,
  }) => {
    // Arrange: both outputs are being watched, the control page is open, and two items
    // are prepared: the start and the finish of the endurance race. The first item made
    // has the cursor; its row's "Prévia" shows it on the preview output.
    const programOutputPage = await openOutputInItsOwnPage(context, '/render/');
    const previewOutputPage = await openOutputInItsOwnPage(context, '/render/?target=preview');
    await openControlPageAndWaitUntilConnected(page);
    await createRaceClockItemInTheEditor(page, 'Largada do enduro', 'Enduro — Largada');
    await createRaceClockItemInTheEditor(page, 'Chegada do enduro', 'Enduro — Chegada');
    const rundownArea = page.getByRole('region', { name: 'Rundown' });
    const startRow = rundownArea.getByRole('listitem', { name: 'Largada do enduro' });
    const finishRow = rundownArea.getByRole('listitem', { name: 'Chegada do enduro' });
    const clockLineUnderPreview = findCentreArea(page)
      .getByRole('list', { name: 'Em prévia' })
      .getByRole('listitem', { name: 'Relógio' });
    const sessionNameOnProgram =
      findRaceClockInOutputPage(programOutputPage).getByTestId('race-clock-session-name');
    const sessionNameOnPreview =
      findRaceClockInOutputPage(previewOutputPage).getByTestId('race-clock-session-name');
    await expect(startRow, 'the first item made must have the cursor').toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(
      rundownArea.getByRole('switch', { name: 'Prévia automática' }),
      '"Prévia automática" must start switched on',
    ).toBeChecked();
    await startRow.getByRole('button', { name: 'Prévia', exact: true }).click();
    await expect(
      sessionNameOnPreview,
      '"Prévia" on the start must show the start on the preview output',
    ).toHaveText('Enduro — Largada');

    // Act: send the preview to air with "Tomar" on the clock line under "Prévia".
    await clockLineUnderPreview.getByRole('button', { name: 'Tomar' }).click();

    // Assert: the start is on air and the cursor moved on to the finish...
    await expect(
      sessionNameOnProgram,
      '"Tomar" must send the previewed start to the program output',
    ).toHaveText('Enduro — Largada');
    await expect(finishRow, 'the take must move the cursor on to the finish').toHaveAttribute(
      'aria-current',
      'true',
    );
    // ...and the finish is on the preview output by itself, listed under "Prévia", and
    // only there: the start is still the one on air.
    await expect(
      sessionNameOnPreview,
      'after "Tomar" the next item, the finish, must appear on the preview output by itself',
    ).toHaveText('Enduro — Chegada');
    await expect(
      clockLineUnderPreview,
      'the finish must be listed under "Prévia" by its label',
    ).toContainText('Chegada do enduro');
    await expect(
      sessionNameOnProgram,
      'the finish must be in preview only, while the start is still on air',
    ).toHaveText('Enduro — Largada');

    // Tidy up: close the two stand-in pages; the next test empties the server.
    await programOutputPage.close();
    await previewOutputPage.close();
  });
});
