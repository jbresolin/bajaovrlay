/**
 * The page hold of the lower strip and the message ticker (packages/graphics/kit)
 *
 * What this module is for:
 *   Both bars turn a page every `--motion-strip-hold` (7 s in Ardósia). The hold is read
 *   from the theme on the page before every wait, and a missing token must never make the
 *   pages flip every frame.
 *
 * What these tests prove:
 *   - With the theme's token on the page, the hold is the token's value.
 *   - Without it, the hold is Ardósia's 7 s, never 0.
 *
 * What these tests deliberately do not cover:
 *   - Reading the token itself; packages/theme tests readMotionTokens.
 *   - The timer that waits the hold; pageTurner.test.ts.
 */
import { describe, expect, it, onTestFinished } from 'vitest';

import { readStripHoldMs } from './stripPageHold.js';

describe('readStripHoldMs', () => {
  it('reads --motion-strip-hold from the page', () => {
    // Arrange: a bar on a page whose theme shortens the hold to 3 s (the motion demo's).
    const bar = document.createElement('section');
    bar.style.setProperty('--motion-strip-hold', '3000ms');
    document.body.append(bar);
    onTestFinished(() => bar.remove());

    // Act: read the hold.
    const holdMs = readStripHoldMs(bar);

    // Assert: the token's value.
    expect(holdMs, 'the hold must be the theme’s').toBe(3000);
  });

  it('holds 7 s when the theme is not on the page', () => {
    // Arrange: a bar on a page with no theme.
    const bar = document.createElement('section');
    document.body.append(bar);
    onTestFinished(() => bar.remove());

    // Act: read the hold.
    const holdMs = readStripHoldMs(bar);

    // Assert: Ardósia's 7 s, never 0.
    expect(holdMs, 'a missing token must not make the pages flip every frame').toBe(7000);
  });
});
