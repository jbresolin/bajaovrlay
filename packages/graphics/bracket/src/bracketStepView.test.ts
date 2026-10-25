/**
 * What each step of the bracket puts on screen (packages/graphics/bracket)
 *
 * What this module is for:
 *   The bracket's steps come from the shared plan (`@bajaovrlay/shared/bracketSteps`), the
 *   same the server counts "Passo n de N" with. bracketStepView turns a step of that plan
 *   into what the graphic draws: a round board (its round, the matches of its page, and the
 *   head's event line naming the round and the page) or the tree (how many of its rounds
 *   and whether the third place are shown, no event line), with the head's step line.
 *
 * What these tests prove:
 *   - The real Super Prime's seven steps, as bracket-passo-1 to -7: three boards named for
 *     their round with 32, 16 and 8 matches, then the tree growing a round at a time, the
 *     third place before the final; the step line "1/7" to "7/7".
 *   - A round of 64 matches is two pages, the head saying which ("64 avos de final ·
 *     página 1/2"), each page holding its 32 matches in order.
 *   - The tree's rounds: its columns (the third place apart) and the columns it keeps for
 *     rounds still to come, each named from the first step, a round not listed yet by the
 *     size it will have (gate 2 of PR #30, contract B).
 *   - A step past the last (data that shrank) is drawn as the last step; brackets with no
 *     round are the head alone, step "1/1".
 *
 * What these tests deliberately do not cover:
 *   - Counting the steps (shared's bracketSteps.test.ts) and drawing them (bracketView.test.ts).
 */
import { describe, expect, it } from 'vitest';

import type { BracketData, BracketRoundData } from './bracketModel.js';
import {
  countStepsOfBracket,
  describeStepOnScreen,
  describeTreeOfBracket,
  writeStepLineOfBracket,
} from './bracketStepView.js';
import { createTheRealSuperPrime } from './previewData.js';

/** A round of `matchCount` undecided matches between made-up cars of the simulator. */
function buildRoundOfMatches(name: string, matchCount: number): BracketRoundData {
  return {
    name,
    matches: Array.from({ length: matchCount }, (_unused, index) => ({
      matchId: `${name}-${String(index + 1)}`,
      carA: { carNumber: index + 1, teamName: `Equipe ${String(index + 1)}`, schoolName: 'UFPR' },
      carB: {
        carNumber: index + 101,
        teamName: `Equipe ${String(index + 101)}`,
        schoolName: 'UFSC',
      },
    })),
  };
}

/** A 128-car elimination: 64 avos down to the final. */
function build128CarBracket(): BracketData {
  return {
    rounds: [
      buildRoundOfMatches('64 avos de final', 64),
      buildRoundOfMatches('32 avos de final', 32),
      buildRoundOfMatches('16 avos de final', 16),
      buildRoundOfMatches('Oitavas de final', 8),
      buildRoundOfMatches('Quartas de final', 4),
      buildRoundOfMatches('Semifinal', 2),
      buildRoundOfMatches('Final', 1),
    ],
  };
}

describe('describeStepOnScreen', () => {
  it('draws the real Super Prime’s seven steps as bracket-passo-1 to -7', () => {
    // Arrange: the real Super Prime.
    const superPrime = createTheRealSuperPrime();
    const stepCount = countStepsOfBracket(superPrime);

    // Act: describe every step, in a form a reader can check against the pages.
    const steps = Array.from({ length: stepCount }, (_unused, stepIndex) => {
      const step = describeStepOnScreen(superPrime, stepIndex);
      const stepLine = writeStepLineOfBracket(stepIndex, stepCount);
      if (step.kind === 'board') {
        return { stepLine, board: step.eventLine, matchCount: step.matches.length };
      }
      if (step.kind === 'tree') {
        return {
          stepLine,
          treeRoundsShown: step.treeRoundsShown,
          thirdPlace: step.isThirdPlaceShown,
        };
      }
      return { stepLine, headAlone: true };
    });

    // Assert: the seven pages of the design.
    expect(steps, 'the steps must follow bracket-passo-1 to -7').toEqual([
      { stepLine: '1/7', board: '32 avos de final', matchCount: 32 },
      { stepLine: '2/7', board: '16 avos de final', matchCount: 16 },
      { stepLine: '3/7', board: 'Oitavas de final', matchCount: 8 },
      { stepLine: '4/7', treeRoundsShown: 1, thirdPlace: false },
      { stepLine: '5/7', treeRoundsShown: 2, thirdPlace: false },
      { stepLine: '6/7', treeRoundsShown: 2, thirdPlace: true },
      { stepLine: '7/7', treeRoundsShown: 3, thirdPlace: true },
    ]);
  });

  it('splits a round of 64 into two pages, the head naming the page', () => {
    // Arrange: a 128-car elimination.
    const bracket = build128CarBracket();

    // Act: describe its first two steps.
    const firstPage = describeStepOnScreen(bracket, 0);
    const secondPage = describeStepOnScreen(bracket, 1);

    // Assert: matches 1 to 32, then 33 to 64, each page named.
    expect(firstPage.kind === 'board' && firstPage.eventLine, 'page 1 named').toBe(
      '64 avos de final · página 1/2',
    );
    expect(secondPage.kind === 'board' && secondPage.eventLine, 'page 2 named').toBe(
      '64 avos de final · página 2/2',
    );
    expect(
      firstPage.kind === 'board' && [
        firstPage.matches[0]?.matchId,
        firstPage.matches.at(-1)?.matchId,
      ],
      'page 1 holds the first 32 matches',
    ).toEqual(['64 avos de final-1', '64 avos de final-32']);
    expect(
      secondPage.kind === 'board' && [
        secondPage.matches[0]?.matchId,
        secondPage.matches.at(-1)?.matchId,
      ],
      'page 2 holds the next 32',
    ).toEqual(['64 avos de final-33', '64 avos de final-64']);
  });

  it('draws a step past the last as the last step, for data that shrank on air', () => {
    // Arrange: the real Super Prime (7 steps).
    const superPrime = createTheRealSuperPrime();

    // Act: describe its 10th step.
    const step = describeStepOnScreen(superPrime, 9);

    // Assert: the final's step.
    expect(step, 'the last step stands in').toEqual(describeStepOnScreen(superPrime, 6));
  });

  it('shows the head alone, as step 1 of 1, for brackets with no round', () => {
    // Arrange: a source with nothing listed yet.
    const emptyBracket: BracketData = { rounds: [] };

    // Act: describe its first step and count its steps.
    const step = describeStepOnScreen(emptyBracket, 0);
    const stepCount = countStepsOfBracket(emptyBracket);

    // Assert: the head alone, one step.
    expect(step, 'nothing but the head').toEqual({ kind: 'headAlone' });
    expect(writeStepLineOfBracket(0, stepCount), 'one step').toBe('1/1');
  });
});

describe('describeTreeOfBracket', () => {
  it('lists the tree’s columns, the third place apart', () => {
    // Arrange: the real Super Prime.
    const superPrime = createTheRealSuperPrime();

    // Act: describe its tree.
    const tree = describeTreeOfBracket(superPrime);

    // Assert: three columns, the third place apart, room for no more.
    expect(
      tree.columnRounds.map((round) => round.name),
      'the tree’s three rounds',
    ).toEqual(['Quartas de final', 'Semifinal', 'Final']);
    expect(tree.thirdPlaceRound?.name, 'the third place apart').toBe('Disputa de 3º lugar');
    expect(tree.columnCount, 'three columns').toBe(3);
  });

  it('keeps the columns of the rounds still to come', () => {
    // Arrange: a live bracket with only the quarter-finals listed.
    const bracket: BracketData = { rounds: [buildRoundOfMatches('Quartas de final', 4)] };

    // Act: describe its tree.
    const tree = describeTreeOfBracket(bracket);

    // Assert: one round listed, three columns kept, each already named (contract B).
    expect(tree.columnRounds, 'one round so far').toHaveLength(1);
    expect(tree.columnCount, 'room for the semifinals and the final').toBe(3);
    expect(tree.columnNames, 'every round named from the first step').toEqual([
      'Quartas de final',
      'Semifinal',
      'Final',
    ]);
  });
});
