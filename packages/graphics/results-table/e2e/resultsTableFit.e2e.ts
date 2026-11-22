/**
 * The results table fits its columns at 1920 wide (packages/graphics/results-table,
 * Playwright)
 *
 * What this module is for:
 *   A result page brings its own columns, as many as the site shows (BAJAOVRLAY-83). The
 *   board measures each column's widest text in its own font and gives it that width, the
 *   team the rest. This is the real thing in Chromium at the size OBS draws it, on the two
 *   pages of João's screenshots: the overall page during spoilers (POS, Nº, EQUIPE and seven
 *   columns) and a qualifying page (POS, Nº, EQUIPE and six columns).
 *
 * What these tests prove, on both pages:
 *   - Every pill stays inside the board's title-safe width, x 96..1824.
 *   - Every cell of the page's columns, and every caption, shows its whole text: nothing is
 *     cut, so nothing needs to scroll.
 *   - Each caption sits over its column: the same left and right edges as the first row's
 *     cell under it.
 *   - The widths come from the content: the team column keeps at least 600 px, and a
 *     column of short values ("Larga em", "1º") is narrower than one of long ones
 *     ("Classificado (≤115%)").
 *
 * What these tests deliberately do not cover:
 *   - A page whose columns would need more than the board's share: unit-tested in
 *     resultsTableColumnWidths.test.ts (the columns narrowed together, the text scrolling).
 *   - The look itself: resultsTableScreenshots.e2e.ts.
 */
import { buildPreviewAddressWithData } from '@bajaovrlay/graphics-kit/previewAddress.testSupport';
import { textTokensHoldingAtTheStart } from '@bajaovrlay/graphics-kit/scrollingTextInTheBrowser.testSupport';
import { placeTokenOverridesBeforeTheGraphicLoads } from '@bajaovrlay/graphics-kit/tokenOverrides.testSupport';
import { expect, type Page, test } from '@playwright/test';

import { createOverallPageDuringSpoilers, createQualifyingPage } from '../src/previewData.js';

/** Opens the preview on air with a page, no page turn and no scroll by itself. */
async function openPageOnAir(page: Page, data: Record<string, unknown>): Promise<void> {
  await placeTokenOverridesBeforeTheGraphicLoads(page, {
    '--motion-board-hold': '600000ms',
    ...textTokensHoldingAtTheStart,
  });
  await page.goto(buildPreviewAddressWithData(data));
  await expect(page.locator('body'), 'the results table must be on air').toHaveAttribute(
    'data-preview-state',
    'onAir',
  );
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** The left and right edge of one element, and whether its text is cut. */
type MeasuredBox = { left: number; right: number; isTextCut: boolean; text: string };

/**
 * Measures, inside the graphic's shadow root, every pill, every caption and cell of the
 * page's columns, and the first row's team cell.
 */
async function measureTheTable(page: Page) {
  return page.locator('baja-results-table').evaluate((graphic) => {
    const root = graphic.shadowRoot as ShadowRoot;
    const measure = (element: Element) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        isTextCut: element.scrollWidth > element.clientWidth + 1,
        text: element.textContent ?? '',
      };
    };
    const pills = [...root.querySelectorAll('.column-head, .row-pill')].map(measure);
    const captions = [...root.querySelectorAll('[data-testid="column-caption"]')].map(measure);
    const firstRowCells = [
      ...(root
        .querySelector('[data-testid="results-table-row"]')
        ?.querySelectorAll('[data-testid="row-value"]') ?? []),
    ].map(measure);
    const everyValueCell = [...root.querySelectorAll('[data-testid="row-value"]')].map(measure);
    const teamCell = root.querySelector('[data-testid="row-team"]');
    const teamWidth = teamCell === null ? 0 : teamCell.getBoundingClientRect().width;
    return { pills, captions, firstRowCells, everyValueCell, teamWidth };
  });
}

/** The width of the caption whose text is `head`. */
function widthOfCaption(captions: MeasuredBox[], head: string): number {
  const caption = captions.find((candidate) => candidate.text === head);
  return caption === undefined ? 0 : caption.right - caption.left;
}

const pageScenarios = [
  // The overall page during spoilers: seven columns, "SPOILERS" in two.
  {
    name: 'the overall page during spoilers',
    data: createOverallPageDuringSpoilers(),
    columnCount: 7,
  },
  // The qualifying page: six columns, the longest head of the two pages among them.
  { name: 'the qualifying page', data: createQualifyingPage(), columnCount: 6 },
];

test.describe('the results table fits its columns at 1920 wide', () => {
  for (const { name, data, columnCount } of pageScenarios) {
    test(`keeps every pill inside the board and every text whole (${name})`, async ({ page }) => {
      // Arrange: the page on air.
      await openPageOnAir(page, data);

      // Act: measure the table.
      const table = await measureTheTable(page);

      // Assert: the pills inside x 96..1824, one caption per column, nothing cut.
      for (const pill of table.pills) {
        expect(pill.left, 'a pill must start at the board’s left edge').toBeGreaterThanOrEqual(96);
        expect(pill.right, 'a pill must end inside the board').toBeLessThanOrEqual(1824);
      }
      expect(table.captions, 'one caption per column of the page').toHaveLength(columnCount);
      const captionsCut = table.captions.filter((caption) => caption.isTextCut);
      expect(captionsCut, 'no caption is cut').toEqual([]);
      const cellsCut = table.everyValueCell.filter((cell) => cell.isTextCut);
      expect(cellsCut, 'no cell of the page’s columns is cut').toEqual([]);
      expect(table.teamWidth, 'the team column keeps at least 600 px').toBeGreaterThanOrEqual(600);
    });

    test(`puts each caption over its column (${name})`, async ({ page }) => {
      // Arrange: the page on air.
      await openPageOnAir(page, data);

      // Act: measure the captions and the first row's cells.
      const table = await measureTheTable(page);

      // Assert: the same edges, to the pixel.
      table.captions.forEach((caption, columnIndex) => {
        const cell = table.firstRowCells[columnIndex];
        expect(caption.left, `caption ${caption.text} must start where its cells do`).toBeCloseTo(
          cell?.left ?? -1,
          0,
        );
        expect(caption.right, `caption ${caption.text} must end where its cells do`).toBeCloseTo(
          cell?.right ?? -1,
          0,
        );
      });
    });
  }

  test('gives a column of short values less room than one of long values', async ({ page }) => {
    // Arrange: the qualifying page on air.
    await openPageOnAir(page, createQualifyingPage());

    // Act: measure its captions.
    const table = await measureTheTable(page);

    // Assert: "Larga em" ("1º") narrower than "Classificado (≤115%)", both under the team.
    const startingPlaceWidth = widthOfCaption(table.captions, 'Larga em');
    const qualifiedWidth = widthOfCaption(table.captions, 'Classificado (≤115%)');
    expect(startingPlaceWidth, 'a column must be as wide as its content').toBeGreaterThan(0);
    expect(startingPlaceWidth, '"Larga em" must be narrower').toBeLessThan(qualifiedWidth);
    expect(qualifiedWidth, 'the team column must stay the widest').toBeLessThan(table.teamWidth);
  });
});
