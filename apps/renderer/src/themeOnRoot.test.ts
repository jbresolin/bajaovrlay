// @vitest-environment jsdom
/**
 * Is the theme on the page's :root? (apps/renderer)
 *
 * What this module is for:
 *   The renderer page links the theme's tokens (`/theme/ardosia/tokens.css`) in its head,
 *   before its own script, so every graphic finds `var(--panel-base)` and the rest on
 *   :root when it loads. A graphic carries no fallback values, by design, so a page where
 *   the link failed draws unstyled graphics. `isThemeOnRoot()` is how renderer.ts notices
 *   that at start and logs it; nothing is blanked, OBS keeps drawing.
 *
 * What these tests prove:
 *   - With a theme token set on :root, the check answers true.
 *   - With no token on :root (the stylesheet never loaded), the check answers false.
 *
 * What these tests deliberately do not cover:
 *   - The real stylesheet and the real server: e2e/themeOnRoot.e2e.ts opens the page in
 *     Chromium and checks the tokens are there before the first graphic loads.
 *   - What renderer.ts does with the answer (one log line); the e2e test checks that no
 *     such line is logged when the theme is loaded.
 */
import { describe, expect, it } from 'vitest';

import { isThemeOnRoot, themeTokenCheckedOnRoot } from './themeOnRoot.js';

describe('isThemeOnRoot', () => {
  it('answers true when the checked token is on :root', () => {
    // Arrange: the token the check reads, set on :root as the theme's stylesheet does.
    document.documentElement.style.setProperty(themeTokenCheckedOnRoot, 'rgb(20 25 48 / 0.84)');

    // Act: ask whether the theme is on the page.
    const isOnRoot = isThemeOnRoot();

    // Assert: it is.
    expect(isOnRoot, 'a page with the token on :root must count as themed').toBe(true);
  });

  it('answers false when :root has no theme token', () => {
    // Arrange: a page whose stylesheet never loaded, so :root carries no token.
    document.documentElement.style.removeProperty(themeTokenCheckedOnRoot);

    // Act: ask whether the theme is on the page.
    const isOnRoot = isThemeOnRoot();

    // Assert: it is not.
    expect(isOnRoot, 'a page without the token on :root must not count as themed').toBe(false);
  });
});
