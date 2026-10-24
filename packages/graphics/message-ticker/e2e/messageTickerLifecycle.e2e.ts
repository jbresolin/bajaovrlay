/**
 * Message ticker lifecycle, driven like a renderer (packages/graphics/message-ticker, Playwright)
 *
 * What this module is for:
 *   An OGraf renderer finds a graphic by its manifest, imports the module named in "main",
 *   registers its default export as a custom element and then calls load, playAction,
 *   updateAction, stopAction and dispose on it. These tests do exactly that against the
 *   BUILT graphic (dist/), served under /graphics/message-ticker/ as the server will serve
 *   it, in Chromium (the engine inside OBS), with the motion tokens on the page.
 *
 * What these tests prove:
 *   - The built dist/ works from /graphics/message-ticker/: manifest, module and styles load.
 *   - load → play → update → stop → dispose each resolve, in that order, with 200; play
 *     reports step 0; the ticker comes in and goes out.
 *   - On air the clock block counts by itself, frame after frame.
 *   - A turn in Chromium moves both messages at once: part way through, the next is rising
 *     while the first is still there, fading.
 *
 * What these tests deliberately do not cover:
 *   - The real BajaOvrLay renderer (apps/renderer); the steps above are done by hand,
 *     following the OGraf v1 spec.
 *   - The longest message fitting the bar; messageTickerHoldsTheLongest.e2e.ts. The look;
 *     messageTickerScreenshots.e2e.ts.
 */
import { expect, type Page, test } from '@playwright/test';

/**
 * Opens the graphic's folder and, inside the page, does what a renderer does: put the
 * motion tokens on :root, read the manifest, import "main", register the default export
 * and put one element on the page. Returns the manifest's id.
 */
async function loadGraphicFromItsManifestLikeARenderer(page: Page): Promise<string> {
  await page.goto('message-ticker.ograf.json');
  return page.evaluate(async () => {
    // The renderer page links the theme's tokens.css; here the motion values the test
    // watches are placed by hand, with the Ardósia values.
    const motionTokens: Record<string, string> = {
      '--motion-in': '400ms',
      '--motion-out': '250ms',
      '--motion-row-stagger': '30ms',
      '--motion-strip-page': '300ms',
      '--motion-page-stagger': '15ms',
      '--motion-strip-hold': '7000ms',
      '--motion-in-offset': '20',
    };
    for (const [tokenName, value] of Object.entries(motionTokens)) {
      document.documentElement.style.setProperty(tokenName, value);
    }
    const manifestResponse = await fetch('message-ticker.ograf.json');
    const manifest = (await manifestResponse.json()) as { id: string; main: string };
    const graphicModuleAddress = new URL(manifest.main, location.href).href;
    const graphicModule = (await import(graphicModuleAddress)) as {
      default: CustomElementConstructor;
    };
    customElements.define('baja-message-ticker', graphicModule.default);
    document.body.append(document.createElement('baja-message-ticker'));
    return manifest.id;
  });
}

/** Three announcements and a clock running from 1:00:00 now (the test's clock is the page's). */
function buildThreeMessagesWithARunningClock() {
  return {
    label: 'AVISO',
    messages: [
      'Largada do enduro às 10h00',
      'Box aberto para abastecimento',
      'Premiação às 16h no palco principal',
    ],
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_600_000,
    referenceWallClockMs: Date.now(),
    running: true,
  };
}

test.describe('the message ticker driven like a renderer', () => {
  test('resolves load, play, update, stop and dispose in order, coming in and going out', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest into a page.
    const manifestId = await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: go through the whole lifecycle, waiting for each call before the next, and
    // note each answer and how visible the page cell is.
    const lifecycle = await page.evaluate(async (data) => {
      type ActionAnswer = { statusCode: number; currentStep?: number };
      type OGrafAction = (params: object) => Promise<ActionAnswer>;
      type OGrafGraphic = HTMLElement & {
        load: OGrafAction;
        playAction: OGrafAction;
        updateAction: OGrafAction;
        stopAction: OGrafAction;
        dispose: OGrafAction;
      };
      const graphic = document.querySelector('baja-message-ticker') as OGrafGraphic;
      const answers: { action: string; statusCode: number; currentStep?: number }[] = [];
      const readPageCellOpacity = () => {
        const pageCell = graphic.shadowRoot?.querySelector(
          '[data-testid="message-ticker-page-cell"]',
        );
        return pageCell ? Number(getComputedStyle(pageCell).opacity) : -1;
      };

      const loadAnswer = await graphic.load({
        data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      answers.push({ action: 'load', statusCode: loadAnswer.statusCode });
      const opacityBeforePlay = readPageCellOpacity();
      const playAnswer = await graphic.playAction({});
      const opacityWhenPlayResolved = readPageCellOpacity();
      answers.push({ action: 'play', ...playAnswer });
      const updateAnswer = await graphic.updateAction({ data: { state: 'yellow' } });
      answers.push({ action: 'update', statusCode: updateAnswer.statusCode });
      const stopAnswer = await graphic.stopAction({});
      const opacityWhenStopResolved = readPageCellOpacity();
      answers.push({ action: 'stop', statusCode: stopAnswer.statusCode });
      const disposeAnswer = await graphic.dispose({});
      answers.push({ action: 'dispose', statusCode: disposeAnswer.statusCode });
      return { answers, opacityBeforePlay, opacityWhenPlayResolved, opacityWhenStopResolved };
    }, buildThreeMessagesWithARunningClock());

    // Assert: the manifest was read, every call resolved in order with 200, play reported
    // step 0, and the ticker came in and went out.
    expect(manifestId, 'the renderer must have read the built manifest').toBe(
      'baja-message-ticker',
    );
    expect(lifecycle.answers, 'each call must resolve in order with 200').toEqual([
      { action: 'load', statusCode: 200 },
      { action: 'play', statusCode: 200, currentStep: 0 },
      { action: 'update', statusCode: 200 },
      { action: 'stop', statusCode: 200 },
      { action: 'dispose', statusCode: 200 },
    ]);
    expect(lifecycle.opacityBeforePlay, 'a loaded ticker must be invisible until play').toBe(0);
    expect(lifecycle.opacityWhenPlayResolved, 'play must resolve once the ticker is in').toBe(1);
    expect(lifecycle.opacityWhenStopResolved, 'stop must resolve once the ticker is out').toBe(0);
  });

  test('counts the clock block by itself on air', async ({ page }) => {
    // Arrange: the built graphic on air with a running clock.
    await loadGraphicFromItsManifestLikeARenderer(page);
    const timeOnAir = await page.evaluate(async (data) => {
      type OGrafAction = (params: object) => Promise<unknown>;
      const graphic = document.querySelector('baja-message-ticker') as HTMLElement & {
        load: OGrafAction;
        playAction: OGrafAction;
      };
      await graphic.load({
        data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      await graphic.playAction({ skipAnimation: true });
      return graphic.shadowRoot?.querySelector('[data-testid="clock-block-time"]')?.textContent;
    }, buildThreeMessagesWithARunningClock());

    // Act and assert: poll the time until the frame loop has moved it (never a fixed wait).
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              document
                .querySelector('baja-message-ticker')
                ?.shadowRoot?.querySelector('[data-testid="clock-block-time"]')?.textContent,
          ),
        { message: 'the clock block must count by itself on air' },
      )
      .not.toBe(timeOnAir);
  });

  test('turns the message in place, both messages moving at once', async ({ page }) => {
    // Arrange: the built graphic on air with three messages.
    await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: start a turn and look at the bar 150 ms into the 300 ms turn.
    const halfWay = await page.evaluate(async (data) => {
      type OGrafAction = (params: object) => Promise<unknown>;
      const graphic = document.querySelector('baja-message-ticker') as HTMLElement & {
        load: OGrafAction;
        playAction: OGrafAction;
        turnToTheNextPageNow: () => Promise<void>;
      };
      await graphic.load({
        data,
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      await graphic.playAction({ skipAnimation: true });
      const pendingTurn = graphic.turnToTheNextPageNow();
      // A fixed wait only to look inside a motion of known length, never to wait for it.
      await new Promise((resolve) => setTimeout(resolve, 150));
      const pills = [
        ...(graphic.shadowRoot?.querySelectorAll<HTMLElement>(
          '[data-testid="message-ticker-message"]',
        ) ?? []),
      ];
      const opacities = pills.map((pill) => Number(getComputedStyle(pill).opacity));
      await pendingTurn;
      return { pillCount: pills.length, opacities };
    }, buildThreeMessagesWithARunningClock());

    // Assert: both message pills are moving: the old fading, the new rising.
    expect(halfWay.pillCount, 'two message pills').toBe(2);
    expect(
      halfWay.opacities.every((opacity) => opacity > 0 && opacity < 1),
      'half way both messages are moving, the old out and the new in',
    ).toBe(true);
  });
});
