/**
 * The QR card web component: texts too long for the card (packages/graphics/qr-card)
 *
 * What this module is for:
 *   The operator types the call to action (no length limit, at the title's size) and the
 *   address (up to 106 characters). Either can be wider than the card may grow
 *   (`--lower-third-max-width`, the lower-third slot's maximum); each is a scrolling box of
 *   the kit (scrollingTextWhenTooLong.ts). The card runs one clock for them while on air,
 *   and must end it whenever it leaves the air, or its animations and timers would go on running
 *   inside OBS.
 *
 * What these tests prove:
 *   - The call to action and the address are scrolling boxes.
 *   - On air, with every text too long, the card runs exactly one cycle, each text at its
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

import { createResultsSample } from './previewData.js';
import type QrCardGraphic from './qr-card.js';
import {
  createQrCardOnThePage,
  findPartOfQrCard,
  loadQrCardWithData,
} from './qrCardOnThePage.testSupport.js';

/** The QR card's scrolling boxes: the call to action and the address. */
function listScrollingBoxes(qrCard: QrCardGraphic): HTMLElement[] {
  return ['qr-card-call-to-action', 'qr-card-address'].map((testId) => {
    const box = findPartOfQrCard(qrCard, testId);
    if (!(box instanceof HTMLElement)) {
      throw new Error(`the QR card has no "${testId}"`);
    }
    return box;
  });
}

/** Loads the results card, every text too long, and takes it on air. */
async function putQrCardOnAirWithEveryTextTooLong(): Promise<QrCardGraphic> {
  makeEveryScrollingTextTooLongForItsBox();
  const qrCard = createQrCardOnThePage();
  await loadQrCardWithData(qrCard, createResultsSample());
  await qrCard.playAction({ skipAnimation: true });
  return qrCard;
}

describe('the texts too long for the card', () => {
  it('are the call to action and the address, each a scrolling box', async () => {
    // Arrange: the results card, not loaded yet.
    const qrCard = createQrCardOnThePage();

    // Act: load it.
    await loadQrCardWithData(qrCard, createResultsSample());

    // Assert: each text sits in a scrolling box, inside the box's one text element.
    const boxes = listScrollingBoxes(qrCard);
    const areScrollingBoxes = boxes.map((box) => box.classList.contains('scrolling-text-box'));
    expect(areScrollingBoxes, 'every text must be a scrolling box').toEqual([true, true]);
    const textsInTheirTextElement = boxes.map(
      (box) => box.querySelector('.scrolling-text')?.textContent,
    );
    expect(textsInTheirTextElement, 'each box must hold its text in its one text element').toEqual([
      'Acompanhe os resultados',
      'resultados.bajasaebrasil.net',
    ]);
  });

  it('run on one cycle while on air, each at its start first', async () => {
    // Arrange and act: on air, taken with skipAnimation as a reloaded renderer does.
    const qrCard = await putQrCardOnAirWithEveryTextTooLong();

    // Assert: one cycle for the whole card, every text holding at its start.
    expect(findRunningScrollingTextCycles().length, 'the card must run one cycle').toBe(1);
    const phases = new Set(listScrollingBoxes(qrCard).map((box) => box.dataset.scrollPhase));
    expect([...phases], 'every text must hold at its start first').toEqual(['holdingAtStart']);
  });

  const waysOffAir = [
    // The operator takes the card off: its play-out must not leave a cycle behind.
    {
      name: 'stop',
      takeOffAir: (qrCard: QrCardGraphic) => qrCard.stopAction({ skipAnimation: true }),
    },
    // The renderer disposes of the layer.
    { name: 'dispose', takeOffAir: (qrCard: QrCardGraphic) => qrCard.dispose() },
    // The renderer takes the layer out of the page without dispose.
    {
      name: 'removal from the page',
      takeOffAir: (qrCard: QrCardGraphic) => {
        qrCard.remove();
        return Promise.resolve();
      },
    },
  ];

  it.each(waysOffAir)('end with no cycle left running after $name', async ({ takeOffAir }) => {
    // Arrange: the card on air, its cycle running.
    const qrCard = await putQrCardOnAirWithEveryTextTooLong();
    const boxes = listScrollingBoxes(qrCard);

    // Act: the card leaves the air this way.
    await takeOffAir(qrCard);

    // Assert: no cycle runs, and no box keeps a phase (so none keeps its fade).
    expect(findRunningScrollingTextCycles(), 'no cycle may run off air').toEqual([]);
    const boxesWithAPhase = boxes.filter((box) => box.dataset.scrollPhase !== undefined);
    expect(boxesWithAPhase, 'every text must be back at its start').toEqual([]);
  });
});
