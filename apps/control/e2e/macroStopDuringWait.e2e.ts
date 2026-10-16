/**
 * "Parar" on a macro during its wait, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   A running macro shows "Parar". Pressing it sends stopMacro; the server's runner sends
 *   no step after the one in progress, cuts a wait short and ends the run. Nothing the
 *   run already did is undone. This test makes such a macro in the editor and stops it
 *   in a real Chromium against the real server and a real SQLite file.
 *
 * What these tests prove:
 *   - A macro of take, wait 5 s, clear the clock layer, stopped with "Parar" during the
 *     wait, ends well before the 5 s are over ("Rodando" leaves its button), and the
 *     clock stays on air past the moment the clear would have come: the clear never ran.
 *
 * What these tests deliberately do not cover:
 *   - The key P, "Parando…", and a refused stop: MacroStop.test.tsx.
 *   - A stop while a step is being sent, the lock freed, and the watchdog: the server's
 *     macroRunnerStop.test.ts and macroRunnerWatchdog.test.ts, with a fake clock.
 *   - What OBS draws: the layer panel is what the server says, which is what the steps
 *     change (as in macroTakeWaitClear.e2e.ts).
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

// The macro's wait. The run must end before it is over, and the clock must still be on
// air a second after it would have been over, which is when the clear would have come.
const macroWaitInMilliseconds = 5_000;
const lookAgainAfterTheTakeInMilliseconds = macroWaitInMilliseconds + 1_000;

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('"Parar" on a macro during its wait', () => {
  test('ends the run before the wait is over and leaves the clock on air', async ({ page }) => {
    // Arrange: "Atalhos" holds the clock button; the macro "Relógio por cinco segundos"
    // (take it, wait 5 s, clear the clock layer) is written in the editor; it is pressed
    // and the clock is on air, the button saying it runs. performance.now() and not
    // Date.now(): this machine's wall clock may be stepped in the middle of a test.
    await openControlPageAndWaitUntilConnected(page);
    await createRaceClockButtonInPanelShown(page, 'Relógio do box', 'Entrevista no box');
    await createTakeWaitAndClearClockMacro(page, {
      macroLabel: 'Relógio por cinco segundos',
      itemLabel: 'Relógio do box',
      waitInSecondsAsTyped: '5',
    });
    const macroList = findQuickFireArea(page).getByRole('list', { name: 'Macros' });
    const macroButton = macroList.getByRole('button', { name: /^Relógio por cinco segundos/ });
    const momentOfThePress = performance.now();
    await macroButton.click();
    await expect(
      findClockLayerRow(page),
      'the macro’s first step must put the clock on air',
    ).toContainText('Relógio do box');
    await expect(macroButton, 'the button must say the macro is at its wait').toContainText(
      'Rodando 2/3',
    );

    // Act: press "Parar" during the wait.
    await macroList
      .getByRole('button', { name: 'Parar macro: Relógio por cinco segundos' })
      .click();

    // Assert: the run ended before the wait was over; then, past the moment the clear
    // would have come, the clock is still on air.
    await expect(macroButton, 'the run must end once "Parar" is pressed').not.toContainText(
      /Rodando|Parando/,
    );
    const millisecondsFromThePressToTheEnd = performance.now() - momentOfThePress;
    expect(
      millisecondsFromThePressToTheEnd,
      'the run must end before its 5 s wait is over: the wait was cut short',
    ).toBeLessThan(macroWaitInMilliseconds);
    // The one sleep this test needs: the clear can only be proven absent once its moment
    // has passed.
    const millisecondsLeftToLookAgain =
      lookAgainAfterTheTakeInMilliseconds - (performance.now() - momentOfThePress);
    await page.waitForTimeout(Math.max(0, millisecondsLeftToLookAgain));
    await expect(
      findClockLayerRow(page),
      'the clock must still be on air: the clear after the wait never ran',
    ).toContainText('Relógio do box');
  });
});
