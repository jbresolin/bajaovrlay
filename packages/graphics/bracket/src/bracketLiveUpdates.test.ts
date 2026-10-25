/**
 * What a live update changes on the stage (packages/graphics/bracket)
 *
 * What this module is for:
 *   bracketLiveUpdates compares the stage before and after an update's redraw: the pieces
 *   the redraw added are shown at once, and a result that changed on a car on screen
 *   crossfades. A result can also arrive for a match that is not on screen: another page of
 *   a round of 64, a round the steps have not reached. Nothing that is drawn changed then,
 *   so nothing may move or be rebuilt (gate 2 of PR #30).
 *
 * What these tests prove:
 *   - On page 1 of a round of 64, a result arriving for a match of page 2 starts no tween
 *     and keeps every card element and every result cell of page 1 as it was.
 *
 * What these tests deliberately do not cover:
 *   - A result on screen crossfading, and pieces an update adds: bracketUpdates.test.ts.
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import type { BracketData, BracketRoundData } from './bracketModel.js';
import {
  ardosiaMotionTokenDeclarations,
  ardosiaTreeTokenDeclarations,
  createBracketOnThePage,
  describeTheStage,
  findEveryPartOfBracket,
  loadBracketWithData,
  placeTokensOnTheRoot,
} from './bracketOnThePage.testSupport.js';

/** A round of `matchCount` plain matches not run yet, between made-up cars. */
function buildRoundNotRunYet(name: string, matchCount: number): BracketRoundData {
  return {
    name,
    matches: Array.from({ length: matchCount }, (_unused, index) => ({
      matchId: `${name}-${String(index + 1)}`,
      carA: {
        carNumber: index * 2 + 1,
        teamName: `Equipe ${String(index * 2 + 1)}`,
        schoolName: 'UFPR',
      },
      carB: {
        carNumber: index * 2 + 2,
        teamName: `Equipe ${String(index * 2 + 2)}`,
        schoolName: 'UFSC',
      },
    })),
  };
}

/** A 128-car elimination's first round alone: 64 matches, two board pages. */
function buildTheRoundOf64(): BracketData {
  return { rounds: [buildRoundNotRunYet('64 avos de final', 64)], title: 'SUPER PRIME' };
}

describe('a result for a match not on screen', () => {
  it('changes nothing on page 1 when a match of page 2 is decided', async () => {
    // Arrange: the theme's motion on the page, page 1 of the round of 64 on air; its cards
    // and result cells noted.
    placeTokensOnTheRoot({ ...ardosiaTreeTokenDeclarations, ...ardosiaMotionTokenDeclarations });
    const bracket = createBracketOnThePage();
    await loadBracketWithData(bracket, buildTheRoundOf64());
    await bracket.playAction({ skipAnimation: true });
    const cardsBefore = findEveryPartOfBracket(bracket, 'bracket-match-card');
    const cellsBefore = findEveryPartOfBracket(bracket, 'bracket-result').map((cell) =>
      cell.getAttribute('data-result-signature'),
    );

    // Act: the 40th match (on page 2) is decided.
    const decided = buildTheRoundOf64();
    const fortiethMatch = decided.rounds[0]?.matches[39];
    if (fortiethMatch !== undefined) {
      fortiethMatch.winnerCarNumber = fortiethMatch.carA.carNumber;
    }
    await bracket.updateAction({ data: decided });
    const cardsAfter = findEveryPartOfBracket(bracket, 'bracket-match-card');
    const cellsAfter = findEveryPartOfBracket(bracket, 'bracket-result').map((cell) =>
      cell.getAttribute('data-result-signature'),
    );

    // Assert: still page 1, the same 32 card elements, the same cells, no motion anywhere.
    expect(describeTheStage(bracket).eventLine, 'a result on page 2 must not turn the page').toBe(
      '64 avos de final · página 1/2',
    );
    expect(cardsAfter, 'every card element of page 1 is kept').toEqual(cardsBefore);
    expect(cellsAfter, 'no result of page 1 changed').toEqual(cellsBefore);
    expect(
      gsap.getTweensOf([...cardsAfter, ...findEveryPartOfBracket(bracket, 'bracket-result')]),
      'nothing on screen moves or fades',
    ).toEqual([]);
  });
});
