/**
 * Reads the two theme tokens the tower's paging logic (not its timelines) needs, from an
 * element's computed style (custom properties reach inside the shadow root):
 * `--tower-rows-per-page`, how many row pills a page holds, and `--motion-strip-hold`,
 * how long a page is held before the next. Neither is a number of the graphic's own
 * (decision 15 of the context pack); a missing or unreadable token gives a usable
 * fallback, never a throw and never a 0 (a 0 ms hold would turn the page every frame).
 */
import { readMotionTokens } from '@bajaovrlay/theme/motion';

/** The rows per page used when the token is missing: Ardósia's 20. */
export const rowsPerPageWhenTokenMissing = 20;

/** The page hold used when the token is missing or not a duration: Ardósia's 7 s. */
export const pageHoldMsWhenTokenMissing = 7000;

/** The layout tokens as numbers. */
export type TowerLayoutTokens = {
  /** `--tower-rows-per-page`: how many row pills a page holds. */
  rowsPerPage: number;
  /** `--motion-strip-hold`: how long a page stays before the next turn, in milliseconds. */
  pageHoldMs: number;
};

/** Reads the layout tokens from `element`'s computed style. */
export function readTowerLayoutTokens(element: Element): TowerLayoutTokens {
  const rowsTokenValue = getComputedStyle(element).getPropertyValue('--tower-rows-per-page').trim();
  const rowsPerPage = Number.parseInt(rowsTokenValue, 10);
  const isRowsPerPageUsable = Number.isInteger(rowsPerPage) && rowsPerPage > 0;

  // readMotionTokens reads a missing or unreadable duration as 0, which is right for a
  // timeline (no motion, it still ends) and wrong for a hold (pages flipping every frame).
  const pageHoldMs = readMotionTokens(element).stripHoldMs;
  const isPageHoldUsable = pageHoldMs > 0;

  return {
    rowsPerPage: isRowsPerPageUsable ? rowsPerPage : rowsPerPageWhenTokenMissing,
    pageHoldMs: isPageHoldUsable ? pageHoldMs : pageHoldMsWhenTokenMissing,
  };
}
