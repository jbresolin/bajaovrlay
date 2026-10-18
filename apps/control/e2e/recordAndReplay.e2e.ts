/**
 * Recording a source and replaying it, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   Rehearsals run on recorded data (concept §7 rule 8): "Gravar" on a source writes each
 *   good poll to a file in the server's data folder, and a "Reprodução" source plays a
 *   finished recording back, faster if asked. This test records the simulator from the
 *   "Fontes de dados" page and replays it at 10×, in a real Chromium against the real
 *   server, a real SQLite file and a real recordings folder.
 *
 * What these tests prove:
 *   - "Gravar" on the running simulator (read every 0,5 s) shows the "Gravando" badge,
 *     and "Parar gravação", once the server counts 40 lines in the file (about 20 s),
 *     takes it away.
 *   - "+ Fonte" → "Reprodução" makes a replay of that recording at 10×, starting again
 *     at the end, read every 0,5 s; turned on and picked by its label, it shows a
 *     positions table of 60 cars that comes from the recording, and it moves through the
 *     recording: its first places change from one of its own reads to a later one, twice,
 *     so a replay stuck on one recorded line fails.
 *
 * What these tests deliberately do not cover:
 *   - Which recorded line answers at which moment, looping and holding at the end, and the
 *     rewritten clock: replayTimeline.test.ts and replayAdapter.test.ts, with a fake clock.
 *   - The file's lines and the recordings listed after a restart: recorder.test.ts and
 *     recordingsFromFolder.test.ts.
 *   - The exact recorded rows: the replay's polls and the simulator's polls do not fall on
 *     the same moments, so the test compares the replay with itself only.
 *   - That the replay keeps to 10× exactly: replayTimeline.test.ts, with a fake clock.
 *   - A replay that plays once and holds at the end: at 10× this recording ends after
 *     2 s, too soon to watch it move in a browser, so this replay starts again at the end.
 *
 * What it needs: `pnpm build` (the server registers built graphics only).
 *
 * Sharing the server with the other tests:
 *   Before each test the server is emptied: every source but the seeded simulator is
 *   deleted, and the simulator is off, not recording, with its default settings back.
 *   Recordings of earlier tests stay listed (their files stay replayable), so the replay
 *   form picks this test's recording, the newest one of the simulator, which the form
 *   lists first.
 */
import { expect, test } from '@playwright/test';

import { waitUntilTheOpenRecordingHasSnapshots } from './dataSourceStateOnTheRealServer';
import {
  carsInTheSeededRace,
  findCarRowsOfPositionsTable,
  findDataSourceRow,
  findPositionsTableOfSource,
  openDataSourcesPageAndWaitUntilConnected,
  openNewSourceFormOfKind,
  pollIntervalOfTheTestsAsTyped,
  readFirstRowsOfPositionsTable,
  seededSimulatorLabel,
  startTheSeededSimulatorFastFromTheGreenFlag,
  turnSourceOnWithItsSwitch,
  waitUntilFirstRowsOfPositionsTableDiffer,
} from './dataSourcesTestSteps';
import { emptyTheServerState } from './emptyTheServerState';

// About 20 s of recording, as the brief asks: 40 polls of the simulator at 0,5 s each. The
// test waits for the server to count them in the file, not for a fixed time.
const recordedSnapshotsWanted = 40;
// 40 polls at 0,5 s take 20 s; the rest is room for a slow machine.
const waitForTheRecordingInMilliseconds = 30_000;
// The whole test usually takes about 30 s (20 s of recording, plus starting the simulator
// and the replay); Playwright's default of 30 s would stop it halfway, so it gets 90 s,
// room for every wait below to run to its limit on a slow machine.
const longestThisTestMayTakeInMilliseconds = 90_000;
// A poll comes every 0,5 s; a few seconds cover a slow machine.
const waitForTheNextPollsInMilliseconds = 10_000;
// The first ten places are compared: at 60× the leaders cross the line every 4 to 7 real
// seconds, so in a recording of 20 s the first ten places change within a few lines.
const placesCompared = 10;
// The name the operator gives the replay source, as it would read in the list.
const replayLabel = 'Ensaio do enduro';

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('recording the simulator and replaying it', () => {
  test('replays about 20 s of the simulator at 10× and shows the recorded race moving', async ({
    page,
  }) => {
    test.setTimeout(longestThisTestMayTakeInMilliseconds);

    // Arrange: the simulator on at speed 60, read every 0,5 s from the green flag, with
    // its 60 cars shown; "Gravar"; once the server counts 40 lines in the file (about
    // 20 s), "Parar gravação".
    await openDataSourcesPageAndWaitUntilConnected(page);
    await startTheSeededSimulatorFastFromTheGreenFlag(page);
    const simulatorRow = findDataSourceRow(page, seededSimulatorLabel);
    await simulatorRow.getByRole('button', { name: 'Gravar' }).click();
    await expect(
      simulatorRow.getByText('Gravando'),
      'a recording source must carry the "Gravando" badge',
    ).toBeVisible();
    await waitUntilTheOpenRecordingHasSnapshots({
      sourceLabel: seededSimulatorLabel,
      snapshotCount: recordedSnapshotsWanted,
      failureMessage: 'a recording of a simulator read every 0,5 s must reach 40 lines in 30 s',
      timeoutInMilliseconds: waitForTheRecordingInMilliseconds,
    });
    await simulatorRow.getByRole('button', { name: 'Parar gravação' }).click();
    await expect(
      simulatorRow.getByText('Gravando'),
      'the badge must go once the recording is stopped',
    ).toBeHidden();

    // Act: "+ Fonte" → "Reprodução", named, read every 0,5 s, on the newest recording of
    // the simulator, at 10×, starting again at the end; saved, turned on, and picked by
    // its label to show its data.
    const replayForm = await openNewSourceFormOfKind(page, 'Reprodução');
    await replayForm.getByLabel('Nome da fonte').fill(replayLabel);
    // The replay is read every 0,5 s too (the shortest interval allowed), so at 10× each
    // read is 5 recorded seconds on, ten lines apart. At the default 2 s each read would
    // jump 20 recorded seconds, the whole recording, and a replay starting again at the
    // end could land on almost the same line every time.
    await replayForm
      .getByLabel('Intervalo de leitura (segundos)')
      .fill(pollIntervalOfTheTestsAsTyped);
    await replayForm.getByRole('combobox', { name: 'Gravação' }).click();
    // The list is drawn outside the form, at the end of the page; newest first.
    await page.getByRole('option').filter({ hasText: seededSimulatorLabel }).first().click();
    await replayForm.getByRole('combobox', { name: 'Velocidade da reprodução' }).click();
    await page.getByRole('option', { name: '10×', exact: true }).click();
    await replayForm.getByRole('switch', { name: 'Recomeçar ao chegar ao fim' }).click();
    await replayForm.getByRole('button', { name: 'Salvar fonte' }).click();
    await expect(replayForm, 'the form must close once the server has the replay').toBeHidden();
    await turnSourceOnWithItsSwitch(page, replayLabel);
    await findDataSourceRow(page, replayLabel).getByRole('button', { name: replayLabel }).click();

    // Assert: the replay shows 60 cars from the recording, and its first places change
    // twice from its own earlier read: the first change may only be this run's data
    // replacing data an earlier run left, the second shows it moving through the recording.
    const replayPositionsTable = findPositionsTableOfSource(page, replayLabel);
    await expect(
      findCarRowsOfPositionsTable(replayPositionsTable),
      'the replay must show the 60 recorded cars',
    ).toHaveCount(carsInTheSeededRace, { timeout: waitForTheNextPollsInMilliseconds });
    const replayReadOnceShown = await readFirstRowsOfPositionsTable(
      page,
      replayLabel,
      placesCompared,
    );
    const replayReadOfThisRun = await waitUntilFirstRowsOfPositionsTableDiffer(page, {
      sourceLabel: replayLabel,
      rowCount: placesCompared,
      earlierRead: replayReadOnceShown,
      failureMessage: 'the replay must soon show another moment of the recording',
      timeoutInMilliseconds: waitForTheNextPollsInMilliseconds,
    });
    await waitUntilFirstRowsOfPositionsTableDiffer(page, {
      sourceLabel: replayLabel,
      rowCount: placesCompared,
      earlierRead: replayReadOfThisRun,
      failureMessage: 'the replay must keep moving through the recording, not stay on one line',
      timeoutInMilliseconds: waitForTheNextPollsInMilliseconds,
    });
  });
});
