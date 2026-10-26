/**
 * The bracket ends its motions on stop, dispose and disconnect (packages/graphics/bracket)
 *
 * What this module is for:
 *   The bracket runs two kinds of motion: a step's (a board's cascade, a round of the tree
 *   added, the lift-out) and a result's crossfade. The page runs all day in OBS, so a
 *   motion left running after the graphic is gone would keep a GSAP tween alive on a
 *   removed element; and a crossfade still running during the stop-out would fade a cell
 *   up while everything else leaves. Each stop is a line of bracket.ts, and each test here
 *   fails without its line.
 *
 * What these tests prove (every motion made a minute long, so it cannot end by itself
 * while the test looks):
 *   - dispose during Próximo's lift-out (a board's cards leaving for the next) ends it, and
 *     the pending play resolves with 409;
 *   - the element leaving the page without dispose ends that lift-out, and the play
 *     resolves (a dispose during a cascade is bracketOverlappingMoves.test.ts);
 *   - dispose ends a running crossfade; the element leaving the page ends one too;
 *   - a stop ends a running crossfade at once, before its own lift-out.
 *
 * What these tests deliberately do not cover:
 *   - Timers: the bracket has none (nothing on it moves by itself), so there is none to stop.
 *   - What the motions look like: bracketAnimations.test.ts.
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import type BracketGraphic from './bracket.js';
import type { BracketData } from './bracketModel.js';
import {
  ardosiaMotionTokenDeclarations,
  ardosiaTreeTokenDeclarations,
  createBracketOnThePage,
  findEveryPartOfBracket,
  findResultCellOfCar,
  loadBracketWithData,
  placeTokensOnTheRoot,
} from './bracketOnThePage.testSupport.js';
import { createResultStatesOnABoard, createTheRealSuperPrime } from './previewData.js';

/** Every motion a minute long: a rise, a fade, a crossfade, the cascade's lead. */
const minuteLongMotionTokens = {
  ...ardosiaMotionTokenDeclarations,
  '--motion-in': '60000ms',
  '--motion-out': '60000ms',
  '--motion-flag': '60000ms',
};

/** The real Super Prime loaded with minute-long motion, on air at its first board. */
async function createSuperPrimeOnAirWithMinuteLongMotion(): Promise<BracketGraphic> {
  placeTokensOnTheRoot({ ...ardosiaTreeTokenDeclarations, ...minuteLongMotionTokens });
  const bracket = createBracketOnThePage();
  await loadBracketWithData(bracket, createTheRealSuperPrime());
  await bracket.playAction({ skipAnimation: true });
  return bracket;
}

/** The results board on air with minute-long motion, and a result arriving that crossfades. */
async function createResultsBoardInTheMiddleOfACrossfade(): Promise<{
  bracket: BracketGraphic;
  crossfadingCell: HTMLElement | undefined;
}> {
  placeTokensOnTheRoot({ ...ardosiaTreeTokenDeclarations, ...minuteLongMotionTokens });
  const bracket = createBracketOnThePage();
  await loadBracketWithData(bracket, createResultStatesOnABoard());
  await bracket.playAction({ skipAnimation: true });
  const decided: BracketData = createResultStatesOnABoard();
  const rounds = decided.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((match) =>
      match.matchId === 'antes-de-decidir' ? { ...match, winnerCarNumber: 32 } : match,
    ),
  }));
  await bracket.updateAction({ data: { rounds } });
  return { bracket, crossfadingCell: findResultCellOfCar(bracket, 'antes-de-decidir:carA') };
}

describe("a step's motion", () => {
  it('ends when the bracket is disposed in the middle of Próximo’s lift-out, and the play resolves', async () => {
    // Arrange: the first board on air, and Próximo's lift-out to the 16 avos started.
    const bracket = await createSuperPrimeOnAirWithMinuteLongMotion();
    const pendingStep = bracket.playAction({});
    const cards = findEveryPartOfBracket(bracket, 'bracket-match-card');
    const isMovingBefore = gsap.getTweensOf(cards).length > 0;

    // Act: dispose in the middle of it.
    await bracket.dispose();

    // Assert: it was moving; nothing moves any more; the play answers the dispose.
    expect(isMovingBefore, 'the cards were lifting out first').toBe(true);
    expect(gsap.getTweensOf(cards), 'dispose must end the motion').toEqual([]);
    await expect(pendingStep, 'the play must not hang').resolves.toEqual({
      statusCode: 409,
      statusMessage: 'O chaveamento já foi descartado (dispose).',
    });
  });

  it('ends when the element leaves the page without dispose during Próximo’s lift-out, and the play resolves', async () => {
    // Arrange: the first board on air, and Próximo's lift-out started.
    const bracket = await createSuperPrimeOnAirWithMinuteLongMotion();
    const pendingStep = bracket.playAction({});
    const cards = findEveryPartOfBracket(bracket, 'bracket-match-card');
    const isMovingBefore = gsap.getTweensOf(cards).length > 0;

    // Act: a renderer removes the element and never calls dispose.
    bracket.remove();

    // Assert: it was moving; nothing moves any more; the play resolves.
    expect(isMovingBefore, 'the cards were lifting out first').toBe(true);
    expect(gsap.getTweensOf(cards), 'leaving the page must end the motion').toEqual([]);
    await expect(pendingStep, 'the play must not hang').resolves.toMatchObject({
      statusCode: 200,
    });
  });
});

describe("a result's crossfade", () => {
  const crossfadeStopScenarios = [
    // dispose: the renderer is done with the graphic.
    {
      name: 'ends when the bracket is disposed',
      endIt: (bracket: BracketGraphic) => bracket.dispose(),
    },
    // disconnect: the renderer removed the element without dispose.
    {
      name: 'ends when the element leaves the page without dispose',
      endIt: (bracket: BracketGraphic) => {
        bracket.remove();
        return Promise.resolve();
      },
    },
    // stop: the crossfade must not go on fading a cell up while everything leaves.
    {
      name: 'ends at once when the bracket is stopped, before its lift-out',
      endIt: (bracket: BracketGraphic) => {
        void bracket.stopAction({});
        return Promise.resolve();
      },
    },
  ];

  it.each(crossfadeStopScenarios)('$name', async ({ endIt }) => {
    // Arrange: a result arriving on the results board, its cell crossfading for a minute.
    const { bracket, crossfadingCell } = await createResultsBoardInTheMiddleOfACrossfade();
    const isCrossfadingBefore = gsap.getTweensOf(crossfadingCell ?? []).length > 0;

    // Act: the row's way of ending it.
    await endIt(bracket);

    // Assert: it was crossfading; no tween is left on the cell.
    expect(isCrossfadingBefore, 'the cell was crossfading first').toBe(true);
    expect(gsap.getTweensOf(crossfadingCell ?? []), 'the crossfade must end').toEqual([]);
  });
});
