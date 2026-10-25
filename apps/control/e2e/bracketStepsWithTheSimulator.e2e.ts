/**
 * The bracket with the simulator's Super Prime, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   BAJAOVRLAY-25's walk, in a real Chromium against the real server and a real SQLite
 *   file: the simulator runs a Super Prime of its fictional field, a bracket item reads its
 *   rounds live, and the operator steps through it with "Próximo" on its Camadas row. The
 *   bracket's steps are counted from its rounds (the manifest's `stepCount` -1 and its
 *   `bracketSteps` counter), so the row's "Passo n de N" is the server's count of them.
 *
 * The seed: 2027 (the default) with ten cars, at 60×: a draw of 16 slots with 6 byes, then
 * 17 heats, so the final is decided 17 simulated minutes in (about 17 s), its champion car 8
 * (seedsTheBrowserTestsRelyOn.test.ts pins it). Its rounds are the oitavas (eight matches,
 * one round board), the quartas, the semis, the third place and the final: five steps.
 *
 * What these tests prove (the brief's three E2E steps):
 *   1. The simulator started on seed 2027 with ten cars, run until its Super Prime has a
 *      champion.
 *   2. A bracket item whose rounds read the simulator's brackets ("Chaves › Todas as fases"),
 *      live, taken: the server has its five rounds on air.
 *   3. "Próximo" pressed through every step on the Camadas row: "Passo 1 de 5" to "Passo 5
 *      de 5", each press once the row shows the step before it; on the last step "Próximo"
 *      is off; the output draws the final with its champion.
 *
 * What these tests deliberately do not cover:
 *   - A live update that changes the number of rounds: the server's
 *     instanceStepsWithinTheirCount.test.ts and the graphic's bracketUpdates.test.ts.
 *   - What the bracket looks like: packages/graphics/bracket's screenshot tests.
 *   - OBS itself: the output page is the built renderer OBS loads.
 *
 * Why the simulator is switched off before the item is made: binding a field while a race
 * runs at 60× slows the item editor to a crawl (BAJAOVRLAY-45, another agent's task), which
 * is not this walk; the source's last data stays, and a live binding reads it. The editor
 * suggests the manifest's binding only from a source that is on, so the rounds are bound by
 * hand ("Fonte", the simulator, "Chaves › Todas as fases"), as the operator would.
 *
 * What it needs: `pnpm build` (the server registers built graphics only, and the output
 * page is the built renderer).
 *
 * Sharing the server with the other tests: before each test the server is emptied
 * (nothing on air, no item, the simulator off with its default settings), so this test
 * passes whatever ran before it.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import {
  readBracketRoundsOfSourceFromTheRealServer,
  readDataOnAirOfLayerFromTheRealServer,
} from './dataSourceStateOnTheRealServer';
import {
  changeSimulatorInItsEditForm,
  openDataSourcesPageAndWaitUntilConnected,
  pollIntervalOfTheTestsAsTyped,
  restartTheSimulatedRaceWithItsButton,
  seededSimulatorLabel,
  turnSourceOffWithItsSwitch,
  turnSourceOnWithItsSwitch,
} from './dataSourcesTestSteps';
import { emptyTheServerState } from './emptyTheServerState';
import {
  openControlPageAndWaitUntilConnected,
  openItemEditorWithNewGraphic,
  openOutputInItsOwnPage,
  saveAndTakeTheItemInTheEditor,
} from './previewTestSteps';

// The bracket's list field, as its manifest titles it.
const bracketRoundsField = 'Fases';
// The ten-car Super Prime of seed 2027 is decided 17 simulated minutes in, about 17 s at
// 60× after the first data (up to 10 s); 60 s leaves room on a slow machine.
const waitForTheChampionInMilliseconds = 60_000;
// A take reaches the server at once; a few seconds cover a slow machine.
const waitForTheAirInMilliseconds = 10_000;
// The champion of seed 2027's ten-car Super Prime, and the steps of its rounds.
const championOfTheSuperPrime = 8;
const stepsOfTheSuperPrime = 5;

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
 * Starts the seeded simulator on seed 2027 with ten cars at 60×, read every 0,5 s, from the
 * green flag; waits for its Super Prime's champion; then switches it off, its data kept.
 */
async function runTheSimulatorsSuperPrimeToItsChampion(page: Page): Promise<void> {
  await openDataSourcesPageAndWaitUntilConnected(page);
  await changeSimulatorInItsEditForm(page, seededSimulatorLabel, {
    pollIntervalAsTyped: pollIntervalOfTheTestsAsTyped,
    speedAsTyped: '60',
    seedAsTyped: '2027',
    carCountAsTyped: '10',
  });
  await turnSourceOnWithItsSwitch(page, seededSimulatorLabel);
  await restartTheSimulatedRaceWithItsButton(page, seededSimulatorLabel);
  await expect
    .poll(
      async () => {
        const rounds = await readBracketRoundsOfSourceFromTheRealServer(seededSimulatorLabel);
        const final = rounds.find((round) => round.name === 'Final');
        return final?.matches[0]?.winnerCarNumber;
      },
      {
        message: 'the simulator’s Super Prime must have its champion',
        timeout: waitForTheChampionInMilliseconds,
      },
    )
    .toBe(championOfTheSuperPrime);
  await turnSourceOffWithItsSwitch(page, seededSimulatorLabel);
}

test.describe('the bracket with the simulator’s Super Prime', () => {
  test('a bracket item read live from the simulator, stepped through on its Camadas row', async ({
    page,
  }) => {
    // Up to a minute for the Super Prime, then the item and five steps.
    test.setTimeout(120_000);

    // Arrange (step 1): the simulator's Super Prime run to its champion; the output open.
    await runTheSimulatorsSuperPrimeToItsChampion(page);
    const outputPage = await openOutputInItsOwnPage(page.context(), '/render/');

    // Act (step 2): the bracket item, its rounds read from the simulator's brackets, live
    // (the editor's default for "Fonte"), titled, saved and taken.
    await openControlPageAndWaitUntilConnected(page);
    const itemEditor = await openItemEditorWithNewGraphic(page, 'Super Prime', 'Chaveamento');
    await chooseInEditorDropdown(page, itemEditor, `Como preencher ${bracketRoundsField}`, 'Fonte');
    await chooseInEditorDropdown(
      page,
      itemEditor,
      `Fonte de ${bracketRoundsField}`,
      seededSimulatorLabel,
    );
    await chooseInEditorDropdown(
      page,
      itemEditor,
      `O que ${bracketRoundsField} lê da fonte`,
      'Chaves › Todas as fases',
    );
    await itemEditor.getByLabel('Título', { exact: true }).fill('SUPER PRIME');
    await saveAndTakeTheItemInTheEditor(itemEditor);

    // Assert (step 2): on the server, the five rounds on air, the final's champion car 8.
    await expect
      .poll(
        async () => {
          const dataOnAir = (await readDataOnAirOfLayerFromTheRealServer('fullscreen')) as
            { rounds?: Array<{ name: string }> } | undefined;
          return dataOnAir?.rounds?.map((round) => round.name);
        },
        {
          message: 'the bracket on air must carry the Super Prime’s five rounds',
          timeout: waitForTheAirInMilliseconds,
        },
      )
      .toEqual([
        'Oitavas de final',
        'Quartas de final',
        'Semifinal',
        'Disputa de 3º lugar',
        'Final',
      ]);

    // Act (step 3): "Próximo" through every step on the "Tela cheia" row, each press once
    // the row shows the step before it.
    const fullscreenRow = page.getByRole('listitem', { name: 'Tela cheia' });
    for (let stepNumber = 1; stepNumber < stepsOfTheSuperPrime; stepNumber += 1) {
      await expect(
        fullscreenRow.getByText(`Passo ${String(stepNumber)} de ${String(stepsOfTheSuperPrime)}`),
        'the row must count the step before pressing Próximo',
      ).toBeVisible();
      await fullscreenRow.getByRole('button', { name: 'Próximo' }).click();
    }

    // Assert (step 3): the last step on the row, "Próximo" off, the final on the output.
    await expect(
      fullscreenRow.getByText(
        `Passo ${String(stepsOfTheSuperPrime)} de ${String(stepsOfTheSuperPrime)}`,
      ),
      'the row must count the last step',
    ).toBeVisible();
    await expect(
      fullscreenRow.getByRole('button', { name: 'Próximo' }),
      'nothing after the last step',
    ).toBeDisabled();
    const bracket = outputPage.locator('[data-layer-id="fullscreen"] > baja-graphic-bracket');
    const finalOnTheOutput = bracket.locator('[data-testid="bracket-tree-match"][data-column="2"]');
    await expect(finalOnTheOutput, 'the output draws the final').toBeVisible();
    await expect(
      finalOnTheOutput.locator(
        `[data-testid="bracket-tree-car"][data-car-number="${String(championOfTheSuperPrime)}"]`,
      ),
      'the champion is marked the winner',
    ).toHaveAttribute('data-outcome', 'winner');
  });
});
