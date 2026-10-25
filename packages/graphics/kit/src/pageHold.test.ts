/**
 * The hold between pages (packages/graphics/kit)
 *
 * What this module is for:
 *   The strip and the ticker turn a page every `--motion-strip-hold`, the standings every
 *   `--motion-board-hold`. The hold is read from the theme on the page before every wait,
 *   and a missing token must never make the pages flip every frame.
 *
 * What these tests prove:
 *   - With the token on the page, the hold is the token's value, for either hold.
 *   - Without it, the hold is the fallback the graphic gives (7 s, 10 s), never 0.
 *
 * What these tests deliberately do not cover:
 *   - Reading the token itself; packages/theme tests readMotionTokens.
 *   - The timer that waits the hold; pageTurner.test.ts.
 */
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  boardHoldMsWhenTokenMissing,
  readHoldMsOrFallback,
  stripHoldMsWhenTokenMissing,
} from './pageHold.js';

/** Builds a graphic's element on the page, with the given tokens set on it. */
function createElementWithTokens(tokens: Record<string, string>): HTMLElement {
  const element = document.createElement('section');
  for (const [tokenName, value] of Object.entries(tokens)) {
    element.style.setProperty(tokenName, value);
  }
  document.body.append(element);
  onTestFinished(() => element.remove());
  return element;
}

describe('readHoldMsOrFallback', () => {
  const holdsWithTheirTokens = [
    // The motion demo shortens the strip's hold to 3 s.
    {
      name: 'reads --motion-strip-hold',
      tokenKey: 'stripHoldMs' as const,
      token: '--motion-strip-hold',
      value: '3000ms',
      expected: 3000,
    },
    // A test shortens the standings' hold to 2.5 s.
    {
      name: 'reads --motion-board-hold',
      tokenKey: 'boardHoldMs' as const,
      token: '--motion-board-hold',
      value: '2500ms',
      expected: 2500,
    },
  ];

  it.each(holdsWithTheirTokens)('$name', ({ tokenKey, token, value, expected }) => {
    // Arrange: an element whose theme sets this hold.
    const element = createElementWithTokens({ [token]: value });

    // Act: read the hold.
    const holdMs = readHoldMsOrFallback(element, tokenKey, 1);

    // Assert: the token's value.
    expect(holdMs, 'the hold must be the theme’s').toBe(expected);
  });

  it('gives the graphic’s fallback when the theme is not on the page, never 0', () => {
    // Arrange: an element with no theme.
    const element = createElementWithTokens({});

    // Act: read both holds with their fallbacks.
    const stripHoldMs = readHoldMsOrFallback(element, 'stripHoldMs', stripHoldMsWhenTokenMissing);
    const boardHoldMs = readHoldMsOrFallback(element, 'boardHoldMs', boardHoldMsWhenTokenMissing);

    // Assert: Ardósia's 7 s and 10 s.
    expect([stripHoldMs, boardHoldMs], 'a missing hold falls back, never to 0').toEqual([
      7000, 10_000,
    ]);
  });
});
