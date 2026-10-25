/**
 * Sessions board screenshots on two stages (packages/graphics/sessions-board, Playwright)
 *
 * What this module is for:
 *   The board's look in Ardósia, pinned by screenshots of the built preview.html at
 *   1920x1080 on the design's grey and black stages, against the baselines beside this file.
 *   The design they must match is docs/design/directions/ardosia/sessions-board.html
 *   (screenshots/sessions-board.grey.jpg and .black.jpg): Sunday's six slots at 09:20, the
 *   alignment in progress.
 *
 * What these tests prove:
 *   - The board draws like its baselines on both stages.
 *   - It is --board-width (1280 px) wide and centred; the alignment's row reads
 *     "EM ANDAMENTO".
 *
 * What these tests deliberately do not cover:
 *   - Motion; sessionsBoardLifecycle.e2e.ts. After a deliberate visual change, refresh the
 *     baselines with `pnpm --filter @bajaovrlay/sessions-board test:e2e --update-snapshots`.
 */
import { expect, type Page, test } from '@playwright/test';

/** Sunday 30 March 2025 at a time of day in Brasília, in ms. */
function atSundayBrasiliaTime(hoursAndMinutes: string): number {
  return Date.parse(`2025-03-30T${hoursAndMinutes}:00.000-03:00`);
}

/** The preview's address for a stage, with the design's Sunday as data. */
function buildAddressOfTheDesignsSunday(stage: string): string {
  const slots: Array<[string, string, string]> = [
    ['abertura', 'Abertura do box', '07:30'],
    ['briefing', 'Briefing das equipes', '08:30'],
    ['alinhamento', 'Alinhamento do enduro', '09:15'],
    ['enduro', 'Enduro de Resistência', '10:00'],
    ['intervalo', 'Intervalo', '14:30'],
    ['premiacao', 'Cerimônia de premiação', '16:00'],
  ];
  const designsSunday = {
    title: 'PROGRAMAÇÃO DO DIA',
    eventLine: '30ª Competição Baja SAE Brasil',
    dateLine: 'domingo, 30 de março de 2025',
    slots: slots.map(([slotId, sessionName, startTime]) => ({
      slotId,
      sessionName,
      startsAtMs: atSundayBrasiliaTime(startTime),
    })),
  };
  return `preview.html?stage=${stage}&data=${encodeURIComponent(JSON.stringify(designsSunday))}`;
}

/**
 * Opens the preview on air at 09:20, the page's clock run from ten seconds before and paused
 * there once on air (GSAP reads the clock), the face loaded, the page's buttons hidden.
 */
async function openPreviewOnAirAt0920(page: Page, address: string): Promise<void> {
  await page.clock.install({ time: atSundayBrasiliaTime('09:20') - 10_000 });
  await page.goto(address);
  await expect(page.locator('body'), 'the board must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.clock.pauseAt(atSundayBrasiliaTime('09:20'));
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.locator('#preview-controls').evaluate((controls) => {
    controls.style.visibility = 'hidden';
  });
}

test.describe('the sessions board looks like its baseline', () => {
  for (const stage of ['grey', 'black'] as const) {
    test(`on the ${stage} stage`, async ({ page }) => {
      // Arrange: Sunday's board on air at 09:20.
      await openPreviewOnAirAt0920(page, buildAddressOfTheDesignsSunday(stage));

      // Act: measure the board and find the alignment's row.
      const boardBox = await page.getByTestId('sessions-board').boundingBox();
      const alignmentRow = page
        .getByTestId('sessions-board-row')
        .filter({ hasText: 'Alinhamento do enduro' });

      // Assert: centred and 1280 wide, the alignment in progress, and the look.
      expect({ left: boardBox?.x, width: boardBox?.width }, 'the narrow board, centred').toEqual({
        left: 320,
        width: 1280,
      });
      await expect(alignmentRow, 'the alignment is the pill in progress').toHaveAttribute(
        'data-slot-id',
        'alinhamento',
      );
      await expect(
        alignmentRow.getByTestId('sessions-board-pill'),
        'its mark says so',
      ).toHaveAttribute('data-status', 'inProgress');
      await expect(page, `the board must look like its baseline on ${stage}`).toHaveScreenshot(
        `sessions-board-${stage}.png`,
        { maxDiffPixelRatio: 0.01 },
      );
    });
  }
});
