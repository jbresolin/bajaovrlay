/**
 * The sponsor bug web component: a word too long for the card (packages/graphics/sponsor-bug)
 *
 * What this module is for:
 *   The bug's card is 300 px wide all day. Its two words are typed by the operator: the
 *   event word beside the mark ("ENDURO", or "ENDURO DE RESISTÊNCIA") and the caption over
 *   the sponsor's logo ("Apresentado por"). Each is a scrolling box of the kit
 *   (scrollingTextWhenTooLong.ts) instead of running past the card: the bug runs one cycle
 *   for them while on air and must end it whenever it leaves the air, or its animations and timers
 *   would go on running inside OBS.
 *
 * What these tests prove:
 *   - On air, with both words too long, the bug runs exactly one cycle for the two, each at
 *     its start first, also after a play with skipAnimation.
 *   - Off air nothing runs: stop, dispose and removal from the page each end the cycle
 *     and put both words back at their start (each test fails without the stop).
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing and its changes during a scroll; the kit's tests.
 *   - Real widths; jsdom measures nothing, so every word is made too long by the kit's
 *     test support. The look is the screenshots' (sponsorBugScreenshots.e2e.ts).
 */
import {
  findRunningScrollingTextCycles,
  makeEveryScrollingTextTooLongForItsBox,
} from '@bajaovrlay/graphics-kit/scrollingTextOnAir.testSupport';
import { describe, expect, it } from 'vitest';

import type SponsorBugGraphic from './sponsor-bug.js';
import {
  createEnduroBugDataWithSponsor,
  createSponsorBugOnThePage,
  loadSponsorBugWithData,
} from './sponsorBugOnThePage.testSupport.js';

/** Lets the page's pending promise callbacks and timers run once (real timers). */
function letThePageCatchUp(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Loads the enduro's bug with its sponsor, both words too long, and takes it on air. */
async function putBugOnAirWithBothWordsTooLong(): Promise<SponsorBugGraphic> {
  makeEveryScrollingTextTooLongForItsBox();
  const sponsorBug = createSponsorBugOnThePage();
  const pendingLoad = loadSponsorBugWithData(sponsorBug, createEnduroBugDataWithSponsor());
  // jsdom loads no image: the logo's load event is fired by hand, as a page with the file would.
  await letThePageCatchUp();
  for (const image of sponsorBug.shadowRoot?.querySelectorAll('img') ?? []) {
    image.dispatchEvent(new Event('load'));
  }
  await pendingLoad;
  await sponsorBug.playAction({ skipAnimation: true });
  return sponsorBug;
}

/** The phase each scrolling box of the bug names, in page order. */
function readPhasesOfTheBoxes(sponsorBug: SponsorBugGraphic): (string | undefined)[] {
  const boxes = sponsorBug.shadowRoot?.querySelectorAll<HTMLElement>('.scrolling-text-box') ?? [];
  return [...boxes].map((box) => box.dataset.scrollPhase);
}

describe('words too long for the card', () => {
  it('run on one cycle while on air, each at its start first', async () => {
    // Arrange and act: the bug on air, taken with skipAnimation as a reloaded renderer does.
    const sponsorBug = await putBugOnAirWithBothWordsTooLong();

    // Assert: one cycle, the event word and the caption holding at their start.
    expect(findRunningScrollingTextCycles().length, 'the bug must run one cycle').toBe(1);
    expect(readPhasesOfTheBoxes(sponsorBug), 'both words must hold at their start').toEqual([
      'holdingAtStart',
      'holdingAtStart',
    ]);
  });

  const waysOffAir = [
    // The operator takes the bug off: its play-out must not leave a cycle behind.
    {
      name: 'stop',
      takeOffAir: (sponsorBug: SponsorBugGraphic) => sponsorBug.stopAction({ skipAnimation: true }),
    },
    // The renderer disposes of the layer.
    { name: 'dispose', takeOffAir: (sponsorBug: SponsorBugGraphic) => sponsorBug.dispose() },
    // The renderer takes the layer out of the page without dispose.
    {
      name: 'removal from the page',
      takeOffAir: (sponsorBug: SponsorBugGraphic) => {
        sponsorBug.remove();
        return Promise.resolve();
      },
    },
  ];

  it.each(waysOffAir)('end with no cycle left running after $name', async ({ takeOffAir }) => {
    // Arrange: the bug on air, its cycle running.
    const sponsorBug = await putBugOnAirWithBothWordsTooLong();

    // Act: the bug leaves the air this way.
    await takeOffAir(sponsorBug);

    // Assert: no cycle runs, and no box keeps a phase (so none keeps its fade).
    expect(findRunningScrollingTextCycles(), 'no cycle may run off air').toEqual([]);
    expect(readPhasesOfTheBoxes(sponsorBug), 'both words must be back at their start').toEqual([
      undefined,
      undefined,
    ]);
  });
});
