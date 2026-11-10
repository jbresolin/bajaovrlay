/**
 * A battle for 2nd place, made with one pick, on the program output (apps/control, Playwright)
 *
 * What this module is for:
 *   The item editor fills a graphic's fields about one car by choosing that car once
 *   (BAJAOVRLAY-66). On the battle card, "Disputa pela 2ª posição" picks both cars by
 *   place, the car ahead at the 2nd and the car behind at the 3rd, so the card follows
 *   whichever cars run there. The picker writes ordinary bindings, so the server resolves
 *   them and the renderer draws them as it always did.
 *
 * What these tests prove, in a real Chromium against the real server and a real SQLite
 * file, the output drawn by the real renderer (/render/, as OBS loads it):
 *   - A battle card made with "Disputa pela 2ª posição" and taken goes on air with the
 *     2nd and 3rd places (positions 2 and 3 in the data on air), and the output shows the
 *     teams of the cars the simulator lists 2nd and 3rd.
 *
 * What these tests deliberately do not cover:
 *   - Picking each car by its number: step 4 of podiumBattleQrWalk.e2e.ts does that.
 *   - Which bindings a pick writes, field by field: ItemEditorPanelCarGroups.test.tsx.
 *   - The cars changing places on air: the simulator runs at real speed, so the first
 *     minutes hold no pass (a pass is the resolver's concern, tested in packages/shared).
 *
 * What it needs: `pnpm build` (the server registers built graphics only, and the output
 * page is the built renderer).
 */
import { expect, test } from '@playwright/test';

import { chooseBattleForPlaceInTheEditor } from './carPickerTestSteps';
import {
  readDataOnAirOfLayerFromTheRealServer,
  readPositionsOfSourceFromTheRealServer,
} from './dataSourceStateOnTheRealServer';
import {
  openDataSourcesPageAndWaitUntilConnected,
  seededSimulatorLabel,
  startTheSeededSimulatorFromTheGreenFlag,
} from './dataSourcesTestSteps';
import { emptyTheServerState } from './emptyTheServerState';
import {
  openControlPageAndWaitUntilConnected,
  openItemEditorWithNewGraphic,
  openOutputInItsOwnPage,
  saveAndTakeTheItemInTheEditor,
} from './previewTestSteps';

// A take reaches the server at once; a few seconds cover a slow machine.
const waitForTheAirInMilliseconds = 10_000;

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('the battle card made with one pick', () => {
  test('"Disputa pela 2ª posição" goes on air with the cars running 2nd and 3rd', async ({
    page,
  }) => {
    // Arrange: the simulator from the green flag at real speed, so nobody passes for the
    // first minutes; the program output open in its own page.
    await openDataSourcesPageAndWaitUntilConnected(page);
    await startTheSeededSimulatorFromTheGreenFlag(page, '1');
    await expect
      .poll(
        async () => (await readPositionsOfSourceFromTheRealServer(seededSimulatorLabel)).length,
        {
          message: 'the simulator must list its cars before the card is made',
          timeout: waitForTheAirInMilliseconds,
        },
      )
      .toBeGreaterThan(2);
    const positionsAtTheStart = await readPositionsOfSourceFromTheRealServer(seededSimulatorLabel);
    const carRunningSecond = positionsAtTheStart[1];
    const carRunningThird = positionsAtTheStart[2];
    const outputPage = await openOutputInItsOwnPage(page.context(), '/render/');

    // Act: a new battle card, the battle for 2nd place chosen once, saved and taken.
    await openControlPageAndWaitUntilConnected(page);
    const itemEditor = await openItemEditorWithNewGraphic(
      page,
      'Disputa pelo 2º lugar',
      'Disputa de posição',
    );
    await chooseBattleForPlaceInTheEditor(page, itemEditor, 2);
    await saveAndTakeTheItemInTheEditor(itemEditor);

    // Assert: on air with the 2nd and 3rd places, and the output shows both teams.
    await expect
      .poll(
        async () => {
          const dataOnAir = await readDataOnAirOfLayerFromTheRealServer('lower-third');
          return [dataOnAir?.aheadPosition, dataOnAir?.behindPosition];
        },
        {
          message: 'the card on air must hold the 2nd place ahead and the 3rd behind',
          timeout: waitForTheAirInMilliseconds,
        },
      )
      .toEqual([2, 3]);
    const battleCard = outputPage.locator(
      '[data-layer-id="lower-third"] > baja-graphic-battle-card',
    );
    await expect(battleCard.getByTestId('battle-card'), 'the car running 2nd').toContainText(
      carRunningSecond?.teamName ?? 'no 2nd car',
      { timeout: waitForTheAirInMilliseconds },
    );
    await expect(battleCard.getByTestId('battle-card'), 'the car running 3rd').toContainText(
      carRunningThird?.teamName ?? 'no 3rd car',
    );
  });
});
