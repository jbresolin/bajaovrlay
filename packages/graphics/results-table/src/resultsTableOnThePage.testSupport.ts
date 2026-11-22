/**
 * Test support for the results table's tests: the element under test and readers of what
 * is on the board. No theme token is placed on the page unless a test places it, so every
 * timeline lasts 0 ms and a test never waits on real motion.
 */
import { onTestFinished } from 'vitest';

import ResultsTableGraphic from './resultsTable.js';

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-results-table-under-test', ResultsTableGraphic);

/**
 * Puts a fresh results table on the page, as a renderer does before calling load. When the
 * test ends it is disposed and removed, so no page timer runs into the next test.
 */
export function createResultsTableOnThePage(): ResultsTableGraphic {
  const resultsTable = document.createElement(
    'baja-results-table-under-test',
  ) as ResultsTableGraphic;
  document.body.append(resultsTable);
  onTestFinished(async () => {
    await resultsTable.dispose();
    resultsTable.remove();
  });
  return resultsTable;
}

/** Loads the table the way an OBS renderer does: real-time, at 1920x1080. */
export function loadResultsTableWithData(resultsTable: ResultsTableGraphic, data: unknown) {
  return resultsTable.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Every element with a test id inside the shadow root, in document order. */
export function listPartsOfResultsTable(
  resultsTable: ResultsTableGraphic,
  testId: string,
): HTMLElement[] {
  const parts = resultsTable.shadowRoot?.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`);
  return parts === undefined ? [] : [...parts];
}

/** The car numbers of the rows on the board, top to bottom. */
export function readCarNumbersOnTheBoard(resultsTable: ResultsTableGraphic): number[] {
  return listPartsOfResultsTable(resultsTable, 'results-table-row').map((row) =>
    Number(row.dataset.carNumber),
  );
}

/** The text of the head's page line ("1/2 · 1º A 20º"). */
export function readPageLine(resultsTable: ResultsTableGraphic): string | null | undefined {
  return listPartsOfResultsTable(resultsTable, 'results-table-page-line')[0]?.textContent;
}

/** The column head's captions, left to right, as written (the styles set them in caps). */
export function readCaptions(resultsTable: ResultsTableGraphic): string[] {
  const columnHead = listPartsOfResultsTable(resultsTable, 'results-table-column-head')[0];
  return [...(columnHead?.children ?? [])].map((caption) => caption.textContent ?? '');
}

/** The texts of one row's cells, left to right: rank, car, team with school, the page's cells. */
export function readRowTexts(resultsTable: ResultsTableGraphic, rowIndex: number): string[] {
  const row = listPartsOfResultsTable(resultsTable, 'results-table-row')[rowIndex];
  const pill = row?.firstElementChild;
  return [...(pill?.children ?? [])].map((cell) => cell.textContent ?? '');
}

/** Puts tokens on :root for one test (the kit's, shared by every graphic's tests). */
export { placeTokensOnTheRoot } from '@bajaovrlay/graphics-kit/themeTokensOnThePage.testSupport';
