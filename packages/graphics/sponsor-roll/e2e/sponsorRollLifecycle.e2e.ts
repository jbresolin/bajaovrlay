/**
 * The sponsor roll driven like a renderer (packages/graphics/sponsor-roll, Playwright)
 *
 * What this module is for:
 *   A renderer finds the graphic by its manifest, imports "main", registers its default
 *   export and calls load, playAction, updateAction, stopAction and dispose. These tests do
 *   that against the BUILT graphic (dist/), served under /graphics/sponsor-roll/, in
 *   Chromium.
 *
 * What these tests prove:
 *   - The built dist/ works; every call answers 200 in order, play reports step 0; a
 *     broken logo address blocks nothing; the head is invisible before play, in after it,
 *     out after stop.
 *   - Once on air the head reads "PATROCÍNIO DIAMANTE" and "1/2", read web-first.
 *
 * What these tests deliberately do not cover:
 *   - The page turns and the holds; sponsor-roll.test.ts proves them under fake time.
 *   - The look; sponsorRollScreenshots.e2e.ts.
 */
import { expect, type Page, test } from '@playwright/test';

/** Two Diamante sponsors and an Ouro one, their logos at addresses that do not exist. */
function buildThreeSponsors() {
  const sponsor = (name: string, level: string) => ({
    name,
    level,
    logoUrl: `/media/logo-que-nao-existe-${name.toLowerCase()}`,
    logoOnLightPlate: true,
    rollWeight: 5,
  });
  return [sponsor('Bosch', 'diamante'), sponsor('Renault', 'diamante'), sponsor('CNH', 'ouro')];
}

/**
 * Opens the folder and does what a renderer does: the motion tokens on :root, the manifest
 * read, "main" imported and registered, one element put on the page.
 */
async function loadGraphicFromItsManifestLikeARenderer(page: Page): Promise<string> {
  await page.goto('sponsor-roll.ograf.json');
  return page.evaluate(async () => {
    document.documentElement.style.setProperty('--motion-in', '400ms');
    document.documentElement.style.setProperty('--motion-out', '250ms');
    document.documentElement.style.setProperty('--motion-in-offset', '20');
    const manifest = (await (await fetch('sponsor-roll.ograf.json')).json()) as {
      id: string;
      main: string;
    };
    const graphicModule = (await import(new URL(manifest.main, location.href).href)) as {
      default: CustomElementConstructor;
    };
    customElements.define('baja-sponsor-roll', graphicModule.default);
    document.body.append(document.createElement('baja-sponsor-roll'));
    return manifest.id;
  });
}

test.describe('the sponsor roll driven like a renderer', () => {
  test('resolves load, play, update, stop and dispose in order, coming in and going out', async ({
    page,
  }) => {
    // Arrange: the built graphic, loaded from its manifest into a page.
    const manifestId = await loadGraphicFromItsManifestLikeARenderer(page);

    // Act: the whole lifecycle, each call awaited, noting the answers and the head's opacity,
    // and reading the head once on air.
    const lifecycle = await page.evaluate(async (sponsors) => {
      type OGrafAction = (params: object) => Promise<{ statusCode: number; currentStep?: number }>;
      const graphic = document.querySelector('baja-sponsor-roll') as HTMLElement &
        Record<'load' | 'playAction' | 'updateAction' | 'stopAction' | 'dispose', OGrafAction>;
      const readPart = (testId: string) =>
        graphic.shadowRoot?.querySelector(`[data-testid="${testId}"]`) ?? undefined;
      const readHeadOpacity = () => {
        const head = readPart('sponsor-roll-head');
        return head ? Number(getComputedStyle(head).opacity) : -1;
      };
      const answers: unknown[] = [];
      answers.push({
        action: 'load',
        ...(await graphic.load({
          data: { layout: 'fullscreen', sponsors },
          renderType: 'realtime',
          renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
        })),
      });
      const opacityBeforePlay = readHeadOpacity();
      answers.push({ action: 'play', ...(await graphic.playAction({})) });
      const opacityWhenPlayResolved = readHeadOpacity();
      const headOnAir = [
        readPart('sponsor-roll-subtitle')?.textContent,
        readPart('sponsor-roll-aside')?.textContent,
      ];
      answers.push({ action: 'update', ...(await graphic.updateAction({ data: { sponsors } })) });
      answers.push({ action: 'stop', ...(await graphic.stopAction({})) });
      const opacityWhenStopResolved = readHeadOpacity();
      answers.push({ action: 'dispose', ...(await graphic.dispose({})) });
      return {
        answers,
        opacityBeforePlay,
        opacityWhenPlayResolved,
        opacityWhenStopResolved,
        headOnAir,
      };
    }, buildThreeSponsors());

    // Assert: the manifest read, every call 200 in order, the head in and out and right.
    expect(manifestId, 'the renderer read the built manifest').toBe('baja-sponsor-roll');
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
    expect(lifecycle.headOnAir, 'page 1 of 2, Diamante').toEqual(['PATROCÍNIO DIAMANTE', '1/2']);
  });
});
