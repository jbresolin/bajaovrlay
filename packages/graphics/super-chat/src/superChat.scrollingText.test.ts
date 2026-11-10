/**
 * The Super Chat card: texts too long for it (packages/graphics/super-chat)
 *
 * What this module is for:
 *   The card is 420 px wide (`--notice-width`). A viewer's message is often longer, and a
 *   YouTube name can be too; instead of an ellipsis the author and the message are the
 *   kit's scrolling boxes (scrollingTextWhenTooLong.ts, BAJAOVRLAY-55). The card runs one
 *   clock for them while on air, and must end it whenever it leaves the air, or its
 *   animations and timers would go on running inside OBS.
 *
 * What these tests prove:
 *   - On air, with every text too long, the card runs exactly one cycle, each text at its
 *     start first, also after a play with skipAnimation.
 *   - Off air nothing runs: stop, dispose and removal from the page each end the cycle and
 *     put every text back at its start.
 *
 * What these tests deliberately do not cover:
 *   - The cycle's timing; the kit's tests.
 *   - Real widths; jsdom measures nothing, so every text is made too long by the kit's test
 *     support. The long-message screenshot shows a real one in Chromium.
 */
import {
  findRunningScrollingTextCycles,
  makeEveryScrollingTextTooLongForItsBox,
} from '@bajaovrlay/graphics-kit/scrollingTextOnAir.testSupport';
import { describe, expect, it } from 'vitest';

import type SuperChatGraphic from './super-chat.js';
import {
  createPequiSuperChatData,
  createSuperChatOnThePage,
  findPartOfSuperChat,
  loadSuperChatWithData,
} from './superChatOnThePage.testSupport.js';

/** The card's scrolling boxes: the author and the message. */
function listScrollingBoxes(superChat: SuperChatGraphic): HTMLElement[] {
  return ['super-chat-author', 'super-chat-message'].map((testId) => {
    const box = findPartOfSuperChat(superChat, testId);
    if (box === undefined) {
      throw new Error(`the card has no "${testId}"`);
    }
    return box;
  });
}

/** Loads Torcida Pequi Off-Road's Super Chat, every text too long, and takes it on air. */
async function putSuperChatOnAirWithEveryTextTooLong(): Promise<SuperChatGraphic> {
  makeEveryScrollingTextTooLongForItsBox();
  const superChat = createSuperChatOnThePage();
  await loadSuperChatWithData(superChat, createPequiSuperChatData());
  await superChat.playAction({ skipAnimation: true });
  return superChat;
}

describe('the texts too long for the card', () => {
  it('run on one cycle while on air, each at its start first', async () => {
    // Arrange and act: on air, taken with skipAnimation as a reloaded renderer does.
    const superChat = await putSuperChatOnAirWithEveryTextTooLong();

    // Assert: one cycle for the whole card, every text holding at its start.
    expect(findRunningScrollingTextCycles().length, 'the card must run one cycle').toBe(1);
    const phases = new Set(listScrollingBoxes(superChat).map((box) => box.dataset.scrollPhase));
    expect([...phases], 'every text must hold at its start first').toEqual(['holdingAtStart']);
  });

  const waysOffAir = [
    // The Super Chat rule's auto-out takes the card off: its play-out must not leave a cycle.
    {
      name: 'stop',
      takeOffAir: (superChat: SuperChatGraphic) => superChat.stopAction({ skipAnimation: true }),
    },
    // The renderer disposes of the layer.
    { name: 'dispose', takeOffAir: (superChat: SuperChatGraphic) => superChat.dispose() },
    // The renderer takes the layer out of the page without dispose.
    {
      name: 'removal from the page',
      takeOffAir: (superChat: SuperChatGraphic) => {
        superChat.remove();
        return Promise.resolve();
      },
    },
  ];

  it.each(waysOffAir)('end with no cycle left running after $name', async ({ takeOffAir }) => {
    // Arrange: the card on air, its cycle running.
    const superChat = await putSuperChatOnAirWithEveryTextTooLong();
    const boxes = listScrollingBoxes(superChat);

    // Act: the card leaves the air this way.
    await takeOffAir(superChat);

    // Assert: no cycle runs, and no box keeps a phase (so none keeps its fade).
    expect(findRunningScrollingTextCycles(), 'no cycle may run off air').toEqual([]);
    const boxesWithAPhase = boxes.filter((box) => box.dataset.scrollPhase !== undefined);
    expect(boxesWithAPhase, 'every text must be back at its start').toEqual([]);
  });
});
