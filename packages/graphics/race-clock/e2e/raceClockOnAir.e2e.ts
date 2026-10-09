/**
 * The race clock on air, in the preview page (packages/graphics/race-clock, Playwright)
 *
 * What this module is for:
 *   preview.html shows the built race clock on its own with data from `?data=`, plays it
 *   in, and has buttons to play, stop and change the flag. These tests watch the clock
 *   there, in Chromium, the way a viewer of the stream would see it.
 *
 * What these tests prove:
 *   - A running clock counts on its own, with no update from outside.
 *   - The preview buttons work: the flag button changes the flag on air.
 *   - A flag change wipes the new colour in over several frames; it never snaps.
 *   - An update changes text in place: the elements on screen are the same ones after
 *     it (the DOM is never rebuilt).
 *   - The clock text keeps its width when the digits change (tabular numerals), so it
 *     does not jitter on air.
 *   - A theme set on the page's :root (as the renderer's theme will be) reaches inside
 *     the graphic, and the built-in colours apply until it does.
 *
 * What these tests deliberately do not cover:
 *   - Pixel-exact looks; raceClockScreenshots.e2e.ts compares screenshots.
 *   - The OGraf call order; raceClockLifecycle.e2e.ts drives the graphic like a renderer.
 */
import { expect, type Page, test } from '@playwright/test';

import { buildPreviewAddressWithData } from './previewAddress.js';

/** Data for an enduro under green flag, 1:05:00 in, read "now" and held or running. */
function createGreenFlagEnduroData(isRunning: boolean) {
  return {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_900_000,
    referenceWallClockMs: Date.now(),
    running: isRunning,
    lapsCompletedByLeader: 12,
  };
}

/** Opens the preview with the given data and waits until the clock has finished playing in. */
async function openPreviewOnAir(page: Page, data: Record<string, unknown>): Promise<void> {
  await page.goto(buildPreviewAddressWithData(data));
  await expect(page.locator('body'), 'the preview must get the clock on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
}

test.describe('the race clock in the preview page', () => {
  test('counts on its own while the clock is running', async ({ page }) => {
    // Arrange: a running green-flag enduro, read at 1:05:00 just now.
    await openPreviewOnAir(page, createGreenFlagEnduroData(true));
    const clockTime = page.getByTestId('race-clock-time');
    const clockTextAtStart = await clockTime.textContent();

    // Act: wait, without sending anything, until the text changes.
    await expect
      .poll(() => clockTime.textContent(), { message: 'the clock text must change by itself' })
      .not.toBe(clockTextAtStart);

    // Assert: it moved forward from 1:05:0x, as an elapsed clock does.
    expect(clockTextAtStart, 'the clock must start near the 1:05:00 reading').toMatch(/^1:05:0\d$/);
    expect(await clockTime.textContent(), 'the clock must have counted up').toMatch(/^1:05:\d\d$/);
  });

  test('changes the flag on air when the preview flag button is pressed', async ({ page }) => {
    // Arrange: the preview with a green-flag enduro on air.
    await openPreviewOnAir(page, createGreenFlagEnduroData(false));

    // Act: press the red-flag button, as a designer would.
    await page.getByRole('button', { name: 'Bandeira: VERMELHA' }).click();

    // Assert: once the update finished, the red label is on air.
    await expect(page.locator('body'), 'the update must finish').toHaveAttribute(
      'data-preview-state',
      'onAir',
    );
    await expect(page.getByTestId('race-clock-flag-label'), 'the red flag must show').toHaveText(
      'VERMELHA',
    );
  });

  test('wipes a new flag colour in over several frames instead of snapping', async ({ page }) => {
    // Arrange: the preview with a green-flag enduro on air.
    await openPreviewOnAir(page, createGreenFlagEnduroData(false));

    // Act: change to red, and note the incoming flag layer's clip on every frame
    // until the update resolves.
    const distinctClipsSeen = await page.evaluate(async () => {
      type OGrafGraphic = HTMLElement & { updateAction: (params: object) => Promise<unknown> };
      const graphic = document.querySelector('baja-race-clock') as OGrafGraphic;
      const incomingLayer = graphic.shadowRoot?.querySelector(
        '[data-testid="race-clock-incoming-flag-layer"]',
      );
      const clipsSeen = new Set<string>();
      let isStillSampling = true;
      const sampleIncomingLayerClip = () => {
        if (incomingLayer) {
          clipsSeen.add(getComputedStyle(incomingLayer).clipPath);
        }
        if (isStillSampling) {
          requestAnimationFrame(sampleIncomingLayerClip);
        }
      };
      sampleIncomingLayerClip();
      await graphic.updateAction({ data: { state: 'red' } });
      isStillSampling = false;
      return clipsSeen.size;
    });

    // Assert: more than a "before" and an "after" clip: the wipe had steps in between.
    expect(
      distinctClipsSeen,
      'a flag change must animate through intermediate frames, never snap',
    ).toBeGreaterThan(2);
  });

  test('updates text in place without rebuilding the elements on screen', async ({ page }) => {
    // Arrange: the preview on air, with the clock and flag label elements noted.
    await openPreviewOnAir(page, createGreenFlagEnduroData(false));

    // Act: send an update that changes the flag, the clock and the laps.
    const areTheSameElements = await page.evaluate(async () => {
      type OGrafGraphic = HTMLElement & { updateAction: (params: object) => Promise<unknown> };
      const graphic = document.querySelector('baja-race-clock') as OGrafGraphic;
      const findPart = (testId: string) =>
        graphic.shadowRoot?.querySelector(`[data-testid="${testId}"]`);
      const clockTimeBefore = findPart('race-clock-time');
      const flagLabelBefore = findPart('race-clock-flag-label');
      const lapsBefore = findPart('race-clock-laps');
      await graphic.updateAction({
        data: { state: 'yellow', referenceTimeMs: 4_000_000, lapsCompletedByLeader: 13 },
        skipAnimation: true,
      });
      return (
        clockTimeBefore === findPart('race-clock-time') &&
        flagLabelBefore === findPart('race-clock-flag-label') &&
        lapsBefore === findPart('race-clock-laps')
      );
    });

    // Assert: the very same elements are on screen, now with the new text.
    expect(areTheSameElements, 'an update must change text in place, not rebuild').toBe(true);
    await expect(page.getByTestId('race-clock-laps'), 'the new lap count must show').toHaveText(
      '13 VOLTAS',
    );
  });

  test('keeps the clock text the same width when its digits change', async ({ page }) => {
    // Arrange: the preview on air with a held clock.
    await openPreviewOnAir(page, createGreenFlagEnduroData(false));

    // Act: show 1:11:11 (narrow digits in most fonts), then 1:00:00, measuring each.
    const clockWidths = await page.evaluate(async () => {
      type OGrafGraphic = HTMLElement & { updateAction: (params: object) => Promise<unknown> };
      const graphic = document.querySelector('baja-race-clock') as OGrafGraphic;
      const clockTime = graphic.shadowRoot?.querySelector('[data-testid="race-clock-time"]');
      const measureClockWidthAt = async (referenceTimeMs: number) => {
        await graphic.updateAction({ data: { referenceTimeMs }, skipAnimation: true });
        return clockTime?.getBoundingClientRect().width ?? 0;
      };
      return {
        withOnes: await measureClockWidthAt(4_271_000),
        withZeros: await measureClockWidthAt(3_600_000),
      };
    });

    // Assert: both widths are the same, so the clock does not jitter.
    expect(clockWidths.withOnes, 'the clock must be drawn at all').toBeGreaterThan(0);
    expect(clockWidths.withOnes, 'every digit must take the same width').toBeCloseTo(
      clockWidths.withZeros,
      1,
    );
  });

  test('takes its colours from a theme set on the page root', async ({ page }) => {
    // Arrange: the preview on air under green flag, with no theme set yet.
    await openPreviewOnAir(page, createGreenFlagEnduroData(false));
    const readFlagAndBrandColours = () =>
      page.evaluate(() => {
        const shadowRoot = document.querySelector('baja-race-clock')?.shadowRoot;
        const flagLayer = shadowRoot?.querySelector(
          '[data-testid="race-clock-current-flag-layer"]',
        );
        const sessionRow = shadowRoot?.querySelector('.session-row');
        return {
          flagBackground: flagLayer ? getComputedStyle(flagLayer).backgroundColor : 'no flag',
          brandStripe: sessionRow ? getComputedStyle(sessionRow).borderLeftColor : 'no row',
        };
      });
    const coloursBeforeTheme = await readFlagAndBrandColours();

    // Act: the renderer's theme sets a blue brand and a darker green flag on :root.
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--baja-brand', '#0057b8');
      document.documentElement.style.setProperty('--baja-flag-green-background', '#006b2d');
    });
    const coloursAfterTheme = await readFlagAndBrandColours();

    // Assert: the defaults showed first, then the theme's colours replaced them.
    expect(coloursBeforeTheme, 'with no theme the built-in colours must show').toEqual({
      flagBackground: 'rgb(21, 163, 74)',
      brandStripe: 'rgb(242, 107, 29)',
    });
    expect(coloursAfterTheme, 'a theme on :root must reach inside the graphic').toEqual({
      flagBackground: 'rgb(0, 107, 45)',
      brandStripe: 'rgb(0, 87, 184)',
    });
  });
});
