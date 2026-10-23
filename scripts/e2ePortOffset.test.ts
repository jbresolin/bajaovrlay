/**
 * How far the browser tests' ports are moved (scripts)
 *
 * What this module is for:
 *   BAJAOVRLAY_E2E_PORT_OFFSET moves every port of the browser tests by the same amount,
 *   so two checkouts (two worktrees) can run them at once without one reusing the other's
 *   servers; CI leaves it unset. Every Playwright config and e2e helper reads it through
 *   this one module (gate 2 of PR #23), so a typo moves no port at all rather than some.
 *
 * What these tests prove:
 *   - Unset is 0; a whole number is that number.
 *   - Anything not a whole number (a word, a negative, a fraction, blank, a number with
 *     a unit) is 0, never NaN, which would have left every port NaN.
 *
 * What these tests deliberately do not cover:
 *   - The ports themselves; each package's playwright.config.ts.
 */
import { describe, expect, it } from 'vitest';

import { readPortOffsetOfTheBrowserTests } from './e2ePortOffset.js';

describe('readPortOffsetOfTheBrowserTests', () => {
  const values = [
    // CI and most local runs: unset.
    { name: 'is 0 when unset', value: undefined, expected: 0 },
    // A second worktree, as its README says.
    { name: 'is 100 for "100"', value: '100', expected: 100 },
    // Zero written out.
    { name: 'is 0 for "0"', value: '0', expected: 0 },
    // A word, which Number() would make NaN.
    { name: 'is 0 for a word', value: 'cem', expected: 0 },
    // A negative would move ports under the ones written in the configs.
    { name: 'is 0 for a negative', value: '-100', expected: 0 },
    // A fraction is no port.
    { name: 'is 0 for a fraction', value: '1.5', expected: 0 },
    // Set but empty, as `BAJAOVRLAY_E2E_PORT_OFFSET= pnpm test:e2e` leaves it.
    { name: 'is 0 for blank', value: '', expected: 0 },
    // A number with a unit after it.
    { name: 'is 0 for "100px"', value: '100px', expected: 0 },
  ];

  it.each(values)('$name', ({ value, expected }) => {
    // Arrange: the variable's value of this row.

    // Act: read it.
    const offset = readPortOffsetOfTheBrowserTests(value);

    // Assert: the offset of this row.
    expect(offset, 'how far every port moves').toBe(expected);
  });
});
