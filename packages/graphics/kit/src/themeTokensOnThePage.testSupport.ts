/**
 * Test support for the graphics' unit tests (jsdom): puts theme tokens on :root, as the
 * renderer page does, for the length of one test. Moved here from the five graphics that
 * each had a copy (gate 2 of PR #30); each graphic's own test support re-exports it. No
 * graphic's own module imports this file.
 */
import { onTestFinished } from 'vitest';

/**
 * Puts tokens on :root, as the renderer page does, and takes them off again when the test
 * ends so a test without a theme reads nothing.
 */
export function placeTokensOnTheRoot(tokenDeclarations: Record<string, string>): void {
  const root = document.documentElement;
  for (const [tokenName, value] of Object.entries(tokenDeclarations)) {
    root.style.setProperty(tokenName, value);
  }
  onTestFinished(() => {
    for (const tokenName of Object.keys(tokenDeclarations)) {
      root.style.removeProperty(tokenName);
    }
  });
}
