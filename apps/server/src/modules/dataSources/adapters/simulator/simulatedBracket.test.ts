/**
 * The simulated Super Prime (apps/server)
 *
 * What this module is for:
 *   Besides its enduro, the simulator answers a brackets snapshot: a made-up Super Prime of
 *   its fictional field, so the bracket graphic is rehearsed with nobody typing results.
 *   Every car of the field is drawn into a seeded order and paired into a first round padded
 *   with byes to the next power of two; then one heat is run every simulated minute, round
 *   by round, the early rounds a plain win, the semifinals, the third place and the final
 *   best of 3 (the third place runs before the final, as on the day). A round is listed only
 *   once every car in it is known, since the brackets shape has no pending slot. It is not
 *   the real Super Prime and its teams are fictional.
 *
 * What these tests prove:
 *   - The draw is seeded: the same seed draws the same first round, another seed another
 *     one; seed 2027's ten-car draw is pinned, pair by pair.
 *   - The draw is padded with byes up to the next power of two (10 cars in 16 slots, 33 in
 *     64 as the real one, 64 in 64, 100 in 128), each bye carA's W.O. from the start.
 *   - Results come at their simulated moments: at the start only the first round, its byes
 *     through; a heat each minute after; the next round listed once the last one is done;
 *     seed 2027's ten-car bracket decided at a pinned minute, with its champion.
 *   - From the semifinals on every match is best of 3, won with two wins; before, a plain
 *     win with no number.
 *   - Every moment of the bracket passes the brackets shape.
 *
 * What these tests deliberately do not cover:
 *   - "Reiniciar corrida" restarting the bracket: simulatorAdapter.test.ts, through the
 *     race's start.
 *   - How the graphic draws it: packages/graphics/bracket.
 */
import { validateDataShape } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { simulateBracketAt, simulatedHeatIntervalMs } from './simulatedBracket.js';
import { drawFirstRoundOfSimulatedBracket } from './simulatedBracketDraw.js';

const oneMinuteMs = 60_000;

/** The brackets shape around simulated rounds, as a poll would answer them. */
function buildBracketsShapeAround(rounds: unknown) {
  return { sessionId: 'simulador-enduro-2027-super-prime', updatedAtMs: 1_805_568_000_000, rounds };
}

/** Each first-round match as "carA × carB", or "carA × bye", the way a draw sheet reads. */
function describeFirstRoundPairs(seed: number, carCount: number): string[] {
  return drawFirstRoundOfSimulatedBracket(seed, carCount).map((pair) =>
    pair.carIndexB === undefined
      ? `${pair.carIndexA + 1} × bye`
      : `${pair.carIndexA + 1} × ${pair.carIndexB + 1}`,
  );
}

describe('the draw', () => {
  it('draws the same first round for the same seed, every time', () => {
    // Arrange: the seeded simulator's seed and a 60-car field.

    // Act: draw it twice.
    const firstDraw = describeFirstRoundPairs(2027, 60);
    const secondDraw = describeFirstRoundPairs(2027, 60);

    // Assert: the very same pairs.
    expect(secondDraw, 'a seed must always draw the same bracket').toEqual(firstDraw);
  });

  it('draws another first round for another seed', () => {
    // Arrange: two seeds of the same 60-car field.

    // Act: draw both.
    const drawOf2027 = describeFirstRoundPairs(2027, 60);
    const drawOf1405 = describeFirstRoundPairs(1405, 60);

    // Assert: different pairs, so each seed is its own Super Prime.
    expect(drawOf1405, 'another seed must draw another bracket').not.toEqual(drawOf2027);
  });

  it("pins seed 2027's ten-car draw, the one the browser test steps through", () => {
    // Arrange: seed 2027 with the smallest field the simulator allows.

    // Act: draw it.
    const pairs = describeFirstRoundPairs(2027, 10);

    // Assert: these eight pairs; a change to the draw moves the browser test's bracket.
    expect(pairs, 'seed 2027 must draw this first round').toEqual(PINNED_SEED_2027_TEN_CAR_DRAW);
  });

  const byeScenarios = [
    // The smallest field: ten cars, six byes.
    { name: '10 cars sit in 16 slots with 6 byes', carCount: 10, slotCount: 16, byeCount: 6 },
    // The real Super Prime's size: 33 cars, 31 byes.
    { name: '33 cars sit in 64 slots with 31 byes', carCount: 33, slotCount: 64, byeCount: 31 },
    // A power of two needs no bye at all.
    { name: '64 cars fill 64 slots with no bye', carCount: 64, slotCount: 64, byeCount: 0 },
    // The largest field: a round of 64 matches, two board pages.
    { name: '100 cars sit in 128 slots with 28 byes', carCount: 100, slotCount: 128, byeCount: 28 },
  ];

  it.each(byeScenarios)('$name', ({ carCount, slotCount, byeCount }) => {
    // Arrange: the row's field, on the seeded simulator's seed.

    // Act: draw its first round.
    const pairs = drawFirstRoundOfSimulatedBracket(2027, carCount);
    const carIndexesDrawn = pairs.flatMap((pair) =>
      pair.carIndexB === undefined ? [pair.carIndexA] : [pair.carIndexA, pair.carIndexB],
    );

    // Assert: half as many matches as slots, the byes counted, every car drawn once.
    expect(pairs, 'one match per two slots').toHaveLength(slotCount / 2);
    expect(
      pairs.filter((pair) => pair.carIndexB === undefined),
      'the empty slots must be byes',
    ).toHaveLength(byeCount);
    expect(
      [...carIndexesDrawn].sort((first, second) => first - second),
      'every car of the field must be drawn exactly once',
    ).toEqual(Array.from({ length: carCount }, (_unused, index) => index));
  });
});

describe('the results over simulated time', () => {
  it('starts with only the first round, its byes through by W.O. and its races not run', () => {
    // Arrange: seed 2027's ten-car Super Prime at its start.

    // Act: look at it at the green flag.
    const rounds = simulateBracketAt({ seed: 2027, carCount: 10 }, 0);
    const firstRound = rounds[0];

    // Assert: one round of eight; six byes won by carA, two races with no winner yet.
    expect(
      rounds.map((round) => round.name),
      'only the first round is known',
    ).toEqual(['Oitavas de final']);
    const byes = firstRound?.matches.filter((match) => match.carB === undefined) ?? [];
    const races = firstRound?.matches.filter((match) => match.carB !== undefined) ?? [];
    expect(byes, 'six byes').toHaveLength(6);
    expect(
      byes.every((bye) => bye.walkover === true && bye.winnerCarNumber === bye.carA.carNumber),
      'a bye is carA through by W.O. from the draw',
    ).toBe(true);
    expect(
      races.map((race) => race.winnerCarNumber),
      'no race has a winner before its heat',
    ).toEqual([undefined, undefined]);
  });

  it('decides one heat each simulated minute, the first race after one minute', () => {
    // Arrange: the same Super Prime, just before and just after its first heat.
    const settings = { seed: 2027, carCount: 10 };

    // Act: look at it one millisecond before the first minute, and at the minute.
    const racesJustBefore = simulateBracketAt(settings, simulatedHeatIntervalMs - 1)[0]?.matches;
    const racesAtTheMinute = simulateBracketAt(settings, simulatedHeatIntervalMs)[0]?.matches;
    const countDecided = (matches: typeof racesAtTheMinute) =>
      (matches ?? []).filter((match) => match.carB !== undefined && match.winnerCarNumber).length;

    // Assert: none decided before the minute, one at it.
    expect(simulatedHeatIntervalMs, 'a heat every simulated minute').toBe(oneMinuteMs);
    expect(countDecided(racesJustBefore), 'no race decided before the first minute').toBe(0);
    expect(countDecided(racesAtTheMinute), 'the first race decided at the minute').toBe(1);
  });

  it('lists the next round once every match of the round before is decided', () => {
    // Arrange: seed 2027's ten-car Super Prime: its first round has two races.
    const settings = { seed: 2027, carCount: 10 };

    // Act: look at it after one heat, then after two.
    const afterOneHeat = simulateBracketAt(settings, 1 * oneMinuteMs);
    const afterTwoHeats = simulateBracketAt(settings, 2 * oneMinuteMs);

    // Assert: the quarter-finals appear only once both races are run, with the winners.
    expect(
      afterOneHeat.map((round) => round.name),
      'one race left: no next round',
    ).toEqual(['Oitavas de final']);
    expect(
      afterTwoHeats.map((round) => round.name),
      'both run: the next round',
    ).toEqual(['Oitavas de final', 'Quartas de final']);
    const winnersOfTheFirstRound = afterTwoHeats[0]?.matches.map((match) => match.winnerCarNumber);
    const carsOfTheQuarterFinals = afterTwoHeats[1]?.matches.flatMap((match) => [
      match.carA.carNumber,
      match.carB?.carNumber,
    ]);
    expect(
      carsOfTheQuarterFinals,
      'the quarter-finals must pair the first round winners in order',
    ).toEqual(winnersOfTheFirstRound);
  });

  it("decides seed 2027's ten-car Super Prime at its pinned minute, the third place before the final", () => {
    // Arrange: the browser test's bracket.
    const settings = { seed: 2027, carCount: 10 };
    const decidedAtMs = PINNED_SEED_2027_TEN_CAR_DECIDED_AT_MINUTE * oneMinuteMs;

    // Act: look at it a millisecond before the pinned minute, and at it.
    const justBefore = simulateBracketAt(settings, decidedAtMs - 1);
    const atTheMinute = simulateBracketAt(settings, decidedAtMs);
    const finalJustBefore = justBefore.find((round) => round.name === 'Final')?.matches[0];
    const finalAtTheMinute = atTheMinute.find((round) => round.name === 'Final')?.matches[0];

    // Assert: every round listed, third place before the final; the final decided only at
    // the pinned minute; a change to the draws moves the browser test's wait.
    expect(
      atTheMinute.map((round) => round.name),
      'every round, in this order',
    ).toEqual([
      'Oitavas de final',
      'Quartas de final',
      'Semifinal',
      'Disputa de 3º lugar',
      'Final',
    ]);
    expect(finalJustBefore?.winnerCarNumber, 'the final still open a moment before').toBe(
      undefined,
    );
    expect(finalAtTheMinute?.winnerCarNumber, 'the champion at the pinned minute').toBe(
      PINNED_SEED_2027_TEN_CAR_CHAMPION,
    );
  });

  it('plays the semifinals, the third place and the final best of 3, and the rounds before as a plain win', () => {
    // Arrange: a 60-car Super Prime long after it is over.
    const rounds = simulateBracketAt({ seed: 2027, carCount: 60 }, 24 * 60 * oneMinuteMs);

    // Act: read each round's series and how its decided matches were won.
    const seriesByRound = rounds.map((round) => ({
      name: round.name,
      bestOfs: [...new Set(round.matches.map((match) => match.bestOf))],
    }));
    const bestOfThreeMatches = rounds
      .filter((round) => round.matches.length <= 2)
      .flatMap((round) => round.matches);

    // Assert: no series before the semifinals; best of 3 from them on, won 2 to 0 or 1.
    expect(seriesByRound, 'best of 3 only from the semifinals on').toEqual([
      { name: '32 avos de final', bestOfs: [undefined] },
      { name: '16 avos de final', bestOfs: [undefined] },
      { name: 'Oitavas de final', bestOfs: [undefined] },
      { name: 'Quartas de final', bestOfs: [undefined] },
      { name: 'Semifinal', bestOfs: [3] },
      { name: 'Disputa de 3º lugar', bestOfs: [3] },
      { name: 'Final', bestOfs: [3] },
    ]);
    for (const match of bestOfThreeMatches) {
      const winner = match.winnerCarNumber === match.carA.carNumber ? match.carA : match.carB;
      const loser = winner === match.carA ? match.carB : match.carA;
      expect(winner?.wins, `the winner of ${match.matchId} must have two wins`).toBe(2);
      expect(loser?.wins, `the loser of ${match.matchId} must have fewer`).toBeLessThan(2);
    }
  });

  it('passes the brackets shape at every minute, from the draw to the champion', () => {
    // Arrange: seed 2027's ten-car Super Prime, a minute at a time past its end.
    const minutes = Array.from({ length: 20 }, (_unused, minute) => minute);

    // Act: validate the bracket of every minute.
    const refusals = minutes.flatMap((minute) => {
      const rounds = simulateBracketAt({ seed: 2027, carCount: 10 }, minute * oneMinuteMs);
      const validation = validateDataShape('brackets', buildBracketsShapeAround(rounds));
      return validation.isValid ? [] : [`minute ${minute}: ${validation.errorMessage}`];
    });

    // Assert: none refused.
    expect(refusals, 'every moment of the simulated bracket must pass the shape').toEqual([]);
  });
});

// The pinned values: seed 2027's ten-car Super Prime, the browser test's
// (bracketStepsWithTheSimulator.e2e.ts). Found by running the draw and the heats; a change
// that moves them must be deliberate, and re-checked against that test.
// Six byes, then the two races; 17 heats in all (2 + 4, the semifinals 2 + 3, the third
// place 3, the final 3), so the final is decided at the 17th minute, by car 8.
const PINNED_SEED_2027_TEN_CAR_DRAW = [
  '7 × bye',
  '4 × bye',
  '8 × bye',
  '9 × bye',
  '10 × bye',
  '6 × bye',
  '2 × 5',
  '3 × 1',
];
const PINNED_SEED_2027_TEN_CAR_DECIDED_AT_MINUTE = 17;
const PINNED_SEED_2027_TEN_CAR_CHAMPION = 8;
