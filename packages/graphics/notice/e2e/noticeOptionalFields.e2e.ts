/**
 * A notice with its optional fields left out (packages/graphics/notice, Playwright)
 *
 * What this module is for:
 *   An event often knows only some of a notice's fields (the positions carry no lap
 *   number for a best lap; an incident has no penalty yet). Every optional field left
 *   out must leave a clean card: no empty box, no empty row, the card simply shorter.
 *   noticeView.test.ts proves which parts are hidden; these tests look at the drawn card
 *   in Chromium, from preview.html?data=… with the theme loaded.
 *
 * What these tests prove:
 *   - A fastest lap with only the car and the team shows no VOLTA caption, no school and
 *     no time, and the card is head and one row: 104 px (48 + 56).
 *   - A penalty with no reason and no penalty text has no reason row: 104 px too.
 *   - A penalty with only the car shows the chip alone under the head, and looks exactly
 *     like its baseline.
 *   - A penalty whose reason is long pushes the navy cell to a second line instead of
 *     cutting the reason or overflowing the card.
 *
 * What these tests deliberately do not cover:
 *   - The complete cards; noticeScreenshots.e2e.ts pins both variants with every field.
 */
import { expect, type Page, test } from '@playwright/test';

import { buildPreviewAddressWithData } from './previewAddress.js';

/** Opens the preview with the data, waits for the play-in to finish and for the font. */
async function openPreviewOnAir(page: Page, noticeData: Record<string, unknown>): Promise<void> {
  await page.goto(buildPreviewAddressWithData(noticeData));
  await expect(page.locator('body'), 'the notice must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

test.describe('a notice with optional fields left out', () => {
  test('a fastest lap with only the car and the team shows no lap, no school and no time', async ({
    page,
  }) => {
    // Arrange: car 31's fastest lap as an event that knows only the car and the team.
    const sparseFastestLap = { variant: 'fastestLap', carNumber: 31, teamName: 'Acauã Baja' };

    // Act: open the preview on air with it.
    await openPreviewOnAir(page, sparseFastestLap);

    // Assert: the badge, the chip and the team show; the missing parts do not; the card
    // is head and one row.
    await expect(page.getByTestId('notice-best-lap-badge'), 'the badge must show').toBeVisible();
    await expect(page.getByTestId('notice-team-name'), 'the team must show').toHaveText(
      'Acauã Baja',
    );
    await expect(page.getByTestId('notice-head-caption'), 'no lap, no caption').toBeHidden();
    await expect(page.getByTestId('notice-school-name'), 'no school, no school').toBeHidden();
    await expect(page.getByTestId('notice-lap-time'), 'no time, no time').toBeHidden();
    await expect(
      page.getByTestId('notice-reason-row'),
      'a fastest lap has no reason row',
    ).toBeHidden();
    const cardPlace = await page.getByTestId('notice-panel').boundingBox();
    expect(cardPlace?.height, 'the card must be head and one row, 104 px').toBe(104);
  });

  test('a penalty with no reason and no penalty text has no reason row', async ({ page }) => {
    // Arrange: an incident involving car 47, nothing decided yet.
    const bareIncident = {
      variant: 'penalty',
      carNumber: 47,
      teamName: 'Carnaúba Baja',
      schoolName: 'UFERSA',
      noticeKind: 'incident',
    };

    // Act: open the preview on air with it.
    await openPreviewOnAir(page, bareIncident);

    // Assert: the kind word reads INCIDENTE and the card stops after the car row.
    await expect(page.getByTestId('notice-kind-word'), 'the kind must show').toHaveText(
      'INCIDENTE',
    );
    await expect(page.getByTestId('notice-reason-row'), 'no reason, no row').toBeHidden();
    const cardPlace = await page.getByTestId('notice-panel').boundingBox();
    expect(cardPlace?.height, 'the card must be head and one row, 104 px').toBe(104);
  });

  test('a penalty with only the car shows the chip alone, like its baseline', async ({ page }) => {
    // Arrange: a penalty on car 47 that names nothing else.
    const carOnlyPenalty = { variant: 'penalty', carNumber: 47 };

    // Act: open the preview on air with it.
    await openPreviewOnAir(page, carOnlyPenalty);

    // Assert: no team block, and the card matches its baseline (1% tolerance for
    // anti-aliasing, as the other screenshots).
    await expect(page.getByTestId('notice-team'), 'no team, no team block').toBeHidden();
    await expect(
      page.getByTestId('notice-panel'),
      'a car-only penalty must look exactly like its baseline',
    ).toHaveScreenshot('notice-penalty-car-only.png', { maxDiffPixelRatio: 0.01 });
  });

  test('a long reason pushes the penalty cell to a second line inside the card', async ({
    page,
  }) => {
    // Arrange: a penalty whose reason does not leave room for the cell beside it.
    const longReasonPenalty = {
      variant: 'penalty',
      carNumber: 47,
      teamName: 'Carnaúba Baja',
      schoolName: 'UFERSA',
      reason: 'Conduta antidesportiva',
      penaltyText: 'Bandeira preta',
    };

    // Act: open the preview on air with it, and measure the reason, the cell and the card.
    await openPreviewOnAir(page, longReasonPenalty);
    const reasonPlace = await page.getByTestId('notice-reason').boundingBox();
    const penaltyPlace = await page.getByTestId('notice-penalty').boundingBox();
    const cardPlace = await page.getByTestId('notice-panel').boundingBox();

    // Assert: the cell sits below the reason, and inside the card on the right.
    expect(penaltyPlace?.y, 'the cell must be on a line below the reason').toBeGreaterThan(
      (reasonPlace?.y ?? 0) + (reasonPlace?.height ?? 0) - 1,
    );
    expect(
      (penaltyPlace?.x ?? 0) + (penaltyPlace?.width ?? 0),
      'the cell must end inside the card',
    ).toBeLessThanOrEqual((cardPlace?.x ?? 0) + (cardPlace?.width ?? 0));
  });
});
