/**
 * Lower third lifecycle, driven like a renderer (packages/graphics/lower-third, Playwright)
 *
 * What this module is for:
 *   An OGraf renderer finds a graphic by its manifest, imports the module named in
 *   "main", registers its default export as a custom element and then calls load,
 *   playAction, updateAction, stopAction and dispose on it. These tests do exactly that
 *   against the BUILT graphic (dist/), served under /graphics/lower-third/ as the server
 *   will serve it, in Chromium (the engine inside OBS), with the motion tokens on the page.
 *
 * What these tests prove:
 *   - The built dist/ works from /graphics/lower-third/: manifest, module and styles load.
 *   - load → play → update → stop → dispose each resolve, in that order, with 200; play
 *     reports step 0.
 *   - Play brings both pills in: invisible when play starts, fully visible when play
 *     resolves. An update on air changes the role's text in place. Stop takes both out:
 *     invisible when stop resolves.
 *   - The role pill really comes in behind the name pill: 150 ms into the play-in the
 *     name pill is further in than the role pill, which started a lead (100 ms) later.
 *
 * What these tests deliberately do not cover:
 *   - The real BajaOvrLay renderer (apps/renderer); the steps above are done by hand,
 *     following the OGraf v1 spec.
 *   - What the graphic looks like; lowerThirdScreenshots.e2e.ts covers that.
 */
import { expect, type Page, test } from '@playwright/test';

/**
 * Opens the graphic's folder and, inside the page, does what a renderer does: put the
 * theme's motion tokens on :root, read the manifest, import "main", register the default
 * export and put one element on the page. Returns the manifest's id so the test can check
 * it was really read.
 */
async function loadGraphicFromItsManifestLikeARenderer(page: Page): Promise<string> {
  await page.goto('lower-third.ograf.json');
  return page.evaluate(async () => {
    // The renderer page links the theme's tokens.css; here the motion tokens the test
    // watches are placed by hand, with the Ardósia values.
    document.documentElement.style.setProperty('--motion-in', '400ms');
    document.documentElement.style.setProperty('--motion-out', '250ms');
    document.documentElement.style.setProperty('--motion-lead', '100ms');
    document.documentElement.style.setProperty('--motion-in-offset', '20');
    const manifestResponse = await fetch('lower-third.ograf.json');
    const manifest = (await manifestResponse.json()) as { id: string; main: string };
    const graphicModuleAddress = new URL(manifest.main, location.href).href;
    const graphicModule = (await import(graphicModuleAddress)) as {
      default: CustomElementConstructor;
    };
    customElements.define('baja-lower-third', graphicModule.default);
    document.body.append(document.createElement('baja-lower-third'));
    return manifest.id;
  });
}

test.describe('the lower third driven like a renderer', () => {
  test('resolves load, play, update, stop and dispose in order, coming in and going out', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest into a page.
    const manifestId = await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: go through the whole lifecycle, waiting for each call before the next, and
    // note each answer, the role shown, and how visible the pills are at each moment.
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
      const graphic = document.querySelector('baja-lower-third') as OGrafGraphic;
      const answers: { action: string; statusCode: number; currentStep?: number }[] = [];
      const findPart = (testId: string) =>
        graphic.shadowRoot?.querySelector(`[data-testid="${testId}"]`);
      const readPillOpacities = () =>
        ['lower-third-name-pill', 'lower-third-role-pill'].map((testId) => {
          const pill = findPart(testId);
          return pill ? Number(getComputedStyle(pill).opacity) : -1;
        });

      const loadAnswer = await graphic.load({
        data: { name: 'Ana Paula Ribeiro', role: 'Narradora' },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      answers.push({ action: 'load', statusCode: loadAnswer.statusCode });
      const opacitiesBeforePlay = readPillOpacities();
      const playAnswer = await graphic.playAction({});
      const opacitiesWhenPlayResolved = readPillOpacities();
      answers.push({ action: 'play', ...playAnswer });
      const updateAnswer = await graphic.updateAction({ data: { role: 'Comentarista' } });
      const roleAfterUpdate = findPart('lower-third-role')?.textContent;
      answers.push({ action: 'update', statusCode: updateAnswer.statusCode });
      const stopAnswer = await graphic.stopAction({});
      const opacitiesWhenStopResolved = readPillOpacities();
      answers.push({ action: 'stop', statusCode: stopAnswer.statusCode });
      const disposeAnswer = await graphic.dispose({});
      answers.push({ action: 'dispose', statusCode: disposeAnswer.statusCode });
      return {
        answers,
        roleAfterUpdate,
        opacitiesBeforePlay,
        opacitiesWhenPlayResolved,
        opacitiesWhenStopResolved,
      };
    });

    // Assert: the manifest was read, every call resolved in order with 200, play
    // reported step 0, the pills came in, the role changed in place, and stop took
    // both pills out.
    expect(manifestId, 'the renderer must have read the built manifest').toBe('baja-lower-third');
    expect(lifecycle.answers, 'each call must resolve in order with 200').toEqual([
      { action: 'load', statusCode: 200 },
      { action: 'play', statusCode: 200, currentStep: 0 },
      { action: 'update', statusCode: 200 },
      { action: 'stop', statusCode: 200 },
      { action: 'dispose', statusCode: 200 },
    ]);
    expect(lifecycle.opacitiesBeforePlay, 'a loaded lower third must be invisible').toEqual([0, 0]);
    expect(lifecycle.opacitiesWhenPlayResolved, 'play must resolve once both pills are in').toEqual(
      [1, 1],
    );
    expect(lifecycle.roleAfterUpdate, 'the update must change the role on air').toBe(
      'Comentarista',
    );
    expect(lifecycle.opacitiesWhenStopResolved, 'stop must resolve once both are out').toEqual([
      0, 0,
    ]);
  });

  test('brings the role pill in behind the name pill, a lead later', async ({ page }) => {
    // Arrange: the built graphic, loaded from its manifest with a name and a role.
    await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: start play and look at both pills 150 ms into the 500 ms play-in.
    const partWay = await page.evaluate(async () => {
      type OGrafAction = (params: object) => Promise<{ statusCode: number }>;
      type OGrafGraphic = HTMLElement & { load: OGrafAction; playAction: OGrafAction };
      const graphic = document.querySelector('baja-lower-third') as OGrafGraphic;
      await graphic.load({
        data: { name: 'Ana Paula Ribeiro', role: 'Narradora' },
        renderType: 'realtime',
        renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
      });
      const readOpacity = (testId: string) => {
        const pill = graphic.shadowRoot?.querySelector(`[data-testid="${testId}"]`);
        return pill ? Number(getComputedStyle(pill).opacity) : -1;
      };
      const pendingPlay = graphic.playAction({});
      await new Promise((resolve) => setTimeout(resolve, 150));
      const nameOpacity = readOpacity('lower-third-name-pill');
      const roleOpacity = readOpacity('lower-third-role-pill');
      await pendingPlay;
      return { nameOpacity, roleOpacity };
    });

    // Assert: the name pill is coming in, and the role pill, started later, is behind it.
    expect(partWay.nameOpacity, 'part way the name pill must be fading in').toBeGreaterThan(0);
    expect(
      partWay.roleOpacity,
      'part way the role pill must be behind the name pill, since it starts a lead later',
    ).toBeLessThan(partWay.nameOpacity);
  });
});
