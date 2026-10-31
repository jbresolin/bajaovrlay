/**
 * The timings of a scrolling text, read from the theme (packages/graphics/kit)
 *
 * What this module is for:
 *   A text too long for its box holds, scrolls, holds and crossfades back by the theme's
 *   `--motion-text-*` tokens, which João tunes on screen. A missing or broken token must
 *   never give a speed of 0 (a text that never reaches its end) nor holds of 0 (a text
 *   that never rests long enough to read), so each one falls back to Ardósia's value.
 *
 * What these tests prove:
 *   - With the tokens on the page, the timings are the tokens' values.
 *   - Without them, each timing is Ardósia's starting value, never 0.
 *   - A token that is not a positive number falls back alone; the others are kept.
 *
 * What these tests deliberately do not cover:
 *   - Parsing the token text itself (`2500ms`, `2.5s`); packages/theme tests readMotionTokens.
 */
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  readScrollingTextTimings,
  scrollingTextTimingsWhenTokensMissing,
} from './scrollingTextTimings.js';

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

describe('readScrollingTextTimings', () => {
  it('reads the five tokens the theme sets', () => {
    // Arrange: a theme João tuned slower: 3 s at the start, 45 px/s, 2 s at the end.
    const element = createElementWithTokens({
      '--motion-text-hold-start': '3s',
      '--motion-text-scroll-speed': '45',
      '--motion-text-hold-end': '2000ms',
      '--motion-text-return': '300ms',
      '--motion-text-edge-fade': '32',
    });

    // Act: read the timings.
    const timings = readScrollingTextTimings(element);

    // Assert: every timing is the token's value.
    expect(timings, 'each timing must be read from its token').toEqual({
      holdStartMs: 3000,
      scrollSpeedPxPerSecond: 45,
      holdEndMs: 2000,
      returnMs: 300,
      edgeFadePx: 32,
    });
  });

  it("gives Ardósia's starting values when the theme is missing", () => {
    // Arrange: a page with no theme at all.
    const element = createElementWithTokens({});

    // Act: read the timings.
    const timings = readScrollingTextTimings(element);

    // Assert: the fallbacks, which are the brief's starting values, none of them 0.
    expect(timings, 'without a theme the timings must be the starting values').toEqual(
      scrollingTextTimingsWhenTokensMissing,
    );
    expect(scrollingTextTimingsWhenTokensMissing, 'the starting values of the brief').toEqual({
      holdStartMs: 2500,
      scrollSpeedPxPerSecond: 60,
      holdEndMs: 1500,
      returnMs: 250,
      edgeFadePx: 24,
    });
  });

  it('falls back for a broken token alone and keeps the others', () => {
    // Arrange: a typo in the speed, a speed of 0 would freeze every long name at its start.
    const element = createElementWithTokens({
      '--motion-text-hold-start': '4000ms',
      '--motion-text-scroll-speed': 'rápido',
      '--motion-text-hold-end': '1500ms',
      '--motion-text-return': '250ms',
      '--motion-text-edge-fade': '24',
    });

    // Act: read the timings.
    const timings = readScrollingTextTimings(element);

    // Assert: the speed falls back to 60 px/s, the tuned hold is kept.
    expect(timings.scrollSpeedPxPerSecond, 'a broken speed must fall back to 60 px/s').toBe(60);
    expect(timings.holdStartMs, 'the other tokens must still be read').toBe(4000);
  });
});
