/**
 * Renderer stage smoke test (apps/renderer, Playwright)
 *
 * What this module is for:
 *   The renderer is the page OBS loads as a browser source. Every graphic is drawn
 *   onto its stage: a transparent 1920x1080 area matching the stream canvas.
 *
 * What these tests prove:
 *   - In a real Chromium (the engine inside OBS), the page has a stage element that is
 *     exactly 1920x1080 and has a transparent background, so the video shows through.
 *   - The renderer announces "renderer ready" in the console once it has started.
 *
 * What these tests deliberately do not cover:
 *   - Graphics on the stage; there are none yet (the first arrives in BAJAOVRLAY-10).
 *   - OBS itself; Chromium stands in for OBS's browser source.
 */
import { expect, test } from '@playwright/test';

test.describe('the renderer page', () => {
  test('shows a transparent 1920x1080 stage', async ({ page }) => {
    // Arrange: nothing to set up; the page is opened fresh for this test.

    // Act: open the renderer at the address OBS uses.
    await page.goto('/render/');

    // Assert: the stage exists, has the stream size and lets the video show through.
    const stage = page.getByTestId('renderer-stage');
    await expect(stage, 'the renderer must have a stage element').toBeVisible();
    const stageSize = await stage.boundingBox();
    expect(stageSize, 'the stage must be exactly 1920x1080, the size of the stream').toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
    const stageBackgroundColor = await stage.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(stageBackgroundColor, 'the stage background must be fully transparent').toBe(
      'rgba(0, 0, 0, 0)',
    );
  });

  test('announces "renderer ready" in the console once it has started', async ({ page }) => {
    // Arrange: keep every console line the page writes, to look for the ready message.
    const consoleLines: string[] = [];
    page.on('console', (message) => consoleLines.push(message.text()));

    // Act: open the renderer at the address OBS uses.
    await page.goto('/render/');

    // Assert: the renderer logged a structured "renderer ready" line.
    await expect
      .poll(() => consoleLines.some((line) => line.includes('"message":"renderer ready"')), {
        message: 'the renderer must log "renderer ready" once it has started',
      })
      .toBe(true);
  });
});
