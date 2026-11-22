/**
 * The results table's DOM: the template Lit draws once (the board, its head card, the one
 * table, a hidden box the column widths are measured in), and the one function that makes
 * the table match a page. The table is a column-head pill over a list of row pills; rows
 * are kept by slot and their cells rewritten in place, so a live update never rebuilds a
 * row on air, never restarts a cell's scroll and never makes a row re-enter. Only the rows
 * the page gains or loses are created or removed.
 */
import {
  makeScrollingTextBox,
  writeScrollingTextIfChanged,
} from '@bajaovrlay/graphics-kit/scrollingTextBox';
import { writeTextIfChanged } from '@bajaovrlay/graphics-kit/textInPlace';
import {
  findWideBoardHeadParts,
  renderWideBoardHeadTemplate,
  writeWideBoardHead,
} from '@bajaovrlay/graphics-kit/wideBoardHead';
import { html, type TemplateResult } from 'lit';

import { ptBR } from './ptBR.js';
import { placePiecesOffAir, showPiecesAtOnce } from './resultsTableAnimations.js';
import {
  buildResultsTableGridTemplate,
  fitColumnWidthsIntoTheBoard,
  measureNaturalColumnWidths,
} from './resultsTableColumnWidths.js';
import type { ResultsTablePage } from './resultsTableLayout.js';
import type { ResultsTableEntry, ResultsTableSettings } from './resultsTableModel.js';
import {
  isOnTheMedalChip,
  type ShownColumn,
  writeCellText,
  writeRankText,
} from './resultsTableText.js';

/** The elements the template draws once, and the element the theme's tokens are read from. */
export type ResultsTableParts = {
  /**
   * The host element, in the page's light DOM: every token is read from its computed style
   * (jsdom does not inherit custom properties across the shadow boundary).
   */
  tokensSource: Element;
  board: HTMLElement;
  head: HTMLElement;
  title: HTMLElement;
  eventLine: HTMLElement;
  pageLine: HTMLElement;
  columnHead: HTMLElement;
  rows: HTMLElement;
  measuringBox: HTMLElement;
};

/**
 * How the pieces of a drawn page are placed, as on the standings:
 * - `offAir`: the board is not on air; the column head and every row wait off air;
 * - `atOnce`: on air (a live update); pieces already there stay, new rows show at once;
 * - `beforeCascade`: during a page turn; new rows wait off air for the turn's cascade.
 */
export type PiecePlacement = 'offAir' | 'atOnce' | 'beforeCascade';

/** The three cells every row has before the page's own: rank, car chip, team. */
const fixedCellCount = 3;

// The classes a page column's caption and cells have on air; the widths are measured in them.
const valueCaptionClass = 'caption caption-value';
const valueCellClass = 'cell cell-value';

/** The board's markup, drawn once. data-testid names are how code and tests find parts. */
export function renderResultsTableTemplate(): TemplateResult {
  return html`
    <section class="board" data-testid="results-table">
      ${renderWideBoardHeadTemplate('results-table', ptBR.logoAlternativeText)}
      <div class="table" data-testid="results-table-table">
        <header class="pill column-head" data-testid="results-table-column-head"></header>
        <ol class="rows" data-testid="results-table-rows"></ol>
      </div>
      <div class="measuring-box" aria-hidden="true" data-testid="results-table-measuring-box"></div>
    </section>
  `;
}

/** Finds every part in the rendered template; a missing one is a bug in the template. */
export function findResultsTableParts(
  renderRoot: ParentNode,
  tokensSource: Element,
): ResultsTableParts {
  const findPart = (testId: string): HTMLElement => {
    const part = renderRoot.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (part === null) {
      throw new Error(`results table part "${testId}" is missing from the template; this is a bug`);
    }
    return part;
  };
  return {
    tokensSource,
    board: findPart('results-table'),
    ...findWideBoardHeadParts(renderRoot, 'results-table'),
    columnHead: findPart('results-table-column-head'),
    rows: findPart('results-table-rows'),
    measuringBox: findPart('results-table-measuring-box'),
  };
}

/** Writes the head card: the title, the event line (left out when empty) and the page line. */
export function writeResultsTableHead(
  parts: ResultsTableParts,
  settings: ResultsTableSettings,
  pageLine: string,
): void {
  writeWideBoardHead(parts, { title: settings.title, eventLine: settings.eventLine, pageLine });
}

/**
 * Makes the table match a page: the column widths from every row of every page (so they
 * never jump between pages), the column head's captions, and one row per team of the page,
 * reusing the rows already there by slot; then places the pieces as `placement` says.
 */
export function drawResultsTablePage(
  parts: ResultsTableParts,
  page: ResultsTablePage,
  shownColumns: readonly ShownColumn[],
  everyEntryInOrder: readonly ResultsTableEntry[],
  placement: PiecePlacement,
): void {
  writeColumnWidths(parts, shownColumns, everyEntryInOrder);
  writeColumnHead(parts.columnHead, shownColumns);

  const rowsGained: HTMLElement[] = [];
  while (parts.rows.children.length < page.entries.length) {
    const row = createEmptyRow();
    rowsGained.push(row);
    parts.rows.append(row);
  }
  while (parts.rows.children.length > page.entries.length) {
    parts.rows.lastElementChild?.remove();
  }
  const rowElements = [...parts.rows.children] as HTMLElement[];
  page.entries.forEach((entry, slotIndex) => {
    const row = rowElements[slotIndex];
    if (row !== undefined) {
      writeRowFromEntry(row, entry, shownColumns);
    }
  });

  if (placement === 'offAir') {
    placePiecesOffAir(parts.tokensSource, listPiecesTopToBottom(parts));
  } else if (placement === 'beforeCascade') {
    placePiecesOffAir(parts.tokensSource, rowsGained);
  } else {
    showPiecesAtOnce(rowsGained);
  }
}

/** The table's pieces top to bottom, its column head first: what cascades in at play. */
export function listPiecesTopToBottom(parts: ResultsTableParts): HTMLElement[] {
  return [parts.columnHead, ...listRows(parts)];
}

/** The rows of the page on the board: what a page turn takes out and brings back. */
export function listRows(parts: ResultsTableParts): HTMLElement[] {
  return [...parts.rows.children] as HTMLElement[];
}

/** Measures the shown columns over every row and writes the grid on the board. */
function writeColumnWidths(
  parts: ResultsTableParts,
  shownColumns: readonly ShownColumn[],
  everyEntryInOrder: readonly ResultsTableEntry[],
): void {
  const textsOfEachColumn = shownColumns.map((column) => ({
    caption: column.head,
    cellTexts: everyEntryInOrder.map((entry) => writeCellText(entry.cells[column.cellIndex])),
  }));
  const naturalWidthsPx = measureNaturalColumnWidths(parts.measuringBox, textsOfEachColumn, {
    captionClass: valueCaptionClass,
    cellClass: valueCellClass,
  });
  const boardWidthPx = parts.board.getBoundingClientRect().width;
  const columnWidthsPx = fitColumnWidthsIntoTheBoard(naturalWidthsPx, boardWidthPx);
  parts.board.style.setProperty(
    '--standings-columns',
    buildResultsTableGridTemplate(columnWidthsPx),
  );
}

/**
 * Writes the captions: POS, Nº, EQUIPE, then each shown column's head as the site writes
 * it. Left as they are when the heads did not change, so a long head scrolling on air goes
 * on through a live update.
 */
function writeColumnHead(columnHead: HTMLElement, shownColumns: readonly ShownColumn[]): void {
  const headsWritten = JSON.stringify(shownColumns.map((column) => column.head));
  if (columnHead.dataset.headsWritten === headsWritten) {
    return;
  }
  columnHead.dataset.headsWritten = headsWritten;
  const captions = [
    createCell('caption caption-rank', ptBR.columnCaptions.rank),
    createCell('caption caption-car', ptBR.columnCaptions.car),
    createCell('caption caption-team', ptBR.columnCaptions.team),
  ];
  for (const column of shownColumns) {
    const caption = createCell(valueCaptionClass, '', 'column-caption');
    writeScrollingTextIfChanged(caption, column.head);
    captions.push(caption);
  }
  columnHead.replaceChildren(...captions);
}

/** The `<li>` the animations move, around the slate pill that holds the cells. */
function createEmptyRow(): HTMLElement {
  const row = document.createElement('li');
  row.className = 'row';
  row.dataset.testid = 'results-table-row';
  const pill = document.createElement('div');
  pill.className = 'pill row-pill';
  pill.append(
    createCell('cell cell-rank', '', 'row-rank'),
    createCell('cell cell-car chip', '', 'row-car'),
    createCell('cell cell-team', '', 'row-team'),
  );
  row.append(pill);
  return row;
}

/**
 * Writes a row's cells in place: the site's rank (on the green chip for 1 to 3), the car
 * chip, the team with its school, and one cell per shown column; and `data-medal`, which
 * the styles read. Cells are created or removed only when the number of columns changed.
 */
function writeRowFromEntry(
  row: HTMLElement,
  entry: ResultsTableEntry,
  shownColumns: readonly ShownColumn[],
): void {
  const pill = row.firstElementChild as HTMLElement;
  row.dataset.carNumber = String(entry.carNumber);
  row.toggleAttribute('data-medal', isOnTheMedalChip(entry));

  const [rankCell, carCell, teamCell] = [...pill.children] as HTMLElement[];
  if (rankCell !== undefined) {
    writeTextIfChanged(rankCell, writeRankText(entry));
  }
  if (carCell !== undefined) {
    writeTextIfChanged(carCell, String(entry.carNumber));
  }
  if (teamCell !== undefined) {
    writeTeamCell(teamCell, entry);
  }

  const valueCellCount = shownColumns.length;
  while (pill.children.length < fixedCellCount + valueCellCount) {
    pill.append(createCell(valueCellClass, '', 'row-value'));
  }
  while (pill.children.length > fixedCellCount + valueCellCount) {
    pill.lastElementChild?.remove();
  }
  const valueCells = ([...pill.children] as HTMLElement[]).slice(fixedCellCount);
  shownColumns.forEach((column, columnIndex) => {
    const valueCell = valueCells[columnIndex];
    if (valueCell !== undefined) {
      writeScrollingTextIfChanged(valueCell, writeCellText(entry.cells[column.cellIndex]));
    }
  });
}

/**
 * Writes the team and its school into the team cell. The box is kept when it already shows
 * this team and school, so a long name scrolling on air goes on through a live update.
 */
function writeTeamCell(teamCell: HTMLElement, entry: ResultsTableEntry): void {
  const teamName = teamCell.querySelector('[data-testid="row-team-name"]')?.textContent;
  const schoolName = teamCell.querySelector('[data-testid="row-school-name"]')?.textContent;
  const isShowingThisTeam = teamName === entry.teamName && schoolName === entry.schoolName;
  if (isShowingThisTeam) {
    return;
  }
  // The box scrolls inside the cell, never the cell itself: a grid cell that clips
  // shrinks its track and lifts the whole row by a pixel (as the standings found).
  const teamBox = createCell('team-box', '', 'row-team-box');
  teamBox.append(
    createCell('team-name', entry.teamName, 'row-team-name'),
    createCell('school-name', entry.schoolName, 'row-school-name'),
  );
  const teamText = makeScrollingTextBox(teamBox);
  teamText.classList.add('team-with-school');
  teamCell.replaceChildren(teamBox);
}

function createCell(className: string, text: string, testId?: string): HTMLElement {
  const cell = document.createElement('span');
  cell.className = className;
  cell.textContent = text;
  if (testId !== undefined) {
    cell.dataset.testid = testId;
  }
  return cell;
}
