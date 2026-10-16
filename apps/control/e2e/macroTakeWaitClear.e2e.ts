/**
 * A macro of take, wait and clear, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   A macro is one button that runs several steps in a row, on the server: each step is
 *   sent by the server's macro runner, and a wait holds the next step back. This test
 *   writes a macro in the macro editor ("Macros" tab, "+ Macro") and runs it in a real
 *   Chromium against the real server and a real SQLite file.
 *
 * What these tests prove:
 *   - A macro of three steps — put a clock button on air, wait 0,5 s, clear the clock
 *     layer — made in the editor appears on the Macros tab.
 *   - A click on it puts the clock on air (the clock layer names the button), and the
 *     clock layer is "vazia" again by itself: not sooner than 400 ms after the click (the
 *     wait was kept) and no later than 3 s (the wait did not hang).
 *
 * What these tests deliberately do not cover:
 *   - The running state on the button ("Rodando 2/3"): it lasts about half a second, too
 *     short to read reliably here; MacroGrid.test.tsx proves it from the macroRuns slice.
 *   - What OBS draws: no stand-in page is opened, because the clock is on air for only half
 *     a second, less than a first load of the clock's package may take; the layer panel
 *     is what the server says, which is what the steps change.
 *   - A failing step, a second run while one runs, and the exact order of the steps: the
 *     server's macroRunner.test.ts, with a fake clock. "Parar": macroStopDuringWait.e2e.ts.
 *   - Every control of the editor: MacroEditorPanel.test.tsx.
 *
 * What it needs: the race clock and the renderer built (`pnpm build`).
 *
 * Sharing the server with the other tests:
 *   Before each test the server is emptied, macros included, and the reset waits for a
 *   running macro to end, so this test passes whatever ran before it, in any order.
 */
import { expect, test } from '@playwright/test';

import { emptyTheServerState } from './emptyTheServerState';
import { findClockLayerRow, openControlPageAndWaitUntilConnected } from './previewTestSteps';
import {
  createRaceClockButtonInPanelShown,
  createTakeWaitAndClearClockMacro,
  findQuickFireArea,
} from './quickFireTestSteps';

// The macro's wait, and the window the clear must fall in after the click: never before
// the wait has passed (less a margin for the moment of the click itself), and no later
// than 3 s, the limit every "No ar" check of this folder uses too.
const earliestClearAfterTheClickInMilliseconds = 400;
const latestClearAfterTheClickInMilliseconds = 3_000;

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('a macro of take, wait and clear', () => {
  test('puts the clock on air and leaves the layer empty about half a second later', async ({
    page,
  }) => {
    // Arrange: "Atalhos" holds the clock button the macro takes; the macro is written in
    // the editor and listed on the Macros tab; the clock layer is empty.
    await openControlPageAndWaitUntilConnected(page);
    await createRaceClockButtonInPanelShown(page, 'Relógio do box', 'Entrevista no box');
    await createTakeWaitAndClearClockMacro(page, {
      macroLabel: 'Relógio por meio segundo',
      itemLabel: 'Relógio do box',
      waitInSecondsAsTyped: '0,5',
    });
    const macroButton = findQuickFireArea(page)
      .getByRole('list', { name: 'Macros' })
      .getByRole('button', { name: /^Relógio por meio segundo/ });
    await expect(macroButton, 'the macro must be listed on the Macros tab').toBeVisible();
    await expect(findClockLayerRow(page), 'the clock layer must start empty').toContainText(
      'vazia',
    );

    // Act: click the macro, noting the moment. performance.now() and not Date.now(): the
    // machine's wall clock may be stepped by a time sync in the middle of the test (seen
    // on WSL, about 11 s back), and a duration must be read from a clock that only goes on.
    const momentOfTheClick = performance.now();
    await macroButton.click();

    // Assert: the clock went on air (its layer names the button), then the layer is
    // empty again within the window: the wait was kept, and the clear followed it.
    await expect(
      findClockLayerRow(page),
      'the macro’s first step must put the clock button on air',
    ).toContainText('Relógio do box');
    await expect(
      findClockLayerRow(page),
      'the macro’s last step must leave the clock layer empty within 3 seconds',
    ).toContainText('vazia', { timeout: latestClearAfterTheClickInMilliseconds });
    const millisecondsFromTheClickToTheClear = performance.now() - momentOfTheClick;
    expect(
      millisecondsFromTheClickToTheClear,
      'the clear must come after the half-second wait, not straight after the take',
    ).toBeGreaterThanOrEqual(earliestClearAfterTheClickInMilliseconds);
  });
});
