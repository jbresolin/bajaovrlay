/**
 * The countdown web component: a session name or an event too long for its box (packages/graphics/countdown)
 *
 * What this module is for:
 *   The countdown names the session it counts to: in the card's head (420 px) and, in the
 *   fullscreen layout, over the count, under the board's event line. A long name ("Enduro
 *   de Resistência — Universidade Tecnológica Federal do Paraná - Cornélio Procópio") is a
 *   scrolling box of the kit (scrollingTextWhenTooLong.ts): the countdown runs one cycle for
 *   its boxes while on air and must end it whenever it leaves the air, or a GSAP timeline
 *   would go on running inside OBS.
 *
 * What these tests prove:
 *   - On air, in either layout, with every text too long, the countdown runs exactly one
 *     cycle, every box at its start first, also after a play with skipAnimation; the
 *     fullscreen layout's session and event line share it.
 *   - Off air nothing runs: stop, dispose and removal from the page each end the cycle
 *     and put every text back at its start (each test fails without the stop).
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing and its changes during a scroll; the kit's tests.
 *   - Real widths; jsdom measures nothing, so every text is made too long by the kit's
 *     test support. The look is the screenshots' (countdownScreenshots.e2e.ts).
 */
import {
  findRunningScrollingTextCycles,
  makeEveryScrollingTextTooLongForItsBox,
} from '@bajaovrlay/graphics-kit/scrollingTextOnAir.testSupport';
import { describe, expect, it } from 'vitest';

import type CountdownGraphic from './countdown.js';
import type { CountdownLayout } from './countdownModel.js';
import {
  createCountdownOnThePage,
  createEnduroCountdownData,
  loadCountdownWithData,
} from './countdownOnThePage.testSupport.js';

/** Loads the enduro's countdown in a layout, every text too long, and takes it on air. */
async function putCountdownOnAirWithEveryTextTooLong(
  layout: CountdownLayout,
): Promise<CountdownGraphic> {
  makeEveryScrollingTextTooLongForItsBox();
  const countdown = createCountdownOnThePage();
  await loadCountdownWithData(countdown, createEnduroCountdownData(layout));
  await countdown.playAction({ skipAnimation: true });
  return countdown;
}

/** The phase each scrolling box of the countdown names, in page order. */
function readPhasesOfTheBoxes(countdown: CountdownGraphic): (string | undefined)[] {
  const boxes = countdown.shadowRoot?.querySelectorAll<HTMLElement>('.scrolling-text-box') ?? [];
  return [...boxes].map((box) => box.dataset.scrollPhase);
}

const layouts = [
  // The card on the clock layer: the session name in the head.
  { layout: 'card' as const, boxCount: 1 },
  // The waiting board: the event line in the head and the session over the count.
  { layout: 'fullscreen' as const, boxCount: 2 },
];

describe('texts too long for their boxes', () => {
  it.each(layouts)(
    'run on one cycle while on air in the $layout layout, at their start first',
    async ({ layout, boxCount }) => {
      // Arrange and act: on air, taken with skipAnimation as a reloaded renderer does.
      const countdown = await putCountdownOnAirWithEveryTextTooLong(layout);

      // Assert: one cycle for every box, each holding at its start.
      expect(findRunningScrollingTextCycles().length, 'the countdown must run one cycle').toBe(1);
      expect(readPhasesOfTheBoxes(countdown), 'every box must hold at its start first').toEqual(
        Array.from({ length: boxCount }, () => 'holdingAtStart'),
      );
    },
  );

  const waysOffAir = [
    // The operator takes the countdown off: its play-out must not leave a cycle behind.
    {
      name: 'stop',
      takeOffAir: (countdown: CountdownGraphic) => countdown.stopAction({ skipAnimation: true }),
    },
    // The renderer disposes of the layer.
    { name: 'dispose', takeOffAir: (countdown: CountdownGraphic) => countdown.dispose() },
    // The renderer takes the layer out of the page without dispose.
    {
      name: 'removal from the page',
      takeOffAir: (countdown: CountdownGraphic) => {
        countdown.remove();
        return Promise.resolve();
      },
    },
  ];

  it.each(waysOffAir)('end with no cycle left running after $name', async ({ takeOffAir }) => {
    // Arrange: the waiting board on air, its cycle running.
    const countdown = await putCountdownOnAirWithEveryTextTooLong('fullscreen');

    // Act: the countdown leaves the air this way.
    await takeOffAir(countdown);

    // Assert: no cycle runs, and no box keeps a phase (so none keeps its fade).
    expect(findRunningScrollingTextCycles(), 'no cycle may run off air').toEqual([]);
    expect(readPhasesOfTheBoxes(countdown), 'every text must be back at its start').toEqual([
      undefined,
      undefined,
    ]);
  });
});
