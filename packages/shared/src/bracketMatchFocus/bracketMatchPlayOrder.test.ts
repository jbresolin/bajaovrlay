/**
 * The matches of a Super Prime in play order, each with how far it has got (packages/shared)
 *
 * What this module is for:
 *   "Escolher partida" lists every match of the session the operator may pick for "agora"
 *   or "a seguir" (BAJAOVRLAY-65), and the suggestions read the same list. The play order
 *   is the source's: rounds first to last, matches as listed. Each match carries its
 *   round's name and whether it is the third place, which the graphics show, and its
 *   progress: encerrada (it has a winner), em andamento (a result without a winner yet: a
 *   win of a best of 3, a time) or a definir (nothing yet).
 *
 * What these tests prove:
 *   - The list follows the rounds and the matches as listed, with each round's name and
 *     the third place marked, and leaves the byes out (nobody races them).
 *   - The progress of a match, one row per kind of result.
 *
 * What these tests deliberately do not cover:
 *   - Which matches are suggested: bracketMatchSuggestions.test.ts.
 *   - The control page's words for each progress: the page's own tests.
 */
import { describe, expect, it } from 'vitest';

import type { BracketMatch } from '../dataShapes/index.js';
import { listBracketMatchesInPlayOrder, readBracketMatchProgress } from './bracketMatchPlayOrder.js';
import {
  buildBestOfThreeUnderWay,
  buildBye,
  buildDecidedMatch,
  buildUndecidedMatch,
  superPrimeCars,
} from './superPrimeBrackets.testSupport.js';

const cars = superPrimeCars;

describe('listBracketMatchesInPlayOrder', () => {
  it('lists the raced matches round by round as the source lists them, byes left out', () => {
    // Arrange: a first round with a bye between two races, a semifinal and a third place.
    const rounds = [
      {
        name: 'Quartas de final',
        matches: [
          buildUndecidedMatch('qf-1', cars.corisco, cars.buffalo),
          buildBye('qf-2', cars.bajaUfmg),
          buildUndecidedMatch('qf-3', cars.pequi, cars.acaua),
        ],
      },
      { name: 'Semifinal', matches: [buildUndecidedMatch('sf-1', cars.cactus, cars.ufsc)] },
      {
        name: 'Disputa de 3º lugar',
        isThirdPlace: true,
        matches: [buildUndecidedMatch('terceiro', cars.piratas, cars.acaua)],
      },
    ];

    // Act: list the matches in play order.
    const matchesInPlayOrder = listBracketMatchesInPlayOrder(rounds);

    // Assert: four races in the source's order, each with its round, the bye nowhere.
    const summary = matchesInPlayOrder.map((entry) => ({
      matchId: entry.match.matchId,
      roundName: entry.roundName,
      isThirdPlace: entry.isThirdPlace,
    }));
    expect(summary, 'the races must follow the source, each with its round').toEqual([
      { matchId: 'qf-1', roundName: 'Quartas de final', isThirdPlace: false },
      { matchId: 'qf-3', roundName: 'Quartas de final', isThirdPlace: false },
      { matchId: 'sf-1', roundName: 'Semifinal', isThirdPlace: false },
      { matchId: 'terceiro', roundName: 'Disputa de 3º lugar', isThirdPlace: true },
    ]);
  });
});

describe('readBracketMatchProgress', () => {
  const progressScenarios: { name: string; match: BracketMatch; expected: string }[] = [
    {
      // Nothing raced yet: two cars and no result.
      name: 'reads a match with no result as not started',
      match: buildUndecidedMatch('qf-1', cars.corisco, cars.buffalo),
      expected: 'notStarted',
    },
    {
      // A best of 3 at 1 × 1: under way, not decided.
      name: 'reads a best of 3 with wins and no winner as running',
      match: buildBestOfThreeUnderWay('sf-1', cars.corisco, 1, cars.pequi, 1),
      expected: 'running',
    },
    {
      // A best of 3 at 0 × 0 written out by the source: still nothing raced.
      name: 'reads a best of 3 at 0 × 0 as not started',
      match: buildBestOfThreeUnderWay('sf-1', cars.corisco, 0, cars.pequi, 0),
      expected: 'notStarted',
    },
    {
      // A timed run where the first car has run and the second not yet.
      name: 'reads a timed run with one time and no winner as running',
      match: {
        matchId: 'qf-2',
        carA: { ...cars.pequi, timeMs: 41_870 },
        carB: cars.acaua,
      },
      expected: 'running',
    },
    {
      // The winner named: decided, whatever else it carries.
      name: 'reads a match with a winner as decided',
      match: buildDecidedMatch('qf-1', cars.corisco, cars.buffalo, cars.corisco),
      expected: 'decided',
    },
  ];

  it.each(progressScenarios)('$name', ({ match, expected }) => {
    // Arrange: the match as the source sends it (built above).

    // Act: read how far it has got.
    const progress = readBracketMatchProgress(match);

    // Assert: decided, running or not started, as expected.
    expect(progress, 'the progress must follow what the match carries').toBe(expected);
  });
});
