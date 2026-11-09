/**
 * Super Chat card lifecycle, driven like a renderer (packages/graphics/super-chat, Playwright)
 *
 * What this module is for:
 *   An OGraf renderer finds a graphic by its manifest, imports the module named in "main",
 *   registers its default export as a custom element and then calls load, playAction,
 *   updateAction, stopAction and dispose on it. This test does exactly that against the
 *   BUILT graphic (dist/), served under /graphics/super-chat/ as the server will serve it
 *   (the server names the graphic by its folder, `super-chat`), in Chromium, the engine
 *   inside OBS.
 *
 * What these tests prove:
 *   - The built dist/ works from /graphics/super-chat/: manifest, module and styles load.
 *   - load → play → update → stop → dispose each resolve, in that order, with 200; play
 *     reports step 0.
 *   - Play brings the card in and it stays (the hold is the server's Super Chat rule);
 *     stop takes it out.
 *
 * What these tests deliberately do not cover:
 *   - The real BajaOvrLay renderer and the server's auto-out; the steps are done by hand.
 *   - The look; superChatScreenshots.e2e.ts covers it.
 */
import { expect, type Page, test } from '@playwright/test';

/**
 * Opens the graphic's folder and, inside the page, does what a renderer does: put the
 * theme's motion tokens on :root, read the manifest, import "main", register the default
 * export and put one element on the page. Returns the manifest's id.
 */
async function loadGraphicFromItsManifestLikeARenderer(page: Page): Promise<string> {
  await page.goto('super-chat.ograf.json');
  return page.evaluate(async () => {
    // The renderer page links the theme's tokens.css; here the motion lengths are placed
    // by hand, with the Ardósia values.
    document.documentElement.style.setProperty('--motion-in', '400ms');
    document.documentElement.style.setProperty('--motion-out', '250ms');
    document.documentElement.style.setProperty('--motion-in-offset', '20');
    const manifestResponse = await fetch('super-chat.ograf.json');
    const manifest = (await manifestResponse.json()) as { id: string; main: string };
    const graphicModuleAddress = new URL(manifest.main, location.href).href;
    const graphicModule = (await import(graphicModuleAddress)) as {
      default: CustomElementConstructor;
    };
    customElements.define('baja-super-chat', graphicModule.default);
    document.body.append(document.createElement('baja-super-chat'));
    return manifest.id;
  });
}

test.describe('the Super Chat card driven like a renderer', () => {
  test('resolves load, play, update, stop and dispose in order, coming in and going out', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest into a page.
    const manifestId = await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: go through the whole lifecycle, waiting for each call before the next, and note
    // each answer and how visible the card is at each moment.
    const lifecycle = await page.evaluate(async () => {
      type ActionAnswer = { statusCode: number; currentStep?: number };
      type OGrafAction = (params: object) => Promise<ActionAnswer>;
      type OGrafGraphic = HTMLElement & {
        load: OGrafAction;
        playAction: OGrafAction;
        updateAction: OGrafAction;
        stopAction: OGrafAction;
        dispose: OGrafAction;
      };
      const graphic = document.querySelector('baja-super-chat') as OGrafGraphic;
      const answers: { action: string; statusCode: number; currentStep?: number }[] = [];
      const readCardOpacity = () => {
        const panel = graphic.shadowRoot?.querySelector('[data-testid="super-chat-panel"]');
        return panel ? Number(getComputedStyle(panel).opacity) : -1;
      };

      const loadAnswer = await graphic.load({
        data: {
          amountText: 'R$ 20,00',
          authorName: 'Torcida Pequi Off-Road',
          messageText: 'Vai, Pequi! Abraço de Goiânia',
        },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      answers.push({ action: 'load', statusCode: loadAnswer.statusCode });
      const opacityBeforePlay = readCardOpacity();
      const playAnswer = await graphic.playAction({});
      const opacityWhenPlayResolved = readCardOpacity();
      answers.push({ action: 'play', ...playAnswer });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const opacityOneSecondLater = readCardOpacity();
      const updateAnswer = await graphic.updateAction({ data: { amountText: 'R$ 50,00' } });
      answers.push({ action: 'update', statusCode: updateAnswer.statusCode });
      const stopAnswer = await graphic.stopAction({});
      const opacityWhenStopResolved = readCardOpacity();
      answers.push({ action: 'stop', statusCode: stopAnswer.statusCode });
      const disposeAnswer = await graphic.dispose({});
      answers.push({ action: 'dispose', statusCode: disposeAnswer.statusCode });
      return {
        answers,
        opacityBeforePlay,
        opacityWhenPlayResolved,
        opacityOneSecondLater,
        opacityWhenStopResolved,
      };
    });

    // Assert: the manifest was read, every call resolved in order with 200, play reported
    // step 0, the card came in and stayed, and stop took it out.
    expect(manifestId, 'the renderer must have read the built manifest').toBe('baja-super-chat');
    expect(lifecycle.answers, 'each call must resolve in order with 200').toEqual([
      { action: 'load', statusCode: 200 },
      { action: 'play', statusCode: 200, currentStep: 0 },
      { action: 'update', statusCode: 200 },
      { action: 'stop', statusCode: 200 },
      { action: 'dispose', statusCode: 200 },
    ]);
    expect(lifecycle.opacityBeforePlay, 'a loaded card must be invisible until play').toBe(0);
    expect(lifecycle.opacityWhenPlayResolved, 'play must resolve once the card is in').toBe(1);
    expect(lifecycle.opacityOneSecondLater, 'the card must not leave by itself').toBe(1);
    expect(lifecycle.opacityWhenStopResolved, 'stop must resolve once the card is out').toBe(0);
  });
});
