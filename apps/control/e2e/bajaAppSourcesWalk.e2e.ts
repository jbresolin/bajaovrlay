/**
 * Sources made from the Baja app presets, on air live, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   BAJAOVRLAY-54's walk, in a real Chromium against the real server and a real SQLite
 *   file: on Fontes, "Adicionar fonte do app Baja" makes three flex sources from the
 *   presets — 26BR's Enduro (the race), its overall table ("Geral") and its Super Prime
 *   bracket — reading a stand-in of the Baja app's results API that the test serves on a
 *   free port (bajaAppTestServer.ts, the shared fixtures), as `pnpm serve:baja-example`
 *   serves them for a walk by hand. A tower, a standings board and a bracket are bound to
 *   them live (the manifests' suggestions) and taken; when the race's answer changes, the
 *   tower on air follows.
 *
 * What these tests prove:
 *   1. The three sources are made on the picker, read every 0,5 s and turned on; each
 *      brings its shape to the server: three cars, 51 teams, seven rounds.
 *   2. A tower from "Novo gráfico…" opens with its cars on the Enduro source, and on air
 *      shows cars 11, 22 and 33 in that order.
 *   3. A standings board opens with its teams on the "Geral" source, and on air shows 20
 *      rows of page 1 under the parts picked; a bracket then opens on the Super Prime
 *      source, and the server has its seven rounds on air, the third place before the final.
 *   4. The race's answer changes (car 22 laps car 11 and leads): the tower on air shows
 *      22, 11, 33 at a next poll.
 *
 * What these tests deliberately do not cover:
 *   - What each preset makes of every fixture: bajaAppPresets.test.ts (packages/shared).
 *   - The picker's every list and refusal: DataSourcesPageBajaApp.test.tsx.
 *   - The real API: no test reaches the internet.
 *
 * What it needs: `pnpm build` (the server registers built graphics only, and the monitor
 * is the built renderer).
 *
 * Sharing the server with the other tests: before each test the server is emptied, which
 * deletes every source but the seeded simulator (off), so the three made here are gone
 * before the next test. The stand-in API is the test's own, stopped when it ends.
 */
import { expect, type Page, test as base } from '@playwright/test';

import {
  type BajaAppTestServer,
  readBajaAppFixture,
  startBajaAppTestServer,
} from './bajaAppTestServer';
import {
  readBracketRoundsOfSourceFromTheRealServer,
  readDataOnAirOfLayerFromTheRealServer,
  readPositionsOfSourceFromTheRealServer,
} from './dataSourceStateOnTheRealServer';
import {
  openDataSourcesPageAndWaitUntilConnected,
  pollIntervalOfTheTestsAsTyped,
  turnSourceOnWithItsSwitch,
} from './dataSourcesTestSteps';
import { emptyTheServerState } from './emptyTheServerState';
import {
  openControlPageAndWaitUntilConnected,
  openItemEditorWithNewGraphic,
  saveAndTakeTheItemInTheEditor,
} from './previewTestSteps';
import { findTowerRows, readCarOrderOfTheTowerRows } from './towerInProgramMonitor';

// The three sources, as the picker names them.
const raceSourceLabel = 'App Baja — 26BR — Enduro';
const overallSourceLabel = 'App Baja — 26BR — Geral';
const bracketSourceLabel = 'App Baja — 26BR — Chaveamento Super Prime';
// Polls every 0,5 s: a change shows within a few, and a slow machine gets several times that.
const waitForTheNextPollsInMilliseconds = 10_000;
// A take reaches the monitor once the graphic's package loads and plays in.
const waitForTheAirInMilliseconds = 10_000;
// The rounds of 26BR's Super Prime, the third place moved before the final by the preset.
const roundsOfTheSuperPrime = [
  '32 avos de Final',
  '16 avos de Final',
  'Oitavas de Final',
  'Quartas de final',
  'Semifinais',
  'Disputa 3° lugar',
  'Final',
];

/** Each test gets its own stand-in of the Baja app's API, stopped when it ends. */
const test = base.extend<{ bajaApp: BajaAppTestServer }>({
  // Playwright reads which fixtures a fixture needs from its first argument, which must be
  // an object pattern; this one needs none, hence the empty one.
  // eslint-disable-next-line no-empty-pattern
  bajaApp: async ({}, use) => {
    const bajaAppOfThisTest = await startBajaAppTestServer();
    await use(bajaAppOfThisTest);
    await bajaAppOfThisTest.stop();
  },
});

test.beforeEach(async () => {
  await emptyTheServerState();
});

/** Which list of the picker an entry is in, and its name there. */
type PickerChoice = { listName: string; choiceName: string };

/**
 * Makes one source on the picker, as the operator does: "+ Fonte", "Adicionar fonte do app
 * Baja", the stand-in's address and 26BR read, the entry picked (a table waits for its
 * parts), "Continuar", the interval typed, "Salvar fonte", and the source turned on.
 */
async function makeBajaAppSource(
  page: Page,
  apiAddress: string,
  choice: PickerChoice,
  sourceLabel: string,
): Promise<void> {
  await page.getByRole('button', { name: '+ Fonte' }).click();
  await page
    .getByRole('group', { name: 'Que tipo de fonte?' })
    .getByRole('button', { name: 'Adicionar fonte do app Baja' })
    .click();
  const picker = page.getByRole('region', { name: 'Nova fonte do app Baja' });
  await picker.getByLabel('Endereço da API').fill(apiAddress);
  await picker.getByLabel('Código do evento').fill('26BR');
  await picker.getByRole('button', { name: 'Ler evento' }).click();
  await picker
    .getByRole('group', { name: choice.listName })
    .getByRole('radio', { name: choice.choiceName, exact: true })
    .check();
  if (choice.listName === 'Tabelas de resultado') {
    await expect(
      picker.getByRole('group', { name: 'Partes da pontuação' }),
      'a table’s parts are offered once its columns are read',
    ).toBeVisible();
  }
  await picker.getByRole('button', { name: 'Continuar' }).click();
  const flexForm = page.getByRole('region', { name: 'Nova fonte: HTTP/JSON (flexível)' });
  await expect(flexForm.getByLabel('Nome da fonte'), 'named for the choice').toHaveValue(
    sourceLabel,
  );
  await flexForm.getByLabel('Intervalo de leitura (segundos)').fill(pollIntervalOfTheTestsAsTyped);
  await flexForm.getByRole('button', { name: 'Salvar fonte' }).click();
  await expect(flexForm, 'the form must close once the server has the source').toBeHidden();
  await turnSourceOnWithItsSwitch(page, sourceLabel);
}

/** The doc's race a few minutes on: car 22 has lapped car 11 and leads. */
function buildRaceWhereCar22Leads(): Record<string, unknown> {
  const race = readBajaAppFixture('corrida-00NE_ZZL.from-doc.json');
  const [carEleven, carTwentyTwo, carThirtyThree] = race.cars as Array<Record<string, unknown>>;
  if (carEleven === undefined || carTwentyTwo === undefined || carThirtyThree === undefined) {
    throw new Error('the doc race must list cars 11, 22 and 33');
  }
  // Two laps more for car 22, its last pass the latest; the list is in race order.
  carTwentyTwo.laps = 4;
  carTwentyTwo.last_pass_ms = 1_760_000_500_000;
  race.cars = [carTwentyTwo, carEleven, carThirtyThree];
  return race;
}

test.describe('sources made from the Baja app presets', () => {
  test('feed a tower, a standings board and a bracket live, and the tower follows the race', async ({
    page,
    bajaApp,
  }) => {
    // Three sources, three items, then a change: generous for a slow machine.
    test.setTimeout(180_000);

    // Arrange (step 1): the race, the overall table and the bracket made and on, each with
    // its data on the server.
    await openDataSourcesPageAndWaitUntilConnected(page);
    await makeBajaAppSource(
      page,
      bajaApp.apiAddress,
      { listName: 'Corridas com contagem de voltas', choiceName: 'Enduro' },
      raceSourceLabel,
    );
    await makeBajaAppSource(
      page,
      bajaApp.apiAddress,
      { listName: 'Tabelas de resultado', choiceName: 'Geral' },
      overallSourceLabel,
    );
    await makeBajaAppSource(
      page,
      bajaApp.apiAddress,
      { listName: 'Chaveamentos', choiceName: 'Chaveamento Super Prime' },
      bracketSourceLabel,
    );
    await expect
      .poll(async () => (await readPositionsOfSourceFromTheRealServer(raceSourceLabel)).length, {
        message: 'the race source must bring its three cars',
        timeout: waitForTheNextPollsInMilliseconds,
      })
      .toBe(3);
    await expect
      .poll(
        async () =>
          (await readBracketRoundsOfSourceFromTheRealServer(bracketSourceLabel)).map(
            (round) => round.name,
          ),
        {
          message: 'the bracket source must bring its seven rounds',
          timeout: waitForTheNextPollsInMilliseconds,
        },
      )
      .toEqual(roundsOfTheSuperPrime);

    // Act (step 2): a tower whose cars open on the race source, saved and taken.
    await openControlPageAndWaitUntilConnected(page);
    const towerEditor = await openItemEditorWithNewGraphic(
      page,
      'Torre — Enduro 26BR',
      'Torre de posições',
    );
    await expect(
      towerEditor.getByRole('combobox', { name: 'Fonte de Carros' }),
      'the cars must open on the one source with positions, the race',
    ).toHaveText(raceSourceLabel);
    await saveAndTakeTheItemInTheEditor(towerEditor);

    // Assert (step 2): the three cars on air, in race order.
    await expect(findTowerRows(page), 'three rows on air').toHaveCount(3, {
      timeout: waitForTheAirInMilliseconds,
    });
    expect(await readCarOrderOfTheTowerRows(page), 'cars 11, 22 and 33 in race order').toEqual([
      11, 22, 33,
    ]);

    // Act (step 3): a standings board on the overall source, taken; then a bracket on the
    // Super Prime source, taken in its place.
    const standingsEditor = await openItemEditorWithNewGraphic(
      page,
      'Classificação geral 26BR',
      'Classificação',
    );
    await expect(
      standingsEditor.getByRole('combobox', { name: 'Fonte de Equipes' }),
      'the teams must open on the one source with standings, the overall table',
    ).toHaveText(overallSourceLabel);
    await saveAndTakeTheItemInTheEditor(standingsEditor);
    const standings = page
      .frameLocator('iframe[title="Programa"]')
      .locator('[data-layer-id="fullscreen"] > baja-graphic-standings');
    await expect(standings.getByTestId('standings-row'), 'page 1 of the 51 teams').toHaveCount(20, {
      timeout: waitForTheAirInMilliseconds,
    });
    await expect(
      standings.getByTestId('standings-column-head'),
      'the parts picked as columns',
    ).toContainText('Penalidade');
    const bracketEditor = await openItemEditorWithNewGraphic(
      page,
      'Super Prime 26BR',
      'Chaveamento',
    );
    await expect(
      bracketEditor.getByRole('combobox', { name: 'Fonte de Fases', exact: true }),
      'the rounds must open on the one source with brackets, the Super Prime',
    ).toHaveText(bracketSourceLabel);
    await saveAndTakeTheItemInTheEditor(bracketEditor);

    // Assert (step 3): the seven rounds on air.
    await expect
      .poll(
        async () => {
          const dataOnAir = (await readDataOnAirOfLayerFromTheRealServer('fullscreen')) as
            { rounds?: Array<{ name: string }> } | undefined;
          return dataOnAir?.rounds?.map((round) => round.name);
        },
        {
          message: 'the bracket on air must carry the Super Prime’s seven rounds',
          timeout: waitForTheAirInMilliseconds,
        },
      )
      .toEqual(roundsOfTheSuperPrime);

    // Act (step 4): the race's answer changes: car 22 leads.
    bajaApp.answerRaceWith(buildRaceWhereCar22Leads());

    // Assert (step 4): the tower on air follows at a next poll.
    await expect
      .poll(async () => readCarOrderOfTheTowerRows(page), {
        message: 'the tower on air must follow the race, car 22 first',
        timeout: waitForTheNextPollsInMilliseconds,
      })
      .toEqual([22, 11, 33]);
  });
});
