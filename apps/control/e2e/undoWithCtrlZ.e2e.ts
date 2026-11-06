/**
 * Ctrl+Z puts back the take before, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   A wrong take is put right with one press (concept §7 rule 5, BAJAOVRLAY-30). The
 *   server remembers what each layer showed before its last changes; Ctrl+Z on the control
 *   page is "Desfazer última", which puts back the newest change. This test walks that
 *   path in a real Chromium against the real server, a real SQLite file and a page at
 *   `/render/` standing in for OBS, so "back on air" means back on the program output.
 *
 * What these tests prove:
 *   - Two quick-fire buttons on the clock layer, taken one after the other with 1 and 2;
 *     then Ctrl+Z: the OBS stand-in draws the first one again, and its Camadas row names it.
 *
 * What these tests deliberately do not cover:
 *   - "Desfazer" on one row, "Limpar tudo" brought back whole, refusals, the history across
 *     a restart: the server's undoOnProgram.test.ts and storeProgramHistory.test.ts.
 *   - The buttons' tooltips and Ctrl+Z in a text field: UndoButtons.test.tsx.
 *
 * What it needs: the race clock and the renderer built (`pnpm build`), because the server
 * only registers built graphics and the OBS stand-in is the built renderer.
 *
 * Sharing the server with the other tests:
 *   Every test in this folder runs against the same server. Before each test the server
 *   is emptied (nothing on air, no items, only the panel "Atalhos"), so this test passes
 *   whatever ran before it. What the history remembers from that emptying is older than
 *   the two takes here, so Ctrl+Z undoes the second take whatever came before.
 */
import { expect, test } from '@playwright/test';

import { emptyTheServerState } from './emptyTheServerState';
import {
  findClockLayerRow,
  findRaceClockInOutputPage,
  openControlPageAndWaitUntilConnected,
  openOutputInItsOwnPage,
} from './previewTestSteps';
import { createRaceClockButtonInPanelShown } from './quickFireTestSteps';

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('Ctrl+Z, "Desfazer última"', () => {
  test('puts the first of two takes back on the program output', async ({ page, context }) => {
    // Arrange: OBS's stand-in is open; "Atalhos" holds the pit-lane interview clock and
    // the start clock; 1 takes the interview clock, then 2 takes the start clock over it.
    const programOutputPage = await openOutputInItsOwnPage(context, '/render/');
    await openControlPageAndWaitUntilConnected(page);
    await createRaceClockButtonInPanelShown(page, 'Relógio do box', 'Entrevista no box');
    await createRaceClockButtonInPanelShown(page, 'Relógio da largada', 'Enduro — Largada');
    // A click on the title leaves the focus on nothing in particular, as an operator's
    // hands would before reaching for the keyboard.
    await page.getByRole('heading', { name: 'BajaOvrLay' }).click();
    const sessionNameOnAir =
      findRaceClockInOutputPage(programOutputPage).getByTestId('race-clock-session-name');
    await page.keyboard.press('1');
    await expect(sessionNameOnAir, '1 must put the interview clock on air').toHaveText(
      'Entrevista no box',
    );
    await page.keyboard.press('2');
    await expect(sessionNameOnAir, '2 must put the start clock on air over it').toHaveText(
      'Enduro — Largada',
    );

    // Act: press Ctrl+Z.
    await page.keyboard.press('Control+z');

    // Assert: the interview clock is back on the program output, and Camadas names it.
    await expect(
      sessionNameOnAir,
      'Ctrl+Z must put back on air what the clock layer showed before the last take',
    ).toHaveText('Entrevista no box');
    await expect(
      findClockLayerRow(page),
      'the clock layer must name the button that came back',
    ).toContainText('Relógio do box');

    // Tidy up: close the stand-in page; the next test empties the server.
    await programOutputPage.close();
  });
});
