/**
 * QR card screenshots, on two stages (packages/graphics/qr-card, Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so the look of the QR card in Ardósia is
 *   pinned by screenshots: the design's card and the card with the longest address, each on
 *   the design's grey and black stages, taken from the built preview.html (which loads the
 *   theme's tokens and font the way the renderer page does) at 1920x1080 and compared
 *   against the baselines stored next to this file. The design they must match is
 *   docs/design/directions/ardosia/qr-card.html (PR #21), whose code was a placeholder; here
 *   the code is real.
 *
 * What these tests prove:
 *   - Each card draws exactly like its baseline on both stages: the light surface, the code,
 *     the call to action at 34 px and the address at 26 px, in caps.
 *   - The card sits in the lower third's slot: left edge at x 96, bottom edge at y 940.
 *   - The code's box is the theme's 176 px square whatever the address, so the card is as
 *     tall for a short address as for the longest.
 *
 * What these tests deliberately do not cover:
 *   - That the code scans; qrCardLifecycle.e2e.ts reads the same pixels with jsQR.
 *   - Motion; the screenshots show the end of the play-in only.
 *   - Other operating systems: baselines are rendered on Linux (CI). After a deliberate
 *     visual change, refresh them with
 *     `pnpm --filter @bajaovrlay/qr-card test:e2e --update-snapshots`.
 */
import { expect, type Page, test } from '@playwright/test';

const cards = [
  // The design's qr-card page: the results site, a version 3 code.
  { slug: 'resultados', addressParameter: '' },
  // The longest address the card takes: the largest code, the widest address line.
  { slug: 'endereco-no-limite', addressParameter: '&address=longest' },
];

const stages = ['grey', 'black'] as const;

/** Opens the preview on air and waits for the face, never a timer. */
async function openPreviewOnAir(page: Page, address: string): Promise<void> {
  await page.goto(address);
  await expect(page.locator('body'), 'the QR card must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

test.describe('the QR card looks like its baseline', () => {
  for (const card of cards) {
    for (const stage of stages) {
      test(`${card.slug} on the ${stage} stage`, async ({ page }) => {
        // Arrange: the preview on air on this stage.
        await openPreviewOnAir(page, `preview.html?stage=${stage}${card.addressParameter}`);

        // Act: hide the preview's own buttons, which are not on air, and measure the card.
        await page.locator('#preview-controls').evaluate((controls) => {
          controls.style.visibility = 'hidden';
        });
        const cardBox = await page.getByTestId('qr-card-panel').boundingBox();
        const codeBoxBox = await page.getByTestId('qr-card-code-box').boundingBox();

        // Assert: the card's place, the code's box, and its look against the baseline. A 1%
        // pixel tolerance absorbs anti-aliasing differences between GPU drivers without
        // letting a colour or text change through.
        expect(
          { left: cardBox?.x, bottom: (cardBox?.y ?? 0) + (cardBox?.height ?? 0) },
          'the card must sit in the lower third’s slot: x 96, bottom at y 940',
        ).toEqual({ left: 96, bottom: 940 });
        expect(
          { width: codeBoxBox?.width, height: codeBoxBox?.height },
          'the code’s box must be the theme’s 176 px square',
        ).toEqual({ width: 176, height: 176 });
        await expect(
          page,
          `the QR card ${card.slug} must look exactly like its baseline on ${stage}`,
        ).toHaveScreenshot(`qr-card-${card.slug}-${stage}.png`, { maxDiffPixelRatio: 0.01 });
      });
    }
  }
});
