/**
 * Chaos: the Baja app's race breaks mid-race (apps/control, Playwright)
 *
 * What this module is for:
 *   The tower on air reads 26BR's Enduro from the Baja app's API, through the race source
 *   "Adicionar fonte do app Baja" makes. During the race the API breaks, in one of the four
 *   ways an API breaks, and later comes back. The event-day promise: the tower keeps the
 *   last good data and is never blanked, the operator sees the source late ("atrasada") on
 *   the console, and when the API comes back the source is "Ok" again with no jump on air.
 *
 * What these tests prove, for each way of breaking (one scenario each, its own server):
 *   - the API goes down (its port refuses connections);
 *   - it answers garbage (an HTML error page where JSON was due);
 *   - it answers the race with an empty list of cars;
 *   - it answers too late, past the poll's 0,5 s timeout.
 *   While broken: the server names the reason; the output still shows the tower's 3 cars in
 *   their order; the console's header chip counts the source as late, the tower's Camadas
 *   row says "fonte atrasada", and "Verificar servidor" names the late source. After it
 *   comes back: the source is ok, the chip and the row say so, and from the take to the end
 *   the tower's layer showed the same graphic at every frame, played its entrance once,
 *   and never showed fewer than its 3 rows, not even for a frame.
 *
 * What these tests deliberately do not cover:
 *   - A red "Erro" after a minute of failing: dataSourceHealth.test.ts proves the minute.
 *   - The simulator, the other source kind on race day: simulatorFailure.chaos.ts.
 *   - The exact sentence of every network error: fetchHttpJsonRequest's tests.
 */
import { type Page } from '@playwright/test';

import { type BajaAppTestServer, startBajaAppTestServer } from '../bajaAppTestServer';
import { startConnectionProxy } from './faults/connectionProxy';
import { chaosServerPort, firstConsoleProxyPort } from './steps/chaosPorts';
import { expect, test } from './steps/chaosTest';
import {
  checkTheServerFromTheMenu,
  findLayerRowInCamadas,
  openTheConsoleAt,
  openTheProgramOutputAt,
} from './steps/pagesOfTheShow';
import {
  bajaAppRaceSourceLabel,
  makeBajaAppRaceSource,
  readInstanceOnProgram,
  takeTowerReadingTheSource,
  waitUntilTheSourceIsHealthy,
  waitUntilTheSourceIsLateBecause,
} from './steps/showOnTheChaosServer';
import {
  expectTheInstanceStayedOnAirUntouched,
  expectTheTowerNeverLostARow,
} from './steps/whatTheAirShowed';

/** The cars of the API doc's race, in race order, as the tower shows them. */
const carsOfTheRaceInOrder = ['11', '22', '33'];

/** Reads the car numbers of the tower's rows on the output, in the order shown. */
async function readCarsOfTheTowerOnTheOutput(outputPage: Page): Promise<string[]> {
  return outputPage
    .locator('[data-layer-id="tower"] > baja-graphic-positions-tower')
    .locator('[data-testid="positions-tower-row"]:not(.is-leaving)')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-car-number') ?? ''));
}

/** The header chip that counts the data sources by health. */
function findSourcesHealthChip(consolePage: Page) {
  return consolePage.getByRole('status', { name: /^Saúde das fontes de dados/ });
}

const waysTheApiBreaks: Array<{
  name: string;
  breakTheApi: (api: BajaAppTestServer) => Promise<void>;
  mendTheApi: (api: BajaAppTestServer) => Promise<void>;
  reasonTheServerGives: RegExp;
}> = [
  // The VPS or the track's link is gone: nothing answers on the port at all.
  {
    name: 'the API goes down',
    breakTheApi: (api) => api.goDown(),
    mendTheApi: (api) => api.comeBack(),
    reasonTheServerGives: /^Não consegui conectar a 127\.0\.0\.1:\d+ \(\w+\): conexão recusada/,
  },
  // A crashed PHP or a captive portal answers 200 with an HTML page.
  {
    name: 'the API answers garbage',
    breakTheApi: async (api) => api.breakTheRace('garbage'),
    mendTheApi: async (api) => api.mendTheRace(),
    reasonTheServerGives: /não é JSON válido/,
  },
  // The timing system restarted and lists nobody yet: valid, and the one answer that
  // would blank the tower if it were taken as data (fixed in this PR).
  {
    name: 'the API answers an empty list of cars',
    breakTheApi: async (api) => api.breakTheRace('emptyListOfCars'),
    mendTheApi: async (api) => api.mendTheRace(),
    reasonTheServerGives:
      /^A fonte respondeu a lista de posições vazia; os últimos dados foram mantidos\.$/,
  },
  // An overloaded API answers, but after the poll gave up on it.
  {
    name: 'the API answers past its timeout',
    breakTheApi: async (api) => api.breakTheRace('tooLate'),
    mendTheApi: async (api) => api.mendTheRace(),
    reasonTheServerGives: /^Tempo esgotado: a fonte não respondeu em 0,5 s\.$/,
  },
];

test.describe('the Baja app race source breaks while the tower is on air', () => {
  for (const wayItBreaks of waysTheApiBreaks) {
    test(`keeps the tower and says the source is late when ${wayItBreaks.name}, and is ok again when it comes back`, async ({
      context,
      startChaosServer,
    }) => {
      let api: BajaAppTestServer | undefined;
      const consoleProxy = await startConnectionProxy(firstConsoleProxyPort, chaosServerPort);
      try {
        // Arrange: a server, the stand-in API, the race source on it read every 0,5 s, the
        // output as OBS has it, the operator's console, and a tower reading it taken (the
        // output open first, so it sees the take's entrance).
        const server = await startChaosServer('bajaAppSourceFailures', chaosServerPort);
        api = await startBajaAppTestServer();
        const sourceId = await makeBajaAppRaceSource(server.port, api.apiAddress);
        const output = await openTheProgramOutputAt(context, server.address);
        const consolePage = await openTheConsoleAt(context, consoleProxy.address);
        await takeTowerReadingTheSource(server.port, sourceId);
        await expect
          .poll(() => readCarsOfTheTowerOnTheOutput(output.page), {
            message: 'the tower on air must show the race before anything breaks',
          })
          .toEqual(carsOfTheRaceInOrder);
        const towerOnAir = await readInstanceOnProgram(server.port, 'tower');

        // Act: the API breaks this way, mid-race.
        await wayItBreaks.breakTheApi(api);

        // Assert: the server says why; the air keeps the race; the console says "late".
        await waitUntilTheSourceIsLateBecause(
          server.port,
          bajaAppRaceSourceLabel,
          wayItBreaks.reasonTheServerGives,
        );
        expect(
          await readCarsOfTheTowerOnTheOutput(output.page),
          'the tower on air must keep the last good race while the API is broken',
        ).toEqual(carsOfTheRaceInOrder);
        await expect(
          findSourcesHealthChip(consolePage),
          'the header chip must count the source as late',
        ).toHaveText('Fontes: 1 atrasada');
        await expect(
          findLayerRowInCamadas(consolePage, 'Torre'),
          'the tower row of Camadas must say its source is late',
        ).toContainText('fonte atrasada');
        await expect(
          await checkTheServerFromTheMenu(consolePage),
          '"Verificar servidor" must name the late source',
        ).toContainText(`Fontes atrasadas: ${bajaAppRaceSourceLabel}.`);

        // Act: the API comes back.
        await wayItBreaks.mendTheApi(api);

        // Assert: the source is ok on the server and on the console, and the tower on air
        // was the same graphic at every frame, its entrance played once.
        await waitUntilTheSourceIsHealthy(server.port, bajaAppRaceSourceLabel);
        await expect(
          findSourcesHealthChip(consolePage),
          'the header chip must count the source as ok again',
        ).toHaveText('Fontes: 1 ok');
        await expect(
          findLayerRowInCamadas(consolePage, 'Torre'),
          'the tower row must no longer say its source is late',
        ).not.toContainText('fonte atrasada');
        expect(
          await readCarsOfTheTowerOnTheOutput(output.page),
          'the tower on air must show the race again',
        ).toEqual(carsOfTheRaceInOrder);
        await expectTheInstanceStayedOnAirUntouched(
          output,
          'tower',
          towerOnAir?.id ?? 'no tower on air',
          `${wayItBreaks.name} and came back`,
        );
        await expectTheTowerNeverLostARow(
          output,
          carsOfTheRaceInOrder.length,
          `${wayItBreaks.name} and came back`,
        );
      } finally {
        await consoleProxy.stop();
        await api?.stop();
      }
    });
  }
});
