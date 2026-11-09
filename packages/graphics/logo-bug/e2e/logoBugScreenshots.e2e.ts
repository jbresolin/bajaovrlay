/**
 * Logo bug screenshots: each corner, the smallest and largest height, half opacity and a
 * missing image, on two stages (packages/graphics/logo-bug, Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so where the logo sits and how it looks
 *   are pinned by screenshots of the built preview.html (the theme's tokens, as the
 *   renderer page loads them) at 1920x1080, on the design's grey and black stages,
 *   compared with the baselines stored next to this file. The white Baja SAE Brasil mark
 *   stands in for a channel's logo.
 *
 * What these tests prove:
 *   - Each corner holds the logo on the title-safe edges the other graphics keep
 *     (x 96..1824, y 54..1026), measured, and looks like its baseline.
 *   - The smallest (32 px) and largest (200 px) heights draw the logo that tall, and 50%
 *     opacity draws it see-through, each like its baseline.
 *   - A logo whose image is missing at load, played anyway, leaves its corner empty: the
 *     baseline has no broken-image icon in it.
 *   - A logo on air whose image is swapped for a missing file answers 422 and keeps the
 *     old logo in its corner: a failure never blanks what is on air.
 *
 * What these tests deliberately do not cover:
 *   - Motion; the shots show the end of the fade in (logoBugLifecycle.e2e.ts covers it).
 *   - Other operating systems: baselines are rendered on Linux (CI). After a deliberate
 *     visual change, refresh them with
 *     `pnpm --filter @bajaovrlay/logo-bug test:e2e --update-snapshots`.
 */
import { expect, type Page, test } from '@playwright/test';

/** Opens the preview on air and waits for the logo's file (never a timer); hides the buttons. */
async function openPreviewOnAirWithTheLogoLoaded(page: Page, address: string): Promise<void> {
  await page.goto(address);
  await expect(page.locator('body'), 'the logo must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.waitForFunction(() => {
    const logoBug = document.querySelector('baja-logo-bug');
    const image = logoBug?.shadowRoot?.querySelector('img');
    return image !== null && image !== undefined && image.complete && image.naturalWidth > 0;
  });
  // The preview's own buttons are not on air.
  await page.locator('#preview-controls').evaluate((controls) => {
    controls.style.visibility = 'hidden';
  });
}

/** The panel's edges on the 1920x1080 page, read from its box. */
async function measureThePanel(page: Page) {
  const box = await page.getByTestId('logo-bug-panel').boundingBox();
  const left = box?.x ?? 0;
  const top = box?.y ?? 0;
  return { left, top, right: left + (box?.width ?? 0), bottom: top + (box?.height ?? 0) };
}

const cornerScenarios = [
  // The sponsor bug's corner: left edge 96, top edge 54.
  {
    corner: 'top-left',
    edges: (panel: PanelEdges) => ({ left: panel.left, top: panel.top }),
    expected: { left: 96, top: 54 },
  },
  // The clock's corner: right edge 1824, top edge 54.
  {
    corner: 'top-right',
    edges: (panel: PanelEdges) => ({ right: panel.right, top: panel.top }),
    expected: { right: 1824, top: 54 },
  },
  // Above the bars' bottom edge, on the left: left 96, bottom 1026.
  {
    corner: 'bottom-left',
    edges: (panel: PanelEdges) => ({ left: panel.left, bottom: panel.bottom }),
    expected: { left: 96, bottom: 1026 },
  },
  // The default corner: right 1824, bottom 1026.
  {
    corner: 'bottom-right',
    edges: (panel: PanelEdges) => ({ right: panel.right, bottom: panel.bottom }),
    expected: { right: 1824, bottom: 1026 },
  },
] as const;

type PanelEdges = Awaited<ReturnType<typeof measureThePanel>>;

const lookScenarios = [
  // The smallest height the brief allows: still a readable mark.
  { slug: 'altura-32', query: '&height=32', expectedHeight: 32 },
  // The largest: the most of the picture a logo may cover.
  { slug: 'altura-200', query: '&height=200', expectedHeight: 200 },
  // Half opacity, at the default 80 px: the picture shows through.
  { slug: 'opacidade-50', query: '&opacity=50', expectedHeight: 80 },
];

for (const stage of ['grey', 'black'] as const) {
  test.describe(`the logo bug on the ${stage} stage`, () => {
    for (const scenario of cornerScenarios) {
      test(`sits on the safe edges in the ${scenario.corner} corner`, async ({ page }) => {
        // Arrange: the preview on air in this corner at the default 80 px.
        await openPreviewOnAirWithTheLogoLoaded(
          page,
          `preview.html?stage=${stage}&corner=${scenario.corner}`,
        );

        // Act: measure the panel.
        const panel = await measureThePanel(page);

        // Assert: the two safe edges of the corner, and its look against the baseline. A 1%
        // pixel tolerance absorbs anti-aliasing between GPU drivers.
        expect(
          scenario.edges(panel),
          `the logo must sit on the ${scenario.corner} safe edges`,
        ).toEqual(scenario.expected);
        await expect(
          page,
          `the ${scenario.corner} logo must look like its baseline`,
        ).toHaveScreenshot(`logo-bug-${scenario.corner}-${stage}.png`, { maxDiffPixelRatio: 0.01 });
      });
    }

    for (const scenario of lookScenarios) {
      test(`draws the ${scenario.slug} logo like its baseline`, async ({ page }) => {
        // Arrange: the preview on air bottom-right with the row's height or opacity.
        await openPreviewOnAirWithTheLogoLoaded(
          page,
          `preview.html?stage=${stage}${scenario.query}`,
        );

        // Act: measure the panel.
        const panel = await measureThePanel(page);

        // Assert: as tall as the row asks, and its look against the baseline.
        expect(
          panel.bottom - panel.top,
          `the logo must be ${scenario.expectedHeight} px high`,
        ).toBe(scenario.expectedHeight);
        await expect(
          page,
          `the ${scenario.slug} logo must look like its baseline`,
        ).toHaveScreenshot(`logo-bug-${scenario.slug}-${stage}.png`, { maxDiffPixelRatio: 0.01 });
      });
    }

    test('leaves its corner empty, with no broken-image icon, when the image is missing at load', async ({
      page,
    }) => {
      // Arrange: the preview loading an address with no file behind it; its load answers
      // 422, so the preview does not play it.
      await page.goto(`preview.html?stage=${stage}&image=missing`);
      await expect(page.locator('body'), 'the 422 must end the preview in error').toHaveAttribute(
        'data-preview-state',
        'error',
      );
      await page.locator('#preview-controls').evaluate((controls) => {
        controls.style.visibility = 'hidden';
      });

      // Act: play it anyway, as a renderer could, so the shot shows the corner on air.
      const answer = await page.evaluate(async () => {
        type LogoBugElement = HTMLElement & {
          playAction: (params: object) => Promise<{ statusCode: number }>;
        };
        const logoBug = document.querySelector('baja-logo-bug') as LogoBugElement;
        return logoBug.playAction({ skipAnimation: true });
      });

      // Assert: on air, no image element in the panel, and the stage alone in the shot.
      expect(answer.statusCode, 'the empty logo must still play').toBe(200);
      await expect(
        page.getByTestId('logo-bug-image'),
        'a missing image must leave no image element',
      ).toHaveCount(0);
      await expect(page, 'a missing image must leave the corner empty').toHaveScreenshot(
        `logo-bug-imagem-ausente-${stage}.png`,
        { maxDiffPixelRatio: 0.01 },
      );
    });

    test('keeps the old logo in its corner when the image goes missing on air', async ({
      page,
    }) => {
      // Arrange: the mark on air in the default corner.
      await openPreviewOnAirWithTheLogoLoaded(page, `preview.html?stage=${stage}`);

      // Act: swap the image for an address with no file behind it, as a renderer would.
      const answer = await page.evaluate(async () => {
        type LogoBugElement = HTMLElement & {
          updateAction: (params: object) => Promise<{ statusCode: number }>;
        };
        const logoBug = document.querySelector('baja-logo-bug') as LogoBugElement;
        return logoBug.updateAction({ data: { logoUrl: '/media/logo-que-nao-existe' } });
      });

      // Assert: a 422, one image left (the old one), and the mark still in the shot.
      expect(answer.statusCode, 'a missing image must answer 422').toBe(422);
      await expect(
        page.getByTestId('logo-bug-image'),
        'only the old logo must be left',
      ).toHaveCount(1);
      await expect(page, 'the old logo must still be on air').toHaveScreenshot(
        `logo-bug-imagem-ausente-mantem-anterior-${stage}.png`,
        { maxDiffPixelRatio: 0.01 },
      );
    });
  });
}
