/**
 * The podium, the battle card and the QR card, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   BAJAOVRLAY-47's walk, in a real Chromium against the real server and a real SQLite
 *   file: the last transient graphics of the catalogue, made in the item editor, taken
 *   from the control page and drawn by the real program output (/render/, as OBS loads it,
 *   at 1920×1080).
 *
 * What these tests prove (the brief's five E2E steps; steps 1 to 3 share a test):
 *   1. The simulator's teams imported, car 1's team given a logo, the simulator started.
 *   2. A podium item whose teams read the positions through "Primeiras N entradas" (3)
 *      and then "Com logos das equipes", frozen at the take, taken: the server has the
 *      three cars on air with car 1's logo address.
 *   3. "Próximo" pressed three times on the Camadas row: "Passo 4 de 4", the three cards
 *      shown on the output, car 1's card shows its logo and car 2's has none.
 *   4. A battle card whose eleven fields read the race's first two cars by number, live,
 *      bound with the simulator off and its last data still, taken: the output shows both
 *      teams and a gap ("+1,2").
 *   5. A QR card typed and taken: its code on the output scans back to the address.
 *
 * What these tests deliberately do not cover:
 *   - The trend worked out lap by lap: the battle card's own tests (a lap takes minutes).
 *   - What the graphics look like: their packages' screenshot tests.
 *   - OBS itself: the output page is the built renderer OBS loads.
 *
 * Why car 1 and not the brief's car 7: right after the green flag, before the first lap is
 * done, the simulator lists its cars by number, so the podium is cars 1, 2 and 3 at once;
 * car 7 is on no podium of the seeded race in its first ten minutes (docs/decisions.md).
 *
 * What it needs: `pnpm build` (the server registers built graphics only, and the output
 * page is the built renderer).
 *
 * Sharing the server with the other tests: before each test the server is emptied
 * (nothing on air, no item, an empty library and media store, the simulator off with its
 * default settings), so these tests pass whatever ran before them.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { scanQrCodeOnScreen } from '../../../packages/graphics/qr-card/e2e/qrCodeOnScreen';
import {
  readDataOnAirOfLayerFromTheRealServer,
  readPositionsOfSourceFromTheRealServer,
} from './dataSourceStateOnTheRealServer';
import {
  openDataSourcesPageAndWaitUntilConnected,
  seededSimulatorLabel,
  startTheSeededSimulatorFastFromTheGreenFlag,
  startTheSeededSimulatorFromTheGreenFlag,
  turnSourceOffWithItsSwitch,
} from './dataSourcesTestSteps';
import { emptyTheServerState } from './emptyTheServerState';
import {
  importTheSimulatorTeamsAndGiveOneALogo,
  readTheLibraryFromTheRealServer,
} from './entityLibraryTestSteps';
import {
  openControlPageAndWaitUntilConnected,
  openItemEditorWithNewGraphic,
  openOutputInItsOwnPage,
  saveAndTakeTheItemInTheEditor,
} from './previewTestSteps';

// Car 1 of the simulator's teams (teams.fictional.json).
const teamOfCar1 = 'Cascavel Off-Road';
// The podium's list field, as its manifest titles it.
const podiumTeamsField = 'Equipes do pódio';
// The QR card's address: the results page the stream points phones at.
const resultsAddress = 'https://resultados.bajasaebrasil.net/2026';
// A take reaches the server at once; a few seconds cover a slow machine.
const waitForTheAirInMilliseconds = 10_000;
// At speed 60 the leader completes a lap in a few seconds of real time.
const waitForTheFirstLapInMilliseconds = 30_000;

test.beforeEach(async () => {
  await emptyTheServerState();
});

/** Picks an option in one of the item editor's dropdowns, by the dropdown's name. */
async function chooseInEditorDropdown(
  page: Page,
  itemEditor: Locator,
  dropdownName: string,
  optionName: string,
): Promise<void> {
  await itemEditor.getByRole('combobox', { name: dropdownName, exact: true }).click();
  // The list of options is drawn outside the editor, at the end of the page.
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

/**
 * Sets one field of the item editor to read one value of a car chosen by its number, live:
 * "Fonte", the simulator, the path under "Carro escolhido pelo número", the car's number.
 */
async function readFieldFromCarChosenByNumber(
  page: Page,
  itemEditor: Locator,
  field: { title: string; pathLabel: string; carNumber: number },
): Promise<void> {
  await chooseInEditorDropdown(page, itemEditor, `Como preencher ${field.title}`, 'Fonte');
  await chooseInEditorDropdown(page, itemEditor, `Fonte de ${field.title}`, seededSimulatorLabel);
  await chooseInEditorDropdown(
    page,
    itemEditor,
    `O que ${field.title} lê da fonte`,
    `Posições › Carro escolhido pelo número › ${field.pathLabel}`,
  );
  await itemEditor
    .getByLabel(`Número do carro de ${field.title}`, { exact: true })
    .fill(String(field.carNumber));
}

/** The graphic of a package on one layer of an output's own page. */
function findGraphicOnOutputPage(outputPage: Page, layerId: string, packageName: string): Locator {
  return outputPage.locator(`[data-layer-id="${layerId}"] > baja-graphic-${packageName}`);
}

test.describe('the podium, the battle card and the QR card', () => {
  test('a podium of the first three cars, with car 1’s logo, revealed with three Próximos', async ({
    page,
  }) => {
    // Arrange (step 1): car 1's team with its logo; the simulator started at real speed,
    // so the podium is cars 1, 2 and 3 for the first minutes.
    await importTheSimulatorTeamsAndGiveOneALogo(page, {
      carNumber: 1,
      teamName: teamOfCar1,
      logoFileName: 'logo-cascavel.png',
      isOnLightPlate: false,
    });
    const logoMediaIdOfCar1 = (await readTheLibraryFromTheRealServer()).teams.find(
      (team) => team.carNumber === 1,
    )?.logoMediaId;
    await openDataSourcesPageAndWaitUntilConnected(page);
    await startTheSeededSimulatorFromTheGreenFlag(page, '1');
    const outputPage = await openOutputInItsOwnPage(page.context(), '/render/');

    // Act (step 2): the podium item, its teams opening on the simulator's positions frozen
    // at the take (the manifest's suggestion), through topN 3 then the teams' logos.
    await openControlPageAndWaitUntilConnected(page);
    const itemEditor = await openItemEditorWithNewGraphic(page, 'Pódio do enduro', 'Pódio');
    await expect(
      itemEditor.getByRole('combobox', { name: `Fonte de ${podiumTeamsField}` }),
      'the podium’s teams must open reading the simulator, as the manifest suggests',
    ).toHaveText(seededSimulatorLabel);
    await chooseInEditorDropdown(
      page,
      itemEditor,
      `Transformação de ${podiumTeamsField}`,
      'Primeiras N entradas',
    );
    await itemEditor
      .getByRole('textbox', { name: `Parâmetro da transformação de ${podiumTeamsField}` })
      .fill('3');
    await chooseInEditorDropdown(
      page,
      itemEditor,
      `Segunda transformação de ${podiumTeamsField}`,
      'Com logos das equipes',
    );
    await saveAndTakeTheItemInTheEditor(itemEditor);

    // Assert (step 2): on the server, cars 1, 2 and 3 with car 1's logo address.
    await expect
      .poll(async () => readDataOnAirOfLayerFromTheRealServer('fullscreen'), {
        message: 'the podium on air must carry the first three cars, car 1 with its logo',
        timeout: waitForTheAirInMilliseconds,
      })
      .toMatchObject({
        entries: [
          { carNumber: 1, logoUrl: `/media/${String(logoMediaIdOfCar1)}` },
          { carNumber: 2 },
          { carNumber: 3 },
        ],
      });

    // Act (step 3): "Próximo" three times on the "Tela cheia" row, each press once the
    // row shows the step before it.
    const fullscreenRow = page.getByRole('listitem', { name: 'Tela cheia' });
    for (const stepNumberAfterThePress of [2, 3, 4]) {
      await expect(
        fullscreenRow.getByText(`Passo ${String(stepNumberAfterThePress - 1)} de 4`),
        'the row must show the step before pressing Próximo',
      ).toBeVisible();
      await fullscreenRow.getByRole('button', { name: 'Próximo' }).click();
    }

    // Assert (step 3): the last step on the row and the three cards on the output, the
    // winner's crowned by its logo.
    await expect(
      fullscreenRow.getByText('Passo 4 de 4'),
      'all three places revealed',
    ).toBeVisible();
    await expect(
      fullscreenRow.getByRole('button', { name: 'Próximo' }),
      'nothing after the last step',
    ).toBeDisabled();
    const podium = findGraphicOnOutputPage(outputPage, 'fullscreen', 'podium');
    for (const slot of ['third', 'second', 'first']) {
      await expect(
        podium.locator(`[data-testid="podium-card"][data-slot="${slot}"]`),
        `the ${slot} place must be shown after three Próximos`,
      ).toBeVisible();
    }
    const winnersCard = podium.locator('[data-testid="podium-card"][data-slot="first"]');
    await expect(winnersCard.getByTestId('podium-team-name'), 'car 1 wins').toHaveText(teamOfCar1);
    await expect(winnersCard.getByTestId('podium-logo'), 'car 1 shows its logo').toBeVisible();
    const secondsCard = podium.locator('[data-testid="podium-card"][data-slot="second"]');
    await expect(secondsCard.getByTestId('podium-team-name'), 'car 2 is 2nd').toHaveText(
      'Biguá Off-Road',
    );
    await expect(
      secondsCard.getByTestId('podium-logo'),
      'car 2’s team has no logo, so its card has none',
    ).toHaveCount(0);
  });

  test('a battle card for the first two cars, read live by number, shows both teams and the gap', async ({
    page,
  }) => {
    // Eleven fields bound by hand, four choices each, after the race's first lap: past
    // Playwright's 30 s on a slow runner, as the other walks that bind many fields.
    test.setTimeout(120_000);

    // Arrange: the race run fast until the 2nd car has an interval to the leader (the shape
    // leaves it out before the leader's first lap), then the simulator switched off, so its
    // last data stays still while the fields are bound. Binding live fields while the race
    // runs at speed 60 slows the editor to a crawl (BAJAOVRLAY-45), which is not this walk.
    await openDataSourcesPageAndWaitUntilConnected(page);
    await startTheSeededSimulatorFastFromTheGreenFlag(page);
    await expect
      .poll(
        async () => {
          const positions = await readPositionsOfSourceFromTheRealServer(seededSimulatorLabel);
          return positions[1]?.intervalMs;
        },
        {
          message: 'the 2nd car must have an interval once the leader has a lap',
          timeout: waitForTheFirstLapInMilliseconds,
        },
      )
      .toBeGreaterThan(0);
    await turnSourceOffWithItsSwitch(page, seededSimulatorLabel);
    const positionsOnceStill = await readPositionsOfSourceFromTheRealServer(seededSimulatorLabel);
    const leader = positionsOnceStill[0];
    const second = positionsOnceStill[1];
    expect(second?.intervalMs, "the last data keeps the 2nd car's interval").toBeGreaterThan(0);
    const outputPage = await openOutputInItsOwnPage(page.context(), '/render/');

    // Act (step 4): the battle card, every field reading the leader (ahead) or the 2nd car
    // (behind) by number, live; saved and taken.
    await openControlPageAndWaitUntilConnected(page);
    const itemEditor = await openItemEditorWithNewGraphic(
      page,
      'Disputa — os dois primeiros',
      'Disputa de posição',
    );
    const valuesOfEachCar = [
      { side: 'da frente', carNumber: leader?.carNumber ?? 0 },
      { side: 'de trás', carNumber: second?.carNumber ?? 0 },
    ];
    const fieldsAndPaths = [
      { field: 'Posição do carro', pathLabel: 'Posição' },
      { field: 'Número do carro', pathLabel: 'Carro' },
      { field: 'Equipe do carro', pathLabel: 'Equipe' },
      { field: 'Escola do carro', pathLabel: 'Escola' },
      { field: 'Voltas do carro', pathLabel: 'Voltas' },
    ];
    for (const { side, carNumber } of valuesOfEachCar) {
      for (const { field, pathLabel } of fieldsAndPaths) {
        await readFieldFromCarChosenByNumber(page, itemEditor, {
          title: `${field} ${side}`,
          pathLabel,
          carNumber,
        });
      }
    }
    await readFieldFromCarChosenByNumber(page, itemEditor, {
      title: 'Diferença entre os carros (ms)',
      pathLabel: 'Intervalo para o carro à frente',
      carNumber: second?.carNumber ?? 0,
    });
    await saveAndTakeTheItemInTheEditor(itemEditor);

    // Assert (step 4): both teams and a gap written "+s,d" on the output.
    const battleCard = findGraphicOnOutputPage(outputPage, 'lower-third', 'battle-card');
    await expect(battleCard.getByTestId('battle-card'), 'the car ahead').toContainText(
      leader?.teamName ?? 'no leader',
      { timeout: waitForTheAirInMilliseconds },
    );
    await expect(battleCard.getByTestId('battle-card'), 'the car behind').toContainText(
      second?.teamName ?? 'no 2nd car',
    );
    await expect(battleCard.getByTestId('battle-card-gap'), 'the gap in seconds').toHaveText(
      /^\+\d+,\d$/,
    );
  });

  test('a QR card shows a code that scans back to its address', async ({ page }) => {
    // Arrange: the program output in its own page.
    const outputPage = await openOutputInItsOwnPage(page.context(), '/render/');

    // Act (step 5): the QR card with the call to action and the address typed, taken.
    await openControlPageAndWaitUntilConnected(page);
    const itemEditor = await openItemEditorWithNewGraphic(
      page,
      'QR dos resultados',
      'Cartão de QR',
    );
    await itemEditor.getByLabel('Chamada', { exact: true }).fill('Acompanhe os resultados');
    await itemEditor.getByLabel('Endereço do QR', { exact: true }).fill(resultsAddress);
    await saveAndTakeTheItemInTheEditor(itemEditor);

    // Assert (step 5): the card on the output, and its code read as a phone would.
    const qrCard = findGraphicOnOutputPage(outputPage, 'lower-third', 'qr-card');
    const cardPanel = qrCard.getByTestId('qr-card-panel');
    await expect(cardPanel, 'the QR card is on the output').toBeVisible({
      timeout: waitForTheAirInMilliseconds,
    });
    await expect
      .poll(async () => scanQrCodeOnScreen(outputPage, cardPanel), {
        message: 'the code on the output must scan back to the address',
        timeout: waitForTheAirInMilliseconds,
      })
      .toBe(resultsAddress);
  });
});
