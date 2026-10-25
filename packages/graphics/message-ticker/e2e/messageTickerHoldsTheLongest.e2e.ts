/**
 * The longest message the editor lets through fits the bar
 * (packages/graphics/message-ticker, Playwright)
 *
 * What this module is for:
 *   The item editor refuses a message longer than `longestMessageInCharacters` (50) and a
 *   label longer than `longestLabelInCharacters` (10), so a message on air never wraps,
 *   scrolls or is cut (the brief). Whether 50 is right depends on the face and the bar's
 *   widths, so this test proves it in Chromium on the built preview, with the theme's tokens
 *   and Bebas Neue as on air, against the worst case.
 *
 * What these tests prove:
 *   - The worst case fits: a message of 50 copies of the widest character at the message's
 *     style, after a label of 10 copies of the widest character at the label's style, with
 *     the clock block on and the page cell at "1/9", ends inside its pill (nothing cut)
 *     and the bar ends at x 1824.
 *   - The bar sits in its slot: x 96 to 1824, bottom at y 1026, 72 px tall.
 *
 * What these tests deliberately do not cover:
 *   - A 51st character: the editor refuses it (schemaFormTextList.test.ts, and the
 *     graphic's own check, messageTickerManifestDataAgreement.test.ts).
 */
import { expect, type Page, test } from '@playwright/test';

import {
  longestLabelInCharacters,
  longestMessageInCharacters,
  mostMessages,
} from '../src/messageLimits.js';

/** The characters a Portuguese announcement may hold, among which the widest is found. */
const candidateCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÂÃÀÉÊÍÓÔÕÚÇ0123456789.,:;-–!?()/º%&@';

/** Opens the preview on the grey stage (the clock held) and waits for it on air with its face. */
async function openPreviewOnAir(page: Page): Promise<void> {
  await page.goto('preview.html?stage=grey');
  await expect(page.locator('body'), 'the ticker must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

test.describe('the longest message on the ticker', () => {
  test('fits the bar at its worst: the widest characters after the widest label', async ({
    page,
  }) => {
    // Arrange: the built preview on air.
    await openPreviewOnAir(page);

    // Act: find the widest character of the label's and of the message's style inside the
    // ticker, send the worst label and the worst first message of nine, and measure.
    const measurement = await page.evaluate(
      async ({ candidates, labelLength, messageLength, messageCount }) => {
        type TickerElement = HTMLElement & {
          updateAction: (params: { data: object }) => Promise<{ statusCode: number }>;
        };
        const ticker = document.querySelector('baja-message-ticker') as TickerElement;
        const root = ticker.shadowRoot as ShadowRoot;
        const findWidestCharacterIn = (styledElement: HTMLElement): string => {
          const probe = document.createElement('span');
          probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
          styledElement.append(probe);
          let widest = '';
          let widestPx = 0;
          for (const character of candidates) {
            probe.textContent = character.repeat(20);
            const widthPx = probe.getBoundingClientRect().width;
            if (widthPx > widestPx) {
              widest = character;
              widestPx = widthPx;
            }
          }
          probe.remove();
          return widest;
        };
        const label = root.querySelector('[data-testid="message-ticker-label"]') as HTMLElement;
        const message = root.querySelector('[data-testid="message-ticker-message"]') as HTMLElement;
        const widestOfTheLabel = findWidestCharacterIn(label);
        const widestOfTheMessage = findWidestCharacterIn(message);
        const worstMessage = widestOfTheMessage.repeat(messageLength);
        const otherMessages = Array.from({ length: messageCount - 1 }, () => 'Aviso');
        const answer = await ticker.updateAction({
          data: {
            label: widestOfTheLabel.repeat(labelLength),
            messages: [worstMessage, ...otherMessages],
          },
        });
        const bar = root.querySelector('[data-testid="message-ticker-bar"]') as HTMLElement;
        const pageCell = root.querySelector(
          '[data-testid="message-ticker-page-cell"]',
        ) as HTMLElement;
        return {
          statusCode: answer.statusCode,
          widestOfTheLabel,
          widestOfTheMessage,
          pageCell: pageCell.textContent,
          messageTextPx: message.scrollWidth,
          messageRoomPx: message.clientWidth,
          barRightPx: bar.getBoundingClientRect().right,
          pageCellRightPx: pageCell.getBoundingClientRect().right,
        };
      },
      {
        candidates: candidateCharacters,
        labelLength: longestLabelInCharacters,
        messageLength: longestMessageInCharacters,
        messageCount: mostMessages,
      },
    );

    // Assert: the update was taken, and the worst message is not wider than its pill; the
    // page cell still ends where the bar does.
    expect(measurement.statusCode, 'the worst case is within the limits').toBe(200);
    expect(measurement.pageCell, 'nine messages').toBe('1/9');
    expect(
      measurement.messageTextPx,
      `50 × "${measurement.widestOfTheMessage}" after 10 × "${measurement.widestOfTheLabel}" must fit its pill`,
    ).toBeLessThanOrEqual(measurement.messageRoomPx);
    expect(measurement.pageCellRightPx, 'the page cell ends with the bar').toBe(
      measurement.barRightPx,
    );
  });

  test('sits in the ticker’s slot: x 96 to 1824, bottom at y 1026, 72 px tall', async ({
    page,
  }) => {
    // Arrange: the built preview on air.
    await openPreviewOnAir(page);

    // Act: measure the bar.
    const barBox = await page.getByTestId('message-ticker-bar').boundingBox();

    // Assert: the strip's slot.
    expect(
      {
        left: barBox?.x,
        right: (barBox?.x ?? 0) + (barBox?.width ?? 0),
        bottom: (barBox?.y ?? 0) + (barBox?.height ?? 0),
        height: barBox?.height,
      },
      'the bar must sit in its slot',
    ).toEqual({ left: 96, right: 1824, bottom: 1026, height: 72 });
  });
});
