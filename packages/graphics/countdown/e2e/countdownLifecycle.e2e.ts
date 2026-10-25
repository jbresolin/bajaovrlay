/**
 * The countdown driven like a renderer (packages/graphics/countdown, Playwright)
 *
 * What this module is for:
 *   An OGraf renderer finds a graphic by its manifest, imports "main", registers its
 *   default export and calls load, playAction, updateAction, stopAction and dispose. These
 *   tests do exactly that against the BUILT graphic (dist/), served under
 *   /graphics/countdown/, in Chromium, with the page's clock set by the test.
 *
 * What these tests prove:
 *   - The built dist/ works: manifest, module and styles load; every call answers 200 in
 *     order and play reports step 0; the card is invisible before play, in after it, out
 *     after stop.
 *   - The count runs on air in the real browser: with the page's clock at 09:36:15 it reads
 *     23:45, and after five seconds of that clock 23:40, read web-first (the page is
 *     polled, never slept on; the clock is the page's, run by the test).
 *
 * What these tests deliberately do not cover:
 *   - The real BajaOvrLay renderer (apps/renderer); the e2e walk of apps/control does.
 *   - The look; countdownScreenshots.e2e.ts.
 */
import { expect, type Page, test } from '@playwright/test';

/** 09:36:15 on Sunday 30 March 2025 in Brasília: 23:45 before the enduro's start. */
const designsMomentMs = Date.parse('2025-03-30T09:36:15.000-03:00');

/** The enduro's start. */
const enduroStartsAtMs = Date.parse('2025-03-30T10:00:00.000-03:00');

/**
 * Opens the graphic's folder and, inside the page, does what a renderer does: the motion
 * tokens on :root, the manifest read, "main" imported, its default export registered and
 * one element put on the page.
 */
async function loadGraphicFromItsManifestLikeARenderer(page: Page): Promise<string> {
  // The page's clock runs from ten seconds before the design's moment: GSAP reads it, so a
  // frozen clock would never end a play-in.
  await page.clock.install({ time: designsMomentMs - 10_000 });
  await page.goto('countdown.ograf.json');
  return page.evaluate(async () => {
    document.documentElement.style.setProperty('--motion-in', '400ms');
    document.documentElement.style.setProperty('--motion-out', '250ms');
    document.documentElement.style.setProperty('--motion-in-offset', '20');
    const manifestResponse = await fetch('countdown.ograf.json');
    const manifest = (await manifestResponse.json()) as { id: string; main: string };
    const graphicModule = (await import(new URL(manifest.main, location.href).href)) as {
      default: CustomElementConstructor;
    };
    customElements.define('baja-countdown', graphicModule.default);
    document.body.append(document.createElement('baja-countdown'));
    return manifest.id;
  });
}

/** Reads the count on the page, inside the graphic's shadow root. */
function readCountOnThePage(page: Page): Promise<string | undefined> {
  return page.evaluate(
    () =>
      document
        .querySelector('baja-countdown')
        ?.shadowRoot?.querySelector('[data-testid="countdown-count"]')?.textContent ?? undefined,
  );
}

test.describe('the countdown driven like a renderer', () => {
  test('resolves load, play, update, stop and dispose in order, coming in and going out', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest into a page.
    const manifestId = await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: the whole lifecycle, each call awaited, noting the answers and the card's opacity.
    const lifecycle = await page.evaluate(async (startsAtMs) => {
      type ActionAnswer = { statusCode: number; currentStep?: number };
      type OGrafAction = (params: object) => Promise<ActionAnswer>;
      const graphic = document.querySelector('baja-countdown') as HTMLElement &
        Record<'load' | 'playAction' | 'updateAction' | 'stopAction' | 'dispose', OGrafAction>;
      const readCardOpacity = () => {
        const panel = graphic.shadowRoot?.querySelector('[data-testid="countdown-panel"]');
        return panel ? Number(getComputedStyle(panel).opacity) : -1;
      };
      const answers: unknown[] = [];
      const loadAnswer = await graphic.load({
        data: { layout: 'card', sessionName: 'Enduro de Resistência', startsAtMs },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      answers.push({ action: 'load', ...loadAnswer });
      const opacityBeforePlay = readCardOpacity();
      answers.push({ action: 'play', ...(await graphic.playAction({})) });
      const opacityWhenPlayResolved = readCardOpacity();
      answers.push({
        action: 'update',
        ...(await graphic.updateAction({ data: { sessionName: 'Super Prime' } })),
      });
      answers.push({ action: 'stop', ...(await graphic.stopAction({})) });
      const opacityWhenStopResolved = readCardOpacity();
      answers.push({ action: 'dispose', ...(await graphic.dispose({})) });
      return { answers, opacityBeforePlay, opacityWhenPlayResolved, opacityWhenStopResolved };
    }, enduroStartsAtMs);

    // Assert: the manifest read, every call 200 in order, the card in and out.
    expect(manifestId, 'the renderer read the built manifest').toBe('baja-countdown');
    expect(lifecycle.answers, 'each call resolves in order with 200').toEqual([
      { action: 'load', statusCode: 200 },
      { action: 'play', statusCode: 200, currentStep: 0 },
      { action: 'update', statusCode: 200 },
      { action: 'stop', statusCode: 200 },
      { action: 'dispose', statusCode: 200 },
    ]);
    expect(lifecycle.opacityBeforePlay, 'invisible until play').toBe(0);
    expect(lifecycle.opacityWhenPlayResolved, 'in when play resolves').toBe(1);
    expect(lifecycle.opacityWhenStopResolved, 'out when stop resolves').toBe(0);
  });

  test('counts on air: 23:45 at 09:36:15, 23:40 five seconds of the clock later', async ({
    page,
  }) => {
    // Arrange: the built graphic on the page, loaded and played at 09:36:15.
    await loadGraphicFromItsManifestLikeARenderer(page);
    await page.evaluate(async (startsAtMs) => {
      type OGrafAction = (params: object) => Promise<unknown>;
      const graphic = document.querySelector('baja-countdown') as HTMLElement &
        Record<'load' | 'playAction', OGrafAction>;
      await graphic.load({
        data: { layout: 'card', sessionName: 'Enduro de Resistência', startsAtMs },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      await graphic.playAction({});
    }, enduroStartsAtMs);
    await page.clock.pauseAt(designsMomentMs + 500);
    const countAtTheMoment = await readCountOnThePage(page);

    // Act: five seconds of the page's clock run, frames and all.
    await page.clock.runFor(5000);

    // Assert: the count read 23:45, and became 23:40 on a later frame.
    expect(countAtTheMoment, 'the count at 09:36:15').toBe('23:45');
    await expect
      .poll(() => readCountOnThePage(page), { message: 'the count follows the clock on air' })
      .toBe('23:40');
  });
});
