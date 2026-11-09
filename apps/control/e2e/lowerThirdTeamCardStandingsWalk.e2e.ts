/**
 * The lower third, the team card and the standings, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   BAJAOVRLAY-24's walk, in a real Chromium against the real server and a real SQLite
 *   file: the three graphics used most at an event, filled from what M2 built (Cadastros
 *   and a live source) and taken from the control page.
 *
 * What these tests prove (the brief's four E2E steps; steps 1 and 2 share a test):
 *   1. The simulator's teams imported, car 7 given a logo with "Logo sobre placa clara"
 *      ticked: the team keeps the logo and the choice.
 *   2. A team card made from the rundown with every field read from car 7 in Cadastros,
 *      and taken: on the server it carries the name, the city and state, the logo's
 *      address and the plate; in the program monitor it shows the name, "Joinville · SC"
 *      and the logo on its light plate.
 *   3. A person typed in Cadastros, and a lower third whose name and role read that
 *      person, taken: the name and the role on air.
 *   4. A standings board whose entries and score parts read the simulator's standings,
 *      live (the manifest's suggestions), taken: page 1 shows 20 rows under the six
 *      parts' column heads.
 *
 * What these tests deliberately do not cover:
 *   - The standings' page turn: a component test with fake time proves it
 *     (packages/graphics/standings), since a real one takes the 10 s hold (docs/ci.md: no
 *     fixed waits).
 *   - What the graphics look like; their packages' screenshot tests.
 *   - OBS itself: the program monitor draws the same built renderer.
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
import {
  openDataSourcesPageAndWaitUntilConnected,
  seededSimulatorLabel,
  startTheSeededSimulatorFromTheGreenFlag,
} from './dataSourcesTestSteps';
import { emptyTheServerState } from './emptyTheServerState';
import {
  importTheSimulatorTeamsAndGiveOneALogo,
  openTheEntityLibraryPage,
  readTheLibraryFromTheRealServer,
} from './entityLibraryTestSteps';
import {
  openControlPageAndWaitUntilConnected,
  openItemEditorWithNewGraphic,
  saveAndTakeTheItemInTheEditor,
} from './previewTestSteps';

// Car 7 of the simulator's teams (teams.fictional.json), from UDESC in Joinville, SC.
const teamOfCar7 = 'Juriti Off-Road';
const recordOfCar7 = `Equipe 7 (${teamOfCar7})`;
// The narrator typed in step 3.
const narratorName = 'Ana Paula Ribeiro';
const narratorRole = 'Narradora';
// The parts the simulator's overall standings carry, in their order.
const simulatorScorePartLabels = ['ACEL.', 'VELOC.', 'TRAÇÃO', 'SUSP.', 'MANOB.', 'ENDURO'];
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

/**
 * Sets one field of the item editor to read one attribute of one record of Cadastros:
 * "Cadastro", the kind of record, the record found by a search, and the attribute.
 */
async function readFieldFromTheLibrary(
  page: Page,
  itemEditor: Locator,
  field: {
    title: string;
    entityTypeName: string;
    search: string;
    record: string;
    attribute: string;
  },
): Promise<void> {
  await chooseInEditorDropdown(page, itemEditor, `Como preencher ${field.title}`, 'Cadastro');
  await chooseInEditorDropdown(
    page,
    itemEditor,
    `Tipo de cadastro de ${field.title}`,
    field.entityTypeName,
  );
  await itemEditor
    .getByLabel(`Buscar cadastro de ${field.title}`, { exact: true })
    .fill(field.search);
  await chooseInEditorDropdown(page, itemEditor, `Cadastro de ${field.title}`, field.record);
  await chooseInEditorDropdown(
    page,
    itemEditor,
    `Campo do cadastro de ${field.title}`,
    field.attribute,
  );
}

/** Finds a graphic's element on a layer inside the "Programa" monitor frame. */
function findGraphicInProgramMonitor(page: Page, layerId: string, packageName: string): Locator {
  return page
    .frameLocator('iframe[title="Programa"]')
    .locator(`[data-layer-id="${layerId}"] > baja-graphic-${packageName}`);
}

test.describe('the lower third, the team card and the standings', () => {
  test('a team card read from car 7 in Cadastros shows its name, city and logo on the plate', async ({
    page,
  }) => {
    // Arrange (step 1): car 7 with its logo on the light plate.
    await importTheSimulatorTeamsAndGiveOneALogo(page, {
      carNumber: 7,
      teamName: teamOfCar7,
      logoFileName: 'logo-juriti.png',
      isOnLightPlate: true,
    });
    const teamOfCar7InTheLibrary = (await readTheLibraryFromTheRealServer()).teams.find(
      (team) => team.carNumber === 7,
    );
    expect(teamOfCar7InTheLibrary, 'team 7 keeps the logo and the plate').toMatchObject({
      city: 'Joinville',
      state: 'SC',
      logoOnLightPlate: true,
    });

    // Act (step 2): a team card whose every field reads car 7's team, saved and taken.
    const consolePage = await page.context().newPage();
    await openControlPageAndWaitUntilConnected(consolePage);
    const itemEditor = await openItemEditorWithNewGraphic(
      consolePage,
      'Cartão — equipe 7',
      'Cartão de equipe',
    );
    const fieldsAndAttributes = [
      { title: 'Carro', attribute: 'Número do carro' },
      { title: 'Equipe', attribute: 'Nome da equipe' },
      { title: 'Escola', attribute: 'Escola (sigla)' },
      { title: 'Cidade', attribute: 'Cidade' },
      { title: 'Estado (UF)', attribute: 'UF' },
      { title: 'Logo da equipe', attribute: 'Logo' },
      { title: 'Logo sobre placa clara', attribute: 'Logo sobre placa clara' },
    ];
    // The car, the team and the school are one car group (BAJAOVRLAY-66), whose picker reads
    // a source; read from Cadastros, they are edited one by one under "Campos separados".
    await itemEditor.getByRole('switch', { name: 'Campos separados — Carro', exact: true }).click();
    for (const { title, attribute } of fieldsAndAttributes) {
      await readFieldFromTheLibrary(consolePage, itemEditor, {
        title,
        entityTypeName: 'Equipe',
        search: '7',
        record: recordOfCar7,
        attribute,
      });
    }
    await saveAndTakeTheItemInTheEditor(itemEditor);

    // Assert (step 2): the server has car 7's card on air, and the monitor draws it with
    // the place line and the logo on its plate.
    await expect
      .poll(async () => readDataOnAirOfLayerFromTheRealServer('lower-third'), {
        message: "the team card on air must carry car 7's team from Cadastros",
        timeout: waitForTheAirInMilliseconds,
      })
      .toMatchObject({
        carNumber: 7,
        teamName: teamOfCar7,
        city: 'Joinville',
        state: 'SC',
        logoUrl: `/media/${String(teamOfCar7InTheLibrary?.logoMediaId)}`,
        logoOnLightPlate: true,
      });
    const teamCard = findGraphicInProgramMonitor(consolePage, 'lower-third', 'team-card');
    await expect(teamCard.getByTestId('team-card-team-name'), 'the name').toHaveText(teamOfCar7);
    await expect(teamCard.getByTestId('team-card-place-line'), 'the city line').toHaveText(
      'Joinville · SC',
    );
    await expect(
      teamCard.getByTestId('team-card-logo-cell'),
      'the logo sits on its light plate',
    ).toHaveClass(/on-light-plate/);
  });

  test('a lower third read from a person in Cadastros shows the name and the role', async ({
    page,
  }) => {
    // Arrange (step 3): the narrator typed on the Pessoas tab.
    await openTheEntityLibraryPage(page);
    await page.getByRole('tab', { name: 'Pessoas' }).click();
    await page.getByRole('button', { name: '+ Pessoa' }).click();
    const personForm = page.getByRole('form', { name: 'Nova pessoa' });
    await personForm.getByLabel('Nome', { exact: true }).fill(narratorName);
    await personForm.getByLabel('Função', { exact: true }).fill(narratorRole);
    await personForm.getByRole('button', { name: 'Salvar' }).click();
    await expect(personForm, 'the form closes once the person is saved').toBeHidden();

    // Act (step 3): a lower third whose name and role read the narrator, saved and taken.
    const consolePage = await page.context().newPage();
    await openControlPageAndWaitUntilConnected(consolePage);
    const itemEditor = await openItemEditorWithNewGraphic(
      consolePage,
      'Tarja — narradora',
      'Tarja',
    );
    for (const { title, attribute } of [
      { title: 'Nome', attribute: 'Nome' },
      { title: 'Função', attribute: 'Função' },
    ]) {
      await readFieldFromTheLibrary(consolePage, itemEditor, {
        title,
        entityTypeName: 'Pessoa',
        search: 'Ana Paula',
        record: `${narratorName} (${narratorRole})`,
        attribute,
      });
    }
    await saveAndTakeTheItemInTheEditor(itemEditor);

    // Assert (step 3): the narrator's name and role on air, drawn in the monitor.
    await expect
      .poll(async () => readDataOnAirOfLayerFromTheRealServer('lower-third'), {
        message: "the lower third on air must carry the narrator's name and role",
        timeout: waitForTheAirInMilliseconds,
      })
      .toMatchObject({ name: narratorName, role: narratorRole });
    const lowerThird = findGraphicInProgramMonitor(consolePage, 'lower-third', 'lower-third');
    await expect(lowerThird.getByTestId('lower-third-role'), 'the role pill').toHaveText(
      narratorRole,
    );
  });

  test('a standings board bound live to the simulator shows page 1 with its parts', async ({
    page,
  }) => {
    // Arrange (step 4): the simulator on, at real speed, its first data in.
    await openDataSourcesPageAndWaitUntilConnected(page);
    await startTheSeededSimulatorFromTheGreenFlag(page, '1');

    // Act (step 4): "Novo gráfico…" with the standings, whose entries and parts open
    // already reading the simulator (the manifest's suggestions); saved and taken.
    await openControlPageAndWaitUntilConnected(page);
    const itemEditor = await openItemEditorWithNewGraphic(
      page,
      'Classificação geral',
      'Classificação',
    );
    for (const fieldTitle of ['Equipes', 'Partes da pontuação']) {
      await expect(
        itemEditor.getByRole('combobox', { name: `Fonte de ${fieldTitle}` }),
        `${fieldTitle} must open reading the simulator, as the manifest suggests`,
      ).toHaveText(seededSimulatorLabel);
    }
    await saveAndTakeTheItemInTheEditor(itemEditor);

    // Assert (step 4): 20 rows on page 1, under the head of the six parts.
    const standings = findGraphicInProgramMonitor(page, 'fullscreen', 'standings');
    await expect(standings.getByTestId('standings-row'), 'page 1 must show 20 rows').toHaveCount(
      20,
      { timeout: waitForTheAirInMilliseconds },
    );
    const columnHead = standings.getByTestId('standings-column-head');
    for (const partLabel of simulatorScorePartLabels) {
      await expect(columnHead, `the column head must name ${partLabel}`).toContainText(partLabel);
    }
  });
});
