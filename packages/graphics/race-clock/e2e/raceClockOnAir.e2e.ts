/**
 * The race clock on air, in the preview page (packages/graphics/race-clock, Playwright)
 *
 * What this module is for:
 *   preview.html shows the built race clock on its own with data from `?data=`, plays it
 *   in, and has buttons to play, stop, change the flag and switch the band. It loads the
 *   theme's tokens and font the way the renderer page does. These tests watch the clock
 *   there, in Chromium, the way a viewer of the stream would see it.
 *
 * What these tests prove:
 *   - A running clock counts on its own, with no update from outside.
 *   - The preview buttons work: the flag button changes the flag on air.
 *   - A flag change crossfades the new band in over several frames; it never snaps.
 *   - The band switched off on air shrinks the card over several frames (never a snap)
 *     to its height without the band, on the very same card element.
 *   - An update changes text in place: the elements on screen are the same ones after
 *     it (the DOM is never rebuilt).
 *   - The clock text keeps its width when the digits change (tabular numerals), so it
 *     does not jitter on air.
 *   - The graphic has no colours of its own: the band's colour is the theme token on
 *     the page's :root, and changing the token changes the band.
 *
 * What these tests deliberately do not cover:
 *   - Pixel-exact looks; raceClockScreenshots.e2e.ts compares screenshots.
 *   - The OGraf call order; raceClockLifecycle.e2e.ts drives the graphic like a renderer.
 */
import { buildPreviewAddressWithData } from '@bajaovrlay/graphics-kit/previewAddress.testSupport';
import { expect, type Page, test } from '@playwright/test';

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

    // Assert: once the update finished, the red word is on air.
    await expect(page.locator('body'), 'the update must finish').toHaveAttribute(
      'data-preview-state',
      'onAir',
    );
    await expect(page.getByTestId('race-clock-flag-label'), 'the red flag must show').toHaveText(
      'VERMELHA',
    );
  });

  test('crossfades a new flag band in over several frames instead of snapping', async ({
    page,
  }) => {
    // Arrange: the preview with a green-flag enduro on air.
    await openPreviewOnAir(page, createGreenFlagEnduroData(false));

    // Act: change to red, and note the incoming band layer's opacity on every frame
    // until the update resolves.
    const distinctOpacitiesSeen = await page.evaluate(async () => {
      type OGrafGraphic = HTMLElement & { updateAction: (params: object) => Promise<unknown> };
      const graphic = document.querySelector('baja-race-clock') as OGrafGraphic;
      const incomingLayer = graphic.shadowRoot?.querySelector(
        '[data-testid="race-clock-incoming-flag-layer"]',
      );
      const opacitiesSeen = new Set<string>();
      let isStillSampling = true;
      const sampleIncomingLayerOpacity = () => {
        if (incomingLayer) {
          opacitiesSeen.add(getComputedStyle(incomingLayer).opacity);
        }
        if (isStillSampling) {
          requestAnimationFrame(sampleIncomingLayerOpacity);
        }
      };
      sampleIncomingLayerOpacity();
      await graphic.updateAction({ data: { state: 'red' } });
      isStillSampling = false;
      return opacitiesSeen.size;
    });

    // Assert: more than a "before" and an "after" opacity: the crossfade had steps in between.
    expect(
      distinctOpacitiesSeen,
      'a flag change must fade through intermediate frames, never snap',
    ).toBeGreaterThan(2);
  });

  test('shrinks the card over several frames when the band is switched off on air', async ({
    page,
  }) => {
    // Arrange: the preview with a green-flag enduro on air, with its band.
    await openPreviewOnAir(page, createGreenFlagEnduroData(false));

    // Act: switch the band off, and note the card's height on every frame until the
    // update resolves, then whether the card is still the same element.
    const toggleAsSeen = await page.evaluate(async () => {
      type OGrafGraphic = HTMLElement & { updateAction: (params: object) => Promise<unknown> };
      const graphic = document.querySelector('baja-race-clock') as OGrafGraphic;
      const findPanel = () => graphic.shadowRoot?.querySelector('[data-testid="race-clock-panel"]');
      const panelBefore = findPanel();
      const heightsSeen = new Set<number>();
      let isStillSampling = true;
      const samplePanelHeight = () => {
        if (panelBefore) {
          heightsSeen.add(Math.round(panelBefore.getBoundingClientRect().height));
        }
        if (isStillSampling) {
          requestAnimationFrame(samplePanelHeight);
        }
      };
      samplePanelHeight();
      await graphic.updateAction({ data: { showFlagBand: false } });
      isStillSampling = false;
      return {
        distinctHeightsSeen: heightsSeen.size,
        heightAtTheEnd: Math.round(panelBefore?.getBoundingClientRect().height ?? 0),
        isTheSameCard: panelBefore === findPanel(),
      };
    });

    // Assert: the card went through heights between 192 and 152 (never a snap), ended
    // at its height without the band, and is still the same element.
    expect(
      toggleAsSeen.distinctHeightsSeen,
      'switching the band off must shrink the card through intermediate frames, never snap',
    ).toBeGreaterThan(2);
    expect(toggleAsSeen.heightAtTheEnd, 'without the band the card must end at 152 px').toBe(152);
    expect(toggleAsSeen.isTheSameCard, 'the card must be the same element after the switch').toBe(
      true,
    );
  });

  test('updates text in place without rebuilding the elements on screen', async ({ page }) => {
    // Arrange: the preview on air, with the clock and flag word elements noted.
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

  test('draws the band with the theme token on the page root, and follows the token', async ({
    page,
  }) => {
    // Arrange: the preview on air under green flag, with the theme's tokens on :root.
    await openPreviewOnAir(page, createGreenFlagEnduroData(false));
    const readBandBackground = () =>
      page.evaluate(() => {
        const flagLayer = document
          .querySelector('baja-race-clock')
          ?.shadowRoot?.querySelector('[data-testid="race-clock-current-flag-layer"]');
        return flagLayer ? getComputedStyle(flagLayer).backgroundColor : 'no band';
      });
    const bandBackgroundFromTheTheme = await readBandBackground();
    // The token's value as the browser draws it: a probe element painted with the
    // token's own text, so the test reads the same colour notation the band reports.
    const greenTokenAsDrawn = await page.evaluate(() => {
      const tokenValue = getComputedStyle(document.documentElement)
        .getPropertyValue('--flag-green-background')
        .trim();
      const probe = document.createElement('div');
      probe.style.backgroundColor = tokenValue;
      document.body.append(probe);
      const colourAsDrawn = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { tokenValue, colourAsDrawn };
    });

    // Act: the theme changes the green flag token on :root to a darker green.
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--flag-green-background', '#006b2d');
    });
    const bandBackgroundAfterTheChange = await readBandBackground();

    // Assert: the token was there, the band was drawn with it, and it followed the change.
    expect(greenTokenAsDrawn.tokenValue, 'the theme must have put the token on :root').not.toBe('');
    expect(
      bandBackgroundFromTheTheme,
      'the band must be drawn with the theme’s --flag-green-background, not a colour of its own',
    ).toBe(greenTokenAsDrawn.colourAsDrawn);
    expect(bandBackgroundAfterTheChange, 'a token changed on :root must reach the band').toBe(
      'rgb(0, 107, 45)',
    );
  });
});
