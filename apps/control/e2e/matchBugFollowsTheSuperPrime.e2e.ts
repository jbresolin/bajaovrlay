/**
 * The match bug with the simulator's Super Prime, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   BAJAOVRLAY-65's walk, in a real Chromium against the real server and a real SQLite
 *   file: the simulator runs a Super Prime, the match bug reads "Chaves › Partida agora"
 *   live, and the operator moves "agora" on the console's "Partidas da chave". The focus
 *   never moves by itself: when the match "agora" gets its winner the page proposes the
 *   next one, and "Usar sugestão" moves the bug on.
 *
 * The seed: 2027 (the default) with ten cars, at 5×: one heat every 12 s, so the test has
 * time to act between a winner and the next heat, and the Super Prime (17 heats) is far
 * from over while it runs.
 *
 * What these tests prove (the brief's e2e):
 *   1. The bug on air: "Usar sugestão" on an empty "agora" puts the first match to race
 *      there, and the bug, taken from the rundown, shows its two cars on the output.
 *   2. A match decided: the source gives that match its winner; "agora" stays on it, the bug
 *      shows the winner, and the page proposes the next match ("Partida encerrada: … venceu").
 *   3. "Usar sugestão": "agora" moves to the suggested match, and the bug on the output
 *      follows with its two cars.
 *
 * What these tests deliberately do not cover:
 *   - The "a seguir" card, which reads the other slot through the same binding code.
 *   - How the bug looks: packages/graphics/bracket-match-bug's screenshots.
 *   - OBS itself: the output page is the built renderer OBS loads.
 *
 * Setup that is not what the test shows: the bug's item is made through the server's
 * command path (every field bound to "agora"), since the reset before each test deletes
 * the seeded "Chave" panel's items. What it needs: `pnpm build`.
 */
import { expect, type Page, test } from '@playwright/test';

import { readDataOnAirOfLayerFromTheRealServer } from './dataSourceStateOnTheRealServer';
import {
  changeSimulatorInItsEditForm,
  openDataSourcesPageAndWaitUntilConnected,
  pollIntervalOfTheTestsAsTyped,
  restartTheSimulatedRaceWithItsButton,
  seededSimulatorLabel,
  turnSourceOnWithItsSwitch,
} from './dataSourcesTestSteps';
import {
  emptyTheServerState,
  realServerPort,
  sendCommandToRealServer,
} from './emptyTheServerState';
import { openControlPageAndWaitUntilConnected, openOutputInItsOwnPage } from './previewTestSteps';

// The seeded simulator's id, which the bug's bindings name.
const simulatorSourceId = 'simulador-enduro';
// At 5× a heat is decided every 12 s; a minute covers the first match and a slow machine.
const waitForAWinnerInMilliseconds = 60_000;
// A command, a refresh and a redraw reach the output within a few seconds.
const waitForTheAirInMilliseconds = 10_000;

/** One match of the simulator's brackets, as this test reads it. */
type MatchAsTheTestReadsIt = {
  matchId: string;
  carA: { carNumber: number; teamName: string };
  carB?: { carNumber: number; teamName: string };
  winnerCarNumber?: number;
};

/** The parts of GET /api/v1/state this test reads. */
type StateThisTestReads = {
  dataSnapshots: Array<{
    sourceId: string;
    shapes: { brackets?: { rounds: Array<{ matches: MatchAsTheTestReadsIt[] }> } };
  }>;
  bracketMatchFocuses: Array<{ sourceId: string; currentMatchId?: string }>;
};

/** Asks the real server for its state. */
async function readStateFromTheRealServer(): Promise<StateThisTestReads> {
  const response = await fetch(`http://127.0.0.1:${realServerPort}/api/v1/state`);
  if (!response.ok) {
    throw new Error(`GET /api/v1/state answered ${response.status} on the real server`);
  }
  return (await response.json()) as StateThisTestReads;
}

/** Every match of the simulator's brackets now, round after round. */
async function readMatchesOfTheSimulator(): Promise<MatchAsTheTestReadsIt[]> {
  const state = await readStateFromTheRealServer();
  const snapshot = state.dataSnapshots.find(
    (candidate) => candidate.sourceId === simulatorSourceId,
  );
  return (snapshot?.shapes.brackets?.rounds ?? []).flatMap((round) => round.matches);
}

/** The match "agora" of the simulator's focus, by its id, or undefined. */
async function readMatchIdNow(): Promise<string | undefined> {
  const state = await readStateFromTheRealServer();
  return state.bracketMatchFocuses.find((focus) => focus.sourceId === simulatorSourceId)
    ?.currentMatchId;
}

/** A live binding to the match "agora" of the simulator. */
function bindToMatchNow(path: string) {
  return {
    kind: 'binding',
    sourceId: simulatorSourceId,
    shapeKey: 'brackets',
    path: `matchNow.${path}`,
    isLive: true,
  };
}

/** Makes the bug's item in the rundown, every match field bound to "agora". */
async function makeTheMatchBugItem(): Promise<void> {
  await sendCommandToRealServer({
    type: 'createItem',
    home: { kind: 'rundown', rundownId: 'sessao-principal' },
    graphicId: 'bracket-match-bug',
    layerId: 'bracket-match',
    label: 'Partida agora',
    fields: {
      roundName: bindToMatchNow('roundName'),
      bestOf: bindToMatchNow('bestOf'),
      carANumber: bindToMatchNow('carA.carNumber'),
      carAShortName: bindToMatchNow('carA.shortName'),
      carAWins: bindToMatchNow('carA.wins'),
      carBNumber: bindToMatchNow('carB.carNumber'),
      carBShortName: bindToMatchNow('carB.shortName'),
      carBWins: bindToMatchNow('carB.wins'),
      winnerCarNumber: bindToMatchNow('winnerCarNumber'),
    },
  });
}

/**
 * Starts the seeded simulator on seed 2027 with ten cars at 5×, read every 0,5 s, from the
 * green flag, and waits until its Super Prime lists a match to race.
 */
async function startTheSimulatorsSuperPrime(page: Page): Promise<void> {
  await openDataSourcesPageAndWaitUntilConnected(page);
  await changeSimulatorInItsEditForm(page, seededSimulatorLabel, {
    pollIntervalAsTyped: pollIntervalOfTheTestsAsTyped,
    speedAsTyped: '5',
    seedAsTyped: '2027',
    carCountAsTyped: '10',
  });
  await turnSourceOnWithItsSwitch(page, seededSimulatorLabel);
  await restartTheSimulatedRaceWithItsButton(page, seededSimulatorLabel);
  await expect
    .poll(
      async () => (await readMatchesOfTheSimulator()).some((match) => match.carB !== undefined),
      {
        message: 'the simulator’s Super Prime must list a match to race',
        timeout: waitForTheAirInMilliseconds,
      },
    )
    .toBe(true);
}

/** The short names the bug on the output shows, car A first. */
function findShortNamesOnTheOutput(outputPage: Page) {
  return outputPage
    .locator('[data-layer-id="bracket-match"] > baja-graphic-bracket-match-bug')
    .getByTestId('match-bug-car-name');
}

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('the match bug with the simulator’s Super Prime', () => {
  test('follows "agora": on air, a match decided, the proposal, "Usar sugestão", the bug moved on', async ({
    page,
  }) => {
    // Up to a minute for the first winner, then the second match.
    test.setTimeout(150_000);

    // Arrange: the Super Prime running at 5×, the bug's item ready, the output open.
    await startTheSimulatorsSuperPrime(page);
    await makeTheMatchBugItem();
    const outputPage = await openOutputInItsOwnPage(page.context(), '/render/');
    await openControlPageAndWaitUntilConnected(page);
    const panel = page.getByRole('region', { name: 'Partidas da chave' });

    // Act (step 1): "Usar sugestão" on the empty "agora", then the bug taken from the rundown.
    await panel.getByRole('button', { name: 'Usar sugestão' }).click();
    await expect
      .poll(readMatchIdNow, { message: '"agora" must hold the suggestion' })
      .not.toBeUndefined();
    const firstMatchId = (await readMatchIdNow()) ?? '';
    const firstMatch = (await readMatchesOfTheSimulator()).find(
      (match) => match.matchId === firstMatchId,
    );
    await page
      .getByRole('region', { name: 'Rundown' })
      .getByRole('listitem')
      .filter({ hasText: 'Partida agora' })
      .getByRole('button', { name: 'Disparar' })
      .click();

    // Assert (step 1): the bug on the output shows the first match's two cars.
    await expect(
      findShortNamesOnTheOutput(outputPage),
      'the bug on air must show the match "agora"',
    ).toHaveText([firstMatch?.carA.teamName ?? '', firstMatch?.carB?.teamName ?? ''], {
      timeout: waitForTheAirInMilliseconds,
    });

    // Act (step 2): the source gives that match its winner.
    await expect
      .poll(
        async () =>
          (await readMatchesOfTheSimulator()).find((match) => match.matchId === firstMatchId)
            ?.winnerCarNumber,
        { message: 'the match "agora" must be decided', timeout: waitForAWinnerInMilliseconds },
      )
      .not.toBeUndefined();
    const decidedMatch = (await readMatchesOfTheSimulator()).find(
      (match) => match.matchId === firstMatchId,
    );
    const winnerName =
      decidedMatch?.winnerCarNumber === decidedMatch?.carA.carNumber
        ? decidedMatch?.carA.teamName
        : decidedMatch?.carB?.teamName;

    // Assert (step 2): "agora" did not move; the bug shows the winner; the page proposes.
    expect(await readMatchIdNow(), '"agora" must never move by itself').toBe(firstMatchId);
    await expect
      .poll(
        async () => (await readDataOnAirOfLayerFromTheRealServer('bracket-match'))?.winnerCarNumber,
        {
          message: 'the bug must show the winner of the same match',
          timeout: waitForTheAirInMilliseconds,
        },
      )
      .toBe(decidedMatch?.winnerCarNumber);
    await expect(
      panel.getByText(`Partida encerrada: ${winnerName ?? ''} venceu.`),
      'the page must say the match is over',
    ).toBeVisible();
    await expect(panel.getByText(/^Próxima sugerida: /), 'and propose the next one').toBeVisible();

    // Act (step 3): "Usar sugestão".
    await panel.getByRole('button', { name: 'Usar sugestão' }).click();

    // Assert (step 3): "agora" moved on, and the bug on the output shows the new match.
    await expect
      .poll(readMatchIdNow, { message: '"agora" must move to the suggestion' })
      .not.toBe(firstMatchId);
    const secondMatchId = (await readMatchIdNow()) ?? '';
    const secondMatch = (await readMatchesOfTheSimulator()).find(
      (match) => match.matchId === secondMatchId,
    );
    await expect(
      findShortNamesOnTheOutput(outputPage),
      'the bug must follow "agora" to the next match',
    ).toHaveText([secondMatch?.carA.teamName ?? '', secondMatch?.carB?.teamName ?? ''], {
      timeout: waitForTheAirInMilliseconds,
    });
  });
});
