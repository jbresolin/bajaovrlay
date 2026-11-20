/**
 * "Escolher carros": the battle card's cars changed from its button (apps/control, Playwright)
 *
 * What this module is for:
 *   During a race the operator changes the battle card's two cars without opening the
 *   item editor (BAJAOVRLAY-82): the button's chevron opens a box, two numbers are typed
 *   (or "Disputa pela posição"), and "No ar" or "Prévia" saves them into the item and puts
 *   it on air or in preview. The box writes the same bindings as the editor's car picker,
 *   so the server resolves them and the renderer draws them as it always did.
 *
 * What these tests prove, in a real Chromium against the real server and a real SQLite
 * file, the output drawn by the real renderer (/render/, as OBS loads it):
 *   - Cars 47 and 12 typed, then "No ar" pressed with Space: the card on air holds cars 47
 *     and 12, and the output shows both teams.
 *   - "Disputa pela 3ª posição", then "Prévia", the box opened from the button's "⋯" menu
 *     this time: the card in preview holds the 3rd and the 4th places.
 *
 * What these tests deliberately do not cover:
 *   - Each refusal and each command, one by one: QuickCarPickOnAQuickFireButton.test.tsx.
 *   - The cars changing places on air: the simulator runs at real speed, so the first
 *     minutes hold no pass (a pass is the resolver's concern, tested in packages/shared).
 *
 * What it needs: `pnpm build` (the server registers built graphics only, and the output
 * page is the built renderer).
 */
import { expect, type Page, test } from '@playwright/test';

import {
  chooseBattleForPlaceInTheEditor,
  openQuickCarPickFromMenuOfButton,
  openQuickCarPickOfButton,
  typeBothCarsInQuickCarPick,
} from './carPickerTestSteps';
import {
  readDataInPreviewOfLayerFromTheRealServer,
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
} from './previewTestSteps';

// A take reaches the server at once; a few seconds cover a slow machine.
const waitForTheAirInMilliseconds = 10_000;
const battleCardButtonLabel = 'Disputa no box';

test.beforeEach(async () => {
  await emptyTheServerState();
});

/**
 * Starts the simulator at real speed, waits for its cars, and makes the battle card a
 * button of the shortcuts panel ("Novo gráfico…" opens the editor there), saved as the
 * battle for 1st place so its fields are filled, but not taken.
 */
async function prepareTheBattleCardButton(page: Page): Promise<void> {
  await openDataSourcesPageAndWaitUntilConnected(page);
  await startTheSeededSimulatorFromTheGreenFlag(page, '1');
  await expect
    .poll(async () => (await readPositionsOfSourceFromTheRealServer(seededSimulatorLabel)).length, {
      message: 'the simulator must list its cars',
      timeout: waitForTheAirInMilliseconds,
    })
    .toBeGreaterThan(4);
  await openControlPageAndWaitUntilConnected(page);
  const itemEditor = await openItemEditorWithNewGraphic(
    page,
    battleCardButtonLabel,
    'Disputa de posição',
  );
  await chooseBattleForPlaceInTheEditor(page, itemEditor, 1);
  await itemEditor.getByRole('button', { name: 'Salvar item' }).click();
  await expect(itemEditor, 'the editor must close once the button is saved').toBeHidden();
}

test.describe('"Escolher carros" on the battle card’s button', () => {
  test('cars 47 and 12 typed, then "No ar", put both on air', async ({ page }) => {
    // Arrange: the battle card's button, and the program output open in its own page.
    await prepareTheBattleCardButton(page);
    const outputPage = await openOutputInItsOwnPage(page.context(), '/render/');
    const positions = await readPositionsOfSourceFromTheRealServer(seededSimulatorLabel);
    const car47 = positions.find((car) => car.carNumber === 47);
    const car12 = positions.find((car) => car.carNumber === 12);

    // Act: the chevron, 47 and 12 typed, and "No ar" pressed with Space, which must press
    // the button and not reach the page's own Space (the rundown's next take).
    const box = await openQuickCarPickOfButton(page, battleCardButtonLabel);
    await typeBothCarsInQuickCarPick(box, { carAheadNumber: 47, carBehindNumber: 12 });
    await box.getByRole('button', { name: 'No ar', exact: true }).press('Space');

    // Assert: the card on air holds cars 47 and 12, and the output shows both teams.
    await expect
      .poll(
        async () => {
          const dataOnAir = await readDataOnAirOfLayerFromTheRealServer('lower-third');
          return [dataOnAir?.aheadCarNumber, dataOnAir?.behindCarNumber];
        },
        {
          message: 'the card on air must hold car 47 ahead and car 12 behind',
          timeout: waitForTheAirInMilliseconds,
        },
      )
      .toEqual([47, 12]);
    const battleCard = outputPage
      .locator('[data-layer-id="lower-third"] > baja-graphic-battle-card')
      .getByTestId('battle-card');
    await expect(battleCard, 'the output must show car 47’s team').toContainText(
      car47?.teamName ?? 'no car 47',
      { timeout: waitForTheAirInMilliseconds },
    );
    await expect(battleCard, 'the output must show car 12’s team').toContainText(
      car12?.teamName ?? 'no car 12',
    );
  });

  test('"Disputa pela 3ª posição", then "Prévia", previews the 3rd and 4th places', async ({
    page,
  }) => {
    // Arrange: the battle card's button.
    await prepareTheBattleCardButton(page);

    // Act: "Escolher carros" from the "⋯" menu, "Pela posição", 3, "Prévia".
    const box = await openQuickCarPickFromMenuOfButton(page, battleCardButtonLabel);
    await box.getByRole('tab', { name: 'Pela posição' }).click();
    await box.getByLabel('Disputa pela posição', { exact: true }).fill('3');
    await box.getByRole('button', { name: 'Prévia', exact: true }).click();

    // Assert: the card in preview holds the 3rd place ahead and the 4th behind.
    await expect
      .poll(
        async () => {
          const dataInPreview = await readDataInPreviewOfLayerFromTheRealServer('lower-third');
          return [dataInPreview?.aheadPosition, dataInPreview?.behindPosition];
        },
        {
          message: 'the card in preview must hold the 3rd place ahead and the 4th behind',
          timeout: waitForTheAirInMilliseconds,
        },
      )
      .toEqual([3, 4]);
    await expect(box, 'the box must close once it has sent').toBeHidden();
  });
});
