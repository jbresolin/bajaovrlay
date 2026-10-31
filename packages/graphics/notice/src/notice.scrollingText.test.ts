/**
 * The notice web component: texts too long for the panel (packages/graphics/notice)
 *
 * What this module is for:
 *   The notice is 420 px wide (`--notice-width`). A team with its school ("Goytacá Baja
 *   Instituto Federal de Educação, Ciência e Tecnologia Fluminense - IFF - Campus
 *   Itaperuna") or a long penalty reason does not fit; instead of an ellipsis the team
 *   (name and school together) and the reason are scrolling boxes of the kit
 *   (scrollingTextWhenTooLong.ts). The notice runs one clock for them while on air, and
 *   must end it whenever it leaves the air, or its animations and timers would go on running inside
 *   OBS.
 *
 * What these tests prove:
 *   - The team (its name and school as one line) and the reason are scrolling boxes.
 *   - On air, with every text too long, the notice runs exactly one cycle, each text at its
 *     start first, also after a play with skipAnimation.
 *   - Off air nothing runs: stop, dispose and removal from the page each end the cycle
 *     and put every text back at its start (each test fails without the stop).
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing and its changes during a scroll; the kit's tests.
 *   - Real widths; jsdom measures nothing, so every text is made too long by the kit's
 *     test support.
 */
import {
  findRunningScrollingTextCycles,
  makeEveryScrollingTextTooLongForItsBox,
} from '@bajaovrlay/graphics-kit/scrollingTextOnAir.testSupport';
import { describe, expect, it } from 'vitest';

import type NoticeGraphic from './notice.js';
import {
  createJumpStartPenaltyData,
  createNoticeOnThePage,
  findPartOfNotice,
  loadNoticeWithData,
} from './noticeOnThePage.testSupport.js';

/** The notice's scrolling boxes: the team (name and school) and the reason. */
function listScrollingBoxes(notice: NoticeGraphic): HTMLElement[] {
  return ['notice-team', 'notice-reason'].map((testId) => {
    const box = findPartOfNotice(notice, testId);
    if (box === undefined) {
      throw new Error(`the notice has no "${testId}"`);
    }
    return box;
  });
}

/** Loads car 47's jump-start penalty, every text too long, and takes it on air. */
async function putNoticeOnAirWithEveryTextTooLong(): Promise<NoticeGraphic> {
  makeEveryScrollingTextTooLongForItsBox();
  const notice = createNoticeOnThePage();
  await loadNoticeWithData(notice, createJumpStartPenaltyData());
  await notice.playAction({ skipAnimation: true });
  return notice;
}

describe('the texts too long for the panel', () => {
  it('are the team with its school, and the reason, each a scrolling box', async () => {
    // Arrange: car 47's penalty notice, not loaded yet.
    const notice = createNoticeOnThePage();

    // Act: load it.
    await loadNoticeWithData(notice, createJumpStartPenaltyData());

    // Assert: each text sits in a scrolling box, inside the box's one text element.
    const boxes = listScrollingBoxes(notice);
    const areScrollingBoxes = boxes.map((box) => box.classList.contains('scrolling-text-box'));
    expect(areScrollingBoxes, 'every text must be a scrolling box').toEqual([true, true]);
    const textsInTheirTextElement = boxes.map(
      (box) => box.querySelector('.scrolling-text')?.textContent,
    );
    expect(textsInTheirTextElement, 'each box must hold its text in its one text element').toEqual([
      'Carnaúba BajaUFERSA',
      'Queima de largada',
    ]);
  });

  it('run on one cycle while on air, each at its start first', async () => {
    // Arrange and act: on air, taken with skipAnimation as a reloaded renderer does.
    const notice = await putNoticeOnAirWithEveryTextTooLong();

    // Assert: one cycle for the whole notice, every text holding at its start.
    expect(findRunningScrollingTextCycles().length, 'the notice must run one cycle').toBe(1);
    const phases = new Set(listScrollingBoxes(notice).map((box) => box.dataset.scrollPhase));
    expect([...phases], 'every text must hold at its start first').toEqual(['holdingAtStart']);
  });

  const waysOffAir = [
    // The operator takes the notice off: its play-out must not leave a cycle behind.
    {
      name: 'stop',
      takeOffAir: (notice: NoticeGraphic) => notice.stopAction({ skipAnimation: true }),
    },
    // The renderer disposes of the layer.
    { name: 'dispose', takeOffAir: (notice: NoticeGraphic) => notice.dispose() },
    // The renderer takes the layer out of the page without dispose.
    {
      name: 'removal from the page',
      takeOffAir: (notice: NoticeGraphic) => {
        notice.remove();
        return Promise.resolve();
      },
    },
  ];

  it.each(waysOffAir)('end with no cycle left running after $name', async ({ takeOffAir }) => {
    // Arrange: the notice on air, its cycle running.
    const notice = await putNoticeOnAirWithEveryTextTooLong();
    const boxes = listScrollingBoxes(notice);

    // Act: the notice leaves the air this way.
    await takeOffAir(notice);

    // Assert: no cycle runs, and no box keeps a phase (so none keeps its fade).
    expect(findRunningScrollingTextCycles(), 'no cycle may run off air').toEqual([]);
    const boxesWithAPhase = boxes.filter((box) => box.dataset.scrollPhase !== undefined);
    expect(boxesWithAPhase, 'every text must be back at its start').toEqual([]);
  });
});
