/**
 * The entity library, end to end: Cadastros, a logo, a title read from a team on air
 * (apps/control, Playwright)
 *
 * What this module is for:
 *   BAJAOVRLAY-19's walk, in a real Chromium against the real server and a real SQLite
 *   file: the data operator fills the library on "Cadastros" (#/cadastros), the producer
 *   makes a race clock whose title is "the team name of car 7", and an edit of the team
 *   reaches the air by itself; a deleted team makes the item say it cannot be taken now.
 *
 * What these tests prove (the brief's five E2E steps, step 5 in a test of its own so a
 * failure names its step):
 *   1. "Importar equipes do simulador" lists the simulator's hundred fictional teams.
 *   2. A logo uploaded on car 7's form shows as its thumbnail, and its address serves it.
 *   3. A race clock made from the rundown with its title set to "Cadastro" › Equipe ›
 *      car 7 › "Nome da equipe", and taken: the title on air is the team's name.
 *   4. The team renamed on Cadastros: the title on air follows by itself.
 *   5. The team deleted on Cadastros: the item's rundown row says it cannot be taken now,
 *      naming the car, and what is on air keeps its last title.
 *   And: an SVG logo carrying a script, opened at its own address, runs nothing.
 *
 * What these tests deliberately do not cover:
 *   - What OBS draws: the data on air is read from GET /api/v1/state, what the renderer
 *     draws from; takeAndClear.e2e.ts covers the renderer.
 *   - CSV import and export; the page's component tests cover them.
 *
 * What it needs: `pnpm build` (the server registers built graphics only).
 *
 * Sharing the server with the other tests:
 *   Before each test the server is emptied (nothing on air, no item, an empty library and
 *   media store), so this test passes whatever ran before it.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { readDataOnAirOfLayerFromTheRealServer } from './dataSourceStateOnTheRealServer';
import { emptyTheServerState, realServerPort } from './emptyTheServerState';
import {
  buildLogoOfTeam7,
  openTheEntityLibraryPage,
  readTheLibraryFromTheRealServer,
} from './entityLibraryTestSteps';
import {
  chooseGraphicInTheItemEditor,
  openControlPageAndWaitUntilConnected,
} from './previewTestSteps';

// The seventh fictional team of the simulator, car 7 (teams.fictional.json).
const teamOfCar7 = 'Juriti Off-Road';
const renamedTeamOfCar7 = 'Juriti Racing';
const itemLabel = 'Relógio — equipe 7';
// A refresh follows the edit at once (a 0 ms timer); a few seconds cover a slow machine.
const waitForTheRefreshInMilliseconds = 10_000;

test.beforeEach(async () => {
  await emptyTheServerState();
});

/** The row of one car in the Equipes table. */
function findTeamRow(page: Page, carNumber: number): Locator {
  return page
    .getByRole('table', { name: 'Equipes cadastradas' })
    .getByRole('row', { name: new RegExp(`^${String(carNumber)} `) });
}

/** Step 1: "Importar equipes do simulador" on an empty library, and the hundred teams listed. */
async function importTheSimulatorTeams(page: Page): Promise<void> {
  await openTheEntityLibraryPage(page);
  await page.getByRole('button', { name: 'Importar equipes do simulador' }).click();
  await expect(
    page.getByRole('table', { name: 'Equipes cadastradas' }).getByRole('row'),
    'the hundred fictional teams and the header row must be listed',
  ).toHaveCount(101);
}

/** Picks an option in one of the item editor's dropdowns, by the dropdown's name. */
async function chooseInEditorDropdown(
  page: Page,
  itemEditor: Locator,
  dropdownName: string,
  optionName: string,
): Promise<void> {
  await itemEditor.getByRole('combobox', { name: dropdownName, exact: true }).click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

/**
 * Step 3: on the console, "+ Item" in the rundown, the race clock, its title read from
 * car 7's team name, "Salvar e disparar", and the title on air.
 */
async function putTheClockReadingTeam7OnAir(page: Page): Promise<void> {
  await openControlPageAndWaitUntilConnected(page);
  await page.getByRole('button', { name: '+ Item' }).click();
  const itemEditor = page.getByRole('region', { name: 'Editor de item' });
  await chooseGraphicInTheItemEditor(page, itemEditor, 'Relógio de prova');
  await itemEditor.getByLabel('Rótulo', { exact: true }).fill(itemLabel);
  await chooseInEditorDropdown(page, itemEditor, 'Como preencher Título', 'Cadastro');
  await chooseInEditorDropdown(page, itemEditor, 'Tipo de cadastro de Título', 'Equipe');
  await itemEditor.getByLabel('Buscar cadastro de Título', { exact: true }).fill('7');
  await chooseInEditorDropdown(page, itemEditor, 'Cadastro de Título', `Equipe 7 (${teamOfCar7})`);
  await chooseInEditorDropdown(page, itemEditor, 'Campo do cadastro de Título', 'Nome da equipe');
  await expect(
    itemEditor.getByText(`Valor agora: ${teamOfCar7}`),
    'the editor says what the title would be now',
  ).toBeVisible();
  await itemEditor.getByRole('button', { name: 'Salvar e disparar' }).click();
  await expect(itemEditor, 'the editor closes once saved and taken').toBeHidden();
  await expect
    .poll(async () => (await readDataOnAirOfLayerFromTheRealServer('clock'))?.sessionName, {
      message: "the title on air must be car 7's team name",
      timeout: waitForTheRefreshInMilliseconds,
    })
    .toBe(teamOfCar7);
}

test.describe('the entity library walk', () => {
  test('imports the teams, uploads a logo, and an on-air title follows the team', async ({
    page,
  }) => {
    // Arrange (step 1): the simulator's teams imported.
    await importTheSimulatorTeams(page);

    // Act (step 2): upload a logo on car 7's form and save it.
    await findTeamRow(page, 7).getByRole('button', { name: 'Editar' }).click();
    const formOfCar7 = page.getByRole('form', { name: `Editar: Equipe 7 (${teamOfCar7})` });
    await formOfCar7.getByLabel('Logo', { exact: true }).setInputFiles({
      name: 'logo-juriti.png',
      mimeType: 'image/png',
      buffer: buildLogoOfTeam7(),
    });
    await expect(
      formOfCar7.getByRole('img', { name: 'Logo atual' }),
      'the thumbnail shows',
    ).toBeVisible();
    await formOfCar7.getByRole('button', { name: 'Salvar' }).click();
    await expect(formOfCar7, 'the form closes once the team is saved').toBeHidden();

    // Assert (step 2): the logo in the table, named in the team, served at its address.
    await expect(
      findTeamRow(page, 7).getByRole('img', { name: 'Logo atual' }),
      'in the table',
    ).toBeVisible();
    const logoMediaId = (await readTheLibraryFromTheRealServer()).teams.find(
      (team) => team.carNumber === 7,
    )?.logoMediaId;
    expect(logoMediaId, 'team 7 names its logo').toMatch(/^[0-9a-f]{64}$/);
    const logoAnswer = await fetch(
      `http://127.0.0.1:${String(realServerPort)}/media/${String(logoMediaId)}`,
    );
    expect(logoAnswer.headers.get('content-type'), 'the logo is served as a PNG').toBe('image/png');

    // Act and assert (step 3): the clock with its title read from car 7's team, on air.
    const consolePage = await page.context().newPage();
    await putTheClockReadingTeam7OnAir(consolePage);

    // Act (step 4): rename the team on Cadastros.
    await findTeamRow(page, 7).getByRole('button', { name: 'Editar' }).click();
    await formOfCar7.getByLabel('Nome da equipe', { exact: true }).fill(renamedTeamOfCar7);
    await formOfCar7.getByRole('button', { name: 'Salvar' }).click();

    // Assert (step 4): the title on air follows, by itself.
    await expect
      .poll(async () => (await readDataOnAirOfLayerFromTheRealServer('clock'))?.sessionName, {
        message: 'the title on air must follow the renamed team',
        timeout: waitForTheRefreshInMilliseconds,
      })
      .toBe(renamedTeamOfCar7);
  });

  test('says the item cannot be taken now once its team is deleted', async ({ page }) => {
    // Arrange (steps 1 and 3): the teams imported, the clock reading car 7 on air.
    await importTheSimulatorTeams(page);
    const consolePage = await page.context().newPage();
    await putTheClockReadingTeam7OnAir(consolePage);

    // Act (step 5): delete team 7 on Cadastros, in two presses.
    await findTeamRow(page, 7).getByRole('button', { name: 'Excluir' }).click();
    await findTeamRow(page, 7).getByRole('button', { name: 'Confirmar: excluir' }).click();
    await expect(findTeamRow(page, 7), 'team 7 is gone from the table').toHaveCount(0);

    // Assert (step 5): the rundown row warns, naming the car; the air keeps its title.
    const rowOfTheItem = consolePage
      .getByRole('region', { name: 'Rundown' })
      .getByRole('listitem')
      .filter({ hasText: itemLabel });
    await expect(
      rowOfTheItem.getByLabel(
        'Não entra no ar agora: Título: a equipe do carro 7 não está nos cadastros.',
      ),
      'the row must say the item cannot be taken now, naming the car',
    ).toBeVisible();
    expect(
      (await readDataOnAirOfLayerFromTheRealServer('clock'))?.sessionName,
      'nothing on air is blanked: the last title stays',
    ).toBe(teamOfCar7);
  });

  test('runs nothing when an SVG logo with a script is opened at its own address', async ({
    page,
  }) => {
    // Arrange: an SVG whose script would open a dialog, uploaded to the media store.
    const svgWithScript =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><script>alert("executou")</script></svg>';
    const form = new FormData();
    form.append('file', new File([svgWithScript], 'logo-malicioso.svg', { type: 'image/svg+xml' }));
    const uploadAnswer = await fetch(`http://127.0.0.1:${String(realServerPort)}/api/v1/media`, {
      method: 'POST',
      body: form,
    });
    const { mediaId } = (await uploadAnswer.json()) as { mediaId: string };
    const dialogsOpened: string[] = [];
    page.on('dialog', (dialog) => {
      dialogsOpened.push(dialog.message());
      void dialog.dismiss();
    });

    // Act: open the image's address directly, as someone pasting it into a browser would.
    const response = await page.goto(`http://127.0.0.1:${String(realServerPort)}/media/${mediaId}`);
    await page.waitForLoadState('load');

    // Assert: served as an SVG under the policy, and its script never ran.
    expect(response?.headers()['content-security-policy'], 'the policy that runs nothing').toBe(
      "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    );
    expect(dialogsOpened, 'the script must not run').toEqual([]);
  });
});
