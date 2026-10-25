/**
 * The QR card leaving the page without dispose (packages/graphics/qr-card)
 *
 * What this module is for:
 *   A renderer that removes the card's element without calling dispose (a page torn down,
 *   a layer emptied by hand) must leave nothing animating behind it. The card's only
 *   motions are its in and its out, so Lit's disconnectedCallback ends a running one at
 *   once (gate 2 of PR #27). Kept apart from qr-card.test.ts, which is near its length.
 *
 * What these tests prove:
 *   - Removing the element during a play-in ends it: no tween is left on the card and the
 *     pending play resolves instead of hanging. The test fails if the end is taken out.
 *
 * What these tests deliberately do not cover:
 *   - dispose, which ends the motion the same way; qr-card.test.ts.
 */
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import { createResultsSample } from './previewData.js';
import {
  createQrCardOnThePage,
  findPartOfQrCard,
  loadQrCardWithData,
} from './qrCardOnThePage.testSupport.js';

describe('the QR card leaving the page', () => {
  it('ends a running play-in when the element is removed without dispose', async () => {
    // Arrange: a loaded card whose play-in lasts a minute (on the card itself, since jsdom
    // carries no custom property from :root into a shadow root), its play-in started.
    const qrCard = createQrCardOnThePage();
    await loadQrCardWithData(qrCard, createResultsSample());
    const panel = findPartOfQrCard(qrCard, 'qr-card-panel');
    panel?.style.setProperty('--motion-in', '60000ms');
    const pendingPlay = qrCard.playAction({});
    const isRisingBefore = gsap.getTweensOf(panel ?? []).length > 0;

    // Act: a renderer removes the element and never calls dispose.
    qrCard.remove();

    // Assert: it was rising, nothing animates it any more, and the play resolves.
    expect(isRisingBefore, 'the card was rising first').toBe(true);
    expect(gsap.getTweensOf(panel ?? []), 'leaving the page must end the play-in').toEqual([]);
    await expect(pendingPlay, 'the play must not hang').resolves.toMatchObject({
      statusCode: 200,
    });
  });
});
