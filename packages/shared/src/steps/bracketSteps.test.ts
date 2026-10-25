/**
 * A bracket's steps, counted from its rounds (packages/shared)
 *
 * What this module is for:
 *   The bracket graphic is shown one step per "Próximo", and how many steps it has depends
 *   on its data (BAJAOVRLAY-25): a round of more than four matches is a round board, 32
 *   matches a page, one step a page; the rounds from the quarter-finals down are the tree,
 *   one step a round; the third-place match gets its own step just before the final's.
 *   planBracketSteps lists those steps, and countBracketSteps counts them. Both the graphic
 *   (what each step draws) and the server (how many steps Camadas offers, through the
 *   manifest's `stepCounter`) import this one zod-free module, so they cannot disagree.
 *
 * What these tests prove:
 *   - The counts of the design (catalogue entry 4): 8 cars 3 steps; 64 cars 3 boards and 3
 *     tree steps; 128 cars 4 boards (the first in two pages) and the tree; the real Super
 *     Prime 7; each one more with a third place, and the same with the third place listed
 *     before or after the final.
 *   - The real Super Prime's plan step by step: three boards, then the quarter-finals, the
 *     semifinals, the third place and the final, each tree step adding to the last.
 *   - A round of 64 is split into two pages of 32, page by page.
 *   - Brackets with no round still count one step (the head alone), never zero.
 *
 * What these tests deliberately do not cover:
 *   - Where each match is drawn in the tree: the graphic's treeLayout tests.
 *   - How the server uses the count (the clamp, "Próximo"): graphicSteps.test.ts and the
 *     server's tests.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { type BracketRoundForSteps, countBracketSteps, planBracketSteps } from './bracketSteps.js';

/** A round as the brackets carry it: the plan reads its matches, the name is for the reader. */
type NamedRound = BracketRoundForSteps & { name: string };

/** A round of `matchCount` matches, named as the results sheet names it. */
function buildRoundOfMatches(name: string, matchCount: number): NamedRound {
  return { name, matches: Array.from({ length: matchCount }, (_unused, index) => ({ index })) };
}

/** The third-place round: one match, marked. */
function buildThirdPlaceRound(): NamedRound {
  return { name: 'Disputa de 3º lugar', isThirdPlace: true, matches: [{ index: 0 }] };
}

/** The rounds of an elimination of `slotCount` slots, first round first, down to the final. */
function buildRoundsOfAnElimination(slotCount: number): BracketRoundForSteps[] {
  const namesByMatchCount: Record<number, string> = {
    1: 'Final',
    2: 'Semifinal',
    4: 'Quartas de final',
    8: 'Oitavas de final',
  };
  const rounds: BracketRoundForSteps[] = [];
  for (let matchCount = slotCount / 2; matchCount >= 1; matchCount /= 2) {
    rounds.push(
      buildRoundOfMatches(
        namesByMatchCount[matchCount] ?? `${matchCount} avos de final`,
        matchCount,
      ),
    );
  }
  return rounds;
}

/** The real Super Prime's rounds, from the shared sample. */
function readTheRealSuperPrimeRounds(): BracketRoundForSteps[] {
  const sampleUrl = new URL('../dataShapes/samples/brackets.super-prime.json', import.meta.url);
  const sample = JSON.parse(readFileSync(sampleUrl, 'utf8')) as { rounds: BracketRoundForSteps[] };
  return sample.rounds;
}

describe('countBracketSteps', () => {
  const countScenarios = [
    // The smallest tree: quarter-finals, semifinals and final, one step each.
    { name: '8 cars: 3 tree steps', rounds: buildRoundsOfAnElimination(8), expected: 3 },
    // The same with its third place: one more step, before the final's.
    {
      name: '8 cars with a third place: 4 steps',
      rounds: [...buildRoundsOfAnElimination(8), buildThirdPlaceRound()],
      expected: 4,
    },
    // The design's 64: three boards (32, 16, 8 matches) and three tree steps.
    {
      name: '64 cars: 3 boards and 3 tree steps',
      rounds: buildRoundsOfAnElimination(64),
      expected: 6,
    },
    // ...and its third place.
    {
      name: '64 cars with a third place: 7 steps',
      rounds: [...buildRoundsOfAnElimination(64), buildThirdPlaceRound()],
      expected: 7,
    },
    // 128: four boards, the round of 64 matches in two pages, then the tree.
    {
      name: '128 cars: 4 boards, the first in two pages, then 3 tree steps',
      rounds: buildRoundsOfAnElimination(128),
      expected: 8,
    },
    // ...and its third place.
    {
      name: '128 cars with a third place: 9 steps',
      rounds: [...buildRoundsOfAnElimination(128), buildThirdPlaceRound()],
      expected: 9,
    },
    // The third place listed before the final (the simulator's order) counts the same.
    {
      name: '8 cars with the third place listed before the final: still 4 steps',
      rounds: [
        buildRoundOfMatches('Quartas de final', 4),
        buildRoundOfMatches('Semifinal', 2),
        buildThirdPlaceRound(),
        buildRoundOfMatches('Final', 1),
      ],
      expected: 4,
    },
    // The real one: 32 avos, 16 avos, oitavas, then quartas, semis, 3º lugar, final.
    { name: 'the real Super Prime: 7 steps', rounds: readTheRealSuperPrimeRounds(), expected: 7 },
    // A source with nothing yet: the head alone is one step, never none.
    { name: 'brackets with no round: 1 step', rounds: [], expected: 1 },
  ];

  it.each(countScenarios)('$name', ({ rounds, expected }) => {
    // Arrange: the row's rounds.

    // Act: count their steps.
    const stepCount = countBracketSteps(rounds);

    // Assert: the count the design gives for them.
    expect(stepCount, 'the bracket must have this many steps').toBe(expected);
  });
});

describe('planBracketSteps', () => {
  it("plans the real Super Prime: three boards, then the tree's rounds, the third place before the final", () => {
    // Arrange: the real Super Prime's rounds.
    const rounds = readTheRealSuperPrimeRounds();

    // Act: plan its steps.
    const steps = planBracketSteps(rounds);

    // Assert: the seven pages of the design, bracket-passo-1 to -7.
    expect(steps, 'the steps must follow bracket-passo-1 to -7').toEqual([
      {
        kind: 'board',
        roundIndex: 0,
        pageNumber: 1,
        pageCount: 1,
        firstMatchIndex: 0,
        matchCount: 32,
      },
      {
        kind: 'board',
        roundIndex: 1,
        pageNumber: 1,
        pageCount: 1,
        firstMatchIndex: 0,
        matchCount: 16,
      },
      {
        kind: 'board',
        roundIndex: 2,
        pageNumber: 1,
        pageCount: 1,
        firstMatchIndex: 0,
        matchCount: 8,
      },
      { kind: 'tree', treeRoundsShown: 1, isThirdPlaceShown: false },
      { kind: 'tree', treeRoundsShown: 2, isThirdPlaceShown: false },
      { kind: 'tree', treeRoundsShown: 2, isThirdPlaceShown: true },
      { kind: 'tree', treeRoundsShown: 3, isThirdPlaceShown: true },
    ]);
  });

  it('splits a round of 64 matches into two board pages of 32', () => {
    // Arrange: the first round of a 128-car elimination, alone.
    const rounds = [buildRoundOfMatches('64 avos de final', 64)];

    // Act: plan its steps.
    const steps = planBracketSteps(rounds);

    // Assert: page 1 holds matches 1 to 32, page 2 matches 33 to 64.
    expect(steps, 'two pages, 32 matches each').toEqual([
      {
        kind: 'board',
        roundIndex: 0,
        pageNumber: 1,
        pageCount: 2,
        firstMatchIndex: 0,
        matchCount: 32,
      },
      {
        kind: 'board',
        roundIndex: 0,
        pageNumber: 2,
        pageCount: 2,
        firstMatchIndex: 32,
        matchCount: 32,
      },
    ]);
  });

  it('gives no step to brackets with no round, so the graphic shows its head alone', () => {
    // Arrange: no rounds yet.

    // Act: plan them.
    const steps = planBracketSteps([]);

    // Assert: an empty plan (countBracketSteps still counts the head as one step).
    expect(steps, 'nothing to step through').toEqual([]);
  });
});
