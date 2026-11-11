/**
 * Plain sponsor roll screenshots: each corner, the shortest and the longest level heading, a
 * logo on its light plate and one without, on two stages (packages/graphics/sponsor-roll-plain,
 * Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so where the card sits and how it looks
 *   are pinned by screenshots of the built preview.html (the theme's tokens, as the
 *   renderer page loads them) at 1920x1080, on the design's grey and black stages, compared
 *   with the baselines stored next to this file. The sponsors are the 30ª Competição's, with
 *   their real logos; one sponsor alone, so no turn comes during a shot.
 *
 * What these tests prove:
 *   - Each corner holds the card on the title-safe edges the other graphics keep
 *     (x 96..1824, y 54..1026), measured, and looks like its baseline; the card is the
 *     sponsor bug's 300 px wide.
 *   - Bosch under the longest heading, "PATROCÍNIO DIAMANTE", on the light plate; Criciúma
 *     under the shortest, "APOIO"; and Vetore's light logo with no plate: each like its
 *     baseline, the heading whole inside the card.
 *
 * What these tests deliberately do not cover:
 *   - The turns and the pass; the package's unit tests (fake time).
 *   - Motion; the shots show the end of the fade in.
 *   - Other operating systems: baselines are rendered on Linux (CI). After a deliberate
 *     visual change, refresh them with
 *     `pnpm --filter @bajaovrlay/sponsor-roll-plain test:e2e --update-snapshots`.
 */
import { expect, type Page, test } from '@playwright/test';

/** Opens the preview on air and waits for every logo's file (never a timer); hides the buttons. */
async function openPreviewOnAirWithItsLogos(page: Page, address: string): Promise<void> {
  await page.goto(address);
  await expect(page.locator('body'), 'the roll must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.waitForFunction(() => {
    const plainRoll = document.querySelector('baja-sponsor-roll-plain');
    const images = [...(plainRoll?.shadowRoot?.querySelectorAll('img') ?? [])];
    return images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0);
  });
  // The preview's own buttons are not on air.
  await page.locator('#preview-controls').evaluate((controls) => {
    controls.style.visibility = 'hidden';
  });
}

/** The card's edges on the 1920x1080 page, read from its box. */
async function measureTheCard(page: Page) {
  const box = await page.getByTestId('sponsor-roll-plain-card').boundingBox();
  const left = box?.x ?? 0;
  const top = box?.y ?? 0;
  const width = box?.width ?? 0;
  return { left, top, width, right: left + width, bottom: top + (box?.height ?? 0) };
}

type CardEdges = Awaited<ReturnType<typeof measureTheCard>>;

const cornerScenarios = [
  // The sponsor bug's corner, the default: left edge 96, top edge 54.
  {
    corner: 'top-left',
    edges: (card: CardEdges) => ({ left: card.left, top: card.top }),
    expected: { left: 96, top: 54 },
  },
  // The clock's corner: right edge 1824, top edge 54.
  {
    corner: 'top-right',
    edges: (card: CardEdges) => ({ right: card.right, top: card.top }),
    expected: { right: 1824, top: 54 },
  },
  // Above the bars' bottom edge, on the left: left 96, bottom 1026.
  {
    corner: 'bottom-left',
    edges: (card: CardEdges) => ({ left: card.left, bottom: card.bottom }),
    expected: { left: 96, bottom: 1026 },
  },
  // The channel logo's default corner: right 1824, bottom 1026.
  {
    corner: 'bottom-right',
    edges: (card: CardEdges) => ({ right: card.right, bottom: card.bottom }),
    expected: { right: 1824, bottom: 1026 },
  },
] as const;

const lookScenarios = [
  // The shortest heading of the six.
  { slug: 'nivel-curto', sponsor: 'Crici%C3%BAma', heading: 'APOIO' },
  // A light logo, which the design draws with no plate.
  { slug: 'sem-placa', sponsor: 'Vetore', heading: 'PATROCÍNIO OURO' },
];

for (const stage of ['grey', 'black'] as const) {
  test.describe(`the plain sponsor roll on the ${stage} stage`, () => {
    for (const scenario of cornerScenarios) {
      test(`sits on the safe edges in the ${scenario.corner} corner`, async ({ page }) => {
        // Arrange: Bosch alone on air in this corner: the longest heading, on the plate.
        await openPreviewOnAirWithItsLogos(
          page,
          `preview.html?stage=${stage}&sponsor=Bosch&corner=${scenario.corner}`,
        );

        // Act: measure the card.
        const card = await measureTheCard(page);

        // Assert: the two safe edges of the corner, the bug's width, the longest heading, and
        // its look against the baseline. A 1% pixel tolerance absorbs anti-aliasing.
        expect(
          scenario.edges(card),
          `the card must sit on the ${scenario.corner} safe edges`,
        ).toEqual(scenario.expected);
        expect(card.width, 'the card is the sponsor bug’s width').toBe(300);
        await expect(
          page.getByTestId('sponsor-roll-plain-heading'),
          'the longest heading, whole',
        ).toHaveText('PATROCÍNIO DIAMANTE');
        await expect(
          page,
          `the ${scenario.corner} card must look like its baseline`,
        ).toHaveScreenshot(`sponsor-roll-plain-${scenario.corner}-${stage}.png`, {
          maxDiffPixelRatio: 0.01,
        });
      });
    }

    for (const scenario of lookScenarios) {
      test(`draws the ${scenario.slug} card like its baseline`, async ({ page }) => {
        // Arrange: the row's sponsor alone on air, top-left.
        await openPreviewOnAirWithItsLogos(
          page,
          `preview.html?stage=${stage}&sponsor=${scenario.sponsor}`,
        );

        // Act: read the heading on the card.
        const heading = page.getByTestId('sponsor-roll-plain-heading');

        // Assert: the level's heading, and the look against the baseline.
        await expect(heading, 'the level’s heading').toHaveText(scenario.heading);
        await expect(
          page,
          `the ${scenario.slug} card must look like its baseline`,
        ).toHaveScreenshot(`sponsor-roll-plain-${scenario.slug}-${stage}.png`, {
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  });
}
