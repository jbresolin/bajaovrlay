/**
 * The standings web component: live updates (packages/graphics/standings)
 *
 * What this module is for:
 *   A standings item is bound live to a source, so updateAction arrives every few seconds
 *   while the board is on air. The board must draw the new list on the page it shows, in
 *   place: the same row elements, nothing playing in again, the page turns going on.
 *
 * What these tests prove:
 *   - An update on air redraws the current page in place: the same row element in each
 *     slot, the new texts in it, the rows and the head card still fully shown (no re-entry,
 *     no tween started), and page 2 stays page 2.
 *   - A list that shrank under the page on air lands on its last page, the line following.
 *   - Score parts arriving on air turn the columns board into the table at once.
 *   - An update that arrives during a page turn (while the next page cascades in) is not
 *     drawn on the moving rows; it is drawn once the turn has ended, so nothing is lost.
 *   - An update that arrives during the stop-out (while the rows fade out) is not drawn on
 *     the fading rows; once the stop-out ends the board rests on page 1 with the new data.
 *   - A refused update answers 400 in pt-BR and leaves the board as it was.
 *
 * What these tests deliberately do not cover:
 *   - The lifecycle and the page timer; standings.test.ts covers them.
 *   - Re-ranking motion: a team that moves is simply drawn in its new slot (not animated,
 *     by decision of BAJAOVRLAY-24).
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import {
  createOverallStandingsEntries,
  createOverallStandingsTotalOnly,
  createOverallStandingsWithParts,
  overallScoreParts,
} from './previewData.js';
import type StandingsGraphic from './standings.js';
import type { StandingsEntry } from './standingsModel.js';
import {
  ardosiaMotionTokenDeclarations,
  createStandingsOnThePage,
  findPartOfStandings,
  listPartsOfStandings,
  loadStandingsWithData,
  placeTokensOnTheRoot,
  readCarNumbersOnTheBoard,
  readPageLine,
} from './standingsOnThePage.testSupport.js';

/** The overall entries with the teams in rows `rowA` and `rowB` (from 1) trading places. */
function swapTeamsInRows(entries: StandingsEntry[], rowA: number, rowB: number): StandingsEntry[] {
  const swapped = [...entries];
  const teamA = swapped[rowA - 1];
  const teamB = swapped[rowB - 1];
  if (teamA === undefined || teamB === undefined) {
    throw new Error('swapTeamsInRows was given a row outside the list');
  }
  swapped[rowA - 1] = { ...teamB, rank: teamA.rank };
  swapped[rowB - 1] = { ...teamA, rank: teamB.rank };
  return swapped;
}

/** A board on air with the real overall standings, every motion lasting 0 ms. */
async function createOverallStandingsOnAir(): Promise<StandingsGraphic> {
  const standings = createStandingsOnThePage();
  await loadStandingsWithData(standings, createOverallStandingsWithParts());
  await standings.playAction({ skipAnimation: true });
  return standings;
}

/**
 * Resolves as soon as the head's page line reads `pageLine`: the moment a turn has drawn
 * the next page and starts cascading it in. A MutationObserver fires right after the
 * change, before any timer, so the test acts in the middle of the cascade.
 */
function waitUntilThePageLineReads(standings: StandingsGraphic, pageLine: string): Promise<void> {
  const pageLineElement = findPartOfStandings(standings, 'standings-page-line');
  if (pageLineElement === undefined) {
    throw new Error('the board has no page line; load it first');
  }
  return new Promise((resolve) => {
    const watcher = new MutationObserver(() => {
      if (pageLineElement.textContent === pageLine) {
        watcher.disconnect();
        resolve();
      }
    });
    watcher.observe(pageLineElement, { childList: true, characterData: true, subtree: true });
  });
}

describe('a live update on air', () => {
  it('redraws the current page in place, with no re-entry', async () => {
    // Arrange: the table on air; the first row element and the head card noted.
    const standings = await createOverallStandingsOnAir();
    const firstRowBefore = listPartsOfStandings(standings, 'standings-row')[0];
    const head = findPartOfStandings(standings, 'standings-head');

    // Act: Equipe FEI Baja overtakes Baja UFMG in the next poll.
    const answer = await standings.updateAction({
      data: { entries: swapTeamsInRows(createOverallStandingsEntries(), 1, 2) },
    });

    // Assert: 200; slot 1 is the same element now showing car 1; nothing re-entered.
    const firstRowAfter = listPartsOfStandings(standings, 'standings-row')[0];
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(firstRowAfter, 'slot 1 must keep its element').toBe(firstRowBefore);
    expect(firstRowAfter?.dataset.carNumber, 'slot 1 must now show car 1').toBe('1');
    expect(firstRowAfter?.style.opacity, 'the row stays fully shown, never re-entering').toBe('1');
    expect(head?.style.opacity, 'the head card stays fully shown').toBe('1');
    expect(gsap.getTweensOf(firstRowAfter ?? []), 'no motion may start on the row').toEqual([]);
  });

  it('keeps page 2 on air when an update arrives there', async () => {
    // Arrange: the table on air, turned to page 2.
    const standings = await createOverallStandingsOnAir();
    await standings.turnToTheNextPageNow();

    // Act: the 21st and 22nd teams trade places in the next poll.
    await standings.updateAction({
      data: { entries: swapTeamsInRows(createOverallStandingsEntries(), 21, 22) },
    });

    // Assert: still page 2, its first row now car 44 (UFPBaja).
    expect(readPageLine(standings), 'the page on air must not change').toBe('2/3 · 21º A 40º');
    expect(readCarNumbersOnTheBoard(standings)[0], 'page 2 now starts with car 44').toBe(44);
  });

  it('lands on the last page when the list shrinks under the page on air', async () => {
    // Arrange: the table on air, turned to page 3.
    const standings = await createOverallStandingsOnAir();
    await standings.turnToTheNextPageNow();
    await standings.turnToTheNextPageNow();

    // Act: the source now sends only the top 30 teams.
    await standings.updateAction({
      data: { entries: createOverallStandingsEntries().slice(0, 30) },
    });

    // Assert: page 2 of 2, rows 21 to 30.
    expect(readPageLine(standings), 'the board must land on the last page there is').toBe(
      '2/2 · 21º A 30º',
    );
    expect(readCarNumbersOnTheBoard(standings), 'page 2 holds rows 21 to 30').toHaveLength(10);
  });

  it('turns the columns board into the table when score parts arrive', async () => {
    // Arrange: the 54 teams with their totals alone, on air in columns.
    const standings = createStandingsOnThePage();
    await loadStandingsWithData(standings, createOverallStandingsTotalOnly());
    await standings.playAction({ skipAnimation: true });

    // Act: the source starts sending the parts.
    await standings.updateAction({
      data: { entries: createOverallStandingsEntries(), scoreParts: overallScoreParts },
    });

    // Assert: the table, one column head, page 1 of 3, every row shown at once.
    expect(
      findPartOfStandings(standings, 'standings')?.dataset.layout,
      'parts must give the table',
    ).toBe('table');
    expect(
      listPartsOfStandings(standings, 'standings-column-head'),
      'the table has one column head',
    ).toHaveLength(1);
    expect(readPageLine(standings), 'the table pages by 20').toBe('1/3 · 1º A 20º');
    expect(
      listPartsOfStandings(standings, 'standings-row').every((row) => row.style.opacity === '1'),
      'every row must be shown at once on air',
    ).toBe(true);
  });

  it('refuses a bad update with a pt-BR 400 and leaves the board as it was', async () => {
    // Arrange: the table on air.
    const standings = await createOverallStandingsOnAir();

    // Act: an update whose parts are not a list.
    const answer = await standings.updateAction({ data: { scoreParts: 'PROJETO' } });

    // Assert: 400 naming the field, and the table still on air.
    expect(answer, 'a bad update must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "scoreParts".',
    });
    expect(readPageLine(standings), 'the board must be as it was').toBe('1/3 · 1º A 20º');
  });
});

describe('an update during a page turn', () => {
  it('is drawn once the turn has ended, never on the rows cascading in', async () => {
    // Arrange: real motion made brief (a cascade of about 300 ms), the table on air, a
    // turn to page 2 started and caught as page 2 starts cascading in.
    placeTokensOnTheRoot({
      ...ardosiaMotionTokenDeclarations,
      '--motion-in': '200ms',
      '--motion-row-stagger': '5ms',
    });
    const standings = await createOverallStandingsOnAir();
    const pageTwoCascading = waitUntilThePageLineReads(standings, '2/3 · 21º A 40º');
    const turn = standings.turnToTheNextPageNow();
    await pageTwoCascading;

    // Act: the 21st and 22nd teams trade places while the rows rise in; then the turn ends.
    const answer = await standings.updateAction({
      data: { entries: swapTeamsInRows(createOverallStandingsEntries(), 21, 22) },
    });
    const firstCarDuringTheTurn = readCarNumbersOnTheBoard(standings)[0];
    await turn;

    // Assert: accepted, kept off the moving rows, and drawn once the turn ended.
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(firstCarDuringTheTurn, 'during the turn the rows keep the page as it was drawn').toBe(7);
    expect(
      readCarNumbersOnTheBoard(standings)[0],
      'once the turn has ended the update must be on the board',
    ).toBe(44);
  });
});

describe('an update during the stop-out', () => {
  it('leaves the fading rows alone, then rests on page 1 with the new data', async () => {
    // Arrange: real motion made brief (a fade out of 250 ms), the table on air and turned
    // to page 2, then a stop started that is still fading the rows out.
    placeTokensOnTheRoot({
      ...ardosiaMotionTokenDeclarations,
      '--motion-in': '200ms',
      '--motion-row-stagger': '5ms',
    });
    const standings = await createOverallStandingsOnAir();
    await standings.turnToTheNextPageNow();
    const stop = standings.stopAction({});

    // Act: the next poll swaps the top two teams and the 21st and 22nd while the rows fade;
    // then the stop-out ends.
    const swappedOnBothPages = swapTeamsInRows(
      swapTeamsInRows(createOverallStandingsEntries(), 1, 2),
      21,
      22,
    );
    const answer = await standings.updateAction({ data: { entries: swappedOnBothPages } });
    const firstCarDuringTheStopOut = readCarNumbersOnTheBoard(standings)[0];
    const pageLineDuringTheStopOut = readPageLine(standings);
    await stop;

    // Assert: accepted, kept off the fading rows, and drawn on page 1 once they are gone.
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(firstCarDuringTheStopOut, 'the fading rows keep page 2 as it was drawn').toBe(7);
    expect(pageLineDuringTheStopOut, 'the head keeps page 2 while it fades').toBe(
      '2/3 · 21º A 40º',
    );
    expect(readPageLine(standings), 'off air the board rests on page 1').toBe('1/3 · 1º A 20º');
    expect(
      readCarNumbersOnTheBoard(standings)[0],
      'page 1 must be drawn from the new data, Equipe FEI Baja (car 1) first',
    ).toBe(1);
  });
});
