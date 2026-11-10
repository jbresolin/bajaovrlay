/**
 * "A seguir" card screenshots: with and without logos, started, and the longest names, on
 * two stages (packages/graphics/bracket-match-card, Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so how the card looks is pinned by
 *   screenshots of the built preview.html (the theme's tokens, as the renderer page loads
 *   them) at 1920x1080, on the design's grey and black stages, compared with the
 *   baselines stored next to this file (BAJAOVRLAY-65).
 *
 * What these tests prove:
 *   - The second semifinal "a seguir" with both teams' logos, with none (each side shows
 *     its car-number chip), with one; and once it has started (1 × 0): each like its
 *     baseline.
 *   - A team logo that fails to load: that side shows its car-number chip, never a broken
 *     image, like its baseline.
 *   - Two of the longest team names of the event fit their side: each name and details
 *     line stays inside its box (it scrolls on air, at rest in the shot), and the card
 *     keeps its width, the lower third's widest, measured.
 *   - An empty "a seguir" played on air leaves the stage empty.
 *
 * What these tests deliberately do not cover:
 *   - Motion and the scroll itself; the shots show the end of the play-in, texts at rest.
 *     The kit's scrolling tests cover the scroll.
 *   - Other operating systems: baselines are rendered on Linux (CI). After a deliberate
 *     visual change, refresh them with
 *     `pnpm --filter @bajaovrlay/bracket-match-card test:e2e --update-snapshots`.
 */
import { expect, type Page, test } from '@playwright/test';

/** Opens the preview on air and hides its buttons, which are not on air. */
async function openPreviewOnAir(page: Page, address: string): Promise<void> {
  await page.goto(address);
  await expect(page.locator('body'), 'the card must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.locator('#preview-controls').evaluate((controls) => {
    controls.style.visibility = 'hidden';
  });
}

/** The left, right and width of one part of the card, read from its box. */
async function measurePart(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  const left = box?.x ?? 0;
  const width = box?.width ?? 0;
  return { left, right: left + width, width };
}

const lookScenarios = [
  // Both logos: the card as the design means it.
  { slug: 'com-logos', match: 'logos' },
  // No logo at all: each side's car-number chip in its place.
  { slug: 'sem-logos', match: 'no-logos' },
  // One team with a logo, the other without.
  { slug: 'um-logo', match: 'one-logo' },
  // Started: the score between the teams.
  { slug: 'iniciada-1x0', match: 'started' },
];

for (const stage of ['grey', 'black'] as const) {
  test.describe(`the "a seguir" card on the ${stage} stage`, () => {
    for (const scenario of lookScenarios) {
      test(`draws the card ${scenario.slug} like its baseline`, async ({ page }) => {
        // Arrange: the preview on air with this sample match.
        await openPreviewOnAir(page, `preview.html?stage=${stage}&match=${scenario.match}`);

        // Act: nothing more; the card is on air.

        // Assert: its look against the baseline. A 1% pixel tolerance absorbs
        // anti-aliasing between GPU drivers.
        await expect(
          page,
          `the card ${scenario.slug} must look like its baseline`,
        ).toHaveScreenshot(`match-card-${scenario.slug}-${stage}.png`, {
          maxDiffPixelRatio: 0.01,
        });
      });
    }

    test('shows the car-number chip in place of a logo that fails to load', async ({ page }) => {
      // Arrange: the preview on air, Corisco's logo at an address that serves nothing.
      await openPreviewOnAir(page, `preview.html?stage=${stage}&match=broken-logo`);

      // Act: nothing more; the card is on air once its images have settled.

      // Assert: Corisco's chip and no broken image on the left, Cactus's logo on the right,
      // and the look against the baseline.
      await expect(
        page.getByTestId('match-card-chip-a'),
        'the car-number chip must stand in for the broken logo',
      ).toHaveText('32');
      await expect(
        page.getByTestId('match-card-logo-a'),
        'no broken image may stay on the card',
      ).toHaveCount(0);
      await expect(page.getByTestId('match-card-logo-b'), "Cactus's logo stays").toBeVisible();
      await expect(page, 'the broken logo must look like its baseline').toHaveScreenshot(
        `match-card-logo-quebrado-${stage}.png`,
        { maxDiffPixelRatio: 0.01 },
      );
    });

    test("keeps the longest names inside their sides at the lower third's width", async ({
      page,
    }) => {
      // Arrange: the third place between two of the longest team names of the event.
      await openPreviewOnAir(page, `preview.html?stage=${stage}&match=longest-names`);

      // Act: measure the card, each side and each name.
      const card = await measurePart(page, 'match-card-panel');
      const sideA = await measurePart(page, 'match-card-side-a');
      const nameA = await measurePart(page, 'match-card-team-a');
      const sideB = await measurePart(page, 'match-card-side-b');
      const nameB = await measurePart(page, 'match-card-team-b');

      // Assert: the card is the lower third's widest (1300 px from x 96), each name box
      // inside its side, and the look against the baseline.
      expect({ left: card.left, width: card.width }, 'the card keeps its width').toEqual({
        left: 96,
        width: 1300,
      });
      expect(nameA.right, "car A's name must stay inside its side").toBeLessThanOrEqual(
        sideA.right,
      );
      expect(nameB.left, "car B's name must stay inside its side").toBeGreaterThanOrEqual(
        sideB.left,
      );
      await expect(page, 'the longest names must look like their baseline').toHaveScreenshot(
        `match-card-nomes-longos-${stage}.png`,
        { maxDiffPixelRatio: 0.01 },
      );
    });

    test('shows nothing on air for an empty "a seguir"', async ({ page }) => {
      // Arrange: the preview playing an empty match.
      await openPreviewOnAir(page, `preview.html?stage=${stage}&match=empty`);

      // Act: nothing more; the card is on air with no match.

      // Assert: no team drawn, and the stage alone in the shot.
      await expect(
        page.getByTestId('match-card-team-a'),
        'an empty "a seguir" must draw no team',
      ).toHaveCount(0);
      await expect(page, 'an empty "a seguir" must leave the stage empty').toHaveScreenshot(
        `match-card-vazio-${stage}.png`,
        { maxDiffPixelRatio: 0.01 },
      );
    });
  });
}
