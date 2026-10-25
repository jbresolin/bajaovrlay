/**
 * The sponsor bug, the lower strip and the message ticker, end to end (apps/control,
 * Playwright)
 *
 * What this module is for:
 *   BAJAOVRLAY-23's walk, in a real Chromium against the real server and a real SQLite
 *   file: the always-on graphics, filled from a live source, from Cadastros and by hand,
 *   and taken from the control page.
 *
 * What these tests prove (the brief's E2E steps):
 *   1. The simulator's teams imported and the simulator started.
 *   2. A strip made with "Novo gráfico…", its cars bound live to the positions (the
 *      manifest's suggestion), its clock to the session ("Relógio da fonte") and its flag
 *      to the session's flag, and taken: on the server it carries the 60 cars and a running
 *      clock; in the program monitor page 1 shows six cars, "1/10" and the race time.
 *   3. A sponsor with a logo, its plate ticked in Cadastros, and a bug whose logo and plate
 *      read that sponsor, taken: the logo's address and the plate are on air, and the
 *      monitor draws the logo on its light plate under "Apresentado por".
 *   4. A ticker with two messages typed in the item form, taken ("1/2"); a third added with
 *      "Adicionar mensagem" and sent with "Atualizar no ar": the same instance now holds
 *      three messages and the page cell reads "1/3".
 *
 * What these tests deliberately do not cover:
 *   - The page turns: component tests with fake time prove them in each package, since a
 *     real one takes the 7 s hold (docs/ci.md: no fixed waits).
 *   - What the graphics look like; their packages' screenshot tests, and the combos on
 *     the renderer (apps/renderer/e2e/combosOnAir.e2e.ts).
 *
 * What it needs: `pnpm build` (the server registers built graphics only, and the monitor
 * is the built renderer).
 *
 * Sharing the server with the other tests:
 *   Before each test the server is emptied (nothing on air, no item, an empty library and
 *   media store, the simulator off with its default settings), so these tests pass
 *   whatever ran before them.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import {
  readDataOnAirOfLayerFromTheRealServer,
  readInstanceOnAirOfLayerFromTheRealServer,
} from './dataSourceStateOnTheRealServer';
import {
  openDataSourcesPageAndWaitUntilConnected,
  startTheSeededSimulatorFromTheGreenFlag,
} from './dataSourcesTestSteps';
import { emptyTheServerState, seededSimulatorLabel } from './emptyTheServerState';
import {
  buildLogoOfTeam7,
  openTheEntityLibraryPage,
  readTheLibraryFromTheRealServer,
} from './entityLibraryTestSteps';
import {
  openControlPageAndWaitUntilConnected,
  openItemEditorWithNewGraphic,
  saveAndTakeTheItemInTheEditor,
} from './previewTestSteps';
import { findQuickFireArea } from './quickFireTestSteps';

// The sponsor typed in step 3.
const sponsorName = 'Mineradora Serra Azul';
const sponsorRecord = `Patrocinador ${sponsorName}`;
// The ticker's item in step 4, and its messages.
const tickerItemLabel = 'Avisos do enduro';
const firstTwoMessages = ['Largada do enduro às 10h00', 'Box aberto para abastecimento'];
const thirdMessage = 'Premiação às 16h no palco principal';
// A take reaches the server at once; a few seconds cover a slow machine.
const waitForTheAirInMilliseconds = 10_000;

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

/** Sets one field of the item editor to read one path of the simulator ("Fonte"). */
async function bindFieldToTheSimulator(
  page: Page,
  itemEditor: Locator,
  fieldTitle: string,
  pathLabel: string,
): Promise<void> {
  await chooseInEditorDropdown(page, itemEditor, `Como preencher ${fieldTitle}`, 'Fonte');
  await chooseInEditorDropdown(page, itemEditor, `Fonte de ${fieldTitle}`, seededSimulatorLabel);
  await chooseInEditorDropdown(page, itemEditor, `O que ${fieldTitle} lê da fonte`, pathLabel);
}

/** Sets one field of the item editor to read one attribute of the sponsor ("Cadastro"). */
async function readFieldFromTheSponsor(
  page: Page,
  itemEditor: Locator,
  fieldTitle: string,
  attribute: string,
): Promise<void> {
  await chooseInEditorDropdown(page, itemEditor, `Como preencher ${fieldTitle}`, 'Cadastro');
  await chooseInEditorDropdown(
    page,
    itemEditor,
    `Tipo de cadastro de ${fieldTitle}`,
    'Patrocinador',
  );
  await itemEditor.getByLabel(`Buscar cadastro de ${fieldTitle}`, { exact: true }).fill('Serra');
  await chooseInEditorDropdown(page, itemEditor, `Cadastro de ${fieldTitle}`, sponsorRecord);
  await chooseInEditorDropdown(page, itemEditor, `Campo do cadastro de ${fieldTitle}`, attribute);
}

/** Finds a graphic's element on a layer inside the "Programa" monitor frame. */
function findGraphicInProgramMonitor(page: Page, layerId: string, packageName: string): Locator {
  return page
    .frameLocator('iframe[title="Programa"]')
    .locator(`[data-layer-id="${layerId}"] > baja-graphic-${packageName}`);
}

/** Step 1: the simulator's teams imported in Cadastros, and the simulator on at speed 1. */
async function importTheTeamsAndStartTheSimulator(page: Page): Promise<void> {
  await openTheEntityLibraryPage(page);
  await page.getByRole('button', { name: 'Importar equipes do simulador' }).click();
  await expect(
    page.getByRole('table', { name: 'Equipes cadastradas' }).getByRole('row'),
    'the hundred teams and the header',
  ).toHaveCount(101);
  await openDataSourcesPageAndWaitUntilConnected(page);
  await startTheSeededSimulatorFromTheGreenFlag(page, '1');
}

/** Step 3: the sponsor typed on the Patrocinadores tab, with a logo on the light plate. */
async function addTheSponsorWithItsLogoOnThePlate(page: Page): Promise<void> {
  await openTheEntityLibraryPage(page);
  await page.getByRole('tab', { name: 'Patrocinadores' }).click();
  await page.getByRole('button', { name: '+ Patrocinador' }).click();
  const sponsorForm = page.getByRole('form', { name: 'Novo patrocinador' });
  await sponsorForm.getByLabel('Nome', { exact: true }).fill(sponsorName);
  await sponsorForm.getByRole('combobox', { name: 'Cota', exact: true }).click();
  await page.getByRole('option', { name: 'Master', exact: true }).click();
  await sponsorForm.getByLabel('Peso no rodízio', { exact: true }).fill('10');
  await sponsorForm.getByLabel('Logo', { exact: true }).setInputFiles({
    name: 'logo-serra-azul.png',
    mimeType: 'image/png',
    buffer: buildLogoOfTeam7(),
  });
  await expect(
    sponsorForm.getByRole('img', { name: 'Logo na placa clara' }),
    'the form previews the logo on the plate',
  ).toBeVisible();
  await sponsorForm.getByRole('checkbox', { name: 'Logo sobre placa clara' }).check();
  await sponsorForm.getByRole('button', { name: 'Salvar' }).click();
  await expect(sponsorForm, 'the form closes once the sponsor is saved').toBeHidden();
}

test.describe('the sponsor bug, the lower strip and the message ticker', () => {
  test('a strip bound live to the simulator shows page 1 of the running order and the clock', async ({
    page,
  }) => {
    // Arrange (step 1): the simulator's teams imported and the simulator on.
    await importTheTeamsAndStartTheSimulator(page);

    // Act (step 2): "Novo gráfico…" with the strip, the cars reading the positions as the
    // manifest suggests, the clock and the flag reading the session; saved and taken.
    await openControlPageAndWaitUntilConnected(page);
    const itemEditor = await openItemEditorWithNewGraphic(
      page,
      'Faixa — ordem de corrida',
      'Faixa de classificação',
    );
    await expect(
      itemEditor.getByRole('combobox', { name: 'Fonte de Carros' }),
      'the cars must open reading the simulator, as the manifest suggests',
    ).toHaveText(seededSimulatorLabel);
    await chooseInEditorDropdown(
      page,
      itemEditor,
      'Como preencher Tempo de referência',
      'Relógio da fonte',
    );
    await chooseInEditorDropdown(
      page,
      itemEditor,
      'Fonte de Tempo de referência',
      seededSimulatorLabel,
    );
    await bindFieldToTheSimulator(page, itemEditor, 'Bandeira', 'Sessão › Bandeira');
    await saveAndTakeTheItemInTheEditor(itemEditor);

    // Assert (step 2): the server has the 60 cars and a running green clock on the ticker
    // layer; the monitor draws page 1 (six cars, "1/10") and the race time.
    await expect
      .poll(
        async () => {
          const data = await readDataOnAirOfLayerFromTheRealServer('ticker');
          const entries = data?.entries as unknown[] | undefined;
          return { carCount: entries?.length, state: data?.state, running: data?.running };
        },
        {
          message: 'the strip on air must carry the simulator’s cars and its running clock',
          timeout: waitForTheAirInMilliseconds,
        },
      )
      .toEqual({ carCount: 60, state: 'green', running: true });
    const strip = findGraphicInProgramMonitor(page, 'ticker', 'lower-strip');
    const laneOnAir = strip.locator('[data-testid="lower-strip-lane"]:not([aria-hidden="true"])');
    await expect(laneOnAir.getByTestId('lower-strip-car'), 'page 1 shows six cars').toHaveCount(6);
    await expect(
      strip.getByTestId('lower-strip-page-cell'),
      'sixty cars make ten pages',
    ).toHaveText('1/10');
    await expect(
      strip.getByTestId('clock-block-time'),
      'the clock block shows the race time',
    ).toHaveText(/^\d{1,2}:\d{2}(:\d{2})?$/);
  });

  test('a bug read from a sponsor in Cadastros shows its logo on the light plate', async ({
    page,
  }) => {
    // Arrange (step 3): the sponsor with its logo on the plate.
    await addTheSponsorWithItsLogoOnThePlate(page);
    const sponsorInTheLibrary = (await readTheLibraryFromTheRealServer()).sponsors.find(
      (sponsor) => sponsor.name === sponsorName,
    );
    expect(sponsorInTheLibrary?.logoOnLightPlate, 'the sponsor keeps the plate').toBe(true);

    // Act (step 3): a bug whose logo and plate read the sponsor, saved and taken.
    const consolePage = await page.context().newPage();
    await openControlPageAndWaitUntilConnected(consolePage);
    const itemEditor = await openItemEditorWithNewGraphic(
      consolePage,
      'Bug — Serra Azul',
      'Bug do patrocinador',
    );
    await readFieldFromTheSponsor(consolePage, itemEditor, 'Logo do patrocinador', 'Logo');
    await readFieldFromTheSponsor(
      consolePage,
      itemEditor,
      'Logo sobre placa clara',
      'Logo sobre placa clara',
    );
    await saveAndTakeTheItemInTheEditor(itemEditor);

    // Assert (step 3): the sponsor's logo and plate are on air on the bug layer, and the
    // monitor draws "ENDURO" and the logo on its plate under "Apresentado por".
    await expect
      .poll(async () => readDataOnAirOfLayerFromTheRealServer('bug'), {
        message: 'the bug on air must carry the sponsor’s logo and plate',
        timeout: waitForTheAirInMilliseconds,
      })
      .toMatchObject({
        eventWord: 'ENDURO',
        caption: 'Apresentado por',
        sponsorLogoUrl: `/media/${String(sponsorInTheLibrary?.logoMediaId)}`,
        sponsorLogoOnLightPlate: true,
      });
    const bug = findGraphicInProgramMonitor(consolePage, 'bug', 'sponsor-bug');
    await expect(bug.getByTestId('sponsor-bug-caption'), 'the caption').toHaveText(
      'Apresentado por',
    );
    await expect(
      bug.getByTestId('sponsor-bug-sponsor-logo-box'),
      'the logo sits on its light plate',
    ).toHaveClass(/on-light-plate/);
  });

  test('a ticker of two messages takes a third with "Atualizar no ar", reading 1/3', async ({
    page,
  }) => {
    // Arrange (step 4): a ticker with two messages typed in the item form, taken.
    await openControlPageAndWaitUntilConnected(page);
    const itemEditor = await openItemEditorWithNewGraphic(
      page,
      tickerItemLabel,
      'Letreiro de avisos',
    );
    await itemEditor.getByRole('textbox', { name: 'Mensagem 1' }).fill(firstTwoMessages[0] ?? '');
    await itemEditor.getByRole('button', { name: 'Adicionar mensagem' }).click();
    await itemEditor.getByRole('textbox', { name: 'Mensagem 2' }).fill(firstTwoMessages[1] ?? '');
    await saveAndTakeTheItemInTheEditor(itemEditor);
    const ticker = findGraphicInProgramMonitor(page, 'ticker', 'message-ticker');
    await expect(ticker.getByTestId('message-ticker-page-cell'), 'two messages').toHaveText('1/2', {
      timeout: waitForTheAirInMilliseconds,
    });
    const instanceBefore = await readInstanceOnAirOfLayerFromTheRealServer('ticker');

    // Act (step 4): open the item from its button in "Atalhos", add the third message and
    // press "Atualizar no ar".
    await findQuickFireArea(page)
      .getByRole('button', { name: `Mais ações: ${tickerItemLabel}` })
      .click();
    await page.getByRole('menuitem', { name: 'Editar', exact: true }).click();
    const reopenedEditor = page.getByRole('region', { name: 'Editor de item' });
    await reopenedEditor.getByRole('button', { name: 'Adicionar mensagem' }).click();
    await reopenedEditor.getByRole('textbox', { name: 'Mensagem 3' }).fill(thirdMessage);
    await reopenedEditor.getByRole('button', { name: 'Atualizar no ar' }).click();
    await expect(
      reopenedEditor,
      'the editor closes once the save and the on-air update were accepted',
    ).toBeHidden();

    // Assert (step 4): the same instance holds the three messages, and the monitor's
    // page cell reads 1/3.
    await expect
      .poll(
        async () => {
          const instanceOnAir = await readInstanceOnAirOfLayerFromTheRealServer('ticker');
          return { id: instanceOnAir?.id, messages: instanceOnAir?.resolvedData.messages };
        },
        { message: 'the ticker on air must hold the three messages, updated in place' },
      )
      .toEqual({ id: instanceBefore?.id, messages: [...firstTwoMessages, thirdMessage] });
    await expect(ticker.getByTestId('message-ticker-page-cell'), 'three messages').toHaveText(
      '1/3',
    );
  });
});
