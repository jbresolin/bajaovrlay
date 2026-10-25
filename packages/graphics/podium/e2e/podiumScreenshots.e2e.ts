/**
 * Podium screenshots on the design's grey and black stages (packages/graphics/podium,
 * Playwright)
 *
 * What this module is for:
 *   The reviewer cannot run OBS while reading a PR, so the look of the podium in Ardósia is
 *   pinned by screenshots of preview.html?stage=… (the theme's tokens and font loaded as on
 *   air) at 1920×1080, compared against the baselines stored next to this file. The design
 *   they must match, side by side: docs/design/directions/ardosia/podium-passo-1.html,
 *   -2.html and -3.html, and their screenshots/*.grey.jpg and *.black.jpg (PR #21).
 *
 * What these tests prove, on the grey (#7f7f7f) and the black (#0a0a0a) stage each:
 *   - Step 1: the head card ("PÓDIO", "ENDURO DE RESISTÊNCIA", "1/3") and Pato Baja's card
 *     at the right, its logo on the light plate; the two other places invisible.
 *   - Step 2: Equipe Komiketo Baja's card at the left too, "2/3".
 *   - Step 3: Sinuelo's taller card in the middle, its logo on the panel and its "1º" on
 *     the green chip, "3/3".
 *   - In every shot the revealed cards stand where the design draws them: 480 px wide, 20 px apart,
 *     centred, on the title-safe bottom edge (y 1026), 460 px tall and the winner's 540.
 *
 * What these tests deliberately do not cover:
 *   - Motion; the shots show the end of each step's rise.
 *   - The footage of the design's frame-1 shots; the grey and black stages are compared.
 *   - Other operating systems: baselines are rendered on Linux. After a deliberate visual
 *     change, refresh them with `pnpm --filter @bajaovrlay/podium test:e2e --update-snapshots`.
 */
import { expect, type Page, test } from '@playwright/test';

/** Waits until the last preview action has answered with the podium on air. */
async function waitUntilOnAir(page: Page): Promise<void> {
  await expect(page.locator('body'), 'the podium must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
}

/** Opens the preview's sample podium on the stage and waits for the head and the font. */
async function openPreviewOnAir(page: Page, stage: string): Promise<void> {
  await page.goto(`preview.html?stage=${stage}`);
  await waitUntilOnAir(page);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** Presses Próximo and waits for the step's rise to end. */
async function pressNext(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Próximo' }).click();
  await waitUntilOnAir(page);
}

/** Hides the preview's buttons, which are not on air. */
async function hidePreviewControls(page: Page): Promise<void> {
  await page.locator('#preview-controls').evaluate((controls) => {
    controls.style.display = 'none';
  });
}

/** The box of the card of one slot, rounded to whole pixels, edges named. */
async function measureCardOfSlot(page: Page, slot: string) {
  const box = await page.locator(`[data-testid="podium-card"][data-slot="${slot}"]`).boundingBox();
  return {
    left: Math.round(box?.x ?? 0),
    right: Math.round((box?.x ?? 0) + (box?.width ?? 0)),
    top: Math.round(box?.y ?? 0),
    bottom: Math.round((box?.y ?? 0) + (box?.height ?? 0)),
  };
}

// The design's places: three 480 px cards 20 px apart, centred on 1920 (220..1700), on the
// title-safe bottom (y 1026); the side cards 460 px tall, the winner's 540.
const designCardBoxes = {
  second: { left: 220, right: 700, top: 566, bottom: 1026 },
  first: { left: 720, right: 1200, top: 486, bottom: 1026 },
  third: { left: 1220, right: 1700, top: 566, bottom: 1026 },
};

const steps = [
  // podium-passo-1: the 3rd place alone.
  { step: 1, page: 'podium-passo-1', revealedSlots: ['third'] },
  // podium-passo-2: the 3rd and the 2nd.
  { step: 2, page: 'podium-passo-2', revealedSlots: ['third', 'second'] },
  // podium-passo-3: all three.
  { step: 3, page: 'podium-passo-3', revealedSlots: ['third', 'second', 'first'] },
] as const;

const stages = ['grey', 'black'];

test.describe('the podium looks like its baselines', () => {
  for (const { step, page: designPage, revealedSlots } of steps) {
    for (const stage of stages) {
      test(`step ${String(step)} (${designPage}) on the ${stage} stage`, async ({ page }) => {
        // Arrange: the preview on air, Próximo pressed up to the step, its buttons hidden.
        await openPreviewOnAir(page, stage);
        for (let press = 0; press < step; press += 1) {
          await pressNext(page);
        }
        await hidePreviewControls(page);

        // Act: measure the revealed cards on the stage (a hidden one waits below its place,
        // ready to rise).
        const cardBoxes: Record<string, unknown> = {};
        const designBoxesOfTheRevealed: Record<string, unknown> = {};
        for (const slot of revealedSlots) {
          cardBoxes[slot] = await measureCardOfSlot(page, slot);
          designBoxesOfTheRevealed[slot] = designCardBoxes[slot];
        }

        // Assert: the revealed cards stand where the design draws them, and the whole
        // stage matches its baseline. A 1% pixel tolerance absorbs anti-aliasing
        // between GPU drivers without letting a colour or a text change through.
        expect(cardBoxes, 'the revealed cards must stand where the design draws them').toEqual(
          designBoxesOfTheRevealed,
        );
        await expect(page, `the podium at step ${String(step)} (${stage})`).toHaveScreenshot(
          `podium-step-${String(step)}-${stage}.png`,
          { maxDiffPixelRatio: 0.01 },
        );
      });
    }
  }
});
