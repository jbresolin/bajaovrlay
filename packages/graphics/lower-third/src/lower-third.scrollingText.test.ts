/**
 * The lower third web component: texts too long for their pill (packages/graphics/lower-third)
 *
 * What this module is for:
 *   A person's name, a role and a team line ("Baja UTFPR · Universidade Tecnológica Federal
 *   do Paraná - Cornélio Procópio") can be wider than the pills may grow
 *   (`--lower-third-max-width`). Each text is a scrolling box of the kit
 *   (scrollingTextWhenTooLong.ts): the lower third runs one clock for its texts while on
 *   air, and must end it whenever it leaves the air, or its animations and timers would go on
 *   running inside OBS.
 *
 * What these tests prove:
 *   - The name, the role and the team line are scrolling boxes.
 *   - On air, with every text too long, the lower third runs exactly one cycle, each text
 *     at its start first, also after a play with skipAnimation.
 *   - Off air nothing runs: stop, dispose and removal from the page each end the cycle
 *     and put every text back at its start (each test fails without the stop).
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing and its changes during a scroll; the kit's tests.
 *   - Real widths; jsdom measures nothing, so every text is made too long by the kit's
 *     test support. lowerThirdLongNames.e2e.ts measures the real thing in Chromium.
 */
import {
  findRunningScrollingTextCycles,
  makeEveryScrollingTextTooLongForItsBox,
} from '@bajaovrlay/graphics-kit/scrollingTextOnAir.testSupport';
import { describe, expect, it } from 'vitest';

import type LowerThirdGraphic from './lower-third.js';
import {
  createLowerThirdOnThePage,
  createTeamCaptainData,
  findPartOfLowerThird,
  loadLowerThirdWithData,
} from './lowerThirdOnThePage.testSupport.js';

/** The lower third's scrolling boxes: the name, the role and the team line. */
function listScrollingBoxes(lowerThird: LowerThirdGraphic): HTMLElement[] {
  return ['lower-third-name', 'lower-third-role', 'lower-third-team-line'].map((testId) => {
    const box = findPartOfLowerThird(lowerThird, testId);
    if (box === undefined) {
      throw new Error(`the lower third has no "${testId}"`);
    }
    return box;
  });
}

/** Loads a team captain's lower third, every text too long, and takes it on air. */
async function putLowerThirdOnAirWithEveryTextTooLong(): Promise<LowerThirdGraphic> {
  makeEveryScrollingTextTooLongForItsBox();
  const lowerThird = createLowerThirdOnThePage();
  await loadLowerThirdWithData(lowerThird, createTeamCaptainData());
  await lowerThird.playAction({ skipAnimation: true });
  return lowerThird;
}

describe('the texts too long for their pill', () => {
  it('are the name, the role and the team line, each a scrolling box', async () => {
    // Arrange: a team captain's lower third, loaded off air.
    const lowerThird = createLowerThirdOnThePage();

    // Act: load it.
    await loadLowerThirdWithData(lowerThird, createTeamCaptainData());

    // Assert: each text sits in a scrolling box, inside the box's one text element.
    const boxes = listScrollingBoxes(lowerThird);
    const areScrollingBoxes = boxes.map((box) => box.classList.contains('scrolling-text-box'));
    expect(areScrollingBoxes, 'every text must be a scrolling box').toEqual([true, true, true]);
    const textsInTheirTextElement = boxes.map(
      (box) => box.querySelector('.scrolling-text')?.textContent,
    );
    expect(textsInTheirTextElement, 'each box must hold its text in its one text element').toEqual([
      'Mariana Costa',
      'Capitã da equipe',
      'Baja UFMG · UFMG',
    ]);
  });

  it('run on one cycle while on air, each at its start first', async () => {
    // Arrange and act: on air, taken with skipAnimation as a reloaded renderer does.
    const lowerThird = await putLowerThirdOnAirWithEveryTextTooLong();

    // Assert: one cycle for the whole lower third, every text holding at its start.
    expect(findRunningScrollingTextCycles().length, 'the lower third must run one cycle').toBe(1);
    const phases = new Set(listScrollingBoxes(lowerThird).map((box) => box.dataset.scrollPhase));
    expect([...phases], 'every text must hold at its start first').toEqual(['holdingAtStart']);
  });

  const waysOffAir = [
    // The operator takes the lower third off: its play-out must not leave a cycle behind.
    {
      name: 'stop',
      takeOffAir: (lowerThird: LowerThirdGraphic) => lowerThird.stopAction({ skipAnimation: true }),
    },
    // The renderer disposes of the layer.
    { name: 'dispose', takeOffAir: (lowerThird: LowerThirdGraphic) => lowerThird.dispose() },
    // The renderer takes the layer out of the page without dispose.
    {
      name: 'removal from the page',
      takeOffAir: (lowerThird: LowerThirdGraphic) => {
        lowerThird.remove();
        return Promise.resolve();
      },
    },
  ];

  it.each(waysOffAir)('end with no cycle left running after $name', async ({ takeOffAir }) => {
    // Arrange: the lower third on air, its cycle running.
    const lowerThird = await putLowerThirdOnAirWithEveryTextTooLong();
    const boxes = listScrollingBoxes(lowerThird);

    // Act: the lower third leaves the air this way.
    await takeOffAir(lowerThird);

    // Assert: no cycle runs, and no box keeps a phase (so none keeps its fade).
    expect(findRunningScrollingTextCycles(), 'no cycle may run off air').toEqual([]);
    const boxesWithAPhase = boxes.filter((box) => box.dataset.scrollPhase !== undefined);
    expect(boxesWithAPhase, 'every text must be back at its start').toEqual([]);
  });
});
