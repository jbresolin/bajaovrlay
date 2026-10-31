/**
 * The sessions board web component: session names too long for their pill (packages/graphics/sessions-board)
 *
 * What this module is for:
 *   Each slot's session name sits between its start time and its state; a long one
 *   ("Enduro de Resistência — Universidade Tecnológica Federal do Paraná - Cornélio
 *   Procópio"), and the event line in the head, are scrolling boxes of the kit
 *   (scrollingTextWhenTooLong.ts) instead of being cut with an ellipsis. The board runs one
 *   cycle for all of them while on air and must end it whenever it leaves the air, or a
 *   GSAP timeline would go on running inside OBS.
 *
 * What these tests prove:
 *   - On air, with every text too long, the board runs exactly one cycle for the event
 *     line and the six session names, each at its start first, also after skipAnimation.
 *   - Off air nothing runs: stop, dispose and removal from the page each end the cycle
 *     and put every text back at its start (each test fails without the stop).
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing and its changes during a scroll; the kit's tests.
 *   - Real widths; jsdom measures nothing, so every text is made too long by the kit's
 *     test support. The look is the screenshots' (sessionsBoardScreenshots.e2e.ts).
 */
import {
  findRunningScrollingTextCycles,
  makeEveryScrollingTextTooLongForItsBox,
} from '@bajaovrlay/graphics-kit/scrollingTextOnAir.testSupport';
import { describe, expect, it } from 'vitest';

import type SessionsBoardGraphic from './sessions-board.js';
import {
  createSessionsBoardOnThePage,
  createSundaySessionsBoardData,
  loadSessionsBoardWithData,
} from './sessionsBoardOnThePage.testSupport.js';

/** Loads Sunday's board, every text too long for its box, and takes it on air. */
async function putBoardOnAirWithEveryTextTooLong(): Promise<SessionsBoardGraphic> {
  makeEveryScrollingTextTooLongForItsBox();
  const board = createSessionsBoardOnThePage();
  await loadSessionsBoardWithData(board, createSundaySessionsBoardData());
  await board.playAction({ skipAnimation: true });
  return board;
}

/** The phase each scrolling box of the board names, in page order. */
function readPhasesOfTheBoxes(board: SessionsBoardGraphic): (string | undefined)[] {
  const boxes = board.shadowRoot?.querySelectorAll<HTMLElement>('.scrolling-text-box') ?? [];
  return [...boxes].map((box) => box.dataset.scrollPhase);
}

describe('texts too long for their boxes', () => {
  it('run on one cycle while on air, the event line and every session at its start first', async () => {
    // Arrange and act: Sunday's board on air, taken with skipAnimation as a reloaded renderer does.
    const board = await putBoardOnAirWithEveryTextTooLong();

    // Assert: one cycle; the event line and the six sessions hold at their start.
    expect(findRunningScrollingTextCycles().length, 'the board must run one cycle').toBe(1);
    expect(readPhasesOfTheBoxes(board), 'every box must hold at its start first').toEqual(
      Array.from({ length: 7 }, () => 'holdingAtStart'),
    );
  });

  const waysOffAir = [
    // The operator takes the board off: its play-out must not leave a cycle behind.
    {
      name: 'stop',
      takeOffAir: (board: SessionsBoardGraphic) => board.stopAction({ skipAnimation: true }),
    },
    // The renderer disposes of the layer.
    { name: 'dispose', takeOffAir: (board: SessionsBoardGraphic) => board.dispose() },
    // The renderer takes the layer out of the page without dispose.
    {
      name: 'removal from the page',
      takeOffAir: (board: SessionsBoardGraphic) => {
        board.remove();
        return Promise.resolve();
      },
    },
  ];

  it.each(waysOffAir)('end with no cycle left running after $name', async ({ takeOffAir }) => {
    // Arrange: the board on air, its cycle running.
    const board = await putBoardOnAirWithEveryTextTooLong();

    // Act: the board leaves the air this way.
    await takeOffAir(board);

    // Assert: no cycle runs, and no box keeps a phase (so none keeps its fade).
    expect(findRunningScrollingTextCycles(), 'no cycle may run off air').toEqual([]);
    const boxesWithAPhase = readPhasesOfTheBoxes(board).filter((phase) => phase !== undefined);
    expect(boxesWithAPhase, 'every text must be back at its start').toEqual([]);
  });
});
