/**
 * The bracket when one move comes in the middle of another (packages/graphics/bracket)
 *
 * What this module is for:
 *   A renderer calls the bracket's actions as the server's state changes, and it does not
 *   wait for a motion to end: Entrar can come during Sair's stop-out (an operator taking
 *   the item again), a second Próximo during the first's cascade (a double press the server
 *   let through), Próximo during a result's crossfade. bracket.ts guards each case with one
 *   line; each test here fails without its line (gate 2 of PR #30).
 *
 * What these tests prove (every motion a minute long, so it cannot end by itself while the
 * test looks):
 *   - Entrar during Sair's stop-out ends on air with the head and every card shown: the
 *     stop, cut short, leaves the bracket to the play.
 *   - A second Próximo during the first's cascade: both answer the step on air, the third
 *     place's; and a dispose during a cascade makes the pending play answer 409.
 *   - Próximo during a result's crossfade ends the crossfade at once.
 *
 * What these tests deliberately do not cover:
 *   - A motion ended by stop, dispose and disconnect: bracketMotionStops.test.ts.
 *   - An update during a motion: bracketUpdates.test.ts.
 */
import { finishEveryRunningMotionAtOnce } from '@bajaovrlay/graphics-kit/runningMotions.testSupport';
import { gsap } from 'gsap';
import { describe, expect, it, vi } from 'vitest';

import type BracketGraphic from './bracket.js';
import type { BracketData } from './bracketModel.js';
import {
  ardosiaMotionTokenDeclarations,
  ardosiaTreeTokenDeclarations,
  createBracketOnThePage,
  describeTheStage,
  findEveryPartOfBracket,
  findPartOfBracket,
  findResultCellOfCar,
  isPieceShown,
  loadBracketWithData,
  placeTokensOnTheRoot,
} from './bracketOnThePage.testSupport.js';
import { createResultStatesInATree, createTheRealSuperPrime } from './previewData.js';

/** Every motion a minute long: a rise, a fade, a crossfade. */
const minuteLongMotionTokens = {
  ...ardosiaTreeTokenDeclarations,
  ...ardosiaMotionTokenDeclarations,
  '--motion-in': '60000ms',
  '--motion-out': '60000ms',
  '--motion-flag': '60000ms',
};

/** A bracket loaded with `data` and minute-long motion, on air at `stepIndex` (no motion). */
async function createBracketOnAirWithMinuteLongMotion(
  data: BracketData,
  stepIndex: number,
): Promise<BracketGraphic> {
  placeTokensOnTheRoot(minuteLongMotionTokens);
  const bracket = createBracketOnThePage();
  await loadBracketWithData(bracket, data);
  await bracket.playAction({ goto: stepIndex, skipAnimation: true });
  return bracket;
}

/**
 * Waits until the tree column's car slots are rising: a play draws its step first (Lit's
 * redraw is an await) and only then starts the rise, so a move meant to come during the
 * rise must wait for it.
 */
async function waitUntilTheColumnIsRising(bracket: BracketGraphic, column: string): Promise<void> {
  await vi.waitFor(() => {
    const slots = findEveryPartOfBracket(bracket, 'bracket-tree-car-slot').filter(
      (slot) => slot.dataset.column === column,
    );
    expect(gsap.getTweensOf(slots).length, `the column ${column} must be rising`).toBeGreaterThan(
      0,
    );
  });
}

describe('Entrar during Sair', () => {
  it('ends on air with the head and every card shown, the cut-short stop leaving it alone', async () => {
    // Arrange: the Super Prime's first board on air, and Sair's minute-long stop-out started.
    const bracket = await createBracketOnAirWithMinuteLongMotion(createTheRealSuperPrime(), 0);
    const stop = bracket.stopAction({});

    // Act: the operator takes the item again; the renderer plays it at once (no animation,
    // as a take that replaces a leaving graphic does), and the stop-out is cut short.
    const playAnswer = await bracket.playAction({ skipAnimation: true });
    const stopAnswer = await stop;

    // Assert: on air at the first board, the head and the 32 cards shown; the stop, coming
    // back after the play, hid nothing.
    expect(playAnswer, 'the take answers its step').toEqual({ statusCode: 200, currentStep: 0 });
    expect(stopAnswer, 'the stop answers 200').toEqual({ statusCode: 200 });
    expect(isPieceShown(findPartOfBracket(bracket, 'bracket-head')), 'the head on air').toBe(true);
    expect(
      findEveryPartOfBracket(bracket, 'bracket-match-card').filter(isPieceShown),
      'every card on air',
    ).toHaveLength(32);
  });
});

describe('a second Próximo during the first’s cascade', () => {
  it('gives both plays the step on air, the third place’s', async () => {
    // Arrange: the Super Prime's tree at its quarter-finals, and Próximo's cascade of the
    // semifinals started.
    const bracket = await createBracketOnAirWithMinuteLongMotion(createTheRealSuperPrime(), 3);
    const firstPress = bracket.playAction({});
    await waitUntilTheColumnIsRising(bracket, '1');

    // Act: a second Próximo while the semifinals rise; then every motion ends.
    const secondPress = bracket.playAction({});
    await waitUntilTheColumnIsRising(bracket, 'third');
    finishEveryRunningMotionAtOnce();
    const answers = [await firstPress, await secondPress];

    // Assert: both report the third place's step (index 5), the step on air, and the stage
    // shows it.
    expect(answers, 'both answer the step on air').toEqual([
      { statusCode: 200, currentStep: 5 },
      { statusCode: 200, currentStep: 5 },
    ]);
    expect(
      describeTheStage(bracket).treeColumnsShown,
      'the third place must be what is on air',
    ).toEqual(['0', '1', 'third']);
  });

  it('answers 409 for the pending play when the bracket is disposed during its cascade', async () => {
    // Arrange: the tree at its quarter-finals, and Próximo's cascade of the semifinals started.
    const bracket = await createBracketOnAirWithMinuteLongMotion(createTheRealSuperPrime(), 3);
    const pendingPress = bracket.playAction({});
    await waitUntilTheColumnIsRising(bracket, '1');

    // Act: the renderer disposes of the bracket in the middle of the cascade.
    await bracket.dispose();

    // Assert: the play reports the dispose, not a step.
    await expect(pendingPress, 'the play answers the dispose').resolves.toEqual({
      statusCode: 409,
      statusMessage: 'O chaveamento já foi descartado (dispose).',
    });
  });
});

describe('Próximo during a result’s crossfade', () => {
  it('ends the crossfade at once', async () => {
    // Arrange: the six result states in the tree at its quarter-finals, and a corrected time
    // arriving for Corisco, its cell crossfading for a minute.
    const results = createResultStatesInATree();
    const bracket = await createBracketOnAirWithMinuteLongMotion(results, 0);
    const corrected: BracketData = {
      ...results,
      rounds: results.rounds.map((round) => ({
        ...round,
        matches: round.matches.map((match) =>
          match.matchId === 'tempo' ? { ...match, carA: { ...match.carA, timeMs: 70_120 } } : match,
        ),
      })),
    };
    await bracket.updateAction({ data: corrected });
    const crossfadingCell = findResultCellOfCar(bracket, 'tempo:carA');
    const isCrossfadingBefore = gsap.getTweensOf(crossfadingCell ?? []).length > 0;

    // Act: Próximo to the semifinals.
    const press = bracket.playAction({});

    // Assert: it was crossfading; the press ended it at once.
    expect(isCrossfadingBefore, 'the cell was crossfading first').toBe(true);
    expect(gsap.getTweensOf(crossfadingCell ?? []), 'Próximo ends the crossfade').toEqual([]);
    await waitUntilTheColumnIsRising(bracket, '1');
    finishEveryRunningMotionAtOnce();
    await press;
  });
});
