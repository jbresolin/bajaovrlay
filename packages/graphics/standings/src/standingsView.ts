/**
 * The standings' DOM: the template Lit draws once (the board, its head card, the place for
 * the tables), and the one function that makes the tables match a page. A table is a
 * column-head pill over a list of row pills; the overall table is one table, the columns
 * board one to three. Tables and rows are kept by slot and reused: drawing a page again
 * (a live update, a page turn) rewrites the cells inside the same `<li>`, so a row on air
 * is never rebuilt, never re-enters, and a cascade running on it goes on. Only the slots
 * the page gains or loses are created or removed.
 */
import {
  findBoardHeadParts,
  renderBoardHeadTemplate,
  writeBoardHead,
} from '@bajaovrlay/graphics-kit/boardHead';
import { html, type TemplateResult } from 'lit';

import { ptBR } from './ptBR.js';
import { placePiecesOffAir, showPiecesAtOnce } from './standingsAnimations.js';
import type { StandingsLayout, StandingsPage } from './standingsLayout.js';
import type { ScorePart, StandingsEntry, StandingsSettings } from './standingsModel.js';
import {
  isOnTheLeaderChip,
  writePartPointsText,
  writeRankText,
  writeTotalText,
} from './standingsText.js';

/** The elements the template draws once, and the element the theme's tokens are read from. */
export type StandingsParts = {
  /**
   * The host element, in the page's light DOM: every token is read from its computed
   * style (jsdom does not inherit custom properties across the shadow boundary, so the
   * graphic and its tests read the same values this way).
   */
  tokensSource: Element;
  board: HTMLElement;
  head: HTMLElement;
  title: HTMLElement;
  eventLine: HTMLElement;
  pageLine: HTMLElement;
  tables: HTMLElement;
};

/**
 * How the pieces of a drawn page are placed:
 * - `offAir`: the board is not on air; every column head and row is put in its off-air
 *   look, ready for the play-in;
 * - `atOnce`: on air (a live update); the pieces already there are left as they are and
 *   the pieces the page gains are shown in place at once;
 * - `beforeCascade`: during a page turn; the pieces the page gains wait off air like the
 *   rest, and the turn's cascade brings them in.
 */
export type PiecePlacement = 'offAir' | 'atOnce' | 'beforeCascade';

/**
 * The board's markup, drawn once: the kit's head card, then the place for the tables.
 * data-testid names are how code and tests find parts.
 */
export function renderStandingsTemplate(): TemplateResult {
  return html`
    <section class="board" data-testid="standings" data-layout="table">
      ${renderBoardHeadTemplate('standings', ptBR.logoAlternativeText)}
      <div class="tables" data-testid="standings-tables"></div>
    </section>
  `;
}

/** Finds every part in the rendered template; a missing one is a bug in the template. */
export function findStandingsParts(renderRoot: ParentNode, tokensSource: Element): StandingsParts {
  const findPart = (testId: string): HTMLElement => {
    const part = renderRoot.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (part === null) {
      throw new Error(`standings part "${testId}" is missing from the template; this is a bug`);
    }
    return part;
  };
  return {
    tokensSource,
    board: findPart('standings'),
    ...findBoardHeadParts(renderRoot, 'standings'),
    tables: findPart('standings-tables'),
  };
}

/**
 * Writes the head card: the title, the event line (left out when there is none, so the
 * page line keeps its place at the right) and the page line. The card itself never moves.
 */
export function writeStandingsHead(
  parts: StandingsParts,
  settings: StandingsSettings,
  pageLine: string,
): void {
  writeBoardHead(parts, { title: settings.title, eventLine: settings.eventLine, pageLine });
}

/**
 * The grid every pill of the board shares, from the theme's widths: rank, chip, team, then
 * for the table one `--col-points` per part and `--col-total`; for the columns board one
 * `--col-points` for the points. Written on the board as `--standings-columns`.
 */
export function buildStandingsGridTemplate(layout: StandingsLayout, partCount: number): string {
  const fixedColumns = 'var(--column-pos) var(--chip-width) minmax(0, 1fr)';
  if (layout === 'columns') {
    return `${fixedColumns} var(--col-points)`;
  }
  const partColumns = Array.from({ length: partCount }, () => 'var(--col-points)');
  return [fixedColumns, ...partColumns, 'var(--col-total)'].join(' ');
}

/**
 * Makes the tables match a page: one table per column of the page, each with its column
 * head and one row per team, reusing the tables and rows already there by slot, and
 * places the pieces as `placement` says.
 */
export function drawStandingsPage(
  parts: StandingsParts,
  page: StandingsPage,
  scoreParts: readonly ScorePart[],
  placement: PiecePlacement,
): void {
  parts.board.dataset.layout = page.layout;
  parts.board.style.setProperty(
    '--standings-columns',
    buildStandingsGridTemplate(page.layout, scoreParts.length),
  );

  const piecesGained: HTMLElement[] = [];
  const tableElements = keepSlotCount(parts.tables, page.columns.length, () => {
    const table = createEmptyTable();
    piecesGained.push(findColumnHead(table));
    return table;
  });

  page.columns.forEach((entriesOfColumn, columnIndex) => {
    const table = tableElements[columnIndex];
    if (table === undefined) {
      return;
    }
    writeColumnHead(findColumnHead(table), page.layout, scoreParts);
    const rowElements = keepSlotCount(findRowsList(table), entriesOfColumn.length, () => {
      const row = createEmptyRow();
      piecesGained.push(row);
      return row;
    });
    entriesOfColumn.forEach((entry, slotIndex) => {
      const row = rowElements[slotIndex];
      if (row !== undefined) {
        writeRowFromEntry(row, entry, page.layout, scoreParts);
      }
    });
  });

  if (placement === 'offAir') {
    placePiecesOffAir(parts.tokensSource, listColumnCascades(parts).flat());
  } else if (placement === 'beforeCascade') {
    placePiecesOffAir(parts.tokensSource, piecesGained);
  } else {
    showPiecesAtOnce(piecesGained);
  }
}

/** Each table's pieces top to bottom, its column head first: the columns that cascade in. */
export function listColumnCascades(parts: StandingsParts): HTMLElement[][] {
  const tables = [...parts.tables.children] as HTMLElement[];
  return tables.map((table) => [findColumnHead(table), ...listRowsOfTable(table)]);
}

/**
 * The pieces a page turn takes out and brings back, per column: the table's rows (its
 * column head stays, as motion.md says), or the whole of each column on the columns
 * board, whose number of columns may change from one page to the next.
 */
export function listColumnCascadesThatTurn(parts: StandingsParts): HTMLElement[][] {
  if (parts.board.dataset.layout === 'table') {
    const tables = [...parts.tables.children] as HTMLElement[];
    return tables.map((table) => listRowsOfTable(table));
  }
  return listColumnCascades(parts);
}

/**
 * Makes `container` hold exactly `slotCount` children: creates the missing ones at the end
 * with `createChild`, removes the extra ones from the end. Answers the children in order.
 */
function keepSlotCount(
  container: HTMLElement,
  slotCount: number,
  createChild: () => HTMLElement,
): HTMLElement[] {
  while (container.children.length < slotCount) {
    container.append(createChild());
  }
  while (container.children.length > slotCount) {
    container.lastElementChild?.remove();
  }
  return [...container.children] as HTMLElement[];
}

function createEmptyTable(): HTMLElement {
  const table = document.createElement('div');
  table.className = 'table';
  table.dataset.testid = 'standings-table';
  const columnHead = document.createElement('header');
  columnHead.className = 'pill column-head';
  columnHead.dataset.testid = 'standings-column-head';
  const rowsList = document.createElement('ol');
  rowsList.className = 'rows';
  table.append(columnHead, rowsList);
  return table;
}

function findColumnHead(table: HTMLElement): HTMLElement {
  return table.firstElementChild as HTMLElement;
}

function findRowsList(table: HTMLElement): HTMLElement {
  return table.lastElementChild as HTMLElement;
}

function listRowsOfTable(table: HTMLElement): HTMLElement[] {
  return [...findRowsList(table).children] as HTMLElement[];
}

/** The `<li>` the animations move, around the slate pill that holds the cells. */
function createEmptyRow(): HTMLElement {
  const row = document.createElement('li');
  row.className = 'row';
  row.dataset.testid = 'standings-row';
  const pill = document.createElement('div');
  pill.className = 'pill row-pill';
  row.append(pill);
  return row;
}

/** Writes the captions of a column head: POS, Nº, EQUIPE, then the parts and TOTAL, or PONTOS. */
function writeColumnHead(
  columnHead: HTMLElement,
  layout: StandingsLayout,
  scoreParts: readonly ScorePart[],
): void {
  const captions = [
    createCell('caption caption-rank', ptBR.columnCaptions.rank),
    createCell('caption caption-car', ptBR.columnCaptions.car),
    createCell('caption caption-team', ptBR.columnCaptions.team),
  ];
  if (layout === 'table') {
    for (const scorePart of scoreParts) {
      captions.push(createCell('caption caption-part', scorePart.label));
    }
    captions.push(createCell('caption caption-total', ptBR.columnCaptions.total));
  } else {
    captions.push(createCell('caption caption-total', ptBR.columnCaptions.points));
  }
  columnHead.replaceChildren(...captions);
}

/**
 * Writes a row's cells from its team: the rank (on the green chip for rank 1), the car
 * chip, the team with its school, one cell per part in the table, the total; and the
 * marks the styles read (`data-leader`, `data-disqualified`).
 */
function writeRowFromEntry(
  row: HTMLElement,
  entry: StandingsEntry,
  layout: StandingsLayout,
  scoreParts: readonly ScorePart[],
): void {
  row.dataset.carNumber = String(entry.carNumber);
  row.toggleAttribute('data-leader', isOnTheLeaderChip(entry));
  row.toggleAttribute('data-disqualified', entry.isDisqualified ?? false);

  const teamCell = createCell('cell cell-team', '', 'row-team');
  teamCell.append(
    createCell('team-name', entry.teamName, 'row-team-name'),
    createCell('school-name', entry.schoolName, 'row-school-name'),
  );
  const cells = [
    createCell('cell cell-rank', writeRankText(entry), 'row-rank'),
    createCell('cell cell-car chip', String(entry.carNumber), 'row-car'),
    teamCell,
  ];
  if (layout === 'table') {
    for (const scorePart of scoreParts) {
      cells.push(
        createCell('cell cell-part', writePartPointsText(entry, scorePart.partId), 'row-part'),
      );
    }
  }
  cells.push(createCell('cell cell-total', writeTotalText(entry), 'row-total'));
  row.firstElementChild?.replaceChildren(...cells);
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
