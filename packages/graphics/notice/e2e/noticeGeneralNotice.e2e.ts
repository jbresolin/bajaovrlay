/**
 * A general notice, about no car, on two stages (packages/graphics/notice, Playwright)
 *
 * What this module is for:
 *   A notice typed in "+ Evento" may be about the event itself, with no car or team:
 *   "Largada adiada em 15 minutos" (BAJAOVRLAY-67). The card must then be the head (the
 *   triangle, AVISO and DIREÇÃO DE PROVA) and the text only: no empty car chip, no empty
 *   team line, no gap where they would be. These screenshots pin that look over the
 *   design's grey and black stages, with a short text and a long one (which scrolls in its
 *   box and is held at its start for the capture, BAJAOVRLAY-55).
 *
 * What these tests prove:
 *   - On each stage, a short and a long general notice draw like their baselines.
 *   - No chip and no team are drawn, and the card is head and one text row: 104 px.
 *
 * What these tests deliberately do not cover:
 *   - Which parts the writer hides; noticeView.test.ts.
 *   - A notice about a car; noticeScreenshots.e2e.ts and noticeOptionalFields.e2e.ts.
 *   - Other operating systems: baselines are rendered on Linux (CI). After a deliberate
 *     visual change, refresh them with
 *     `pnpm --filter @bajaovrlay/notice test:e2e --update-snapshots`.
 */
import { textTokensHoldingAtTheStart } from '@bajaovrlay/graphics-kit/scrollingTextInTheBrowser.testSupport';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides.testSupport';
import { expect, type Page, test } from '@playwright/test';

/** Opens the preview on a stage with the data, on air, the font loaded. */
async function openPreviewOnAirOnStage(
  page: Page,
  stage: 'grey' | 'black',
  noticeData: Record<string, unknown>,
): Promise<void> {
  // A text too long for the panel is held at its start, so no scroll lands in a capture.
  await placeTokenOverridesBeforeTheGraphicLoads(page, textTokensHoldingAtTheStart);
  await page.goto(
    `preview.html?stage=${stage}&data=${encodeURIComponent(JSON.stringify(noticeData))}`,
  );
  await expect(page.locator('body'), 'the notice must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

const textScenarios = [
  // The brief's own example, well within the panel.
  { slug: 'curto', reason: 'Largada adiada em 15 minutos' },
  // A long notice the race direction might read out: it scrolls inside its box.
  {
    slug: 'longo',
    reason:
      'Pista liberada para o treino livre a partir das 14h30; equipes devem aguardar a ordem do fiscal no box',
  },
];

for (const stage of ['grey', 'black'] as const) {
  test.describe(`a general notice on the ${stage} stage`, () => {
    for (const { slug, reason } of textScenarios) {
      test(`with a ${slug === 'curto' ? 'short' : 'long'} text`, async ({ page }) => {
        // Arrange: a notice typed about the event itself, no car, no team.
        const generalNotice = { variant: 'penalty', noticeKind: 'notice', reason };

        // Act: open the preview on air with it.
        await openPreviewOnAirOnStage(page, stage, generalNotice);

        // Assert: no chip and no team; the card head and one row; the look pinned.
        await expect(page.getByTestId('notice-car-number'), 'no car, no chip').toBeHidden();
        await expect(page.getByTestId('notice-team'), 'no team, no team line').toBeHidden();
        const cardPlace = await page.getByTestId('notice-panel').boundingBox();
        expect(cardPlace?.height, 'the card must be head and one text row, 104 px').toBe(104);
        await expect(page, `the general notice must look like its baseline on ${stage}`).toHaveScreenshot(
          `notice-aviso-geral-${slug}-${stage}.png`,
        );
      });
    }
  });
}
