/**
 * The two monitors side by side at any window width (apps/control, Playwright)
 *
 * What this module is for:
 *   "Prévia" and "Programa" are two small pictures of the outputs in the centre of the
 *   control page. João's ruling (gate 2 of BAJAOVRLAY-15): they always sit side by side
 *   and shrink together when the window is too narrow for two 480x270 boxes, always
 *   16:9, and the renderer page inside each is still laid out at the stream's 1920x1080
 *   and only scaled down. Whether that really happens is a question of layout, which
 *   only a real browser answers; this test asks it in Chromium.
 *
 * What these tests prove:
 *   - At a 1600 px wide window (a common laptop) the two monitor boxes are side by side
 *     (same top, "Prévia" left of "Programa" without overlapping), equal in size,
 *     narrower than 480 px, and 16:9 within a pixel.
 *   - The page inside each frame is laid out 1920 px wide and its picture fills the box.
 *   - When the window is widened to 1920 px both boxes grow to 480x270 and no further;
 *     narrowed to 1280 px they shrink again and are still side by side and equal.
 *
 * What these tests deliberately do not cover:
 *   - The arithmetic for every width: src/features/outputMonitors/
 *     monitorWidthForColumnWidth.test.ts.
 *   - What the monitors show; previewThenTake.e2e.ts.
 *   - A window narrower than a desktop one: the control page is a desktop page.
 *
 * Sharing the server with the other tests:
 *   This test changes nothing on the server, but it empties it first like every other
 *   test here, so it starts from the same page whatever ran before it.
 */
import { expect, type Page, test } from '@playwright/test';

import { emptyTheServerState } from './emptyTheServerState';
import { openControlPageAndWaitUntilConnected } from './previewTestSteps';

test.beforeEach(async () => {
  await emptyTheServerState();
});

/** Where one monitor box is on the page and how big, in pixels. */
type BoxOnThePage = { x: number; y: number; width: number; height: number };

/**
 * Measures the box around one monitor's frame (the bordered 16:9 rectangle), and the
 * picture of the frame itself as it is drawn after scaling.
 */
async function measureMonitor(page: Page, monitorTitle: 'Prévia' | 'Programa') {
  const frame = page.locator(`iframe[title="${monitorTitle}"]`);
  const boxAroundTheFrame = frame.locator('..');
  const box: BoxOnThePage | null = await boxAroundTheFrame.boundingBox();
  const pictureOfTheFrame: BoxOnThePage | null = await frame.boundingBox();
  if (box === null || pictureOfTheFrame === null) {
    throw new Error(`the "${monitorTitle}" monitor is not drawn on the page`);
  }
  return { box, pictureOfTheFrame };
}

/**
 * Checks what must hold at every window width: side by side, equal, 16:9, and the
 * framed picture filling its box. `windowDescription` goes into the failure messages.
 */
async function expectMonitorsSideBySideEqualAndSixteenByNine(
  page: Page,
  windowDescription: string,
): Promise<{ monitorWidth: number; monitorHeight: number }> {
  const preview = await measureMonitor(page, 'Prévia');
  const program = await measureMonitor(page, 'Programa');

  expect(
    Math.abs(preview.box.y - program.box.y),
    `${windowDescription}: both monitors must start at the same height, side by side`,
  ).toBeLessThanOrEqual(1);
  expect(
    preview.box.x + preview.box.width,
    `${windowDescription}: "Prévia" must end before "Programa" begins, not overlap it`,
  ).toBeLessThanOrEqual(program.box.x);
  expect(
    [program.box.width, program.box.height],
    `${windowDescription}: "Programa" must be exactly as big as "Prévia"`,
  ).toEqual([preview.box.width, preview.box.height]);
  expect(
    Math.abs(preview.box.width * (9 / 16) - preview.box.height),
    `${windowDescription}: a monitor must be 16:9 within a pixel`,
  ).toBeLessThanOrEqual(1);
  // The box has a 1 px border on each side, so the picture may be up to 2 px wider and
  // taller than the room inside it; more than that would mean a wrong scale.
  expect(
    Math.abs(preview.pictureOfTheFrame.width - preview.box.width),
    `${windowDescription}: the scaled picture of the frame must be as wide as its box`,
  ).toBeLessThanOrEqual(2);
  expect(
    Math.abs(preview.pictureOfTheFrame.height - preview.box.height),
    `${windowDescription}: the scaled picture of the frame must be as tall as its box`,
  ).toBeLessThanOrEqual(2);

  return { monitorWidth: preview.box.width, monitorHeight: preview.box.height };
}

test.describe('the "Prévia" and "Programa" monitors', () => {
  test('stay side by side, equal and 16:9, and shrink and grow with the window', async ({
    page,
  }) => {
    // Arrange: the control page in the 1600 px wide window every test here uses, which
    // is too narrow for two 480 px monitors (the centre column is 864 px).
    await page.setViewportSize({ width: 1600, height: 900 });
    await openControlPageAndWaitUntilConnected(page);
    await expect(
      page.locator('iframe[title="Programa"]'),
      'the "Programa" monitor must be on the page',
    ).toBeVisible();

    // Act and assert, 1600 px: side by side, equal, 16:9, and smaller than full size.
    const sizeAt1600 = await expectMonitorsSideBySideEqualAndSixteenByNine(
      page,
      'in a 1600 px wide window',
    );
    expect(
      sizeAt1600.monitorWidth,
      'in a 1600 px wide window each monitor must be (864 - 16) / 2 = 424 px wide',
    ).toBe(424);

    // Assert: the page inside the frame is still laid out at the stream's width; only
    // its picture is smaller.
    const widthOfThePageInsideTheFrame = await page
      .frameLocator('iframe[title="Prévia"]')
      .locator('html')
      .evaluate(() => window.innerWidth);
    expect(
      widthOfThePageInsideTheFrame,
      'the renderer page inside a shrunken monitor must still be laid out 1920 px wide',
    ).toBe(1920);

    // Act and assert, 1920 px: widen the window; both monitors grow to their full size
    // and stop there.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect
      .poll(async () => (await measureMonitor(page, 'Prévia')).box.width, {
        message: 'a monitor must grow to 480 px when the window is widened to 1920 px',
      })
      .toBe(480);
    const sizeAt1920 = await expectMonitorsSideBySideEqualAndSixteenByNine(
      page,
      'in a 1920 px wide window',
    );
    expect(
      [sizeAt1920.monitorWidth, sizeAt1920.monitorHeight],
      'with room to spare a monitor must be exactly 480x270, never wider',
    ).toEqual([480, 270]);

    // Act and assert, 1280 px: narrow the window; both shrink again and stay side by
    // side (the centre column is 544 px, so each monitor is 264 px).
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect
      .poll(async () => (await measureMonitor(page, 'Prévia')).box.width, {
        message: 'a monitor must shrink to 264 px when the window is narrowed to 1280 px',
      })
      .toBe(264);
    await expectMonitorsSideBySideEqualAndSixteenByNine(page, 'in a 1280 px wide window');
  });
});
