/**
 * A flex HTTP/JSON source read from a real timing system, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   The flex source lets an operator point BajaOvrLay at any JSON endpoint and say, in the
 *   form, how its answer maps into our positions and session. This test does what João's
 *   walk does, in a real Chromium against the real server and a real SQLite file: the
 *   example preset is imported, tested, saved and turned on, and the server then polls an
 *   imaginary timing system that the test runs itself on a local port (node:http).
 *
 * What these tests prove:
 *   - Importing the example config, pointed at the test's timing system, and pressing
 *     "Buscar da fonte" then "Testar" shows the 20 cars in the test's result table.
 *   - Saved and turned on, the source's positions table lists the same 20 cars.
 *   - When the timing system's answer changes (car 6 takes the lead), the table follows.
 *   - When the timing system answers 500, the chip reads "Atrasada", the server keeps the
 *     reason, and the table keeps the last good data over several failed polls.
 *   - When it answers 200 again (Acauã Baja back in the lead), the chip is back to "Ok"
 *     and the table shows that fresh answer, not the kept data.
 *
 * What these tests deliberately do not cover:
 *   - Every mapping rule and problem line: applyFlexMapping.test.ts (packages/shared).
 *   - Every fetch error (timeout, bad JSON, the 5 MB cap, connection refused) and the
 *     environment-variable headers: the httpJson adapter's tests (apps/server).
 *   - Pasting a sample instead of fetching it, and a broken sample: DataSourcesPageFlexTest.test.tsx.
 *   - Red "Erro" after a minute of failing: dataSourceHealth.test.ts, with a fake clock.
 *
 * What it needs: `pnpm build` (the server registers built graphics only).
 *
 * Sharing the server with the other tests:
 *   Before each test the server is emptied, which deletes every source but the seeded
 *   simulator, so the flex source made here is gone before the next test. Each test gets
 *   its own timing system through the `timingSystem` fixture, stopped when the test ends.
 */
import { expect, type Page, test as base } from '@playwright/test';

import {
  readDataSourceFromTheRealServer,
  waitUntilTheSourceHasFailedPollsInARow,
} from './dataSourceStateOnTheRealServer';
import {
  findCarRowsOfPositionsTable,
  findDataSourceRow,
  findPositionsTableOfSource,
  findStatusChipOfSourceRow,
  openDataSourcesPageAndWaitUntilConnected,
  openNewSourceFormOfKind,
  pollIntervalOfTheTestsAsTyped,
  readFirstRowsOfPositionsTable,
  turnSourceOnWithItsSwitch,
  waitUntilFirstRowsOfPositionsTableDiffer,
} from './dataSourcesTestSteps';
import { emptyTheServerState } from './emptyTheServerState';
import {
  type ExampleTimingSystemResponse,
  readExampleTimingSystemResponse,
  startTimingSystemTestServer,
  type TimingSystemTestServer,
  writeExampleConfigPointedAt,
} from './timingSystemTestServer';

// The name the operator gives the flex source in this test.
const flexSourceLabel = 'Cronometragem — exemplo';
// How many cars the example response lists.
const carsInTheExample = 20;
// The server reads every 0,5 s: a change shows at the next poll, so a few seconds cover a
// slow machine. The first data comes right after the source is turned on.
const waitForTheNextPollsInMilliseconds = 5_000;
// The late data is checked once the server has counted this many failed polls in a row:
// about two seconds of failing, far under the minute that turns the chip red.
const failedPollsBeforeTheDataIsChecked = 4;

/**
 * Each test asks for `timingSystem` and gets its own imaginary timing system, answering
 * with the example response: started before the test, stopped after it, so no test ever
 * sees another's answers and nothing is shared between tests.
 */
const test = base.extend<{ timingSystem: TimingSystemTestServer }>({
  // Playwright reads which fixtures a fixture needs from its first argument, which must be
  // an object pattern; this one needs none, hence the empty one.
  // eslint-disable-next-line no-empty-pattern
  timingSystem: async ({}, use) => {
    const timingSystemOfThisTest = await startTimingSystemTestServer(
      readExampleTimingSystemResponse(),
    );
    await use(timingSystemOfThisTest);
    await timingSystemOfThisTest.stop();
  },
});

/**
 * Builds the example response a few minutes later: car 6 (Sabiá Baja, second) has passed
 * car 17 (Acauã Baja) for the lead. The two swap places in the list and in their gaps.
 */
function buildResponseWhereSabiaBajaTakesTheLead(): ExampleTimingSystemResponse {
  const response = readExampleTimingSystemResponse();
  const [formerLeader, newLeader, ...theRest] = response.classificacao;
  if (formerLeader === undefined || newLeader === undefined) {
    throw new Error('the example response must list at least two cars');
  }
  // A leader has no gap and no interval (the positions shape refuses one that does), so
  // the former leader takes the gap and the interval the new one had. The cars behind keep
  // their numbers: the test only reads who is first, not the gaps behind.
  const gapOfTheFormerSecond = newLeader.diferenca;
  const intervalOfTheFormerSecond = newLeader.intervalo_s;
  newLeader.diferenca = null;
  newLeader.intervalo_s = null;
  formerLeader.diferenca = gapOfTheFormerSecond;
  formerLeader.intervalo_s = intervalOfTheFormerSecond;
  response.classificacao = [newLeader, formerLeader, ...theRest];
  return response;
}

/**
 * Makes the flex source as the operator does: "+ Fonte" → "HTTP/JSON (flexível)", the
 * example config imported with its URL pointed at `classificacaoAddress`, a name and the
 * 0,5 s interval typed. Returns the form, still open and not saved.
 */
async function openNewFlexFormWithTheExampleImported(page: Page, classificacaoAddress: string) {
  const flexForm = await openNewSourceFormOfKind(page, 'HTTP/JSON (flexível)');
  await flexForm.getByRole('button', { name: 'Importar configuração' }).click();
  await flexForm
    .getByLabel('Configuração para importar (JSON)')
    .fill(writeExampleConfigPointedAt(classificacaoAddress));
  await flexForm.getByRole('button', { name: 'Importar', exact: true }).click();
  await expect(
    flexForm.getByText('Configuração importada. Confira e salve a fonte.'),
    'the example config must be accepted by the import',
  ).toBeVisible();
  await flexForm.getByLabel('Nome da fonte').fill(flexSourceLabel);
  await flexForm.getByLabel('Intervalo de leitura (segundos)').fill(pollIntervalOfTheTestsAsTyped);
  return flexForm;
}

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('a flex source made from the example preset', () => {
  test('shows the 20 cars in "Testar" before anything is saved', async ({ page, timingSystem }) => {
    // Arrange: the new flex form with the example config imported, pointed at the test's
    // timing system.
    await openDataSourcesPageAndWaitUntilConnected(page);
    const flexForm = await openNewFlexFormWithTheExampleImported(
      page,
      timingSystem.classificacaoAddress,
    );
    const testPanel = flexForm.getByRole('region', { name: 'Testar' });

    // Act: fetch the sample through the server with "Buscar da fonte", then press "Testar".
    await testPanel.getByRole('button', { name: 'Buscar da fonte' }).click();
    await expect(
      testPanel.getByText('A fonte respondeu 200.'),
      'the server must fetch the sample from the timing system',
    ).toBeVisible({ timeout: waitForTheNextPollsInMilliseconds });
    await testPanel.getByRole('button', { name: 'Testar', exact: true }).click();

    // Assert: the result table lists the 20 cars, the leader first.
    const resultTable = testPanel
      .getByRole('region', { name: 'Resultado' })
      .getByRole('table', { name: 'Posições' });
    await expect(
      findCarRowsOfPositionsTable(resultTable),
      '"Testar" must show every car of the fetched response',
    ).toHaveCount(carsInTheExample);
    await expect(
      findCarRowsOfPositionsTable(resultTable).first(),
      'the first car in the list is the leader',
    ).toContainText('Acauã Baja');
  });

  test('follows the timing system once on, keeps its data on a 500, and recovers', async ({
    page,
    timingSystem,
  }) => {
    // Arrange: the flex source saved, turned on and shown, with its 20 cars and "Ok".
    await openDataSourcesPageAndWaitUntilConnected(page);
    const flexForm = await openNewFlexFormWithTheExampleImported(
      page,
      timingSystem.classificacaoAddress,
    );
    await flexForm.getByRole('button', { name: 'Salvar fonte' }).click();
    await expect(flexForm, 'the form must close once the server has the source').toBeHidden();
    await turnSourceOnWithItsSwitch(page, flexSourceLabel);
    const flexRow = findDataSourceRow(page, flexSourceLabel);
    await flexRow.getByRole('button', { name: 'Ver' }).click();
    const positionsTable = findPositionsTableOfSource(page, flexSourceLabel);
    await expect(
      findCarRowsOfPositionsTable(positionsTable),
      'the source must show the 20 cars of the timing system once it is on',
    ).toHaveCount(carsInTheExample, { timeout: waitForTheNextPollsInMilliseconds });
    await expect(
      findStatusChipOfSourceRow(flexRow),
      'a timing system answering must read "Ok"',
    ).toHaveText('Ok', { timeout: waitForTheNextPollsInMilliseconds });
    const firstData = await readFirstRowsOfPositionsTable(page, flexSourceLabel, carsInTheExample);

    // Act (1): the timing system's answer changes: car 6 takes the lead.
    timingSystem.answerWithResponse(buildResponseWhereSabiaBajaTakesTheLead());

    // Assert (1): the table follows at a next poll, with Sabiá Baja first.
    const changedData = await waitUntilFirstRowsOfPositionsTableDiffer(page, {
      sourceLabel: flexSourceLabel,
      rowCount: carsInTheExample,
      earlierRead: firstData,
      failureMessage: 'the table must follow the changed answer of the timing system',
      timeoutInMilliseconds: waitForTheNextPollsInMilliseconds,
    });
    expect(changedData[0], 'the new leader must be first in the table').toContain('Sabiá Baja');

    // Act (2): the timing system breaks and answers 500.
    timingSystem.answerWithServerError();

    // Assert (2): "Atrasada", the reason kept on the server, and the table unchanged after
    // several failed polls.
    await expect(
      findStatusChipOfSourceRow(flexRow),
      'a source whose endpoint answers 500 must read "Atrasada"',
    ).toHaveText(/^Atrasada/, { timeout: waitForTheNextPollsInMilliseconds });
    await expect(
      page.getByText(/fonte atrasada$/),
      'the data of a late source must carry the "fonte atrasada" banner',
    ).toBeVisible();
    await waitUntilTheSourceHasFailedPollsInARow({
      sourceLabel: flexSourceLabel,
      failureCount: failedPollsBeforeTheDataIsChecked,
      failureMessage: 'the server must count several failed polls of the broken timing system',
      timeoutInMilliseconds: waitForTheNextPollsInMilliseconds,
    });
    const sourceWhileFailing = await readDataSourceFromTheRealServer(flexSourceLabel);
    expect(
      sourceWhileFailing.status.lastError,
      'the server must keep why the poll failed, in pt-BR',
    ).toBe('A fonte respondeu 500 (Internal Server Error) em classificacao');
    expect(
      await readFirstRowsOfPositionsTable(page, flexSourceLabel, carsInTheExample),
      'failed polls must neither blank nor change the last good data',
    ).toEqual(changedData);

    // Act (3): the timing system is mended and answers 200 again, with an answer unlike the
    // kept data (Acauã Baja back in the lead), so fresh data can be told from the stale.
    timingSystem.answerWithResponse(readExampleTimingSystemResponse());

    // Assert (3): "Ok" again, the late banner gone, and the table showing the new answer.
    await expect(
      findStatusChipOfSourceRow(flexRow),
      'a timing system answering again must read "Ok"',
    ).toHaveText('Ok', { timeout: waitForTheNextPollsInMilliseconds });
    await expect(
      page.getByText(/fonte atrasada$/),
      'a recovered source must lose the "fonte atrasada" banner',
    ).toBeHidden();
    const recoveredData = await waitUntilFirstRowsOfPositionsTableDiffer(page, {
      sourceLabel: flexSourceLabel,
      rowCount: carsInTheExample,
      earlierRead: changedData,
      failureMessage: 'the recovered source must show the fresh answer, not the kept data',
      timeoutInMilliseconds: waitForTheNextPollsInMilliseconds,
    });
    expect(recoveredData[0], 'Acauã Baja must lead again in the fresh data').toContain(
      'Acauã Baja',
    );
    await expect(
      findCarRowsOfPositionsTable(positionsTable),
      'the recovered source must show its 20 cars',
    ).toHaveCount(carsInTheExample);
  });
});
