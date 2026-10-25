/**
 * Battle card screenshots: closing, opening and steady on two stages
 * (packages/graphics/battle-card, Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so the look of the battle card in
 *   Ardósia is pinned by screenshots: the three trends, each on the design's grey and
 *   black stages, taken from the built preview.html (which loads the theme's tokens and
 *   font the way the renderer page does) at 1920x1080 and compared against the baselines
 *   stored next to this file. The design they must match is
 *   docs/design/directions/ardosia/sheet-battle.html (the three trends, +2,0, 0,7 s) and
 *   battle-card.html (PR #21): Imperador (8) 4th ahead of Equipe FEI Baja (1) 5th.
 *
 * What these tests prove:
 *   - Each trend draws exactly like its baseline on both stages: "▸◂ FECHANDO −0,7" in
 *     green, "◂▸ ABRINDO +0,7" in the down cue's blue, "— ESTÁVEL" muted, under "+2,0".
 *   - The card sits bottom-centre: centred on x 960, bottom edge at y 940, its three
 *     pieces --battle-height (72 px) tall.
 *
 * What these tests deliberately do not cover:
 *   - Motion; the screenshots show the end of the play-in only
 *     (battleCardLifecycle.e2e.ts covers in, out and the laps).
 *   - The leader's green chip; the view tests cover the attribute.
 *   - Other operating systems: baselines are rendered on Linux (CI). After a deliberate
 *     visual change, refresh them with
 *     `pnpm --filter @bajaovrlay/battle-card test:e2e --update-snapshots`.
 */
import { expect, test } from '@playwright/test';

const trends = ['closing', 'opening', 'steady'] as const;
const stages = ['grey', 'black'] as const;

test.describe('the battle card looks like its baseline', () => {
  for (const trend of trends) {
    for (const stage of stages) {
      test(`${trend} on the ${stage} stage`, async ({ page }) => {
        // Arrange: the preview on air with this trend set by hand, its face loaded.
        await page.goto(`preview.html?stage=${stage}&trend=${trend}`);
        await expect(page.locator('body'), 'the battle card must be on air').toHaveAttribute(
          'data-preview-state',
          'onAir',
        );
        await page.evaluate(() => document.fonts.ready.then(() => undefined));

        // Act: hide the preview's own buttons, which are not on air, and measure the card.
        await page.locator('#preview-controls').evaluate((controls) => {
          controls.style.visibility = 'hidden';
        });
        const cardBox = await page.getByTestId('battle-card').boundingBox();
        const carAheadBox = await page.getByTestId('battle-card-ahead').boundingBox();

        // Assert: the place, the pill height, and the look against the baseline. A 1%
        // pixel tolerance absorbs anti-aliasing differences between GPU drivers without
        // letting a colour or text change through.
        const cardCentre = (cardBox?.x ?? 0) + (cardBox?.width ?? 0) / 2;
        expect(
          {
            centre: Math.round(cardCentre),
            bottom: Math.round((cardBox?.y ?? 0) + (cardBox?.height ?? 0)),
            pillHeight: Math.round(carAheadBox?.height ?? 0),
          },
          'the card must sit bottom-centre, its bottom at y 940, its pills 72 px tall',
        ).toEqual({ centre: 960, bottom: 940, pillHeight: 72 });
        await expect(
          page,
          `the battle card ${trend} must look exactly like its baseline on ${stage}`,
        ).toHaveScreenshot(`battle-card-${trend}-${stage}.png`, { maxDiffPixelRatio: 0.01 });
      });
    }
  }
});
