/**
 * The hold between standings pages (packages/graphics/standings)
 *
 * What this module is for:
 *   standingsPageHold.ts reads how long a page stays on air, `--motion-board-hold`, which
 *   the page timer reads before every hold.
 *
 * What these tests prove:
 *   - The token is followed (Ardósia's 10 s, or a test's shorter value).
 *   - A missing token gives 10 s, never 0: a 0 ms hold would turn the page every frame.
 *
 * What these tests deliberately do not cover:
 *   - The timer itself; the kit's pageTurner tests it, and standings.test.ts turns real
 *     pages with it.
 */
import { describe, expect, it } from 'vitest';

import { placeTokensOnTheRoot } from './standingsOnThePage.testSupport.js';
import { readBoardHoldMs } from './standingsPageHold.js';

describe('readBoardHoldMs', () => {
  it('follows --motion-board-hold', () => {
    // Arrange: a 2.5 s hold on :root, as a test or a theme change would set it.
    placeTokensOnTheRoot({ '--motion-board-hold': '2500ms' });

    // Act: read the hold from the page.
    const holdMs = readBoardHoldMs(document.body);

    // Assert: the token's value.
    expect(holdMs, 'the hold must be the token’s').toBe(2500);
  });

  it('holds 10 s when the token is missing, never 0', () => {
    // Arrange: no token on :root.

    // Act: read the hold.
    const holdMs = readBoardHoldMs(document.body);

    // Assert: Ardósia's 10 s.
    expect(holdMs, 'a missing hold must fall back to 10 s').toBe(10_000);
  });
});
