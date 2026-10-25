/**
 * The QR card web component: updateAction, on air and during the stop-out
 * (packages/graphics/qr-card)
 *
 * What this module is for:
 *   qr-card.ts is the OGraf graphic the renderer loads, plays, updates, stops and disposes.
 *   This file is about updateAction: a new address on air, and one that arrives while the
 *   card is leaving. qr-card.test.ts covers the rest of the lifecycle.
 *
 * What these tests prove:
 *   - updateAction on air redraws in place with no motion: a new address gives a new code
 *     at once, in the same card element, which stays on air and has no tween running; a bad
 *     update answers 400 and leaves the code as it was.
 *   - An update that arrives during the stop-out is only stored: the fading card keeps the
 *     code it had, and the new code is drawn once the card is off screen.
 *   - A play that cuts a stop-out short draws the stored address before its play-in, still
 *     off air, and nothing redraws while the card rises (gate 2 of PR #27).
 *
 * What these tests deliberately do not cover:
 *   - Load, the calls at the wrong moment, play, stop and dispose: qr-card.test.ts.
 *   - Real rendering and timing; the Playwright suites in e2e/ run the built component.
 */
import { finishEveryRunningMotionAtOnce } from '@bajaovrlay/graphics-kit/finishEveryRunningMotion.testSupport';
import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import { createResultsSample } from './previewData.js';
import type QrCardGraphic from './qr-card.js';
import {
  createQrCardOnThePage,
  findPartOfQrCard,
  loadQrCardWithData,
  readDrawnCode,
  readPanelOpacity,
  readShownText,
} from './qrCardOnThePage.testSupport.js';
import { readQrModulesFromPathData, scanQrModules } from './qrCodeScanning.testSupport.js';

/** Scans the code the card shows now, from its own path. */
function scanTheCodeOnTheCard(qrCard: QrCardGraphic): string | undefined {
  const { pathData, moduleCount } = readDrawnCode(qrCard);
  return scanQrModules(readQrModulesFromPathData(pathData, moduleCount));
}

describe('updateAction', () => {
  it('draws the new address’s code at once, in the same card, still on air and still', async () => {
    // Arrange: the design's card on air, its card element noted.
    const qrCard = createQrCardOnThePage();
    await loadQrCardWithData(qrCard, createResultsSample());
    await qrCard.playAction({ skipAnimation: true });
    const cardBefore = findPartOfQrCard(qrCard, 'qr-card-panel');

    // Act: the operator points the code at the live timing page.
    const answer = await qrCard.updateAction({ data: { address: 'bajasaebrasil.net/ao-vivo' } });

    // Assert: 200, the new code and address drawn, the same card, on air, nothing moving.
    expect(answer, 'a good update must answer 200').toEqual({ statusCode: 200 });
    expect(scanTheCodeOnTheCard(qrCard), 'the new code must open the new address').toBe(
      'bajasaebrasil.net/ao-vivo',
    );
    expect(readShownText(qrCard, 'qr-card-address'), 'the new address must show').toBe(
      'bajasaebrasil.net/ao-vivo',
    );
    expect(findPartOfQrCard(qrCard, 'qr-card-panel'), 'the card must not be rebuilt').toBe(
      cardBefore,
    );
    expect(readPanelOpacity(qrCard), 'an update must not take the card off air').toBe('1');
    expect(gsap.getTweensOf(cardBefore ?? []), 'nothing may move while the card is up').toEqual([]);
  });

  it('answers 400 to a bad update and keeps showing the previous code', async () => {
    // Arrange: the design's card on air.
    const qrCard = createQrCardOnThePage();
    await loadQrCardWithData(qrCard, createResultsSample());
    await qrCard.playAction({ skipAnimation: true });

    // Act: send an address with a space in it.
    const answer = await qrCard.updateAction({ data: { address: 'baja sae brasil' } });

    // Assert: a 400 with the address's sentence, and the first code still drawn.
    expect(answer, 'a bad update must answer 400 with the address’s problem').toEqual({
      statusCode: 400,
      statusMessage:
        'O endereço do QR só pode ter letras sem acento, números e os sinais de um endereço (sem espaços).',
    });
    expect(scanTheCodeOnTheCard(qrCard), 'a refused update must leave the code on air').toBe(
      'resultados.bajasaebrasil.net',
    );
  });
});

describe('an update during the stop-out', () => {
  it('leaves the fading code alone, then draws the new one once the card is off screen', async () => {
    // Arrange: the design's card on air, its stop-out lasting a minute (on the card itself,
    // since jsdom carries no custom property from :root into a shadow root), so it is surely
    // still running when the test looks; the stop started.
    const qrCard = createQrCardOnThePage();
    await loadQrCardWithData(qrCard, createResultsSample());
    await qrCard.playAction({ skipAnimation: true });
    findPartOfQrCard(qrCard, 'qr-card-panel')?.style.setProperty('--motion-out', '60000ms');
    const stop = qrCard.stopAction({});

    // Act: a new address arrives while the card fades; then the stop-out ends.
    const answer = await qrCard.updateAction({ data: { address: 'bajasaebrasil.net/ao-vivo' } });
    const codeDuringTheStopOut = scanTheCodeOnTheCard(qrCard);
    finishEveryRunningMotionAtOnce();
    await stop;

    // Assert: accepted, the old code kept while fading, the new one drawn after.
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(codeDuringTheStopOut, 'the fading card must keep the code it had').toBe(
      'resultados.bajasaebrasil.net',
    );
    expect(scanTheCodeOnTheCard(qrCard), 'the new code must be drawn once off screen').toBe(
      'bajasaebrasil.net/ao-vivo',
    );
  });
});

describe('a play that cuts the stop-out short (gate 2 of PR #27)', () => {
  it('draws the stored address before the play-in, and nothing redraws while it rises', async () => {
    // Arrange: the card on air, a stop-out that cannot end by itself (a minute), a new
    // address stored during it, and a watch on every redraw with the lifecycle it came in.
    // The lifecycle is read through a cast: it is private, and the test needs to know only
    // whether the card was on air when Lit was asked to redraw.
    const qrCard = createQrCardOnThePage();
    await loadQrCardWithData(qrCard, createResultsSample());
    await qrCard.playAction({ skipAnimation: true });
    const panel = findPartOfQrCard(qrCard, 'qr-card-panel');
    panel?.style.setProperty('--motion-out', '60000ms');
    const stop = qrCard.stopAction({});
    await qrCard.updateAction({ data: { address: 'bajasaebrasil.net/ao-vivo' } });
    const lifecyclesOfRedraws: string[] = [];
    const originalRequestUpdate = qrCard.requestUpdate.bind(qrCard);
    qrCard.requestUpdate = (...requestArguments: Parameters<typeof qrCard.requestUpdate>) => {
      lifecyclesOfRedraws.push((qrCard as unknown as { lifecycle: string }).lifecycle);
      originalRequestUpdate(...requestArguments);
    };

    // Act: the operator takes it again before the stop-out ends.
    await qrCard.playAction({ skipAnimation: true });
    await stop;

    // Assert: drawn once, while still off air, with the new address; never during the rise.
    expect(lifecyclesOfRedraws, 'one redraw, before the play-in, none while on air').toEqual([
      'offAir',
    ]);
    expect(scanTheCodeOnTheCard(qrCard), 'the card rose with the new code').toBe(
      'bajasaebrasil.net/ao-vivo',
    );
  });
});
