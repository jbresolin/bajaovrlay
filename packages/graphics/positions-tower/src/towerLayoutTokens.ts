/**
 * Reads the theme's layout token the tower's logic needs, `--tower-rows-per-page`, from an
 * element's computed style (custom properties reach inside the shadow root). The number
 * of rows a page holds is the theme's, never the graphic's own (decision 15 of the
 * context pack); a missing or unreadable token gives a usable fallback, never a throw.
 */

/** The rows per page used when the token is missing: Ardósia's 20. */
export const rowsPerPageWhenTokenMissing = 20;

/** The layout tokens as numbers. */
export type TowerLayoutTokens = {
  /** `--tower-rows-per-page`: how many row pills a page holds. */
  rowsPerPage: number;
};

/** Reads the layout tokens from `element`'s computed style. */
export function readTowerLayoutTokens(element: Element): TowerLayoutTokens {
  const tokenValue = getComputedStyle(element).getPropertyValue('--tower-rows-per-page').trim();
  const rowsPerPage = Number.parseInt(tokenValue, 10);
  const isUsable = Number.isInteger(rowsPerPage) && rowsPerPage > 0;
  return { rowsPerPage: isUsable ? rowsPerPage : rowsPerPageWhenTokenMissing };
}
