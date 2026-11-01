/**
 * The podium web component: names too long for their card (packages/graphics/podium)
 *
 * What this module is for:
 *   A podium card's team name and school ("Instituto Federal de Educação, Ciência e
 *   Tecnologia Fluminense - IFF - Campus Itaperuna") and the head's event line can be wider
 *   than their box. Each is one line in a scrolling box of the kit
 *   (scrollingTextWhenTooLong.ts), never wrapped nor ellipsed: the podium runs one clock for
 *   the whole board while on air, and must end it whenever it leaves the air, or its animations and
 *   timers would go on running inside OBS.
 *
 * What these tests prove:
 *   - On air, with every text too long, the podium runs exactly one cycle for every card's
 *     name and school and the event line, each at its start first, also after a play with
 *     skipAnimation.
 *   - Off air nothing runs: stop, dispose and removal from the page each end the cycle and
 *     put every text back at its start (each test fails without the stop).
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing and its changes during a scroll; the kit's tests.
 *   - Real widths; jsdom measures nothing, so every text is made too long by the kit's test
 *     support.
 */
import {
  findRunningScrollingTextCycles,
  makeEveryScrollingTextTooLongForItsBox,
} from '@bajaovrlay/graphics-kit/scrollingTextOnAir.testSupport';
import { describe, expect, it } from 'vitest';

import type PodiumGraphic from './podium.js';
import { createPodiumOnThePage, loadPodiumWithData } from './podiumOnThePage.testSupport.js';
import { createEnduroPodium } from './previewData.js';

/** Every scrolling box of the podium: each card's name and school, and the event line. */
function listScrollingBoxes(podium: PodiumGraphic): HTMLElement[] {
  const boxes = podium.shadowRoot?.querySelectorAll<HTMLElement>('.scrolling-text-box');
  return boxes === undefined ? [] : [...boxes];
}

/** Loads the enduro's podium, every text too long for its box, and takes it on air. */
async function putPodiumOnAirWithEveryTextTooLong(): Promise<PodiumGraphic> {
  makeEveryScrollingTextTooLongForItsBox();
  const podium = createPodiumOnThePage();
  await loadPodiumWithData(podium, createEnduroPodium(false));
  await podium.playAction({ skipAnimation: true });
  return podium;
}

describe('the texts too long for their box', () => {
  it('run on one cycle for the whole podium while on air, each at its start first', async () => {
    // Arrange and act: the enduro's podium on air, taken with skipAnimation as a reloaded
    // renderer does.
    const podium = await putPodiumOnAirWithEveryTextTooLong();

    // Assert: one cycle for the podium; three names, three schools and the event line,
    // all holding at their start.
    expect(findRunningScrollingTextCycles().length, 'the podium must run one cycle').toBe(1);
    const boxes = listScrollingBoxes(podium);
    expect(boxes.length, 'three names, three schools and the event line').toBe(7);
    const phases = new Set(boxes.map((box) => box.dataset.scrollPhase));
    expect([...phases], 'every text must hold at its start first').toEqual(['holdingAtStart']);
  });

  const waysOffAir = [
    // The operator takes the podium off: its lift-out must not leave a cycle behind.
    {
      name: 'stop',
      takeOffAir: (podium: PodiumGraphic) => podium.stopAction({ skipAnimation: true }),
    },
    // The renderer disposes of the layer.
    { name: 'dispose', takeOffAir: (podium: PodiumGraphic) => podium.dispose() },
    // The renderer takes the layer out of the page without dispose.
    {
      name: 'removal from the page',
      takeOffAir: (podium: PodiumGraphic) => {
        podium.remove();
        return Promise.resolve();
      },
    },
  ];

  it.each(waysOffAir)('end with no cycle left running after $name', async ({ takeOffAir }) => {
    // Arrange: the podium on air, its cycle running.
    const podium = await putPodiumOnAirWithEveryTextTooLong();
    const boxes = listScrollingBoxes(podium);

    // Act: the podium leaves the air this way.
    await takeOffAir(podium);

    // Assert: no cycle runs, and no box keeps a phase (so none keeps its fade).
    expect(findRunningScrollingTextCycles(), 'no cycle may run off air').toEqual([]);
    const boxesWithAPhase = boxes.filter((box) => box.dataset.scrollPhase !== undefined);
    expect(boxesWithAPhase, 'every text must be back at its start').toEqual([]);
  });
});
