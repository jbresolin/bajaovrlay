/**
 * The bracket web component: names too long for their card (packages/graphics/bracket)
 *
 * What this module is for:
 *   A car's team with its school, in a round board's match card or a tree pill, and the
 *   head's event line are often wider than their box. Each is a scrolling box of the kit
 *   (scrollingTextWhenTooLong.ts): the bracket runs one clock for the whole stage while on
 *   air, and must end it whenever it leaves the air, or a GSAP timeline would go on running
 *   inside OBS.
 *
 * What these tests prove:
 *   - On air, with every text too long, the bracket runs exactly one cycle for every car
 *     on the stage, each at its start first, also after a play with skipAnimation.
 *   - Off air nothing runs: stop, dispose and removal from the page each end the cycle and
 *     put every text back at its start (each test fails without the stop).
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing and its changes during a scroll; the kit's tests.
 *   - Real widths; jsdom measures nothing, so every text is made too long by the kit's test
 *     support. bracketLongNames.e2e.ts measures the real thing in Chromium.
 */
import {
  findRunningScrollingTextCycles,
  makeEveryScrollingTextTooLongForItsBox,
} from '@bajaovrlay/graphics-kit/scrollingTextOnAir.testSupport';
import { describe, expect, it } from 'vitest';

import type BracketGraphic from './bracket.js';
import {
  ardosiaTreeTokenDeclarations,
  createBracketOnThePage,
  findEveryPartOfBracket,
  loadBracketWithData,
  placeTokensOnTheRoot,
} from './bracketOnThePage.testSupport.js';
import { createTheRealSuperPrime } from './previewData.js';

/** The bracket's team boxes on the stage, one per car shown. */
function listTeamBoxes(bracket: BracketGraphic): HTMLElement[] {
  return findEveryPartOfBracket(bracket, 'bracket-team');
}

/** Loads the real Super Prime, every text too long for its box, and takes it on air. */
async function putSuperPrimeOnAirWithEveryTextTooLong(): Promise<BracketGraphic> {
  makeEveryScrollingTextTooLongForItsBox();
  placeTokensOnTheRoot(ardosiaTreeTokenDeclarations);
  const bracket = createBracketOnThePage();
  await loadBracketWithData(bracket, createTheRealSuperPrime());
  await bracket.playAction({ skipAnimation: true });
  return bracket;
}

describe('the texts too long for their box', () => {
  it('run on one cycle for the whole stage while on air, each at its start first', async () => {
    // Arrange and act: the Super Prime on air, taken with skipAnimation as a reloaded
    // renderer does.
    const bracket = await putSuperPrimeOnAirWithEveryTextTooLong();

    // Assert: one cycle for the whole bracket, every car's team at its start.
    expect(findRunningScrollingTextCycles().length, 'the bracket must run one cycle').toBe(1);
    const teamBoxes = listTeamBoxes(bracket);
    expect(teamBoxes.length, 'the cars on the stage must have team boxes').toBeGreaterThan(1);
    const phases = new Set(teamBoxes.map((box) => box.dataset.scrollPhase));
    expect([...phases], 'every team must hold at its start first').toEqual(['holdingAtStart']);
  });

  const waysOffAir = [
    // The operator takes the bracket off: its lift-out must not leave a cycle behind.
    {
      name: 'stop',
      takeOffAir: (bracket: BracketGraphic) => bracket.stopAction({ skipAnimation: true }),
    },
    // The renderer disposes of the layer.
    { name: 'dispose', takeOffAir: (bracket: BracketGraphic) => bracket.dispose() },
    // The renderer takes the layer out of the page without dispose.
    {
      name: 'removal from the page',
      takeOffAir: (bracket: BracketGraphic) => {
        bracket.remove();
        return Promise.resolve();
      },
    },
  ];

  it.each(waysOffAir)('end with no cycle left running after $name', async ({ takeOffAir }) => {
    // Arrange: the Super Prime on air, its cycle running.
    const bracket = await putSuperPrimeOnAirWithEveryTextTooLong();
    const teamBoxes = listTeamBoxes(bracket);

    // Act: the bracket leaves the air this way.
    await takeOffAir(bracket);

    // Assert: no cycle runs, and no box keeps a phase (so none keeps its fade).
    expect(findRunningScrollingTextCycles(), 'no cycle may run off air').toEqual([]);
    const boxesWithAPhase = teamBoxes.filter((box) => box.dataset.scrollPhase !== undefined);
    expect(boxesWithAPhase, 'every text must be back at its start').toEqual([]);
  });
});
