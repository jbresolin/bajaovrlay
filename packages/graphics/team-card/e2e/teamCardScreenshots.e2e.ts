/**
 * Team card screenshots, all eight combinations on two stages (packages/graphics/team-card,
 * Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so the look of the team card in
 *   Ardósia is pinned by screenshots: the eight combinations of photo, logo and city, each
 *   on the design's grey and black stages, taken from the built preview.html (which loads
 *   the theme's tokens and font the way the renderer page does) at 1920x1080 and compared
 *   against the baselines stored next to this file. The design they must match is
 *   docs/design/directions/ardosia/team-card.html, team-card-sem-foto.html and the eight
 *   motion-team-card-*.html demos (PR #21), here with car 7, Reptiles Baja PUC-Rio.
 *
 * What these tests prove:
 *   - Each combination draws exactly like its baseline on both stages: the photo cell at
 *     the left and the logo on its light plate at the right only when present, the place
 *     line "RIO DE JANEIRO · RJ" only with the city, and no empty frame anywhere.
 *   - The card sits in the lower third's slot: left edge at x 96, bottom edge at y 940.
 *   - The card's real width is the model's frame width (teamCardModel's
 *     measureTeamCardFrameWidthPx, with the tokens read from the page) plus the text block:
 *     the unit tests' widths are the ones Chromium draws.
 *   - The images are real files of the package, loaded before the shot.
 *
 * What these tests deliberately do not cover:
 *   - Motion; the screenshots show the end of the play-in only
 *     (teamCardLifecycle.e2e.ts covers in and out).
 *   - The plate switched off; the view tests cover the class, and the preview's buttons
 *     show it by hand.
 *   - Other operating systems: baselines are rendered on Linux (CI). After a deliberate
 *     visual change, refresh them with
 *     `pnpm --filter @bajaovrlay/team-card test:e2e --update-snapshots`.
 */
import { expect, type Page, test } from '@playwright/test';

import {
  listTeamCardCells,
  measureTeamCardFrameWidthPx,
  type TeamCardSizes,
} from '../src/teamCardModel.js';

/** One combination of photo, logo and city, as the design's motion demos name them. */
type Combination = { slug: string; hasPhoto: boolean; hasLogo: boolean; hasCity: boolean };

const combinations: Combination[] = [
  // The design's team-card page: everything.
  { slug: 'com-foto-com-logo-com-cidade', hasPhoto: true, hasLogo: true, hasCity: true },
  // No place line: the text block one line shorter, the card as wide.
  { slug: 'com-foto-com-logo-sem-cidade', hasPhoto: true, hasLogo: true, hasCity: false },
  // No logo: the card ends after the text.
  { slug: 'com-foto-sem-logo-com-cidade', hasPhoto: true, hasLogo: false, hasCity: true },
  { slug: 'com-foto-sem-logo-sem-cidade', hasPhoto: true, hasLogo: false, hasCity: false },
  // No photo: the chip opens the card, the logo closes it.
  { slug: 'sem-foto-com-logo-com-cidade', hasPhoto: false, hasLogo: true, hasCity: true },
  { slug: 'sem-foto-com-logo-sem-cidade', hasPhoto: false, hasLogo: true, hasCity: false },
  // The design's team-card-sem-foto page: no media, the shorter card.
  { slug: 'sem-foto-sem-logo-com-cidade', hasPhoto: false, hasLogo: false, hasCity: true },
  // The bare card: the chip, the name and the school.
  { slug: 'sem-foto-sem-logo-sem-cidade', hasPhoto: false, hasLogo: false, hasCity: false },
];

const stages = ['grey', 'black'] as const;

/** Builds the preview address for one combination on one stage. */
function buildPreviewAddress(combination: Combination, stage: string): string {
  const searchParameters = new URLSearchParams({ stage });
  if (!combination.hasPhoto) {
    searchParameters.set('photo', 'off');
  }
  if (!combination.hasLogo) {
    searchParameters.set('logo', 'off');
  }
  if (!combination.hasCity) {
    searchParameters.set('city', 'off');
  }
  return `preview.html?${searchParameters.toString()}`;
}

/**
 * Opens the preview on air and waits for the face and for every image of the card to
 * have loaded (the image's own `complete` and a real width, never a timer).
 */
async function openPreviewOnAirWithImagesLoaded(page: Page, address: string): Promise<void> {
  await page.goto(address);
  await expect(page.locator('body'), 'the team card must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForFunction(() => {
    const teamCard = document.querySelector('baja-team-card');
    const images = [...(teamCard?.shadowRoot?.querySelectorAll('img') ?? [])];
    return images.every((image) => image.complete && image.naturalWidth > 0);
  });
}

/** Reads the four sizes the card's frame is built from, from the tokens on the page. */
async function readTeamCardSizesFromThePage(page: Page): Promise<TeamCardSizes> {
  return page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const readPixels = (tokenName: string) =>
      Number.parseFloat(rootStyle.getPropertyValue(tokenName));
    return {
      cardPaddingPx: readPixels('--space-3'),
      cellGapPx: readPixels('--space-4'),
      photoWidthPx: readPixels('--team-photo-width'),
      logoSizePx: readPixels('--team-logo-size'),
    };
  });
}

test.describe('the team card looks like its baseline', () => {
  for (const combination of combinations) {
    for (const stage of stages) {
      test(`${combination.slug} on the ${stage} stage`, async ({ page }) => {
        // Arrange: the model's frame width for this combination, from the page's tokens.
        await openPreviewOnAirWithImagesLoaded(page, buildPreviewAddress(combination, stage));
        const sizes = await readTeamCardSizesFromThePage(page);
        const cells = listTeamCardCells({
          carNumber: 7,
          teamName: 'Reptiles Baja PUC-Rio',
          schoolName: 'PUC-Rio',
          ...(combination.hasPhoto ? { carPhotoUrl: 'photo' } : {}),
          ...(combination.hasLogo ? { logoUrl: 'logo' } : {}),
          ...(combination.hasCity ? { city: 'Rio de Janeiro', state: 'RJ' } : {}),
        });
        const frameWidthPx = measureTeamCardFrameWidthPx(cells, sizes);

        // Act: hide the preview's own buttons, which are not on air, and measure the card.
        await page.locator('#preview-controls').evaluate((controls) => {
          controls.style.visibility = 'hidden';
        });
        const cardBox = await page.getByTestId('team-card-panel').boundingBox();
        const identityBox = await page.getByTestId('team-card-identity').boundingBox();

        // Assert: the card's place, its width, and its look against the baseline. A 1%
        // pixel tolerance absorbs anti-aliasing differences between GPU drivers without
        // letting a colour or text change through.
        expect(
          { left: cardBox?.x, bottom: (cardBox?.y ?? 0) + (cardBox?.height ?? 0) },
          'the card must sit in the lower third’s slot: x 96, bottom at y 940',
        ).toEqual({ left: 96, bottom: 940 });
        expect(
          Math.round(cardBox?.width ?? 0),
          'the card must be the model’s frame width plus its text block',
        ).toBe(Math.round(frameWidthPx + (identityBox?.width ?? 0)));
        await expect(
          page,
          `the team card ${combination.slug} must look exactly like its baseline on ${stage}`,
        ).toHaveScreenshot(`team-card-${combination.slug}-${stage}.png`, {
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  }
});
