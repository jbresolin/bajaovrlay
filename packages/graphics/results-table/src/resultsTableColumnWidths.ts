/**
 * The widths of the page's columns, from their content (BAJAOVRLAY-83): each column as wide
 * as its widest text (its head, or a cell of any page, so a column never jumps from one
 * page to the next), measured in the board's own font, so a "#" or "Larga em" column stays
 * narrow and the team column takes the rest. When the columns would leave the team too
 * little, they are narrowed together, and a text cut off scrolls in its box.
 *
 * Measured, not guessed from a count of letters: the captions and the rows use two sizes of
 * one condensed face, where a "%" or an "M" is far wider than a "1".
 */

/**
 * The share of the board's width the page's columns may take together; the rank, the car
 * chip and the team (with its school, which scrolls when long) keep the rest. At 1728 px
 * that leaves the team about 600 px, as wide as the standings give it beside six parts.
 */
export const shareOfTheBoardForThePageColumns = 0.6;

/**
 * The widths the columns get, whole pixels: their natural widths when they fit in the share
 * of the board, else each narrowed by the same factor so they fill it exactly.
 */
export function fitColumnWidthsIntoTheBoard(
  naturalWidthsPx: readonly number[],
  boardWidthPx: number,
): number[] {
  const widthForTheColumnsPx = boardWidthPx * shareOfTheBoardForThePageColumns;
  const naturalTotalPx = naturalWidthsPx.reduce((total, width) => total + width, 0);
  if (naturalTotalPx <= widthForTheColumnsPx) {
    return naturalWidthsPx.map((width) => Math.ceil(width));
  }
  const narrowingFactor = widthForTheColumnsPx / naturalTotalPx;
  return naturalWidthsPx.map((width) => Math.floor(width * narrowingFactor));
}

/**
 * The grid every pill of the board shares: the rank, the car chip, the team taking the
 * rest, then one fixed width per page column. Written on the board as `--standings-columns`.
 */
export function buildResultsTableGridTemplate(columnWidthsPx: readonly number[]): string {
  const fixedColumns = 'var(--column-pos) var(--chip-width) minmax(0, 1fr)';
  const pageColumns = columnWidthsPx.map((width) => `${String(width)}px`);
  return [fixedColumns, ...pageColumns].join(' ');
}

/**
 * Measures the natural width of each column in the page: its caption and every different
 * text of its cells, each in a hidden element with the look it has on air (`captionClass`,
 * `cellClass`), all measured at once after one layout. Answers the widest per column.
 */
export function measureNaturalColumnWidths(
  measuringBox: HTMLElement,
  textsOfEachColumn: ReadonlyArray<{ caption: string; cellTexts: readonly string[] }>,
  classNames: { captionClass: string; cellClass: string },
): number[] {
  const measuredElementsOfEachColumn = textsOfEachColumn.map((column) => {
    const captionElement = createMeasuredElement(classNames.captionClass, column.caption);
    const differentCellTexts = [...new Set(column.cellTexts)];
    const cellElements = differentCellTexts.map((cellText) =>
      createMeasuredElement(classNames.cellClass, cellText),
    );
    return [captionElement, ...cellElements];
  });
  measuringBox.replaceChildren(...measuredElementsOfEachColumn.flat());
  // Read only after every element is in: one layout for the whole table.
  const widths = measuredElementsOfEachColumn.map((elements) =>
    Math.max(0, ...elements.map((element) => element.getBoundingClientRect().width)),
  );
  measuringBox.replaceChildren();
  return widths;
}

function createMeasuredElement(className: string, text: string): HTMLElement {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = text;
  return element;
}
