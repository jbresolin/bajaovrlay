/**
 * The intermission board web component: texts too long for their box
 * (packages/graphics/intermission-board)
 *
 * What this module is for:
 *   The top five's teams with their schools, the next session's name and the head's event
 *   line can be wider than their box. Each is a scrolling box of the kit
 *   (scrollingTextWhenTooLong.ts): the board runs one clock for all of them while on air,
 *   and must end it whenever it leaves the air, or a GSAP timeline would go on running
 *   inside OBS.
 *
 * What these tests prove:
 *   - On air, with every text too long, the board runs exactly one cycle for the top five,
 *     the next session and the event line, each at its start first, also after a play
 *     with skipAnimation.
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

import type IntermissionBoardGraphic from './intermission-board.js';
import {
  createBreakBeforeTheEnduro,
  createIntermissionBoardOnThePage,
  loadIntermissionBoardWithData,
} from './intermissionBoardOnThePage.testSupport.js';

/** Every scrolling box of the board: the top five's teams, the next session, the event line. */
function listScrollingBoxes(board: IntermissionBoardGraphic): HTMLElement[] {
  const boxes = board.shadowRoot?.querySelectorAll<HTMLElement>('.scrolling-text-box');
  return boxes === undefined ? [] : [...boxes];
}

/** Loads the break before the enduro with its top five, every text too long, on air. */
async function putBoardOnAirWithEveryTextTooLong(): Promise<IntermissionBoardGraphic> {
  makeEveryScrollingTextTooLongForItsBox();
  const board = createIntermissionBoardOnThePage();
  await loadIntermissionBoardWithData(
    board,
    createBreakBeforeTheEnduro({ hasTopFive: true, hasSponsors: false }),
  );
  await board.playAction({ skipAnimation: true });
  return board;
}

describe('the texts too long for their box', () => {
  it('run on one cycle for the whole board while on air, each at its start first', async () => {
    // Arrange and act: the break on air, taken with skipAnimation as a reloaded renderer does.
    const board = await putBoardOnAirWithEveryTextTooLong();

    // Assert: one cycle for the board; the five teams, the session and the event line
    // all holding at their start.
    expect(findRunningScrollingTextCycles().length, 'the board must run one cycle').toBe(1);
    const boxes = listScrollingBoxes(board);
    expect(boxes.length, 'five teams, the next session and the event line').toBe(7);
    const phases = new Set(boxes.map((box) => box.dataset.scrollPhase));
    expect([...phases], 'every text must hold at its start first').toEqual(['holdingAtStart']);
  });

  const waysOffAir = [
    // The operator takes the board off: its fade-out must not leave a cycle behind.
    {
      name: 'stop',
      takeOffAir: (board: IntermissionBoardGraphic) => board.stopAction({ skipAnimation: true }),
    },
    // The renderer disposes of the layer.
    { name: 'dispose', takeOffAir: (board: IntermissionBoardGraphic) => board.dispose() },
    // The renderer takes the layer out of the page without dispose.
    {
      name: 'removal from the page',
      takeOffAir: (board: IntermissionBoardGraphic) => {
        board.remove();
        return Promise.resolve();
      },
    },
  ];

  it.each(waysOffAir)('end with no cycle left running after $name', async ({ takeOffAir }) => {
    // Arrange: the break on air, its cycle running.
    const board = await putBoardOnAirWithEveryTextTooLong();
    const boxes = listScrollingBoxes(board);

    // Act: the board leaves the air this way.
    await takeOffAir(board);

    // Assert: no cycle runs, and no box keeps a phase (so none keeps its fade).
    expect(findRunningScrollingTextCycles(), 'no cycle may run off air').toEqual([]);
    const boxesWithAPhase = boxes.filter((box) => box.dataset.scrollPhase !== undefined);
    expect(boxesWithAPhase, 'every text must be back at its start').toEqual([]);
  });
});
