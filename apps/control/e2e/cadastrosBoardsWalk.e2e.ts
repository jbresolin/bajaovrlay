/**
 * The sponsor roll, the countdown and the sessions board read from Cadastros, end to end
 * (apps/control, Playwright)
 *
 * What this module is for:
 *   BAJAOVRLAY-46's walk, in a real Chromium against the real server and a real SQLite
 *   file: sponsors and the day's schedule imported from CSV in Cadastros, and the boards
 *   that read them taken from the control page.
 *
 * What these tests prove (the brief's E2E steps):
 *   1. Sponsors imported from a CSV (Bosch "diamante", Renault "master", the old name of
 *      the top level, and Pneus Trilha "apoio"), Bosch given a logo; a sponsor roll whose
 *      list is "Lista dos cadastros", the editor saying "Valor agora: 1 patrocinador"
 *      (a sponsor without a logo is left out), taken: on the server it carries Bosch at
 *      Diamante, and in the program monitor the head reads "PATROCÍNIO DIAMANTE".
 *   2. The schedule imported from a CSV; a countdown card whose session and start read the
 *      enduro's slot, taken: on air the enduro's name and start, the monitor counting.
 *   3. A sessions board whose sessions are "Lista dos cadastros" ("Valor agora: 3
 *      sessões"), taken: the three slots in the monitor, in the order of their starts.
 *
 * What these tests deliberately do not cover:
 *   - The turns of the roll and the board's statuses over time: component tests with fake
 *     time prove them in each package (docs/ci.md: no fixed waits).
 *   - A live refresh when a sponsor or a slot changes on air; the server's
 *     liveRefreshEntityLists test.
 *   - What the graphics look like; their packages' screenshot tests.
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

import { readDataOnAirOfLayerFromTheRealServer } from './dataSourceStateOnTheRealServer';
import { emptyTheServerState } from './emptyTheServerState';
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

// Three sponsors as an organiser's sheet lists them; Renault's level is written with the
// old name of the top level, which the import still reads as Diamante.
const sponsorsCsv = [
  'id;nome;cota;peso;placa_clara',
  'bosch;Bosch;diamante;10;sim',
  'renault;Renault;master;10;sim',
  'pneus-trilha;Pneus Trilha;apoio;2;',
].join('\n');
// A take reaches the server at once; a few seconds cover a slow machine.
const waitForTheAirInMilliseconds = 10_000;

/** A moment some whole hours from now, on the minute, so every count runs during a test. */
function atHoursFromNow(hours: number): Date {
  const moment = new Date(Date.now() + hours * 3_600_000);
  moment.setSeconds(0, 0);
  return moment;
}

/** A moment as the CSV writes it, "14/11/2026 10:00", in this computer's time (the page's). */
function writeAsCsvDateTime(moment: Date): string {
  const twoDigits = (value: number) => String(value).padStart(2, '0');
  const day = `${twoDigits(moment.getDate())}/${twoDigits(moment.getMonth() + 1)}`;
  const time = `${twoDigits(moment.getHours())}:${twoDigits(moment.getMinutes())}`;
  return `${day}/${String(moment.getFullYear())} ${time}`;
}

// The day's three slots, in the order of their starts: the briefing in an hour, the enduro
// in two (four hours long), the prize-giving in seven.
const briefingStart = atHoursFromNow(1);
const enduroStart = atHoursFromNow(2);
const enduroEnd = atHoursFromNow(6);
const prizeGivingStart = atHoursFromNow(7);
const scheduleCsv = [
  'id;sessao;prova;inicio;fim;local',
  `briefing;Briefing das equipes;other;${writeAsCsvDateTime(briefingStart)};;Tenda central`,
  `enduro;Enduro de Resistência;enduro;${writeAsCsvDateTime(enduroStart)};${writeAsCsvDateTime(enduroEnd)};Pista principal`,
  `premiacao;Premiação;other;${writeAsCsvDateTime(prizeGivingStart)};;Palco principal`,
].join('\n');

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

/** Pastes a CSV into one tab's "Importar CSV" and imports its valid lines, all of them. */
async function importCsvIntoTheTab(
  page: Page,
  tabName: string,
  csvText: string,
  lineCount: number,
): Promise<void> {
  await openTheEntityLibraryPage(page);
  await page.getByRole('tab', { name: tabName }).click();
  await page.getByRole('button', { name: 'Importar CSV' }).click();
  await page.getByLabel('Cole o CSV aqui', { exact: true }).fill(csvText);
  await page
    .getByRole('button', { name: `Importar ${String(lineCount)} linhas válidas`, exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: /importad/ }),
    'the page says the lines were imported',
  ).toBeVisible();
}

/** Step 1: Bosch given a logo on the Patrocinadores tab (a CSV carries no images). */
async function giveBoschALogo(page: Page): Promise<void> {
  await page
    .getByRole('table', { name: 'Patrocinadores cadastrados' })
    .getByRole('row', { name: /Bosch/ })
    .getByRole('button', { name: 'Editar' })
    .click();
  const boschForm = page.getByRole('form', { name: 'Editar: Patrocinador Bosch' });
  await boschForm.getByLabel('Logo', { exact: true }).setInputFiles({
    name: 'logo-bosch.png',
    mimeType: 'image/png',
    buffer: buildLogoOfTeam7(),
  });
  await expect(
    boschForm.getByRole('img', { name: 'Logo na placa clara' }),
    'the form previews the logo on the plate',
  ).toBeVisible();
  await boschForm.getByRole('button', { name: 'Salvar' }).click();
  await expect(boschForm, 'the form closes once the sponsor is saved').toBeHidden();
}

/** Finds a graphic's element on a layer inside the "Programa" monitor frame. */
function findGraphicInProgramMonitor(page: Page, layerId: string, packageName: string): Locator {
  return page
    .frameLocator('iframe[title="Programa"]')
    .locator(`[data-layer-id="${layerId}"] > baja-graphic-${packageName}`);
}

test.describe('the boards read from Cadastros', () => {
  test('a sponsor roll from "Lista dos cadastros" heads its first page "PATROCÍNIO DIAMANTE"', async ({
    page,
  }) => {
    // Arrange (step 1): the three sponsors imported, Bosch with a logo.
    await importCsvIntoTheTab(page, 'Patrocinadores', sponsorsCsv, 3);
    await giveBoschALogo(page);
    const levelsInTheLibrary = (await readTheLibraryFromTheRealServer()).sponsors.map(
      (sponsor) => `${sponsor.name} ${sponsor.tier}`,
    );
    expect(levelsInTheLibrary, 'the old "master" is read as Diamante').toEqual(
      expect.arrayContaining(['Bosch diamante', 'Renault diamante', 'Pneus Trilha apoio']),
    );

    // Act (step 1): a sponsor roll whose list reads Cadastros, saved and taken.
    const consolePage = await page.context().newPage();
    await openControlPageAndWaitUntilConnected(consolePage);
    const itemEditor = await openItemEditorWithNewGraphic(
      consolePage,
      'Rodízio — patrocinadores',
      'Rodízio de patrocinadores',
    );
    await chooseInEditorDropdown(
      consolePage,
      itemEditor,
      'Como preencher Patrocinadores',
      'Lista dos cadastros',
    );
    await expect(
      itemEditor.getByRole('combobox', { name: 'Lista dos cadastros de Patrocinadores' }),
      'the list that fits the field is chosen already',
    ).toHaveText('Patrocinadores');
    await expect(
      itemEditor.getByText('Valor agora: 1 patrocinador', { exact: true }),
      'only Bosch has a logo, so the list holds one',
    ).toBeVisible();
    await saveAndTakeTheItemInTheEditor(itemEditor);

    // Assert (step 1): Bosch at Diamante on air, and the head of the page in the monitor.
    await expect
      .poll(async () => readDataOnAirOfLayerFromTheRealServer('fullscreen'), {
        message: 'the roll on air must carry Bosch, the one sponsor with a logo',
        timeout: waitForTheAirInMilliseconds,
      })
      .toMatchObject({ sponsors: [{ name: 'Bosch', level: 'diamante' }] });
    const roll = findGraphicInProgramMonitor(consolePage, 'fullscreen', 'sponsor-roll');
    await expect(roll.getByTestId('sponsor-roll-subtitle'), 'the level’s heading').toHaveText(
      'PATROCÍNIO DIAMANTE',
    );
    await expect(roll.getByTestId('sponsor-roll-tile'), 'Bosch’s tile').toHaveCount(1);
  });

  test('a countdown card read from the enduro’s slot counts down to its start', async ({
    page,
  }) => {
    // Arrange (step 2): the day's schedule imported.
    await importCsvIntoTheTab(page, 'Programação', scheduleCsv, 3);

    // Act (step 2): a countdown card whose session and start read the enduro's slot.
    const consolePage = await page.context().newPage();
    await openControlPageAndWaitUntilConnected(consolePage);
    const itemEditor = await openItemEditorWithNewGraphic(
      consolePage,
      'Contagem — enduro',
      'Contagem regressiva',
    );
    for (const { title, attribute } of [
      { title: 'Sessão', attribute: 'Sessão' },
      { title: 'Largada', attribute: 'Início' },
    ]) {
      await chooseInEditorDropdown(consolePage, itemEditor, `Como preencher ${title}`, 'Cadastro');
      await chooseInEditorDropdown(
        consolePage,
        itemEditor,
        `Tipo de cadastro de ${title}`,
        'Sessão da programação',
      );
      await itemEditor.getByLabel(`Buscar cadastro de ${title}`, { exact: true }).fill('Enduro');
      await chooseInEditorDropdown(
        consolePage,
        itemEditor,
        `Cadastro de ${title}`,
        'Programação: Enduro de Resistência',
      );
      await chooseInEditorDropdown(
        consolePage,
        itemEditor,
        `Campo do cadastro de ${title}`,
        attribute,
      );
    }
    await saveAndTakeTheItemInTheEditor(itemEditor);

    // Assert (step 2): the enduro's name and start on the clock layer; the monitor shows
    // the name and a count of about two hours.
    await expect
      .poll(async () => readDataOnAirOfLayerFromTheRealServer('clock'), {
        message: 'the countdown on air must carry the enduro’s slot',
        timeout: waitForTheAirInMilliseconds,
      })
      .toMatchObject({
        layout: 'card',
        sessionName: 'Enduro de Resistência',
        startsAtMs: enduroStart.getTime(),
      });
    const countdown = findGraphicInProgramMonitor(consolePage, 'clock', 'countdown');
    await expect(countdown.getByTestId('countdown-session'), 'the session').toHaveText(
      'Enduro de Resistência',
    );
    await expect(countdown.getByTestId('countdown-count'), 'about two hours left').toHaveText(
      /^0?[12]:\d{2}:\d{2}$/,
    );
  });

  test('a sessions board from "Lista dos cadastros" shows the three slots in order', async ({
    page,
  }) => {
    // Arrange (step 3): the day's schedule imported.
    await importCsvIntoTheTab(page, 'Programação', scheduleCsv, 3);

    // Act (step 3): a sessions board whose sessions read Cadastros, saved and taken.
    const consolePage = await page.context().newPage();
    await openControlPageAndWaitUntilConnected(consolePage);
    const itemEditor = await openItemEditorWithNewGraphic(
      consolePage,
      'Programação do dia',
      'Programação do dia',
    );
    await chooseInEditorDropdown(
      consolePage,
      itemEditor,
      'Como preencher Sessões',
      'Lista dos cadastros',
    );
    await expect(
      itemEditor.getByText('Valor agora: 3 sessões', { exact: true }),
      'the three slots imported',
    ).toBeVisible();
    await saveAndTakeTheItemInTheEditor(itemEditor);

    // Assert (step 3): the three slots in the monitor, in the order of their starts.
    const board = findGraphicInProgramMonitor(consolePage, 'fullscreen', 'sessions-board');
    await expect(
      board.getByTestId('sessions-board-session'),
      'the slots in the order of their starts',
    ).toHaveText(['Briefing das equipes', 'Enduro de Resistência', 'Premiação'], {
      timeout: waitForTheAirInMilliseconds,
    });
  });
});
