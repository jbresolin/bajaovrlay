/**
 * The intermission board driven like a renderer (packages/graphics/intermission-board,
 * Playwright)
 *
 * What this module is for:
 *   A renderer finds the graphic by its manifest, imports "main", registers its default
 *   export and calls load, playAction, updateAction, stopAction and dispose. These tests do
 *   that against the BUILT graphic (dist/), served under /graphics/intermission-board/, in
 *   Chromium.
 *
 * What these tests prove:
 *   - The built dist/ works; every call answers 200 in order, play reports step 0; a
 *     broken logo address blocks nothing; the head is invisible before play, in after it,
 *     out after stop; an update that adds the top five on air draws it.
 *
 * What these tests deliberately do not cover:
 *   - The count and the line's turns over time; the component tests under fake time.
 *   - The look; intermissionBoardScreenshots.e2e.ts.
 */
import { expect, type Page, test } from '@playwright/test';

/**
 * Opens the folder and does what a renderer does: the motion tokens on :root, the manifest
 * read, "main" imported and registered, one element put on the page.
 */
async function loadGraphicFromItsManifestLikeARenderer(page: Page): Promise<string> {
  await page.goto('intermission-board.ograf.json');
  return page.evaluate(async () => {
    document.documentElement.style.setProperty('--motion-in', '400ms');
    document.documentElement.style.setProperty('--motion-out', '250ms');
    document.documentElement.style.setProperty('--motion-in-offset', '20');
    const manifest = (await (await fetch('intermission-board.ograf.json')).json()) as {
      id: string;
      main: string;
    };
    const graphicModule = (await import(new URL(manifest.main, location.href).href)) as {
      default: CustomElementConstructor;
    };
    customElements.define('baja-intermission-board', graphicModule.default);
    document.body.append(document.createElement('baja-intermission-board'));
    return manifest.id;
  });
}

test.describe('the intermission board driven like a renderer', () => {
  test('resolves load, play, update, stop and dispose in order, coming in and going out', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest into a page.
    const manifestId = await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: the whole lifecycle, each call awaited, noting the answers, the head's opacity,
    // and whether the top five came in with the update.
    const lifecycle = await page.evaluate(async () => {
      type OGrafAction = (params: object) => Promise<{ statusCode: number; currentStep?: number }>;
      const graphic = document.querySelector('baja-intermission-board') as HTMLElement &
        Record<'load' | 'playAction' | 'updateAction' | 'stopAction' | 'dispose', OGrafAction>;
      const readPart = (testId: string) =>
        graphic.shadowRoot?.querySelector(`[data-testid="${testId}"]`) ?? undefined;
      const readHeadOpacity = () => {
        const head = readPart('intermission-head');
        return head ? Number(getComputedStyle(head).opacity) : -1;
      };
      const answers: unknown[] = [];
      answers.push({
        action: 'load',
        ...(await graphic.load({
          data: {
            nextSessionName: 'Enduro de Resistência',
            nextStartsAtMs: Date.now() + 3_600_000,
            sponsors: [
              {
                name: 'Bosch',
                level: 'diamante',
                logoUrl: '/media/logo-que-nao-existe',
                logoOnLightPlate: true,
                rollWeight: 10,
              },
            ],
          },
          renderType: 'realtime',
          renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
        })),
      });
      const opacityBeforePlay = readHeadOpacity();
      answers.push({ action: 'play', ...(await graphic.playAction({})) });
      const opacityWhenPlayResolved = readHeadOpacity();
      answers.push({
        action: 'update',
        ...(await graphic.updateAction({
          data: {
            topFive: [
              { rank: 1, carNumber: 2, teamName: 'Baja UFMG', schoolName: 'UFMG', points: 921.8 },
            ],
          },
        })),
      });
      const isTopFiveDrawn = readPart('intermission-top-five') !== undefined;
      answers.push({ action: 'stop', ...(await graphic.stopAction({})) });
      const opacityWhenStopResolved = readHeadOpacity();
      answers.push({ action: 'dispose', ...(await graphic.dispose({})) });
      return {
        answers,
        opacityBeforePlay,
        opacityWhenPlayResolved,
        opacityWhenStopResolved,
        isTopFiveDrawn,
      };
    });

    // Assert: the manifest read, every call 200 in order, the head in and out, the update drawn.
    expect(manifestId, 'the renderer read the built manifest').toBe('baja-intermission-board');
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
    expect(lifecycle.isTopFiveDrawn, 'the top five came in on air').toBe(true);
  });
});
