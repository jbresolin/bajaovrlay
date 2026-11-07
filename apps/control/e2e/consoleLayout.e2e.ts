/**
 * The console's columns and its two stacked monitors (apps/control, Playwright)
 *
 * What this module is for:
 *   The console has three columns: the rundown, the centre with "Prévia" above
 *   "Programa", and the right column with "Atalhos e macros" and "Camadas", where the
 *   operator works most (BAJAOVRLAY-59). Whether the right column really is the widest,
 *   whether both monitors fit on a 1920x1080 screen without scrolling, and whether a
 *   laptop's 1366x768 window ever scrolls sideways are questions of layout, which only a
 *   real browser answers; this test asks them in Chromium.
 *
 * What these tests prove:
 *   - At 1920x1080 both monitor frames are wholly inside the window, without scrolling;
 *     they are stacked ("Prévia" above "Programa", same left edge, not overlapping),
 *     equal, 640x360 (a third of the stream) and the picture inside fills each box, laid
 *     out at the stream's 1920 px.
 *   - At 1920x1080 the right column is wider than the centre, and the centre wider than
 *     the rundown.
 *   - At 1366x768 the page does not scroll sideways; the monitors have shrunk together to
 *     448x252, still stacked and both on screen, and the right column is still the widest.
 *   - Widened again to 1920 px, the monitors grow back to 640 px.
 *
 * What these tests deliberately do not cover:
 *   - The width arithmetic row by row: src/features/outputMonitors/
 *     monitorWidthForColumnWidth.test.ts.
 *   - What the monitors show: previewThenTake.e2e.ts.
 *   - How the console looks: João judges the screenshots in the PR. A test cannot tell
 *     cramped from comfortable, only inside from outside.
 *   - A window narrower than a laptop's: the control page is a desktop page.
 *
 * Sharing the server with the other tests:
 *   This test changes nothing on the server, but it empties it first like every other
 *   test here, so it starts from the same page whatever ran before it.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { emptyTheServerState } from './emptyTheServerState';
import { openControlPageAndWaitUntilConnected } from './previewTestSteps';

test.beforeEach(async () => {
  await emptyTheServerState();
});

/** Where something is on the page and how big, in pixels. */
type BoxOnThePage = { x: number; y: number; width: number; height: number };

/** Measures one element, failing with its description when it is not drawn. */
async function measureBox(element: Locator, description: string): Promise<BoxOnThePage> {
  const box = await element.boundingBox();
  if (box === null) {
    throw new Error(`${description} is not drawn on the page`);
  }
  return box;
}

/**
 * Measures the box around one monitor's frame (the bordered 16:9 rectangle), and the
 * picture of the frame itself as it is drawn after scaling.
 */
async function measureMonitor(page: Page, monitorTitle: 'Prévia' | 'Programa') {
  const frame = page.locator(`iframe[title="${monitorTitle}"]`);
  const box = await measureBox(frame.locator('..'), `the "${monitorTitle}" monitor`);
  const pictureOfTheFrame = await measureBox(frame, `the "${monitorTitle}" frame`);
  return { box, pictureOfTheFrame };
}

/** Measures the three columns of the console by the area that fills each one's width. */
async function measureColumnWidths(page: Page) {
  const rundown = await measureBox(page.getByRole('region', { name: 'Rundown' }), 'the rundown');
  const centre = await measureBox(
    page.getByRole('region', { name: 'Programa e edição rápida' }),
    'the centre column',
  );
  const right = await measureBox(
    page.getByRole('region', { name: 'Atalhos e macros' }),
    'the right column',
  );
  return { rundown: rundown.width, centre: centre.width, right: right.width };
}

/**
 * Checks what must hold at every window size: "Prévia" above "Programa", same left edge,
 * not overlapping, equal, 16:9, the framed picture filling its box, and both boxes wholly
 * inside the window as it opens, without scrolling. `windowDescription` goes into the
 * failure messages. Answers the size of one monitor.
 */
async function expectMonitorsStackedEqualAndOnScreen(
  page: Page,
  windowDescription: string,
): Promise<{ monitorWidth: number; monitorHeight: number }> {
  const preview = await measureMonitor(page, 'Prévia');
  const program = await measureMonitor(page, 'Programa');
  const windowSize = page.viewportSize();
  if (windowSize === null) {
    throw new Error('the window has no size');
  }

  expect(
    Math.abs(preview.box.x - program.box.x),
    `${windowDescription}: both monitors must start at the same left edge, one above the other`,
  ).toBeLessThanOrEqual(1);
  expect(
    preview.box.y + preview.box.height,
    `${windowDescription}: "Prévia" must end before "Programa" begins, not overlap it`,
  ).toBeLessThanOrEqual(program.box.y);
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
  expect(
    preview.box.y,
    `${windowDescription}: the top of "Prévia" must be on screen without scrolling`,
  ).toBeGreaterThanOrEqual(0);
  expect(
    program.box.y + program.box.height,
    `${windowDescription}: the bottom of "Programa" must be on screen without scrolling`,
  ).toBeLessThanOrEqual(windowSize.height);
  expect(
    program.box.x + program.box.width,
    `${windowDescription}: the right edge of the monitors must be on screen`,
  ).toBeLessThanOrEqual(windowSize.width);

  return { monitorWidth: preview.box.width, monitorHeight: preview.box.height };
}

/** How far the page can scroll sideways: 0 when it fits the window's width. */
async function measureSidewaysScroll(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe('the console layout', () => {
  test('at 1920x1080 shows both monitors whole, stacked at 640 px, with the right column the widest', async ({
    page,
  }) => {
    // Arrange: the control page on the target screen, 1920x1080.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openControlPageAndWaitUntilConnected(page);
    await expect
      .poll(async () => (await measureMonitor(page, 'Programa')).box.width, {
        message: 'the "Programa" monitor must be drawn at its full 640 px',
      })
      .toBe(640);

    // Act: measure the monitors and the columns.
    const monitorSize = await expectMonitorsStackedEqualAndOnScreen(page, 'at 1920x1080');
    const columnWidths = await measureColumnWidths(page);
    const widthOfThePageInsideTheFrame = await page
      .frameLocator('iframe[title="Prévia"]')
      .locator('html')
      .evaluate(() => window.innerWidth);

    // Assert: a third of the stream each, the page inside still laid out at 1920 px, and
    // the right column the widest.
    expect(
      [monitorSize.monitorWidth, monitorSize.monitorHeight],
      'at 1920x1080 each monitor must be exactly 640x360, a third of the stream',
    ).toEqual([640, 360]);
    expect(
      widthOfThePageInsideTheFrame,
      'the renderer page inside a monitor must still be laid out 1920 px wide',
    ).toBe(1920);
    expect(
      columnWidths.right,
      'the right column, where the operator works most, must be wider than the centre',
    ).toBeGreaterThan(columnWidths.centre);
    expect(columnWidths.centre, 'the centre must be wider than the rundown').toBeGreaterThan(
      columnWidths.rundown,
    );
  });

  test('at 1366x768 never scrolls sideways, and the monitors shrink together and grow back', async ({
    page,
  }) => {
    // Arrange: the control page on a common laptop screen, 1366x768.
    await page.setViewportSize({ width: 1366, height: 768 });
    await openControlPageAndWaitUntilConnected(page);
    await expect
      .poll(async () => (await measureMonitor(page, 'Programa')).box.width, {
        message: 'the "Programa" monitor must be drawn at the 448 px the centre allows',
      })
      .toBe(448);

    // Act: measure the sideways scroll, the monitors and the columns.
    const sidewaysScrollInPixels = await measureSidewaysScroll(page);
    const monitorSize = await expectMonitorsStackedEqualAndOnScreen(page, 'at 1366x768');
    const columnWidths = await measureColumnWidths(page);

    // Assert: no sideways scroll, smaller monitors still stacked, the right column still
    // the widest.
    expect(
      sidewaysScrollInPixels,
      'at 1366x768 the page must scroll down only, never sideways',
    ).toBe(0);
    expect(
      [monitorSize.monitorWidth, monitorSize.monitorHeight],
      'at 1366x768 each monitor must be 448x252, the centre column at that size',
    ).toEqual([448, 252]);
    expect(
      columnWidths.right,
      'at 1366x768 the right column must still be wider than the centre',
    ).toBeGreaterThan(columnWidths.centre);

    // Act: widen the window to the target screen again.
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Assert: both monitors grow back to a third of the stream.
    await expect
      .poll(async () => (await measureMonitor(page, 'Prévia')).box.width, {
        message: 'a monitor must grow back to 640 px when the window is widened to 1920 px',
      })
      .toBe(640);
    await expectMonitorsStackedEqualAndOnScreen(page, 'widened again to 1920x1080');
  });
});
