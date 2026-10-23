// How far every port of the browser tests is moved: BAJAOVRLAY_E2E_PORT_OFFSET, read once
// here for every Playwright config and e2e helper (gate 2 of PR #23). Two checkouts (two
// worktrees) can then run the browser tests at once without one reusing the other's
// servers; CI leaves it unset and runs on the ports the configs write. TypeScript, not a
// plain-Node script: only the configs import it, and Playwright compiles them.

const wholeNumberPattern = /^[0-9]+$/;

/**
 * The offset a value of the variable gives: a whole number as written, and 0 for unset
 * or anything else (a word, a negative, a fraction), never NaN, which would make every
 * port NaN.
 */
export function readPortOffsetOfTheBrowserTests(value: string | undefined): number {
  if (value === undefined || !wholeNumberPattern.test(value)) {
    return 0;
  }
  return Number(value);
}

/** How far every browser-test port is moved in this run, 0 when unset. */
export const portOffsetOfTheBrowserTests = readPortOffsetOfTheBrowserTests(
  process.env.BAJAOVRLAY_E2E_PORT_OFFSET,
);
