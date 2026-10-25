/**
 * Test support for the QR card's component and view tests: the element under test, its
 * load, and readers for what it shows. No theme token is placed on the page here unless a
 * test asks, so every timeline lasts 0 ms and a test never waits on real motion.
 */
import { onTestFinished } from 'vitest';

import QrCardGraphic from './qr-card.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-qr-card-under-test', QrCardGraphic);

/**
 * Puts a fresh QR card element on the page, as a renderer does before calling load. When
 * the test ends it is disposed and removed, so nothing leaks into the next test.
 */
export function createQrCardOnThePage(): QrCardGraphic {
  const qrCard = document.createElement('baja-qr-card-under-test') as QrCardGraphic;
  document.body.append(qrCard);
  onTestFinished(async () => {
    await qrCard.dispose();
    qrCard.remove();
  });
  return qrCard;
}

/** Loads the QR card the way an OBS renderer does: real-time, at 1920x1080. */
export function loadQrCardWithData(qrCard: QrCardGraphic, data: unknown) {
  return qrCard.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Finds one part of the graphic by its test id inside the shadow root; undefined when absent. */
export function findPartOfQrCard(
  qrCard: QrCardGraphic,
  testId: string,
): HTMLElement | SVGElement | undefined {
  return (
    qrCard.shadowRoot?.querySelector<HTMLElement | SVGElement>(`[data-testid="${testId}"]`) ??
    undefined
  );
}

/** Reads the text of one part of the graphic, found by its test id inside the shadow root. */
export function readShownText(qrCard: QrCardGraphic, testId: string): string | null | undefined {
  return findPartOfQrCard(qrCard, testId)?.textContent;
}

/** Reads the card's inline opacity, which GSAP sets: "0" off air, "1" on air. */
export function readPanelOpacity(qrCard: QrCardGraphic): string | undefined {
  return findPartOfQrCard(qrCard, 'qr-card-panel')?.style.opacity;
}

/** Reads the drawn code's path and its module count, as the card's SVG carries them. */
export function readDrawnCode(qrCard: QrCardGraphic): { pathData: string; moduleCount: number } {
  const code = findPartOfQrCard(qrCard, 'qr-card-code');
  const pathData = code?.querySelector('path')?.getAttribute('d') ?? '';
  const moduleCount = Number(code?.getAttribute('data-module-count'));
  return { pathData, moduleCount };
}
