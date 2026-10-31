/**
 * The sponsor roll web component: a text too long for its box (packages/graphics/sponsor-roll)
 *
 * What this module is for:
 *   The sponsors are logos; the roll's words are the board head's line (the page's level,
 *   "PATROCÍNIO DIAMANTE") in the fullscreen layout and the event word in the corner's
 *   300 px card, which the operator types and may make longer than the card. Both are
 *   scrolling boxes of the kit (scrollingTextWhenTooLong.ts): the roll runs one cycle for
 *   them while on air and must end it whenever it leaves the air, or a GSAP timeline would
 *   go on running inside OBS.
 *
 * What these tests prove:
 *   - On air, in either layout, with every text too long, the roll runs exactly one cycle,
 *     the box at its start first, also after a play with skipAnimation.
 *   - Off air nothing runs: stop, dispose and removal from the page each end the cycle
 *     and put the text back at its start (each test fails without the stop).
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing and its changes during a scroll (a page turn writes a new level);
 *     the kit's tests.
 *   - Real widths; jsdom measures nothing, so every text is made too long by the kit's
 *     test support. The look is the screenshots' (sponsorRollScreenshots.e2e.ts).
 */
import {
  findRunningScrollingTextCycles,
  killScrollingTextCyclesWhenTheTestEnds,
  makeEveryScrollingTextTooLongForItsBox,
} from '@bajaovrlay/graphics-kit/scrollingTextOnAir.testSupport';
import { describe, expect, it } from 'vitest';

import type SponsorRollGraphic from './sponsor-roll.js';
import type { SponsorRollLayout } from './sponsorRollModel.js';
import {
  createSponsorRollOnThePage,
  createThe30thCompetitionRoll,
  loadSponsorRollWithData,
  placeTheSponsorHoldsOnTheRoot,
} from './sponsorRollOnThePage.testSupport.js';

/** Loads the roll of the 17 in a layout, every text too long, and takes it on air. */
async function putRollOnAirWithEveryTextTooLong(
  layout: SponsorRollLayout,
): Promise<SponsorRollGraphic> {
  makeEveryScrollingTextTooLongForItsBox();
  killScrollingTextCyclesWhenTheTestEnds();
  placeTheSponsorHoldsOnTheRoot();
  const roll = createSponsorRollOnThePage();
  await loadSponsorRollWithData(roll, createThe30thCompetitionRoll(layout));
  await roll.playAction({ skipAnimation: true });
  return roll;
}

/** The phase each scrolling box of the roll names, in page order. */
function readPhasesOfTheBoxes(roll: SponsorRollGraphic): (string | undefined)[] {
  const boxes = roll.shadowRoot?.querySelectorAll<HTMLElement>('.scrolling-text-box') ?? [];
  return [...boxes].map((box) => box.dataset.scrollPhase);
}

const layouts = [
  // The board: the head's line with the page's level.
  { layout: 'fullscreen' as const },
  // The bug's card: the event word over the sponsor cell.
  { layout: 'corner' as const },
];

describe('a text too long for its box', () => {
  it.each(layouts)(
    'runs on one cycle while on air in the $layout layout, at its start first',
    async ({ layout }) => {
      // Arrange and act: on air, taken with skipAnimation as a reloaded renderer does.
      const roll = await putRollOnAirWithEveryTextTooLong(layout);

      // Assert: one cycle, the one box holding at its start.
      expect(findRunningScrollingTextCycles().length, 'the roll must run one cycle').toBe(1);
      expect(readPhasesOfTheBoxes(roll), 'the box must hold at its start first').toEqual([
        'holdingAtStart',
      ]);
    },
  );

  const waysOffAir = [
    // The operator takes the roll off: its play-out must not leave a cycle behind.
    {
      name: 'stop',
      takeOffAir: (roll: SponsorRollGraphic) => roll.stopAction({ skipAnimation: true }),
    },
    // The renderer disposes of the layer.
    { name: 'dispose', takeOffAir: (roll: SponsorRollGraphic) => roll.dispose() },
    // The renderer takes the layer out of the page without dispose.
    {
      name: 'removal from the page',
      takeOffAir: (roll: SponsorRollGraphic) => {
        roll.remove();
        return Promise.resolve();
      },
    },
  ];

  it.each(waysOffAir)('ends with no cycle left running after $name', async ({ takeOffAir }) => {
    // Arrange: the corner on air, its cycle running.
    const roll = await putRollOnAirWithEveryTextTooLong('corner');

    // Act: the roll leaves the air this way.
    await takeOffAir(roll);

    // Assert: no cycle runs, and the box keeps no phase (so no fade).
    expect(findRunningScrollingTextCycles(), 'no cycle may run off air').toEqual([]);
    expect(readPhasesOfTheBoxes(roll), 'the text must be back at its start').toEqual([undefined]);
  });
});
