/**
 * The pages of the results table (packages/graphics/results-table)
 *
 * What this module is for:
 *   The table shows 20 rows a page, like the standings' overall table, with the same page
 *   line in the head (BAJAOVRLAY-83).
 *
 * What these tests prove:
 *   - 16 rows are one page, "16 EQUIPES"; 38 rows are two, "1/2 · 1º A 20º" and
 *     "2/2 · 21º A 38º", the second page holding the last 18.
 *   - A page asked past the end lands on the last page; an empty table is one page.
 *
 * What these tests deliberately do not cover:
 *   - The turn itself, on air: resultsTable.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { createEnduroPage, createQualifyingPage } from './previewData.js';
import { countResultsTablePages, layOutResultsTablePage } from './resultsTableLayout.js';

describe('layOutResultsTablePage', () => {
  it('puts 16 rows on one page and counts the teams', () => {
    // Arrange: the qualifying page's 16 rows.
    const entries = createQualifyingPage().entries;

    // Act: lay out page 1.
    const page = layOutResultsTablePage(entries, 1);

    // Assert: one page with every row, "16 EQUIPES".
    expect(
      { pageCount: page.pageCount, rowCount: page.entries.length, pageLine: page.pageLine },
      'one page of 16',
    ).toEqual({ pageCount: 1, rowCount: 16, pageLine: '16 EQUIPES' });
  });

  it('splits 38 rows into 20 and 18, with the rows each page shows in its line', () => {
    // Arrange: 26BR's Enduro, 38 rows.
    const entries = createEnduroPage().entries;

    // Act: lay out both pages.
    const firstPage = layOutResultsTablePage(entries, 1);
    const secondPage = layOutResultsTablePage(entries, 2);

    // Assert: 20 then 18, each line naming its rows.
    expect(
      [
        firstPage.entries.length,
        firstPage.pageLine,
        secondPage.entries.length,
        secondPage.pageLine,
      ],
      'two pages, 20 and 18',
    ).toEqual([20, '1/2 · 1º A 20º', 18, '2/2 · 21º A 38º']);
  });

  it('lands on the last page when asked for one past the end', () => {
    // Arrange: 26BR's Enduro, two pages.
    const entries = createEnduroPage().entries;

    // Act: ask for page 3.
    const page = layOutResultsTablePage(entries, 3);

    // Assert: page 2.
    expect(page.pageNumber, 'a list that shrank lands on its last page').toBe(2);
  });

  it('counts an empty table as one page', () => {
    // Arrange: no rows at all.

    // Act: count the pages.
    const pageCount = countResultsTablePages(0);

    // Assert: one page, so the board still has something to draw.
    expect(pageCount, 'an empty table is one page').toBe(1);
  });
});
