/**
 * The page after the one on air (packages/graphics/kit)
 *
 * What this module is for:
 *   The tower, the standings, the lower strip and the message ticker cycle through their
 *   pages the same way, so the rule is written once: the next page, and page 1 after the
 *   last.
 *
 * What these tests prove:
 *   - Mid-cycle the next page; after the last page, page 1; with one page, page 1 again.
 *
 * What these tests deliberately do not cover:
 *   - When pages turn; pageTurner.ts and each graphic's page turns.
 */
import { describe, expect, it } from 'vitest';

import { chooseNextPageInCycle } from './pageCycle.js';

describe('chooseNextPageInCycle', () => {
  const nextPageScenarios = [
    // Mid-cycle: the next page.
    { name: 'goes from page 1 to page 2 of three', currentPage: 1, pageCount: 3, expected: 2 },
    // The last page wraps around to the first.
    { name: 'goes from page 3 of three back to page 1', currentPage: 3, pageCount: 3, expected: 1 },
    // One page only: the "next" page is the same one.
    {
      name: 'stays on page 1 when there is only one page',
      currentPage: 1,
      pageCount: 1,
      expected: 1,
    },
  ];

  it.each(nextPageScenarios)('$name', ({ currentPage, pageCount, expected }) => {
    // Arrange: the page on air and the page count of this row.

    // Act: choose the page that comes next.
    const nextPage = chooseNextPageInCycle(currentPage, pageCount);

    // Assert: what this row expects.
    expect(nextPage, 'the next page must follow the cycle and wrap around').toBe(expected);
  });
});
